/**
 * Vectorize Embeddings Module
 * Handles embedding generation, storage, and similarity search using Cloudflare Vectorize
 */

const BATCH_SIZE = 100;
const SIMILARITY_THRESHOLD = 0.7;
const CACHE_TTL = 3600; // 1 hour
const PROGRESS_KEY_PREFIX = 'embeddings:progress:';
const CACHE_KEY_PREFIX = 'similarity:cache:';

/**
 * Generate embeddings for points using BGE model
 * @param {Array} points - Array of point objects to generate embeddings for
 * @param {Object} env - Environment bindings (AI, VECTORIZE_INDEX, KV)
 * @param {string} jobId - Unique job ID for progress tracking
 * @returns {Promise<Object>} Result with count and status
 */
export async function generateEmbeddings(points, env, jobId = null) {
  const startTime = Date.now();
  const totalPoints = points.length;
  let processedCount = 0;
  let errorCount = 0;
  const errors = [];

  // Initialize or restore progress
  const progressKey = jobId ? `${PROGRESS_KEY_PREFIX}${jobId}` : null;
  let startIndex = 0;

  if (progressKey) {
    try {
      const savedProgress = await env.KV.get(progressKey, 'json');
      if (savedProgress?.lastProcessedIndex !== undefined) {
        startIndex = savedProgress.lastProcessedIndex + 1;
        console.log(`Resuming from index ${startIndex}`);
      }
    } catch (error) {
      console.warn('Could not restore progress:', error.message);
    }
  }

  const allEmbeddings = [];

  try {
    // Process in batches
    for (let i = startIndex; i < totalPoints; i += BATCH_SIZE) {
      const batch = points.slice(i, Math.min(i + BATCH_SIZE, totalPoints));
      const batchStartTime = Date.now();

      try {
        // Create searchable text for each point
        const texts = batch.map(point => {
          const tags = Array.isArray(point.marker_tags)
            ? point.marker_tags.join(' ')
            : '';

          return [
            point.display_name || point.Name || '',
            point.equipment || '',
            point.equipmentType || '',
            point.system || '',
            point.unit || '',
            tags
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .trim();
        });

        // Generate embeddings using BGE model
        const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: texts
        });

        // Validate response
        if (!response?.data || !Array.isArray(response.data)) {
          throw new Error('Invalid response from AI model');
        }

        // Format embeddings for Vectorize
        const embeddings = batch.map((point, idx) => ({
          id: point.id.toString(),
          values: response.data[idx],
          metadata: {
            name: point.Name || '',
            display_name: point.display_name || point.Name || '',
            equipment: point.equipment || '',
            equipmentType: point.equipmentType || '',
            system: point.system || '',
            unit: point.unit || '',
            marker_tags: point.marker_tags || []
          }
        }));

        allEmbeddings.push(...embeddings);
        processedCount += batch.length;

        // Store embeddings in Vectorize
        await storeSimilarPoints(embeddings, env);

        const batchDuration = Date.now() - batchStartTime;
        console.log(
          `Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ` +
          `${batch.length} points in ${batchDuration}ms`
        );

        // Update progress
        if (progressKey) {
          await env.KV.put(
            progressKey,
            JSON.stringify({
              jobId,
              totalPoints,
              processedCount,
              errorCount,
              lastProcessedIndex: i + batch.length - 1,
              lastUpdateTime: Date.now(),
              status: 'processing'
            }),
            { expirationTtl: 86400 } // 24 hours
          );
        }
      } catch (error) {
        errorCount += batch.length;
        errors.push({
          batchIndex: Math.floor(i / BATCH_SIZE),
          startIndex: i,
          endIndex: i + batch.length,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        console.error(`Error processing batch starting at ${i}:`, error);

        // Continue with next batch instead of failing completely
        processedCount += batch.length; // Count as processed even if failed
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      totalPoints,
      processedCount,
      successCount: processedCount - errorCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      averageTimePerPoint: duration / totalPoints,
      jobId
    };

    // Mark job as complete
    if (progressKey) {
      await env.KV.put(
        progressKey,
        JSON.stringify({
          ...result,
          status: 'completed',
          completedAt: new Date().toISOString()
        }),
        { expirationTtl: 86400 }
      );
    }

    return result;
  } catch (error) {
    // Save error state
    if (progressKey) {
      await env.KV.put(
        progressKey,
        JSON.stringify({
          jobId,
          status: 'failed',
          error: error.message,
          processedCount,
          errorCount,
          failedAt: new Date().toISOString()
        }),
        { expirationTtl: 86400 }
      );
    }

    throw error;
  }
}

/**
 * Store embeddings in Vectorize index
 * @param {Array} embeddings - Array of embedding objects
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Upsert result
 */
export async function storeSimilarPoints(embeddings, env) {
  if (!embeddings || embeddings.length === 0) {
    return { inserted: 0, error: 'No embeddings to store' };
  }

  try {
    // Validate embeddings format
    for (const embedding of embeddings) {
      if (!embedding.id || !embedding.values || !Array.isArray(embedding.values)) {
        throw new Error(`Invalid embedding format: ${JSON.stringify(embedding)}`);
      }
    }

    // Upsert to Vectorize
    const result = await env.VECTORIZE_INDEX.upsert(embeddings);

    console.log(`Stored ${embeddings.length} embeddings in Vectorize`);

    return {
      success: true,
      inserted: embeddings.length,
      result
    };
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw new Error(`Failed to store embeddings: ${error.message}`);
  }
}

/**
 * Find similar points using Vectorize similarity search
 * @param {string} pointId - ID of the point to find similar points for
 * @param {number} topK - Number of similar points to return
 * @param {Object} env - Environment bindings
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Array>} Array of similar points with scores
 */
export async function findSimilarPoints(pointId, topK = 5, env, useCache = true) {
  const cacheKey = `${CACHE_KEY_PREFIX}${pointId}:${topK}`;

  // Check cache first
  if (useCache) {
    try {
      const cached = await env.KV.get(cacheKey, 'json');
      if (cached) {
        console.log(`Cache hit for point ${pointId}`);
        return cached;
      }
    } catch (error) {
      console.warn('Cache read error:', error.message);
    }
  }

  try {
    // Query Vectorize for similar points
    // Add 1 to topK to account for self-match
    const results = await env.VECTORIZE_INDEX.query(pointId, {
      topK: topK + 1,
      returnMetadata: true
    });

    if (!results?.matches) {
      return [];
    }

    // Filter and format results
    const similarPoints = results.matches
      .filter(match => {
        // Exclude self and low similarity scores
        return match.id !== pointId && match.score >= SIMILARITY_THRESHOLD;
      })
      .slice(0, topK) // Limit to requested topK
      .map(match => ({
        id: match.id,
        point: match.metadata,
        similarity: match.score,
        reason: generateSimilarityReason(match.score, match.metadata)
      }));

    // Cache results
    if (useCache && similarPoints.length > 0) {
      try {
        await env.KV.put(
          cacheKey,
          JSON.stringify(similarPoints),
          { expirationTtl: CACHE_TTL }
        );
      } catch (error) {
        console.warn('Cache write error:', error.message);
      }
    }

    return similarPoints;
  } catch (error) {
    console.error(`Error finding similar points for ${pointId}:`, error);
    throw new Error(`Similarity search failed: ${error.message}`);
  }
}

/**
 * Generate human-readable similarity reason
 * @param {number} score - Similarity score (0-1)
 * @param {Object} metadata - Point metadata
 * @returns {string} Similarity reason
 */
function generateSimilarityReason(score, metadata = {}) {
  if (score >= 0.95) {
    return 'Nearly identical - same equipment type and system';
  } else if (score >= 0.9) {
    return 'Very similar - same equipment category';
  } else if (score >= 0.85) {
    return 'Similar - related equipment or system';
  } else if (score >= 0.8) {
    return 'Somewhat similar - shared characteristics';
  } else if (score >= SIMILARITY_THRESHOLD) {
    return 'Related - common attributes';
  } else {
    return 'Low similarity';
  }
}

/**
 * Get embedding generation progress
 * @param {string} jobId - Job ID to check progress for
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object|null>} Progress data or null if not found
 */
export async function getEmbeddingProgress(jobId, env) {
  const progressKey = `${PROGRESS_KEY_PREFIX}${jobId}`;

  try {
    const progress = await env.KV.get(progressKey, 'json');
    return progress;
  } catch (error) {
    console.error('Error getting progress:', error);
    return null;
  }
}

/**
 * Clear similarity cache for a specific point or all points
 * @param {Object} env - Environment bindings
 * @param {string|null} pointId - Optional point ID to clear cache for
 * @returns {Promise<Object>} Result object
 */
export async function clearSimilarityCache(env, pointId = null) {
  try {
    if (pointId) {
      // Clear cache for specific point (all topK values)
      const keysToDelete = [];
      for (let k = 1; k <= 20; k++) {
        keysToDelete.push(`${CACHE_KEY_PREFIX}${pointId}:${k}`);
      }

      await Promise.all(
        keysToDelete.map(key => env.KV.delete(key).catch(() => {}))
      );

      return { success: true, cleared: 'single', pointId };
    } else {
      // Note: KV doesn't support bulk delete by prefix easily
      // This would require listing all keys and deleting them
      return {
        success: false,
        message: 'Bulk cache clear not implemented. Clear cache per point.'
      };
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Batch process multiple similarity searches
 * @param {Array<string>} pointIds - Array of point IDs
 * @param {number} topK - Number of similar points per search
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Map of pointId to similar points
 */
export async function batchFindSimilarPoints(pointIds, topK, env) {
  const results = {};
  const errors = [];

  // Process in parallel with concurrency limit
  const CONCURRENCY = 10;
  for (let i = 0; i < pointIds.length; i += CONCURRENCY) {
    const batch = pointIds.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(pointId => findSimilarPoints(pointId, topK, env))
    );

    batchResults.forEach((result, idx) => {
      const pointId = batch[idx];
      if (result.status === 'fulfilled') {
        results[pointId] = result.value;
      } else {
        errors.push({ pointId, error: result.reason.message });
        results[pointId] = [];
      }
    });
  }

  return {
    success: true,
    results,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

export default {
  generateEmbeddings,
  storeSimilarPoints,
  findSimilarPoints,
  getEmbeddingProgress,
  clearSimilarityCache,
  batchFindSimilarPoints
};
