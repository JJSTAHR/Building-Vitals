/**
 * Mock API Server for Integration Tests
 *
 * Provides a mock HTTP server for testing API interactions
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

export function setupMockAPIServer(): MockAdapter {
  const mock = new MockAdapter(axios, { delayResponse: 10 });

  // Track request history
  const requestHistory: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
    data?: any;
  }> = [];

  // Intercept all requests to track history
  mock.onAny().reply((config) => {
    requestHistory.push({
      method: config.method || 'GET',
      url: config.url || '',
      headers: config.headers as Record<string, string>,
      data: config.data,
    });

    return [404, { error: 'Not found' }];
  });

  // Mock successful site list
  mock.onGet('/api/sites').reply((config) => {
    const token = config.headers?.['X-ACE-Token'];

    if (!token) {
      return [401, { error: 'No token provided' }];
    }

    // Check if token is expired
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp < now) {
          return [401, { error: 'Token expired' }];
        }
      }
    } catch (error) {
      return [401, { error: 'Invalid token format' }];
    }

    return [200, {
      sites: ['site1', 'site2', 'site3'],
      timestamp: Date.now(),
    }];
  });

  // Mock site-specific points endpoint
  mock.onGet(/\/api\/sites\/([^/]+)\/points/).reply((config) => {
    const token = config.headers?.['X-ACE-Token'];
    const siteIdMatch = config.url?.match(/\/api\/sites\/([^/]+)\/points/);
    const siteId = siteIdMatch?.[1];

    if (!token) {
      return [401, { error: 'No token provided' }];
    }

    if (!siteId) {
      return [400, { error: 'No site ID provided' }];
    }

    return [200, {
      siteId,
      points: [`${siteId}_point1`, `${siteId}_point2`],
      timestamp: Date.now(),
    }];
  });

  // Mock data endpoint with query params
  mock.onGet(/\/api\/data/).reply((config) => {
    const token = config.headers?.['X-ACE-Token'];
    const urlParams = new URLSearchParams(config.url?.split('?')[1]);
    const siteId = urlParams.get('siteId');

    if (!token) {
      return [401, { error: 'No token provided' }];
    }

    return [200, {
      siteId,
      data: { value: 42 },
      timestamp: Date.now(),
    }];
  });

  // Mock POST data endpoint with body
  mock.onPost('/api/data').reply((config) => {
    const token = config.headers?.['X-ACE-Token'];
    let siteId: string | undefined;

    try {
      const body = JSON.parse(config.data);
      siteId = body.siteId;
    } catch (error) {
      // Ignore parse errors
    }

    if (!token) {
      return [401, { error: 'No token provided' }];
    }

    return [200, {
      siteId,
      success: true,
      timestamp: Date.now(),
    }];
  });

  // Mock unauthorized endpoint (always returns 401)
  mock.onGet('/api/unauthorized').reply(401, {
    error: 'Unauthorized',
  });

  // Mock endpoint that returns 401 first, then 200 (for retry tests)
  let retryCount = 0;
  mock.onGet('/api/retry-test').reply(() => {
    retryCount++;

    if (retryCount === 1) {
      return [401, { error: 'Token expired' }];
    }

    return [200, { success: true, retryCount }];
  });

  // Mock slow endpoint (for timeout tests)
  mock.onGet('/api/slow').reply(async () => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return [200, { data: 'slow response' }];
  });

  // Helper to get request history
  (mock as any).getRequestHistory = () => requestHistory;

  // Helper to reset request history
  (mock as any).resetHistory = () => {
    requestHistory.length = 0;
    retryCount = 0;
  };

  return mock;
}

export default setupMockAPIServer;
