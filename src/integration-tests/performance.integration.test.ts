/**
 * Performance Integration Tests
 *
 * Tests performance characteristics of the token management system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiTokenManager } from '../services/token/MultiTokenManager';
import { TokenStorageService } from '../services/token/TokenStorageService';
import { TokenValidator } from '../services/token/TokenValidator';
import { testUtils } from './setup';

describe('Performance Integration', () => {
  let multiTokenManager: MultiTokenManager;
  let tokenStorage: TokenStorageService;

  beforeEach(async () => {
    tokenStorage = new TokenStorageService();
    multiTokenManager = new MultiTokenManager(tokenStorage);
    await tokenStorage.clearAll();
  });

  describe('Token Retrieval Performance', () => {
    it('should handle 1000 token retrievals in < 5 seconds', async () => {
      // Setup: Add 10 tokens
      const tokens = Array.from({ length: 10 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      // Test: Retrieve tokens 1000 times (cycling through sites)
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        const siteId = `site_${i % 10}`;
        await multiTokenManager.getToken(siteId);
      }

      const duration = Date.now() - start;

      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);

      console.log(`1000 retrievals completed in ${duration}ms (${(1000000 / duration).toFixed(0)} ops/sec)`);
    });

    it('should maintain cache hit rate > 95% under load', async () => {
      // Add token
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);
      await multiTokenManager.addToken(siteId, token);

      // Get initial stats
      const initialStats = multiTokenManager.getStatistics();
      const initialHits = initialStats.cacheHits || 0;
      const initialMisses = initialStats.cacheMisses || 0;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await multiTokenManager.getToken(siteId);
      }

      // Calculate hit rate
      const finalStats = multiTokenManager.getStatistics();
      const totalHits = (finalStats.cacheHits || 0) - initialHits;
      const totalMisses = (finalStats.cacheMisses || 0) - initialMisses;
      const hitRate = totalHits / (totalHits + totalMisses);

      expect(hitRate).toBeGreaterThan(0.95);

      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}% (${totalHits}/${totalHits + totalMisses})`);
    });

    it('should cache individual retrievals effectively', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // First retrieval (cache miss)
      const start1 = Date.now();
      await multiTokenManager.getToken(siteId);
      const duration1 = Date.now() - start1;

      // Second retrieval (cache hit)
      const start2 = Date.now();
      await multiTokenManager.getToken(siteId);
      const duration2 = Date.now() - start2;

      // Cache hit should be at least 2x faster
      expect(duration2).toBeLessThan(duration1 / 2);

      console.log(`Cache speedup: ${(duration1 / duration2).toFixed(2)}x (${duration1}ms -> ${duration2}ms)`);
    });
  });

  describe('Batch Operations Performance', () => {
    it('should add 100 tokens in < 3 seconds', async () => {
      const tokens = Array.from({ length: 100 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      const start = Date.now();

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000);

      console.log(`100 token additions completed in ${duration}ms (${(100000 / duration).toFixed(0)} ops/sec)`);
    });

    it('should remove 100 tokens in < 2 seconds', async () => {
      // Setup: Add 100 tokens
      const tokens = Array.from({ length: 100 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      // Test: Remove all tokens
      const start = Date.now();

      await Promise.all(
        tokens.map(({ siteId }) => multiTokenManager.removeToken(siteId))
      );

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);

      console.log(`100 token removals completed in ${duration}ms (${(100000 / duration).toFixed(0)} ops/sec)`);
    });

    it('should list 100 sites in < 100ms', async () => {
      // Setup: Add 100 tokens
      const tokens = Array.from({ length: 100 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      // Test: List all sites
      const start = Date.now();
      const sites = await multiTokenManager.getAllSites();
      const duration = Date.now() - start;

      expect(sites).toHaveLength(100);
      expect(duration).toBeLessThan(100);

      console.log(`Listed ${sites.length} sites in ${duration}ms`);
    });
  });

  describe('Validation Performance', () => {
    it('should validate 1000 tokens in < 1 second', async () => {
      const tokens = Array.from({ length: 1000 }, (_, i) =>
        testUtils.generateValidToken(`site_${i}`)
      );

      const start = Date.now();

      await Promise.all(
        tokens.map(token => TokenValidator.validate(token))
      );

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);

      console.log(`Validated 1000 tokens in ${duration}ms (${(1000000 / duration).toFixed(0)} ops/sec)`);
    });

    it('should efficiently validate mixed valid/invalid tokens', async () => {
      const tokens = Array.from({ length: 500 }, (_, i) => {
        if (i % 3 === 0) return testUtils.generateExpiredToken(`site_${i}`);
        if (i % 3 === 1) return testUtils.generateValidToken(`site_${i}`);
        return 'invalid.token.format';
      });

      const start = Date.now();

      const results = await Promise.all(
        tokens.map(token => TokenValidator.validate(token))
      );

      const duration = Date.now() - start;

      // Verify results
      const validCount = results.filter(r => r.valid).length;
      const expiredCount = results.filter(r => r.expired).length;
      const invalidCount = results.filter(r => !r.valid && !r.expired).length;

      expect(validCount).toBeGreaterThan(0);
      expect(expiredCount).toBeGreaterThan(0);
      expect(invalidCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);

      console.log(`Validated 500 mixed tokens in ${duration}ms (valid: ${validCount}, expired: ${expiredCount}, invalid: ${invalidCount})`);
    });
  });

  describe('Storage Performance', () => {
    it('should handle rapid successive writes', async () => {
      const siteId = 'test_site';

      const start = Date.now();

      // Rapidly update token 100 times
      for (let i = 0; i < 100; i++) {
        const token = testUtils.generateValidToken(`${siteId}_${i}`);
        await multiTokenManager.updateToken(siteId, token);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);

      // Verify final token is correct
      const finalToken = await multiTokenManager.getToken(siteId);
      expect(finalToken).toContain('site_99');

      console.log(`100 successive writes completed in ${duration}ms`);
    });

    it('should handle concurrent writes to different sites', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      const start = Date.now();

      await Promise.all(
        operations.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);

      // Verify all tokens were written correctly
      for (const { siteId, token } of operations) {
        const retrieved = await multiTokenManager.getToken(siteId);
        expect(retrieved).toBe(token);
      }

      console.log(`50 concurrent writes completed in ${duration}ms`);
    });
  });

  describe('Memory Performance', () => {
    it('should maintain reasonable memory usage with many tokens', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Add 1000 tokens
      const tokens = Array.from({ length: 1000 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 10MB)
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for 1000 tokens`);
      }
    });

    it('should clean up memory after token removal', async () => {
      // Add 100 tokens
      const tokens = Array.from({ length: 100 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      const beforeRemoval = (performance as any).memory?.usedJSHeapSize || 0;

      // Remove all tokens
      await Promise.all(
        tokens.map(({ siteId }) => multiTokenManager.removeToken(siteId))
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterRemoval = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory should not increase significantly
      if (beforeRemoval > 0 && afterRemoval > 0) {
        expect(afterRemoval).toBeLessThanOrEqual(beforeRemoval * 1.1);
        console.log(`Memory before: ${(beforeRemoval / 1024 / 1024).toFixed(2)}MB, after: ${(afterRemoval / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  });

  describe('Statistics Tracking', () => {
    it('should track performance metrics accurately', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Make some operations
      for (let i = 0; i < 10; i++) {
        await multiTokenManager.getToken(siteId);
      }

      const stats = multiTokenManager.getStatistics();

      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.cacheHits).toBeGreaterThan(0);

      console.log('Performance stats:', JSON.stringify(stats, null, 2));
    });
  });
});
