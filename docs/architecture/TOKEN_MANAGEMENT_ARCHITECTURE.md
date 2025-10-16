# Token Management Architecture Design

## Executive Summary

This document outlines a comprehensive token management architecture for the Building Vitals application that supports:
- Default hardcoded site/device tokens
- Multiple site/device token management
- Automatic token injection across all API calls
- Token expiration detection and refresh workflows
- Secure storage mechanisms appropriate for web applications
- Multi-tenancy support

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Dashboard    │  │ Settings     │  │ Chart        │              │
│  │ Components   │  │ Components   │  │ Components   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         └──────────────────┴──────────────────┘                      │
│                            │                                          │
├────────────────────────────┼──────────────────────────────────────┤
│                     TOKEN MANAGEMENT LAYER                           │
├──────────────────────────────────────────────────────────────────────┤
│                            │                                          │
│  ┌─────────────────────────▼────────────────────────────┐           │
│  │         TokenManagerService (Singleton)               │           │
│  ├───────────────────────────────────────────────────────┤           │
│  │ - getCurrentToken()                                   │           │
│  │ - setCurrentSite(siteId)                              │           │
│  │ - addSiteToken(siteId, token)                         │           │
│  │ - removeSiteToken(siteId)                             │           │
│  │ - validateToken(token)                                │           │
│  │ - isTokenExpired(token)                               │           │
│  │ - getTokenMetadata(token)                             │           │
│  │ - refreshToken(siteId)                                │           │
│  └───────────┬───────────────────────┬───────────────────┘           │
│              │                       │                                │
│  ┌───────────▼──────────┐  ┌────────▼──────────────┐                │
│  │ TokenStorageService  │  │ TokenValidationService │                │
│  ├──────────────────────┤  ├────────────────────────┤                │
│  │ - saveToken()        │  │ - decodeJWT()          │                │
│  │ - loadTokens()       │  │ - checkExpiry()        │                │
│  │ - encrypt()          │  │ - validateFormat()     │                │
│  │ - decrypt()          │  │ - extractIdentity()    │                │
│  └──────────┬───────────┘  └────────┬───────────────┘                │
│             │                       │                                 │
├─────────────┼───────────────────────┼─────────────────────────────┤
│             │        API LAYER      │                               │
├─────────────┼───────────────────────┼─────────────────────────────┤
│             │                       │                               │
│  ┌──────────▼───────────────────────▼─────────────┐                │
│  │         API Interceptor Middleware              │                │
│  ├─────────────────────────────────────────────────┤                │
│  │ - Request Interceptor                           │                │
│  │   • Inject X-ACE-Token header                   │                │
│  │   • Handle token refresh                        │                │
│  │ - Response Interceptor                          │                │
│  │   • Detect 401/403 errors                       │                │
│  │   • Trigger re-authentication                   │                │
│  └───────────────────┬─────────────────────────────┘                │
│                      │                                               │
│  ┌───────────────────▼───────────────┐                              │
│  │   cloudflareWorkerClient          │                              │
│  │   batchApiService                 │                              │
│  │   aceApiClient                    │                              │
│  └───────────────────┬───────────────┘                              │
│                      │                                               │
├──────────────────────┼───────────────────────────────────────────┤
│        STORAGE LAYER │                                             │
├──────────────────────┼───────────────────────────────────────────┤
│                      │                                             │
│  ┌───────────────────▼──────────────┐  ┌─────────────────────┐   │
│  │ IndexedDB (Encrypted Tokens)     │  │ Firestore (Backend) │   │
│  │ - tokens: Map<siteId, encrypted> │  │ - User tokens       │   │
│  │ - metadata: Map<siteId, info>    │  │ - Token history     │   │
│  │ - currentSite: string            │  │ - Audit logs        │   │
│  └──────────────────────────────────┘  └─────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. TokenManagerService (Core Service)

**Responsibilities:**
- Centralized token management
- Site/device token mapping
- Default token handling
- Token lifecycle management

**Interface:**
```typescript
interface TokenManagerService {
  // Token retrieval
  getCurrentToken(): string | null;
  getTokenForSite(siteId: string): string | null;
  getDefaultToken(): string | null;

  // Site management
  setCurrentSite(siteId: string): void;
  getCurrentSite(): string | null;

  // Token CRUD operations
  addSiteToken(siteId: string, siteName: string, token: string, isDefault?: boolean): Promise<void>;
  updateSiteToken(siteId: string, token: string): Promise<void>;
  removeSiteToken(siteId: string): Promise<void>;
  setDefaultSite(siteId: string): void;

  // Token validation
  validateToken(token: string): boolean;
  isTokenExpired(token: string): boolean;
  getTokenMetadata(token: string): TokenMetadata;

  // Token refresh
  refreshToken(siteId: string, newToken: string): Promise<void>;

  // Bulk operations
  getAllTokens(): SiteToken[];
  clearAllTokens(): Promise<void>;

  // Event listeners
  onTokenExpired(callback: (siteId: string) => void): void;
  onTokenChanged(callback: (siteId: string) => void): void;
}
```

### 2. TokenStorageService (Storage Layer)

**Responsibilities:**
- Secure token persistence
- Encryption/decryption
- Multi-layer storage strategy

**Storage Strategy:**
```
Primary Storage: IndexedDB (encrypted)
├── Advantages: Large storage, structured, no size limits
├── Encryption: Web Crypto API (AES-GCM-256)
└── Fallback: LocalStorage (encrypted, size-limited)

Backend Sync: Firestore
├── Advantages: Cross-device sync, backup
├── Encryption: Server-side encryption
└── Usage: Optional sync for authenticated users
```

**Interface:**
```typescript
interface TokenStorageService {
  // Storage operations
  saveToken(siteId: string, token: string, metadata: TokenMetadata): Promise<void>;
  loadToken(siteId: string): Promise<EncryptedToken | null>;
  loadAllTokens(): Promise<Map<string, EncryptedToken>>;
  deleteToken(siteId: string): Promise<void>;

  // Encryption
  encrypt(plaintext: string): Promise<EncryptedData>;
  decrypt(encrypted: EncryptedData): Promise<string>;

  // Metadata
  saveMetadata(siteId: string, metadata: TokenMetadata): Promise<void>;
  loadMetadata(siteId: string): Promise<TokenMetadata | null>;

  // Sync operations
  syncToBackend(userId: string): Promise<void>;
  syncFromBackend(userId: string): Promise<void>;
}
```

### 3. TokenValidationService (Validation Layer)

**Responsibilities:**
- JWT decoding and validation
- Expiry detection
- Token format validation

**Interface:**
```typescript
interface TokenValidationService {
  // JWT operations
  decodeJWT(token: string): JWTPayload | null;
  validateJWTFormat(token: string): boolean;

  // Expiry management
  checkExpiry(token: string): ExpiryStatus;
  getExpiryDate(token: string): Date | null;
  getTimeUntilExpiry(token: string): number; // milliseconds

  // Identity extraction
  extractIdentity(token: string): string | null;
  extractClaims(token: string): Record<string, any>;

  // Testing
  testToken(token: string, baseUrl: string): Promise<TokenTestResult>;
}
```

### 4. API Interceptor Middleware

**Responsibilities:**
- Automatic token injection
- Token refresh on expiry
- Error handling and retry logic

**Implementation:**
```typescript
class TokenInterceptor {
  constructor(private tokenManager: TokenManagerService) {}

  // Request interceptor
  async interceptRequest(config: RequestConfig): Promise<RequestConfig> {
    const token = this.tokenManager.getCurrentToken();

    if (!token) {
      throw new Error('No token available');
    }

    // Check expiry before request
    if (this.tokenManager.isTokenExpired(token)) {
      await this.handleExpiredToken();
      // Re-get token after refresh
      const newToken = this.tokenManager.getCurrentToken();
      if (!newToken) throw new Error('Token refresh failed');
      config.headers['X-ACE-Token'] = newToken;
    } else {
      config.headers['X-ACE-Token'] = token;
    }

    return config;
  }

  // Response interceptor
  async interceptResponse(response: Response): Promise<Response> {
    if (response.status === 401 || response.status === 403) {
      // Token is invalid or expired
      await this.handleUnauthorized();
    }
    return response;
  }

  private async handleExpiredToken(): Promise<void> {
    // Trigger token refresh UI
    this.tokenManager.emit('token:expired', {
      siteId: this.tokenManager.getCurrentSite()
    });
  }

  private async handleUnauthorized(): Promise<void> {
    // Mark token as invalid and trigger re-entry
    this.tokenManager.emit('token:invalid', {
      siteId: this.tokenManager.getCurrentSite()
    });
  }
}
```

## Data Models

### 1. SiteToken Model

```typescript
interface SiteToken {
  // Identity
  siteId: string;
  siteName: string;
  deviceId?: string; // Optional device-specific token

  // Token data
  token: string; // Encrypted in storage
  tokenHash: string; // For deduplication

  // Metadata
  identity?: string; // Extracted from JWT
  expiresAt?: Date;
  issuedAt?: Date;

  // Tracking
  addedAt: Date;
  lastUsed?: Date;
  lastValidated?: Date;
  useCount: number;

  // Status
  isDefault: boolean;
  isValid: boolean;
  status: TokenStatus; // 'active' | 'expired' | 'invalid' | 'revoked'

  // Refresh
  refreshable: boolean;
  refreshEndpoint?: string;
  refreshMetadata?: Record<string, any>;
}

type TokenStatus = 'active' | 'expired' | 'invalid' | 'revoked';

interface TokenMetadata {
  siteId: string;
  siteName: string;
  identity?: string;
  expiresAt?: Date;
  isDefault: boolean;
  status: TokenStatus;
}

interface EncryptedToken {
  iv: string; // Initialization vector
  ciphertext: string; // Encrypted token
  authTag: string; // Authentication tag
  algorithm: string; // 'AES-GCM-256'
  metadata: TokenMetadata;
}

interface JWTPayload {
  identity?: string;
  exp?: number; // Expiration timestamp
  iat?: number; // Issued at timestamp
  nbf?: number; // Not before timestamp
  [key: string]: any;
}

interface ExpiryStatus {
  isExpired: boolean;
  expiresAt: Date | null;
  timeRemaining: number; // milliseconds, negative if expired
  expiresIn: string; // Human-readable (e.g., "2 days", "expired 3 hours ago")
}

interface TokenTestResult {
  success: boolean;
  valid: boolean;
  message: string;
  details?: {
    sitesFound?: number;
    identity?: string;
    expiresAt?: Date;
    error?: string;
  };
}
```

### 2. Token Storage Schema (IndexedDB)

```typescript
// Database schema
interface TokenDatabase {
  name: 'building-vitals-tokens';
  version: 1;
  stores: {
    tokens: {
      keyPath: 'siteId';
      indexes: {
        byStatus: 'status';
        byExpiry: 'expiresAt';
        byDefault: 'isDefault';
      };
    };
    metadata: {
      keyPath: 'key';
      // Stores: currentSite, defaultSite, lastSync, etc.
    };
  };
}
```

### 3. Backend Storage (Firestore)

```typescript
// Firestore collection structure
interface UserTokenDocument {
  userId: string;
  tokens: {
    [siteId: string]: {
      tokenHash: string; // For sync without exposing token
      metadata: TokenMetadata;
      encryptedToken?: string; // Optional backend encryption
      syncedAt: Timestamp;
    };
  };
  currentSite: string;
  defaultSite: string;
  updatedAt: Timestamp;
}
```

## UI/UX Flow Design

### 1. First-Time Setup Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Welcome Screen                                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Welcome to Building Vitals                                  │
│                                                               │
│  This application requires an ACE IoT API token to access    │
│  your building data.                                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Use Default Token                                    │    │
│  │ (Hardcoded: ses_falls_city)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Enter Custom Token                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Token Entry (if custom token selected)              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Enter Your ACE IoT Token                                    │
│                                                               │
│  Site ID:     [___________________________]                  │
│  Site Name:   [___________________________]                  │
│  API Token:   [___________________________]                  │
│               [___________________________]                  │
│               [___________________________]                  │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Test     │  │ Skip     │  │ Continue │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 3: Token Validation                                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ✓ Token validated successfully                              │
│  ✓ Identity: ses_falls_city_admin                            │
│  ✓ Expires: Dec 31, 2025 11:59 PM                            │
│  ✓ Sites accessible: 1                                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Continue to Dashboard                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 2. Token Management UI (Settings Page)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Settings > Token Management                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────┐  ┌──────────────────┐ │
│  │ Site Tokens                              │  │ + Add New Token  │ │
│  └─────────────────────────────────────────┘  └──────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [DEFAULT] SES Falls City Medical Center (ses_falls_city)    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Identity: ses_falls_city_admin                              │   │
│  │ Token:    ●●●●●●●●●●●●●●●●●●●●  [👁] [📋]                    │   │
│  │ Added:    Jan 15, 2025 10:30 AM                             │   │
│  │ Expires:  Dec 31, 2025 11:59 PM (340 days remaining) ✓     │   │
│  │ Last Used: 5 minutes ago                                    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ [Test] [Edit] [Delete]                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SES Lincoln Hospital (ses_lincoln)                          │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Identity: ses_lincoln_readonly                              │   │
│  │ Token:    ●●●●●●●●●●●●●●●●●●●●  [👁] [📋]                    │   │
│  │ Added:    Jan 20, 2025 2:15 PM                              │   │
│  │ Expires:  Jun 15, 2025 11:59 PM ⚠️ Expires in 23 days      │   │
│  │ Last Used: 2 hours ago                                      │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ [Test] [Set as Default] [Edit] [Refresh] [Delete]          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SES Omaha Clinic (ses_omaha)                                │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Identity: ses_omaha_admin                                   │   │
│  │ Token:    ●●●●●●●●●●●●●●●●●●●●  [👁] [📋]                    │   │
│  │ Added:    Dec 10, 2024 9:00 AM                              │   │
│  │ Expires:  Jan 10, 2025 11:59 PM ❌ Expired 5 days ago       │   │
│  │ Last Used: Never                                            │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ [Refresh Token Required] [Edit] [Delete]                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Token Expiration Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Scenario 1: Token Expires Soon (7 days warning)             │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ⚠️ Token Expiring Soon                                      │
│                                                               │
│  Your token for "SES Lincoln Hospital" will expire in        │
│  7 days (Jun 15, 2025).                                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Refresh Token Now                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Remind Me Tomorrow                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 2: Token Expired (blocking)                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ❌ Token Expired                                            │
│                                                               │
│  Your token for "SES Omaha Clinic" has expired.             │
│  Please enter a new token to continue accessing this site.   │
│                                                               │
│  New Token:  [___________________________]                   │
│              [___________________________]                   │
│              [___________________________]                   │
│                                                               │
│  ┌──────────┐  ┌──────────┐                                 │
│  │ Update   │  │ Cancel   │                                 │
│  └──────────┘  └──────────┘                                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 3: API Request Failed (401/403)                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ⚠️ Authentication Failed                                    │
│                                                               │
│  Your token for "SES Falls City" is no longer valid.        │
│                                                               │
│  Possible reasons:                                            │
│  • Token has been revoked                                    │
│  • Token expired unexpectedly                                │
│  • Permissions changed                                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Enter New Token                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Switch to Another Site                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 4. Add Token Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Add New Site Token                                   [X]     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Site ID *                                                    │
│  [_________________________________]                          │
│  Example: ses_falls_city or 309                              │
│                                                               │
│  Site Name *                                                  │
│  [_________________________________]                          │
│  Example: SES Falls City Medical Center                      │
│                                                               │
│  Device ID (Optional)                                        │
│  [_________________________________]                          │
│  Leave blank for site-level token                            │
│                                                               │
│  ACE API Token *                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │                                                     │     │
│  │  Paste your JWT token from ACE IoT                 │     │
│  │                                                     │     │
│  │                                                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ☑ Set as default site                                       │
│  ☐ Test token before saving                                  │
│                                                               │
│  Token Info (auto-detected):                                 │
│  Identity: ses_falls_city_admin                              │
│  Expires: Dec 31, 2025 11:59 PM                              │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Test     │  │ Cancel   │  │ Add      │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5. Site Selector with Token Status

```
┌─────────────────────────────────────────┐
│ Select Site                      [▼]    │
├─────────────────────────────────────────┤
│ ✓ [DEFAULT] SES Falls City              │
│   └─ Valid • Expires in 340 days        │
│                                          │
│ ⚠️ SES Lincoln Hospital                 │
│   └─ Expires in 23 days                 │
│                                          │
│ ❌ SES Omaha Clinic                     │
│   └─ Expired 5 days ago                 │
│                                          │
│ ──────────────────────────────          │
│ + Add New Site                           │
│ ⚙️ Manage Tokens                        │
└─────────────────────────────────────────┘
```

## API Patterns

### 1. Token Injection Pattern

```typescript
// Automatic token injection in all API calls
const makeApiCall = async (endpoint: string, options?: RequestInit) => {
  const tokenManager = TokenManagerService.getInstance();
  const token = tokenManager.getCurrentToken();

  if (!token) {
    throw new TokenMissingError('No token available for current site');
  }

  // Check expiry proactively
  if (tokenManager.isTokenExpired(token)) {
    const refreshed = await tokenManager.attemptTokenRefresh();
    if (!refreshed) {
      throw new TokenExpiredError('Token expired and refresh failed');
    }
  }

  const headers = {
    ...options?.headers,
    'X-ACE-Token': token,
  };

  try {
    const response = await fetch(endpoint, { ...options, headers });

    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      await tokenManager.handleAuthFailure();
      throw new TokenInvalidError('Token is invalid or revoked');
    }

    return response;
  } catch (error) {
    if (error instanceof TokenInvalidError) {
      // Show token re-entry dialog
      eventBus.emit('token:invalid', {
        siteId: tokenManager.getCurrentSite(),
      });
    }
    throw error;
  }
};
```

### 2. Token Refresh Pattern

```typescript
// Automatic refresh when token is about to expire
class TokenRefreshManager {
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  scheduleRefresh(siteId: string, token: string) {
    const metadata = this.tokenManager.getTokenMetadata(token);
    if (!metadata.expiresAt) return;

    // Schedule refresh 7 days before expiry
    const refreshTime = metadata.expiresAt.getTime() - (7 * 24 * 60 * 60 * 1000);
    const now = Date.now();

    if (refreshTime <= now) {
      // Already past refresh time
      this.showRefreshPrompt(siteId);
      return;
    }

    const timer = setTimeout(() => {
      this.showRefreshPrompt(siteId);
    }, refreshTime - now);

    this.refreshTimers.set(siteId, timer);
  }

  private showRefreshPrompt(siteId: string) {
    eventBus.emit('token:refresh-needed', { siteId });
  }
}
```

### 3. Multi-Token API Pattern

```typescript
// Support for making requests to multiple sites in parallel
class MultiSiteApiClient {
  async fetchMultipleSites(siteIds: string[]): Promise<Map<string, any>> {
    const results = new Map();

    await Promise.allSettled(
      siteIds.map(async (siteId) => {
        try {
          // Switch context to this site's token
          this.tokenManager.setCurrentSite(siteId);
          const token = this.tokenManager.getCurrentToken();

          if (!token || this.tokenManager.isTokenExpired(token)) {
            results.set(siteId, { error: 'Token unavailable or expired' });
            return;
          }

          const data = await this.fetchSiteData(siteId, token);
          results.set(siteId, data);
        } catch (error) {
          results.set(siteId, { error: error.message });
        }
      })
    );

    return results;
  }
}
```

## Security Considerations

### 1. Encryption Strategy

**Client-Side Encryption (IndexedDB):**
```typescript
// Web Crypto API for AES-GCM encryption
class TokenEncryption {
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext: string): Promise<EncryptedData> {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from user's session ID + device fingerprint
    const password = await this.getDerivedPassword();
    const key = await this.deriveKey(password, salt);

    // Encrypt
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    return {
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(new Uint8Array(ciphertext)),
      algorithm: 'AES-GCM-256',
    };
  }

  async decrypt(encrypted: EncryptedData): Promise<string> {
    const password = await this.getDerivedPassword();
    const salt = this.base64ToBuffer(encrypted.salt);
    const iv = this.base64ToBuffer(encrypted.iv);
    const ciphertext = this.base64ToBuffer(encrypted.ciphertext);

    const key = await this.deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private async getDerivedPassword(): Promise<string> {
    // Combine multiple entropy sources
    const sessionId = sessionStorage.getItem('sessionId') || '';
    const deviceId = await this.getDeviceFingerprint();
    return `${sessionId}:${deviceId}:building-vitals-tokens`;
  }

  private async getDeviceFingerprint(): Promise<string> {
    // Simple device fingerprinting (not for security, just for key derivation)
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const vendor = gl?.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL || 0);
    const renderer = gl?.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL || 0);

    const fingerprint = `${navigator.userAgent}:${vendor}:${renderer}:${screen.width}x${screen.height}`;
    const buffer = new TextEncoder().encode(fingerprint);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return this.bufferToBase64(new Uint8Array(hash));
  }
}
```

### 2. Security Best Practices

```typescript
// Security checklist implementation
class TokenSecurityManager {
  // 1. Never log tokens
  sanitizeForLogging(data: any): any {
    if (typeof data === 'object') {
      const sanitized = { ...data };
      const sensitiveKeys = ['token', 'jwt', 'apiKey', 'secret'];

      for (const key in sanitized) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          sanitized[key] = '***REDACTED***';
        }
      }

      return sanitized;
    }
    return data;
  }

  // 2. Clear tokens on logout
  async clearAllTokensSecurely(): Promise<void> {
    // Clear from memory
    this.tokenManager.clearCache();

    // Delete from IndexedDB
    await this.storageService.clearAll();

    // Overwrite any residual data
    for (let i = 0; i < 3; i++) {
      await this.storageService.saveToken('overwrite', crypto.randomUUID(), {});
      await this.storageService.deleteToken('overwrite');
    }
  }

  // 3. Implement token rotation
  async rotateToken(siteId: string, newToken: string): Promise<void> {
    // Validate new token
    const isValid = await this.validationService.testToken(newToken);
    if (!isValid) {
      throw new Error('New token is invalid');
    }

    // Store new token
    await this.tokenManager.updateSiteToken(siteId, newToken);

    // Audit log
    await this.auditLog.record({
      action: 'token:rotated',
      siteId,
      timestamp: new Date(),
    });
  }

  // 4. Monitor for suspicious activity
  detectSuspiciousActivity(siteId: string): void {
    const metrics = this.getTokenMetrics(siteId);

    // Multiple failed requests in short time
    if (metrics.failedRequestsLast5Min > 10) {
      this.alertSecurityTeam('Multiple failed API requests', siteId);
    }

    // Token used from unusual location
    if (metrics.unusualLocationDetected) {
      this.alertSecurityTeam('Token used from unusual location', siteId);
    }

    // Concurrent usage from multiple IPs
    if (metrics.concurrentIPs > 2) {
      this.alertSecurityTeam('Token used from multiple IPs simultaneously', siteId);
    }
  }
}
```

### 3. Rate Limiting and Abuse Prevention

```typescript
class TokenRateLimiter {
  private requestCounts: Map<string, number[]> = new Map();

  async checkRateLimit(siteId: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 requests per minute per site

    const requests = this.requestCounts.get(siteId) || [];

    // Remove old requests outside window
    const recentRequests = requests.filter(t => now - t < windowMs);

    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    recentRequests.push(now);
    this.requestCounts.set(siteId, recentRequests);

    return true;
  }
}
```

## Fallback Mechanisms

### 1. Token Unavailable Fallback

```typescript
class TokenFallbackManager {
  async handleMissingToken(siteId: string): Promise<string | null> {
    // 1. Try to load from storage
    const stored = await this.storageService.loadToken(siteId);
    if (stored) {
      return this.decrypt(stored);
    }

    // 2. Try to sync from backend
    if (this.authService.isAuthenticated()) {
      const synced = await this.syncFromBackend(siteId);
      if (synced) return synced;
    }

    // 3. Try default token
    const defaultToken = this.getDefaultToken();
    if (defaultToken && siteId === this.getDefaultSiteId()) {
      return defaultToken;
    }

    // 4. Show token entry dialog
    return this.promptUserForToken(siteId);
  }

  private async promptUserForToken(siteId: string): Promise<string | null> {
    return new Promise((resolve) => {
      eventBus.emit('token:prompt-required', {
        siteId,
        onToken: (token: string) => resolve(token),
        onCancel: () => resolve(null),
      });
    });
  }
}
```

### 2. Expired Token Fallback

```typescript
class TokenExpiryHandler {
  async handleExpiredToken(siteId: string): Promise<void> {
    // 1. Try to refresh automatically (if refresh endpoint available)
    const refreshed = await this.attemptAutoRefresh(siteId);
    if (refreshed) return;

    // 2. Check if user has other valid tokens for same site
    const alternateToken = await this.findAlternateToken(siteId);
    if (alternateToken) {
      await this.tokenManager.setCurrentSite(alternateToken.siteId);
      return;
    }

    // 3. Prompt user to enter new token
    await this.promptForTokenRefresh(siteId);
  }

  private async attemptAutoRefresh(siteId: string): Promise<boolean> {
    const token = this.tokenManager.getTokenForSite(siteId);
    if (!token) return false;

    const metadata = this.tokenManager.getTokenMetadata(token);
    if (!metadata.refreshEndpoint) return false;

    try {
      const response = await fetch(metadata.refreshEndpoint, {
        method: 'POST',
        headers: { 'X-ACE-Token': token },
      });

      if (response.ok) {
        const { token: newToken } = await response.json();
        await this.tokenManager.updateSiteToken(siteId, newToken);
        return true;
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }

    return false;
  }
}
```

### 3. Network Failure Fallback

```typescript
class NetworkFallbackManager {
  private offlineQueue: QueuedRequest[] = [];

  async handleNetworkFailure(request: QueuedRequest): Promise<void> {
    // Queue request for retry
    this.offlineQueue.push(request);

    // Show offline indicator
    eventBus.emit('network:offline', {
      queuedRequests: this.offlineQueue.length,
    });

    // Set up retry when back online
    window.addEventListener('online', () => this.processOfflineQueue());
  }

  private async processOfflineQueue(): Promise<void> {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queue) {
      try {
        await this.retryRequest(request);
      } catch (error) {
        // Re-queue if still failing
        this.offlineQueue.push(request);
      }
    }

    if (this.offlineQueue.length === 0) {
      eventBus.emit('network:online');
    }
  }
}
```

## Multi-Tenancy Support

### 1. Multi-Tenant Architecture

```typescript
// Support for users managing multiple organizations/sites
class MultiTenantTokenManager extends TokenManagerService {
  private tenants: Map<string, TenantConfig> = new Map();
  private currentTenant: string | null = null;

  async addTenant(tenantId: string, config: TenantConfig): Promise<void> {
    this.tenants.set(tenantId, config);

    // Load tenant's tokens
    const tokens = await this.storageService.loadTokensForTenant(tenantId);
    for (const token of tokens) {
      await this.addSiteToken(token.siteId, token.siteName, token.token);
    }
  }

  async switchTenant(tenantId: string): Promise<void> {
    if (!this.tenants.has(tenantId)) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    this.currentTenant = tenantId;

    // Reload tokens for this tenant
    await this.reloadTenantTokens(tenantId);

    eventBus.emit('tenant:switched', { tenantId });
  }

  getCurrentToken(): string | null {
    if (!this.currentTenant) return super.getCurrentToken();

    // Get token scoped to current tenant
    const tenantConfig = this.tenants.get(this.currentTenant);
    const siteId = this.getCurrentSite();

    return this.getTokenForSite(`${this.currentTenant}:${siteId}`);
  }
}

interface TenantConfig {
  tenantId: string;
  tenantName: string;
  defaultSiteId?: string;
  allowedSites: string[];
  apiBaseUrl?: string;
}
```

### 2. Tenant Isolation

```typescript
class TenantIsolationManager {
  // Ensure tokens from one tenant cannot be used for another
  validateTenantAccess(tenantId: string, siteId: string): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    return tenant.allowedSites.includes(siteId) || tenant.allowedSites.includes('*');
  }

  // Prevent token leakage between tenants
  isolateStorage(tenantId: string): void {
    // Use separate IndexedDB databases per tenant
    const dbName = `building-vitals-tokens-${tenantId}`;
    this.storageService.setDatabase(dbName);
  }
}
```

## Migration Path

### Phase 1: Implement Core Token Management (Week 1-2)

**Tasks:**
1. Create TokenManagerService singleton
2. Implement TokenStorageService with IndexedDB
3. Implement TokenValidationService
4. Add encryption using Web Crypto API
5. Update cloudflareWorkerClient to use TokenManager

**Files to Create:**
```
src/services/token/
├── TokenManagerService.ts
├── TokenStorageService.ts
├── TokenValidationService.ts
├── TokenEncryption.ts
└── index.ts

src/types/
└── token.types.ts
```

### Phase 2: UI Components (Week 2-3)

**Tasks:**
1. Enhance existing TokenManager component
2. Create TokenExpiryDialog component
3. Create TokenRefreshPrompt component
4. Add SiteSelector with token status indicators
5. Create first-time setup wizard

**Files to Update/Create:**
```
src/components/settings/
├── TokenManager.tsx (enhance existing)
├── TokenExpiryDialog.tsx (new)
├── TokenRefreshPrompt.tsx (new)
└── FirstTimeSetup.tsx (new)

src/components/common/
└── SiteSelector.tsx (enhance existing)
```

### Phase 3: API Integration (Week 3-4)

**Tasks:**
1. Create TokenInterceptor middleware
2. Update all API clients to use interceptor
3. Implement automatic token injection
4. Add error handling for 401/403 responses
5. Implement retry logic with token refresh

**Files to Update:**
```
src/services/api/
├── cloudflareWorkerClient.ts (update)
├── tokenInterceptor.ts (new)
└── index.ts (update)
```

### Phase 4: Backend Sync (Week 4-5)

**Tasks:**
1. Update Firestore user document schema
2. Create sync functions in Firebase Functions
3. Implement cross-device token sync
4. Add audit logging for token operations

**Files to Update:**
```
functions/src/
├── tokenManagement.ts (update)
├── simpleTokenService.ts (update)
└── tokenSync.ts (new)
```

### Phase 5: Testing & Polish (Week 5-6)

**Tasks:**
1. Write unit tests for all token services
2. Write integration tests for token flows
3. Test token expiry scenarios
4. Test multi-site workflows
5. Performance testing
6. Security audit

**Files to Create:**
```
src/__tests__/
├── token/
│   ├── TokenManagerService.test.ts
│   ├── TokenStorageService.test.ts
│   ├── TokenValidationService.test.ts
│   └── TokenEncryption.test.ts
└── integration/
    └── tokenWorkflows.test.ts
```

### Migration Checklist

- [ ] Backup existing user tokens
- [ ] Create migration script for existing tokens
- [ ] Test migration with sample users
- [ ] Deploy TokenManagerService
- [ ] Deploy TokenStorageService
- [ ] Deploy UI components
- [ ] Update API clients
- [ ] Deploy backend sync functions
- [ ] Monitor for errors
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Deprecate old token management code

## Performance Considerations

### 1. Caching Strategy

```typescript
class TokenCacheManager {
  private tokenCache: Map<string, CachedToken> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  getCachedToken(siteId: string): string | null {
    const cached = this.tokenCache.get(siteId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.tokenCache.delete(siteId);
      return null;
    }

    return cached.token;
  }

  setCachedToken(siteId: string, token: string): void {
    this.tokenCache.set(siteId, {
      token,
      timestamp: Date.now(),
    });
  }
}

interface CachedToken {
  token: string;
  timestamp: number;
}
```

### 2. Lazy Loading

```typescript
// Lazy load token validation and encryption services
class LazyTokenServices {
  private validationService: TokenValidationService | null = null;
  private encryptionService: TokenEncryption | null = null;

  async getValidationService(): Promise<TokenValidationService> {
    if (!this.validationService) {
      const { TokenValidationService } = await import('./TokenValidationService');
      this.validationService = new TokenValidationService();
    }
    return this.validationService;
  }

  async getEncryptionService(): Promise<TokenEncryption> {
    if (!this.encryptionService) {
      const { TokenEncryption } = await import('./TokenEncryption');
      this.encryptionService = new TokenEncryption();
    }
    return this.encryptionService;
  }
}
```

### 3. Batch Operations

```typescript
// Batch token operations for better performance
class BatchTokenOperations {
  async batchAddTokens(tokens: SiteToken[]): Promise<void> {
    const transaction = this.storageService.beginTransaction();

    try {
      for (const token of tokens) {
        await transaction.saveToken(token.siteId, token.token, token);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async batchValidateTokens(tokens: string[]): Promise<Map<string, boolean>> {
    const results = await Promise.allSettled(
      tokens.map(token => this.validationService.validateJWTFormat(token))
    );

    const validationMap = new Map();
    tokens.forEach((token, index) => {
      const result = results[index];
      validationMap.set(token, result.status === 'fulfilled' && result.value);
    });

    return validationMap;
  }
}
```

## Monitoring and Observability

### 1. Token Metrics

```typescript
interface TokenMetrics {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  invalidTokens: number;
  averageTokenAge: number; // days
  tokensByStatus: Record<TokenStatus, number>;
  recentErrors: TokenError[];
}

class TokenMetricsCollector {
  async collectMetrics(): Promise<TokenMetrics> {
    const tokens = await this.tokenManager.getAllTokens();

    return {
      totalTokens: tokens.length,
      activeTokens: tokens.filter(t => t.status === 'active').length,
      expiredTokens: tokens.filter(t => t.status === 'expired').length,
      invalidTokens: tokens.filter(t => t.status === 'invalid').length,
      averageTokenAge: this.calculateAverageAge(tokens),
      tokensByStatus: this.groupByStatus(tokens),
      recentErrors: this.getRecentErrors(),
    };
  }
}
```

### 2. Audit Logging

```typescript
interface TokenAuditLog {
  timestamp: Date;
  userId: string;
  siteId: string;
  action: TokenAction;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}

type TokenAction =
  | 'token:added'
  | 'token:updated'
  | 'token:deleted'
  | 'token:validated'
  | 'token:refreshed'
  | 'token:expired'
  | 'token:failed';

class TokenAuditLogger {
  async log(action: TokenAction, details: Record<string, any>): Promise<void> {
    const log: TokenAuditLog = {
      timestamp: new Date(),
      userId: this.authService.getCurrentUserId(),
      siteId: details.siteId || 'unknown',
      action,
      details: this.sanitizeDetails(details),
      success: details.success !== false,
      error: details.error,
    };

    // Log to backend
    await this.sendToBackend(log);

    // Log locally for debugging
    console.log('[TokenAudit]', log);
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    delete sanitized.token; // Never log actual tokens
    return sanitized;
  }
}
```

## Summary

This token management architecture provides:

1. **Flexible Token Management**: Support for default hardcoded tokens, multiple site/device tokens, and easy token management UI
2. **Automatic Token Injection**: Middleware automatically adds tokens to all API requests
3. **Expiration Handling**: Proactive expiry detection with user-friendly refresh workflows
4. **Secure Storage**: Multi-layer encryption using Web Crypto API for IndexedDB storage
5. **Multi-Tenancy**: Support for users managing multiple organizations/sites
6. **Fallback Mechanisms**: Graceful degradation when tokens are unavailable or expired
7. **Migration Path**: Clear phased approach for implementation
8. **Security Best Practices**: Token encryption, rate limiting, audit logging, and secure deletion
9. **Performance Optimization**: Caching, lazy loading, and batch operations
10. **Observability**: Comprehensive metrics and audit logging

The architecture is designed to be:
- **Scalable**: Handle thousands of tokens per user
- **Secure**: Industry-standard encryption and security practices
- **User-Friendly**: Clear UI flows for all token management tasks
- **Maintainable**: Modular design with clear separation of concerns
- **Extensible**: Easy to add new features (e.g., token rotation, refresh)

**Key Files to Create/Modify:**

New Files:
- `src/services/token/TokenManagerService.ts`
- `src/services/token/TokenStorageService.ts`
- `src/services/token/TokenValidationService.ts`
- `src/services/token/TokenEncryption.ts`
- `src/services/token/tokenInterceptor.ts`
- `src/components/settings/TokenExpiryDialog.tsx`
- `src/components/settings/TokenRefreshPrompt.tsx`
- `src/types/token.types.ts`

Modified Files:
- `src/components/settings/TokenManager.tsx`
- `src/services/api/cloudflareWorkerClient.ts`
- `src/services/api/index.ts`
- `functions/src/tokenManagement.ts`
- `functions/src/simpleTokenService.ts`
