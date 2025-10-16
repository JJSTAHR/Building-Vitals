import { Page, Locator, expect } from '@playwright/test';
import { TEST_SELECTORS } from '../fixtures/testData';

/**
 * Page Object Model for Dashboard Page
 * Encapsulates all dashboard interactions and site switching
 */
export class DashboardPage {
  readonly page: Page;
  readonly siteSelector: Locator;
  readonly currentSite: Locator;
  readonly siteData: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.siteSelector = page.locator(TEST_SELECTORS.siteSelector);
    this.currentSite = page.locator(TEST_SELECTORS.currentSite);
    this.siteData = page.locator(TEST_SELECTORS.siteData);
    this.refreshButton = page.locator('[data-testid="refresh-data"]');
  }

  /**
   * Navigate to dashboard page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Switch to a different site
   */
  async switchSite(siteName: string): Promise<void> {
    await this.siteSelector.click();
    await this.page.click(`text=${siteName}`);

    // Wait for site data to update
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current selected site name
   */
  async getCurrentSiteName(): Promise<string | null> {
    return await this.currentSite.textContent();
  }

  /**
   * Check if expiration warning banner is visible
   */
  async hasExpirationWarning(): Promise<boolean> {
    const banner = this.page.locator(TEST_SELECTORS.alertBanner);
    return await banner.isVisible();
  }

  /**
   * Get expiration warning message
   */
  async getExpirationWarningMessage(): Promise<string | null> {
    const banner = this.page.locator(TEST_SELECTORS.alertBanner);
    if (await banner.isVisible()) {
      return await banner.textContent();
    }
    return null;
  }

  /**
   * Click update token button from warning banner
   */
  async clickUpdateTokenFromWarning(): Promise<void> {
    await this.page.click('text=Update Token');
  }

  /**
   * Check if migration banner is visible
   */
  async hasMigrationBanner(): Promise<boolean> {
    const banner = this.page.locator(TEST_SELECTORS.migrationBanner);
    return await banner.isVisible();
  }

  /**
   * Click migrate now button
   */
  async clickMigrateNow(): Promise<void> {
    await this.page.click('text=Migrate Now');
  }

  /**
   * Refresh dashboard data
   */
  async refreshData(): Promise<void> {
    await this.refreshButton.click();
  }

  /**
   * Wait for data to load
   */
  async waitForDataLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');

    // Wait for loading spinner to disappear
    const spinner = this.page.locator('[data-testid="loading-spinner"]');
    if (await spinner.isVisible({ timeout: 1000 })) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * Get all available sites from selector
   */
  async getAvailableSites(): Promise<string[]> {
    await this.siteSelector.click();

    const siteOptions = await this.page.locator('[role="option"]').all();
    const sites: string[] = [];

    for (const option of siteOptions) {
      const text = await option.textContent();
      if (text) {
        sites.push(text.trim());
      }
    }

    // Close the selector
    await this.page.keyboard.press('Escape');

    return sites;
  }

  /**
   * Verify site data is displayed
   */
  async expectSiteDataVisible(): Promise<void> {
    await expect(this.siteData).toBeVisible();
  }

  /**
   * Verify site data contains text
   */
  async expectSiteDataContains(text: string): Promise<void> {
    await expect(this.siteData).toContainText(text);
  }

  /**
   * Check for token expired dialog
   */
  async hasTokenExpiredDialog(): Promise<boolean> {
    const dialog = this.page.locator('text=Token Expired');
    return await dialog.isVisible({ timeout: 3000 });
  }

  /**
   * Enter new token in expired dialog
   */
  async enterNewTokenInDialog(token: string): Promise<void> {
    await this.page.fill('[name="newToken"]', token);
    await this.page.click('text=Update Token');
  }

  /**
   * Verify success message after token update
   */
  async expectTokenUpdateSuccess(): Promise<void> {
    await expect(this.page.locator('text=Token updated successfully')).toBeVisible();
  }

  /**
   * Get dashboard load time
   */
  async measureLoadTime(): Promise<number> {
    const startTime = Date.now();
    await this.goto();
    await this.waitForDataLoad();
    return Date.now() - startTime;
  }

  /**
   * Navigate to settings from dashboard
   */
  async goToSettings(): Promise<void> {
    await this.page.click(TEST_SELECTORS.settingsLink);
    await this.page.waitForURL('/settings');
  }

  /**
   * Verify dashboard is accessible
   */
  async expectDashboardAccessible(): Promise<void> {
    await expect(this.page).toHaveURL('/dashboard');
    await expect(this.page.locator('h1')).toBeVisible();
  }

  /**
   * Check if no sites are configured
   */
  async hasNoSitesMessage(): Promise<boolean> {
    const message = this.page.locator('text=No sites configured');
    return await message.isVisible();
  }

  /**
   * Verify specific site is selected
   */
  async expectSiteSelected(siteName: string): Promise<void> {
    await expect(this.currentSite).toHaveText(siteName);
  }
}
