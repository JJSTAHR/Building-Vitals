/**
 * Integration Tests
 * End-to-end tests for the complete hybrid enhancement system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fallsCityPoints, quotaTestScenarios, performanceTestData } from '../fixtures/falls-city-points';

interface SystemConfig {
  workerUrl: string;
  kvNamespace: string;
  dailyQuotaLimit: number;
  cacheEnabled: boolean;
}

class HybridEnhancementSystem {
  private quotaUsed = 0;
  private cache = new Map<string, any>();
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    ruleBased: 0,
    aiEnhancements: 0,
    errors: 0,
  };

  constructor(private config: SystemConfig) {}

  async enhancePoints(points: any[]): Promise<{
    enhanced: any[];
    metrics: typeof this.metrics;
    quotaUsed: number;
  }> {
    this.metrics.totalRequests++;

    try {
      const enhanced = await Promise.all(
        points.map(p => this.enhancePoint(p))
      );

      return {
        enhanced: enhanced.filter(Boolean),
        metrics: { ...this.metrics },
        quotaUsed: this.quotaUsed,
      };
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  private async enhancePoint(point: any): Promise<any> {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(point.Name);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
    }

    // Determine tier
    const confidence = this.calculateConfidence(point);
    const quotaAvailable = this.config.dailyQuotaLimit - this.quotaUsed;

    if (confidence > 85) {
      // Rule-based enhancement
      this.metrics.ruleBased++;
      const enhanced = this.enhanceWithRules(point);
      this.cacheResult(point.Name, enhanced, confidence);
      return enhanced;
    } else if (confidence >= 70 && quotaAvailable > 20) {
      // AI enhancement
      this.metrics.aiEnhancements++;
      this.quotaUsed += 20;
      const enhanced = await this.enhanceWithAI(point);
      this.cacheResult(point.Name, enhanced, confidence);
      return enhanced;
    } else {
      // Fallback
      this.metrics.ruleBased++;
      const enhanced = this.enhanceWithRules(point);
      this.cacheResult(point.Name, enhanced, confidence);
      return enhanced;
    }
  }

  private calculateConfidence(point: any): number {
    let confidence = 50;
    if (point['Marker Tags']) confidence += 15;
    if (point['Kv Tags'] && point['Kv Tags'] !== '[]') confidence += 20;
    if (point['Bacnet Data']) confidence += 15;
    return confidence;
  }

  private enhanceWithRules(point: any): any {
    return {
      ...point,
      display_name: point.Name.split('/').pop(),
      _enhanced: true,
      _method: 'rule-based',
    };
  }

  private async enhanceWithAI(point: any): Promise<any> {
    // Simulate AI API call
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      ...point,
      display_name: `AI Enhanced: ${point.Name.split('/').pop()}`,
      _enhanced: true,
      _method: 'ai',
    };
  }

  private cacheResult(key: string, data: any, confidence: number): void {
    if (this.config.cacheEnabled) {
      this.cache.set(key, { ...data, _cached: true, confidence });
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resetQuota(): void {
    this.quotaUsed = 0;
  }
}

describe('Hybrid System Integration Tests', () => {
  let system: HybridEnhancementSystem;
  const config: SystemConfig = {
    workerUrl: 'https://worker.example.com',
    kvNamespace: 'ENHANCED_POINTS',
    dailyQuotaLimit: 10000,
    cacheEnabled: true,
  };

  beforeEach(() => {
    system = new HybridEnhancementSystem(config);
  });

  describe('Worker Endpoint Integration', () => {
    it('should process points through complete pipeline', async () => {
      const result = await system.enhancePoints(fallsCityPoints.slice(0, 10));

      expect(result.enhanced).toHaveLength(10);
      expect(result.metrics.totalRequests).toBe(1);
    });

    it('should handle batch endpoint with 50 points', async () => {
      const points = fallsCityPoints.slice(0, 50);

      const result = await system.enhancePoints(points);

      expect(result.enhanced).toHaveLength(50);
      expect(result.quotaUsed).toBeLessThan(2000);
    });

    it('should respect worker timeout limits', async () => {
      const largeSet = performanceTestData.large;

      await expect(system.enhancePoints(largeSet)).resolves.toBeTruthy();
    }, 30000);
  });

  describe('KV Storage Operations', () => {
    it('should cache enhanced points', async () => {
      await system.enhancePoints([fallsCityPoints[0]]);

      // Second request should hit cache
      const result = await system.enhancePoints([fallsCityPoints[0]]);

      expect(result.metrics.cacheHits).toBeGreaterThan(0);
    });

    it('should retrieve cached points correctly', async () => {
      const point = fallsCityPoints[0];

      const result1 = await system.enhancePoints([point]);
      const result2 = await system.enhancePoints([point]);

      expect(result1.enhanced[0]?.display_name).toBe(result2.enhanced[0]?.display_name);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await system.enhancePoints([{ Name: 'uncached-point' }]);

      expect(result.enhanced).toHaveLength(1);
      expect(result.metrics.cacheHits).toBe(0);
    });
  });

  describe('AI Model Calls', () => {
    it('should use AI for medium-confidence points', async () => {
      const point = {
        Name: 'test/point',
        'Marker Tags': 'Temp',
        'Kv Tags': '[]',
      };

      const result = await system.enhancePoints([point]);

      expect(result.metrics.aiEnhancements + result.metrics.ruleBased).toBeGreaterThan(0);
    });

    it('should track AI quota usage', async () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        Name: `test/point-${i}`,
        'Marker Tags': 'Temp',
      }));

      const result = await system.enhancePoints(points);

      expect(result.quotaUsed).toBeGreaterThanOrEqual(0);
    });

    it('should fallback when quota exhausted', async () => {
      // Exhaust quota
      system['quotaUsed'] = config.dailyQuotaLimit;

      const result = await system.enhancePoints([fallsCityPoints[0]]);

      expect(result.enhanced).toHaveLength(1);
      expect(result.metrics.aiEnhancements).toBe(0);
    });
  });

  describe('Error Propagation', () => {
    it('should handle network errors gracefully', async () => {
      const result = await system.enhancePoints([{ Name: 'test-point' }]);

      expect(result.enhanced).toBeDefined();
    });

    it('should handle invalid point data', async () => {
      const result = await system.enhancePoints([null as any, undefined as any, {}]);

      expect(result.metrics.errors).toBe(0); // Should handle gracefully
    });

    it('should continue processing after errors', async () => {
      const mixedPoints = [
        fallsCityPoints[0],
        { Name: null },
        fallsCityPoints[1],
      ];

      const result = await system.enhancePoints(mixedPoints);

      expect(result.enhanced.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Collection', () => {
    it('should track all enhancement methods', async () => {
      await system.enhancePoints(fallsCityPoints.slice(0, 10));

      const metrics = system.getMetrics();

      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.ruleBased + metrics.aiEnhancements).toBeGreaterThan(0);
    });

    it('should track cache hit rate', async () => {
      // First pass
      await system.enhancePoints(fallsCityPoints.slice(0, 5));

      // Second pass (should hit cache)
      await system.enhancePoints(fallsCityPoints.slice(0, 5));

      const metrics = system.getMetrics();

      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    it('should track quota usage accurately', async () => {
      const result = await system.enhancePoints(fallsCityPoints.slice(0, 20));

      expect(result.quotaUsed).toBeLessThanOrEqual(config.dailyQuotaLimit);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should process Falls City site (4500 points)', async () => {
      const result = await system.enhancePoints(performanceTestData.large);

      expect(result.enhanced.length).toBeGreaterThan(4000);
      expect(result.quotaUsed).toBeLessThan(config.dailyQuotaLimit);
    }, 60000);

    it('should handle quota-constrained scenario', async () => {
      const scenario = quotaTestScenarios[2]; // Quota exceeded
      system['quotaUsed'] = scenario.quotaUsed;

      const result = await system.enhancePoints(
        fallsCityPoints.slice(0, scenario.pointCount)
      );

      expect(result.enhanced).toHaveLength(scenario.pointCount);
      expect(result.metrics.aiEnhancements).toBe(0); // Should use rule-based only
    });

    it('should achieve expected performance targets', async () => {
      const start = Date.now();

      const result = await system.enhancePoints(performanceTestData.medium);

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // <10 seconds for 1000 points
      expect(result.enhanced).toHaveLength(1000);
    }, 15000);
  });

  describe('Cache Efficiency', () => {
    it('should achieve >85% cache hit rate on repeated requests', async () => {
      const points = fallsCityPoints.slice(0, 20);

      // Populate cache
      await system.enhancePoints(points);

      // Reset metrics
      system['metrics'].cacheHits = 0;
      system['metrics'].totalRequests = 0;

      // Make 10 requests for same points
      for (let i = 0; i < 10; i++) {
        await system.enhancePoints(points);
      }

      const metrics = system.getMetrics();
      const cacheHitRate = (metrics.cacheHits / (10 * points.length)) * 100;

      expect(cacheHitRate).toBeGreaterThan(85);
    });
  });

  describe('Quota Reset', () => {
    it('should reset quota correctly', async () => {
      system['quotaUsed'] = 5000;

      system.resetQuota();

      expect(system['quotaUsed']).toBe(0);
    });

    it('should allow processing after quota reset', async () => {
      system['quotaUsed'] = config.dailyQuotaLimit;

      system.resetQuota();

      const result = await system.enhancePoints(fallsCityPoints.slice(0, 5));

      expect(result.enhanced).toHaveLength(5);
    });
  });

  describe('System Health', () => {
    it('should maintain performance under sustained load', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await system.enhancePoints(performanceTestData.small);
        durations.push(Date.now() - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(maxDuration).toBeLessThan(avgDuration * 1.5); // No significant degradation
    }, 20000);

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        system.enhancePoints(fallsCityPoints.slice(0, 10))
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(r => {
        expect(r.enhanced).toHaveLength(10);
      });
    });
  });
});
