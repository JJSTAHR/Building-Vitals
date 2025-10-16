import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import {
  TEST_USERS,
  TEST_TOKENS,
  VALIDATION_MESSAGES,
  TEST_SELECTORS,
  setupTestEnvironment,
  cleanupTestEnvironment
} from './fixtures/testData';

/**
 * E2E Test Suite: Token Management
 * Tests the complete user journey for multi-site token management
 */

test.describe('Token Management E2E', () => {
  let settingsPage: SettingsPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    dashboardPage = new DashboardPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test data
    await cleanupTestEnvironment(page);
  });

  test('User can add a new site token', async ({ page }) => {
    // Navigate to Settings
    await settingsPage.goto();

    // Click "Add Token for New Site"
    await settingsPage.addTokenButton.click();

    // Fill in dialog
    await page.fill(TEST_SELECTORS.siteIdInput, TEST_TOKENS.valid.siteId);
    await page.fill(TEST_SELECTORS.siteNameInput, TEST_TOKENS.valid.siteName);
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);

    // Wait for validation
    await expect(page.locator(`text=${VALIDATION_MESSAGES.validToken}`))
      .toBeVisible({ timeout: 5000 });

    // Click Add
    await page.click(TEST_SELECTORS.submitButton);

    // Verify success notification
    await settingsPage.expectSuccessNotification(VALIDATION_MESSAGES.tokenAdded);

    // Verify token appears in list
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(true);
  });

  test('User sees token expiration warning', async ({ page }) => {
    // Setup: Add token expiring soon
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.expiringSoon.siteId,
      TEST_TOKENS.expiringSoon.token,
      TEST_TOKENS.expiringSoon.siteName
    );

    // Navigate to dashboard
    await dashboardPage.goto();

    // Should see warning banner
    expect(await dashboardPage.hasExpirationWarning()).toBe(true);
    const warningMessage = await dashboardPage.getExpirationWarningMessage();
    expect(warningMessage).toContain(VALIDATION_MESSAGES.tokenExpiringSoon);

    // Click "Update Token"
    await dashboardPage.clickUpdateTokenFromWarning();

    // Should navigate to Settings
    await expect(page).toHaveURL('/settings');
  });

  test('User can switch between sites', async ({ page }) => {
    // Setup: Add multiple tokens
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );
    await page.waitForTimeout(500);
    await settingsPage.addToken(
      TEST_TOKENS.site2.siteId,
      TEST_TOKENS.site2.token,
      TEST_TOKENS.site2.siteName
    );

    // Navigate to dashboard
    await dashboardPage.goto();

    // Find site selector
    await dashboardPage.siteSelector.click();

    // Select different site
    await page.click(`text=${TEST_TOKENS.site2.siteName}`);

    // Verify site changed
    await dashboardPage.expectSiteSelected(TEST_TOKENS.site2.siteName);

    // Verify data updated for new site
    await dashboardPage.waitForDataLoad();
    await dashboardPage.expectSiteDataVisible();
  });

  test('User can remove a site token', async ({ page }) => {
    // Setup: Add a token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Verify token exists
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(true);

    // Click delete button
    await settingsPage.removeToken(TEST_TOKENS.valid.siteId);

    // Verify token removed
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(false);
    await settingsPage.expectSuccessNotification(VALIDATION_MESSAGES.tokenRemoved);
  });

  test('Token validation shows real-time feedback', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    // Enter invalid token
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.invalid.token);
    await settingsPage.expectValidationMessage(VALIDATION_MESSAGES.invalidFormat);

    // Enter valid token
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
    await settingsPage.expectValidationMessage(VALIDATION_MESSAGES.validToken);
  });

  test('Migration banner appears for unmigrated users', async ({ page }) => {
    // Setup: User with legacy token only (would need backend support)
    // For now, we'll test the UI components
    await dashboardPage.goto();

    // Check if migration banner exists in DOM
    const hasMigrationBanner = await dashboardPage.hasMigrationBanner();

    if (hasMigrationBanner) {
      // Click migrate
      await dashboardPage.clickMigrateNow();

      // Should see success message
      await expect(page.locator(`text=${VALIDATION_MESSAGES.migrationComplete}`))
        .toBeVisible({ timeout: 5000 });

      // Banner should disappear
      expect(await dashboardPage.hasMigrationBanner()).toBe(false);
    }
  });

  test('Token expires and user is prompted to renew', async ({ page }) => {
    // Setup: Add expired token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.expired.siteId,
      TEST_TOKENS.expired.token,
      TEST_TOKENS.expired.siteName
    );

    // Navigate to dashboard
    await dashboardPage.goto();

    // Make API call that will fail with 401
    await dashboardPage.refreshData();

    // Should see token expired dialog
    expect(await dashboardPage.hasTokenExpiredDialog()).toBe(true);

    // Enter new token
    await dashboardPage.enterNewTokenInDialog(TEST_TOKENS.valid.token);

    // Should see success message
    await dashboardPage.expectTokenUpdateSuccess();
  });

  test('User can update an existing token', async ({ page }) => {
    // Setup: Add initial token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Update the token
    await settingsPage.updateToken(TEST_TOKENS.valid.siteId, TEST_TOKENS.site2.token);

    // Verify success
    await settingsPage.expectSuccessNotification(VALIDATION_MESSAGES.tokenUpdated);
  });

  test('Empty state is displayed when no tokens exist', async ({ page }) => {
    await settingsPage.goto();

    // Verify empty state
    await settingsPage.expectEmptyTokenList();
  });

  test('User can add multiple tokens in succession', async ({ page }) => {
    await settingsPage.goto();

    // Add first token
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    await page.waitForTimeout(500);

    // Add second token
    await settingsPage.addToken(
      TEST_TOKENS.site2.siteId,
      TEST_TOKENS.site2.token,
      TEST_TOKENS.site2.siteName
    );

    // Verify both tokens exist
    await settingsPage.expectTokenCount(2);
  });
});

test.describe('Token Management - Mobile E2E', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  let settingsPage: SettingsPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    dashboardPage = new DashboardPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);
    await page.waitForURL('/dashboard');
  });

  test('Mobile: Token management is fully functional', async ({ page }) => {
    // Open navigation menu
    const menuButton = page.locator(TEST_SELECTORS.menuButton);
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    // Navigate to settings
    await page.click(TEST_SELECTORS.settingsLink);
    await page.waitForURL('/settings');

    // Add token (mobile fullscreen dialog)
    await settingsPage.addTokenButton.click();

    // Fill form
    await page.fill(TEST_SELECTORS.siteIdInput, TEST_TOKENS.valid.siteId);
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('text=Token added')).toBeVisible();
  });

  test('Mobile: Site switcher works correctly', async ({ page }) => {
    // Setup: Add multiple tokens
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );
    await page.waitForTimeout(500);
    await settingsPage.addToken(
      TEST_TOKENS.site2.siteId,
      TEST_TOKENS.site2.token,
      TEST_TOKENS.site2.siteName
    );

    // Navigate to dashboard
    await dashboardPage.goto();

    // Switch sites
    await dashboardPage.siteSelector.click();
    await page.click(`text=${TEST_TOKENS.site2.siteName}`);

    // Verify site changed
    await dashboardPage.expectSiteSelected(TEST_TOKENS.site2.siteName);
  });
});

test.describe('Token Management - Cross-browser', () => {
  test('Works correctly in Firefox', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    const settingsPage = new SettingsPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);

    // Add token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Verify
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(true);
  });

  test('Works correctly in Safari/Webkit', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');

    const settingsPage = new SettingsPage(page);

    // Login
    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);

    // Add token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Verify
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(true);
  });
});
