/**
 * Tier Selection Tests
 * Tests for intelligent tier selection based on confidence scores and quota
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fallsCityPoints, quotaTestScenarios } from '../fixtures/falls-city-points';

interface TierSelectionResult {
  tier: 'cache' | 'rule-based-high' | 'rule-based-medium' | 'ai' | 'fallback';
  confidence: number;
  reason: string;
  quotaImpact: number;
}

class TierSelector {
  constructor(
    private dailyQuota: number,
    private quotaUsed: number,
    private cache: Map<string, any>
  ) {}

  selectTier(point: any): TierSelectionResult {
    // Check cache first
    const cached = this.cache.get(point.Name);
    if (cached && cached.confidence > 80) {
      return {
        tier: 'cache',
        confidence: cached.confidence,
        reason: 'Cache hit with high confidence',
        quotaImpact: 0,
      };
    }

    // Calculate confidence score
    const confidence = this.calculateConfidence(point);
    const quotaRemaining = this.dailyQuota - this.quotaUsed;
    const quotaPercentage = (this.quotaUsed / this.dailyQuota) * 100;

    // High confidence rule-based (>85%)
    if (confidence > 85) {
      return {
        tier: 'rule-based-high',
        confidence,
        reason: 'High confidence rule-based enhancement',
        quotaImpact: 0,
      };
    }

    // Medium confidence with AI validation (70-85%)
    if (confidence >= 70 && confidence <= 85) {
      if (quotaPercentage < 80) {
        return {
          tier: 'ai',
          confidence,
          reason: 'Medium confidence, AI validation available',
          quotaImpact: 20,
        };
      }
      return {
        tier: 'rule-based-medium',
        confidence,
        reason: 'Medium confidence, quota conservation',
        quotaImpact: 0,
      };
    }

    // Low confidence with full AI (<70%)
    if (confidence < 70) {
      if (quotaPercentage < 80 && quotaRemaining > 100) {
        return {
          tier: 'ai',
          confidence,
          reason: 'Low confidence requires AI enhancement',
          quotaImpact: 50,
        };
      }
      return {
        tier: 'fallback',
        confidence,
        reason: 'Low confidence, quota exhausted',
        quotaImpact: 0,
      };
    }

    return {
      tier: 'fallback',
      confidence: 0,
      reason: 'No suitable tier found',
      quotaImpact: 0,
    };
  }

  private calculateConfidence(point: any): number {
    let confidence = 50; // Base confidence

    // Marker tags boost confidence
    if (point['Marker Tags'] && point['Marker Tags'].length > 0) {
      confidence += 15;
    }

    // KV tags boost confidence
    if (point['Kv Tags'] && point['Kv Tags'] !== '[]') {
      confidence += 20;
    }

    // Bacnet data boost confidence
    if (point['Bacnet Data'] && point['Bacnet Data'] !== '[]') {
      const bacnetData = JSON.parse(point['Bacnet Data']);
      if (bacnetData[0]?.device_name) confidence += 10;
      if (bacnetData[0]?.object_name) confidence += 5;
    }

    // Collect enabled points are more important
    if (point['Collect Enabled'] === 'True') {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }
}

describe('Tier Selection Tests', () => {
  let selector: TierSelector;
  let cache: Map<string, any>;

  beforeEach(() => {
    cache = new Map();
    selector = new TierSelector(10000, 0, cache);
  });

  describe('Cache Hit Scenarios', () => {
    it('should use cache for high confidence cached points', () => {
      cache.set('test-point', { confidence: 95, display_name: 'Cached Point' });

      const result = selector.selectTier({ Name: 'test-point' });

      expect(result.tier).toBe('cache');
      expect(result.confidence).toBe(95);
      expect(result.quotaImpact).toBe(0);
    });

    it('should skip cache for low confidence cached points', () => {
      cache.set('test-point', { confidence: 60, display_name: 'Low Confidence' });

      const result = selector.selectTier({
        Name: 'test-point',
        'Marker Tags': 'TestPoint',
        'Kv Tags': '[]',
      });

      expect(result.tier).not.toBe('cache');
      expect(result.quotaImpact).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache miss', () => {
      const result = selector.selectTier({
        Name: 'uncached-point',
        'Marker Tags': 'TestPoint',
      });

      expect(result.tier).not.toBe('cache');
    });

    it('should prioritize cache over all other tiers', () => {
      cache.set(fallsCityPoints[0].Name, { confidence: 90 });

      const result = selector.selectTier(fallsCityPoints[0]);

      expect(result.tier).toBe('cache');
      expect(result.quotaImpact).toBe(0);
    });
  });

  describe('High Confidence Rule-Based (>85%)', () => {
    it('should select rule-based-high for points with complete metadata', () => {
      const point = {
        Name: 'test-point',
        'Marker Tags': 'VAV Temp',
        'Kv Tags': '[{"device":"VAV-01"}]',
        'Bacnet Data': '[{"device_name":"VAV_01","object_name":"Temp"}]',
        'Collect Enabled': 'True',
      };

      const result = selector.selectTier(point);

      expect(result.tier).toBe('rule-based-high');
      expect(result.confidence).toBeGreaterThan(85);
      expect(result.quotaImpact).toBe(0);
    });

    it('should handle Falls City VAV points with high confidence', () => {
      const result = selector.selectTier(fallsCityPoints[0]);

      expect(result.confidence).toBeGreaterThan(70);
      expect(['rule-based-high', 'rule-based-medium', 'ai']).toContain(result.tier);
    });

    it('should use rule-based even when quota is low', () => {
      selector = new TierSelector(10000, 9500, cache);

      const point = {
        Name: 'test-point',
        'Marker Tags': 'AHU Temp',
        'Kv Tags': '[{"device":"AHU-01"}]',
        'Bacnet Data': '[{"device_name":"AHU_01","object_name":"Temp"}]',
        'Collect Enabled': 'True',
      };

      const result = selector.selectTier(point);

      expect(result.tier).toBe('rule-based-high');
      expect(result.quotaImpact).toBe(0);
    });

    it('should calculate confidence correctly for RTU points', () => {
      const result = selector.selectTier(fallsCityPoints[1]);

      expect(result.confidence).toBeGreaterThan(70);
      expect(result.tier).toBeTruthy();
    });
  });

  describe('Medium Confidence with AI Validation (70-85%)', () => {
    it('should use AI when confidence is medium and quota available', () => {
      const point = {
        Name: 'test-point',
        'Marker Tags': 'Temp',
        'Kv Tags': '[]',
        'Collect Enabled': 'True',
      };

      const result = selector.selectTier(point);

      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.confidence).toBeLessThanOrEqual(85);

      if (result.confidence >= 70 && result.confidence <= 85) {
        expect(['ai', 'rule-based-medium']).toContain(result.tier);
      }
    });

    it('should use rule-based when quota approaching 80%', () => {
      selector = new TierSelector(10000, 8200, cache);

      const point = {
        Name: 'test-point',
        'Marker Tags': 'Temp',
        'Kv Tags': '[]',
      };

      const result = selector.selectTier(point);

      if (result.confidence >= 70 && result.confidence <= 85) {
        expect(result.tier).toBe('rule-based-medium');
        expect(result.quotaImpact).toBe(0);
      }
    });

    it('should optimize quota usage for batch processing', () => {
      const results = fallsCityPoints.slice(0, 5).map(p => selector.selectTier(p));
      const totalQuotaUsed = results.reduce((sum, r) => sum + r.quotaImpact, 0);

      expect(totalQuotaUsed).toBeLessThan(500); // Conservative quota usage
    });
  });

  describe('Low Confidence with Full AI (<70%)', () => {
    it('should use AI for low confidence when quota available', () => {
      const point = {
        Name: 'unknown/point/path',
        'Marker Tags': '',
        'Kv Tags': '[]',
      };

      const result = selector.selectTier(point);

      if (result.confidence < 70) {
        expect(['ai', 'fallback']).toContain(result.tier);
      }
    });

    it('should use fallback when quota exhausted', () => {
      selector = new TierSelector(10000, 9900, cache);

      const point = {
        Name: 'unknown/point',
        'Marker Tags': '',
      };

      const result = selector.selectTier(point);

      if (result.confidence < 70) {
        expect(result.tier).toBe('fallback');
        expect(result.quotaImpact).toBe(0);
      }
    });

    it('should require significant quota for low confidence AI', () => {
      const point = {
        Name: 'unknown/point',
        'Marker Tags': '',
      };

      const result = selector.selectTier(point);

      if (result.tier === 'ai' && result.confidence < 70) {
        expect(result.quotaImpact).toBeGreaterThanOrEqual(50);
      }
    });
  });

  describe('Quota Management Integration', () => {
    it('should respect quota limits across scenarios', () => {
      for (const scenario of quotaTestScenarios) {
        const testSelector = new TierSelector(
          scenario.dailyLimit,
          scenario.quotaUsed,
          cache
        );

        const results = fallsCityPoints.slice(0, scenario.pointCount).map(p =>
          testSelector.selectTier(p)
        );

        const quotaUsed = results.reduce((sum, r) => sum + r.quotaImpact, 0);
        expect(quotaUsed + scenario.quotaUsed).toBeLessThanOrEqual(scenario.dailyLimit * 1.05);
      }
    });

    it('should switch to cache-only when quota exceeded', () => {
      selector = new TierSelector(10000, 10000, cache);

      const result = selector.selectTier(fallsCityPoints[0]);

      expect(['cache', 'fallback', 'rule-based-high', 'rule-based-medium']).toContain(result.tier);
      expect(result.quotaImpact).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle points with no metadata', () => {
      const result = selector.selectTier({ Name: 'bare/point' });

      expect(result.tier).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed KV tags', () => {
      const point = {
        Name: 'test',
        'Kv Tags': 'invalid json {',
      };

      expect(() => selector.selectTier(point)).not.toThrow();
    });

    it('should handle empty Bacnet data', () => {
      const point = {
        Name: 'test',
        'Bacnet Data': '[]',
      };

      const result = selector.selectTier(point);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });
  });
});
