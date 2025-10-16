/**
 * D1 Database Mock Utilities
 *
 * Provides mock D1 database for testing without real Cloudflare infrastructure
 */

import { vi } from 'vitest';

/**
 * Create a mock D1 database with in-memory storage
 */
export function createMockD1Database() {
  // In-memory storage for mock database
  const storage = {
    timeseries_agg: [],
    queue_jobs: [],
    chart_configs: [],
    query_metadata: []
  };

  // Mock prepared statement
  function createMockStatement(sql) {
    let boundValues = [];

    return {
      bind: (...values) => {
        boundValues = values;
        return {
          run: async () => {
            // Simulate INSERT
            if (sql.toUpperCase().includes('INSERT')) {
              // Check for conflicts if ON CONFLICT clause present
              const hasConflict = sql.toUpperCase().includes('ON CONFLICT');

              // Parse table name
              const tableMatch = sql.match(/INSERT INTO (\w+)/i);
              const tableName = tableMatch ? tableMatch[1] : 'timeseries_agg';

              // Create record
              const record = {
                site_name: boundValues[0],
                point_name: boundValues[1],
                interval: boundValues[2],
                timestamp: boundValues[3],
                avg_value: boundValues[4],
                sample_count: boundValues[5],
                min_value: boundValues[6] || null,
                max_value: boundValues[7] || null
              };

              // Check for duplicates (simulate PRIMARY KEY constraint)
              const exists = storage[tableName]?.some(r =>
                r.site_name === record.site_name &&
                r.point_name === record.point_name &&
                r.interval === record.interval &&
                r.timestamp === record.timestamp
              );

              if (exists && !hasConflict) {
                throw new Error('UNIQUE constraint failed');
              }

              if (exists && hasConflict) {
                // UPSERT - update existing record
                const index = storage[tableName].findIndex(r =>
                  r.site_name === record.site_name &&
                  r.point_name === record.point_name &&
                  r.interval === record.interval &&
                  r.timestamp === record.timestamp
                );
                storage[tableName][index] = record;
              } else {
                // Insert new record
                storage[tableName] = storage[tableName] || [];
                storage[tableName].push(record);
              }

              return {
                success: true,
                meta: {
                  changes: 1,
                  last_row_id: storage[tableName].length
                }
              };
            }

            // Simulate UPDATE
            if (sql.toUpperCase().includes('UPDATE')) {
              return {
                success: true,
                meta: {
                  changes: 1
                }
              };
            }

            // Simulate DELETE
            if (sql.toUpperCase().includes('DELETE')) {
              return {
                success: true,
                meta: {
                  changes: 1
                }
              };
            }

            return { success: true };
          },

          all: async () => {
            // Simulate SELECT
            if (sql.toUpperCase().includes('SELECT')) {
              const tableMatch = sql.match(/FROM (\w+)/i);
              const tableName = tableMatch ? tableMatch[1] : 'timeseries_agg';

              let results = storage[tableName] || [];

              // Apply WHERE filters
              if (sql.includes('WHERE')) {
                // Simple site_name filter
                if (sql.includes('site_name = ?')) {
                  const siteName = boundValues[0];
                  results = results.filter(r => r.site_name === siteName);
                }

                // Timestamp range filter
                const timestampIndex = boundValues.findIndex((v, i) =>
                  sql.includes('timestamp >=') && i > 0
                );

                if (timestampIndex > 0) {
                  const startTime = boundValues[timestampIndex];
                  const endTime = boundValues[timestampIndex + 1];

                  results = results.filter(r => {
                    if (endTime !== undefined) {
                      return r.timestamp >= startTime && r.timestamp <= endTime;
                    }
                    return r.timestamp >= startTime;
                  });
                }

                // point_name IN filter
                if (sql.includes('point_name IN')) {
                  const pointNames = boundValues.slice(1, 3); // Assuming positions
                  results = results.filter(r => pointNames.includes(r.point_name));
                }
              }

              // Apply ORDER BY
              if (sql.includes('ORDER BY timestamp ASC')) {
                results.sort((a, b) => a.timestamp - b.timestamp);
              } else if (sql.includes('ORDER BY timestamp DESC')) {
                results.sort((a, b) => b.timestamp - a.timestamp);
              }

              // Apply GROUP BY and aggregations
              if (sql.includes('GROUP BY point_name')) {
                const grouped = {};
                results.forEach(r => {
                  if (!grouped[r.point_name]) {
                    grouped[r.point_name] = {
                      point_name: r.point_name,
                      overall_avg: 0,
                      overall_min: Infinity,
                      overall_max: -Infinity,
                      total_samples: 0,
                      count: 0
                    };
                  }

                  grouped[r.point_name].overall_avg += r.avg_value;
                  grouped[r.point_name].overall_min = Math.min(grouped[r.point_name].overall_min, r.min_value || r.avg_value);
                  grouped[r.point_name].overall_max = Math.max(grouped[r.point_name].overall_max, r.max_value || r.avg_value);
                  grouped[r.point_name].total_samples += r.sample_count;
                  grouped[r.point_name].count++;
                });

                results = Object.values(grouped).map(g => ({
                  ...g,
                  overall_avg: g.overall_avg / g.count
                }));
              }

              // Apply COUNT(*)
              if (sql.includes('COUNT(*)')) {
                return {
                  results: [{ count: results.length }],
                  success: true,
                  meta: {
                    rows_read: results.length,
                    rows_written: 0
                  }
                };
              }

              return {
                results,
                success: true,
                meta: {
                  rows_read: results.length,
                  rows_written: 0
                }
              };
            }

            // EXPLAIN QUERY PLAN
            if (sql.includes('EXPLAIN QUERY PLAN')) {
              return {
                results: [
                  { detail: 'SEARCH timeseries_agg USING INDEX idx_timeseries_site_time' }
                ],
                success: true
              };
            }

            // Schema queries
            if (sql.includes('sqlite_master')) {
              return {
                results: [{
                  sql: 'CREATE TABLE timeseries_agg (...) WITHOUT ROWID'
                }],
                success: true
              };
            }

            return { results: [], success: true };
          },

          first: async () => {
            const result = await createMockStatement(sql).bind(...boundValues).all();
            return result.results[0] || null;
          }
        };
      }
    };
  }

  return {
    prepare: (sql) => createMockStatement(sql),

    // Batch operations
    batch: async (statements) => {
      const results = [];
      for (const stmt of statements) {
        const result = await stmt.run();
        results.push(result);
      }
      return results;
    },

    // Exec for raw SQL
    exec: async (sql) => {
      return { success: true };
    },

    // Dump for debugging
    dump: () => storage,

    // Clear all data
    clear: () => {
      storage.timeseries_agg = [];
      storage.queue_jobs = [];
      storage.chart_configs = [];
      storage.query_metadata = [];
    }
  };
}

/**
 * Create mock timeseries data
 */
export function createMockTimeseries(count = 100, options = {}) {
  const {
    siteName = 'test-site',
    pointPrefix = 'point-',
    interval = '1min',
    startTimestamp = Math.floor(Date.now() / 1000) - 3600,
    intervalSeconds = 60
  } = options;

  const samples = [];

  for (let i = 0; i < count; i++) {
    samples.push({
      site_name: siteName,
      point_name: `${pointPrefix}${i % 10}`, // Cycle through 10 points
      interval,
      timestamp: startTimestamp + (i * intervalSeconds),
      avg_value: 50 + Math.random() * 50, // Random value between 50-100
      min_value: 40 + Math.random() * 30,
      max_value: 70 + Math.random() * 30,
      sample_count: 1
    });
  }

  return samples;
}

/**
 * Create mock R2 bucket
 */
export function createMockR2Bucket() {
  const storage = new Map();

  return {
    put: vi.fn(async (key, data, options) => {
      storage.set(key, {
        data,
        options,
        uploaded: Date.now()
      });
      return { success: true };
    }),

    get: vi.fn(async (key) => {
      const item = storage.get(key);
      if (!item) return null;

      return {
        arrayBuffer: async () => item.data,
        json: async () => JSON.parse(new TextDecoder().decode(item.data)),
        text: async () => new TextDecoder().decode(item.data),
        httpMetadata: item.options?.httpMetadata,
        customMetadata: item.options?.customMetadata
      };
    }),

    head: vi.fn(async (key) => {
      const item = storage.get(key);
      if (!item) return null;

      return {
        size: item.data.byteLength,
        uploaded: item.uploaded,
        httpMetadata: item.options?.httpMetadata,
        customMetadata: item.options?.customMetadata
      };
    }),

    delete: vi.fn(async (key) => {
      storage.delete(key);
      return { success: true };
    }),

    list: vi.fn(async (options = {}) => {
      const keys = Array.from(storage.keys());
      const filtered = options.prefix
        ? keys.filter(k => k.startsWith(options.prefix))
        : keys;

      return {
        objects: filtered.map(key => ({
          key,
          size: storage.get(key).data.byteLength,
          uploaded: storage.get(key).uploaded,
          customMetadata: storage.get(key).options?.customMetadata
        })),
        truncated: false,
        cursor: null
      };
    }),

    // Utility methods for testing
    _storage: storage,
    _clear: () => storage.clear(),
    _size: () => storage.size
  };
}

/**
 * Create mock Queue
 */
export function createMockQueue() {
  const messages = [];

  return {
    send: vi.fn(async (body, options = {}) => {
      messages.push({
        body,
        timestamp: Date.now(),
        delaySeconds: options.delaySeconds || 0
      });
      return { success: true };
    }),

    _messages: messages,
    _clear: () => messages.length = 0
  };
}
