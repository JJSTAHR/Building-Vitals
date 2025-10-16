/**
 * Token Type Definitions
 *
 * Defines types for token management, resolution, and caching across the application.
 * Supports multi-token authentication with priority fallback chains.
 */

/**
 * Token source identifier - indicates where a token was retrieved from
 */
export enum TokenSource {
  /** Token configured specifically for this site by the user */
  SITE_SPECIFIC = 'site_specific',
  /** Default token from environment configuration */
  DEFAULT = 'default',
  /** Legacy global token (backward compatibility) */
  GLOBAL = 'global',
  /** No token found in any source */
  NONE = 'none',
}

/**
 * Cached token entry with metadata
 */
export interface CachedToken {
  /** The actual authentication token */
  token: string;
  /** Unix timestamp when this token was cached */
  timestamp: number;
  /** Source where this token was retrieved from */
  source: TokenSource;
  /** Optional expiry timestamp (for future use) */
  expiresAt?: number;
}

/**
 * Token resolution result with detailed information
 */
export interface TokenResolutionResult {
  /** The resolved token, or null if none found */
  token: string | null;
  /** Source where the token was found */
  source: TokenSource;
  /** Whether this result came from cache */
  fromCache: boolean;
  /** Resolution time in milliseconds */
  resolutionTimeMs: number;
}

/**
 * Token resolver configuration options
 */
export interface TokenResolverConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Enable performance metrics tracking */
  trackMetrics?: boolean;
  /** Custom logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStatistics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Current cache size */
  size: number;
  /** Number of cache evictions performed */
  evictions: number;
}

/**
 * Event emitted when no token is found for a site
 */
export interface TokenMissingEvent {
  /** Site ID that has no token */
  siteId: string;
  /** Timestamp of the event */
  timestamp: number;
  /** Sources checked during resolution */
  sourcesChecked: TokenSource[];
}

/**
 * Interface for token storage providers (e.g., MultiTokenManager)
 */
export interface ITokenProvider {
  /**
   * Retrieve a token for the given site ID
   * @param siteId - Site identifier or '__global__' for global token
   * @returns Promise resolving to token string or null
   */
  getToken(siteId: string): Promise<string | null>;

  /**
   * Store a token for the given site ID
   * @param siteId - Site identifier
   * @param token - Token to store
   */
  setToken?(siteId: string, token: string): Promise<void>;

  /**
   * Delete a token for the given site ID
   * @param siteId - Site identifier
   */
  deleteToken?(siteId: string): Promise<void>;

  /**
   * List all site IDs with stored tokens
   */
  listSites?(): Promise<string[]>;
}

/**
 * Token validation result
 */
export interface TokenValidation {
  /** Whether the token is valid */
  valid: boolean;
  /** Validation errors if invalid */
  errors?: string[];
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Days until expiration */
  daysUntilExpiry?: number | null;
  /** Whether to show warning (< 7 days) */
  shouldWarn?: boolean;
  /** Token metadata (if available) */
  metadata?: Record<string, unknown>;
}

/**
 * Site token data with metadata
 */
export interface SiteToken {
  /** Unique site identifier */
  siteId: string;
  /** Human-readable site name */
  siteName: string;
  /** The authentication token */
  token: string;
  /** When this token was added */
  addedAt: number;
  /** Token expiration timestamp (if available) */
  expiresAt?: number;
  /** Whether this is the default/primary site */
  isDefault?: boolean;
  /** Last validation timestamp */
  lastValidated?: number;
}

/**
 * Token status for UI display
 */
export type TokenStatus = 'active' | 'warning' | 'urgent' | 'expired';
