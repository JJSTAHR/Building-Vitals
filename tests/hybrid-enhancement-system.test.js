/**
 * Hybrid Point Enhancement System Tests
 * Version: 1.0.0
 *
 * Comprehensive test suite for the hybrid enhancement system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment for testing
const createMockEnv = () => ({
  POINTS_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  AI: {
    run: vi.fn()
  },
  VECTORIZE_INDEX: {
    upsert: vi.fn(),
    query: vi.fn()
  }
});

// Mock point data
const mockRawPoints = [
  {
    Name: 'AHU_01_SA_Temp',
    'Kv Tags': [{ dis: 'AHU 01 Supply Air Temperature', unit: '°F' }],
    'Collect Enabled': true
  },
  {
    Name: 'VAV_B1F1_Room101_Temp',
    'Kv Tags': [{ dis: 'VAV B1F1 Room 101 Temperature', unit: '°F' }],
    'Collect Enabled': true
  },
  {
    Name: 'Chiller_01_Status',
    'Kv Tags': [{ dis: 'Chiller 01 Status' }],
    'Collect Enabled': true
  }
];

describe('Hybrid Point Enhancement System', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
    vi.clearAllMocks();
  });

  describe('Rule-Based Enhancement', () => {
    it('should detect equipment type correctly', async () => {
      const { enhancePointRuleBased, detectEquipment } = await import(
        '../src/utils/rule-based-enhancer.js'
      );

      const equipment = detectEquipment('ahu_01_sa_temp');
      expect(equipment.type).toBe('ahu');
      expect(equipment.category).toBe('hvac');
      expect(equipment.system).toBe('air-handling');
      expect(equipment.matched).toBe(true);
    });

    it('should detect point type correctly', async () => {
      const { detectPointType } = await import(
        '../src/utils/rule-based-enhancer.js'
      );

      const pointType = detectPointType('supply air temperature');
      expect(pointType.type).toBe('temp');
      expect(pointType.unit).toBe('°F');
      expect(pointType.matched).toBe(true);
    });

    it('should calculate confidence score correctly', async () => {
      const { calculateConfidence } = await import(
        '../src/utils/rule-based-enhancer.js'
      );

      const equipment = { matched: true, confidence: 95 };
      const pointType = { matched: true, confidence: 90 };
      const location = { building: 'B1', floor: 'F1', zone: 'Room101' };

      const confidence = calculateConfidence(equipment, pointType, location, true);
      expect(confidence).toBeGreaterThan(80);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should enhance point with all metadata', async () => {
      const { enhancePointRuleBased } = await import(
        '../src/utils/rule-based-enhancer.js'
      );

      const enhanced = await enhancePointRuleBased(mockRawPoints[0]);

      expect(enhanced).toHaveProperty('name');
      expect(enhanced).toHaveProperty('display_name');
      expect(enhanced).toHaveProperty('equipment');
      expect(enhanced).toHaveProperty('pointType');
      expect(enhanced).toHaveProperty('confidence');
      expect(enhanced).toHaveProperty('marker_tags');
      expect(enhanced.equipment).toBe('ahu');
      expect(enhanced.confidence).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should check cache and return cached data if valid', async () => {
      const { checkCache } = await import('../src/utils/cache-manager.js');

      const cachedData = {
        name: 'AHU_01_SA_Temp',
        display_name: 'AHU 01 Supply Air Temperature',
        source: 'rule-based',
        confidence: 90,
        _cachedAt: new Date().toISOString(),
        _cacheTTL: 3600
      };

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await checkCache('AHU_01_SA_Temp', mockEnv);

      expect(result).toBeTruthy();
      expect(result.name).toBe('AHU_01_SA_Temp');
      expect(mockEnv.POINTS_KV.get).toHaveBeenCalled();
    });

    it('should return null on cache miss', async () => {
      const { checkCache } = await import('../src/utils/cache-manager.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(null);

      const result = await checkCache('NonExistent_Point', mockEnv);

      expect(result).toBeNull();
      expect(mockEnv.POINTS_KV.get).toHaveBeenCalled();
    });

    it('should store result with appropriate TTL', async () => {
      const { cacheResult } = await import('../src/utils/cache-manager.js');

      const data = {
        name: 'AHU_01_SA_Temp',
        source: 'ai-full',
        confidence: 95
      };

      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await cacheResult('AHU_01_SA_Temp', data, mockEnv);

      expect(result).toBe(true);
      expect(mockEnv.POINTS_KV.put).toHaveBeenCalled();

      const putCall = mockEnv.POINTS_KV.put.mock.calls[0];
      expect(putCall[0]).toContain('AHU_01_SA_Temp');
      expect(putCall[2]).toHaveProperty('expirationTtl');
    });

    it('should calculate TTL based on confidence level', async () => {
      const { CACHE_CONFIG } = await import('../src/utils/cache-manager.js');

      expect(CACHE_CONFIG.TTL.HIGH_CONFIDENCE).toBeGreaterThan(CACHE_CONFIG.TTL.MEDIUM_CONFIDENCE);
      expect(CACHE_CONFIG.TTL.MEDIUM_CONFIDENCE).toBeGreaterThan(CACHE_CONFIG.TTL.LOW_CONFIDENCE);
    });
  });

  describe('Quota Management', () => {
    it('should check quota and return status', async () => {
      const { checkAIQuota } = await import('../src/utils/quota-manager.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({ count: 500 }));

      const status = await checkAIQuota(mockEnv);

      expect(status).toHaveProperty('used');
      expect(status).toHaveProperty('limit');
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('exceeded');
      expect(status.exceeded).toBe(false);
      expect(status.used).toBe(500);
    });

    it('should detect quota exceeded', async () => {
      const { checkAIQuota } = await import('../src/utils/quota-manager.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({ count: 10000 }));

      const status = await checkAIQuota(mockEnv);

      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBeLessThanOrEqual(0);
    });

    it('should increment quota correctly', async () => {
      const { incrementAIQuota } = await import('../src/utils/quota-manager.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({ count: 100 }));
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const status = await incrementAIQuota(mockEnv, 5);

      expect(mockEnv.POINTS_KV.put).toHaveBeenCalled();

      const putCall = mockEnv.POINTS_KV.put.mock.calls[0];
      const data = JSON.parse(putCall[1]);
      expect(data.count).toBe(105);
    });

    it('should warn when approaching quota limits', async () => {
      const { checkAIQuota } = await import('../src/utils/quota-manager.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({ count: 8500 }));

      const status = await checkAIQuota(mockEnv);

      expect(status.warning).toBe(true);
      expect(status.exceeded).toBe(false);
    });
  });

  describe('Metrics Collection', () => {
    it('should record enhancement metric', async () => {
      const { recordMetric } = await import('../src/utils/metrics-collector.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await recordMetric(mockEnv, 'enhancement', {
        mode: 'rule-based',
        confidence: 85,
        duration: 50,
        pointName: 'AHU_01_SA_Temp'
      });

      expect(result).toBe(true);
      expect(mockEnv.POINTS_KV.put).toHaveBeenCalled();
    });

    it('should aggregate metrics by hour', async () => {
      const { recordMetric } = await import('../src/utils/metrics-collector.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({
        hour: '2025-10-13-14',
        count: 10,
        modes: { 'rule-based': 5, 'ai-full': 5 },
        totalDuration: 500,
        totalConfidence: 850
      }));
      mockEnv.POINTS_KV.put.mockResolvedValue();

      await recordMetric(mockEnv, 'enhancement', {
        mode: 'rule-based',
        confidence: 90,
        duration: 45
      });

      expect(mockEnv.POINTS_KV.put).toHaveBeenCalled();
    });

    it('should get summary statistics', async () => {
      const { getSummaryStats } = await import('../src/utils/metrics-collector.js');

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify({
        totalEnhancements: 1000,
        byMode: {
          'cache': 400,
          'rule-based': 450,
          'ai-validated': 100,
          'ai-full': 50
        },
        avgDuration: 75,
        avgConfidence: 85
      }));

      const stats = await getSummaryStats(mockEnv);

      expect(stats).toHaveProperty('totalEnhancements');
      expect(stats.totalEnhancements).toBe(1000);
      expect(stats.byMode).toHaveProperty('cache');
      expect(stats.byMode).toHaveProperty('rule-based');
    });
  });

  describe('Hybrid Enhancement Flow', () => {
    it('should use cached result when available', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      const cachedData = {
        name: 'AHU_01_SA_Temp',
        display_name: 'AHU 01 Supply Air Temperature',
        source: 'rule-based',
        confidence: 90,
        _cachedAt: new Date().toISOString(),
        _cacheTTL: 3600
      };

      mockEnv.POINTS_KV.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await enhancePointHybrid(mockRawPoints[0], mockEnv, null);

      expect(result.source).toBe('cache');
      expect(result.cached).toBe(true);
      expect(mockEnv.POINTS_KV.get).toHaveBeenCalled();
    });

    it('should use rule-based for high confidence', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      mockEnv.POINTS_KV.get.mockResolvedValue(null); // No cache
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(mockRawPoints[0], mockEnv, null);

      // AHU with temp should have high confidence
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.source).toMatch(/rule-based/);
    });

    it('should fallback to rule-based when quota exceeded', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      // Mock quota exceeded
      mockEnv.POINTS_KV.get
        .mockResolvedValueOnce(null) // No cache
        .mockResolvedValueOnce(JSON.stringify({ count: 10000 })); // Quota exceeded

      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(mockRawPoints[0], mockEnv, null);

      expect(result.source).toBe('rule-based-fallback');
      expect(result.quotaExceeded).toBe(true);
    });

    it('should process batch of points efficiently', async () => {
      const { enhancePointsBatch } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointsBatch(mockRawPoints, mockEnv, {
        batchSize: 2,
        maxConcurrency: 2
      });

      expect(result.success).toBe(true);
      expect(result.totalPoints).toBe(mockRawPoints.length);
      expect(result.processedCount).toBe(mockRawPoints.length);
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('averageTimePerPoint');
    });

    it('should handle errors gracefully in batch processing', async () => {
      const { enhancePointsBatch } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      // Mock error for one point
      mockEnv.POINTS_KV.get.mockRejectedValueOnce(new Error('KV error'));
      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointsBatch(mockRawPoints, mockEnv, {
        batchSize: 2,
        maxConcurrency: 2
      });

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(mockRawPoints.length);
      // Should continue despite errors
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process points in under target time', async () => {
      const { enhancePointsBatch } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const startTime = Date.now();

      const result = await enhancePointsBatch(mockRawPoints, mockEnv, {
        batchSize: 10,
        maxConcurrency: 5
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should process 3 points in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should achieve target throughput for large batches', async () => {
      const { enhancePointsBatch } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      // Generate 100 test points
      const largePointSet = Array.from({ length: 100 }, (_, i) => ({
        Name: `AHU_${i.toString().padStart(2, '0')}_SA_Temp`,
        'Kv Tags': [{ dis: `AHU ${i} Supply Air Temperature`, unit: '°F' }],
        'Collect Enabled': true
      }));

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointsBatch(largePointSet, mockEnv, {
        batchSize: 20,
        maxConcurrency: 10
      });

      expect(result.success).toBe(true);
      expect(result.totalPoints).toBe(100);

      // Should achieve > 10 points/second
      const pointsPerSecond = parseFloat(result.pointsPerSecond);
      expect(pointsPerSecond).toBeGreaterThan(10);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full enhancement pipeline', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(mockRawPoints[0], mockEnv, null);

      // Verify complete enhancement
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('display_name');
      expect(result).toHaveProperty('equipment');
      expect(result).toHaveProperty('equipmentType');
      expect(result).toHaveProperty('pointType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('marker_tags');
      expect(result).toHaveProperty('_enhancedAt');

      // Verify data quality
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.marker_tags).toBeInstanceOf(Array);
      expect(result.marker_tags.length).toBeGreaterThan(0);
    });

    it('should maintain data integrity through enhancement', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const originalName = mockRawPoints[0].Name;
      const result = await enhancePointHybrid(mockRawPoints[0], mockEnv, null);

      // Original data should be preserved
      expect(result.name).toBe(originalName);
      expect(result.original_name).toBe(originalName);
    });
  });

  describe('Edge Cases', () => {
    it('should handle points with minimal metadata', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      const minimalPoint = {
        Name: 'UnknownPoint'
      };

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(minimalPoint, mockEnv, null);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('confidence');
      expect(result.source).toBeTruthy();
    });

    it('should handle points with special characters', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      const specialPoint = {
        Name: 'AHU-01_SA:Temp (°F)',
        'Kv Tags': [{ dis: 'AHU 01 Supply Air Temperature', unit: '°F' }]
      };

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(specialPoint, mockEnv, null);

      expect(result.name).toBe('AHU-01_SA:Temp (°F)');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle very long point names', async () => {
      const { enhancePointHybrid } = await import(
        '../src/utils/hybrid-point-enhancer.js'
      );

      const longName = 'Building_A_Floor_2_Zone_3_AHU_01_Supply_Air_Temperature_Sensor_Reading_Value';
      const longPoint = {
        Name: longName,
        'Kv Tags': [{ dis: 'AHU 01 Supply Air Temperature', unit: '°F' }]
      };

      mockEnv.POINTS_KV.get.mockResolvedValue(null);
      mockEnv.POINTS_KV.put.mockResolvedValue();

      const result = await enhancePointHybrid(longPoint, mockEnv, null);

      expect(result.name).toBe(longName);
      expect(result.equipment).toBe('ahu');
    });
  });
});
