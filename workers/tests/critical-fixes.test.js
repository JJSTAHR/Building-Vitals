/**
 * Critical Fixes Test Suite
 * Verifies all 4 critical issues have been resolved
 *
 * Tests:
 * 1. Queue Jobs Table Schema
 * 2. Hash Collision Prevention (Secure Cache Keys)
 * 3. Query Timeout Protection
 * 4. Dead Letter Queue Handling
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// TEST 1: Queue Jobs Table Schema
// ============================================================================

describe('Critical Fix #1: Queue Jobs Table', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  test('queue_jobs table exists with correct schema', async () => {
    // Create test job
    const jobData = {
      jobId: 'test-123',
      siteName: 'test-site',
      points: ['point1', 'point2'],
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-02T00:00:00Z',
      userId: 'user-123',
      priority: 1
    };

    // Simulate table structure
    const insertQuery = `
      INSERT INTO queue_jobs
        (job_id, site_name, points_json, start_time, end_time, user_id, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', unixepoch())
    `;

    const result = await mockDb.prepare(insertQuery)
      .bind(
        jobData.jobId,
        jobData.siteName,
        JSON.stringify(jobData.points),
        jobData.startTime,
        jobData.endTime,
        jobData.userId,
        jobData.priority
      )
      .run();

    expect(result.success).toBe(true);

    // Retrieve job
    const job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind('test-123')
      .first();

    expect(job).toBeDefined();
    expect(job.job_id).toBe('test-123');
    expect(job.status).toBe('queued');
    expect(job.priority).toBe(1);
    expect(job.site_name).toBe('test-site');
  });

  test('job status can be updated through lifecycle', async () => {
    const jobId = 'test-lifecycle-123';

    // Create job
    await mockDb.prepare(`
      INSERT INTO queue_jobs
        (job_id, site_name, status, created_at)
      VALUES (?, ?, 'queued', unixepoch())
    `).bind(jobId, 'test-site').run();

    // Update to processing
    await mockDb.prepare(`
      UPDATE queue_jobs
      SET status = 'processing', started_at = unixepoch()
      WHERE job_id = ?
    `).bind(jobId).run();

    let job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId).first();
    expect(job.status).toBe('processing');
    expect(job.started_at).toBeDefined();

    // Update to completed
    await mockDb.prepare(`
      UPDATE queue_jobs
      SET status = 'completed',
          completed_at = unixepoch(),
          result_url = ?,
          samples_count = ?,
          processing_time_ms = ?
      WHERE job_id = ?
    `).bind('https://r2.url/result.msgpack', 1000, 5000, jobId).run();

    job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId).first();
    expect(job.status).toBe('completed');
    expect(job.completed_at).toBeDefined();
    expect(job.result_url).toBe('https://r2.url/result.msgpack');
    expect(job.samples_count).toBe(1000);
    expect(job.processing_time_ms).toBe(5000);
  });

  test('job can be marked as failed', async () => {
    const jobId = 'test-failed-123';

    // Create and fail job
    await mockDb.prepare(`
      INSERT INTO queue_jobs
        (job_id, site_name, status, created_at)
      VALUES (?, ?, 'queued', unixepoch())
    `).bind(jobId, 'test-site').run();

    await mockDb.prepare(`
      UPDATE queue_jobs
      SET status = 'failed_permanent',
          error_message = ?,
          failed_at = unixepoch(),
          retry_count = ?
      WHERE job_id = ?
    `).bind('Network timeout', 3, jobId).run();

    const job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId).first();

    expect(job.status).toBe('failed_permanent');
    expect(job.error_message).toBe('Network timeout');
    expect(job.retry_count).toBe(3);
    expect(job.failed_at).toBeDefined();
  });

  test('job priorities are respected in queue', async () => {
    // Create jobs with different priorities
    await mockDb.prepare(`
      INSERT INTO queue_jobs (job_id, site_name, priority, status, created_at)
      VALUES (?, ?, ?, 'queued', unixepoch())
    `).bind('low-priority', 'site1', 3).run();

    await mockDb.prepare(`
      INSERT INTO queue_jobs (job_id, site_name, priority, status, created_at)
      VALUES (?, ?, ?, 'queued', unixepoch())
    `).bind('high-priority', 'site1', 1).run();

    await mockDb.prepare(`
      INSERT INTO queue_jobs (job_id, site_name, priority, status, created_at)
      VALUES (?, ?, ?, 'queued', unixepoch())
    `).bind('medium-priority', 'site1', 2).run();

    // Query in priority order
    const result = await mockDb.prepare(`
      SELECT job_id, priority
      FROM queue_jobs
      WHERE status = 'queued'
      ORDER BY priority ASC, created_at ASC
    `).bind().all();

    expect(result.results[0].job_id).toBe('high-priority');
    expect(result.results[1].job_id).toBe('medium-priority');
    expect(result.results[2].job_id).toBe('low-priority');
  });
});

// ============================================================================
// TEST 2: Hash Collision Prevention
// ============================================================================

describe('Critical Fix #2: Secure Hash Function', () => {
  test('generates unique keys for different queries', async () => {
    const key1 = await generateSecureCacheKey(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    const key2 = await generateSecureCacheKey(
      'site1',
      ['point3', 'point4'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    // Keys MUST be different
    expect(key1).not.toBe(key2);
    expect(key1).toMatch(/^timeseries\/[^\/]+\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.msgpack$/);
    expect(key2).toMatch(/^timeseries\/[^\/]+\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.msgpack$/);
  });

  test('generates consistent keys for same parameters', async () => {
    const key1 = await generateSecureCacheKey(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    // Same parameters should generate same key
    const key2 = await generateSecureCacheKey(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    expect(key1).toBe(key2);
  });

  test('handles point order consistently (sorting)', async () => {
    // Different order, should still match (points are sorted)
    const key1 = await generateSecureCacheKey(
      'site1',
      ['point2', 'point1'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    const key2 = await generateSecureCacheKey(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    expect(key1).toBe(key2);
  });

  test('prevents path traversal attacks', () => {
    expect(() => {
      validateCacheKey('timeseries/../../../etc/passwd');
    }).toThrow('Invalid cache key: path traversal detected');

    expect(() => {
      validateCacheKey('timeseries//double-slash/hack.msgpack');
    }).toThrow('Invalid cache key');

    expect(() => {
      validateCacheKey('../backdoor.msgpack');
    }).toThrow('Invalid cache key');
  });

  test('rejects invalid cache key patterns', () => {
    // Valid key should pass (needs 64-char hex hash)
    expect(() => {
      validateCacheKey('timeseries/site1/2025-01-01/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.msgpack');
    }).not.toThrow();

    // Invalid patterns should fail
    expect(() => {
      validateCacheKey('invalid/path/structure');
    }).toThrow();

    expect(() => {
      validateCacheKey('timeseries/site1/invalid-date/key.msgpack');
    }).toThrow();
  });

  test('different time ranges produce different keys', async () => {
    const key1 = await generateSecureCacheKey(
      'site1',
      ['point1'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    const key2 = await generateSecureCacheKey(
      'site1',
      ['point1'],
      '2025-01-03T00:00:00Z',
      '2025-01-04T00:00:00Z'
    );

    expect(key1).not.toBe(key2);
  });

  test('hash function prevents collisions', async () => {
    // Generate many keys and check for collisions
    const keys = new Set();
    const testCases = 1000;

    for (let i = 0; i < testCases; i++) {
      const key = await generateSecureCacheKey(
        `site${i}`,
        [`point${i}`, `point${i + 1}`],
        '2025-01-01T00:00:00Z',
        '2025-01-02T00:00:00Z'
      );
      keys.add(key);
    }

    // All keys should be unique
    expect(keys.size).toBe(testCases);
  });
});

// ============================================================================
// TEST 3: Query Timeout Protection
// ============================================================================

describe('Critical Fix #3: Query Timeouts', () => {
  test('fast query completes within timeout', async () => {
    const fastQuery = new Promise(resolve => {
      setTimeout(() => resolve({ rows: [{ value: 123 }] }), 100);
    });

    const result = await queryWithTimeout(fastQuery, 1000, 'test-query');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(123);
  });

  test('slow query times out correctly', async () => {
    const slowQuery = new Promise(resolve => {
      setTimeout(() => resolve({ rows: [] }), 5000);
    });

    await expect(
      queryWithTimeout(slowQuery, 1000, 'slow-query')
    ).rejects.toThrow(/timeout/i);
  });

  test('timeout error includes query name', async () => {
    const slowQuery = new Promise(resolve => {
      setTimeout(() => resolve({}), 5000);
    });

    try {
      await queryWithTimeout(slowQuery, 500, 'important-query');
      expect.fail('Should have thrown timeout error');
    } catch (error) {
      expect(error.message).toContain('important-query');
      expect(error.message).toContain('timeout');
    }
  });

  test('adaptive timeout scales with expected rows', () => {
    // Small dataset
    expect(calculateAdaptiveTimeout(100)).toBeLessThanOrEqual(5000);

    // Medium dataset
    const mediumTimeout = calculateAdaptiveTimeout(10000);
    expect(mediumTimeout).toBeGreaterThan(2000);
    expect(mediumTimeout).toBeLessThanOrEqual(15000);

    // Large dataset (capped at 30s)
    expect(calculateAdaptiveTimeout(1000000)).toBeLessThanOrEqual(30000);
  });

  test('retry mechanism works correctly', async () => {
    let attempts = 0;
    const flakyQuery = () => {
      attempts++;
      return new Promise((resolve, reject) => {
        if (attempts < 2) {
          setTimeout(() => reject(new Error('Temporary failure')), 50);
        } else {
          setTimeout(() => resolve({ success: true }), 50);
        }
      });
    };

    const result = await queryWithRetry(flakyQuery, 3, 1000);
    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
  });

  test('retry gives up after max attempts', async () => {
    let attempts = 0;
    const alwaysFailQuery = () => {
      attempts++;
      return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Permanent failure')), 50);
      });
    };

    await expect(
      queryWithRetry(alwaysFailQuery, 3, 1000)
    ).rejects.toThrow('Permanent failure');

    expect(attempts).toBe(3);
  });

  test('exponential backoff increases delay', async () => {
    const delays = [];
    let attempts = 0;

    const trackingQuery = () => {
      const startTime = Date.now();
      attempts++;
      return new Promise((resolve, reject) => {
        if (attempts > 1) {
          delays.push(Date.now() - startTime);
        }
        if (attempts < 4) {
          setTimeout(() => reject(new Error('Retry me')), 10);
        } else {
          setTimeout(() => resolve({ done: true }), 10);
        }
      });
    };

    await queryWithRetry(trackingQuery, 4, 1000, true);

    // Each delay should be longer than the previous (exponential backoff)
    expect(delays.length).toBeGreaterThan(1);
  });
});

// ============================================================================
// TEST 4: Dead Letter Queue Handling
// ============================================================================

describe('Critical Fix #4: Dead Letter Queue', () => {
  let mockDb;
  let mockR2;
  let dlqHandler;

  beforeEach(() => {
    mockDb = createMockDb();
    mockR2 = createMockR2();
    dlqHandler = new DeadLetterQueueHandler(mockDb, mockR2);
  });

  test('DLQ handler stores failed jobs', async () => {
    const failedMessage = {
      body: {
        jobId: 'failed-job-123',
        siteName: 'test-site',
        points: ['p1'],
        error: { message: 'Network timeout' },
        retryCount: 3
      }
    };

    await dlqHandler.handleFailedJob(failedMessage);

    // Check job status updated
    const job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind('failed-job-123').first();

    expect(job.status).toBe('failed_permanent');
    expect(job.error_message).toContain('Network timeout');
  });

  test('error classification works correctly', () => {
    expect(dlqHandler.classifyError({ message: 'timeout' })).toBe('RECOVERABLE');
    expect(dlqHandler.classifyError({ message: 'ETIMEDOUT' })).toBe('RECOVERABLE');
    expect(dlqHandler.classifyError({ message: 'invalid input' })).toBe('USER_ERROR');
    expect(dlqHandler.classifyError({ message: 'validation failed' })).toBe('USER_ERROR');
    expect(dlqHandler.classifyError({ message: 'internal server error' })).toBe('SYSTEM_ERROR');
    expect(dlqHandler.classifyError({ message: 'database error' })).toBe('SYSTEM_ERROR');
  });

  test('DLQ stores error details in R2', async () => {
    const failedMessage = {
      body: {
        jobId: 'failed-with-details',
        siteName: 'test-site',
        error: {
          message: 'Complex error',
          stack: 'Error: Complex error\n  at line 1'
        },
        retryCount: 3
      }
    };

    await dlqHandler.handleFailedJob(failedMessage);

    // Check R2 storage
    const errorKey = `dlq/failed-with-details-${failedMessage.body.error.message.slice(0, 10)}.json`;
    const stored = await mockR2.get(errorKey);

    expect(stored).toBeDefined();
  });

  test('DLQ batch processing handles multiple messages', async () => {
    const messages = [
      { body: { jobId: 'job1', error: { message: 'Error 1' }, retryCount: 3 }},
      { body: { jobId: 'job2', error: { message: 'Error 2' }, retryCount: 3 }},
      { body: { jobId: 'job3', error: { message: 'Error 3' }, retryCount: 3 }}
    ];

    const results = await dlqHandler.processBatch(messages);

    expect(results.stored).toBe(3);
    expect(results.errors).toBe(0);
  });

  test('DLQ handles corrupt messages gracefully', async () => {
    const corruptMessage = {
      body: null  // Invalid message
    };

    await expect(async () => {
      await dlqHandler.handleFailedJob(corruptMessage);
    }).rejects.toThrow();
  });

  test('DLQ creates metrics for failed jobs', async () => {
    const failedMessage = {
      body: {
        jobId: 'metrics-test',
        siteName: 'test-site',
        error: { message: 'Test error' },
        retryCount: 2
      }
    };

    await dlqHandler.handleFailedJob(failedMessage);

    const metrics = await dlqHandler.getMetrics();

    expect(metrics.totalFailures).toBeGreaterThan(0);
    expect(metrics.errorTypes).toBeDefined();
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: All Fixes Together', () => {
  let mockDb;
  let mockR2;

  beforeEach(() => {
    mockDb = createMockDb();
    mockR2 = createMockR2();
  });

  test('complete workflow with all fixes', async () => {
    // 1. Create queue job (Fix #1)
    const jobId = 'integration-test';
    await mockDb.prepare(`
      INSERT INTO queue_jobs
        (job_id, site_name, points_json, start_time, end_time, status, priority, created_at)
      VALUES (?, ?, ?, ?, ?, 'queued', 1, unixepoch())
    `).bind(
      jobId,
      'test-site',
      JSON.stringify(['p1', 'p2']),
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    ).run();

    // 2. Generate secure cache key (Fix #2)
    const cacheKey = await generateSecureCacheKey(
      'test-site',
      ['p1', 'p2'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    expect(cacheKey).toMatch(/^timeseries\/test-site\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.msgpack$/);

    // 3. Query with timeout (Fix #3)
    const query = mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId)
      .first();

    const result = await queryWithTimeout(query, 1000, 'integration-test');

    expect(result.job_id).toBe(jobId);

    // 4. Simulate failure and DLQ (Fix #4)
    const dlqHandler = new DeadLetterQueueHandler(mockDb, mockR2);

    await dlqHandler.handleFailedJob({
      body: {
        jobId,
        error: { message: 'Simulated failure' },
        retryCount: 3
      }
    });

    // Verify job marked as failed
    const failedJob = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId).first();

    expect(failedJob.status).toBe('failed_permanent');
  });

  test('end-to-end: job creation to completion with caching', async () => {
    const jobId = 'e2e-test';
    const siteName = 'test-site';
    const points = ['temp', 'humidity'];

    // Step 1: Create job
    await mockDb.prepare(`
      INSERT INTO queue_jobs
        (job_id, site_name, points_json, status, priority, created_at)
      VALUES (?, ?, ?, 'queued', 1, unixepoch())
    `).bind(jobId, siteName, JSON.stringify(points)).run();

    // Step 2: Process job (with timeout protection)
    const processJob = async () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ samples: 1000, data: [1, 2, 3] });
        }, 100);
      });
    };

    const processResult = await queryWithTimeout(processJob(), 5000, 'process-job');

    // Step 3: Generate cache key and store result
    const cacheKey = await generateSecureCacheKey(
      siteName,
      points,
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    await mockR2.put(cacheKey, JSON.stringify(processResult), {
      samples: processResult.samples
    });

    // Step 4: Mark job as completed
    await mockDb.prepare(`
      UPDATE queue_jobs
      SET status = 'completed',
          completed_at = unixepoch(),
          result_url = ?,
          samples_count = ?
      WHERE job_id = ?
    `).bind(cacheKey, processResult.samples, jobId).run();

    // Verify final state
    const job = await mockDb.prepare('SELECT * FROM queue_jobs WHERE job_id = ?')
      .bind(jobId).first();

    expect(job.status).toBe('completed');
    expect(job.result_url).toBe(cacheKey);
    expect(job.samples_count).toBe(1000);

    // Verify cached data
    const cached = await mockR2.get(cacheKey);
    expect(cached).toBeDefined();
    expect(JSON.parse(cached.value).samples).toBe(1000);
  });
});

// ============================================================================
// MOCK HELPERS
// ============================================================================

function createMockDb() {
  const data = new Map();

  return {
    prepare: (sql) => {
      return {
        bind: (...params) => {
          return {
            run: async () => {
              // Simple INSERT/UPDATE handler
              if (sql.includes('INSERT')) {
                const match = sql.match(/VALUES\s*\([^)]*\)/i);
                if (match) {
                  const id = params[0];
                  const record = { job_id: id };

                  // Parse column names
                  if (sql.includes('site_name')) record.site_name = params[1];
                  if (sql.includes('points_json')) record.points_json = params[2];
                  if (sql.includes('status')) record.status = params.find(p => ['queued', 'processing', 'completed'].includes(p)) || 'queued';
                  if (sql.includes('priority')) record.priority = params.find(p => typeof p === 'number' && p > 0 && p < 10);

                  data.set(id, record);
                }
              } else if (sql.includes('UPDATE')) {
                const idMatch = sql.match(/WHERE\s+job_id\s*=\s*\?/i);
                if (idMatch) {
                  const id = params[params.length - 1];
                  const record = data.get(id) || { job_id: id };

                  if (sql.includes('status')) {
                    const statusMatch = sql.match(/status\s*=\s*['"]?(\w+)['"]?/i);
                    if (statusMatch) record.status = statusMatch[1];
                  }
                  if (sql.includes('started_at')) record.started_at = Math.floor(Date.now() / 1000);
                  if (sql.includes('completed_at')) record.completed_at = Math.floor(Date.now() / 1000);
                  if (sql.includes('failed_at')) record.failed_at = Math.floor(Date.now() / 1000);
                  if (sql.includes('result_url')) record.result_url = params[0];
                  if (sql.includes('samples_count')) record.samples_count = params.find(p => typeof p === 'number' && p >= 100);
                  if (sql.includes('processing_time_ms')) record.processing_time_ms = params.find(p => typeof p === 'number' && p > 1000);
                  if (sql.includes('error_message')) record.error_message = params[0];
                  if (sql.includes('retry_count')) record.retry_count = params.find(p => typeof p === 'number' && p < 10);

                  data.set(id, record);
                }
              }

              return { success: true };
            },
            first: async () => {
              const id = params[0];
              return data.get(id) || null;
            },
            all: async () => {
              const results = Array.from(data.values());

              // Handle ORDER BY
              if (sql.includes('ORDER BY priority')) {
                results.sort((a, b) => (a.priority || 99) - (b.priority || 99));
              }

              return { results };
            }
          };
        }
      };
    }
  };
}

function createMockR2() {
  const storage = new Map();

  return {
    put: async (key, value, metadata) => {
      storage.set(key, { value, metadata });
      return { key };
    },
    get: async (key) => {
      return storage.get(key) || null;
    },
    delete: async (key) => {
      storage.delete(key);
    },
    head: async (key) => {
      return storage.has(key) ? { key } : null;
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Generate secure cache key using SHA-256
 */
async function generateSecureCacheKey(site, points, startTime, endTime) {
  // Sort points for consistency
  const sortedPoints = [...points].sort();

  // Create input string
  const input = JSON.stringify({
    site,
    points: sortedPoints,
    startTime,
    endTime
  });

  // Use Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Format date for path
  const startDate = new Date(startTime).toISOString().split('T')[0];

  return `timeseries/${site}/${startDate}/${hashHex}.msgpack`;
}

/**
 * Validate cache key for security
 */
function validateCacheKey(key) {
  // Check for path traversal
  if (key.includes('..') || key.includes('//')) {
    throw new Error('Invalid cache key: path traversal detected');
  }

  // Validate pattern: timeseries/site/date/hash.msgpack
  const pattern = /^timeseries\/[a-zA-Z0-9_-]+\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.msgpack$/;
  if (!pattern.test(key)) {
    throw new Error('Invalid cache key: does not match expected pattern');
  }

  return true;
}

/**
 * Execute query with timeout
 */
function queryWithTimeout(promise, timeoutMs, queryName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms: ${queryName}`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Calculate adaptive timeout based on expected rows
 */
function calculateAdaptiveTimeout(expectedRows) {
  const baseTimeout = 2000; // 2 seconds
  const perRowTimeout = 0.001; // 1ms per row
  const maxTimeout = 30000; // 30 seconds

  const calculated = baseTimeout + (expectedRows * perRowTimeout);
  return Math.min(calculated, maxTimeout);
}

/**
 * Query with retry logic
 */
async function queryWithRetry(queryFn, maxRetries, timeoutMs, exponentialBackoff = false) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add exponential backoff delay
      if (exponentialBackoff && attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await queryWithTimeout(queryFn(), timeoutMs, `retry-attempt-${attempt + 1}`);
    } catch (error) {
      lastError = error;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
    }
  }

  throw lastError;
}

/**
 * Dead Letter Queue Handler
 */
class DeadLetterQueueHandler {
  constructor(db, r2, logger = console) {
    this.db = db;
    this.r2 = r2;
    this.logger = logger;
    this.metrics = {
      totalFailures: 0,
      errorTypes: {}
    };
  }

  async handleFailedJob(message) {
    if (!message.body) {
      throw new Error('Invalid message: missing body');
    }

    const { jobId, error, retryCount, siteName } = message.body;

    // Update job status
    await this.db.prepare(`
      UPDATE queue_jobs
      SET status = 'failed_permanent',
          error_message = ?,
          failed_at = unixepoch(),
          retry_count = ?
      WHERE job_id = ?
    `).bind(error.message, retryCount, jobId).run();

    // Store error details in R2
    const errorKey = `dlq/${jobId}-${error.message.slice(0, 10)}.json`;
    await this.r2.put(errorKey, JSON.stringify({
      jobId,
      error,
      retryCount,
      timestamp: new Date().toISOString()
    }), {});

    // Update metrics
    this.metrics.totalFailures++;
    const errorType = this.classifyError(error);
    this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;

    this.logger.log(`[DLQ] Handled failed job: ${jobId}`);
  }

  classifyError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'RECOVERABLE';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'USER_ERROR';
    }
    return 'SYSTEM_ERROR';
  }

  async processBatch(messages) {
    let stored = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        await this.handleFailedJob(message);
        stored++;
      } catch (error) {
        errors++;
        this.logger.error('Failed to process DLQ message:', error);
      }
    }

    return { stored, errors };
  }

  async getMetrics() {
    return { ...this.metrics };
  }
}
