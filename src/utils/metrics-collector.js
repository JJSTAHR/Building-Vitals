/**
 * Metrics Collector
 * Version: 1.0.0
 *
 * Collects and aggregates performance metrics for the hybrid enhancement system
 * Tracks enhancement modes, processing times, confidence scores, and quota usage
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const METRICS_CONFIG = {
  // KV key prefixes
  PREFIX: 'metrics:enhancement:',
  SUMMARY_KEY: 'metrics:summary',

  // Retention periods (seconds)
  TTL: {
    DETAILED: 24 * 3600,      // 24 hours for detailed metrics
    SUMMARY: 7 * 24 * 3600,   // 7 days for summaries
    HOURLY: 7 * 24 * 3600     // 7 days for hourly aggregates
  },

  // Aggregation intervals
  AGGREGATE_INTERVAL: 3600000, // 1 hour in milliseconds

  // Metric types
  TYPES: {
    ENHANCEMENT: 'enhancement',
    QUOTA: 'quota',
    CACHE: 'cache',
    PERFORMANCE: 'performance'
  }
};

// ============================================================================
// METRIC RECORDING
// ============================================================================

/**
 * Record an enhancement metric
 * @param {Object} env - Environment bindings
 * @param {string} type - Metric type
 * @param {Object} data - Metric data
 * @returns {Promise<boolean>} Success status
 */
export async function recordMetric(env, type, data) {
  const timestamp = Date.now();
  const hour = getHourKey(timestamp);

  try {
    const metric = {
      type,
      timestamp,
      hour,
      ...data
    };

    // Store detailed metric
    const detailKey = `${METRICS_CONFIG.PREFIX}${type}:${timestamp}`;
    await env.POINTS_KV.put(
      detailKey,
      JSON.stringify(metric),
      { expirationTtl: METRICS_CONFIG.TTL.DETAILED }
    );

    // Update hourly aggregate
    await updateHourlyAggregate(env, type, hour, metric);

    // Update summary statistics
    await updateSummary(env, type, metric);

    return true;
  } catch (error) {
    console.error('[METRICS] Error recording metric:', error);
    return false;
  }
}

/**
 * Record multiple metrics in batch
 * @param {Object} env - Environment bindings
 * @param {Array} metrics - Array of metric objects
 * @returns {Promise<Object>} Batch result
 */
export async function recordMetricsBatch(env, metrics) {
  const results = await Promise.allSettled(
    metrics.map(m => recordMetric(env, m.type, m.data))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - successful;

  return {
    total: metrics.length,
    successful,
    failed,
    success: failed === 0
  };
}

// ============================================================================
// METRIC RETRIEVAL
// ============================================================================

/**
 * Get metrics for a specific time range
 * @param {Object} env - Environment bindings
 * @param {string} type - Metric type
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp (optional, defaults to now)
 * @returns {Promise<Object>} Metrics data
 */
export async function getMetrics(env, type, startTime, endTime = Date.now()) {
  try {
    const startHour = getHourKey(startTime);
    const endHour = getHourKey(endTime);

    const hours = getHourRange(startHour, endHour);
    const aggregates = await Promise.all(
      hours.map(hour => getHourlyAggregate(env, type, hour))
    );

    // Filter out nulls and combine
    const validAggregates = aggregates.filter(Boolean);

    // Calculate summary statistics
    const summary = calculateSummaryStats(validAggregates);

    return {
      type,
      startTime,
      endTime,
      hours: validAggregates.length,
      aggregates: validAggregates,
      summary
    };
  } catch (error) {
    console.error('[METRICS] Error getting metrics:', error);
    return {
      type,
      startTime,
      endTime,
      error: error.message,
      aggregates: [],
      summary: {}
    };
  }
}

/**
 * Get overall summary statistics
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Summary statistics
 */
export async function getSummaryStats(env) {
  try {
    const summary = await env.POINTS_KV.get(METRICS_CONFIG.SUMMARY_KEY, { type: 'json' });

    if (!summary) {
      return {
        totalEnhancements: 0,
        byMode: {},
        avgConfidence: 0,
        avgProcessingTime: 0,
        cacheHitRate: 0,
        quotaUsage: 0
      };
    }

    return summary;
  } catch (error) {
    console.error('[METRICS] Error getting summary stats:', error);
    return null;
  }
}

/**
 * Get metrics dashboard data
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Dashboard data
 */
export async function getMetricsDashboard(env) {
  try {
    const [enhancementMetrics, cacheStats, quotaStatus] = await Promise.all([
      getMetrics(env, METRICS_CONFIG.TYPES.ENHANCEMENT, Date.now() - 24 * 3600000), // Last 24 hours
      env.POINTS_KV.get('cache:stats', { type: 'json' }),
      env.POINTS_KV.get(`ai-quota:${new Date().toISOString().split('T')[0]}`, { type: 'json' })
    ]);

    return {
      enhancement: enhancementMetrics.summary,
      cache: cacheStats || {},
      quota: {
        used: quotaStatus?.count || 0,
        limit: 10000,
        percentage: ((quotaStatus?.count || 0) / 10000 * 100).toFixed(2)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[METRICS] Error getting dashboard data:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Update hourly aggregate for a metric type
 * @param {Object} env - Environment bindings
 * @param {string} type - Metric type
 * @param {string} hour - Hour key
 * @param {Object} metric - Metric data
 */
async function updateHourlyAggregate(env, type, hour, metric) {
  const aggKey = `${METRICS_CONFIG.PREFIX}hourly:${type}:${hour}`;

  try {
    const existing = await env.POINTS_KV.get(aggKey, { type: 'json' }) || {
      hour,
      type,
      count: 0,
      modes: {},
      totalDuration: 0,
      totalConfidence: 0,
      errors: 0
    };

    // Update counts
    existing.count++;

    // Update mode breakdown
    if (metric.mode) {
      existing.modes[metric.mode] = (existing.modes[metric.mode] || 0) + 1;
    }

    // Update durations
    if (metric.duration) {
      existing.totalDuration += metric.duration;
      existing.avgDuration = existing.totalDuration / existing.count;
    }

    // Update confidence
    if (metric.confidence) {
      existing.totalConfidence += metric.confidence;
      existing.avgConfidence = existing.totalConfidence / existing.count;
    }

    // Track errors
    if (metric.error) {
      existing.errors++;
    }

    // Store updated aggregate
    await env.POINTS_KV.put(
      aggKey,
      JSON.stringify(existing),
      { expirationTtl: METRICS_CONFIG.TTL.HOURLY }
    );
  } catch (error) {
    console.error('[METRICS] Error updating hourly aggregate:', error);
    // Non-critical, continue
  }
}

/**
 * Update overall summary statistics
 * @param {Object} env - Environment bindings
 * @param {string} type - Metric type
 * @param {Object} metric - Metric data
 */
async function updateSummary(env, type, metric) {
  try {
    const summary = await env.POINTS_KV.get(METRICS_CONFIG.SUMMARY_KEY, { type: 'json' }) || {
      totalEnhancements: 0,
      byMode: {},
      totalDuration: 0,
      totalConfidence: 0,
      errors: 0,
      lastUpdated: null
    };

    // Update totals
    summary.totalEnhancements++;

    // Update mode breakdown
    if (metric.mode) {
      summary.byMode[metric.mode] = (summary.byMode[metric.mode] || 0) + 1;
    }

    // Update averages
    if (metric.duration) {
      summary.totalDuration += metric.duration;
      summary.avgDuration = summary.totalDuration / summary.totalEnhancements;
    }

    if (metric.confidence) {
      summary.totalConfidence += metric.confidence;
      summary.avgConfidence = summary.totalConfidence / summary.totalEnhancements;
    }

    // Track errors
    if (metric.error) {
      summary.errors++;
    }

    summary.lastUpdated = new Date().toISOString();

    // Store updated summary
    await env.POINTS_KV.put(
      METRICS_CONFIG.SUMMARY_KEY,
      JSON.stringify(summary),
      { expirationTtl: METRICS_CONFIG.TTL.SUMMARY }
    );
  } catch (error) {
    console.error('[METRICS] Error updating summary:', error);
    // Non-critical, continue
  }
}

/**
 * Get hourly aggregate for specific hour
 * @param {Object} env - Environment bindings
 * @param {string} type - Metric type
 * @param {string} hour - Hour key
 * @returns {Promise<Object|null>} Aggregate data
 */
async function getHourlyAggregate(env, type, hour) {
  const aggKey = `${METRICS_CONFIG.PREFIX}hourly:${type}:${hour}`;

  try {
    const aggregate = await env.POINTS_KV.get(aggKey, { type: 'json' });
    return aggregate;
  } catch (error) {
    console.error('[METRICS] Error getting hourly aggregate:', error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get hour key from timestamp
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Hour key (YYYY-MM-DD-HH)
 */
function getHourKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');

  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Get range of hour keys between start and end
 * @param {string} startHour - Start hour key
 * @param {string} endHour - End hour key
 * @returns {Array<string>} Array of hour keys
 */
function getHourRange(startHour, endHour) {
  const hours = [];
  const start = new Date(startHour.replace(/-(\d{2})$/, 'T$1:00:00Z'));
  const end = new Date(endHour.replace(/-(\d{2})$/, 'T$1:00:00Z'));

  let current = new Date(start);
  while (current <= end) {
    hours.push(getHourKey(current.getTime()));
    current.setHours(current.getHours() + 1);
  }

  return hours;
}

/**
 * Calculate summary statistics from aggregates
 * @param {Array} aggregates - Array of hourly aggregates
 * @returns {Object} Summary statistics
 */
function calculateSummaryStats(aggregates) {
  if (!aggregates || aggregates.length === 0) {
    return {
      totalCount: 0,
      avgDuration: 0,
      avgConfidence: 0,
      errorRate: 0,
      modeBreakdown: {}
    };
  }

  const totalCount = aggregates.reduce((sum, agg) => sum + agg.count, 0);
  const totalDuration = aggregates.reduce((sum, agg) => sum + (agg.totalDuration || 0), 0);
  const totalConfidence = aggregates.reduce((sum, agg) => sum + (agg.totalConfidence || 0), 0);
  const totalErrors = aggregates.reduce((sum, agg) => sum + (agg.errors || 0), 0);

  // Combine mode breakdowns
  const modeBreakdown = {};
  aggregates.forEach(agg => {
    Object.entries(agg.modes || {}).forEach(([mode, count]) => {
      modeBreakdown[mode] = (modeBreakdown[mode] || 0) + count;
    });
  });

  return {
    totalCount,
    avgDuration: totalCount > 0 ? (totalDuration / totalCount).toFixed(2) : 0,
    avgConfidence: totalCount > 0 ? (totalConfidence / totalCount).toFixed(2) : 0,
    errorRate: totalCount > 0 ? ((totalErrors / totalCount) * 100).toFixed(2) : 0,
    modeBreakdown,
    hours: aggregates.length
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  recordMetric,
  recordMetricsBatch,
  getMetrics,
  getSummaryStats,
  getMetricsDashboard,
  METRICS_CONFIG
};
