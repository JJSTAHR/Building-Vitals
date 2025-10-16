/**
 * TokenResolver Unit Tests
 *
 * Comprehensive test suite for TokenResolver service including:
 * - 4-level priority chain
 * - Cache behavior and TTL
 * - Performance benchmarks
 * - Event emission
 * - Error handling
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenResolver, resetTokenResolver } from './tokenResolver';
import type { ITokenProvider, TokenSource, TokenMissingEvent } from '../types/token.types';

// Mock default tokens
vi.mock('../config/defaultTokens', () => ({
  getDefaultToken: vi.fn((siteId: string) => {
    const defaults: Record<string, string> = {
      'ses_falls_city': 'default_token_falls_city',
      'ses_site_2': 'default_token_site_2',
    };
    return defaults[siteId] || null;
  }),
}));

describe('TokenResolver', () => {
  let resolver: TokenResolver;
  let mockProvider: ITokenProvider;

  beforeEach(() => {
    // Reset global resolver
    resetTokenResolver();

    // Create mock token provider
    mockProvider = {
      getToken: vi.fn(async (siteId: string) => {
        // Simulate user-configured tokens
        const tokens: Record<string, string> = {
          'user_site': 'user_specific_token',
          '__global__': 'global_legacy_token',
        };
        return tokens[siteId] || null;
      }),
    };

    // Create resolver with debug enabled
    resolver = new TokenResolver({ debug: false, trackMetrics: true });
    resolver.setTokenProvider(mockProvider);
  });

  afterEach(() => {
    resolver.invalidateCache();
    resolver.removeAllListeners();
  });

  describe('Priority Chain Resolution', () => {
    it('should resolve site-specific token (priority 1)', async () => {
      const token = await resolver.resolveToken('user_site');
      expect(token).toBe('user_specific_token');
      expect(mockProvider.getToken).toHaveBeenCalledWith('user_site');
    });

    it('should fall back to default token (priority 2)', async () => {
      const token = await resolver.resolveToken('ses_falls_city');
      expect(token).toBe('default_token_falls_city');
    });

    it('should fall back to global token (priority 3)', async () => {
      const token = await resolver.resolveToken('unknown_site');
      expect(token).toBe('global_legacy_token');
      expect(mockProvider.getToken).toHaveBeenCalledWith('__global__');
    });

    it('should return null when no token found (priority 4)', async () => {
      // Mock provider with no global token
      mockProvider.getToken = vi.fn(async () => null);
      resolver.setTokenProvider(mockProvider);

      const token = await resolver.resolveToken('nonexistent_site');
      expect(token).toBeNull();
    });

    it('should emit tokenMissing event when no token found', async () => {
      mockProvider.getToken = vi.fn(async () => null);
      resolver.setTokenProvider(mockProvider);

      const missingHandler = vi.fn();
      resolver.on('tokenMissing', missingHandler);

      await resolver.resolveToken('missing_site');

      expect(missingHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'missing_site',
          timestamp: expect.any(Number),
          sourcesChecked: expect.any(Array),
        })
      );
    });
  });

  describe('Caching Behavior', () => {
    it('should cache resolved tokens', async () => {
      // First call - should hit provider
      const token1 = await resolver.resolveToken('user_site');
      expect(token1).toBe('user_specific_token');

      // Second call - should use cache
      const token2 = await resolver.resolveToken('user_site');
      expect(token2).toBe('user_specific_token');

      // Provider should only be called once
      expect(mockProvider.getToken).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      // Create resolver with 100ms TTL
      const shortResolver = new TokenResolver({ cacheTtl: 100, trackMetrics: true });
      shortResolver.setTokenProvider(mockProvider);

      // First call
      await shortResolver.resolveToken('user_site');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call - should hit provider again
      await shortResolver.resolveToken('user_site');

      expect(mockProvider.getToken).toHaveBeenCalledTimes(2);
    });

    it('should track cache hits and misses', async () => {
      // First call - cache miss
      await resolver.resolveToken('user_site');

      // Second call - cache hit
      await resolver.resolveToken('user_site');

      const stats = resolver.getCacheStatistics();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should invalidate specific cache entry', async () => {
      await resolver.resolveToken('user_site');
      resolver.invalidateCache('user_site');

      // Next call should hit provider again
      await resolver.resolveToken('user_site');
      expect(mockProvider.getToken).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache entries', async () => {
      await resolver.resolveToken('user_site');
      await resolver.resolveToken('ses_falls_city');

      resolver.invalidateCache();

      const stats = resolver.getCacheStatistics();
      expect(stats.size).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should resolve from cache in under 5ms', async () => {
      // Populate cache
      await resolver.resolveToken('user_site');

      // Measure cached resolution
      const start = performance.now();
      await resolver.resolveToken('user_site');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5);
    });

    it('should resolve from provider in under 10ms', async () => {
      const start = performance.now();
      await resolver.resolveToken('user_site');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should achieve >90% cache hit rate with warm cache', async () => {
      const siteId = 'user_site';

      // First call - cache miss
      await resolver.resolveToken(siteId);

      // 9 more calls - all cache hits
      for (let i = 0; i < 9; i++) {
        await resolver.resolveToken(siteId);
      }

      const stats = resolver.getCacheStatistics();
      expect(stats.hitRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Warm Cache', () => {
    it('should preload tokens for multiple sites', async () => {
      const siteIds = ['user_site', 'ses_falls_city', 'ses_site_2'];

      await resolver.warmCache(siteIds);

      const stats = resolver.getCacheStatistics();
      expect(stats.size).toBe(3);

      // All subsequent calls should hit cache
      await resolver.resolveToken('user_site');
      await resolver.resolveToken('ses_falls_city');

      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Resolution Details', () => {
    it('should provide detailed resolution result', async () => {
      const result = await resolver.resolveTokenWithDetails('user_site');

      expect(result).toMatchObject({
        token: 'user_specific_token',
        source: 'site_specific',
        fromCache: false,
        resolutionTimeMs: expect.any(Number),
      });
    });

    it('should indicate cache hit in detailed result', async () => {
      // Populate cache
      await resolver.resolveToken('user_site');

      // Get detailed result
      const result = await resolver.resolveTokenWithDetails('user_site');

      expect(result.fromCache).toBe(true);
    });
  });

  describe('Source Tracking', () => {
    it('should track site-specific source', async () => {
      await resolver.resolveToken('user_site');
      const source = resolver.getResolutionSource('user_site');
      expect(source).toBe('site_specific');
    });

    it('should track default source', async () => {
      await resolver.resolveToken('ses_falls_city');
      const source = resolver.getResolutionSource('ses_falls_city');
      expect(source).toBe('default');
    });

    it('should track global source', async () => {
      await resolver.resolveToken('unknown_site');
      const source = resolver.getResolutionSource('unknown_site');
      expect(source).toBe('global');
    });

    it('should return null for uncached site', () => {
      const source = resolver.getResolutionSource('uncached_site');
      expect(source).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      mockProvider.getToken = vi.fn(async () => {
        throw new Error('Provider error');
      });
      resolver.setTokenProvider(mockProvider);

      const token = await resolver.resolveToken('error_site');

      // Should fall back to default
      expect(token).toBe(null);
    });

    it('should continue chain after provider error', async () => {
      mockProvider.getToken = vi.fn(async (siteId) => {
        if (siteId === '__global__') {
          return 'global_token';
        }
        throw new Error('Provider error');
      });
      resolver.setTokenProvider(mockProvider);

      const token = await resolver.resolveToken('error_site');
      expect(token).toBe('global_token');
    });
  });

  describe('Statistics', () => {
    it('should track cache evictions', async () => {
      await resolver.resolveToken('user_site');
      resolver.invalidateCache('user_site');

      const stats = resolver.getCacheStatistics();
      expect(stats.evictions).toBe(1);
    });

    it('should reset statistics', async () => {
      await resolver.resolveToken('user_site');
      await resolver.resolveToken('user_site');

      resolver.resetStatistics();

      const stats = resolver.getCacheStatistics();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should accept custom cache TTL', () => {
      const customResolver = new TokenResolver({ cacheTtl: 10000 });
      expect(customResolver).toBeDefined();
    });

    it('should support debug mode', () => {
      const debugResolver = new TokenResolver({ debug: true });
      expect(debugResolver).toBeDefined();
    });

    it('should support custom logger', () => {
      const mockLogger = vi.fn();
      const loggerResolver = new TokenResolver({ logger: mockLogger });
      loggerResolver.setTokenProvider(mockProvider);
      expect(loggerResolver).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide global instance', async () => {
      const { getTokenResolver } = await import('./tokenResolver');
      const instance1 = getTokenResolver();
      const instance2 = getTokenResolver();

      expect(instance1).toBe(instance2);
    });

    it('should reset global instance', async () => {
      const { getTokenResolver, resetTokenResolver } = await import('./tokenResolver');
      const instance1 = getTokenResolver();

      resetTokenResolver();

      const instance2 = getTokenResolver();
      expect(instance1).not.toBe(instance2);
    });
  });
});
