/**
 * Mock Token Data for Testing
 * Provides realistic test data for token services
 */

export interface MockSiteToken {
  siteId: string;
  token: string;
  tokenHash: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  metadata?: {
    siteName?: string;
    environment?: 'production' | 'staging' | 'development';
    lastUsed?: number;
    usageCount?: number;
  };
}

/**
 * Generate a mock JWT token
 */
export function generateMockJWT(payload: Record<string, any> = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    sub: '1234567890',
    name: 'Test User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  }));
  const signature = btoa('mock-signature-' + Math.random());

  return `${header}.${body}.${signature}`;
}

/**
 * Generate mock site token data
 */
export function createMockSiteToken(overrides: Partial<MockSiteToken> = {}): MockSiteToken {
  const now = Date.now();
  return {
    siteId: 'ses_test_site',
    token: generateMockJWT(),
    tokenHash: 'mock-hash-' + Math.random().toString(36),
    userId: 'user_123',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7 days
    metadata: {
      siteName: 'Test Site',
      environment: 'development',
      lastUsed: now,
      usageCount: 1,
    },
    ...overrides,
  };
}

/**
 * Create multiple mock tokens
 */
export function createMockTokens(count: number): MockSiteToken[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSiteToken({
      siteId: `ses_site_${i + 1}`,
      userId: `user_${i + 1}`,
      metadata: {
        siteName: `Site ${i + 1}`,
        environment: i % 3 === 0 ? 'production' : i % 3 === 1 ? 'staging' : 'development',
        usageCount: Math.floor(Math.random() * 100),
      },
    })
  );
}

/**
 * Create an expired token
 */
export function createExpiredToken(overrides: Partial<MockSiteToken> = {}): MockSiteToken {
  const yesterday = Date.now() - (24 * 60 * 60 * 1000);
  return createMockSiteToken({
    expiresAt: yesterday,
    token: generateMockJWT({ exp: Math.floor(yesterday / 1000) }),
    ...overrides,
  });
}

/**
 * Create a token expiring soon
 */
export function createExpiringSoonToken(daysUntilExpiry: number = 1): MockSiteToken {
  const expiryTime = Date.now() + (daysUntilExpiry * 24 * 60 * 60 * 1000);
  return createMockSiteToken({
    expiresAt: expiryTime,
    token: generateMockJWT({ exp: Math.floor(expiryTime / 1000) }),
  });
}

/**
 * Create a token without expiration
 */
export function createNonExpiringToken(overrides: Partial<MockSiteToken> = {}): MockSiteToken {
  return createMockSiteToken({
    expiresAt: null,
    token: generateMockJWT({ exp: undefined }),
    ...overrides,
  });
}

/**
 * Mock token validation response
 */
export interface MockValidationResponse {
  isValid: boolean;
  decoded?: Record<string, any>;
  expiresAt?: number;
  expiresIn?: number;
  isExpired: boolean;
  warningLevel?: 'none' | 'warning' | 'urgent' | 'critical';
}

/**
 * Create mock validation response
 */
export function createMockValidationResponse(
  overrides: Partial<MockValidationResponse> = {}
): MockValidationResponse {
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
  return {
    isValid: true,
    decoded: {
      sub: '1234567890',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt / 1000),
    },
    expiresAt,
    expiresIn: 7 * 24 * 60 * 60,
    isExpired: false,
    warningLevel: 'none',
    ...overrides,
  };
}

/**
 * Mock API responses
 */
export const mockApiResponses = {
  success: {
    status: 200,
    data: { message: 'Success' },
  },
  unauthorized: {
    status: 401,
    data: { error: 'Unauthorized' },
  },
  forbidden: {
    status: 403,
    data: { error: 'Forbidden' },
  },
  notFound: {
    status: 404,
    data: { error: 'Not Found' },
  },
  serverError: {
    status: 500,
    data: { error: 'Internal Server Error' },
  },
};

/**
 * Mock site IDs for testing
 */
export const mockSiteIds = [
  'ses_falls_city',
  'ses_site_2',
  'ses_test_site',
  'ses_production_1',
  'ses_staging_1',
  'ses_dev_1',
];

/**
 * Mock user IDs for testing
 */
export const mockUserIds = [
  'user_123',
  'user_456',
  'user_789',
  'test_user_1',
  'test_user_2',
];
