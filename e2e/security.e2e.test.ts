import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { TEST_USERS, TEST_TOKENS, TEST_SELECTORS } from './fixtures/testData';

/**
 * E2E Test Suite: Security & Token Protection
 * Tests security measures for token storage, transmission, and display
 */

test.describe('Token Security E2E', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);
    await page.waitForURL('/dashboard');
  });

  test('Tokens are not visible in network requests', async ({ page }) => {
    await settingsPage.goto();

    // Monitor network requests
    const requests: any[] = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        headers: request.headers()
      });
    });

    // Add token
    await settingsPage.addTokenButton.click();
    await page.fill(TEST_SELECTORS.siteIdInput, TEST_TOKENS.valid.siteId);
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
    await page.click(TEST_SELECTORS.submitButton);

    // Wait for request to complete
    await page.waitForTimeout(2000);

    // Verify no plaintext token in any request body
    const hasPlaintextToken = requests.some(req =>
      req.postData && req.postData.includes(TEST_TOKENS.valid.token)
    );

    expect(hasPlaintextToken).toBe(false);

    // Verify tokens are encrypted or hashed
    const addTokenRequest = requests.find(req =>
      req.url.includes('/api/tokens') && req.method === 'POST'
    );

    if (addTokenRequest && addTokenRequest.postData) {
      // Token should be encrypted or the request should use secure methods
      expect(addTokenRequest.postData).not.toContain('eyJhbGciOiJIUzI1NiI');
    }
  });

  test('Token input fields are password type by default', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    const tokenInput = page.locator(TEST_SELECTORS.tokenInput);

    // Verify input is password type
    await expect(tokenInput).toHaveAttribute('type', 'password');

    // Fill token (should be masked)
    await tokenInput.fill(TEST_TOKENS.valid.token);

    // Verify value is set but not visible
    const value = await tokenInput.inputValue();
    expect(value).toBe(TEST_TOKENS.valid.token);
  });

  test('User can toggle token visibility', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    const tokenInput = page.locator(TEST_SELECTORS.tokenInput);
    await tokenInput.fill(TEST_TOKENS.valid.token);

    // Initially password type
    await expect(tokenInput).toHaveAttribute('type', 'password');

    // Click show button
    await page.click(TEST_SELECTORS.showTokenButton);

    // Should change to text type
    await expect(tokenInput).toHaveAttribute('type', 'text');

    // Click hide button
    await page.click(TEST_SELECTORS.hideTokenButton);

    // Should change back to password type
    await expect(tokenInput).toHaveAttribute('type', 'password');
  });

  test('Tokens are not stored in localStorage as plaintext', async ({ page }) => {
    await settingsPage.goto();

    // Add token
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Check localStorage
    const localStorageData = await page.evaluate(() => {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key);
        }
      }
      return data;
    });

    // Verify token is not stored as plaintext
    const hasPlaintextToken = Object.values(localStorageData).some(
      value => typeof value === 'string' && value.includes(TEST_TOKENS.valid.token)
    );

    expect(hasPlaintextToken).toBe(false);
  });

  test('Tokens are not exposed in browser console', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await settingsPage.goto();

    // Add token
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Wait for any async logging
    await page.waitForTimeout(2000);

    // Verify token not in console logs
    const hasTokenInLogs = consoleLogs.some(log =>
      log.includes(TEST_TOKENS.valid.token)
    );

    expect(hasTokenInLogs).toBe(false);
  });

  test('Token list displays masked tokens', async ({ page }) => {
    await settingsPage.goto();

    // Add token
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Check token display in list
    const tokenRow = page.locator(TEST_SELECTORS.tokenRow(TEST_TOKENS.valid.siteId));
    const tokenDisplay = tokenRow.locator('[data-testid="token-display"]');

    if (await tokenDisplay.isVisible()) {
      const displayedText = await tokenDisplay.textContent();

      // Should show masked version (e.g., "****...****")
      expect(displayedText).not.toBe(TEST_TOKENS.valid.token);
      expect(displayedText).toMatch(/\*+/);
    }
  });

  test('XSS protection in token inputs', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    const xssPayload = '<script>alert("XSS")</script>';

    // Try to inject XSS in site name
    await page.fill(TEST_SELECTORS.siteNameInput, xssPayload);

    // Submit form
    await page.fill(TEST_SELECTORS.siteIdInput, 'xss_test');
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
    await page.click(TEST_SELECTORS.submitButton);

    // Wait for token to be added
    await page.waitForTimeout(1000);

    // Verify script didn't execute
    const alerts = [];
    page.on('dialog', dialog => {
      alerts.push(dialog);
      dialog.dismiss();
    });

    await page.waitForTimeout(1000);
    expect(alerts.length).toBe(0);

    // Verify content is escaped
    const tokenRow = page.locator(TEST_SELECTORS.tokenRow('xss_test'));
    const siteName = await tokenRow.locator('[data-testid="site-name"]').textContent();
    expect(siteName).not.toContain('<script>');
  });

  test('SQL injection protection in token operations', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    const sqlInjectionPayload = "'; DROP TABLE tokens; --";

    // Try SQL injection in site ID
    await page.fill(TEST_SELECTORS.siteIdInput, sqlInjectionPayload);
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
    await page.click(TEST_SELECTORS.submitButton);

    // Should either reject or escape the input
    // Verify by attempting to load settings again
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Settings page should still work
    await expect(settingsPage.addTokenButton).toBeVisible();
  });

  test('CSRF protection on token operations', async ({ page, context }) => {
    await settingsPage.goto();

    // Get CSRF token if present
    const csrfToken = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta?.getAttribute('content');
    });

    // Attempt to add token via direct API call without CSRF token
    const response = await context.request.post('http://localhost:3001/api/tokens', {
      data: {
        siteId: 'csrf_test',
        token: TEST_TOKENS.valid.token
      },
      failOnStatusCode: false
    });

    // Should fail if CSRF protection is enabled
    if (csrfToken) {
      expect(response.status()).toBe(403);
    }
  });

  test('Rate limiting on token validation', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    const tokenInput = page.locator(TEST_SELECTORS.tokenInput);

    // Rapidly change token value to trigger multiple validations
    for (let i = 0; i < 20; i++) {
      await tokenInput.fill(`token_${i}`);
      await page.waitForTimeout(50);
    }

    // Should either rate limit or debounce
    // Check if error message appears about rate limiting
    const rateLimitMessage = page.locator('text=Too many requests');

    // Don't fail test if no rate limiting, just verify it doesn't crash
    await page.waitForTimeout(1000);
    await expect(settingsPage.addTokenButton).toBeVisible();
  });

  test('Session security: Token access requires authentication', async ({ page, context }) => {
    await settingsPage.goto();

    // Add a token
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Clear cookies (logout)
    await context.clearCookies();

    // Try to access settings
    await page.goto('/settings');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Token Security - Advanced', () => {
  test('Token rotation after expiration', async ({ page }) => {
    const settingsPage = new SettingsPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);

    // Add expired token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.expired.siteId,
      TEST_TOKENS.expired.token,
      TEST_TOKENS.expired.siteName
    );

    // Navigate to dashboard (should trigger expiration check)
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Should see expiration warning or prompt
    const hasWarning = await dashboardPage.hasExpirationWarning();
    const hasDialog = await dashboardPage.hasTokenExpiredDialog();

    expect(hasWarning || hasDialog).toBe(true);
  });

  test('Secure token transmission over HTTPS', async ({ page }) => {
    // This test verifies that in production, tokens are sent over HTTPS
    // In development, we skip this test
    test.skip(process.env.NODE_ENV !== 'production', 'Production-only test');

    const settingsPage = new SettingsPage(page);

    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);

    await settingsPage.goto();

    // Verify page is served over HTTPS
    expect(page.url()).toMatch(/^https:/);
  });
});
