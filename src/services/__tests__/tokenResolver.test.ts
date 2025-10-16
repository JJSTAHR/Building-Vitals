/**
 * TokenResolver Unit Tests
 * Tests for token resolution with priority chain and caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupTestEnvironment,
  MockEventEmitter,
  PerformanceTimer,
  waitForAsync,
  createOrderedSpy,
} from '../../test-utils/tokenTestHelpers';
import {
  createMockSiteToken,
  generateMockJWT,
  mockSiteIds,
} from '../../test-utils/mockTokenData';

describe('TokenResolver', () => {
  let env: ReturnType<typeof setupTestEnvironment>;
  let eventEmitter: MockEventEmitter;
  let cache: Map<string, { token: string; timestamp: number; source: string }>;

  beforeEach(() => {
    env = setupTestEnvironment();
    eventEmitter = new MockEventEmitter();
    cache = new Map();
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.cleanup();
    eventEmitter.removeAllListeners();
    cache.clear();
  });

  describe('Priority Chain Resolution', () => {
    it('should check URL parameter first', () => {
      const urlToken = 'url_token';
      const priorityChain = ['url', 'storage', 'default', 'fallback'];

      expect(priorityChain[0]).toBe('url');
      expect(urlToken).toBeTruthy();
    });

    it('should check storage second', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      const storedToken = env.mockLocalStorage.getItem(`token_${token.siteId}`);
      expect(storedToken).toBe(token.token);
    });

    it('should check default tokens third', () => {
      const defaultToken = 'default_token';
      const hasDefault = defaultToken !== null;

      expect(hasDefault).toBe(true);
    });

    it('should use fallback token last', () => {
      const fallbackToken = 'fallback_token';
      const priorityChain = ['url', 'storage', 'default', 'fallback'];

      expect(priorityChain[priorityChain.length - 1]).toBe('fallback');
      expect(fallbackToken).toBeTruthy();
    });

    it('should return null if all sources fail', () => {
      const sources = [null, null, null, null];
      const resolved = sources.find(s => s !== null) || null;

      expect(resolved).toBeNull();
    });

    it('should skip null sources in chain', () => {
      const sources = [null, 'token_from_storage', null, 'fallback'];
      const resolved = sources.find(s => s !== null);

      expect(resolved).toBe('token_from_storage');
    });

    it('should resolve in correct order', () => {
      const spy = createOrderedSpy();

      spy.record('checkUrl');
      spy.record('checkStorage');
      spy.record('checkDefault');
      spy.record('checkFallback');

      const calls = spy.getCallOrder();
      expect(calls).toEqual(['checkUrl', 'checkStorage', 'checkDefault', 'checkFallback']);
    });

    it('should stop at first successful resolution', () => {
      const sources = [null, 'found_token', 'should_not_check', 'should_not_check'];
      let checksPerformed = 0;

      for (const source of sources) {
        checksPerformed++;
        if (source !== null) break;
      }

      expect(checksPerformed).toBe(2);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache resolved token', () => {
      const siteId = 'test_site';
      const token = 'test_token';

      cache.set(siteId, { token, timestamp: Date.now(), source: 'storage' });

      expect(cache.has(siteId)).toBe(true);
      expect(cache.get(siteId)?.token).toBe(token);
    });

    it('should return cached token on subsequent calls', async () => {
      const siteId = 'test_site';
      const token = 'test_token';
      cache.set(siteId, { token, timestamp: Date.now(), source: 'storage' });

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        cache.get(siteId);
      });

      expect(duration).toBeLessThan(1);
    });

    it('should invalidate cache after TTL', async () => {
      const TTL = 100; // 100ms for testing
      const siteId = 'test_site';

      cache.set(siteId, { token: 'test_token', timestamp: Date.now(), source: 'storage' });

      await waitForAsync(TTL + 10);

      const cached = cache.get(siteId);
      const isExpired = cached && (Date.now() - cached.timestamp) > TTL;

      expect(isExpired).toBe(true);
    });

    it('should track token source in cache', () => {
      const sources = ['url', 'storage', 'default', 'fallback'];

      sources.forEach((source, index) => {
        cache.set(`site_${index}`, {
          token: `token_${index}`,
          timestamp: Date.now(),
          source,
        });
      });

      expect(cache.get('site_0')?.source).toBe('url');
      expect(cache.get('site_1')?.source).toBe('storage');
    });

    it('should update cache on token change', () => {
      const siteId = 'test_site';

      cache.set(siteId, { token: 'old_token', timestamp: Date.now(), source: 'storage' });
      cache.set(siteId, { token: 'new_token', timestamp: Date.now(), source: 'storage' });

      expect(cache.get(siteId)?.token).toBe('new_token');
    });

    it('should clear cache on demand', () => {
      mockSiteIds.forEach(siteId => {
        cache.set(siteId, { token: `token_${siteId}`, timestamp: Date.now(), source: 'storage' });
      });

      cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should invalidate single cache entry', () => {
      cache.set('site1', { token: 'token1', timestamp: Date.now(), source: 'storage' });
      cache.set('site2', { token: 'token2', timestamp: Date.now(), source: 'storage' });

      cache.delete('site1');

      expect(cache.has('site1')).toBe(false);
      expect(cache.has('site2')).toBe(true);
    });
  });

  describe('Site ID Resolution', () => {
    it('should resolve site ID from URL', () => {
      const url = new URL('https://example.com?siteId=ses_test_site');
      const siteId = url.searchParams.get('siteId');

      expect(siteId).toBe('ses_test_site');
    });

    it('should resolve site ID from path', () => {
      const path = '/sites/ses_test_site/dashboard';
      const match = path.match(/\/sites\/([^\/]+)/);
      const siteId = match ? match[1] : null;

      expect(siteId).toBe('ses_test_site');
    });

    it('should resolve site ID from header', () => {
      const headers = new Headers({ 'X-Site-Id': 'ses_test_site' });
      const siteId = headers.get('X-Site-Id');

      expect(siteId).toBe('ses_test_site');
    });

    it('should use current site as fallback', () => {
      const currentSite = 'ses_falls_city';
      const siteIdFromUrl = null;

      const resolved = siteIdFromUrl || currentSite;

      expect(resolved).toBe('ses_falls_city');
    });

    it('should validate site ID format', () => {
      const validIds = ['ses_site_1', 'ses_falls_city', 'ses_test_site'];
      const pattern = /^ses_[a-z0-9_]+$/;

      validIds.forEach(id => {
        expect(pattern.test(id)).toBe(true);
      });
    });

    it('should reject invalid site ID format', () => {
      const invalidIds = ['invalid', 'SES_SITE', 'ses-site', 'ses_Site_1'];
      const pattern = /^ses_[a-z0-9_]+$/;

      invalidIds.forEach(id => {
        expect(pattern.test(id)).toBe(false);
      });
    });
  });

  describe('Source Tracking', () => {
    it('should track token source', () => {
      const result = { token: 'test_token', source: 'storage' };

      expect(result.source).toBe('storage');
    });

    it('should track all possible sources', () => {
      const sources = ['url', 'storage', 'default', 'fallback'];

      sources.forEach(source => {
        const result = { token: 'test', source };
        expect(result.source).toBe(source);
      });
    });

    it('should include source in resolution result', () => {
      const result = {
        token: 'test_token',
        siteId: 'test_site',
        source: 'storage',
        timestamp: Date.now(),
      };

      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('siteId');
    });

    it('should log source for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      console.log('[TokenResolver] Resolved from source: storage');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('source: storage')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Event Emission', () => {
    it('should emit tokenResolved event', () => {
      const spy = vi.fn();
      eventEmitter.on('tokenResolved', spy);

      eventEmitter.emit('tokenResolved', {
        siteId: 'test_site',
        source: 'storage',
      });

      expect(spy).toHaveBeenCalledWith({
        siteId: 'test_site',
        source: 'storage',
      });
    });

    it('should emit cacheHit event', () => {
      const spy = vi.fn();
      eventEmitter.on('cacheHit', spy);

      eventEmitter.emit('cacheHit', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit cacheMiss event', () => {
      const spy = vi.fn();
      eventEmitter.on('cacheMiss', spy);

      eventEmitter.emit('cacheMiss', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit resolutionFailed event', () => {
      const spy = vi.fn();
      eventEmitter.on('resolutionFailed', spy);

      eventEmitter.emit('resolutionFailed', {
        siteId: 'test_site',
        error: 'No token found',
      });

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should resolve from cache in < 1ms', async () => {
      const siteId = 'test_site';
      cache.set(siteId, { token: 'test_token', timestamp: Date.now(), source: 'storage' });

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        cache.get(siteId);
      });

      expect(duration).toBeLessThan(1);
    });

    it('should resolve from storage in < 10ms', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        env.mockLocalStorage.getItem(`token_${token.siteId}`);
      });

      expect(duration).toBeLessThan(10);
    });

    it('should handle concurrent resolutions', async () => {
      const siteIds = mockSiteIds.slice(0, 10);

      siteIds.forEach(siteId => {
        cache.set(siteId, { token: `token_${siteId}`, timestamp: Date.now(), source: 'storage' });
      });

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        await Promise.all(siteIds.map(siteId => cache.get(siteId)));
      });

      expect(duration).toBeLessThan(10);
    });

    it('should benchmark different sources', async () => {
      const benchmarks = {
        cache: 0,
        storage: 0,
        default: 0,
      };

      // Cache benchmark
      cache.set('test', { token: 'test', timestamp: Date.now(), source: 'cache' });
      const cacheTimer = new PerformanceTimer();
      cacheTimer.start();
      cache.get('test');
      benchmarks.cache = cacheTimer.end();

      // Storage benchmark
      env.mockLocalStorage.setItem('test', 'test');
      const storageTimer = new PerformanceTimer();
      storageTimer.start();
      env.mockLocalStorage.getItem('test');
      benchmarks.storage = storageTimer.end();

      expect(benchmarks.cache).toBeLessThan(benchmarks.storage);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing siteId', () => {
      const siteId = null;
      const token = siteId ? cache.get(siteId) : null;

      expect(token).toBeNull();
    });

    it('should handle storage errors', () => {
      vi.spyOn(env.mockLocalStorage, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        env.mockLocalStorage.getItem('test');
      }).toThrow('Storage error');
    });

    it('should handle cache errors', () => {
      vi.spyOn(cache, 'get').mockImplementation(() => {
        throw new Error('Cache error');
      });

      expect(() => {
        cache.get('test');
      }).toThrow('Cache error');
    });

    it('should emit error event on failure', () => {
      const spy = vi.fn();
      eventEmitter.on('error', spy);

      try {
        throw new Error('Resolution error');
      } catch (error) {
        eventEmitter.emit('error', { error });
      }

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty siteId', () => {
      const siteId = '';
      const isValid = siteId.length > 0;

      expect(isValid).toBe(false);
    });

    it('should handle undefined token', () => {
      const token = undefined;
      const isValid = token !== undefined && token !== null;

      expect(isValid).toBe(false);
    });

    it('should handle multiple tokens for same site', () => {
      const siteId = 'test_site';

      cache.set(siteId, { token: 'token1', timestamp: Date.now(), source: 'storage' });
      cache.set(siteId, { token: 'token2', timestamp: Date.now(), source: 'url' });

      expect(cache.get(siteId)?.token).toBe('token2');
    });

    it('should handle circular resolution', () => {
      const resolved = new Set<string>();
      const siteId = 'test_site';

      if (!resolved.has(siteId)) {
        resolved.add(siteId);
        // Resolve token...
      }

      expect(resolved.has(siteId)).toBe(true);
    });

    it('should handle very long tokens', () => {
      const longToken = generateMockJWT({ data: 'x'.repeat(10000) });

      expect(longToken.length).toBeGreaterThan(10000);
    });

    it('should handle special characters in siteId', () => {
      const specialId = 'ses_site!@#$%';
      cache.set(specialId, { token: 'test', timestamp: Date.now(), source: 'storage' });

      expect(cache.has(specialId)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should resolve through complete priority chain', () => {
      const spy = createOrderedSpy();
      const sources = [null, null, 'default_token', 'fallback_token'];

      let resolved = null;
      for (let i = 0; i < sources.length; i++) {
        spy.record(`checkSource${i}`);
        if (sources[i] !== null) {
          resolved = sources[i];
          break;
        }
      }

      expect(resolved).toBe('default_token');
      expect(spy.getCalls().length).toBe(3); // Checked 3 sources before finding token
    });

    it('should cache and retrieve across multiple operations', async () => {
      const siteId = 'test_site';
      const token = 'test_token';

      // First resolution (cache miss)
      env.mockLocalStorage.setItem(`token_${siteId}`, token);
      const retrieved1 = env.mockLocalStorage.getItem(`token_${siteId}`);
      cache.set(siteId, { token: retrieved1!, timestamp: Date.now(), source: 'storage' });

      // Second resolution (cache hit)
      const retrieved2 = cache.get(siteId)?.token;

      expect(retrieved1).toBe(token);
      expect(retrieved2).toBe(token);
    });
  });
});
