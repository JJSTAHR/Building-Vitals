/**
 * Test Data Fixtures for E2E Tests
 * Provides consistent test data across all E2E test scenarios
 */

export interface TestUser {
  email: string;
  password: string;
  name?: string;
}

export interface TestToken {
  siteId: string;
  siteName: string;
  token: string;
  expiresIn?: number; // minutes from now
}

export const TEST_USERS: Record<string, TestUser> = {
  standard: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  },
  migrated: {
    email: 'migrated@example.com',
    password: 'password123',
    name: 'Migrated User'
  },
  legacy: {
    email: 'legacy@example.com',
    password: 'password123',
    name: 'Legacy User'
  }
};

export const TEST_TOKENS: Record<string, TestToken> = {
  valid: {
    siteId: 'test_site_e2e',
    siteName: 'Test Site E2E',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6OTk5OTk5OTk5OX0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  },
  expiringSoon: {
    siteId: 'expiring_site',
    siteName: 'Expiring Site',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkV4cGlyaW5nIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwODJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    expiresIn: 1 // 1 minute
  },
  expired: {
    siteId: 'expired_site',
    siteName: 'Expired Site',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkV4cGlyZWQiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  },
  invalid: {
    siteId: 'invalid_site',
    siteName: 'Invalid Site',
    token: 'invalid-token-format'
  },
  site2: {
    siteId: 'test_site_2',
    siteName: 'Test Site 2',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEiLCJuYW1lIjoiU2l0ZTIiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6OTk5OTk5OTk5OX0.dGVzdC10b2tlbi1mb3Itc2l0ZS0y'
  }
};

export const VALIDATION_MESSAGES = {
  invalidFormat: 'Invalid token format',
  validToken: 'Valid Token',
  tokenExpired: 'Token Expired',
  tokenExpiringSoon: 'Token Expiring Soon',
  tokenAdded: 'Token added successfully',
  tokenRemoved: 'Token removed successfully',
  tokenUpdated: 'Token updated successfully',
  migrationComplete: 'Migration completed',
  pleaseEnterNewToken: 'Please enter a new token'
};

export const API_ENDPOINTS = {
  login: '/api/auth/login',
  validateToken: '/api/tokens/validate',
  addToken: '/api/tokens',
  removeToken: '/api/tokens/:siteId',
  getSites: '/api/sites',
  migrate: '/api/tokens/migrate'
};

export const TEST_SELECTORS = {
  // Auth
  emailInput: '[name="email"]',
  passwordInput: '[name="password"]',
  loginButton: 'button[type="submit"]',

  // Navigation
  settingsLink: 'text=Settings',
  dashboardLink: 'text=Dashboard',

  // Token Management
  addTokenButton: 'text=Add Token for New Site',
  siteIdInput: '[name="siteId"]',
  siteNameInput: '[name="siteName"]',
  tokenInput: '[name="token"]',
  submitButton: 'text=Add Token',
  deleteButton: '[aria-label="Delete token"]',
  confirmButton: 'text=Confirm',

  // Site Selector
  siteSelector: '[data-testid="site-selector"]',
  currentSite: '[data-testid="current-site"]',
  siteData: '[data-testid="site-data"]',

  // Alerts & Notifications
  alertBanner: '[role="alert"]',
  migrationBanner: '[data-testid="migration-banner"]',
  successNotification: 'text=successfully',

  // Token Status
  tokenRow: (siteId: string) => `[data-testid="token-row-${siteId}"]`,
  tokenStatus: '[data-testid="token-status"]',
  tokenList: '[data-testid="token-list"]',

  // Mobile
  menuButton: '[aria-label="Menu"]',

  // Security
  showTokenButton: '[aria-label="Show token"]',
  hideTokenButton: '[aria-label="Hide token"]'
};

/**
 * Generate a JWT token for testing with custom expiration
 */
export function generateTestToken(expiresInMinutes: number = 60): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInMinutes * 60);

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: '1234567890',
    name: 'Test',
    iat: now,
    exp: exp
  }));
  const signature = 'test-signature';

  return `${header}.${payload}.${signature}`;
}

/**
 * Wait for API response with specific conditions
 */
export async function waitForApiResponse(
  page: any,
  urlPattern: string | RegExp,
  status: number = 200
): Promise<any> {
  const response = await page.waitForResponse(
    (resp: any) =>
      (typeof urlPattern === 'string'
        ? resp.url().includes(urlPattern)
        : urlPattern.test(resp.url())
      ) && resp.status() === status
  );
  return response.json();
}

/**
 * Setup test environment with specific user and tokens
 */
export async function setupTestEnvironment(
  page: any,
  user: TestUser,
  tokens: TestToken[] = []
): Promise<void> {
  // Login
  await page.goto('/login');
  await page.fill(TEST_SELECTORS.emailInput, user.email);
  await page.fill(TEST_SELECTORS.passwordInput, user.password);
  await page.click(TEST_SELECTORS.loginButton);
  await page.waitForURL('/dashboard');

  // Add tokens if provided
  if (tokens.length > 0) {
    await page.goto('/settings');
    for (const token of tokens) {
      await page.click(TEST_SELECTORS.addTokenButton);
      await page.fill(TEST_SELECTORS.siteIdInput, token.siteId);
      await page.fill(TEST_SELECTORS.siteNameInput, token.siteName);
      await page.fill(TEST_SELECTORS.tokenInput, token.token);
      await page.click(TEST_SELECTORS.submitButton);
      await page.waitForSelector(`text=${VALIDATION_MESSAGES.tokenAdded}`);
    }
  }
}

/**
 * Clear all test data
 */
export async function cleanupTestEnvironment(page: any): Promise<void> {
  // Navigate to settings and remove all tokens
  await page.goto('/settings');

  const tokenRows = await page.locator('[data-testid^="token-row-"]').all();
  for (const row of tokenRows) {
    const deleteButton = row.locator(TEST_SELECTORS.deleteButton);
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.click(TEST_SELECTORS.confirmButton);
      await page.waitForTimeout(500);
    }
  }
}
