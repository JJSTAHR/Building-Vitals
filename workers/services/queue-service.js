/**
 * Queue Service
 *
 * Handles background processing of large timeseries requests using Cloudflare Queues.
 * Features:
 * - Async job queuing for large datasets
 * - Job status tracking in D1
 * - Retry logic with exponential backoff
 * - Progress tracking and notifications
 */

export class ChartQueueService {
  constructor(queue, db, options = {}) {
    this.queue = queue;
    this.db = db;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second base delay
    this.batchSize = options.batchSize || 50; // Max points per batch
  }

  /**
   * Add a large request to the queue
   * @param {string} jobId - Unique job identifier
   * @param {string} site - Site identifier
   * @param {Array<string>} points - Array of point names
   * @param {string} startTime - ISO 8601 start time
   * @param {string} endTime - ISO 8601 end time
   * @param {string} userId - User identifier (optional)
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Job ID
   */
  async queueLargeRequest(jobId, site, points, startTime, endTime, userId = null, options = {}) {
    try {
      // Create job record in D1
      await this._createJobRecord(jobId, {
        site,
        points,
        startTime,
        endTime,
        userId,
        status: 'queued',
        priority: options.priority || 'normal',
        estimatedSize: this._estimateDataSize(points.length, startTime, endTime),
        createdAt: new Date().toISOString()
      });

      // Send job to queue
      const message = {
        jobId,
        site,
        points,
        startTime,
        endTime,
        userId,
        options: {
          format: options.format || 'json',
          compression: options.compression !== false,
          cacheKey: options.cacheKey,
          ...options
        }
      };

      await this.queue.send(message);

      console.log(`[Queue] Queued job ${jobId}: ${points.length} points from ${site}`);
      return jobId;
    } catch (error) {
      console.error(`[Queue] Failed to queue job ${jobId}:`, error);
      await this._updateJobStatus(jobId, 'failed', { error: error.message });
      throw new Error(`Failed to queue job: ${error.message}`);
    }
  }

  /**
   * Process a queue message (consumer)
   * @param {Object} message - Queue message
   * @param {Object} env - Environment bindings (ACE_API_URL, R2, etc.)
   * @returns {Promise<void>}
   */
  async processJob(message, env) {
    const { jobId, site, points, startTime, endTime, options } = message.body;

    try {
      console.log(`[Queue] Processing job ${jobId}...`);

      // Update status to processing
      await this._updateJobStatus(jobId, 'processing', {
        startedAt: new Date().toISOString()
      });

      // Fetch data with pagination
      const allData = await this._fetchPaginatedData(
        site,
        points,
        startTime,
        endTime,
        env,
        jobId
      );

      // Store in R2 if cache service provided
      if (env.TIMESERIES_CACHE && options.cacheKey) {
        const { R2CacheService } = await import('./r2-cache-service.js');
        const cacheService = new R2CacheService(env.TIMESERIES_CACHE);

        await cacheService.put(options.cacheKey, allData, {
          pointsCount: points.length,
          samplesCount: this._countSamples(allData),
          jobId
        });
      }

      // Update job status to completed
      await this._updateJobStatus(jobId, 'completed', {
        completedAt: new Date().toISOString(),
        samplesCount: this._countSamples(allData),
        dataSize: JSON.stringify(allData).length,
        cacheKey: options.cacheKey
      });

      console.log(`[Queue] Completed job ${jobId}`);
    } catch (error) {
      console.error(`[Queue] Job ${jobId} failed:`, error);

      // Check if we should retry
      const job = await this._getJobRecord(jobId);
      const retryCount = (job?.retry_count || 0) + 1;

      if (retryCount < this.maxRetries) {
        await this._updateJobStatus(jobId, 'retrying', {
          retryCount,
          lastError: error.message
        });

        // Re-queue with exponential backoff
        const delay = this.retryDelay * Math.pow(2, retryCount - 1);
        await this.queue.send(message.body, { delaySeconds: delay });

        console.log(`[Queue] Retrying job ${jobId} (attempt ${retryCount}) after ${delay}s`);
      } else {
        await this._updateJobStatus(jobId, 'failed', {
          failedAt: new Date().toISOString(),
          error: error.message,
          retryCount
        });
      }

      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job details
   */
  async getJobStatus(jobId) {
    try {
      const job = await this._getJobRecord(jobId);

      if (!job) {
        return null;
      }

      return {
        jobId: job.job_id,
        status: job.status,
        progress: job.progress || 0,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        failedAt: job.failed_at,
        estimatedSize: job.estimated_size,
        samplesCount: job.samples_count,
        dataSize: job.data_size,
        cacheKey: job.cache_key,
        error: job.error,
        retryCount: job.retry_count || 0
      };
    } catch (error) {
      console.error(`[Queue] Failed to get job status ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Cancel a queued or processing job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelJob(jobId) {
    try {
      const job = await this._getJobRecord(jobId);

      if (!job || job.status === 'completed' || job.status === 'failed') {
        return false;
      }

      await this._updateJobStatus(jobId, 'cancelled', {
        cancelledAt: new Date().toISOString()
      });

      console.log(`[Queue] Cancelled job ${jobId}`);
      return true;
    } catch (error) {
      console.error(`[Queue] Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Fetch paginated timeseries data using the NEW paginated endpoint
   * @private
   */
  async _fetchPaginatedData(site, points, startTime, endTime, env, jobId) {
    const allResults = {};
    const totalPoints = points.length;

    console.log(`[Queue] Fetching data using PAGINATED endpoint with raw_data=true`);
    console.log(`[Queue] Site: ${site}, Points: ${totalPoints}, Time: ${startTime} to ${endTime}`);

    try {
      // ✅ NEW: Use the paginated endpoint that fetches ALL points in one request
      const url = `${env.ACE_API_URL}/sites/${encodeURIComponent(site)}/timeseries/paginated`;

      // Initial request to get first page
      let cursor = null;
      let hasMore = true;
      let pageNumber = 0;

      while (hasMore) {
        pageNumber++;

        // Build query parameters
        const params = new URLSearchParams({
          start_time: startTime,
          end_time: endTime,
          raw_data: 'true',  // ✅ CRITICAL: Preserve collection intervals!
          page_size: '100000' // Max page size
        });

        if (cursor) {
          params.set('cursor', cursor);
        }

        console.log(`[Queue] Fetching page ${pageNumber} (cursor: ${cursor ? 'yes' : 'initial'})`);

        const response = await fetch(`${url}?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Process point_samples from paginated response
        const samples = data.point_samples || [];

        console.log(`[Queue] Page ${pageNumber}: Received ${samples.length} samples`);

        // Group samples by point name
        for (const sample of samples) {
          const pointName = sample.name;

          // Filter to only include requested points
          if (points.includes(pointName)) {
            if (!allResults[pointName]) {
              allResults[pointName] = {
                samples: [],
                error: null,
                count: 0
              };
            }

            // Add sample in ACE API format
            allResults[pointName].samples.push({
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
          console.warn(`[Queue] Too many pages (${pageNumber}), stopping pagination`);
          break;
        }

        // Update progress based on pages processed
        const progress = hasMore ? Math.min(90, pageNumber * 10) : 100;
        await this._updateJobStatus(jobId, 'processing', {
          progress,
          processedPoints: Object.keys(allResults).length,
          totalPoints
        });
      }

      // Update sample counts
      for (const pointName in allResults) {
        allResults[pointName].count = allResults[pointName].samples.length;
      }

      console.log(`[Queue] Completed: Fetched ${Object.keys(allResults).length} points in ${pageNumber} pages`);
      console.log(`[Queue] Total samples:`, Object.values(allResults).reduce((sum, p) => sum + p.count, 0));

      // Final progress update
      await this._updateJobStatus(jobId, 'processing', {
        progress: 100,
        processedPoints: Object.keys(allResults).length,
        totalPoints
      });

      return allResults;
    } catch (error) {
      console.error(`[Queue] Failed to fetch paginated data:`, error);
      throw error;
    }
  }

  /**
   * Create job record in D1
   * @private
   */
  async _createJobRecord(jobId, data) {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT INTO queue_jobs (
        job_id, site_name, points_json, start_time, end_time,
        user_id, status, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      jobId,
      data.site,
      JSON.stringify(data.points),
      data.startTime,
      data.endTime,
      data.userId || null,
      data.status,
      data.priority === 'high' ? 1 : 0, // Convert priority to integer
      now
    ).run();
  }

  /**
   * Update job status in D1
   * @private
   */
  async _updateJobStatus(jobId, status, updates = {}) {
    const fields = ['status = ?'];
    const values = [status];

    // Add timestamps based on status
    if (status === 'processing' && !updates.startedAt) {
      fields.push('started_at = ?');
      values.push(Math.floor(Date.now() / 1000));
    }
    if ((status === 'completed' || status === 'failed') && !updates.completedAt) {
      fields.push('completed_at = ?');
      values.push(Math.floor(Date.now() / 1000));
    }

    // Handle manual timestamp updates
    if (updates.startedAt) {
      fields.push('started_at = ?');
      values.push(Math.floor(new Date(updates.startedAt).getTime() / 1000));
    }
    if (updates.completedAt) {
      fields.push('completed_at = ?');
      values.push(Math.floor(new Date(updates.completedAt).getTime() / 1000));
    }

    // Handle other updates
    if (updates.samplesCount) {
      fields.push('samples_count = ?');
      values.push(updates.samplesCount);
    }
    if (updates.error || updates.lastError) {
      fields.push('error_message = ?');
      values.push(updates.error || updates.lastError);
    }
    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      values.push(updates.retryCount);
    }
    if (updates.cacheKey) {
      fields.push('result_url = ?');
      values.push(updates.cacheKey); // Store cache key as result URL
    }

    // Calculate processing time if completed
    if (status === 'completed' || status === 'failed') {
      const job = await this._getJobRecord(jobId);
      if (job && job.started_at) {
        const processingTime = Math.floor(Date.now() / 1000) - job.started_at;
        fields.push('processing_time_ms = ?');
        values.push(processingTime * 1000); // Convert to milliseconds
      }
    }

    values.push(jobId);

    const stmt = this.db.prepare(`
      UPDATE queue_jobs
      SET ${fields.join(', ')}
      WHERE job_id = ?
    `);

    await stmt.bind(...values).run();
  }

  /**
   * Get job record from D1
   * @private
   */
  async _getJobRecord(jobId) {
    const stmt = this.db.prepare('SELECT * FROM queue_jobs WHERE job_id = ?');
    const result = await stmt.bind(jobId).first();
    return result;
  }

  /**
   * Estimate data size based on points and time range
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
   * Count total samples in result data
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
}
