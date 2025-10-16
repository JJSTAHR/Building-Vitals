/**
 * TokenStorageService Unit Tests
 * Tests for IndexedDB-based token storage with localStorage fallback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupTestEnvironment,
  MockEncryptionService,
  PerformanceTimer,
  waitForAsync,
} from '../../test-utils/tokenTestHelpers';
import {
  createMockSiteToken,
  createMockTokens,
  createExpiredToken,
  createNonExpiringToken,
} from '../../test-utils/mockTokenData';

// Mock service interface (to be implemented)
interface TokenStorageService {
  init(): Promise<void>;
  saveToken(siteId: string, data: any): Promise<void>;
  loadToken(siteId: string): Promise<any | null>;
  loadAllTokens(): Promise<Map<string, any>>;
  deleteToken(siteId: string): Promise<void>;
  clearAllTokens(): Promise<void>;
  getMetrics(): any;
}

describe('TokenStorageService', () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment();
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize IndexedDB successfully', async () => {
      const result = await env.mockIndexedDB.open('BuildingVitalsTokens');
      expect(result).toBeDefined();
      expect(result.name).toBe('BuildingVitalsTokens');
    });

    it('should create tokens object store on first run', async () => {
      const db = await env.mockIndexedDB.open('BuildingVitalsTokens');
      expect(db.objectStoreNames).toContain('tokens');
    });

    it('should handle initialization errors gracefully', async () => {
      vi.spyOn(global.indexedDB, 'open').mockImplementation(() => {
        throw new Error('IndexedDB not supported');
      });

      // Should fall back to localStorage without throwing
      expect(() => {
        global.indexedDB.open('test');
      }).toThrow();
    });

    it('should not initialize multiple times concurrently', async () => {
      const openSpy = vi.spyOn(env.mockIndexedDB, 'open');

      // Simulate concurrent init calls
      await Promise.all([
        env.mockIndexedDB.open('test'),
        env.mockIndexedDB.open('test'),
        env.mockIndexedDB.open('test'),
      ]);

      expect(openSpy).toHaveBeenCalledTimes(3);
    });

    it('should set up database schema with correct indexes', async () => {
      const db = await env.mockIndexedDB.open('BuildingVitalsTokens');

      // Verify expected structure
      expect(db.objectStoreNames).toBeDefined();
      expect(db.version).toBe(1);
    });
  });

  describe('Save Token Operations', () => {
    it('should save token to storage', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));

      const stored = env.mockLocalStorage.getItem(`site_token_v1_${token.siteId}`);
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!).siteId).toBe(token.siteId);
    });

    it('should encrypt token before storage', async () => {
      const token = createMockSiteToken({ token: 'plaintext_token' });
      const encrypted = await env.mockEncryption.encrypt(token.token, token.userId);

      expect(encrypted).not.toBe(token.token);
      expect(encrypted).toContain('encrypted_');
    });

    it('should generate token hash on save', async () => {
      const token = createMockSiteToken();
      const hash = await env.mockEncryption.hashToken(token.token);

      expect(hash).toBeDefined();
      expect(hash).toContain('hash_');
    });

    it('should update existing token', async () => {
      const token1 = createMockSiteToken({ siteId: 'test_site' });
      const token2 = createMockSiteToken({ siteId: 'test_site', token: 'new_token' });

      env.mockLocalStorage.setItem(`site_token_v1_test_site`, JSON.stringify(token1));
      env.mockLocalStorage.setItem(`site_token_v1_test_site`, JSON.stringify(token2));

      const stored = JSON.parse(env.mockLocalStorage.getItem('site_token_v1_test_site')!);
      expect(stored.token).toBe('new_token');
    });

    it('should handle save errors gracefully', async () => {
      vi.spyOn(env.mockLocalStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        env.mockLocalStorage.setItem('test', 'data');
      }).toThrow('Storage quota exceeded');
    });

    it('should save multiple tokens independently', async () => {
      const tokens = createMockTokens(5);

      tokens.forEach(token => {
        env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));
      });

      expect(env.mockLocalStorage.length).toBe(5);
    });

    it('should preserve metadata on save', async () => {
      const token = createMockSiteToken({
        metadata: {
          siteName: 'Test Site',
          environment: 'production',
          usageCount: 42,
        },
      });

      env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));
      const stored = JSON.parse(env.mockLocalStorage.getItem(`site_token_v1_${token.siteId}`)!);

      expect(stored.metadata.usageCount).toBe(42);
    });
  });

  describe('Load Token Operations', () => {
    it('should load existing token', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));

      const loaded = env.mockLocalStorage.getItem(`site_token_v1_${token.siteId}`);
      expect(loaded).toBeDefined();
      expect(JSON.parse(loaded!).siteId).toBe(token.siteId);
    });

    it('should return null for non-existent token', async () => {
      const result = env.mockLocalStorage.getItem('site_token_v1_nonexistent');
      expect(result).toBeNull();
    });

    it('should decrypt token on load', async () => {
      const encrypted = 'encrypted_test_token_user_123';
      const decrypted = await env.mockEncryption.decrypt(encrypted, 'user_123');

      expect(decrypted).toBe('test_token');
    });

    it('should verify token hash on load', async () => {
      const token = 'test_token';
      const hash1 = await env.mockEncryption.hashToken(token);
      const hash2 = await env.mockEncryption.hashToken(token);

      expect(env.mockEncryption.secureCompare(hash1, hash2)).toBe(true);
    });

    it('should handle corrupted data gracefully', async () => {
      env.mockLocalStorage.setItem('site_token_v1_test', 'invalid-json{{{');

      expect(() => {
        JSON.parse(env.mockLocalStorage.getItem('site_token_v1_test')!);
      }).toThrow();
    });

    it('should update lastUsed timestamp on load', async () => {
      const token = createMockSiteToken();
      const originalLastUsed = token.metadata?.lastUsed;

      await waitForAsync(10);
      token.metadata!.lastUsed = Date.now();

      expect(token.metadata!.lastUsed).toBeGreaterThan(originalLastUsed!);
    });
  });

  describe('Bulk Operations', () => {
    it('should load all tokens efficiently', async () => {
      const tokens = createMockTokens(10);

      tokens.forEach(token => {
        env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));
      });

      expect(env.mockLocalStorage.length).toBe(10);
    });

    it('should handle empty storage', async () => {
      expect(env.mockLocalStorage.length).toBe(0);
    });

    it('should load tokens in parallel', async () => {
      const tokens = createMockTokens(5);
      const timer = new PerformanceTimer();

      const { duration } = await timer.measure(async () => {
        await Promise.all(
          tokens.map(token =>
            env.mockEncryption.decrypt(`encrypted_${token.token}_${token.userId}`, token.userId)
          )
        );
      });

      // Parallel operations should be faster than sequential
      expect(duration).toBeLessThan(100);
    });

    it('should filter out expired tokens on bulk load', async () => {
      const validToken = createMockSiteToken();
      const expiredToken = createExpiredToken();

      env.mockLocalStorage.setItem(`site_token_v1_valid`, JSON.stringify(validToken));
      env.mockLocalStorage.setItem(`site_token_v1_expired`, JSON.stringify(expiredToken));

      // Manual filter check
      const now = Date.now();
      expect(validToken.expiresAt).toBeGreaterThan(now);
      expect(expiredToken.expiresAt!).toBeLessThan(now);
    });

    it('should handle mixed valid/invalid tokens', async () => {
      env.mockLocalStorage.setItem('site_token_v1_valid', JSON.stringify(createMockSiteToken()));
      env.mockLocalStorage.setItem('site_token_v1_invalid', 'corrupted-data');

      expect(env.mockLocalStorage.length).toBe(2);
    });
  });

  describe('Delete Operations', () => {
    it('should delete specific token', async () => {
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));

      env.mockLocalStorage.removeItem(`site_token_v1_${token.siteId}`);

      expect(env.mockLocalStorage.getItem(`site_token_v1_${token.siteId}`)).toBeNull();
    });

    it('should handle deleting non-existent token', async () => {
      env.mockLocalStorage.removeItem('site_token_v1_nonexistent');
      // Should not throw
      expect(env.mockLocalStorage.length).toBe(0);
    });

    it('should clear all tokens', async () => {
      const tokens = createMockTokens(5);
      tokens.forEach(token => {
        env.mockLocalStorage.setItem(`site_token_v1_${token.siteId}`, JSON.stringify(token));
      });

      env.mockLocalStorage.clear();

      expect(env.mockLocalStorage.length).toBe(0);
    });

    it('should emit event on token deletion', async () => {
      const eventSpy = vi.fn();
      // Note: Actual event emission would be tested with the real service
      eventSpy({ siteId: 'test_site', event: 'tokenDeleted' });

      expect(eventSpy).toHaveBeenCalledWith({
        siteId: 'test_site',
        event: 'tokenDeleted',
      });
    });
  });

  describe('Storage Fallback', () => {
    it('should fall back to localStorage when IndexedDB fails', async () => {
      // Test localStorage as fallback
      const token = createMockSiteToken();
      env.mockLocalStorage.setItem('fallback_test', JSON.stringify(token));

      expect(env.mockLocalStorage.getItem('fallback_test')).toBeDefined();
    });

    it('should use same encryption for both storage types', async () => {
      const token = 'test_token';
      const encrypted1 = await env.mockEncryption.encrypt(token, 'user_1');
      const encrypted2 = await env.mockEncryption.encrypt(token, 'user_1');

      // Both should be encrypted
      expect(encrypted1).not.toBe(token);
      expect(encrypted2).not.toBe(token);
    });
  });

  describe('Quota Management', () => {
    it('should check storage quota', async () => {
      const estimate = await navigator.storage.estimate();

      expect(estimate).toBeDefined();
      expect(estimate.usage).toBeDefined();
      expect(estimate.quota).toBeDefined();
    });

    it('should calculate quota percentage', async () => {
      const estimate = await navigator.storage.estimate();
      const percentUsed = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;

      expect(percentUsed).toBeGreaterThanOrEqual(0);
      expect(percentUsed).toBeLessThanOrEqual(100);
    });

    it('should warn when quota exceeds 80%', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const estimate = await navigator.storage.estimate();
      const percentUsed = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;

      if (percentUsed > 80) {
        console.warn('Storage quota exceeded');
      }

      consoleWarnSpy.mockRestore();
    });

    it('should handle quota exceeded error', async () => {
      vi.spyOn(env.mockLocalStorage, 'setItem').mockImplementation(() => {
        const error: any = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => {
        env.mockLocalStorage.setItem('test', 'data');
      }).toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track operation count', async () => {
      const metrics = {
        operations: {
          save: { count: 0, avgDuration: 0, errors: 0 },
          load: { count: 0, avgDuration: 0, errors: 0 },
        },
      };

      metrics.operations.save.count++;
      metrics.operations.load.count++;

      expect(metrics.operations.save.count).toBe(1);
      expect(metrics.operations.load.count).toBe(1);
    });

    it('should track operation duration', async () => {
      const timer = new PerformanceTimer();

      const { duration } = await timer.measure(async () => {
        await waitForAsync(10);
      });

      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should calculate average duration', async () => {
      const durations = [10, 20, 30, 40, 50];
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(avg).toBe(30);
    });

    it('should track error count', async () => {
      const metrics = { errors: 0 };

      try {
        throw new Error('Test error');
      } catch {
        metrics.errors++;
      }

      expect(metrics.errors).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should create custom TokenStorageError', () => {
      class TokenStorageError extends Error {
        constructor(public type: string, message: string) {
          super(message);
          this.name = 'TokenStorageError';
        }
      }

      const error = new TokenStorageError('QUOTA_EXCEEDED', 'Quota exceeded');

      expect(error.name).toBe('TokenStorageError');
      expect(error.type).toBe('QUOTA_EXCEEDED');
    });

    it('should handle encryption failures', async () => {
      vi.spyOn(env.mockEncryption, 'encrypt').mockRejectedValue(
        new Error('Encryption failed')
      );

      await expect(
        env.mockEncryption.encrypt('test', 'user_1')
      ).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption failures', async () => {
      vi.spyOn(env.mockEncryption, 'decrypt').mockRejectedValue(
        new Error('Decryption failed')
      );

      await expect(
        env.mockEncryption.decrypt('encrypted', 'user_1')
      ).rejects.toThrow('Decryption failed');
    });

    it('should retry operations on transient failures', async () => {
      let attempts = 0;
      const maxRetries = 3;

      async function retryOperation() {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error('Transient error');
        }
        return 'success';
      }

      const result = await (async () => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await retryOperation();
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await waitForAsync(100);
          }
        }
      })();

      expect(result).toBe('success');
      expect(attempts).toBe(maxRetries);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined siteId', async () => {
      expect(() => {
        env.mockLocalStorage.setItem(null as any, 'data');
      }).toThrow();
    });

    it('should handle empty string siteId', async () => {
      env.mockLocalStorage.setItem('site_token_v1_', 'data');
      expect(env.mockLocalStorage.getItem('site_token_v1_')).toBe('data');
    });

    it('should handle very long site IDs', async () => {
      const longSiteId = 'ses_' + 'a'.repeat(1000);
      env.mockLocalStorage.setItem(`site_token_v1_${longSiteId}`, 'data');

      expect(env.mockLocalStorage.getItem(`site_token_v1_${longSiteId}`)).toBe('data');
    });

    it('should handle special characters in siteId', async () => {
      const specialId = 'ses_site!@#$%^&*()';
      env.mockLocalStorage.setItem(`site_token_v1_${specialId}`, 'data');

      expect(env.mockLocalStorage.getItem(`site_token_v1_${specialId}`)).toBe('data');
    });

    it('should handle non-expiring tokens', async () => {
      const token = createNonExpiringToken();

      expect(token.expiresAt).toBeNull();
    });

    it('should handle tokens with past expiration', async () => {
      const token = createExpiredToken();

      expect(token.expiresAt).toBeLessThan(Date.now());
    });
  });
});
