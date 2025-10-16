/**
 * Multi-Tier Cache Manager
 * Version: 1.0.0
 *
 * Manages caching of enhanced point data with intelligent TTL based on:
 * - Enhancement source (rule-based vs AI)
 * - Confidence level
 * - Data freshness
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_CONFIG = {
  // Cache TTL by enhancement source (seconds)
  TTL: {
    HIGH_CONFIDENCE: 7 * 24 * 3600,   // 7 days for high confidence
    MEDIUM_CONFIDENCE: 24 * 3600,     // 24 hours for medium confidence
    LOW_CONFIDENCE: 3600,             // 1 hour for low confidence
    AI_ENHANCED: 7 * 24 * 3600,       // 7 days for AI-enhanced
    RULE_BASED: 24 * 3600,            // 24 hours for rule-based
    ERROR_FALLBACK: 300               // 5 minutes for errors
  },

  // Cache key prefixes
  PREFIXES: {
    POINT: 'enhanced:point:',
    BATCH: 'enhanced:batch:',
    METADATA: 'cache:metadata:'
  },

  // Cache statistics
  STATS_KEY: 'cache:stats',
  STATS_TTL: 24 * 3600 // 24 hours
};

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Check cache for enhanced point
 * @param {string} pointName - Point name to look up
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object|null>} Cached point data or null
 */
export async function checkCache(pointName, env) {
  const key = `${CACHE_CONFIG.PREFIXES.POINT}${pointName}`;

  try {
    const cached = await env.POINTS_KV.get(key, { type: 'json' });

    if (cached) {
      // Validate cache entry
      if (isCacheValid(cached)) {
        // Update cache statistics
        await updateCacheStats(env, 'hit');

        console.log('[CACHE] HIT:', {
          pointName,
          source: cached.source,
          age: Date.now() - new Date(cached._cachedAt).getTime()
        });

        return cached;
      } else {
        // Invalid cache entry, delete it
        await env.POINTS_KV.delete(key);
        await updateCacheStats(env, 'invalid');

        console.log('[CACHE] INVALID:', pointName);
        return null;
      }
    }

    // Cache miss
    await updateCacheStats(env, 'miss');
    console.log('[CACHE] MISS:', pointName);

    return null;
  } catch (error) {
    console.error('[CACHE] Error checking cache:', error);
    await updateCacheStats(env, 'error');
    return null;
  }
}

/**
 * Store enhanced point in cache
 * @param {string} pointName - Point name
 * @param {Object} data - Enhanced point data
 * @param {Object} env - Environment bindings
 * @param {number} ttl - Custom TTL (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function cacheResult(pointName, data, env, ttl = null) {
  const key = `${CACHE_CONFIG.PREFIXES.POINT}${pointName}`;

  try {
    // Determine TTL based on data properties
    const effectiveTTL = ttl || calculateTTL(data);

    // Add cache metadata
    const cacheData = {
      ...data,
      _cachedAt: new Date().toISOString(),
      _cacheTTL: effectiveTTL,
      _cacheKey: key
    };

    // Store in KV
    await env.POINTS_KV.put(key, JSON.stringify(cacheData), {
      expirationTtl: effectiveTTL
    });

    // Store metadata for cache management
    await storeCacheMetadata(pointName, cacheData, env);

    // Update statistics
    await updateCacheStats(env, 'store');

    console.log('[CACHE] STORE:', {
      pointName,
      ttl: effectiveTTL,
      source: data.source,
      confidence: data.confidence
    });

    return true;
  } catch (error) {
    console.error('[CACHE] Error storing result:', error);
    await updateCacheStats(env, 'error');
    return false;
  }
}

/**
 * Invalidate cache for specific point or pattern
 * @param {string} pattern - Point name or pattern to invalidate
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Invalidation result
 */
export async function invalidateCache(pattern, env) {
  try {
    if (pattern === '*') {
      // Invalidate all (not recommended for production)
      console.warn('[CACHE] Invalidating all cache entries');
      return { success: false, message: 'Bulk invalidation not supported' };
    }

    // Invalidate specific point
    const key = `${CACHE_CONFIG.PREFIXES.POINT}${pattern}`;
    await env.POINTS_KV.delete(key);

    // Delete metadata
    await env.POINTS_KV.delete(`${CACHE_CONFIG.PREFIXES.METADATA}${pattern}`);

    await updateCacheStats(env, 'invalidate');

    console.log('[CACHE] INVALIDATE:', pattern);

    return {
      success: true,
      pattern,
      invalidatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[CACHE] Error invalidating cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cache statistics
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats(env) {
  try {
    const stats = await env.POINTS_KV.get(CACHE_CONFIG.STATS_KEY, { type: 'json' });

    if (!stats) {
      return {
        hits: 0,
        misses: 0,
        stores: 0,
        invalidations: 0,
        errors: 0,
        hitRate: 0,
        totalRequests: 0
      };
    }

    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? ((stats.hits / totalRequests) * 100).toFixed(2) : 0;

    return {
      ...stats,
      hitRate,
      totalRequests,
      lastUpdated: stats.lastUpdated
    };
  } catch (error) {
    console.error('[CACHE] Error getting stats:', error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate cache entry
 * @param {Object} cached - Cached data
 * @returns {boolean} Whether cache is valid
 */
function isCacheValid(cached) {
  if (!cached || !cached._cachedAt) {
    return false;
  }

  // Check required fields
  const hasRequiredFields = cached.name && cached.display_name;
  if (!hasRequiredFields) {
    return false;
  }

  // Check if expired (KV should handle this, but double-check)
  if (cached._cacheTTL) {
    const cachedTime = new Date(cached._cachedAt).getTime();
    const expirationTime = cachedTime + (cached._cacheTTL * 1000);
    if (Date.now() > expirationTime) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate appropriate TTL based on data properties
 * @param {Object} data - Enhanced point data
 * @returns {number} TTL in seconds
 */
function calculateTTL(data) {
  // Priority 1: Error fallback gets shortest TTL
  if (data.source === 'error' || data.source === 'error-fallback') {
    return CACHE_CONFIG.TTL.ERROR_FALLBACK;
  }

  // Priority 2: AI-enhanced data gets longest TTL
  if (data.source === 'ai-full' || data.source === 'ai-validated') {
    return CACHE_CONFIG.TTL.AI_ENHANCED;
  }

  // Priority 3: Use confidence level
  if (data.confidence) {
    if (data.confidence >= 85) {
      return CACHE_CONFIG.TTL.HIGH_CONFIDENCE;
    } else if (data.confidence >= 70) {
      return CACHE_CONFIG.TTL.MEDIUM_CONFIDENCE;
    } else {
      return CACHE_CONFIG.TTL.LOW_CONFIDENCE;
    }
  }

  // Default: Rule-based TTL
  return CACHE_CONFIG.TTL.RULE_BASED;
}

/**
 * Store cache metadata for management
 * @param {string} pointName - Point name
 * @param {Object} data - Cached data
 * @param {Object} env - Environment bindings
 */
async function storeCacheMetadata(pointName, data, env) {
  const metadataKey = `${CACHE_CONFIG.PREFIXES.METADATA}${pointName}`;

  try {
    const metadata = {
      pointName,
      source: data.source,
      confidence: data.confidence,
      cachedAt: data._cachedAt,
      ttl: data._cacheTTL,
      expiresAt: new Date(new Date(data._cachedAt).getTime() + (data._cacheTTL * 1000)).toISOString()
    };

    await env.POINTS_KV.put(metadataKey, JSON.stringify(metadata), {
      expirationTtl: data._cacheTTL + 3600 // Keep metadata slightly longer
    });
  } catch (error) {
    console.error('[CACHE] Error storing metadata:', error);
    // Non-critical, continue
  }
}

/**
 * Update cache statistics
 * @param {Object} env - Environment bindings
 * @param {string} operation - Operation type (hit/miss/store/invalidate/error)
 */
async function updateCacheStats(env, operation) {
  try {
    const stats = await env.POINTS_KV.get(CACHE_CONFIG.STATS_KEY, { type: 'json' }) || {
      hits: 0,
      misses: 0,
      stores: 0,
      invalidations: 0,
      invalid: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };

    // Increment appropriate counter
    switch (operation) {
      case 'hit':
        stats.hits++;
        break;
      case 'miss':
        stats.misses++;
        break;
      case 'store':
        stats.stores++;
        break;
      case 'invalidate':
        stats.invalidations++;
        break;
      case 'invalid':
        stats.invalid++;
        break;
      case 'error':
        stats.errors++;
        break;
    }

    stats.lastUpdated = new Date().toISOString();

    await env.POINTS_KV.put(
      CACHE_CONFIG.STATS_KEY,
      JSON.stringify(stats),
      { expirationTtl: CACHE_CONFIG.STATS_TTL }
    );
  } catch (error) {
    console.error('[CACHE] Error updating stats:', error);
    // Non-critical, continue
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  checkCache,
  cacheResult,
  invalidateCache,
  getCacheStats,
  CACHE_CONFIG
};
