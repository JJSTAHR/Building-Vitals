import { SiteToken, TokenValidationResult } from '../types/token';

/**
 * Valid JWT token for testing (expired payload, but valid structure)
 */
export const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxOTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/**
 * Invalid JWT token for testing
 */
export const INVALID_JWT = 'invalid.token.here';

/**
 * Mock site tokens
 */
export const mockSiteTokens: SiteToken[] = [
  {
    siteId: 'site1',
    siteName: 'Main Office',
    token: VALID_JWT,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    expiresAt: new Date('2025-12-31'),
  },
  {
    siteId: 'site2',
    siteName: 'Branch Office',
    token: VALID_JWT,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-15'),
    expiresAt: new Date('2025-11-30'),
  },
  {
    siteId: 'site3',
    siteName: 'Remote Site',
    token: VALID_JWT,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-15'),
    expiresAt: new Date('2024-12-15'), // Expiring soon
  },
];

/**
 * Mock validation results
 */
export const mockValidationResults: Record<string, TokenValidationResult> = {
  valid: {
    isValid: true,
    expired: false,
    daysUntilExpiry: 300,
    expiresAt: new Date('2025-12-31'),
    payload: {
      sub: '1234567890',
      name: 'Test User',
      iat: 1516239022,
      exp: 1916239022,
    },
  },
  expiringSoon: {
    isValid: true,
    expired: false,
    daysUntilExpiry: 5,
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    payload: {
      sub: '1234567890',
      name: 'Test User',
      iat: 1516239022,
      exp: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
    },
  },
  expired: {
    isValid: false,
    expired: true,
    daysUntilExpiry: -10,
    expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    payload: {
      sub: '1234567890',
      name: 'Test User',
      iat: 1516239022,
      exp: Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60,
    },
  },
  invalid: {
    isValid: false,
    expired: false,
    error: 'Invalid token format',
  },
};

/**
 * Mock user data
 */
export const mockUsers = {
  standard: {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  },
  admin: {
    id: 'admin123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  },
};

/**
 * Mock migration status
 */
export const mockMigrationStatus = {
  needsMigration: {
    needsMigration: true,
    migrated: false,
    hasLegacyToken: true,
    migratedAt: null,
  },
  migrated: {
    needsMigration: false,
    migrated: true,
    hasLegacyToken: false,
    migratedAt: new Date('2024-01-15'),
  },
  noMigration: {
    needsMigration: false,
    migrated: false,
    hasLegacyToken: false,
    migratedAt: null,
  },
};
