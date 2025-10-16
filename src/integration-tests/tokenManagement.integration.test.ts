/**
 * Token Management Integration Tests
 *
 * Tests the complete token management system including:
 * - Full token lifecycle
 * - Multi-site token resolution
 * - Default token fallback
 * - Token expiration handling
 * - Storage layer integration
 * - Axios interceptor integration
 * - Migration integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { MultiTokenManager } from '../services/token/MultiTokenManager';
import { TokenValidator } from '../services/token/TokenValidator';
import { TokenResolver } from '../services/token/TokenResolver';
import { TokenStorageService } from '../services/token/TokenStorageService';
import { TokenService } from '../services/token/TokenService';
import { TokenMigrationService } from '../services/token/TokenMigrationService';
import { testUtils } from './setup';

describe('Token Management Integration', () => {
  let multiTokenManager: MultiTokenManager;
  let tokenResolver: TokenResolver;
  let tokenStorage: TokenStorageService;
  let tokenService: TokenService;
  let migrationService: TokenMigrationService;

  const DEFAULT_SITE_ID = 'ses_falls_city';
  const TEST_USER_ID = 'test-user-123';

  beforeEach(async () => {
    // Initialize services
    tokenStorage = new TokenStorageService();
    multiTokenManager = new MultiTokenManager(tokenStorage);
    tokenResolver = new TokenResolver(multiTokenManager);
    tokenService = new TokenService();
    migrationService = new TokenMigrationService(tokenService, multiTokenManager);

    // Clear all storage
    await tokenStorage.clearAll();
    testUtils.mockFirestore.clear();

    // Reset mock server history
    const mockServer = testUtils.getMockServer();
    (mockServer as any).resetHistory?.();
  });

  describe('Complete Token Lifecycle', () => {
    it('should handle full token lifecycle: add -> validate -> use -> refresh -> remove', async () => {
      const siteId = 'test_site_1';
      const validToken = testUtils.generateValidToken(siteId);

      // 1. Add token
      await multiTokenManager.addToken(siteId, validToken);
      const hasToken = await multiTokenManager.hasToken(siteId);
      expect(hasToken).toBe(true);

      // 2. Validate token
      const validation = await TokenValidator.validate(validToken);
      expect(validation.valid).toBe(true);
      expect(validation.expired).toBe(false);

      // 3. Use token in API call
      const response = await axios.get('/api/sites', {
        headers: { 'X-ACE-Token': validToken },
      });
      expect(response.status).toBe(200);
      expect(response.data.sites).toBeDefined();

      // 4. Refresh token (simulate)
      const newToken = testUtils.generateValidToken(siteId);
      await multiTokenManager.updateToken(siteId, newToken);
      const retrievedToken = await multiTokenManager.getToken(siteId);
      expect(retrievedToken).toBe(newToken);

      // 5. Remove token
      await multiTokenManager.removeToken(siteId);
      const afterRemove = await multiTokenManager.hasToken(siteId);
      expect(afterRemove).toBe(false);
    });

    it('should maintain token across cache invalidation', async () => {
      const siteId = 'test_site_2';
      const token = testUtils.generateValidToken(siteId);

      // Add token
      await multiTokenManager.addToken(siteId, token);

      // Invalidate cache
      multiTokenManager.invalidateCache();

      // Should still retrieve from storage
      const retrievedToken = await multiTokenManager.getToken(siteId);
      expect(retrievedToken).toBe(token);
    });
  });

  describe('Multi-Site Token Resolution', () => {
    it('should resolve correct token for different sites', async () => {
      const site1 = 'test_site_1';
      const site2 = 'test_site_2';
      const token1 = testUtils.generateValidToken(site1);
      const token2 = testUtils.generateValidToken(site2);

      // Add tokens for multiple sites
      await multiTokenManager.addToken(site1, token1);
      await multiTokenManager.addToken(site2, token2);

      // Verify site1 gets token1
      const resolvedToken1 = await tokenResolver.resolveToken(site1);
      expect(resolvedToken1).toBe(token1);

      // Verify site2 gets token2
      const resolvedToken2 = await tokenResolver.resolveToken(site2);
      expect(resolvedToken2).toBe(token2);
    });

    it('should handle site switching correctly', async () => {
      const site1 = 'test_site_1';
      const site2 = 'test_site_2';
      const token1 = testUtils.generateValidToken(site1);
      const token2 = testUtils.generateValidToken(site2);

      await multiTokenManager.addToken(site1, token1);
      await multiTokenManager.addToken(site2, token2);

      // Switch to site1
      multiTokenManager.setCurrentSite(site1);
      let currentToken = await multiTokenManager.getCurrentToken();
      expect(currentToken).toBe(token1);

      // Switch to site2
      multiTokenManager.setCurrentSite(site2);
      currentToken = await multiTokenManager.getCurrentToken();
      expect(currentToken).toBe(token2);
    });

    it('should list all managed sites', async () => {
      await multiTokenManager.addToken('site1', testUtils.generateValidToken('site1'));
      await multiTokenManager.addToken('site2', testUtils.generateValidToken('site2'));
      await multiTokenManager.addToken('site3', testUtils.generateValidToken('site3'));

      const sites = await multiTokenManager.getAllSites();
      expect(sites).toHaveLength(3);
      expect(sites).toContain('site1');
      expect(sites).toContain('site2');
      expect(sites).toContain('site3');
    });
  });

  describe('Default Token Fallback', () => {
    it('should fall back to default token when no site token exists', async () => {
      // Don't add any tokens
      // Should fall back to default token from env
      const token = await tokenResolver.resolveToken('ses_falls_city');
      expect(token).toBe(process.env.VITE_DEFAULT_TOKEN_FALLS_CITY);
    });

    it('should prefer stored token over default', async () => {
      const siteId = 'ses_falls_city';
      const storedToken = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, storedToken);

      const token = await tokenResolver.resolveToken(siteId);
      expect(token).toBe(storedToken);
      expect(token).not.toBe(process.env.VITE_DEFAULT_TOKEN_FALLS_CITY);
    });

    it('should handle all default site IDs', async () => {
      const defaultSites = [
        { id: 'ses_falls_city', env: 'VITE_DEFAULT_TOKEN_FALLS_CITY' },
        { id: 'ses_lincoln', env: 'VITE_DEFAULT_TOKEN_LINCOLN' },
        { id: 'ses_plattsmouth', env: 'VITE_DEFAULT_TOKEN_PLATTSMOUTH' },
      ];

      for (const site of defaultSites) {
        const token = await tokenResolver.resolveToken(site.id);
        expect(token).toBe(process.env[site.env]);
      }
    });
  });

  describe('Token Expiration Handling', () => {
    it('should detect expired tokens', async () => {
      const siteId = 'test_site';
      const expiredToken = testUtils.generateExpiredToken(siteId);

      await multiTokenManager.addToken(siteId, expiredToken);

      const validation = await TokenValidator.validate(expiredToken);
      expect(validation.valid).toBe(false);
      expect(validation.expired).toBe(true);
    });

    it('should reject API calls with expired tokens', async () => {
      const expiredToken = testUtils.generateExpiredToken('test_site');

      try {
        await axios.get('/api/sites', {
          headers: { 'X-ACE-Token': expiredToken },
        });
        expect.fail('Should have thrown 401 error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toContain('expired');
      }
    });

    it('should handle tokens about to expire', async () => {
      const siteId = 'test_site';
      const now = Math.floor(Date.now() / 1000);

      // Token expires in 2 minutes
      const almostExpiredPayload = {
        sub: siteId,
        iat: now - 3480,
        exp: now + 120,
      };
      const almostExpiredToken = `header.${btoa(JSON.stringify(almostExpiredPayload))}.signature`;

      const validation = await TokenValidator.validate(almostExpiredToken);
      expect(validation.valid).toBe(true);
      expect(validation.expiresIn).toBeLessThan(200);
      expect(validation.expiresIn).toBeGreaterThan(100);
    });
  });

  describe('Storage Layer Integration', () => {
    it('should persist tokens across sessions', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      // Add token
      await multiTokenManager.addToken(siteId, token);

      // Create new manager instance (simulates new session)
      const newManager = new MultiTokenManager(tokenStorage);

      // Should load from storage
      const retrievedToken = await newManager.getToken(siteId);
      expect(retrievedToken).toBe(token);
    });

    it('should handle IndexedDB unavailability gracefully', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      // Mock IndexedDB failure
      const originalOpen = indexedDB.open;
      indexedDB.open = vi.fn(() => {
        throw new Error('IndexedDB not available');
      });

      try {
        // Should fall back to localStorage
        const storage = new TokenStorageService();
        await storage.setToken(siteId, token);
        const retrieved = await storage.getToken(siteId);

        expect(retrieved).toBe(token);
      } finally {
        indexedDB.open = originalOpen;
      }
    });

    it('should handle concurrent storage operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      // Add all tokens concurrently
      await Promise.all(
        operations.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      // Verify all tokens were stored
      for (const { siteId, token } of operations) {
        const retrieved = await multiTokenManager.getToken(siteId);
        expect(retrieved).toBe(token);
      }
    });

    it('should clear all tokens', async () => {
      // Add multiple tokens
      await multiTokenManager.addToken('site1', testUtils.generateValidToken('site1'));
      await multiTokenManager.addToken('site2', testUtils.generateValidToken('site2'));
      await multiTokenManager.addToken('site3', testUtils.generateValidToken('site3'));

      // Clear all
      await tokenStorage.clearAll();

      // Verify all cleared
      const sites = await multiTokenManager.getAllSites();
      expect(sites).toHaveLength(0);
    });
  });

  describe('Axios Interceptor Integration', () => {
    it('should automatically inject tokens from URL path', async () => {
      const siteId = 'site1';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Make API call with site in URL
      await axios.get(`/api/sites/${siteId}/points`);

      // Verify token was injected
      const history = (testUtils.getMockServer() as any).getRequestHistory();
      const lastRequest = history[history.length - 1];
      expect(lastRequest.headers['X-ACE-Token']).toBe(token);
    });

    it('should extract site ID from query params', async () => {
      const siteId = 'site1';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Make API call with siteId in query
      await axios.get(`/api/data?siteId=${siteId}`);

      const history = (testUtils.getMockServer() as any).getRequestHistory();
      const lastRequest = history[history.length - 1];
      expect(lastRequest.headers['X-ACE-Token']).toBe(token);
    });

    it('should extract site ID from request body', async () => {
      const siteId = 'site1';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Make API call with siteId in body
      await axios.post('/api/data', { siteId });

      const history = (testUtils.getMockServer() as any).getRequestHistory();
      const lastRequest = history[history.length - 1];
      expect(lastRequest.headers['X-ACE-Token']).toBe(token);
    });

    it('should not override manually set tokens', async () => {
      const siteId = 'site1';
      const autoToken = testUtils.generateValidToken(siteId);
      const manualToken = testUtils.generateValidToken('manual');

      await multiTokenManager.addToken(siteId, autoToken);

      // Make API call with manual token
      await axios.get(`/api/sites/${siteId}/points`, {
        headers: { 'X-ACE-Token': manualToken },
      });

      const history = (testUtils.getMockServer() as any).getRequestHistory();
      const lastRequest = history[history.length - 1];
      expect(lastRequest.headers['X-ACE-Token']).toBe(manualToken);
    });
  });

  describe('Migration Integration', () => {
    it('should migrate legacy token to new system', async () => {
      const legacyToken = testUtils.generateValidToken(DEFAULT_SITE_ID);

      // Store token in old format (Firestore)
      await testUtils.mockFirestore.setDoc(TEST_USER_ID, {
        aceJwt: legacyToken,
        aceJwtIsEncrypted: false,
      });

      // Run migration
      await migrationService.migrateUser(TEST_USER_ID);

      // Verify token is in new system
      const token = await multiTokenManager.getToken(DEFAULT_SITE_ID);
      expect(token).toBe(legacyToken);

      // Verify migration metadata
      const status = await migrationService.checkMigrationStatus(TEST_USER_ID);
      expect(status.migrated).toBe(true);
      expect(status.migratedAt).toBeDefined();
    });

    it('should not re-migrate already migrated users', async () => {
      const token = testUtils.generateValidToken(DEFAULT_SITE_ID);

      await testUtils.mockFirestore.setDoc(TEST_USER_ID, {
        aceJwt: token,
        aceJwtIsEncrypted: false,
        tokenMigrationComplete: true,
        tokenMigratedAt: Date.now(),
      });

      const beforeMigration = await testUtils.mockFirestore.getDoc(TEST_USER_ID);
      const originalTimestamp = beforeMigration?.tokenMigratedAt;

      // Attempt migration again
      await migrationService.migrateUser(TEST_USER_ID);

      // Timestamp should not change
      const afterMigration = await testUtils.mockFirestore.getDoc(TEST_USER_ID);
      expect(afterMigration?.tokenMigratedAt).toBe(originalTimestamp);
    });

    it('should handle missing legacy tokens gracefully', async () => {
      // User has no token
      await testUtils.mockFirestore.setDoc(TEST_USER_ID, {
        email: 'test@example.com',
      });

      // Migration should complete without error
      await expect(migrationService.migrateUser(TEST_USER_ID)).resolves.not.toThrow();

      // Should be marked as migrated
      const status = await migrationService.checkMigrationStatus(TEST_USER_ID);
      expect(status.migrated).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from storage failures', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      // Force storage failure
      const originalSet = tokenStorage.setToken;
      tokenStorage.setToken = vi.fn().mockRejectedValue(new Error('Storage full'));

      try {
        await multiTokenManager.addToken(siteId, token);
        expect.fail('Should have thrown storage error');
      } catch (error: any) {
        expect(error.message).toContain('Storage full');
      }

      // Restore storage
      tokenStorage.setToken = originalSet;

      // Should work now
      await multiTokenManager.addToken(siteId, token);
      const retrieved = await multiTokenManager.getToken(siteId);
      expect(retrieved).toBe(token);
    });

    it('should handle malformed tokens gracefully', async () => {
      const malformedTokens = [
        'not.a.valid.jwt',
        'invalid',
        '',
        'header.invalid-base64.signature',
      ];

      for (const token of malformedTokens) {
        const validation = await TokenValidator.validate(token);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should cache tokens for fast retrieval', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // First retrieval (from storage)
      const start1 = Date.now();
      await multiTokenManager.getToken(siteId);
      const duration1 = Date.now() - start1;

      // Second retrieval (from cache)
      const start2 = Date.now();
      await multiTokenManager.getToken(siteId);
      const duration2 = Date.now() - start2;

      // Cache should be significantly faster
      expect(duration2).toBeLessThan(duration1);
    });

    it('should handle batch operations efficiently', async () => {
      const tokens = Array.from({ length: 100 }, (_, i) => ({
        siteId: `site_${i}`,
        token: testUtils.generateValidToken(`site_${i}`),
      }));

      const start = Date.now();

      // Add all tokens
      await Promise.all(
        tokens.map(({ siteId, token }) =>
          multiTokenManager.addToken(siteId, token)
        )
      );

      const duration = Date.now() - start;

      // Should complete in reasonable time (< 2 seconds)
      expect(duration).toBeLessThan(2000);
    });
  });
});
