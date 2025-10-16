/**
 * Enhanced Timeseries Service
 *
 * Orchestrates R2 caching, Queue processing, and direct API fetching
 * with intelligent routing based on request size.
 *
 * Features:
 * - Smart routing: Direct fetch, R2 cache, or Queue
 * - Automatic cache management
 * - Progress tracking for large requests
 * - Timeout protection
 * - Analytics integration
 */

import { R2CacheService } from './r2-cache-service.js';
import { ChartQueueService } from './queue-service.js';

export class EnhancedTimeseriesService {
  constructor(env, options = {}) {
    this.env = env;

    // Initialize services
    this.cacheService = env.TIMESERIES_CACHE
      ? new R2CacheService(env.TIMESERIES_CACHE, options.cache)
      : null;

    this.queueService = env.CHART_QUEUE && env.DB
      ? new ChartQueueService(env.CHART_QUEUE, env.DB, options.queue)
      : null;

    // Thresholds for routing decisions
    this.smallThreshold = options.smallThreshold || 1000; // Direct fetch
    this.largeThreshold = options.largeThreshold || 100000; // Queue job
    this.directTimeout = options.directTimeout || 30000; // 30 seconds
    this.cacheTimeout = options.cacheTimeout || 5000; // 5 seconds

    // Analytics
    this.analytics = env.ANALYTICS || null;
  }

  /**
   * Fetch timeseries data with smart routing
   * @param {string} site - Site identifier
   * @param {Array<string>} points - Array of point names
   * @param {string} startTime - ISO 8601 start time
   * @param {string} endTime - ISO 8601 end time
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Timeseries data or job status
   */
  async fetchTimeseries(site, points, startTime, endTime, options = {}) {
    const requestId = this._generateRequestId();
    const startTimestamp = Date.now();

    try {
      // Estimate data size
      const estimatedSize = this._estimateDataSize(points.length, startTime, endTime);
      const routeType = this._determineRoute(estimatedSize, options);

      console.log(`[Timeseries] Request ${requestId}: ${points.length} points, estimated ${estimatedSize} samples, route: ${routeType}`);

      let result;
      let cacheHit = false;

      // Execute based on route type
      switch (routeType) {
        case 'direct':
          result = await this._directFetch(site, points, startTime, endTime, options);
          break;

        case 'cached':
          result = await this._cachedFetch(site, points, startTime, endTime, options);
          cacheHit = result._cacheHit || false;
          break;

        case 'queued':
          result = await this._queuedFetch(site, points, startTime, endTime, options);
          break;

        default:
          throw new Error(`Unknown route type: ${routeType}`);
      }

      // Track analytics
      if (this.analytics) {
        await this._trackAnalytics({
          requestId,
          site,
          pointsCount: points.length,
          estimatedSize,
          routeType,
          cacheHit,
          duration: Date.now() - startTimestamp,
          success: true
        });
      }

      return {
        ...result,
        _meta: {
          requestId,
          routeType,
          cacheHit,
          duration: Date.now() - startTimestamp,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[Timeseries] Request ${requestId} failed:`, error);

      // Track error
      if (this.analytics) {
        await this._trackAnalytics({
          requestId,
          site,
          pointsCount: points.length,
          duration: Date.now() - startTimestamp,
          success: false,
          error: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Get job status for queued requests
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    if (!this.queueService) {
      throw new Error('Queue service not available');
    }

    return await this.queueService.getJobStatus(jobId);
  }

  /**
   * Cancel a queued job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelJob(jobId) {
    if (!this.queueService) {
      throw new Error('Queue service not available');
    }

    return await this.queueService.cancelJob(jobId);
  }

  /**
   * Direct fetch for small requests using the NEW paginated endpoint
   * @private
   */
  async _directFetch(site, points, startTime, endTime, options) {
    console.log('[Timeseries] Using direct fetch with PAGINATED endpoint');
    console.log(`[Timeseries] Site: ${site}, Points: ${points.length}, raw_data=true`);

    const results = {};
    const timeout = options.timeout || this.directTimeout;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // ✅ NEW: Use the paginated endpoint that fetches ALL points in one request
      const url = `${this.env.ACE_API_URL}/sites/${encodeURIComponent(site)}/timeseries/paginated`;

      let cursor = null;
      let hasMore = true;
      let pageNumber = 0;

      while (hasMore) {
        pageNumber++;

        // Build query parameters
        const params = new URLSearchParams({
          start_time: startTime,
          end_time: endTime,
          raw_data: 'true',  // ✅ CRITICAL: Preserve collection intervals
          page_size: '100000' // Max page size
        });

        // ✅ CRITICAL FIX: Pass point_names to ACE API for 99%+ data reduction
        if (points && points.length > 0) {
          params.set('point_names', points.join(','));
          console.log(`[Timeseries] Filtering ${points.length} points at ACE API`);
        }

        if (cursor) {
          params.set('cursor', cursor);
        }

        console.log(`[Timeseries] Fetching page ${pageNumber}`);

        const response = await fetch(`${url}?${params}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Process point_samples from paginated response
        const samples = data.point_samples || [];

        console.log(`[Timeseries] Page ${pageNumber}: Received ${samples.length} samples`);

        // Group samples by point name
        for (const sample of samples) {
          const pointName = sample.name;

          // Filter to only include requested points
          if (points.includes(pointName)) {
            if (!results[pointName]) {
              results[pointName] = {
                samples: [],
                error: null,
                count: 0
              };
            }

            // Add sample in ACE API format
            results[pointName].samples.push({
              time: sample.time,
              value: sample.value
            });
          }
        }

        // Check pagination
        cursor = data.next_cursor;
        hasMore = data.has_more && cursor;

        // Safety check to prevent infinite loops
        if (pageNumber > 100) {
          console.warn(`[Timeseries] Too many pages (${pageNumber}), stopping pagination`);
          break;
        }
      }

      // Update sample counts
      for (const pointName in results) {
        results[pointName].count = results[pointName].samples.length;
      }

      console.log(`[Timeseries] Completed: Fetched ${Object.keys(results).length} points in ${pageNumber} pages`);

      return { data: results };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Cached fetch with R2
   * @private
   */
  async _cachedFetch(site, points, startTime, endTime, options) {
    console.log('[Timeseries] Using cached fetch');

    if (!this.cacheService) {
      return await this._directFetch(site, points, startTime, endTime, options);
    }

    // Generate cache key
    const cacheKey = this.cacheService.getCacheKey(site, points, startTime, endTime);

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return {
        data: cached,
        _cacheHit: true
      };
    }

    // Cache miss - fetch directly
    const result = await this._directFetch(site, points, startTime, endTime, options);

    // Store in cache (async, don't wait)
    this.cacheService.put(cacheKey, result.data, {
      pointsCount: points.length,
      samplesCount: this._countSamples(result.data)
    }).catch(error => {
      console.error('[Timeseries] Failed to cache result:', error);
    });

    return {
      ...result,
      _cacheHit: false
    };
  }

  /**
   * Queued fetch for large requests
   * @private
   */
  async _queuedFetch(site, points, startTime, endTime, options) {
    console.log('[Timeseries] Using queued fetch');

    if (!this.queueService) {
      throw new Error('Queue service not available for large request');
    }

    // Generate job ID
    const jobId = this._generateJobId(site, points, startTime, endTime);

    // Check if job already exists
    const existingJob = await this.queueService.getJobStatus(jobId);

    if (existingJob) {
      console.log(`[Timeseries] Job ${jobId} already exists: ${existingJob.status}`);

      // If completed, try to get from cache
      if (existingJob.status === 'completed' && existingJob.cacheKey && this.cacheService) {
        const cached = await this.cacheService.get(existingJob.cacheKey);
        if (cached) {
          return {
            data: cached,
            jobId,
            status: 'completed',
            _cacheHit: true
          };
        }
      }

      // Return job status
      return {
        jobId,
        status: existingJob.status,
        progress: existingJob.progress,
        message: this._getJobMessage(existingJob)
      };
    }

    // Queue new job
    const cacheKey = this.cacheService?.getCacheKey(site, points, startTime, endTime);

    await this.queueService.queueLargeRequest(
      jobId,
      site,
      points,
      startTime,
      endTime,
      options.userId,
      {
        format: options.format,
        cacheKey
      }
    );

    return {
      jobId,
      status: 'queued',
      message: 'Your request has been queued. Check job status for progress.',
      statusUrl: `/api/jobs/${jobId}`
    };
  }

  /**
   * Determine routing strategy
   * @private
   */
  _determineRoute(estimatedSize, options = {}) {
    // Allow manual override
    if (options.route) {
      return options.route;
    }

    // Route based on estimated size
    if (estimatedSize < this.smallThreshold) {
      return 'direct';
    } else if (estimatedSize < this.largeThreshold) {
      return 'cached';
    } else {
      return 'queued';
    }
  }

  /**
   * Estimate data size
   * @private
   */
  _estimateDataSize(pointCount, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

    // Estimate: ~100 samples per day per point
    const estimatedSamples = pointCount * daysDiff * 100;

    return Math.round(estimatedSamples);
  }

  /**
   * Count total samples
   * @private
   */
  _countSamples(data) {
    let total = 0;
    for (const point in data) {
      if (data[point].samples) {
        total += data[point].samples.length;
      }
    }
    return total;
  }

  /**
   * Generate unique request ID
   * @private
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate job ID
   * @private
   */
  _generateJobId(site, points, startTime, endTime) {
    const hash = this._hashString(`${site}-${points.join(',')}-${startTime}-${endTime}`);
    return `job_${hash}_${Date.now()}`;
  }

  /**
   * Hash string for job ID
   * @private
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get user-friendly job message
   * @private
   */
  _getJobMessage(job) {
    switch (job.status) {
      case 'queued':
        return 'Your request is queued and will be processed shortly.';
      case 'processing':
        return `Processing... ${job.progress || 0}% complete.`;
      case 'completed':
        return 'Your data is ready!';
      case 'failed':
        return `Request failed: ${job.error || 'Unknown error'}`;
      case 'retrying':
        return `Retrying... (attempt ${job.retryCount || 0})`;
      case 'cancelled':
        return 'Request was cancelled.';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Track analytics
   * @private
   */
  async _trackAnalytics(data) {
    if (!this.analytics) return;

    try {
      await this.analytics.writeDataPoint({
        indexes: [data.site],
        blobs: [
          data.requestId,
          data.routeType,
          data.success ? 'success' : 'error'
        ],
        doubles: [
          data.pointsCount,
          data.estimatedSize || 0,
          data.duration
        ]
      });
    } catch (error) {
      console.error('[Analytics] Failed to track:', error);
    }
  }
}
