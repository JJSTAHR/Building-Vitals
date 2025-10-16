/**
 * Caching Strategy Tests
 * Tests for tiered caching, TTL management, and cache invalidation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fallsCityPoints, cacheTestData, expectedEnhancements } from '../fixtures/falls-city-points';

interface CacheEntry {
  data: any;
  tier: 1 | 2 | 3 | 4;
  confidence: number;
  timestamp: number;
  ttl: number;
  hits: number;
}

class TieredCache {
  private cache = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;

  set(key: string, data: any, confidence: number): void {
    const tier = this.determineTier(confidence);
    const ttl = this.getTTL(tier);

    this.cache.set(key, {
      data,
      tier,
      confidence,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    const age = Date.now() - entry.timestamp;

    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    entry.hits++;
    this.hitCount++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl * 1000;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateByTier(tier: 1 | 2 | 3 | 4): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tier === tier) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : (this.hitCount / total) * 100;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.getHitRate(),
    };
  }

  private determineTier(confidence: number): 1 | 2 | 3 | 4 {
    if (confidence > 90) return 1; // Tier 1: Highly confident
    if (confidence >= 80) return 2; // Tier 2: Medium confidence
    if (confidence >= 70) return 3; // Tier 3: Low confidence
    return 4; // Tier 4: Fallback
  }

  private getTTL(tier: 1 | 2 | 3 | 4): number {
    const ttls = {
      1: 604800, // 7 days
      2: 86400,  // 1 day
      3: 3600,   // 1 hour
      4: 300,    // 5 minutes
    };
    return ttls[tier];
  }

  generateKey(point: any): string {
    return point.Name || JSON.stringify(point);
  }
}

describe('Caching Strategy Tests', () => {
  let cache: TieredCache;

  beforeEach(() => {
    cache = new TieredCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache Tier Assignment', () => {
    it('should assign tier 1 for high confidence (>90%)', () => {
      const key = 'high-confidence-point';
      cache.set(key, { display_name: 'Test' }, 95);

      const entry = cache['cache'].get(key);

      expect(entry?.tier).toBe(1);
      expect(entry?.ttl).toBe(604800); // 7 days
    });

    it('should assign tier 2 for medium-high confidence (80-90%)', () => {
      const key = 'medium-confidence-point';
      cache.set(key, { display_name: 'Test' }, 85);

      const entry = cache['cache'].get(key);

      expect(entry?.tier).toBe(2);
      expect(entry?.ttl).toBe(86400); // 1 day
    });

    it('should assign tier 3 for low confidence (70-80%)', () => {
      const key = 'low-confidence-point';
      cache.set(key, { display_name: 'Test' }, 75);

      const entry = cache['cache'].get(key);

      expect(entry?.tier).toBe(3);
      expect(entry?.ttl).toBe(3600); // 1 hour
    });

    it('should assign tier 4 for fallback (<70%)', () => {
      const key = 'fallback-point';
      cache.set(key, { display_name: 'Test' }, 60);

      const entry = cache['cache'].get(key);

      expect(entry?.tier).toBe(4);
      expect(entry?.ttl).toBe(300); // 5 minutes
    });

    it('should handle Falls City points with appropriate tiers', () => {
      for (const [pointName, expected] of Object.entries(expectedEnhancements)) {
        cache.set(pointName, expected, expected.confidence);

        const entry = cache['cache'].get(pointName);
        expect(entry?.tier).toBeGreaterThanOrEqual(1);
        expect(entry?.tier).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('TTL Verification', () => {
    it('should respect tier 1 TTL (7 days)', () => {
      const key = 'tier1-point';
      cache.set(key, { display_name: 'Test' }, 95);

      // Advance time by 6 days
      vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      expect(cache.has(key)).toBe(true);
      expect(cache.get(key)).toBeTruthy();
    });

    it('should expire tier 1 after 7 days', () => {
      const key = 'tier1-point';
      cache.set(key, { display_name: 'Test' }, 95);

      // Advance time by 8 days
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      expect(cache.has(key)).toBe(false);
      expect(cache.get(key)).toBeNull();
    });

    it('should respect tier 2 TTL (1 day)', () => {
      const key = 'tier2-point';
      cache.set(key, { display_name: 'Test' }, 85);

      // Advance time by 23 hours
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      expect(cache.has(key)).toBe(true);
    });

    it('should expire tier 2 after 1 day', () => {
      const key = 'tier2-point';
      cache.set(key, { display_name: 'Test' }, 85);

      // Advance time by 25 hours
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      expect(cache.has(key)).toBe(false);
    });

    it('should respect tier 3 TTL (1 hour)', () => {
      const key = 'tier3-point';
      cache.set(key, { display_name: 'Test' }, 75);

      // Advance time by 59 minutes
      vi.advanceTimersByTime(59 * 60 * 1000);

      expect(cache.has(key)).toBe(true);
    });

    it('should expire tier 3 after 1 hour', () => {
      const key = 'tier3-point';
      cache.set(key, { display_name: 'Test' }, 75);

      // Advance time by 61 minutes
      vi.advanceTimersByTime(61 * 60 * 1000);

      expect(cache.has(key)).toBe(false);
    });

    it('should respect tier 4 TTL (5 minutes)', () => {
      const key = 'tier4-point';
      cache.set(key, { display_name: 'Test' }, 60);

      // Advance time by 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(cache.has(key)).toBe(true);
    });

    it('should expire tier 4 after 5 minutes', () => {
      const key = 'tier4-point';
      cache.set(key, { display_name: 'Test' }, 60);

      // Advance time by 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(cache.has(key)).toBe(false);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys from point names', () => {
      const point = fallsCityPoints[0];
      const key1 = cache.generateKey(point);
      const key2 = cache.generateKey(point);

      expect(key1).toBe(key2);
    });

    it('should generate unique keys for different points', () => {
      const key1 = cache.generateKey(fallsCityPoints[0]);
      const key2 = cache.generateKey(fallsCityPoints[1]);

      expect(key1).not.toBe(key2);
    });

    it('should handle points without Name field', () => {
      const point = { data: 'test' };
      const key = cache.generateKey(point);

      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate single entry', () => {
      const key = 'test-point';
      cache.set(key, { display_name: 'Test' }, 90);

      cache.invalidate(key);

      expect(cache.has(key)).toBe(false);
    });

    it('should invalidate all tier 1 entries', () => {
      cache.set('point1', { display_name: 'Test1' }, 95);
      cache.set('point2', { display_name: 'Test2' }, 92);
      cache.set('point3', { display_name: 'Test3' }, 85);

      cache.invalidateByTier(1);

      expect(cache.has('point1')).toBe(false);
      expect(cache.has('point2')).toBe(false);
      expect(cache.has('point3')).toBe(true); // Tier 2
    });

    it('should clear all cache entries', () => {
      cache.set('point1', { display_name: 'Test1' }, 95);
      cache.set('point2', { display_name: 'Test2' }, 85);
      cache.set('point3', { display_name: 'Test3' }, 75);

      cache.invalidateAll();

      expect(cache.getStats().size).toBe(0);
    });

    it('should reset hit/miss counters on full invalidation', () => {
      cache.set('point1', {}, 90);
      cache.get('point1');
      cache.get('nonexistent');

      cache.invalidateAll();

      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
    });
  });

  describe('Cache Hit Rate Tracking', () => {
    it('should track cache hits', () => {
      cache.set('point1', { display_name: 'Test' }, 90);
      cache.get('point1');
      cache.get('point1');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.hitRate).toBe(100);
    });

    it('should track cache misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();

      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('point1', { display_name: 'Test' }, 90);

      cache.get('point1'); // Hit
      cache.get('nonexistent'); // Miss
      cache.get('point1'); // Hit

      const stats = cache.getStats();

      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should achieve >85% hit rate with realistic data', () => {
      // Simulate realistic usage pattern
      for (let i = 0; i < 100; i++) {
        cache.set(`point${i}`, { display_name: `Point ${i}` }, 85);
      }

      // 90% requests are for cached points
      for (let i = 0; i < 900; i++) {
        cache.get(`point${i % 100}`);
      }

      // 10% requests are cache misses
      for (let i = 0; i < 100; i++) {
        cache.get(`uncached${i}`);
      }

      const stats = cache.getStats();

      expect(stats.hitRate).toBeGreaterThan(85);
    });
  });
});
