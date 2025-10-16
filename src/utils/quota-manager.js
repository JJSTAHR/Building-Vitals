/**
 * AI Quota Manager
 * Version: 1.0.0
 *
 * Manages daily AI call quotas to prevent exceeding Cloudflare limits
 * Tracks usage per day, provides warnings, and enforces limits
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const QUOTA_CONFIG = {
  DAILY_LIMIT: 10000,     // Maximum AI calls per day
  WARNING_THRESHOLD: 8000, // 80% usage warning
  CRITICAL_THRESHOLD: 9500, // 95% usage warning
  RESET_HOUR: 0           // UTC hour for daily reset (midnight)
};

const KV_KEYS = {
  QUOTA: 'ai-quota',
  HISTORY: 'ai-quota-history'
};

// ============================================================================
// QUOTA TRACKING
// ============================================================================

/**
 * Get today's date key for quota tracking
 * @returns {string} Date key in YYYY-MM-DD format
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check current AI quota status
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Quota status object
 */
export async function checkAIQuota(env) {
  const today = getTodayKey();
  const key = `${KV_KEYS.QUOTA}:${today}`;

  try {
    const quotaData = await env.POINTS_KV.get(key, { type: 'json' });

    const used = quotaData?.count || 0;
    const limit = QUOTA_CONFIG.DAILY_LIMIT;
    const remaining = limit - used;
    const percentage = (used / limit) * 100;

    const status = {
      used,
      limit,
      remaining,
      percentage: percentage.toFixed(2),
      exceeded: used >= limit,
      warning: used >= QUOTA_CONFIG.WARNING_THRESHOLD,
      critical: used >= QUOTA_CONFIG.CRITICAL_THRESHOLD,
      date: today,
      resetTime: getNextResetTime()
    };

    return status;
  } catch (error) {
    console.error('[QUOTA] Error checking quota:', error);

    // Return safe default on error (assume no quota exceeded)
    return {
      used: 0,
      limit: QUOTA_CONFIG.DAILY_LIMIT,
      remaining: QUOTA_CONFIG.DAILY_LIMIT,
      percentage: '0.00',
      exceeded: false,
      warning: false,
      critical: false,
      date: today,
      error: error.message
    };
  }
}

/**
 * Increment AI quota usage
 * @param {Object} env - Environment bindings
 * @param {number} count - Number of AI calls to add (default: 1)
 * @returns {Promise<Object>} Updated quota status
 */
export async function incrementAIQuota(env, count = 1) {
  const today = getTodayKey();
  const key = `${KV_KEYS.QUOTA}:${today}`;

  try {
    // Get current quota
    const quotaData = await env.POINTS_KV.get(key, { type: 'json' });
    const currentCount = quotaData?.count || 0;
    const newCount = currentCount + count;

    // Update quota
    const updatedData = {
      count: newCount,
      lastUpdated: new Date().toISOString(),
      date: today
    };

    // Store with expiration (48 hours to keep historical data)
    await env.POINTS_KV.put(key, JSON.stringify(updatedData), {
      expirationTtl: 48 * 3600
    });

    // Log if approaching limits
    if (newCount >= QUOTA_CONFIG.CRITICAL_THRESHOLD) {
      console.warn('[QUOTA] CRITICAL: AI quota at', newCount, 'of', QUOTA_CONFIG.DAILY_LIMIT);
    } else if (newCount >= QUOTA_CONFIG.WARNING_THRESHOLD) {
      console.warn('[QUOTA] WARNING: AI quota at', newCount, 'of', QUOTA_CONFIG.DAILY_LIMIT);
    }

    // Add to history
    await addQuotaHistory(env, today, count);

    return await checkAIQuota(env);
  } catch (error) {
    console.error('[QUOTA] Error incrementing quota:', error);
    throw new Error(`Failed to increment quota: ${error.message}`);
  }
}

/**
 * Get quota status with detailed breakdown
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Detailed quota information
 */
export async function getQuotaStatus(env) {
  const status = await checkAIQuota(env);
  const history = await getQuotaHistory(env, 7); // Last 7 days

  return {
    ...status,
    history,
    projectedDailyUsage: calculateProjectedUsage(history),
    recommendation: getQuotaRecommendation(status)
  };
}

/**
 * Reset quota (admin function - use with caution)
 * @param {Object} env - Environment bindings
 * @param {string} date - Date to reset (default: today)
 * @returns {Promise<Object>} Reset confirmation
 */
export async function resetQuota(env, date = null) {
  const targetDate = date || getTodayKey();
  const key = `${KV_KEYS.QUOTA}:${targetDate}`;

  try {
    await env.POINTS_KV.delete(key);

    console.log('[QUOTA] Reset quota for date:', targetDate);

    return {
      success: true,
      date: targetDate,
      resetAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[QUOTA] Error resetting quota:', error);
    throw new Error(`Failed to reset quota: ${error.message}`);
  }
}

// ============================================================================
// HISTORY TRACKING
// ============================================================================

/**
 * Add quota usage to history
 * @param {Object} env - Environment bindings
 * @param {string} date - Date key
 * @param {number} count - Usage count
 */
async function addQuotaHistory(env, date, count) {
  const historyKey = `${KV_KEYS.HISTORY}:${date}`;

  try {
    const history = await env.POINTS_KV.get(historyKey, { type: 'json' }) || { entries: [] };

    history.entries.push({
      count,
      timestamp: new Date().toISOString()
    });

    await env.POINTS_KV.put(historyKey, JSON.stringify(history), {
      expirationTtl: 7 * 24 * 3600 // Keep for 7 days
    });
  } catch (error) {
    console.error('[QUOTA] Error adding to history:', error);
    // Non-critical, continue
  }
}

/**
 * Get quota history for specified number of days
 * @param {Object} env - Environment bindings
 * @param {number} days - Number of days to retrieve
 * @returns {Promise<Array>} Array of daily usage data
 */
async function getQuotaHistory(env, days = 7) {
  const history = [];

  try {
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const key = `${KV_KEYS.QUOTA}:${dateKey}`;

      const quotaData = await env.POINTS_KV.get(key, { type: 'json' });

      if (quotaData) {
        history.push({
          date: dateKey,
          count: quotaData.count,
          lastUpdated: quotaData.lastUpdated
        });
      }
    }

    return history;
  } catch (error) {
    console.error('[QUOTA] Error getting history:', error);
    return [];
  }
}

// ============================================================================
// ANALYTICS & RECOMMENDATIONS
// ============================================================================

/**
 * Calculate projected daily usage based on history
 * @param {Array} history - Historical usage data
 * @returns {number} Projected daily usage
 */
function calculateProjectedUsage(history) {
  if (!history || history.length === 0) {
    return 0;
  }

  const recentDays = history.slice(0, 3); // Last 3 days
  const totalUsage = recentDays.reduce((sum, day) => sum + day.count, 0);
  const avgUsage = totalUsage / recentDays.length;

  return Math.round(avgUsage);
}

/**
 * Get recommendation based on quota status
 * @param {Object} status - Current quota status
 * @returns {string} Recommendation message
 */
function getQuotaRecommendation(status) {
  if (status.exceeded) {
    return 'CRITICAL: Daily quota exceeded. Using rule-based fallback only.';
  } else if (status.critical) {
    return 'WARNING: Approaching daily quota limit. Consider using cache or rule-based enhancement.';
  } else if (status.warning) {
    return 'NOTICE: Using 80%+ of daily quota. Monitor AI usage carefully.';
  } else if (status.percentage < 50) {
    return 'GOOD: Quota usage is within normal range.';
  } else {
    return 'OK: Quota usage is moderate. Continue monitoring.';
  }
}

/**
 * Get next quota reset time
 * @returns {string} ISO timestamp of next reset
 */
function getNextResetTime() {
  const now = new Date();
  const resetTime = new Date(now);
  resetTime.setUTCHours(QUOTA_CONFIG.RESET_HOUR, 0, 0, 0);

  // If reset time has passed today, set to tomorrow
  if (resetTime <= now) {
    resetTime.setDate(resetTime.getDate() + 1);
  }

  return resetTime.toISOString();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  checkAIQuota,
  incrementAIQuota,
  getQuotaStatus,
  resetQuota,
  QUOTA_CONFIG
};
