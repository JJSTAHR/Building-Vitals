/**
 * Hybrid Point Enhancement System
 * Version: 1.0.0
 *
 * Multi-tier enhancement system that intelligently combines:
 * 1. Cache lookup (fastest)
 * 2. Rule-based enhancement (fast, high confidence)
 * 3. AI validation (medium speed, medium cost)
 * 4. Full AI enhancement (slower, higher cost)
 *
 * Goal: Process 4,500+ points in <5 minutes while staying under daily AI quota
 */

import { checkAIQuota, incrementAIQuota, getQuotaStatus } from './quota-manager.js';
import { checkCache, cacheResult, invalidateCache } from './cache-manager.js';
import { enhancePointRuleBased } from './rule-based-enhancer.js';
import { enhanceWithAI, validateWithAI } from './ai-enhancer.js';
import { recordMetric, getMetrics } from './metrics-collector.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,           // Above this: use rule-based only
  MEDIUM: 70,         // Below this: use full AI
  LOW: 50             // Below this: flag for manual review
};

const AI_QUOTA_LIMITS = {
  DAILY: 10000,       // Daily AI call limit
  WARNING: 8000,      // Warning threshold (80%)
  CRITICAL: 9500      // Critical threshold (95%)
};

const ENHANCEMENT_MODES = {
  CACHE: 'cache',
  RULE_BASED: 'rule-based',
  RULE_BASED_FALLBACK: 'rule-based-fallback',
  AI_VALIDATED: 'ai-validated',
  AI_FULL: 'ai-full'
};

// ============================================================================
// MAIN ENHANCEMENT FUNCTION
// ============================================================================

/**
 * Enhance a single point using hybrid approach
 * @param {Object} point - Raw point object from API
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} ctx - Worker execution context
 * @returns {Promise<Object>} Enhanced point with metadata
 */
export async function enhancePointHybrid(point, env, ctx) {
  const startTime = Date.now();
  const pointName = point.Name || point.name || 'unknown';

  try {
    // TIER 1: Check cache
    const cached = await checkCache(pointName, env);
    if (cached) {
      await recordMetric(env, 'enhancement', {
        mode: ENHANCEMENT_MODES.CACHE,
        duration: Date.now() - startTime,
        pointName
      });

      return {
        ...cached,
        source: ENHANCEMENT_MODES.CACHE,
        cached: true,
        _enhancedAt: new Date().toISOString()
      };
    }

    // TIER 2: Rule-based enhancement
    const ruleBased = await enhancePointRuleBased(point);

    // Check if rule-based confidence is high enough
    if (ruleBased.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      // High confidence: Use rule-based result
      await cacheResult(pointName, ruleBased, env, 7 * 24 * 3600); // 7 days

      await recordMetric(env, 'enhancement', {
        mode: ENHANCEMENT_MODES.RULE_BASED,
        confidence: ruleBased.confidence,
        duration: Date.now() - startTime,
        pointName
      });

      return {
        ...ruleBased,
        source: ENHANCEMENT_MODES.RULE_BASED,
        cached: false,
        _enhancedAt: new Date().toISOString()
      };
    }

    // TIER 3: Check AI quota before using AI
    const quotaStatus = await checkAIQuota(env);

    if (quotaStatus.exceeded) {
      // Quota exceeded: Fallback to rule-based
      await cacheResult(pointName, ruleBased, env, 3600); // 1 hour (shorter TTL)

      await recordMetric(env, 'enhancement', {
        mode: ENHANCEMENT_MODES.RULE_BASED_FALLBACK,
        confidence: ruleBased.confidence,
        quotaExceeded: true,
        duration: Date.now() - startTime,
        pointName
      });

      return {
        ...ruleBased,
        source: ENHANCEMENT_MODES.RULE_BASED_FALLBACK,
        quotaExceeded: true,
        quotaStatus,
        cached: false,
        _enhancedAt: new Date().toISOString()
      };
    }

    // TIER 4: AI enhancement (quota available)
    if (ruleBased.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
      // Low confidence: Full AI enhancement
      const aiEnhanced = await enhanceWithAI(point, ruleBased, env);
      await incrementAIQuota(env, 2); // 2 AI calls (embedding + generation)

      await cacheResult(pointName, aiEnhanced, env, 7 * 24 * 3600); // 7 days

      await recordMetric(env, 'enhancement', {
        mode: ENHANCEMENT_MODES.AI_FULL,
        confidence: aiEnhanced.confidence,
        aiCalls: 2,
        duration: Date.now() - startTime,
        pointName
      });

      return {
        ...aiEnhanced,
        source: ENHANCEMENT_MODES.AI_FULL,
        cached: false,
        _enhancedAt: new Date().toISOString()
      };
    } else {
      // Medium confidence: AI validation only
      const validated = await validateWithAI(ruleBased, env);
      await incrementAIQuota(env, 1); // 1 AI call (semantic search only)

      await cacheResult(pointName, validated, env, 24 * 3600); // 24 hours

      await recordMetric(env, 'enhancement', {
        mode: ENHANCEMENT_MODES.AI_VALIDATED,
        confidence: validated.confidence,
        aiCalls: 1,
        duration: Date.now() - startTime,
        pointName
      });

      return {
        ...validated,
        source: ENHANCEMENT_MODES.AI_VALIDATED,
        cached: false,
        _enhancedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('[ENHANCE] Error enhancing point:', {
      pointName,
      error: error.message,
      stack: error.stack
    });

    // Fallback: Return basic cleaned point
    const fallback = {
      name: pointName,
      display_name: point['Kv Tags']?.[0]?.dis || pointName,
      original_name: pointName,
      source: 'error-fallback',
      error: error.message,
      _enhancedAt: new Date().toISOString()
    };

    await recordMetric(env, 'enhancement', {
      mode: 'error',
      error: error.message,
      duration: Date.now() - startTime,
      pointName
    });

    return fallback;
  }
}

// ============================================================================
// BATCH ENHANCEMENT
// ============================================================================

/**
 * Enhance multiple points in batches with progress tracking
 * @param {Array} points - Array of raw point objects
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} options - Batch options
 * @returns {Promise<Object>} Batch results with metrics
 */
export async function enhancePointsBatch(points, env, options = {}) {
  const {
    batchSize = 100,
    maxConcurrency = 10,
    onProgress = null,
    jobId = null
  } = options;

  const startTime = Date.now();
  const totalPoints = points.length;
  const results = [];
  const errors = [];
  let processedCount = 0;

  console.log('[BATCH] Starting batch enhancement:', {
    totalPoints,
    batchSize,
    maxConcurrency,
    jobId
  });

  try {
    // Process in batches
    for (let i = 0; i < totalPoints; i += batchSize) {
      const batch = points.slice(i, Math.min(i + batchSize, totalPoints));
      const batchStartTime = Date.now();

      // Process batch with concurrency control
      const batchResults = [];
      for (let j = 0; j < batch.length; j += maxConcurrency) {
        const concurrentBatch = batch.slice(j, Math.min(j + maxConcurrency, batch.length));

        const concurrentResults = await Promise.allSettled(
          concurrentBatch.map(point => enhancePointHybrid(point, env, null))
        );

        concurrentResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            batchResults.push(result.value);
          } else {
            const point = concurrentBatch[idx];
            errors.push({
              pointName: point.Name || point.name,
              error: result.reason.message,
              timestamp: new Date().toISOString()
            });
            batchResults.push({
              name: point.Name || point.name,
              error: result.reason.message,
              source: 'error'
            });
          }
        });
      }

      results.push(...batchResults);
      processedCount += batch.length;

      const batchDuration = Date.now() - batchStartTime;
      const progress = {
        processed: processedCount,
        total: totalPoints,
        percentage: ((processedCount / totalPoints) * 100).toFixed(2),
        batchDuration,
        estimatedTimeRemaining: ((totalPoints - processedCount) / batch.length) * batchDuration
      };

      console.log('[BATCH] Progress:', progress);

      // Call progress callback if provided
      if (onProgress) {
        onProgress(progress);
      }

      // Store progress in KV if jobId provided
      if (jobId && env.POINTS_KV) {
        await env.POINTS_KV.put(
          `batch:progress:${jobId}`,
          JSON.stringify({
            ...progress,
            timestamp: new Date().toISOString(),
            status: 'processing'
          }),
          { expirationTtl: 86400 } // 24 hours
        );
      }
    }

    const duration = Date.now() - startTime;
    const quotaStatus = await getQuotaStatus(env);
    const metrics = await getMetrics(env, 'enhancement', Date.now() - 3600000); // Last hour

    const summary = {
      success: true,
      totalPoints,
      processedCount,
      errorCount: errors.length,
      duration,
      durationMinutes: (duration / 60000).toFixed(2),
      averageTimePerPoint: (duration / totalPoints).toFixed(2),
      pointsPerSecond: ((totalPoints / duration) * 1000).toFixed(2),
      quotaStatus,
      metrics: metrics.summary,
      errors: errors.length > 0 ? errors : undefined,
      results,
      jobId
    };

    console.log('[BATCH] Batch complete:', summary);

    // Store final results if jobId provided
    if (jobId && env.POINTS_KV) {
      await env.POINTS_KV.put(
        `batch:results:${jobId}`,
        JSON.stringify({
          ...summary,
          completedAt: new Date().toISOString()
        }),
        { expirationTtl: 86400 }
      );
    }

    return summary;
  } catch (error) {
    console.error('[BATCH] Batch enhancement failed:', error);

    const errorSummary = {
      success: false,
      error: error.message,
      processedCount,
      totalPoints,
      duration: Date.now() - startTime,
      jobId
    };

    if (jobId && env.POINTS_KV) {
      await env.POINTS_KV.put(
        `batch:results:${jobId}`,
        JSON.stringify({
          ...errorSummary,
          failedAt: new Date().toISOString()
        }),
        { expirationTtl: 86400 }
      );
    }

    throw error;
  }
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Get batch progress status
 * @param {string} jobId - Job ID to check
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object|null>} Progress data or null
 */
export async function getBatchProgress(jobId, env) {
  try {
    const progress = await env.POINTS_KV.get(`batch:progress:${jobId}`, { type: 'json' });
    return progress;
  } catch (error) {
    console.error('[BATCH] Error getting progress:', error);
    return null;
  }
}

/**
 * Get batch results
 * @param {string} jobId - Job ID to get results for
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object|null>} Results data or null
 */
export async function getBatchResults(jobId, env) {
  try {
    const results = await env.POINTS_KV.get(`batch:results:${jobId}`, { type: 'json' });
    return results;
  } catch (error) {
    console.error('[BATCH] Error getting results:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  enhancePointHybrid,
  enhancePointsBatch,
  getBatchProgress,
  getBatchResults,
  CONFIDENCE_THRESHOLDS,
  AI_QUOTA_LIMITS,
  ENHANCEMENT_MODES
};
