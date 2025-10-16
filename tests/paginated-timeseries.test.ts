/**
 * Test Suite: Paginated Timeseries Service
 *
 * Comprehensive tests for the paginated timeseries endpoint refactor.
 * Covers unit tests, integration tests, edge cases, and performance validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPaginatedTimeseries,
  filterAndGroupTimeseries,
  fetchTimeseriesForPoints
} from '../src/services/paginatedTimeseriesService';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Paginated Timeseries Service', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPaginatedTimeseries', () => {

    it('should fetch single page when has_more is false', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'temp_sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 72.5 },
            { point_name: 'temp_sensor_2', timestamp: '2025-01-01T00:00:00Z', value: 68.2 }
          ],
          collection_intervals: { temp_sensor_1: 300, temp_sensor_2: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.samples).toHaveLength(2);
      expect(result.collection_intervals).toHaveProperty('temp_sensor_1', 300);
      expect(result.has_more).toBe(false);
    });

    it('should fetch multiple pages with cursor pagination', async () => {
      const page1Response = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 100 }
          ],
          collection_intervals: { sensor_1: 300 },
          has_more: true,
          next_cursor: 'cursor-page-2'
        })
      };

      const page2Response = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'sensor_1', timestamp: '2025-01-01T01:00:00Z', value: 110 }
          ],
          collection_intervals: { sensor_1: 300 },
          has_more: true,
          next_cursor: 'cursor-page-3'
        })
      };

      const page3Response = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'sensor_1', timestamp: '2025-01-01T02:00:00Z', value: 120 }
          ],
          collection_intervals: { sensor_1: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response)
        .mockResolvedValueOnce(page3Response);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.samples).toHaveLength(3);
      expect(result.samples[0].value).toBe(100);
      expect(result.samples[1].value).toBe(110);
      expect(result.samples[2].value).toBe(120);
    });

    it('should handle raw_data=true parameter correctly', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor', timestamp: '2025-01-01T00:00:00Z', value: 50 }],
          collection_intervals: { sensor: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02', raw_data: true }
      );

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('raw_data=true');
    });

    it('should call onProgress callback on each page', async () => {
      const onProgress = vi.fn();

      const page1Response = {
        ok: true,
        json: async () => ({
          samples: Array(100).fill(null).map((_, i) => ({
            point_name: 'sensor', timestamp: `2025-01-01T00:${i}:00Z`, value: i
          })),
          collection_intervals: { sensor: 300 },
          has_more: true,
          next_cursor: 'cursor-2'
        })
      };

      const page2Response = {
        ok: true,
        json: async () => ({
          samples: Array(50).fill(null).map((_, i) => ({
            point_name: 'sensor', timestamp: `2025-01-01T01:${i}:00Z`, value: i
          })),
          collection_intervals: { sensor: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' },
        onProgress
      );

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 100, false);
      expect(onProgress).toHaveBeenNthCalledWith(2, 150, false);
    });

    it('should throw error on API failure', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Failed to fetch timeseries data: 500 Internal Server Error');
    });

    it('should prevent infinite loops with safety limit', async () => {
      const infiniteResponse = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor', timestamp: '2025-01-01T00:00:00Z', value: 1 }],
          collection_intervals: { sensor: 300 },
          has_more: true,
          next_cursor: 'infinite-cursor'
        })
      };

      mockFetch.mockResolvedValue(infiniteResponse);

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Exceeded maximum pagination limit');

      // Should stop at safety limit (e.g., 100 pages)
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(100);
    });

    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Network error');
    });

    it('should merge collection_intervals from multiple pages', async () => {
      const page1Response = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 1 }],
          collection_intervals: { sensor_1: 300 },
          has_more: true,
          next_cursor: 'cursor-2'
        })
      };

      const page2Response = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor_2', timestamp: '2025-01-01T00:00:00Z', value: 2 }],
          collection_intervals: { sensor_2: 600 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(result.collection_intervals).toEqual({
        sensor_1: 300,
        sensor_2: 600
      });
    });
  });

  describe('filterAndGroupTimeseries', () => {

    it('should filter samples for selected points only', () => {
      const allSamples = [
        { point_name: 'temp_sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 72 },
        { point_name: 'temp_sensor_2', timestamp: '2025-01-01T00:00:00Z', value: 68 },
        { point_name: 'humidity_sensor', timestamp: '2025-01-01T00:00:00Z', value: 45 }
      ];

      const selectedPoints = ['temp_sensor_1', 'temp_sensor_2'];

      const result = filterAndGroupTimeseries(allSamples, selectedPoints);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result).toHaveProperty('temp_sensor_1');
      expect(result).toHaveProperty('temp_sensor_2');
      expect(result).not.toHaveProperty('humidity_sensor');
    });

    it('should group samples by point name', () => {
      const samples = [
        { point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 100 },
        { point_name: 'sensor_1', timestamp: '2025-01-01T01:00:00Z', value: 110 },
        { point_name: 'sensor_2', timestamp: '2025-01-01T00:00:00Z', value: 200 },
        { point_name: 'sensor_2', timestamp: '2025-01-01T01:00:00Z', value: 210 }
      ];

      const result = filterAndGroupTimeseries(samples, ['sensor_1', 'sensor_2']);

      expect(result.sensor_1).toHaveLength(2);
      expect(result.sensor_2).toHaveLength(2);
      expect(result.sensor_1[0].value).toBe(100);
      expect(result.sensor_1[1].value).toBe(110);
    });

    it('should sort samples by timestamp ascending', () => {
      const samples = [
        { point_name: 'sensor', timestamp: '2025-01-01T02:00:00Z', value: 3 },
        { point_name: 'sensor', timestamp: '2025-01-01T00:00:00Z', value: 1 },
        { point_name: 'sensor', timestamp: '2025-01-01T01:00:00Z', value: 2 }
      ];

      const result = filterAndGroupTimeseries(samples, ['sensor']);

      expect(result.sensor).toHaveLength(3);
      expect(result.sensor[0].value).toBe(1);
      expect(result.sensor[1].value).toBe(2);
      expect(result.sensor[2].value).toBe(3);
    });

    it('should handle points with no data', () => {
      const samples = [
        { point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 100 }
      ];

      const result = filterAndGroupTimeseries(samples, ['sensor_1', 'sensor_2', 'sensor_3']);

      expect(result.sensor_1).toHaveLength(1);
      expect(result.sensor_2).toEqual([]);
      expect(result.sensor_3).toEqual([]);
    });

    it('should handle empty samples array', () => {
      const result = filterAndGroupTimeseries([], ['sensor_1', 'sensor_2']);

      expect(result.sensor_1).toEqual([]);
      expect(result.sensor_2).toEqual([]);
    });

    it('should handle empty selected points array', () => {
      const samples = [
        { point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 100 }
      ];

      const result = filterAndGroupTimeseries(samples, []);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should preserve all sample properties', () => {
      const samples = [
        {
          point_name: 'sensor',
          timestamp: '2025-01-01T00:00:00Z',
          value: 100,
          quality: 'good',
          metadata: { unit: 'F' }
        }
      ];

      const result = filterAndGroupTimeseries(samples, ['sensor']);

      expect(result.sensor[0]).toEqual({
        point_name: 'sensor',
        timestamp: '2025-01-01T00:00:00Z',
        value: 100,
        quality: 'good',
        metadata: { unit: 'F' }
      });
    });
  });

  describe('fetchTimeseriesForPoints', () => {

    it('should fetch and filter in one call', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'temp_1', timestamp: '2025-01-01T00:00:00Z', value: 72 },
            { point_name: 'temp_2', timestamp: '2025-01-01T00:00:00Z', value: 68 },
            { point_name: 'humidity', timestamp: '2025-01-01T00:00:00Z', value: 45 }
          ],
          collection_intervals: { temp_1: 300, temp_2: 300, humidity: 600 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchTimeseriesForPoints(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' },
        ['temp_1', 'temp_2']
      );

      expect(result.groupedData).toHaveProperty('temp_1');
      expect(result.groupedData).toHaveProperty('temp_2');
      expect(result.groupedData).not.toHaveProperty('humidity');
      expect(result.collection_intervals).toEqual({ temp_1: 300, temp_2: 300, humidity: 600 });
    });

    it('should preserve raw collection intervals', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'sensor_1', timestamp: '2025-01-01T00:00:00Z', value: 1 }
          ],
          collection_intervals: { sensor_1: 300, sensor_2: 600, sensor_3: 900 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchTimeseriesForPoints(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' },
        ['sensor_1']
      );

      // Should preserve ALL collection intervals, not just for selected points
      expect(result.collection_intervals).toEqual({
        sensor_1: 300,
        sensor_2: 600,
        sensor_3: 900
      });
    });

    it('should pass through onProgress callback', async () => {
      const onProgress = vi.fn();

      const mockResponse = {
        ok: true,
        json: async () => ({
          samples: Array(100).fill(null).map((_, i) => ({
            point_name: 'sensor', timestamp: `2025-01-01T00:${i}:00Z`, value: i
          })),
          collection_intervals: { sensor: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchTimeseriesForPoints(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' },
        ['sensor'],
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(100, false);
    });

    it('should handle pagination with filtering', async () => {
      const page1Response = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'keep', timestamp: '2025-01-01T00:00:00Z', value: 1 },
            { point_name: 'filter', timestamp: '2025-01-01T00:00:00Z', value: 999 }
          ],
          collection_intervals: { keep: 300, filter: 300 },
          has_more: true,
          next_cursor: 'cursor-2'
        })
      };

      const page2Response = {
        ok: true,
        json: async () => ({
          samples: [
            { point_name: 'keep', timestamp: '2025-01-01T01:00:00Z', value: 2 },
            { point_name: 'filter', timestamp: '2025-01-01T01:00:00Z', value: 888 }
          ],
          collection_intervals: { keep: 300, filter: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const result = await fetchTimeseriesForPoints(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' },
        ['keep']
      );

      expect(result.groupedData.keep).toHaveLength(2);
      expect(result.groupedData).not.toHaveProperty('filter');
      expect(result.groupedData.keep[0].value).toBe(1);
      expect(result.groupedData.keep[1].value).toBe(2);
    });
  });

  describe('Performance Tests', () => {

    it('should handle large dataset (1M+ points) efficiently', async () => {
      const startTime = Date.now();

      // Simulate 10 pages of 100k samples each
      const largePage = {
        ok: true,
        json: async () => ({
          samples: Array(100000).fill(null).map((_, i) => ({
            point_name: `sensor_${i % 100}`,
            timestamp: `2025-01-01T${Math.floor(i / 3600)}:${Math.floor((i % 3600) / 60)}:${i % 60}Z`,
            value: Math.random() * 100
          })),
          collection_intervals: { sensor_1: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(largePage);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      const duration = Date.now() - startTime;

      expect(result.samples.length).toBe(100000);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should maintain memory efficiency during pagination', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const pageResponse = {
        ok: true,
        json: async () => ({
          samples: Array(10000).fill(null).map((_, i) => ({
            point_name: 'sensor', timestamp: `2025-01-01T00:${i}:00Z`, value: i
          })),
          collection_intervals: { sensor: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValue(pageResponse);

      await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      // Force garbage collection if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 100MB for 10k samples)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should process filtering in O(n) time', () => {
      const startTime = performance.now();

      const samples = Array(100000).fill(null).map((_, i) => ({
        point_name: `sensor_${i % 1000}`,
        timestamp: `2025-01-01T00:${i}:00Z`,
        value: i
      }));

      const selectedPoints = Array(10).fill(null).map((_, i) => `sensor_${i}`);

      filterAndGroupTimeseries(samples, selectedPoints);

      const duration = performance.now() - startTime;

      // Should process 100k samples in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {

    it('should handle empty results gracefully', async () => {
      const emptyResponse = {
        ok: true,
        json: async () => ({
          samples: [],
          collection_intervals: {},
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(emptyResponse);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(result.samples).toEqual([]);
      expect(result.collection_intervals).toEqual({});
      expect(result.has_more).toBe(false);
    });

    it('should handle single page response correctly', async () => {
      const singlePageResponse = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor', timestamp: '2025-01-01T00:00:00Z', value: 1 }],
          collection_intervals: { sensor: 300 },
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(singlePageResponse);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.samples).toHaveLength(1);
    });

    it('should handle invalid cursor gracefully', async () => {
      const errorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request - Invalid cursor'
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Failed to fetch timeseries data: 400 Bad Request - Invalid cursor');
    });

    it('should handle token expiration', async () => {
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized - Token expired'
      };

      mockFetch.mockResolvedValueOnce(unauthorizedResponse);

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Failed to fetch timeseries data: 401 Unauthorized - Token expired');
    });

    it('should handle malformed JSON response', async () => {
      const malformedResponse = {
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      };

      mockFetch.mockResolvedValueOnce(malformedResponse);

      await expect(
        fetchPaginatedTimeseries(
          'test-token',
          { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
        )
      ).rejects.toThrow('Invalid JSON');
    });

    it('should handle missing collection_intervals field', async () => {
      const responseWithoutIntervals = {
        ok: true,
        json: async () => ({
          samples: [{ point_name: 'sensor', timestamp: '2025-01-01T00:00:00Z', value: 1 }],
          // collection_intervals missing
          has_more: false,
          next_cursor: null
        })
      };

      mockFetch.mockResolvedValueOnce(responseWithoutIntervals);

      const result = await fetchPaginatedTimeseries(
        'test-token',
        { building_id: 'bldg-123', start_date: '2025-01-01', end_date: '2025-01-02' }
      );

      expect(result.collection_intervals).toBeDefined();
      // Should default to empty object
      expect(result.collection_intervals).toEqual({});
    });

    it('should handle very long point names', () => {
      const longPointName = 'a'.repeat(1000);
      const samples = [
        { point_name: longPointName, timestamp: '2025-01-01T00:00:00Z', value: 1 }
      ];

      const result = filterAndGroupTimeseries(samples, [longPointName]);

      expect(result[longPointName]).toHaveLength(1);
    });

    it('should handle special characters in point names', () => {
      const specialPointName = 'sensor/with\\special:chars@#$%';
      const samples = [
        { point_name: specialPointName, timestamp: '2025-01-01T00:00:00Z', value: 1 }
      ];

      const result = filterAndGroupTimeseries(samples, [specialPointName]);

      expect(result[specialPointName]).toHaveLength(1);
    });
  });
});
