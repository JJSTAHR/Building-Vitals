/**
 * Test Fixtures for Analytics and Monitoring Tests
 * Provides sample data for various test scenarios
 */

export interface MockAnalyticsEvent {
  timestamp: number;
  blobs: string[];
  indexes: number[];
  doubles: number[];
}

export interface MockMetrics {
  requestCount: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export interface MockWorkerRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Generate mock analytics events
 */
export function generateMockAnalyticsEvents(count: number): MockAnalyticsEvent[] {
  const events: MockAnalyticsEvent[] = [];
  const startTime = Date.now() - (count * 60000); // Events over last N minutes

  for (let i = 0; i < count; i++) {
    events.push({
      timestamp: startTime + (i * 60000),
      blobs: [
        'GET',
        '/api/points',
        '200',
        'test-user-id',
        `correlation-id-${i}`,
      ],
      indexes: [
        Math.floor(Math.random() * 1000), // Response time
        Math.floor(Math.random() * 100), // Error code
      ],
      doubles: [
        Math.random() * 100, // Cache hit rate
        Math.random() * 1000, // Payload size
      ],
    });
  }

  return events;
}

/**
 * Generate mock metrics data
 */
export function generateMockMetrics(): MockMetrics {
  return {
    requestCount: Math.floor(Math.random() * 10000),
    errorCount: Math.floor(Math.random() * 100),
    cacheHits: Math.floor(Math.random() * 8000),
    cacheMisses: Math.floor(Math.random() * 2000),
    averageResponseTime: Math.random() * 500 + 50,
    p95ResponseTime: Math.random() * 1000 + 200,
    p99ResponseTime: Math.random() * 2000 + 500,
  };
}

/**
 * Generate mock worker request
 */
export function generateMockRequest(options?: Partial<MockWorkerRequest>): MockWorkerRequest {
  return {
    url: options?.url || 'https://example.com/api/test',
    method: options?.method || 'GET',
    headers: options?.headers || {
      'Content-Type': 'application/json',
      'User-Agent': 'test-agent',
    },
    body: options?.body,
  };
}

/**
 * Mock error scenarios
 */
export const errorScenarios = {
  networkTimeout: {
    name: 'Network Timeout',
    error: new Error('Request timed out after 30000ms'),
    expectedMetrics: {
      errorCount: 1,
      errorType: 'timeout',
      statusCode: 0,
    },
  },
  serverError: {
    name: '500 Internal Server Error',
    error: new Error('Internal Server Error'),
    expectedMetrics: {
      errorCount: 1,
      errorType: 'server_error',
      statusCode: 500,
    },
  },
  unauthorized: {
    name: '401 Unauthorized',
    error: new Error('Unauthorized'),
    expectedMetrics: {
      errorCount: 1,
      errorType: 'auth_error',
      statusCode: 401,
    },
  },
  rateLimited: {
    name: '429 Too Many Requests',
    error: new Error('Rate limit exceeded'),
    expectedMetrics: {
      errorCount: 1,
      errorType: 'rate_limit',
      statusCode: 429,
    },
  },
};

/**
 * Mock performance markers
 */
export const performanceMarkers = {
  fast: {
    name: 'Fast Request',
    duration: 50,
    expectedCategory: 'fast',
  },
  normal: {
    name: 'Normal Request',
    duration: 250,
    expectedCategory: 'normal',
  },
  slow: {
    name: 'Slow Request',
    duration: 1500,
    expectedCategory: 'slow',
  },
  critical: {
    name: 'Critical Slow Request',
    duration: 3500,
    expectedCategory: 'critical',
  },
};

/**
 * Mock cache scenarios
 */
export const cacheScenarios = {
  hit: {
    name: 'Cache Hit',
    cacheKey: 'test-key-1',
    cacheValue: { data: 'cached-data' },
    expectedMetrics: {
      cacheHits: 1,
      cacheMisses: 0,
    },
  },
  miss: {
    name: 'Cache Miss',
    cacheKey: 'test-key-2',
    cacheValue: null,
    expectedMetrics: {
      cacheHits: 0,
      cacheMisses: 1,
    },
  },
  expired: {
    name: 'Cache Expired',
    cacheKey: 'test-key-3',
    cacheValue: { data: 'expired-data', timestamp: Date.now() - 600000 },
    expectedMetrics: {
      cacheHits: 0,
      cacheMisses: 1,
    },
  },
};

/**
 * Mock time ranges for testing
 */
export const timeRanges = {
  lastHour: {
    start: new Date(Date.now() - 3600000).toISOString(),
    end: new Date().toISOString(),
  },
  last24Hours: {
    start: new Date(Date.now() - 86400000).toISOString(),
    end: new Date().toISOString(),
  },
  last7Days: {
    start: new Date(Date.now() - 604800000).toISOString(),
    end: new Date().toISOString(),
  },
};

/**
 * Mock dashboard data
 */
export function generateMockDashboardData() {
  return {
    metrics: generateMockMetrics(),
    events: generateMockAnalyticsEvents(100),
    errors: [
      {
        id: '1',
        timestamp: Date.now() - 300000,
        message: 'Connection timeout',
        stack: 'Error: Connection timeout\n  at fetch (worker.js:123)',
        correlationId: 'corr-1',
      },
      {
        id: '2',
        timestamp: Date.now() - 120000,
        message: 'Rate limit exceeded',
        stack: 'Error: Rate limit exceeded\n  at handleRequest (worker.js:456)',
        correlationId: 'corr-2',
      },
    ],
    alertTriggers: [
      {
        id: 'alert-1',
        type: 'high_error_rate',
        threshold: 5,
        currentValue: 7.2,
        timestamp: Date.now() - 180000,
      },
    ],
  };
}
