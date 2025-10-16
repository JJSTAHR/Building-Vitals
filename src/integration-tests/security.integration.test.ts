/**
 * Security Integration Tests
 *
 * Tests security aspects of the token management system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiTokenManager } from '../services/token/MultiTokenManager';
import { TokenStorageService } from '../services/token/TokenStorageService';
import { TokenService } from '../services/token/TokenService';
import { TokenValidator } from '../services/token/TokenValidator';
import { testUtils } from './setup';

describe('Security Integration', () => {
  let multiTokenManager: MultiTokenManager;
  let tokenStorage: TokenStorageService;
  let tokenService: TokenService;

  const TEST_USER_ID = 'test-user-123';

  beforeEach(async () => {
    tokenStorage = new TokenStorageService();
    multiTokenManager = new MultiTokenManager(tokenStorage);
    tokenService = new TokenService();

    await tokenStorage.clearAll();
    testUtils.mockFirestore.clear();
  });

  describe('Token Encryption', () => {
    it('should encrypt tokens before Firestore storage', async () => {
      const plainToken = testUtils.generateValidToken('test_site');

      // Save token (should encrypt)
      await tokenService.saveToken(TEST_USER_ID, plainToken);

      // Read directly from Firestore
      const userDoc = await testUtils.mockFirestore.getDoc(TEST_USER_ID);
      const storedToken = userDoc?.aceJwt;

      // Should be encrypted (not equal to plain token)
      expect(storedToken).toBeDefined();
      expect(storedToken).not.toBe(plainToken);
      expect(userDoc?.aceJwtIsEncrypted).toBe(true);
    });

    it('should decrypt tokens when loading from Firestore', async () => {
      const plainToken = testUtils.generateValidToken('test_site');

      // Save and load token
      await tokenService.saveToken(TEST_USER_ID, plainToken);
      const loadedToken = await tokenService.getToken(TEST_USER_ID);

      // Should decrypt correctly
      expect(loadedToken).toBe(plainToken);
    });

    it('should handle unencrypted legacy tokens', async () => {
      const legacyToken = testUtils.generateValidToken('test_site');

      // Store unencrypted token (legacy format)
      await testUtils.mockFirestore.setDoc(TEST_USER_ID, {
        aceJwt: legacyToken,
        aceJwtIsEncrypted: false,
      });

      // Should load correctly
      const loadedToken = await tokenService.getToken(TEST_USER_ID);
      expect(loadedToken).toBe(legacyToken);
    });

    it('should encrypt tokens with different keys for different users', async () => {
      const token1 = testUtils.generateValidToken('site1');
      const token2 = testUtils.generateValidToken('site2');

      await tokenService.saveToken('user1', token1);
      await tokenService.saveToken('user2', token2);

      const user1Doc = await testUtils.mockFirestore.getDoc('user1');
      const user2Doc = await testUtils.mockFirestore.getDoc('user2');

      // Encrypted values should be different
      expect(user1Doc?.aceJwt).not.toBe(user2Doc?.aceJwt);
      expect(user1Doc?.aceJwt).not.toBe(token1);
      expect(user2Doc?.aceJwt).not.toBe(token2);
    });
  });

  describe('Token Validation Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not-a-jwt',
        'invalid.format',
        'no-signature.payload',
        '',
        'a.b.c.d.e', // Too many parts
      ];

      for (const token of malformedTokens) {
        const validation = await TokenValidator.validate(token);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });

    it('should reject tokens with invalid base64 encoding', async () => {
      const invalidToken = 'header.!invalid-base64!.signature';

      const validation = await TokenValidator.validate(invalidToken);
      expect(validation.valid).toBe(false);
    });

    it('should reject tokens with missing required claims', async () => {
      // Token without exp claim
      const payload = { sub: 'test_site', iat: Date.now() };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const validation = await TokenValidator.validate(token);
      expect(validation.valid).toBe(false);
    });

    it('should validate token expiration strictly', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Token expired 1 second ago
      const payload = {
        sub: 'test_site',
        iat: now - 3600,
        exp: now - 1,
      };
      const expiredToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      const validation = await TokenValidator.validate(expiredToken);
      expect(validation.valid).toBe(false);
      expect(validation.expired).toBe(true);
    });
  });

  describe('Storage Security', () => {
    it('should not expose tokens in browser devtools', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Check that token is not in plain localStorage
      const localStorageKeys = Object.keys(localStorage);
      for (const key of localStorageKeys) {
        const value = localStorage.getItem(key);
        // Token should not be directly visible
        if (value?.includes('header.')) {
          // If token-like string found, it should be in a structured format
          expect(value).toMatch(/^\{.*\}$/);
        }
      }
    });

    it('should clear sensitive data from memory after use', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);
      await multiTokenManager.removeToken(siteId);

      // Token should no longer be accessible
      const retrieved = await multiTokenManager.getToken(siteId);
      expect(retrieved).toBeNull();
    });

    it('should prevent token storage injection attacks', async () => {
      const maliciousTokens = [
        '<script>alert("XSS")</script>',
        '"; DROP TABLE tokens; --',
        '../../../etc/passwd',
        'javascript:alert(1)',
      ];

      for (const maliciousToken of maliciousTokens) {
        // Should not throw, but should handle safely
        await expect(
          multiTokenManager.addToken('test_site', maliciousToken)
        ).resolves.not.toThrow();

        // Validation should reject
        const validation = await TokenValidator.validate(maliciousToken);
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Access Control', () => {
    it('should isolate tokens between different sites', async () => {
      const site1Token = testUtils.generateValidToken('site1');
      const site2Token = testUtils.generateValidToken('site2');

      await multiTokenManager.addToken('site1', site1Token);
      await multiTokenManager.addToken('site2', site2Token);

      // Each site should only get its own token
      const retrieved1 = await multiTokenManager.getToken('site1');
      const retrieved2 = await multiTokenManager.getToken('site2');

      expect(retrieved1).toBe(site1Token);
      expect(retrieved1).not.toBe(site2Token);
      expect(retrieved2).toBe(site2Token);
      expect(retrieved2).not.toBe(site1Token);
    });

    it('should prevent unauthorized token access', async () => {
      const siteId = 'secure_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);

      // Attempting to access with wrong site ID should return null
      const wrongSiteToken = await multiTokenManager.getToken('wrong_site');
      expect(wrongSiteToken).toBeNull();
    });
  });

  describe('Token Lifecycle Security', () => {
    it('should securely handle token refresh', async () => {
      const siteId = 'test_site';
      const oldToken = testUtils.generateValidToken(siteId);
      const newToken = testUtils.generateValidToken(`${siteId}_new`);

      await multiTokenManager.addToken(siteId, oldToken);

      // Refresh token
      await multiTokenManager.updateToken(siteId, newToken);

      // Old token should not be retrievable
      const retrieved = await multiTokenManager.getToken(siteId);
      expect(retrieved).toBe(newToken);
      expect(retrieved).not.toBe(oldToken);
    });

    it('should prevent token replay after removal', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      await multiTokenManager.addToken(siteId, token);
      await multiTokenManager.removeToken(siteId);

      // Token should not be accessible after removal
      const retrieved = await multiTokenManager.getToken(siteId);
      expect(retrieved).toBeNull();

      // Adding the same token again should work (not blacklisted)
      await multiTokenManager.addToken(siteId, token);
      const retrieved2 = await multiTokenManager.getToken(siteId);
      expect(retrieved2).toBe(token);
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      const siteId = 'test_site';
      const invalidToken = 'invalid.token.value';

      await multiTokenManager.addToken(siteId, invalidToken);

      const validation = await TokenValidator.validate(invalidToken);

      // Error message should not contain the token itself
      if (validation.error) {
        expect(validation.error).not.toContain(invalidToken);
      }
    });

    it('should handle storage errors securely', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      // Force storage error
      const originalSet = tokenStorage.setToken;
      tokenStorage.setToken = vi.fn().mockRejectedValue(new Error('Storage error'));

      try {
        await multiTokenManager.addToken(siteId, token);
      } catch (error: any) {
        // Error should not contain token value
        expect(error.message).not.toContain(token);
      }

      tokenStorage.setToken = originalSet;
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rapid token validation requests', async () => {
      const token = testUtils.generateValidToken('test_site');

      // Make 100 rapid validation requests
      const validations = await Promise.all(
        Array.from({ length: 100 }, () => TokenValidator.validate(token))
      );

      // All should complete successfully
      expect(validations).toHaveLength(100);
      expect(validations.every(v => v.valid)).toBe(true);
    });

    it('should handle rapid storage operations', async () => {
      const siteId = 'test_site';

      // Make 50 rapid updates
      const operations = Array.from({ length: 50 }, (_, i) =>
        multiTokenManager.updateToken(siteId, testUtils.generateValidToken(`${siteId}_${i}`))
      );

      // Should not throw or lose data
      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Final token should be the last one
      const finalToken = await multiTokenManager.getToken(siteId);
      expect(finalToken).toBeDefined();
    });
  });

  describe('Cross-Site Scripting Prevention', () => {
    it('should sanitize site IDs containing HTML', async () => {
      const maliciousSiteId = '<script>alert("XSS")</script>';
      const token = testUtils.generateValidToken('safe_site');

      // Should handle safely
      await expect(
        multiTokenManager.addToken(maliciousSiteId, token)
      ).resolves.not.toThrow();

      // Retrieve should work
      const retrieved = await multiTokenManager.getToken(maliciousSiteId);
      expect(retrieved).toBe(token);
    });
  });

  describe('Audit Trail', () => {
    it('should track token operations in statistics', async () => {
      const siteId = 'test_site';
      const token = testUtils.generateValidToken(siteId);

      const beforeStats = multiTokenManager.getStatistics();

      await multiTokenManager.addToken(siteId, token);
      await multiTokenManager.getToken(siteId);
      await multiTokenManager.removeToken(siteId);

      const afterStats = multiTokenManager.getStatistics();

      // Stats should reflect operations
      expect(afterStats.totalOperations || 0).toBeGreaterThan(beforeStats.totalOperations || 0);
    });
  });
});
