/**
 * Default Token Provider
 *
 * Manages hardcoded default tokens loaded from environment variables.
 * Provides a fallback authentication mechanism when user tokens are unavailable.
 *
 * Security Notes:
 * - Tokens are loaded from environment variables at build time
 * - Token values are never logged to console
 * - Only site IDs are logged for debugging purposes
 * - Missing tokens generate warnings, not errors
 */

/**
 * Map of site IDs to their default authentication tokens
 * Loaded from environment variables at module initialization
 */
const DEFAULT_TOKENS: Record<string, string> = {
  'ses_falls_city': import.meta.env.VITE_DEFAULT_TOKEN_FALLS_CITY || '',
  'ses_site_2': import.meta.env.VITE_DEFAULT_TOKEN_SITE_2 || '',
};

/**
 * Default site ID to use when no site is specified
 * Can be overridden via VITE_DEFAULT_SITE_ID environment variable
 */
export const DEFAULT_SITE_ID = import.meta.env.VITE_DEFAULT_SITE_ID || 'ses_falls_city';

/**
 * Retrieves the default token for a given site ID
 *
 * @param siteId - The site identifier to look up
 * @returns The default token if available, null otherwise
 *
 * @example
 * ```typescript
 * const token = getDefaultToken('ses_falls_city');
 * if (token) {
 *   // Use token for authentication
 * }
 * ```
 */
export function getDefaultToken(siteId: string): string | null {
  const token = DEFAULT_TOKENS[siteId];

  if (!token) {
    return null;
  }

  return token;
}

/**
 * Checks if a default token exists for the given site ID
 *
 * @param siteId - The site identifier to check
 * @returns True if a default token is configured, false otherwise
 *
 * @example
 * ```typescript
 * if (hasDefaultToken('ses_falls_city')) {
 *   console.log('Default token available');
 * }
 * ```
 */
export function hasDefaultToken(siteId: string): boolean {
  const token = DEFAULT_TOKENS[siteId];
  return Boolean(token && token.length > 0);
}

/**
 * Returns a list of all site IDs that have default tokens configured
 *
 * @returns Array of site IDs with valid default tokens
 *
 * @example
 * ```typescript
 * const sites = listSitesWithDefaultTokens();
 * console.log('Configured sites:', sites);
 * // Output: ['ses_falls_city', 'ses_site_2']
 * ```
 */
export function listSitesWithDefaultTokens(): string[] {
  return Object.keys(DEFAULT_TOKENS).filter(siteId => {
    const token = DEFAULT_TOKENS[siteId];
    return Boolean(token && token.length > 0);
  });
}

/**
 * Validation result for default token configuration
 */
export interface ValidationResult {
  /** Whether all expected tokens are present */
  valid: boolean;
  /** List of site IDs with missing tokens */
  missing: string[];
  /** List of site IDs with valid tokens */
  configured: string[];
}

/**
 * Validates that all expected default tokens are configured
 *
 * @returns Validation result with status and details
 *
 * @example
 * ```typescript
 * const result = validateDefaultTokens();
 * if (!result.valid) {
 *   console.warn('Missing tokens for:', result.missing);
 * }
 * ```
 */
export function validateDefaultTokens(): ValidationResult {
  const allSiteIds = Object.keys(DEFAULT_TOKENS);
  const configured: string[] = [];
  const missing: string[] = [];

  for (const siteId of allSiteIds) {
    if (hasDefaultToken(siteId)) {
      configured.push(siteId);
    } else {
      missing.push(siteId);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    configured,
  };
}

/**
 * Auto-validate default tokens on module load
 * Logs warnings for missing tokens but does not throw errors
 */
function initializeDefaultTokens(): void {
  const validation = validateDefaultTokens();

  if (!validation.valid) {
    console.warn(
      '[DefaultTokens] Missing default tokens for sites:',
      validation.missing.join(', ')
    );
    console.warn(
      '[DefaultTokens] Please configure the following environment variables:',
      validation.missing.map(siteId => {
        // Convert site_id to SITE_ID format for env var names
        const envVarSuffix = siteId
          .replace('ses_', '')
          .toUpperCase()
          .replace(/_/g, '_');
        return `VITE_DEFAULT_TOKEN_${envVarSuffix}`;
      }).join(', ')
    );
  }

  if (validation.configured.length > 0) {
    console.info(
      '[DefaultTokens] Configured default tokens for sites:',
      validation.configured.join(', ')
    );
  } else {
    console.warn('[DefaultTokens] No default tokens configured');
  }

  // Validate default site ID
  if (!hasDefaultToken(DEFAULT_SITE_ID)) {
    console.warn(
      `[DefaultTokens] Default site ID "${DEFAULT_SITE_ID}" has no token configured`
    );
  } else {
    console.info(
      `[DefaultTokens] Default site ID set to: ${DEFAULT_SITE_ID}`
    );
  }
}

// Initialize on module load
initializeDefaultTokens();

/**
 * Export all site IDs for reference
 * This allows consumers to know which sites are expected to have tokens
 */
export const SUPPORTED_SITE_IDS = Object.keys(DEFAULT_TOKENS);

/**
 * Type guard to check if a string is a supported site ID
 *
 * @param siteId - The site identifier to check
 * @returns True if the site ID is in the supported list
 */
export function isSupportedSiteId(siteId: string): boolean {
  return SUPPORTED_SITE_IDS.includes(siteId);
}
