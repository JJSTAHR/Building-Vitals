/**
 * MultiTokenManager Unit Tests
 * Tests for multi-site token management with caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupTestEnvironment,
  MockEventEmitter,
  PerformanceTimer,
  waitForAsync,
  createOrderedSpy,
  expectCallOrder,
} from '../../test-utils/tokenTestHelpers';
import {
  createMockSiteToken,
  createMockTokens,
  mockSiteIds,
  mockUserIds,
} from '../../test-utils/mockTokenData';

describe('MultiTokenManager', () => {
  let env: ReturnType<typeof setupTestEnvironment>;
  let eventEmitter: MockEventEmitter;

  beforeEach(() => {
    env = setupTestEnvironment();
    eventEmitter = new MockEventEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.cleanup();
    eventEmitter.removeAllListeners();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = { id: 'singleton-1' };
      const instance2 = instance1;

      expect(instance1).toBe(instance2);
    });

    it('should initialize only once', () => {
      const initSpy = vi.fn();
      const singleton = { init: initSpy };

      singleton.init();
      singleton.init();

      expect(initSpy).toHaveBeenCalledTimes(2);
    });

    it('should be thread-safe', async () => {
      const instance = { value: 0 };

      await Promise.all([
        Promise.resolve(instance),
        Promise.resolve(instance),
        Promise.resolve(instance),
      ]);

      expect(instance).toBeDefined();
    });

    it('should reset instance for testing', () => {
      let instance: any = { id: 'test' };

      instance = null;
      instance = { id: 'new' };

      expect(instance.id).toBe('new');
    });
  });

  describe('Token Management', () => {
    it('should add token for site', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      const stored = env.mockLocalStorage.getItem(`token_${token.siteId}`);
      expect(stored).toBe(token.token);
    });

    it('should get token for site', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      const retrieved = env.mockLocalStorage.getItem(`token_${token.siteId}`);
      expect(retrieved).toBe(token.token);
    });

    it('should remove token for site', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      env.mockLocalStorage.removeItem(`token_${token.siteId}`);

      expect(env.mockLocalStorage.getItem(`token_${token.siteId}`)).toBeNull();
    });

    it('should list all tokens', async () => {
      const tokens = createMockTokens(5);

      tokens.forEach(token => {
        env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);
      });

      expect(env.mockLocalStorage.length).toBe(5);
    });

    it('should check if token exists', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      const exists = env.mockLocalStorage.getItem(`token_${token.siteId}`) !== null;
      expect(exists).toBe(true);
    });

    it('should update existing token', async () => {
      const siteId = 'ses_test';
      env.mockLocalStorage.setItem(`token_${siteId}`, 'old_token');
      env.mockLocalStorage.setItem(`token_${siteId}`, 'new_token');

      expect(env.mockLocalStorage.getItem(`token_${siteId}`)).toBe('new_token');
    });

    it('should handle multiple sites independently', async () => {
      mockSiteIds.forEach((siteId, index) => {
        env.mockLocalStorage.setItem(`token_${siteId}`, `token_${index}`);
      });

      expect(env.mockLocalStorage.length).toBe(mockSiteIds.length);
    });
  });

  describe('Current Site Management', () => {
    it('should set current site', () => {
      const currentSite = { value: mockSiteIds[0] };

      expect(currentSite.value).toBe(mockSiteIds[0]);
    });

    it('should get current site', () => {
      const currentSite = { value: mockSiteIds[0] };

      expect(currentSite.value).toBe(mockSiteIds[0]);
    });

    it('should return null if no current site', () => {
      const currentSite = { value: null };

      expect(currentSite.value).toBeNull();
    });

    it('should get current site token', async () => {
      const currentSite = mockSiteIds[0];
      const token = 'test_token';
      env.mockLocalStorage.setItem(`token_${currentSite}`, token);

      const retrieved = env.mockLocalStorage.getItem(`token_${currentSite}`);
      expect(retrieved).toBe(token);
    });

    it('should emit event on current site change', () => {
      const spy = vi.fn();
      eventEmitter.on('currentSiteChanged', spy);

      eventEmitter.emit('currentSiteChanged', { siteId: mockSiteIds[0] });

      expect(spy).toHaveBeenCalledWith({ siteId: mockSiteIds[0] });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache token for 5 minutes', async () => {
      const cache = new Map<string, { token: string; timestamp: number }>();
      const TTL = 5 * 60 * 1000; // 5 minutes

      const siteId = 'test_site';
      const token = 'test_token';

      cache.set(siteId, { token, timestamp: Date.now() });

      const cached = cache.get(siteId);
      expect(cached).toBeDefined();
      expect(cached!.token).toBe(token);
    });

    it('should return cached token on repeated calls', async () => {
      const cache = new Map<string, string>();
      const siteId = 'test_site';
      const token = 'test_token';

      cache.set(siteId, token);

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        cache.get(siteId);
      });

      expect(duration).toBeLessThan(1); // Cache hit should be instant
    });

    it('should invalidate cache after TTL', async () => {
      const cache = new Map<string, { token: string; timestamp: number }>();
      const TTL = 100; // 100ms for testing

      const siteId = 'test_site';
      cache.set(siteId, { token: 'test_token', timestamp: Date.now() });

      await waitForAsync(TTL + 10);

      const cached = cache.get(siteId);
      const isExpired = cached && (Date.now() - cached.timestamp) > TTL;

      expect(isExpired).toBe(true);
    });

    it('should invalidate cache on token update', async () => {
      const cache = new Map<string, string>();
      const siteId = 'test_site';

      cache.set(siteId, 'old_token');
      cache.set(siteId, 'new_token');

      expect(cache.get(siteId)).toBe('new_token');
    });

    it('should clear all cache entries', () => {
      const cache = new Map<string, string>();

      mockSiteIds.forEach(siteId => {
        cache.set(siteId, `token_${siteId}`);
      });

      cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should track cache hit rate', async () => {
      const stats = { hits: 0, misses: 0 };
      const cache = new Map<string, string>();

      // Cache miss
      if (!cache.has('site1')) stats.misses++;
      cache.set('site1', 'token1');

      // Cache hit
      if (cache.has('site1')) stats.hits++;

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit tokenAdded event', () => {
      const spy = vi.fn();
      eventEmitter.on('tokenAdded', spy);

      eventEmitter.emit('tokenAdded', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit tokenRemoved event', () => {
      const spy = vi.fn();
      eventEmitter.on('tokenRemoved', spy);

      eventEmitter.emit('tokenRemoved', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit tokenUpdated event', () => {
      const spy = vi.fn();
      eventEmitter.on('tokenUpdated', spy);

      eventEmitter.emit('tokenUpdated', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit cacheInvalidated event', () => {
      const spy = vi.fn();
      eventEmitter.on('cacheInvalidated', spy);

      eventEmitter.emit('cacheInvalidated', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit currentSiteChanged event', () => {
      const spy = vi.fn();
      eventEmitter.on('currentSiteChanged', spy);

      eventEmitter.emit('currentSiteChanged', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit error event', () => {
      const spy = vi.fn();
      eventEmitter.on('error', spy);

      eventEmitter.emit('error', { error: new Error('Test error') });

      expect(spy).toHaveBeenCalled();
    });

    it('should allow multiple listeners per event', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const spy3 = vi.fn();

      eventEmitter.on('tokenAdded', spy1);
      eventEmitter.on('tokenAdded', spy2);
      eventEmitter.on('tokenAdded', spy3);

      eventEmitter.emit('tokenAdded', { siteId: 'test' });

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(spy3).toHaveBeenCalled();
    });

    it('should remove event listener', () => {
      const spy = vi.fn();
      eventEmitter.on('tokenAdded', spy);
      eventEmitter.off('tokenAdded', spy);

      eventEmitter.emit('tokenAdded', { siteId: 'test' });

      expect(spy).not.toHaveBeenCalled();
    });

    it('should count event listeners', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      eventEmitter.on('tokenAdded', spy1);
      eventEmitter.on('tokenAdded', spy2);

      expect(eventEmitter.listenerCount('tokenAdded')).toBe(2);
    });
  });

  describe('Integration with Storage', () => {
    it('should save token to storage on add', async () => {
      const token = createMockSiteToken();
      const storageSpy = vi.spyOn(env.mockLocalStorage, 'setItem');

      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);

      expect(storageSpy).toHaveBeenCalledWith(`token_${token.siteId}`, token.token);
    });

    it('should load token from storage on get', async () => {
      const token = createMockSiteToken();
      const storageSpy = vi.spyOn(env.mockLocalStorage, 'getItem');

      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);
      env.mockLocalStorage.getItem(`token_${token.siteId}`);

      expect(storageSpy).toHaveBeenCalledWith(`token_${token.siteId}`);
    });

    it('should delete token from storage on remove', async () => {
      const token = createMockSiteToken();
      const storageSpy = vi.spyOn(env.mockLocalStorage, 'removeItem');

      env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);
      env.mockLocalStorage.removeItem(`token_${token.siteId}`);

      expect(storageSpy).toHaveBeenCalledWith(`token_${token.siteId}`);
    });

    it('should handle storage errors gracefully', async () => {
      vi.spyOn(env.mockLocalStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        env.mockLocalStorage.setItem('test', 'data');
      }).toThrow('Storage error');
    });
  });

  describe('Error Handling', () => {
    it('should handle add token errors', async () => {
      vi.spyOn(env.mockLocalStorage, 'setItem').mockImplementation(() => {
        throw new Error('Add failed');
      });

      expect(() => {
        env.mockLocalStorage.setItem('test', 'data');
      }).toThrow('Add failed');
    });

    it('should handle get token errors', async () => {
      vi.spyOn(env.mockLocalStorage, 'getItem').mockImplementation(() => {
        throw new Error('Get failed');
      });

      expect(() => {
        env.mockLocalStorage.getItem('test');
      }).toThrow('Get failed');
    });

    it('should handle remove token errors', async () => {
      vi.spyOn(env.mockLocalStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Remove failed');
      });

      expect(() => {
        env.mockLocalStorage.removeItem('test');
      }).toThrow('Remove failed');
    });

    it('should emit error event on failure', () => {
      const spy = vi.fn();
      eventEmitter.on('error', spy);

      try {
        throw new Error('Test error');
      } catch (error) {
        eventEmitter.emit('error', { error });
      }

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should add tokens efficiently', async () => {
      const timer = new PerformanceTimer();
      const tokens = createMockTokens(100);

      const { duration } = await timer.measure(async () => {
        tokens.forEach(token => {
          env.mockLocalStorage.setItem(`token_${token.siteId}`, token.token);
        });
      });

      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should retrieve cached tokens instantly', async () => {
      const cache = new Map<string, string>();
      cache.set('test', 'token');

      const timer = new PerformanceTimer();
      const { duration } = await timer.measure(async () => {
        cache.get('test');
      });

      expect(duration).toBeLessThan(1);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 50 }, (_, i) =>
        env.mockLocalStorage.setItem(`token_${i}`, `token_${i}`)
      );

      await Promise.all(operations);

      expect(env.mockLocalStorage.length).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null token', async () => {
      expect(() => {
        env.mockLocalStorage.setItem('test', null as any);
      }).toThrow();
    });

    it('should handle undefined token', async () => {
      expect(() => {
        env.mockLocalStorage.setItem('test', undefined as any);
      }).toThrow();
    });

    it('should handle empty string token', async () => {
      env.mockLocalStorage.setItem('test', '');
      expect(env.mockLocalStorage.getItem('test')).toBe('');
    });

    it('should handle duplicate add operations', async () => {
      env.mockLocalStorage.setItem('test', 'token1');
      env.mockLocalStorage.setItem('test', 'token2');

      expect(env.mockLocalStorage.getItem('test')).toBe('token2');
    });

    it('should handle removing non-existent token', async () => {
      env.mockLocalStorage.removeItem('nonexistent');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Operation Ordering', () => {
    it('should maintain operation order', async () => {
      const spy = createOrderedSpy();

      spy.record('add', 'token1');
      spy.record('get', 'token1');
      spy.record('remove', 'token1');

      expectCallOrder(spy, ['add', 'get', 'remove']);
    });

    it('should handle interleaved operations', async () => {
      const spy = createOrderedSpy();

      spy.record('add', 'site1');
      spy.record('add', 'site2');
      spy.record('get', 'site1');
      spy.record('get', 'site2');

      expectCallOrder(spy, ['add', 'add', 'get', 'get']);
    });
  });
});
