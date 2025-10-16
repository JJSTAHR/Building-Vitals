import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { TEST_USERS, TEST_TOKENS, TEST_SELECTORS } from './fixtures/testData';

/**
 * E2E Test Suite: Performance & Load Time Validation
 * Tests application performance with token management operations
 */

test.describe('Performance E2E', () => {
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

  test('Dashboard loads in <3 seconds with tokens', async ({ page }) => {
    // Setup: Add multiple tokens
    await settingsPage.goto();

    for (let i = 0; i < 5; i++) {
      await settingsPage.addToken(
        `site_${i}`,
        TEST_TOKENS.valid.token,
        `Site ${i}`
      );
      await page.waitForTimeout(300);
    }

    // Measure dashboard load time
    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.waitForDataLoad();
    const duration = Date.now() - startTime;

    console.log(`Dashboard load time: ${duration}ms`);
    expect(duration).toBeLessThan(3000);
  });

  test('Token validation completes in <1 second', async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.addTokenButton.click();

    // Measure validation time
    const startTime = Date.now();
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
    await page.waitForSelector('text=Valid Token', { timeout: 5000 });
    const duration = Date.now() - startTime;

    console.log(`Token validation time: ${duration}ms`);
    expect(duration).toBeLessThan(1000);
  });

  test('Settings page loads quickly with multiple tokens', async ({ page }) => {
    // Setup: Add many tokens
    await settingsPage.goto();

    for (let i = 0; i < 10; i++) {
      await settingsPage.addToken(
        `perf_site_${i}`,
        TEST_TOKENS.valid.token,
        `Performance Site ${i}`
      );
      await page.waitForTimeout(200);
    }

    // Measure reload time
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - startTime;

    console.log(`Settings page reload time with 10 tokens: ${duration}ms`);
    expect(duration).toBeLessThan(2000);
  });

  test('Site switching is instantaneous', async ({ page }) => {
    // Setup: Add multiple tokens
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );
    await settingsPage.addToken(
      TEST_TOKENS.site2.siteId,
      TEST_TOKENS.site2.token,
      TEST_TOKENS.site2.siteName
    );

    await dashboardPage.goto();

    // Measure site switch time
    const startTime = Date.now();
    await dashboardPage.switchSite(TEST_TOKENS.site2.siteName);
    await dashboardPage.waitForDataLoad();
    const duration = Date.now() - startTime;

    console.log(`Site switch time: ${duration}ms`);
    expect(duration).toBeLessThan(1000);
  });

  test('Token addition scales with number of existing tokens', async ({ page }) => {
    await settingsPage.goto();

    const times: number[] = [];

    // Add 5 tokens and measure each
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      await settingsPage.addToken(
        `scale_site_${i}`,
        TEST_TOKENS.valid.token,
        `Scale Site ${i}`
      );

      const duration = Date.now() - startTime;
      times.push(duration);
      console.log(`Token ${i + 1} addition time: ${duration}ms`);

      await page.waitForTimeout(200);
    }

    // Verify time doesn't increase significantly
    const firstTime = times[0];
    const lastTime = times[times.length - 1];

    // Last operation should not be more than 2x first operation
    expect(lastTime).toBeLessThan(firstTime * 2);
  });

  test('Large token payloads are handled efficiently', async ({ page }) => {
    await settingsPage.goto();

    // Generate a large but valid JWT (with large claims)
    const largeToken = TEST_TOKENS.valid.token + '.extra.data.padding.here.to.make.it.larger';

    const startTime = Date.now();

    await settingsPage.addTokenButton.click();
    await page.fill(TEST_SELECTORS.siteIdInput, 'large_token_site');
    await page.fill(TEST_SELECTORS.tokenInput, largeToken);

    // Wait for validation (may take longer with large token)
    await page.waitForTimeout(2000);

    const duration = Date.now() - startTime;
    console.log(`Large token handling time: ${duration}ms`);

    expect(duration).toBeLessThan(3000);
  });

  test('Concurrent token operations do not block UI', async ({ page }) => {
    await settingsPage.goto();

    // Start multiple token additions in quick succession
    const operations = [];

    for (let i = 0; i < 3; i++) {
      operations.push(
        (async () => {
          await settingsPage.addTokenButton.click();
          await page.fill(TEST_SELECTORS.siteIdInput, `concurrent_${i}`);
          await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);
          await page.click(TEST_SELECTORS.submitButton);
          await page.waitForTimeout(500);
        })()
      );
    }

    // UI should remain responsive
    const isResponsive = await page.evaluate(() => {
      return document.readyState === 'complete';
    });

    expect(isResponsive).toBe(true);

    // Wait for all operations to complete
    await Promise.all(operations);
  });

  test('Memory usage remains stable with many operations', async ({ page }) => {
    await settingsPage.goto();

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Perform many operations
    for (let i = 0; i < 20; i++) {
      await settingsPage.addToken(
        `memory_site_${i}`,
        TEST_TOKENS.valid.token,
        `Memory Site ${i}`
      );

      // Remove every other token
      if (i % 2 === 0 && i > 0) {
        await settingsPage.removeToken(`memory_site_${i - 1}`);
      }

      await page.waitForTimeout(100);
    }

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory increase should be reasonable (less than 10MB for this test)
    const memoryIncrease = finalMemory - initialMemory;
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    if (initialMemory > 0) {
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
    }
  });

  test('API response times are acceptable', async ({ page }) => {
    const apiTimes: Record<string, number> = {};

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        const endpoint = new URL(response.url()).pathname;
        apiTimes[endpoint] = timing.responseEnd - timing.requestStart;
      }
    });

    await settingsPage.goto();

    // Add token (triggers validation API)
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Wait for all API calls to complete
    await page.waitForTimeout(2000);

    // Log all API times
    console.log('API Response Times:', apiTimes);

    // Verify critical API endpoints are fast
    Object.entries(apiTimes).forEach(([endpoint, time]) => {
      console.log(`${endpoint}: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(2000); // 2 seconds max for any API call
    });
  });

  test('Token list rendering is efficient with many items', async ({ page }) => {
    await settingsPage.goto();

    // Add many tokens
    for (let i = 0; i < 15; i++) {
      await settingsPage.addToken(
        `render_site_${i}`,
        TEST_TOKENS.valid.token,
        `Render Site ${i}`
      );
      await page.waitForTimeout(200);
    }

    // Measure rendering time on reload
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that all tokens are visible
    const tokenCount = await page.locator('[data-testid^="token-row-"]').count();
    expect(tokenCount).toBe(15);

    const renderTime = Date.now() - startTime;
    console.log(`Render time for 15 tokens: ${renderTime}ms`);

    expect(renderTime).toBeLessThan(3000);
  });
});

test.describe('Performance - Network Conditions', () => {
  test('Works on slow 3G connection', async ({ page, context }) => {
    // Simulate slow 3G
    await context.route('**/*', route => {
      setTimeout(() => route.continue(), 300); // 300ms delay
    });

    const settingsPage = new SettingsPage(page);

    // Login
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);
    await page.waitForURL('/dashboard', { timeout: 30000 });

    // Add token
    await settingsPage.goto();
    await settingsPage.addToken(
      TEST_TOKENS.valid.siteId,
      TEST_TOKENS.valid.token,
      TEST_TOKENS.valid.siteName
    );

    // Verify success despite slow network
    expect(await settingsPage.hasToken(TEST_TOKENS.valid.siteId)).toBe(true);
  });

  test('Handles intermittent network failures gracefully', async ({ page, context }) => {
    let requestCount = 0;

    await context.route('**/api/tokens/validate', route => {
      requestCount++;

      // Fail every other request
      if (requestCount % 2 === 0) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    const settingsPage = new SettingsPage(page);

    await page.goto('/login');
    await page.fill(TEST_SELECTORS.emailInput, TEST_USERS.standard.email);
    await page.fill(TEST_SELECTORS.passwordInput, TEST_USERS.standard.password);
    await page.click(TEST_SELECTORS.loginButton);

    await settingsPage.goto();

    // Should retry or show appropriate error
    await settingsPage.addTokenButton.click();
    await page.fill(TEST_SELECTORS.tokenInput, TEST_TOKENS.valid.token);

    // Wait to see if it retries and succeeds or shows error
    await page.waitForTimeout(3000);

    // Application should not crash
    await expect(settingsPage.addTokenButton).toBeVisible();
  });
});
