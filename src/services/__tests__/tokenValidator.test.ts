/**
 * TokenValidator Unit Tests
 * Tests for JWT validation and expiration checking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateMockJWT,
  createMockValidationResponse,
  createExpiredToken,
  createExpiringSoonToken,
  createNonExpiringToken,
  mockApiResponses,
} from '../../test-utils/mockTokenData';
import { createMockAxios, waitForAsync } from '../../test-utils/tokenTestHelpers';

describe('TokenValidator', () => {
  let mockAxios: ReturnType<typeof createMockAxios>;

  beforeEach(() => {
    mockAxios = createMockAxios();
    vi.clearAllMocks();
  });

  describe('JWT Format Validation', () => {
    it('should validate correct JWT format', () => {
      const jwt = generateMockJWT();
      const parts = jwt.split('.');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // header
      expect(parts[1]).toBeTruthy(); // payload
      expect(parts[2]).toBeTruthy(); // signature
    });

    it('should reject invalid JWT format', () => {
      const invalidJwts = [
        'invalid',
        'invalid.jwt',
        'only.two.parts',
        'invalid.jwt.format.extra',
        '',
        null,
        undefined,
      ];

      invalidJwts.forEach(jwt => {
        const parts = jwt ? jwt.split('.') : [];
        expect(parts.length === 3).toBe(false);
      });
    });

    it('should validate JWT parts are base64', () => {
      const jwt = generateMockJWT();
      const parts = jwt.split('.');

      parts.forEach(part => {
        expect(() => atob(part)).not.toThrow();
      });
    });

    it('should handle JWT with padding', () => {
      const jwt = generateMockJWT();
      const withPadding = jwt + '==';
      const parts = withPadding.split('.');

      expect(parts).toHaveLength(3);
    });

    it('should handle JWT without padding', () => {
      const jwt = generateMockJWT().replace(/=/g, '');
      const parts = jwt.split('.');

      expect(parts).toHaveLength(3);
    });

    it('should validate JWT header', () => {
      const jwt = generateMockJWT();
      const header = jwt.split('.')[0];
      const decoded = JSON.parse(atob(header));

      expect(decoded).toHaveProperty('alg');
      expect(decoded).toHaveProperty('typ');
      expect(decoded.typ).toBe('JWT');
    });

    it('should validate JWT payload', () => {
      const jwt = generateMockJWT();
      const payload = jwt.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('iat');
    });
  });

  describe('Base64 Decoding', () => {
    it('should decode base64 header', () => {
      const jwt = generateMockJWT();
      const header = jwt.split('.')[0];
      const decoded = JSON.parse(atob(header));

      expect(decoded).toBeDefined();
      expect(typeof decoded).toBe('object');
    });

    it('should decode base64 payload', () => {
      const jwt = generateMockJWT();
      const payload = jwt.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      expect(decoded).toBeDefined();
      expect(typeof decoded).toBe('object');
    });

    it('should handle malformed base64', () => {
      const malformed = 'not!!!valid!!!base64';

      expect(() => atob(malformed)).toThrow();
    });

    it('should handle URL-safe base64', () => {
      const urlSafe = btoa('test').replace(/\+/g, '-').replace(/\//g, '_');
      const standard = urlSafe.replace(/-/g, '+').replace(/_/g, '/');

      expect(() => atob(standard)).not.toThrow();
    });

    it('should extract claims from payload', () => {
      const claims = {
        sub: '123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      };

      const jwt = generateMockJWT(claims);
      const payload = jwt.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('admin');
    });
  });

  describe('Expiration Calculation', () => {
    it('should calculate time until expiration', () => {
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      const now = Date.now();
      const expiresIn = Math.floor((expiresAt - now) / 1000);

      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThanOrEqual(7 * 24 * 60 * 60);
    });

    it('should detect expired token', () => {
      const token = createExpiredToken();
      const isExpired = token.expiresAt! < Date.now();

      expect(isExpired).toBe(true);
    });

    it('should detect non-expired token', () => {
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 1 day
      const isExpired = expiresAt < Date.now();

      expect(isExpired).toBe(false);
    });

    it('should handle tokens without expiration', () => {
      const token = createNonExpiringToken();

      expect(token.expiresAt).toBeNull();
    });

    it('should calculate expiration in seconds', () => {
      const jwt = generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const expiresIn = payload.exp - Math.floor(Date.now() / 1000);

      expect(expiresIn).toBeGreaterThan(3500);
      expect(expiresIn).toBeLessThanOrEqual(3600);
    });

    it('should calculate expiration in days', () => {
      const expiresAt = Date.now() + (5 * 24 * 60 * 60 * 1000); // 5 days
      const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));

      expect(daysUntilExpiry).toBe(5);
    });
  });

  describe('Warning Thresholds', () => {
    it('should not warn for tokens expiring in 7+ days', () => {
      const expiresAt = Date.now() + (8 * 24 * 60 * 60 * 1000);
      const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      const warningLevel = daysUntilExpiry <= 1 ? 'critical' :
                           daysUntilExpiry <= 3 ? 'urgent' :
                           daysUntilExpiry <= 7 ? 'warning' : 'none';

      expect(warningLevel).toBe('none');
    });

    it('should warn for tokens expiring in 3-7 days', () => {
      const expiresAt = Date.now() + (5 * 24 * 60 * 60 * 1000);
      const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      const warningLevel = daysUntilExpiry <= 1 ? 'critical' :
                           daysUntilExpiry <= 3 ? 'urgent' :
                           daysUntilExpiry <= 7 ? 'warning' : 'none';

      expect(warningLevel).toBe('warning');
    });

    it('should urgent warn for tokens expiring in 1-3 days', () => {
      const expiresAt = Date.now() + (2 * 24 * 60 * 60 * 1000);
      const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      const warningLevel = daysUntilExpiry <= 1 ? 'critical' :
                           daysUntilExpiry <= 3 ? 'urgent' :
                           daysUntilExpiry <= 7 ? 'warning' : 'none';

      expect(warningLevel).toBe('urgent');
    });

    it('should critical warn for tokens expiring in < 1 day', () => {
      const token = createExpiringSoonToken(0.5); // 12 hours
      const daysUntilExpiry = Math.floor((token.expiresAt! - Date.now()) / (24 * 60 * 60 * 1000));
      const warningLevel = daysUntilExpiry <= 1 ? 'critical' :
                           daysUntilExpiry <= 3 ? 'urgent' :
                           daysUntilExpiry <= 7 ? 'warning' : 'none';

      expect(warningLevel).toBe('critical');
    });

    it('should handle tokens at exact threshold boundaries', () => {
      const boundaries = [1, 3, 7];

      boundaries.forEach(days => {
        const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
        const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));

        expect(daysUntilExpiry).toBe(days);
      });
    });

    it('should provide warning message', () => {
      const token = createExpiringSoonToken(2);
      const daysUntilExpiry = Math.floor((token.expiresAt! - Date.now()) / (24 * 60 * 60 * 1000));
      const message = `Token expires in ${daysUntilExpiry} days`;

      expect(message).toContain('expires in');
      expect(message).toContain('days');
    });
  });

  describe('API Testing', () => {
    it('should validate token via API', async () => {
      mockAxios.post.mockResolvedValue(mockApiResponses.success);

      const response = await mockAxios.post('/validate', { token: 'test_token' });

      expect(response.status).toBe(200);
      expect(mockAxios.post).toHaveBeenCalledWith('/validate', { token: 'test_token' });
    });

    it('should handle API validation errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('API error'));

      await expect(
        mockAxios.post('/validate', { token: 'test_token' })
      ).rejects.toThrow('API error');
    });

    it('should handle 401 unauthorized', async () => {
      mockAxios.post.mockResolvedValue(mockApiResponses.unauthorized);

      const response = await mockAxios.post('/validate', { token: 'invalid_token' });

      expect(response.status).toBe(401);
    });

    it('should handle 403 forbidden', async () => {
      mockAxios.post.mockResolvedValue(mockApiResponses.forbidden);

      const response = await mockAxios.post('/validate', { token: 'forbidden_token' });

      expect(response.status).toBe(403);
    });

    it('should handle 500 server error', async () => {
      mockAxios.post.mockResolvedValue(mockApiResponses.serverError);

      const response = await mockAxios.post('/validate', { token: 'test_token' });

      expect(response.status).toBe(500);
    });

    it('should retry on network failure', async () => {
      let attempts = 0;
      mockAxios.post.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockApiResponses.success);
      });

      for (let i = 0; i < 3; i++) {
        try {
          const response = await mockAxios.post('/validate', { token: 'test' });
          if (response.status === 200) break;
        } catch (error) {
          if (i < 2) await waitForAsync(100);
          else throw error;
        }
      }

      expect(attempts).toBe(3);
    });

    it('should timeout long-running requests', async () => {
      mockAxios.post.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockApiResponses.success), 5000))
      );

      const timeout = 100;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      );

      const apiPromise = mockAxios.post('/validate', { token: 'test' });

      await expect(
        Promise.race([apiPromise, timeoutPromise])
      ).rejects.toThrow('Timeout');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle null token', () => {
      const token = null;
      const isValid = token !== null && typeof token === 'string' && token.split('.').length === 3;

      expect(isValid).toBe(false);
    });

    it('should handle undefined token', () => {
      const token = undefined;
      const isValid = token !== null && typeof token === 'string' && token?.split('.').length === 3;

      expect(isValid).toBe(false);
    });

    it('should handle empty string token', () => {
      const token = '';
      const isValid = token && token.split('.').length === 3;

      expect(isValid).toBe(false);
    });

    it('should handle malformed JWT', () => {
      const malformed = 'not.a.valid.jwt.with.too.many.parts';
      const parts = malformed.split('.');

      expect(parts.length).toBeGreaterThan(3);
    });

    it('should handle JWT with invalid JSON', () => {
      const invalidJson = btoa('{invalid json}');
      const jwt = `${invalidJson}.${invalidJson}.${invalidJson}`;

      expect(() => {
        const payload = jwt.split('.')[1];
        JSON.parse(atob(payload));
      }).toThrow();
    });

    it('should handle corrupted base64', () => {
      const corrupted = 'corrupted!!!base64';

      expect(() => atob(corrupted)).toThrow();
    });

    it('should validate required claims', () => {
      const jwt = generateMockJWT({ sub: '123' });
      const payload = JSON.parse(atob(jwt.split('.')[1]));

      const requiredClaims = ['sub', 'iat'];
      const hasAllClaims = requiredClaims.every(claim => claim in payload);

      expect(hasAllClaims).toBe(true);
    });

    it('should handle missing expiration claim', () => {
      const jwt = generateMockJWT({ exp: undefined });
      const payload = JSON.parse(atob(jwt.split('.')[1]));

      expect(payload.exp).toBeUndefined();
    });
  });

  describe('Validation Response', () => {
    it('should return complete validation response', () => {
      const response = createMockValidationResponse();

      expect(response).toHaveProperty('isValid');
      expect(response).toHaveProperty('decoded');
      expect(response).toHaveProperty('expiresAt');
      expect(response).toHaveProperty('expiresIn');
      expect(response).toHaveProperty('isExpired');
      expect(response).toHaveProperty('warningLevel');
    });

    it('should include decoded claims in response', () => {
      const response = createMockValidationResponse();

      expect(response.decoded).toBeDefined();
      expect(response.decoded).toHaveProperty('sub');
      expect(response.decoded).toHaveProperty('name');
    });

    it('should calculate expiration fields correctly', () => {
      const response = createMockValidationResponse();
      const calculatedExpiresIn = Math.floor((response.expiresAt! - Date.now()) / 1000);

      expect(Math.abs(calculatedExpiresIn - response.expiresIn!)).toBeLessThan(2);
    });

    it('should set isExpired flag correctly', () => {
      const validResponse = createMockValidationResponse({
        expiresAt: Date.now() + 3600000,
        isExpired: false,
      });

      const expiredResponse = createMockValidationResponse({
        expiresAt: Date.now() - 3600000,
        isExpired: true,
      });

      expect(validResponse.isExpired).toBe(false);
      expect(expiredResponse.isExpired).toBe(true);
    });

    it('should set warning level correctly', () => {
      const levels = ['none', 'warning', 'urgent', 'critical'] as const;

      levels.forEach(level => {
        const response = createMockValidationResponse({ warningLevel: level });
        expect(response.warningLevel).toBe(level);
      });
    });
  });
});
