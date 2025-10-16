/**
 * Enhanced Cloudflare Worker with R2 Caching and Queue Processing
 *
 * This worker demonstrates the integration of:
 * - R2 Object Storage for caching large datasets
 * - Cloudflare Queues for background processing
 * - D1 Database for job tracking
 * - Analytics Engine for performance monitoring
 */

import { EnhancedTimeseriesService } from './enhanced-timeseries.js';
import { ChartQueueService } from './queue-service.js';
import { DeadLetterQueueHandler } from './dlq-handler.js';

export default {
  /**
   * Main request handler
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route to appropriate handler
      if (path.startsWith('/api/timeseries')) {
        return await handleTimeseries(request, env, ctx, corsHeaders);
      } else if (path.startsWith('/api/jobs/')) {
        return await handleJobStatus(request, env, ctx, corsHeaders);
      } else if (path === '/api/stats') {
        return await handleStats(request, env, ctx, corsHeaders);
      } else if (path === '/api/queue/dlq/stats') {
        return await handleDLQStats(request, env, ctx, corsHeaders);
      } else if (path === '/api/queue/dlq/failures') {
        return await handleDLQFailures(request, env, ctx, corsHeaders);
      } else if (path === '/api/health') {
        return handleHealth(corsHeaders);
      } else {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('[Worker] Request error:', error);

      return new Response(
        JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },

  /**
   * Queue consumer handler
   */
  async queue(batch, env) {
    const queueService = new ChartQueueService(env.CHART_QUEUE, env.DB);

    for (const message of batch.messages) {
      try {
        await queueService.processJob(message, env);
        message.ack();
      } catch (error) {
        console.error('[Queue] Message processing error:', error);
        message.retry();
      }
    }
  },

  /**
   * Dead letter queue consumer handler
   * Processes jobs that failed after max retries
   */
  async deadLetterQueue(batch, env) {
    console.log(`[Worker] Processing DLQ batch: ${batch.messages.length} messages`);

    const dlqHandler = new DeadLetterQueueHandler(
      env.DB,
      env.TIMESERIES_CACHE,
      env.ANALYTICS
    );

    try {
      const results = await dlqHandler.processBatch(batch.messages);

      console.log('[Worker] DLQ batch complete:', results);

      // Acknowledge all messages (they've been handled)
      batch.messages.forEach(msg => msg.ack());

    } catch (error) {
      console.error('[Worker] DLQ handler failed:', error);

      // Retry batch (will go back to DLQ)
      batch.messages.forEach(msg => msg.retry());
    }
  },

  /**
   * Scheduled handler (for cleanup tasks)
   */
  async scheduled(event, env, ctx) {
    console.log('[Scheduled] Running cleanup tasks...');

    try {
      // Cleanup old cache entries
      const { R2CacheService } = await import('./r2-cache-service.js');
      const cacheService = new R2CacheService(env.TIMESERIES_CACHE);
      await cacheService.cleanup(86400); // 24 hours

      // Archive old jobs
      await archiveOldJobs(env.DB);

      // Generate daily stats
      await generateDailyStats(env.DB);

      console.log('[Scheduled] Cleanup completed');
    } catch (error) {
      console.error('[Scheduled] Cleanup error:', error);
    }
  },
};

/**
 * Handle timeseries data requests
 */
async function handleTimeseries(request, env, ctx, corsHeaders) {
  const url = new URL(request.url);

  // Parse query parameters
  const site = url.searchParams.get('site');
  const points = url.searchParams.get('points')?.split(',') || [];
  const startTime = url.searchParams.get('start_time');
  const endTime = url.searchParams.get('end_time');
  const userId = url.searchParams.get('user_id');
  const route = url.searchParams.get('route'); // Manual route override

  // Validate required parameters
  if (!site || !points.length || !startTime || !endTime) {
    return new Response(
      JSON.stringify({
        error: 'Missing required parameters: site, points, start_time, end_time',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // Initialize service
    const service = new EnhancedTimeseriesService(env, {
      cache: {
        defaultTTL: 3600,
        maxCacheAge: 86400,
      },
      queue: {
        maxRetries: 3,
        batchSize: 50,
      },
      smallThreshold: 1000,
      largeThreshold: 100000,
    });

    // Fetch data with smart routing
    const result = await service.fetchTimeseries(
      site,
      points,
      startTime,
      endTime,
      {
        userId,
        route,
        timeout: 30000,
      }
    );

    // Determine response based on result type
    if (result.jobId) {
      // Queued request
      return new Response(
        JSON.stringify({
          status: 'queued',
          jobId: result.jobId,
          message: result.message,
          statusUrl: `${url.origin}/api/jobs/${result.jobId}`,
          pollInterval: 5000, // Poll every 5 seconds
        }),
        {
          status: 202, // Accepted
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // Direct or cached result
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache-Hit': result._meta?.cacheHit ? 'true' : 'false',
          'X-Route-Type': result._meta?.routeType || 'unknown',
          'X-Request-Duration': result._meta?.duration || 0,
        },
      });
    }
  } catch (error) {
    console.error('[Timeseries] Handler error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle job status requests
 */
async function handleJobStatus(request, env, ctx, corsHeaders) {
  const url = new URL(request.url);
  const jobId = url.pathname.split('/').pop();

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Job ID required' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    const service = new EnhancedTimeseriesService(env);

    // Handle different methods
    if (request.method === 'GET') {
      // Get job status
      const status = await service.getJobStatus(jobId);

      if (!status) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // If completed, include data URL
      if (status.status === 'completed' && status.cacheKey) {
        status.dataUrl = `${url.origin}/api/timeseries?cache_key=${encodeURIComponent(status.cacheKey)}`;
      }

      return new Response(JSON.stringify(status), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } else if (request.method === 'DELETE') {
      // Cancel job
      const cancelled = await service.cancelJob(jobId);

      return new Response(
        JSON.stringify({
          success: cancelled,
          message: cancelled ? 'Job cancelled' : 'Job not found or already completed',
        }),
        {
          status: cancelled ? 200 : 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }
  } catch (error) {
    console.error('[JobStatus] Handler error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle stats requests
 */
async function handleStats(request, env, ctx, corsHeaders) {
  try {
    // Get cache stats
    const { R2CacheService } = await import('./r2-cache-service.js');
    const cacheService = new R2CacheService(env.TIMESERIES_CACHE);
    const cacheStats = await cacheService.getStats();

    // Get job stats from D1
    const jobStatsQuery = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status IN ('queued', 'processing') THEN 1 ELSE 0 END) as active
      FROM queue_jobs
    `).first();

    // Get request analytics
    const analyticsQuery = await env.DB.prepare(`
      SELECT
        route_type,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits
      FROM request_analytics
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY route_type
    `).all();

    return new Response(
      JSON.stringify({
        cache: cacheStats,
        jobs: jobStatsQuery,
        requests: analyticsQuery.results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Stats] Handler error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle health check
 */
function handleHealth(corsHeaders) {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Archive old jobs to history
 */
async function archiveOldJobs(db) {
  const archiveQuery = `
    INSERT INTO job_history (job_id, site, points_count, status, duration_ms, samples_count, data_size, error, created_at, completed_at)
    SELECT
      job_id,
      site,
      json_array_length(points) as points_count,
      status,
      CAST((julianday(COALESCE(completed_at, failed_at)) - julianday(started_at)) * 86400000 AS INTEGER) as duration_ms,
      samples_count,
      data_size,
      error,
      created_at,
      COALESCE(completed_at, failed_at) as completed_at
    FROM queue_jobs
    WHERE status IN ('completed', 'failed')
    AND created_at < datetime('now', '-7 days')
  `;

  await db.prepare(archiveQuery).run();

  const deleteQuery = `
    DELETE FROM queue_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < datetime('now', '-7 days')
  `;

  await db.prepare(deleteQuery).run();
}

/**
 * Generate daily statistics
 */
async function generateDailyStats(db) {
  // This could generate summary statistics, send reports, etc.
  console.log('[Stats] Generating daily statistics...');
}

/**
 * Handle DLQ statistics requests
 */
async function handleDLQStats(request, env, ctx, corsHeaders) {
  try {
    const dlqHandler = new DeadLetterQueueHandler(env.DB, env.TIMESERIES_CACHE, env.ANALYTICS);
    const stats = await dlqHandler.getStats();

    return new Response(
      JSON.stringify({
        dlq: stats,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[DLQ Stats] Handler error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle DLQ failures list requests
 */
async function handleDLQFailures(request, env, ctx, corsHeaders) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const dlqHandler = new DeadLetterQueueHandler(env.DB, env.TIMESERIES_CACHE, env.ANALYTICS);
    const failures = await dlqHandler.listRecentFailures(limit);

    return new Response(
      JSON.stringify({
        failures,
        count: failures.length,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[DLQ Failures] Handler error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
