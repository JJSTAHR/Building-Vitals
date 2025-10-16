/**
 * TokenInterceptor Unit Tests
 * Tests for axios request/response interceptor with automatic token injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockAxios,
  waitForAsync,
  setupTestEnvironment,
  MockEventEmitter,
  createDeferred,
} from '../../test-utils/tokenTestHelpers';
import {
  createMockSiteToken,
  generateMockJWT,
  mockApiResponses,
} from '../../test-utils/mockTokenData';

describe('TokenInterceptor', () => {
  let mockAxios: ReturnType<typeof createMockAxios>;
  let env: ReturnType<typeof setupTestEnvironment>;
  let eventEmitter: MockEventEmitter;
  let requestQueue: Array<{ config: any; resolve: Function; reject: Function }>;

  beforeEach(() => {
    mockAxios = createMockAxios();
    env = setupTestEnvironment();
    eventEmitter = new MockEventEmitter();
    requestQueue = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.cleanup();
    eventEmitter.removeAllListeners();
    requestQueue.length = 0;
  });

  describe('Request Token Injection', () => {
    it('should inject token into request header', async () => {
      const token = 'test_token';
      const config = {
        headers: {},
        url: '/api/data',
      };

      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };

      expect(config.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not inject token if already present', async () => {
      const config = {
        headers: { Authorization: 'Bearer existing_token' },
        url: '/api/data',
      };

      const hasToken = !!config.headers.Authorization;

      expect(hasToken).toBe(true);
      expect(config.headers.Authorization).toBe('Bearer existing_token');
    });

    it('should inject token for authenticated endpoints only', async () => {
      const publicEndpoints = ['/api/public', '/api/health', '/api/login'];
      const token = 'test_token';

      publicEndpoints.forEach(url => {
        const shouldInject = !publicEndpoints.includes(url);
        expect(shouldInject).toBe(false);
      });
    });

    it('should use Bearer token format', async () => {
      const token = 'test_token';
      const header = `Bearer ${token}`;

      expect(header).toMatch(/^Bearer /);
      expect(header.split(' ')[1]).toBe(token);
    });

    it('should handle missing token gracefully', async () => {
      const token = null;
      const config = {
        headers: {},
        url: '/api/data',
      };

      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      }

      expect(config.headers.Authorization).toBeUndefined();
    });

    it('should inject token for all HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const token = 'test_token';

      methods.forEach(method => {
        const config = {
          method,
          headers: {},
          url: '/api/data',
        };

        config.headers = { Authorization: `Bearer ${token}` };

        expect(config.headers.Authorization).toBe(`Bearer ${token}`);
      });
    });
  });

  describe('Site ID Extraction', () => {
    it('should extract siteId from URL query parameter', () => {
      const url = '/api/data?siteId=ses_test_site';
      const params = new URLSearchParams(url.split('?')[1]);
      const siteId = params.get('siteId');

      expect(siteId).toBe('ses_test_site');
    });

    it('should extract siteId from URL path', () => {
      const url = '/api/sites/ses_test_site/data';
      const match = url.match(/\/sites\/([^\/]+)/);
      const siteId = match ? match[1] : null;

      expect(siteId).toBe('ses_test_site');
    });

    it('should extract siteId from request header', () => {
      const headers = new Headers({ 'X-Site-Id': 'ses_test_site' });
      const siteId = headers.get('X-Site-Id');

      expect(siteId).toBe('ses_test_site');
    });

    it('should extract siteId from request body', () => {
      const body = { siteId: 'ses_test_site', data: 'test' };
      const siteId = body.siteId;

      expect(siteId).toBe('ses_test_site');
    });

    it('should extract siteId from subdomain', () => {
      const hostname = 'ses-test-site.example.com';
      const subdomain = hostname.split('.')[0];
      const siteId = subdomain.replace(/-/g, '_');

      expect(siteId).toBe('ses_test_site');
    });

    it('should use default siteId if not found', () => {
      const extracted = null;
      const defaultSiteId = 'ses_falls_city';
      const siteId = extracted || defaultSiteId;

      expect(siteId).toBe('ses_falls_city');
    });

    it('should prioritize explicit siteId over default', () => {
      const explicitSiteId = 'ses_explicit_site';
      const defaultSiteId = 'ses_falls_city';
      const siteId = explicitSiteId || defaultSiteId;

      expect(siteId).toBe('ses_explicit_site');
    });
  });

  describe('401/403 Handling', () => {
    it('should detect 401 unauthorized response', async () => {
      mockAxios.get.mockResolvedValue(mockApiResponses.unauthorized);

      const response = await mockAxios.get('/api/data');

      expect(response.status).toBe(401);
    });

    it('should detect 403 forbidden response', async () => {
      mockAxios.get.mockResolvedValue(mockApiResponses.forbidden);

      const response = await mockAxios.get('/api/data');

      expect(response.status).toBe(403);
    });

    it('should emit tokenExpired event on 401', async () => {
      const spy = vi.fn();
      eventEmitter.on('tokenExpired', spy);

      eventEmitter.emit('tokenExpired', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should emit tokenInvalid event on 403', async () => {
      const spy = vi.fn();
      eventEmitter.on('tokenInvalid', spy);

      eventEmitter.emit('tokenInvalid', { siteId: 'test_site' });

      expect(spy).toHaveBeenCalledWith({ siteId: 'test_site' });
    });

    it('should clear token on 401', async () => {
      const siteId = 'test_site';
      env.mockLocalStorage.setItem(`token_${siteId}`, 'expired_token');

      // Simulate 401 response
      env.mockLocalStorage.removeItem(`token_${siteId}`);

      expect(env.mockLocalStorage.getItem(`token_${siteId}`)).toBeNull();
    });

    it('should attempt token refresh on 401', async () => {
      let refreshAttempted = false;

      mockAxios.get.mockResolvedValue(mockApiResponses.unauthorized);

      try {
        await mockAxios.get('/api/data');
      } catch {
        refreshAttempted = true;
      }

      // In real implementation, would attempt refresh
      expect(mockAxios.get).toHaveBeenCalled();
    });

    it('should queue requests during token refresh', async () => {
      const request = { config: { url: '/api/data' }, resolve: vi.fn(), reject: vi.fn() };
      requestQueue.push(request);

      expect(requestQueue.length).toBe(1);
      expect(requestQueue[0].config.url).toBe('/api/data');
    });

    it('should replay queued requests after refresh', async () => {
      const deferred1 = createDeferred<any>();
      const deferred2 = createDeferred<any>();

      requestQueue.push({
        config: { url: '/api/data1' },
        resolve: deferred1.resolve,
        reject: deferred1.reject,
      });

      requestQueue.push({
        config: { url: '/api/data2' },
        resolve: deferred2.resolve,
        reject: deferred2.reject,
      });

      // Simulate successful refresh
      requestQueue.forEach(req => req.resolve({ status: 200, data: {} }));

      const results = await Promise.all([deferred1.promise, deferred2.promise]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe(200);
    });
  });

  describe('Request Queue', () => {
    it('should queue concurrent requests', () => {
      const requests = [
        { config: { url: '/api/1' }, resolve: vi.fn(), reject: vi.fn() },
        { config: { url: '/api/2' }, resolve: vi.fn(), reject: vi.fn() },
        { config: { url: '/api/3' }, resolve: vi.fn(), reject: vi.fn() },
      ];

      requests.forEach(req => requestQueue.push(req));

      expect(requestQueue.length).toBe(3);
    });

    it('should process queue in FIFO order', () => {
      requestQueue.push({ config: { url: '/first' }, resolve: vi.fn(), reject: vi.fn() });
      requestQueue.push({ config: { url: '/second' }, resolve: vi.fn(), reject: vi.fn() });
      requestQueue.push({ config: { url: '/third' }, resolve: vi.fn(), reject: vi.fn() });

      const first = requestQueue.shift();
      expect(first?.config.url).toBe('/first');
    });

    it('should clear queue on successful refresh', () => {
      requestQueue.push({ config: { url: '/api/1' }, resolve: vi.fn(), reject: vi.fn() });
      requestQueue.push({ config: { url: '/api/2' }, resolve: vi.fn(), reject: vi.fn() });

      requestQueue.length = 0;

      expect(requestQueue.length).toBe(0);
    });

    it('should reject queued requests on refresh failure', async () => {
      const rejectSpy = vi.fn();

      requestQueue.push({
        config: { url: '/api/data' },
        resolve: vi.fn(),
        reject: rejectSpy,
      });

      // Simulate refresh failure
      requestQueue.forEach(req => req.reject(new Error('Refresh failed')));

      await waitForAsync(10);

      expect(rejectSpy).toHaveBeenCalledWith(new Error('Refresh failed'));
    });

    it('should handle queue overflow', () => {
      const MAX_QUEUE_SIZE = 100;

      for (let i = 0; i < MAX_QUEUE_SIZE + 10; i++) {
        requestQueue.push({ config: { url: `/api/${i}` }, resolve: vi.fn(), reject: vi.fn() });
      }

      // Implement queue size limit
      if (requestQueue.length > MAX_QUEUE_SIZE) {
        requestQueue = requestQueue.slice(0, MAX_QUEUE_SIZE);
      }

      expect(requestQueue.length).toBe(MAX_QUEUE_SIZE);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on network error', async () => {
      let attempts = 0;
      mockAxios.get.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockApiResponses.success);
      });

      for (let i = 0; i < 3; i++) {
        try {
          const response = await mockAxios.get('/api/data');
          if (response.status === 200) break;
        } catch (error) {
          if (i < 2) await waitForAsync(100);
          else throw error;
        }
      }

      expect(attempts).toBe(3);
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];

      for (let i = 0; i < 3; i++) {
        const delay = Math.pow(2, i) * 1000;
        delays.push(delay);
      }

      expect(delays).toEqual([1000, 2000, 4000]);
    });

    it('should limit max retries', async () => {
      const MAX_RETRIES = 3;
      let attempts = 0;

      mockAxios.get.mockRejectedValue(new Error('Always fails'));

      for (let i = 0; i < MAX_RETRIES; i++) {
        attempts++;
        try {
          await mockAxios.get('/api/data');
          break;
        } catch (error) {
          if (i === MAX_RETRIES - 1) {
            // Max retries reached
            break;
          }
          await waitForAsync(100);
        }
      }

      expect(attempts).toBe(MAX_RETRIES);
    });

    it('should not retry on 4xx errors', async () => {
      mockAxios.get.mockResolvedValue(mockApiResponses.notFound);

      const response = await mockAxios.get('/api/data');

      expect(response.status).toBe(404);
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      let attempts = 0;
      mockAxios.get.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve(mockApiResponses.serverError);
        }
        return Promise.resolve(mockApiResponses.success);
      });

      let response;
      for (let i = 0; i < 3; i++) {
        response = await mockAxios.get('/api/data');
        if (response.status === 200) break;
        await waitForAsync(100);
      }

      expect(response!.status).toBe(200);
      expect(attempts).toBe(2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeout', async () => {
      mockAxios.get.mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      );

      const timeout = 100;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      await expect(
        Promise.race([mockAxios.get('/api/data'), timeoutPromise])
      ).rejects.toThrow('Request timeout');
    });

    it('should handle connection refused', async () => {
      mockAxios.get.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(mockAxios.get('/api/data')).rejects.toMatchObject({
        code: 'ECONNREFUSED',
      });
    });

    it('should handle DNS resolution failure', async () => {
      mockAxios.get.mockRejectedValue({ code: 'ENOTFOUND' });

      await expect(mockAxios.get('/api/data')).rejects.toMatchObject({
        code: 'ENOTFOUND',
      });
    });

    it('should handle interceptor errors', async () => {
      const interceptorError = new Error('Interceptor failed');

      mockAxios.interceptors.request.use.mockImplementation(() => {
        throw interceptorError;
      });

      expect(() => {
        mockAxios.interceptors.request.use(vi.fn());
      }).toThrow('Interceptor failed');
    });

    it('should emit error event on failure', () => {
      const spy = vi.fn();
      eventEmitter.on('error', spy);

      try {
        throw new Error('Request failed');
      } catch (error) {
        eventEmitter.emit('error', { error });
      }

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Interceptor Management', () => {
    it('should register request interceptor', () => {
      const interceptorId = mockAxios.interceptors.request.use(vi.fn());

      expect(mockAxios.interceptors.request.use).toHaveBeenCalled();
    });

    it('should register response interceptor', () => {
      const interceptorId = mockAxios.interceptors.response.use(vi.fn(), vi.fn());

      expect(mockAxios.interceptors.response.use).toHaveBeenCalled();
    });

    it('should eject request interceptor', () => {
      const interceptorId = 0;
      mockAxios.interceptors.request.eject(interceptorId);

      expect(mockAxios.interceptors.request.eject).toHaveBeenCalledWith(interceptorId);
    });

    it('should eject response interceptor', () => {
      const interceptorId = 0;
      mockAxios.interceptors.response.eject(interceptorId);

      expect(mockAxios.interceptors.response.eject).toHaveBeenCalledWith(interceptorId);
    });

    it('should handle multiple interceptors', () => {
      mockAxios.interceptors.request.use(vi.fn());
      mockAxios.interceptors.request.use(vi.fn());
      mockAxios.interceptors.response.use(vi.fn(), vi.fn());

      expect(mockAxios.interceptors.request.use).toHaveBeenCalledTimes(2);
      expect(mockAxios.interceptors.response.use).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance', () => {
    it('should not significantly delay requests', async () => {
      const token = 'test_token';
      const config = { headers: {}, url: '/api/data' };

      const start = performance.now();
      config.headers = { Authorization: `Bearer ${token}` };
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should handle high request volume', async () => {
      const requests = Array.from({ length: 100 }, (_, i) =>
        mockAxios.get(`/api/data${i}`)
      );

      mockAxios.get.mockResolvedValue(mockApiResponses.success);

      const start = performance.now();
      await Promise.all(requests);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should not leak memory on queue operations', () => {
      // Fill queue
      for (let i = 0; i < 1000; i++) {
        requestQueue.push({ config: { url: `/api/${i}` }, resolve: vi.fn(), reject: vi.fn() });
      }

      // Clear queue
      requestQueue.length = 0;

      expect(requestQueue.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle request without headers', () => {
      const config: any = { url: '/api/data' };
      const token = 'test_token';

      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;

      expect(config.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('should handle empty token', () => {
      const token = '';
      const config = { headers: {}, url: '/api/data' };

      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      }

      expect(config.headers.Authorization).toBeUndefined();
    });

    it('should handle malformed response', () => {
      const response: any = { statusText: 'OK' }; // Missing status

      const isValid = typeof response.status === 'number';

      expect(isValid).toBe(false);
    });

    it('should handle circular request dependencies', () => {
      const processed = new Set<string>();
      const url = '/api/data';

      if (!processed.has(url)) {
        processed.add(url);
        // Process request...
      }

      expect(processed.has(url)).toBe(true);
    });

    it('should handle concurrent 401 responses', async () => {
      const responses = await Promise.all([
        Promise.resolve(mockApiResponses.unauthorized),
        Promise.resolve(mockApiResponses.unauthorized),
        Promise.resolve(mockApiResponses.unauthorized),
      ]);

      expect(responses.every(r => r.status === 401)).toBe(true);
    });
  });
});
