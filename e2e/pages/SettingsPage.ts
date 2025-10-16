import { Page, Locator, expect } from '@playwright/test';
import { TEST_SELECTORS, VALIDATION_MESSAGES } from '../fixtures/testData';

/**
 * Page Object Model for Settings Page
 * Encapsulates all token management interactions
 */
export class SettingsPage {
  readonly page: Page;
  readonly addTokenButton: Locator;
  readonly tokenList: Locator;
  readonly siteSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addTokenButton = page.locator(TEST_SELECTORS.addTokenButton);
    this.tokenList = page.locator(TEST_SELECTORS.tokenList);
    this.siteSelector = page.locator(TEST_SELECTORS.siteSelector);
  }

  /**
   * Navigate to settings page
   */
  async goto(): Promise<void> {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Add a new token for a site
   */
  async addToken(
    siteId: string,
    token: string,
    siteName?: string,
    waitForValidation: boolean = true
  ): Promise<void> {
    await this.addTokenButton.click();

    await this.page.fill(TEST_SELECTORS.siteIdInput, siteId);
    if (siteName) {
      await this.page.fill(TEST_SELECTORS.siteNameInput, siteName);
    }
    await this.page.fill(TEST_SELECTORS.tokenInput, token);

    if (waitForValidation) {
      // Wait for token validation to complete
      await this.page.waitForSelector(
        `text=${VALIDATION_MESSAGES.validToken}, text=${VALIDATION_MESSAGES.invalidFormat}`,
        { timeout: 5000 }
      );
    }

    await this.page.click(TEST_SELECTORS.submitButton);
  }

  /**
   * Remove a token by site ID
   */
  async removeToken(siteId: string): Promise<void> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    await tokenRow.locator(TEST_SELECTORS.deleteButton).click();
    await this.page.click(TEST_SELECTORS.confirmButton);
  }

  /**
   * Get the status of a token
   */
  async getTokenStatus(siteId: string): Promise<string | null> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    const statusElement = tokenRow.locator(TEST_SELECTORS.tokenStatus);

    if (await statusElement.isVisible()) {
      return await statusElement.textContent();
    }
    return null;
  }

  /**
   * Check if a token exists in the list
   */
  async hasToken(siteId: string): Promise<boolean> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    return await tokenRow.isVisible();
  }

  /**
   * Get all token site IDs
   */
  async getAllTokenSiteIds(): Promise<string[]> {
    const tokens = await this.page.locator('[data-testid^="token-row-"]').all();
    const siteIds: string[] = [];

    for (const token of tokens) {
      const testId = await token.getAttribute('data-testid');
      if (testId) {
        siteIds.push(testId.replace('token-row-', ''));
      }
    }

    return siteIds;
  }

  /**
   * Update an existing token
   */
  async updateToken(siteId: string, newToken: string): Promise<void> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    await tokenRow.locator('[aria-label="Edit token"]').click();

    await this.page.fill(TEST_SELECTORS.tokenInput, newToken);
    await this.page.click('text=Update Token');
  }

  /**
   * Verify token validation message
   */
  async expectValidationMessage(message: string): Promise<void> {
    await expect(this.page.locator(`text=${message}`)).toBeVisible();
  }

  /**
   * Verify success notification
   */
  async expectSuccessNotification(message: string): Promise<void> {
    await expect(this.page.locator(`text=${message}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Toggle token visibility
   */
  async toggleTokenVisibility(siteId: string): Promise<void> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    const toggleButton = tokenRow.locator(
      `${TEST_SELECTORS.showTokenButton}, ${TEST_SELECTORS.hideTokenButton}`
    );
    await toggleButton.click();
  }

  /**
   * Check if token input is masked
   */
  async isTokenMasked(): Promise<boolean> {
    const tokenInput = this.page.locator(TEST_SELECTORS.tokenInput);
    const type = await tokenInput.getAttribute('type');
    return type === 'password';
  }

  /**
   * Get token expiration warning for a site
   */
  async getExpirationWarning(siteId: string): Promise<string | null> {
    const tokenRow = this.page.locator(TEST_SELECTORS.tokenRow(siteId));
    const warningElement = tokenRow.locator('[data-testid="expiration-warning"]');

    if (await warningElement.isVisible()) {
      return await warningElement.textContent();
    }
    return null;
  }

  /**
   * Verify token list is empty
   */
  async expectEmptyTokenList(): Promise<void> {
    const emptyMessage = this.page.locator('text=No tokens configured');
    await expect(emptyMessage).toBeVisible();
  }

  /**
   * Verify token count
   */
  async expectTokenCount(count: number): Promise<void> {
    const tokens = await this.page.locator('[data-testid^="token-row-"]').all();
    expect(tokens.length).toBe(count);
  }
}
