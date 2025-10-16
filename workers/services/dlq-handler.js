/**
 * Dead Letter Queue Handler
 * Handles jobs that failed after max retries
 * Provides monitoring, alerts, and recovery options
 */

export class DeadLetterQueueHandler {
  constructor(db, r2Bucket, analytics) {
    this.db = db;
    this.r2 = r2Bucket;
    this.analytics = analytics;
  }

  /**
   * Process dead letter queue batch
   * @param {Array} messages - Failed job messages
   */
  async processBatch(messages) {
    console.log(`[DLQ] Processing ${messages.length} failed jobs`);

    const results = {
      stored: 0,
      alerted: 0,
      recovered: 0,
      errors: 0
    };

    for (const message of messages) {
      try {
        await this.handleFailedJob(message);
        results.stored++;
      } catch (error) {
        console.error('[DLQ] Failed to handle message:', error);
        results.errors++;
      }
    }

    // Track DLQ metrics
    this.analytics?.writeDataPoint({
      blobs: ['dlq_batch_processed'],
      doubles: [
        messages.length,
        results.stored,
        results.errors
      ]
    });

    return results;
  }

  /**
   * Handle individual failed job
   */
  async handleFailedJob(message) {
    const { jobId, site, error, retryCount } = message.body;

    console.error(`[DLQ] Job ${jobId} failed permanently:`, {
      error: error?.message || error,
      retries: retryCount,
      timestamp: new Date().toISOString()
    });

    // 1. Update job status in database
    await this.db.prepare(`
      UPDATE queue_jobs
      SET status = 'failed',
          error_message = ?,
          retry_count = ?,
          completed_at = ?
      WHERE job_id = ?
    `).bind(
      typeof error === 'string' ? error : (error?.message || 'Unknown error'),
      retryCount || 0,
      Math.floor(Date.now() / 1000),
      jobId
    ).run();

    // 2. Store failure details in R2 for debugging
    await this.storeFailureDetails(jobId, message);

    // 3. Classify error type
    const errorType = this.classifyError(error);

    // 4. Handle based on error type
    if (errorType === 'RECOVERABLE') {
      // Try manual recovery
      await this.attemptRecovery(message);
    } else if (errorType === 'USER_ERROR') {
      // Notify user of invalid request
      await this.notifyUser(jobId, 'invalid_request', error);
    } else {
      // System error - alert ops team
      await this.alertOpsTeam(jobId, error);
    }

    return { jobId, errorType };
  }

  /**
   * Store failure details in R2 for post-mortem analysis
   */
  async storeFailureDetails(jobId, message) {
    const details = {
      jobId,
      timestamp: new Date().toISOString(),
      message: message.body,
      error: message.body.error,
      retryCount: message.body.retryCount,
      originalRequest: {
        site: message.body.site,
        points: message.body.points,
        startTime: message.body.startTime,
        endTime: message.body.endTime
      },
      stackTrace: message.body.error?.stack
    };

    try {
      await this.r2.put(
        `dlq/failures/${jobId}.json`,
        JSON.stringify(details, null, 2),
        {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            errorType: this.classifyError(message.body.error),
            timestamp: Date.now().toString()
          }
        }
      );

      console.log(`[DLQ] Stored failure details: dlq/failures/${jobId}.json`);
    } catch (r2Error) {
      console.error('[DLQ] Failed to store failure details in R2:', r2Error);
      // Non-critical - continue processing
    }
  }

  /**
   * Classify error type for appropriate handling
   */
  classifyError(error) {
    const message = (typeof error === 'string' ? error : error?.message || '').toLowerCase();

    // Temporary issues that might work on retry
    if (message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('temporarily unavailable') ||
        message.includes('503') ||
        message.includes('504')) {
      return 'RECOVERABLE';
    }

    // User input errors
    if (message.includes('invalid') ||
        message.includes('not found') ||
        message.includes('unauthorized') ||
        message.includes('400') ||
        message.includes('401') ||
        message.includes('403') ||
        message.includes('404')) {
      return 'USER_ERROR';
    }

    // System errors
    if (message.includes('internal') ||
        message.includes('unexpected') ||
        message.includes('crash') ||
        message.includes('500') ||
        message.includes('502')) {
      return 'SYSTEM_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Attempt manual recovery for recoverable errors
   */
  async attemptRecovery(message) {
    const { jobId, site, points, startTime, endTime } = message.body;

    console.log(`[DLQ] Attempting recovery for job ${jobId}`);

    try {
      // Store for manual review and potential re-queue
      await this.db.prepare(`
        INSERT INTO dlq_recovery_queue (
          job_id, original_message, created_at, status
        ) VALUES (?, ?, ?, 'pending')
      `).bind(
        jobId,
        JSON.stringify(message.body),
        Math.floor(Date.now() / 1000)
      ).run();

      console.log(`[DLQ] Job ${jobId} added to recovery queue`);
    } catch (dbError) {
      console.error('[DLQ] Failed to add job to recovery queue:', dbError);
    }
  }

  /**
   * Notify user of failed request
   */
  async notifyUser(jobId, reason, error) {
    try {
      // Get job details
      const job = await this.db.prepare(`
        SELECT user_id, site_name FROM queue_jobs WHERE job_id = ?
      `).bind(jobId).first();

      if (!job?.user_id) {
        console.warn(`[DLQ] No user_id for job ${jobId}, cannot notify`);
        return;
      }

      const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown error');

      // Store notification (could trigger email/push notification)
      await this.db.prepare(`
        INSERT INTO user_notifications (
          id, user_id, type, title, message, job_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        job.user_id,
        'job_failed',
        'Chart Generation Failed',
        `Your chart request for ${job.site_name} could not be completed: ${errorMessage}`,
        jobId,
        Math.floor(Date.now() / 1000)
      ).run();

      console.log(`[DLQ] User notification created for ${job.user_id}`);
    } catch (notifyError) {
      console.error('[DLQ] Failed to notify user:', notifyError);
    }
  }

  /**
   * Alert ops team of system errors
   */
  async alertOpsTeam(jobId, error) {
    const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown error');

    // Track critical error
    this.analytics?.writeDataPoint({
      blobs: ['critical_error', 'dlq', errorMessage],
      doubles: [Date.now()]
    });

    // Log for monitoring systems
    console.error('[DLQ] CRITICAL: System error in job processing', {
      jobId,
      error: errorMessage,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });

    // Could integrate with PagerDuty, Slack, etc.
    // Example: await sendSlackAlert({ jobId, error: errorMessage });
  }

  /**
   * Get DLQ statistics
   */
  async getStats() {
    try {
      const stats = await this.db.prepare(`
        SELECT
          COUNT(*) as total_failed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as permanent_failures,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as last_24h,
          AVG(retry_count) as avg_retries
        FROM queue_jobs
        WHERE status = 'failed'
      `).bind(Math.floor(Date.now() / 1000) - 86400).first();

      // Get recovery queue stats
      const recoveryStats = await this.db.prepare(`
        SELECT
          COUNT(*) as total_in_recovery,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_recovery,
          COUNT(CASE WHEN status = 'recovered' THEN 1 END) as recovered,
          COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned
        FROM dlq_recovery_queue
      `).first();

      return {
        ...stats,
        recovery: recoveryStats
      };
    } catch (error) {
      console.error('[DLQ] Failed to get stats:', error);
      return {
        total_failed: 0,
        permanent_failures: 0,
        last_24h: 0,
        avg_retries: 0,
        recovery: {
          total_in_recovery: 0,
          pending_recovery: 0,
          recovered: 0,
          abandoned: 0
        }
      };
    }
  }

  /**
   * List recent DLQ failures
   */
  async listRecentFailures(limit = 20) {
    try {
      const failures = await this.db.prepare(`
        SELECT
          job_id,
          site_name,
          error_message,
          retry_count,
          created_at,
          completed_at
        FROM queue_jobs
        WHERE status = 'failed'
        ORDER BY completed_at DESC
        LIMIT ?
      `).bind(limit).all();

      return failures.results || [];
    } catch (error) {
      console.error('[DLQ] Failed to list failures:', error);
      return [];
    }
  }
}
