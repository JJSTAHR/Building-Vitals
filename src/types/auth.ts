/**
 * Authentication and Token Type Definitions
 *
 * Defines types for token management and authentication across the application.
 * Used by UI components for token status display and management.
 */

/**
 * Site token with metadata
 */
export interface SiteToken {
  siteId: string;
  siteName: string;
  token: string;
  tokenHash: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  isDefault: boolean;
  lastUsed: Date;
  metadata?: {
    source: 'user' | 'default' | 'admin';
    notes?: string;
  };
}

/**
 * Token validation result
 * Used by TokenStatusBadge and TokenExpiryWarning components
 */
export interface TokenValidation {
  /** Whether the token is valid */
  valid: boolean;
  /** Whether the token is expired */
  expired: boolean;
  /** Token expiration date */
  expiresAt: Date | null;
  /** Days until token expires (null if no expiration) */
  daysUntilExpiry?: number;
  /** Reason for invalid token */
  reason?: string;
  /** Token metadata (if available) */
  metadata?: Record<string, unknown>;
}

/**
 * Token status levels
 */
export type TokenStatus = 'active' | 'warning' | 'urgent' | 'critical' | 'expired' | 'invalid';

/**
 * Token source identifier
 */
export type TokenSource = 'site-specific' | 'default' | 'global' | 'prompt';

/**
 * Token resolution result
 */
export interface TokenResolutionResult {
  token: string | null;
  source: TokenSource | null;
  cached: boolean;
  resolutionTime: number;
}

/**
 * Token refresh event
 */
export interface TokenRefreshEvent {
  siteId: string;
  timestamp: number;
  reason: 'unauthorized' | 'forbidden' | 'expired' | 'manual';
}

/**
 * Token error event
 */
export interface TokenErrorEvent {
  siteId: string;
  error: Error;
  timestamp: number;
  requestUrl?: string;
}
