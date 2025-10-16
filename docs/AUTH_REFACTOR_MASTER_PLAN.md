# Authentication Refactor - Master Plan
## Hardcoded Device Tokens & Multi-Site Token Management

**Project:** Building Vitals Application
**Version:** 1.0
**Date:** 2025-01-31
**Status:** Planning Phase

---

## Executive Summary

This document provides a comprehensive plan to refactor the Building Vitals authentication system to support:

1. **Hardcoded default site device tokens** - Eliminate manual token entry for primary site
2. **Multi-site token management** - Support multiple sites/devices with individual tokens
3. **Automatic token injection** - Transparent token usage in all API calls
4. **Expiration handling** - Proactive warnings and easy token refresh
5. **Simplified UX** - Reduce friction for new and returning users

**Current Pain Points:**
- Users must manually enter ACE IoT JWT tokens
- Single token per user (no multi-site support)
- Complex 4-layer storage synchronization
- Plain text token storage in Firestore (security risk)
- No automatic token refresh mechanism

**Target Outcomes:**
- Zero-friction onboarding with default tokens
- Support unlimited sites/devices
- Secure encrypted storage (AES-GCM-256)
- Automatic token expiration warnings (7 days advance)
- Reduced code complexity (from 4 to 2 storage layers)

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Proposed Architecture](#proposed-architecture)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Task List](#detailed-task-list)
5. [Code Changes Required](#code-changes-required)
6. [Migration Strategy](#migration-strategy)
7. [Testing Plan](#testing-plan)
8. [Security Considerations](#security-considerations)
9. [Timeline & Resources](#timeline--resources)
10. [Success Metrics](#success-metrics)

---

## 1. Current System Analysis

### 1.1 Current Architecture

```
User Authentication Flow (Current):
┌─────────────────────────────────────────────────────────────┐
│ 1. Firebase Auth (Identity)                                 │
│    - Google/Microsoft SSO                                    │
│    - Email/Password                                          │
│    - Generates: Firebase ID Token                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Manual ACE Token Entry (Authorization) ⚠️                │
│    - User navigates to Settings page                         │
│    - Manually enters JWT token                               │
│    - Token stored in 4 locations (!)                         │
│    - Required for all building data API calls                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Storage Complexity (Current)

| Layer | Location | Encryption | Persistence | Purpose |
|-------|----------|------------|-------------|---------|
| **1. Redux Store** | In-memory | None | Session only | Runtime access |
| **2. SecureStorage** | localStorage | AES-GCM-256 | Persistent | Browser cache |
| **3. Firestore** | Cloud DB | ❌ Plain text | Persistent | Cross-device sync |
| **4. axios Instance** | Headers | None | Session only | API injection |

**Issues:**
- **4 storage locations** = 4x complexity, 4x attack surface
- **Synchronization bugs** = Token exists in one place but not another
- **Plain text Firestore** = Major security vulnerability
- **No multi-site support** = Users limited to one building

### 1.3 Key Files (Current System)

```
Authentication Core:
├── src/services/authService.ts (221 LOC) - Firebase auth
├── src/services/tokenService.ts (429 LOC) - ACE token CRUD
├── src/services/tokenManager.ts (69 LOC) - Token coordinator
├── src/services/secureStorage.ts (272 LOC) - Encrypted storage
├── src/services/encryption.ts (148 LOC) - Web Crypto API
└── src/services/axiosInstance.ts - HTTP client setup

State Management:
├── src/store/slices/authSlice.ts (129 LOC) - Redux
└── src/core/stores/authStore.ts (191 LOC) - Zustand (unused?)

UI Components:
├── src/pages/Settings.tsx (635 LOC) - Token entry page
├── src/components/settings/ApiTokenSection.tsx (123 LOC)
└── src/components/settings/TokenManager.tsx (407 LOC)

Backend (Firebase Functions):
├── functions/src/authMiddleware.ts (250 LOC)
└── functions/src/tokenManagement.ts (169 LOC)
```

### 1.4 User Pain Points

| Pain Point | Impact | Frequency | User Feedback |
|------------|--------|-----------|---------------|
| Manual token entry | High friction onboarding | Every new user | "Why do I need this?" |
| Password field for token | Can't verify correct paste | Every entry | "Did I paste the right token?" |
| 3-second forced wait | Annoying delay | Every save | "Just let me continue!" |
| Complex error messages | Confusion | When errors occur | "What does IndexedDB mean?" |
| No multi-site support | Must switch accounts | Daily for multi-site users | "Can't I use multiple sites?" |
| Token expiration | Manual refresh required | Every 30-90 days | "My data stopped loading" |

---

## 2. Proposed Architecture

### 2.1 New Token Management System

```
Token Resolution Flow (Proposed):
┌─────────────────────────────────────────────────────────────┐
│ API Request Made                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ TokenResolver.getTokenForSite(siteId)                        │
│                                                              │
│ Priority Chain:                                              │
│ 1. Site-specific token (user-configured)                    │
│ 2. Default token for site (hardcoded in app)                │
│ 3. User's global token (legacy support)                     │
│ 4. Prompt user to add token                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Token Validation                                             │
│ - Check expiration (warn if < 7 days)                       │
│ - Verify JWT format                                          │
│ - Test with API (optional)                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Inject into API Request                                      │
│ Header: X-ACE-Token: {resolved_token}                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Simplified Storage (Proposed)

| Layer | Location | Encryption | Persistence | Purpose |
|-------|----------|------------|-------------|---------|
| **1. IndexedDB** | Browser | AES-GCM-256 | Persistent | Primary storage |
| **2. Firestore** (optional) | Cloud DB | AES-GCM-256 | Persistent | Cross-device sync |

**Improvements:**
- **2 storage locations** (down from 4) = 50% complexity reduction
- **Encrypted everywhere** = No plain text exposure
- **Single source of truth** = IndexedDB primary, Firestore backup
- **Multi-site support** = Unlimited tokens per user

### 2.3 Core Services Architecture

```typescript
// Core Token Management Services

TokenManagerService (Singleton)
├── getCurrentToken(siteId?: string): Promise<string | null>
├── addSiteToken(siteId: string, token: string): Promise<void>
├── removeSiteToken(siteId: string): Promise<void>
├── getAllSiteTokens(): Promise<Map<string, SiteToken>>
├── setCurrentSite(siteId: string): void
└── validateToken(token: string): Promise<TokenValidation>

TokenStorageService
├── saveToken(siteId: string, token: TokenData): Promise<void>
├── loadToken(siteId: string): Promise<TokenData | null>
├── loadAllTokens(): Promise<Map<string, TokenData>>
├── deleteToken(siteId: string): Promise<void>
└── encrypt/decrypt(data: string): Promise<string>

TokenValidationService
├── decodeJWT(token: string): JWTPayload
├── checkExpiration(token: string): ExpiryStatus
├── testTokenWithAPI(token: string): Promise<boolean>
└── getTokenMetadata(token: string): TokenMetadata

DefaultTokenProvider
├── getDefaultToken(siteId: string): string | null
├── listAvailableSites(): string[]
└── isDefaultTokenAvailable(siteId: string): boolean
```

### 2.4 Data Models

```typescript
// TypeScript Interfaces

interface SiteToken {
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

interface TokenData {
  encrypted: string;
  iv: string;
  salt: string;
  version: number;
}

interface TokenValidation {
  valid: boolean;
  expired: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  errors: string[];
}

interface ExpiryStatus {
  expired: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  shouldWarn: boolean; // < 7 days
  shouldBlock: boolean; // Already expired
}

interface JWTPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

interface TokenMetadata {
  format: 'jwt';
  algorithm: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  subject: string | null;
}
```

### 2.5 Default Token Configuration

**Environment Variables** (`.env.local`):

```bash
# Default Site Tokens (hardcoded)
VITE_DEFAULT_TOKEN_FALLS_CITY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEFAULT_TOKEN_SITE_2=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEFAULT_TOKEN_SITE_3=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Site ID Mappings
VITE_DEFAULT_SITE_ID=ses_falls_city
```

**Configuration File** (`src/config/defaultTokens.ts`):

```typescript
export const DEFAULT_TOKENS: Record<string, string> = {
  'ses_falls_city': import.meta.env.VITE_DEFAULT_TOKEN_FALLS_CITY || '',
  'site_2': import.meta.env.VITE_DEFAULT_TOKEN_SITE_2 || '',
  'site_3': import.meta.env.VITE_DEFAULT_TOKEN_SITE_3 || '',
};

export const DEFAULT_SITE_ID = import.meta.env.VITE_DEFAULT_SITE_ID || 'ses_falls_city';

export function getDefaultToken(siteId: string): string | null {
  return DEFAULT_TOKENS[siteId] || null;
}

export function hasDefaultToken(siteId: string): boolean {
  return !!DEFAULT_TOKENS[siteId];
}

export function listSitesWithDefaultTokens(): string[] {
  return Object.keys(DEFAULT_TOKENS).filter(siteId => DEFAULT_TOKENS[siteId]);
}
```

---

## 3. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Build core multi-token management system

**Tasks:**
1. Create `MultiTokenManager` service
2. Implement IndexedDB storage with encryption
3. Create default token provider
4. Build token validation service
5. Add TypeScript interfaces

**Deliverables:**
- `src/services/multiTokenManager.ts`
- `src/services/tokenStorage.ts`
- `src/config/defaultTokens.ts`
- `src/types/token.types.ts`

**Acceptance Criteria:**
- ✅ Can store/retrieve multiple tokens by siteId
- ✅ Default tokens load from environment variables
- ✅ All tokens encrypted with AES-GCM-256
- ✅ Token expiration correctly calculated
- ✅ Unit tests pass (90% coverage)

### Phase 2: API Integration (Weeks 3-4)

**Goal:** Automatic token injection in all API calls

**Tasks:**
1. Create `TokenResolver` with fallback chain
2. Build axios interceptor for automatic injection
3. Implement 401/403 retry logic
4. Add request queue for token refresh
5. Update all API services to use new system

**Deliverables:**
- `src/services/tokenResolver.ts`
- `src/services/tokenInterceptor.ts`
- `src/services/requestQueue.ts`
- Updated `axiosInstance.ts`

**Acceptance Criteria:**
- ✅ API calls automatically use correct token
- ✅ Fallback chain works (site → default → user → prompt)
- ✅ 401 errors trigger token refresh
- ✅ Multiple sites can be used simultaneously
- ✅ No manual token header setting required

### Phase 3: UI/UX Enhancement (Weeks 5-6)

**Goal:** User-friendly token management interface

**Tasks:**
1. Create `AddTokenDialog` component
2. Build `TokenStatusIndicator` with expiry warnings
3. Enhance `TokenManager` for multi-site support
4. Add site selector with token status
5. Implement token refresh workflow

**Deliverables:**
- `src/components/settings/AddTokenDialog.tsx`
- `src/components/settings/TokenStatusIndicator.tsx`
- Updated `src/components/settings/TokenManager.tsx`
- `src/components/common/SiteSelector.tsx` updates

**Acceptance Criteria:**
- ✅ Users can add tokens for new sites easily
- ✅ Token expiration shows 7-day advance warning
- ✅ Visual indicators for token status (active/warning/expired)
- ✅ One-click token refresh
- ✅ Mobile-responsive design

### Phase 4: Migration & Backward Compatibility (Week 7)

**Goal:** Migrate existing tokens without data loss

**Tasks:**
1. Create migration script for existing tokens
2. Implement dual-write period (old + new storage)
3. Add feature flag for gradual rollout
4. Create admin tool to monitor migration
5. Test rollback scenario

**Deliverables:**
- `src/services/tokenMigration.ts`
- `src/utils/featureFlags.ts`
- Migration dashboard in Admin panel

**Acceptance Criteria:**
- ✅ All existing tokens migrated successfully
- ✅ Zero data loss during migration
- ✅ Can rollback to old system if needed
- ✅ Feature flag controls rollout (10% → 50% → 100%)
- ✅ Migration metrics tracked

### Phase 5: Testing & Polish (Weeks 8-9)

**Goal:** Production-ready quality assurance

**Tasks:**
1. Write comprehensive unit tests (90%+ coverage)
2. Integration tests for token flows
3. E2E tests for critical paths
4. Performance testing (token lookup < 5ms)
5. Security audit
6. Documentation

**Deliverables:**
- Test suite with 90%+ coverage
- Performance benchmarks
- Security audit report
- User documentation
- Developer API docs

**Acceptance Criteria:**
- ✅ 90%+ code coverage
- ✅ All critical paths tested
- ✅ Performance targets met
- ✅ Security audit passed
- ✅ Documentation complete

---

## 4. Detailed Task List

### 4.1 Phase 1 Tasks (Foundation)

#### Task 1.1: Create MultiTokenManager Service
**Priority:** High
**Complexity:** Medium-High
**Dependencies:** None
**Files:** `src/services/multiTokenManager.ts`

**Description:**
Build the core singleton service that manages multiple site tokens.

**Implementation Steps:**
1. Create singleton class with private constructor
2. Implement token storage using IndexedDB
3. Add methods: `addToken()`, `getToken()`, `removeToken()`, `listTokens()`
4. Integrate with encryption service
5. Add event emitters for token changes
6. Implement caching layer (5-minute TTL)

**Acceptance Criteria:**
- [ ] Singleton pattern correctly implemented
- [ ] Can store unlimited site tokens
- [ ] Each token correctly associated with siteId
- [ ] Encryption/decryption works correctly
- [ ] Cache reduces DB queries by 90%
- [ ] Unit tests: 15+ tests, 95% coverage

**Code Example:**
```typescript
class MultiTokenManager {
  private static instance: MultiTokenManager;
  private cache: Map<string, CachedToken> = new Map();
  private storage: TokenStorageService;

  private constructor() {
    this.storage = new TokenStorageService();
  }

  public static getInstance(): MultiTokenManager {
    if (!MultiTokenManager.instance) {
      MultiTokenManager.instance = new MultiTokenManager();
    }
    return MultiTokenManager.instance;
  }

  public async addToken(siteId: string, token: string): Promise<void> {
    // Validate token
    const validation = await TokenValidator.validate(token);
    if (!validation.valid) throw new Error('Invalid token');

    // Encrypt and store
    const encrypted = await this.storage.saveToken(siteId, {
      token,
      createdAt: new Date(),
      expiresAt: validation.expiresAt,
    });

    // Update cache
    this.cache.set(siteId, { token, timestamp: Date.now() });

    // Emit event
    this.emit('tokenAdded', { siteId, token });
  }

  public async getToken(siteId: string): Promise<string | null> {
    // Check cache first
    const cached = this.getCachedToken(siteId);
    if (cached) return cached;

    // Load from storage
    const stored = await this.storage.loadToken(siteId);
    if (!stored) return null;

    // Update cache
    this.cache.set(siteId, { token: stored.token, timestamp: Date.now() });

    return stored.token;
  }

  private getCachedToken(siteId: string): string | null {
    const cached = this.cache.get(siteId);
    if (!cached) return null;

    // Cache TTL: 5 minutes
    const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000;
    if (isExpired) {
      this.cache.delete(siteId);
      return null;
    }

    return cached.token;
  }
}
```

---

#### Task 1.2: Implement TokenStorageService (IndexedDB)
**Priority:** High
**Complexity:** High
**Dependencies:** Encryption service
**Files:** `src/services/tokenStorage.ts`

**Description:**
Create encrypted IndexedDB storage for site tokens with fallback to localStorage.

**Implementation Steps:**
1. Initialize IndexedDB with `tokens` object store
2. Implement CRUD operations with encryption
3. Add fallback to encrypted localStorage
4. Handle IndexedDB quota errors
5. Implement bulk operations
6. Add migration from old storage

**Acceptance Criteria:**
- [ ] IndexedDB correctly initialized
- [ ] All tokens encrypted before storage
- [ ] Fallback to localStorage works
- [ ] Quota errors handled gracefully
- [ ] Bulk operations 50ms for 100 tokens
- [ ] Unit tests: 20+ tests, 90% coverage

**Code Example:**
```typescript
class TokenStorageService {
  private dbName = 'BuildingVitalsTokens';
  private storeName = 'tokens';
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'siteId' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  public async saveToken(siteId: string, data: SiteToken): Promise<void> {
    try {
      await this.saveToIndexedDB(siteId, data);
    } catch (error) {
      console.warn('IndexedDB failed, falling back to localStorage', error);
      await this.saveToLocalStorage(siteId, data);
    }
  }

  private async saveToIndexedDB(siteId: string, data: SiteToken): Promise<void> {
    if (!this.db) await this.init();

    // Encrypt token
    const encrypted = await EncryptionService.encrypt(data.token);

    const tokenData = {
      siteId,
      siteName: data.siteName,
      tokenEncrypted: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      tokenHash: await this.hashToken(data.token),
      createdAt: data.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: data.expiresAt?.toISOString() || null,
      isDefault: data.isDefault || false,
      lastUsed: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(tokenData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async loadToken(siteId: string): Promise<SiteToken | null> {
    try {
      return await this.loadFromIndexedDB(siteId);
    } catch (error) {
      console.warn('IndexedDB failed, trying localStorage', error);
      return await this.loadFromLocalStorage(siteId);
    }
  }

  private async loadFromIndexedDB(siteId: string): Promise<SiteToken | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(siteId);

      request.onsuccess = async () => {
        const data = request.result;
        if (!data) {
          resolve(null);
          return;
        }

        // Decrypt token
        const token = await EncryptionService.decrypt({
          ciphertext: data.tokenEncrypted,
          iv: data.iv,
          salt: data.salt,
        });

        resolve({
          siteId: data.siteId,
          siteName: data.siteName,
          token,
          tokenHash: data.tokenHash,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isDefault: data.isDefault,
          lastUsed: new Date(data.lastUsed),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

---

#### Task 1.3: Create DefaultTokenProvider
**Priority:** High
**Complexity:** Low
**Dependencies:** None
**Files:** `src/config/defaultTokens.ts`

**Description:**
Load hardcoded default tokens from environment variables.

**Implementation Steps:**
1. Read `VITE_DEFAULT_TOKEN_*` environment variables
2. Create mapping of siteId → token
3. Add helper functions for checking token availability
4. Implement validation on app startup
5. Add logging for missing default tokens

**Acceptance Criteria:**
- [ ] All default tokens loaded at startup
- [ ] Can check if site has default token
- [ ] Missing tokens logged as warnings (not errors)
- [ ] TypeScript types for all functions
- [ ] Unit tests: 10+ tests

**Code Example:**
```typescript
// src/config/defaultTokens.ts

const DEFAULT_TOKENS: Record<string, string> = {
  'ses_falls_city': import.meta.env.VITE_DEFAULT_TOKEN_FALLS_CITY || '',
  'site_2': import.meta.env.VITE_DEFAULT_TOKEN_SITE_2 || '',
  'site_3': import.meta.env.VITE_DEFAULT_TOKEN_SITE_3 || '',
};

export const DEFAULT_SITE_ID = import.meta.env.VITE_DEFAULT_SITE_ID || 'ses_falls_city';

export function getDefaultToken(siteId: string): string | null {
  const token = DEFAULT_TOKENS[siteId];
  if (!token) {
    console.warn(`No default token configured for site: ${siteId}`);
    return null;
  }
  return token;
}

export function hasDefaultToken(siteId: string): boolean {
  return !!DEFAULT_TOKENS[siteId];
}

export function listSitesWithDefaultTokens(): string[] {
  return Object.keys(DEFAULT_TOKENS).filter(siteId => DEFAULT_TOKENS[siteId]);
}

export function validateDefaultTokens(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const [siteId, token] of Object.entries(DEFAULT_TOKENS)) {
    if (!token) {
      missing.push(siteId);
    }
  }

  if (missing.length > 0) {
    console.warn(`Missing default tokens for sites: ${missing.join(', ')}`);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Validate on module load
validateDefaultTokens();
```

---

### 4.2 Phase 2 Tasks (API Integration)

#### Task 2.1: Create TokenResolver with Fallback Chain
**Priority:** High
**Complexity:** Medium
**Dependencies:** MultiTokenManager, DefaultTokenProvider
**Files:** `src/services/tokenResolver.ts`

**Description:**
Implement smart token resolution with priority chain: site-specific → default → user → prompt.

**Implementation Steps:**
1. Create resolver class with dependency injection
2. Implement priority chain logic
3. Add caching for resolved tokens
4. Log resolution decisions for debugging
5. Handle missing tokens gracefully
6. Emit events for token resolution failures

**Acceptance Criteria:**
- [ ] Correctly resolves tokens following priority chain
- [ ] Cache hit rate > 90%
- [ ] Missing tokens trigger user prompt (not error)
- [ ] Resolution time < 5ms (cached), < 10ms (uncached)
- [ ] Unit tests: 25+ tests covering all scenarios

**Code Example:**
```typescript
// src/services/tokenResolver.ts

class TokenResolver {
  private multiTokenManager: MultiTokenManager;
  private cache: Map<string, ResolvedToken> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.multiTokenManager = MultiTokenManager.getInstance();
  }

  public async resolveToken(siteId: string): Promise<string | null> {
    // Check cache first
    const cached = this.getCached(siteId);
    if (cached) {
      console.debug(`Token resolved from cache for site: ${siteId}`);
      return cached.token;
    }

    // Priority chain
    const token = await this.resolveFromChain(siteId);

    // Cache result
    if (token) {
      this.cache.set(siteId, {
        token,
        timestamp: Date.now(),
        source: this.determineSource(siteId, token),
      });
    }

    return token;
  }

  private async resolveFromChain(siteId: string): Promise<string | null> {
    // 1. Site-specific token (user-configured)
    const siteToken = await this.multiTokenManager.getToken(siteId);
    if (siteToken) {
      console.debug(`Token resolved: site-specific for ${siteId}`);
      return siteToken;
    }

    // 2. Default token (hardcoded)
    const defaultToken = getDefaultToken(siteId);
    if (defaultToken) {
      console.debug(`Token resolved: default for ${siteId}`);
      return defaultToken;
    }

    // 3. User's global token (legacy support)
    const globalToken = await this.multiTokenManager.getToken('__global__');
    if (globalToken) {
      console.debug(`Token resolved: global fallback for ${siteId}`);
      return globalToken;
    }

    // 4. No token available
    console.warn(`No token available for site: ${siteId}`);
    this.emit('tokenMissing', { siteId });
    return null;
  }

  private getCached(siteId: string): ResolvedToken | null {
    const cached = this.cache.get(siteId);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
    if (isExpired) {
      this.cache.delete(siteId);
      return null;
    }

    return cached;
  }

  public invalidateCache(siteId?: string): void {
    if (siteId) {
      this.cache.delete(siteId);
    } else {
      this.cache.clear();
    }
  }

  private determineSource(siteId: string, token: string): TokenSource {
    // Determine where token came from for debugging
    if (getDefaultToken(siteId) === token) return 'default';
    // Add more logic here
    return 'user';
  }
}

interface ResolvedToken {
  token: string;
  timestamp: number;
  source: TokenSource;
}

type TokenSource = 'site-specific' | 'default' | 'global' | 'user';
```

---

#### Task 2.2: Implement axios Interceptor for Token Injection
**Priority:** High
**Complexity:** Medium
**Dependencies:** TokenResolver
**Files:** `src/services/tokenInterceptor.ts`, `src/services/axiosInstance.ts`

**Description:**
Automatically inject the correct token into all API requests based on site context.

**Implementation Steps:**
1. Create request interceptor in axios
2. Extract siteId from request URL or context
3. Use TokenResolver to get correct token
4. Inject token into `X-ACE-Token` header
5. Handle 401/403 responses with token refresh
6. Implement request queuing during token refresh

**Acceptance Criteria:**
- [ ] All API requests automatically have token
- [ ] Correct token used based on site context
- [ ] 401/403 errors trigger token refresh
- [ ] Failed requests retried after refresh
- [ ] No manual token header setting required
- [ ] Integration tests: 15+ scenarios

**Code Example:**
```typescript
// src/services/tokenInterceptor.ts

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { TokenResolver } from './tokenResolver';
import { RequestQueue } from './requestQueue';

class TokenInterceptor {
  private tokenResolver: TokenResolver;
  private requestQueue: RequestQueue;
  private isRefreshing = false;

  constructor(private axiosInstance: AxiosInstance) {
    this.tokenResolver = new TokenResolver();
    this.requestQueue = new RequestQueue();
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => await this.onRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => await this.onResponseError(error)
    );
  }

  private async onRequest(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    // Extract siteId from request
    const siteId = this.extractSiteId(config);

    // Resolve token
    const token = await this.tokenResolver.resolveToken(siteId);

    if (token) {
      // Inject token into header
      config.headers['X-ACE-Token'] = token;
      console.debug(`Token injected for request to ${config.url}`);
    } else {
      console.warn(`No token available for site: ${siteId}, request may fail`);
    }

    return config;
  }

  private async onResponseError(error: AxiosError): Promise<any> {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401/403 (unauthorized)
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      if (this.isRefreshing) {
        // Queue request to retry after token refresh
        return this.requestQueue.enqueue(originalRequest);
      }

      originalRequest._retry = true;
      this.isRefreshing = true;

      try {
        // Attempt to refresh token
        const siteId = this.extractSiteId(originalRequest);
        await this.refreshToken(siteId);

        // Retry all queued requests
        this.requestQueue.retryAll();

        // Retry original request
        return this.axiosInstance(originalRequest);
      } catch (refreshError) {
        // Token refresh failed, redirect to settings
        console.error('Token refresh failed:', refreshError);
        this.redirectToTokenSetup();
        return Promise.reject(refreshError);
      } finally {
        this.isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }

  private extractSiteId(config: InternalAxiosRequestConfig): string {
    // Extract from URL path (e.g., /api/sites/ses_falls_city/...)
    const match = config.url?.match(/\/sites\/([^\/]+)/);
    if (match) return match[1];

    // Extract from query params
    const params = new URLSearchParams(config.url?.split('?')[1]);
    const siteIdParam = params.get('siteId') || params.get('site_id');
    if (siteIdParam) return siteIdParam;

    // Extract from request data
    if (config.data && typeof config.data === 'object' && 'siteId' in config.data) {
      return (config.data as any).siteId;
    }

    // Fallback to current site context
    return this.getCurrentSiteContext();
  }

  private getCurrentSiteContext(): string {
    // Get from Redux store or context
    const state = store.getState();
    return state.sites.currentSiteId || DEFAULT_SITE_ID;
  }

  private async refreshToken(siteId: string): Promise<void> {
    // Invalidate cache
    this.tokenResolver.invalidateCache(siteId);

    // Trigger token refresh (could show dialog to user)
    const event = new CustomEvent('token:refresh-needed', { detail: { siteId } });
    window.dispatchEvent(event);

    // Wait for user to provide new token or timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Token refresh timeout')), 60000);

      const handler = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail.siteId === siteId) {
          clearTimeout(timeout);
          window.removeEventListener('token:refreshed', handler);
          resolve();
        }
      };

      window.addEventListener('token:refreshed', handler);
    });
  }

  private redirectToTokenSetup(): void {
    window.location.href = '/settings?setup=token';
  }
}

// Initialize interceptor
const tokenInterceptor = new TokenInterceptor(axiosInstance);

export { tokenInterceptor };
```

---

### 4.3 Phase 3 Tasks (UI/UX Enhancement)

#### Task 3.1: Create AddTokenDialog Component
**Priority:** High
**Complexity:** Medium
**Dependencies:** MultiTokenManager
**Files:** `src/components/settings/AddTokenDialog.tsx`

**Description:**
User-friendly dialog for adding tokens for new sites.

**Implementation Steps:**
1. Create Material-UI Dialog component
2. Add form fields: Site Name, Site ID, Token
3. Implement token validation with real-time feedback
4. Show token expiration date after validation
5. Add "Test Token" button for live validation
6. Provide success/error feedback

**Acceptance Criteria:**
- [ ] Dialog opens on "Add Token" button click
- [ ] Real-time validation shows ✓/✗ as user types
- [ ] Token expiration displayed before save
- [ ] "Test Token" makes API call to verify
- [ ] Success message shown on save
- [ ] Mobile-responsive design

**Code Example:**
```typescript
// src/components/settings/AddTokenDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Box,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Error } from '@mui/icons-material';
import { MultiTokenManager } from '../../services/multiTokenManager';
import { TokenValidator } from '../../services/tokenValidator';

interface AddTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (siteId: string) => void;
}

export const AddTokenDialog: React.FC<AddTokenDialogProps> = ({ open, onClose, onSuccess }) => {
  const [siteName, setSiteName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const multiTokenManager = MultiTokenManager.getInstance();

  const handleTokenChange = async (value: string) => {
    setToken(value);
    setError(null);
    setTestResult(null);

    if (value.length < 10) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    try {
      const result = await TokenValidator.validate(value);
      setValidation(result);
    } catch (err) {
      setValidation({ valid: false, errors: ['Invalid token format'] });
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestToken = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const isValid = await TokenValidator.testWithAPI(token);
      setTestResult(isValid ? 'success' : 'error');
    } catch (err) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!siteName || !siteId || !token) {
      setError('All fields are required');
      return;
    }

    if (!validation?.valid) {
      setError('Token is invalid');
      return;
    }

    try {
      await multiTokenManager.addToken(siteId, token);
      onSuccess(siteId);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save token');
    }
  };

  const handleClose = () => {
    setSiteName('');
    setSiteId('');
    setToken('');
    setShowToken(false);
    setValidation(null);
    setError(null);
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Token for New Site</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Site Name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g., Falls City Hospital"
          sx={{ mt: 2, mb: 2 }}
        />

        <TextField
          fullWidth
          label="Site ID"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="e.g., ses_falls_city"
          helperText="Unique identifier for this site"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="ACE IoT API Token"
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          helperText="JWT token for this site"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {isValidating && <CircularProgress size={20} />}
                {!isValidating && validation?.valid && <CheckCircle color="success" />}
                {!isValidating && validation && !validation.valid && <Error color="error" />}
                <IconButton onClick={() => setShowToken(!showToken)} edge="end">
                  {showToken ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {validation?.valid && validation.expiresAt && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Token expires: {new Date(validation.expiresAt).toLocaleDateString()}
              {validation.daysUntilExpiry !== null && (
                <> ({validation.daysUntilExpiry} days remaining)</>
              )}
            </Typography>
          </Alert>
        )}

        {validation && !validation.valid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{validation.errors.join(', ')}</Typography>
          </Alert>
        )}

        {testResult === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Token successfully verified with API!
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Token verification failed. Please check the token.
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            onClick={handleTestToken}
            disabled={!validation?.valid || isTesting}
            startIcon={isTesting && <CircularProgress size={16} />}
          >
            Test Token with API
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!validation?.valid || !siteName || !siteId}
        >
          Save Token
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## 5. Code Changes Required

### 5.1 File Impact Matrix

| File | Change Type | LOC Impact | Complexity | Risk |
|------|-------------|------------|------------|------|
| **New Files** |
| `src/services/multiTokenManager.ts` | Create | +400 | High | Low |
| `src/services/tokenStorage.ts` | Create | +350 | High | Medium |
| `src/services/tokenResolver.ts` | Create | +200 | Medium | Low |
| `src/services/tokenInterceptor.ts` | Create | +150 | Medium | Medium |
| `src/config/defaultTokens.ts` | Create | +50 | Low | Low |
| `src/types/token.types.ts` | Create | +100 | Low | Low |
| `src/components/settings/AddTokenDialog.tsx` | Create | +250 | Medium | Low |
| **Modified Files** |
| `src/services/tokenService.ts` | Refactor | ~400 → ~200 | High | High |
| `src/services/tokenManager.ts` | Refactor | ~70 → ~30 | Medium | Medium |
| `src/services/axiosInstance.ts` | Update | +50 | Low | Medium |
| `src/components/settings/TokenManager.tsx` | Update | +150 | Medium | Medium |
| `src/pages/Settings.tsx` | Update | +100 | Medium | Low |
| `src/App.tsx` | Update | +50 | Low | Low |
| `.env.local` | Update | +10 | Low | Low |
| **Total** | | **+2,200 LOC** | | |

### 5.2 Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|----------------|
| `tokenService.saveToken()` signature change | High | Use `multiTokenManager.addToken()` instead |
| `tokenService.getToken()` returns site-specific | High | Pass `siteId` parameter or use resolver |
| Redux `state.auth.aceToken` deprecated | Medium | Use `multiTokenManager.getCurrentToken()` |
| Firestore schema change (encrypted tokens) | High | Run migration script before deployment |

---

## 6. Migration Strategy

### 6.1 Data Migration Plan

**Goal:** Migrate all existing user tokens to new multi-token system with zero data loss.

**Strategy: Dual-Write Period (3 months)**

```
Phase 1: Preparation (Week 7)
├── Deploy migration script to production
├── Verify existing tokens readable
├── Create backup of Firestore tokens collection
└── Test rollback procedure

Phase 2: Dual-Write (Weeks 8-20)
├── Write to both old and new storage
├── Read from new storage, fallback to old
├── Monitor migration metrics
└── Gradually increase new system traffic (10% → 50% → 100%)

Phase 3: Read-Only Old System (Weeks 21-24)
├── Stop writing to old storage
├── Keep reading for legacy users
└── Final migration push via email campaign

Phase 4: Deprecation (Week 25+)
├── Remove old storage code
├── Delete old Firestore fields
└── Complete migration
```

### 6.2 Migration Script

**File:** `src/services/tokenMigration.ts`

```typescript
class TokenMigrationService {
  private oldTokenService: TokenService;
  private newTokenManager: MultiTokenManager;

  public async migrateUserTokens(userId: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      tokensFound: 0,
      tokensMigrated: 0,
      errors: [],
    };

    try {
      // 1. Read old token from Firestore
      const oldToken = await this.oldTokenService.getToken(userId);
      if (!oldToken) {
        result.success = true; // No token to migrate
        return result;
      }

      result.tokensFound = 1;

      // 2. Determine site ID (default to global)
      const siteId = this.determineSiteId(oldToken) || '__global__';

      // 3. Save to new system
      await this.newTokenManager.addToken(siteId, oldToken);

      // 4. Verify migration
      const migratedToken = await this.newTokenManager.getToken(siteId);
      if (migratedToken === oldToken) {
        result.tokensMigrated = 1;
        result.success = true;

        // 5. Log migration
        await this.logMigration(userId, siteId);
      } else {
        throw new Error('Token verification failed after migration');
      }
    } catch (error: any) {
      result.errors.push(error.message);
      console.error('Token migration failed:', error);
    }

    return result;
  }

  public async migrateAllUsers(): Promise<BatchMigrationResult> {
    // Get all users with tokens
    const users = await this.getAllUsersWithTokens();

    const results: BatchMigrationResult = {
      totalUsers: users.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Migrate in batches of 100
    for (let i = 0; i < users.length; i += 100) {
      const batch = users.slice(i, i + 100);
      const batchResults = await Promise.allSettled(
        batch.map(user => this.migrateUserTokens(user.uid))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful++;
        } else {
          results.failed++;
          if (result.status === 'rejected') {
            results.errors.push(result.reason);
          }
        }
      }
    }

    return results;
  }

  private determineSiteId(token: string): string | null {
    // Try to extract site ID from token payload
    try {
      const payload = this.decodeJWT(token);
      return payload.siteId || payload.site || null;
    } catch {
      return null;
    }
  }

  private async getAllUsersWithTokens(): Promise<UserRecord[]> {
    const snapshot = await admin.firestore()
      .collection('users')
      .where('aceJwt', '!=', null)
      .get();

    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserRecord[];
  }

  private async logMigration(userId: string, siteId: string): Promise<void> {
    await admin.firestore()
      .collection('migrations')
      .doc(`token_${userId}_${siteId}`)
      .set({
        userId,
        siteId,
        migratedAt: new Date(),
        version: '2.0',
      });
  }
}
```

### 6.3 Feature Flag Configuration

**File:** `src/utils/featureFlags.ts`

```typescript
export enum FeatureFlag {
  NEW_TOKEN_SYSTEM = 'new_token_system',
}

export class FeatureFlagService {
  private flags: Map<FeatureFlag, boolean> = new Map();

  constructor() {
    this.loadFlags();
  }

  public isEnabled(flag: FeatureFlag): boolean {
    return this.flags.get(flag) || false;
  }

  public async enable(flag: FeatureFlag, percentage: number = 100): Promise<void> {
    // Enable for percentage of users (A/B testing)
    const userId = this.getCurrentUserId();
    const userHash = this.hashUserId(userId);
    const isEnabled = (userHash % 100) < percentage;

    this.flags.set(flag, isEnabled);
    await this.persistFlags();
  }

  private loadFlags(): void {
    // Load from localStorage or remote config
    const stored = localStorage.getItem('feature_flags');
    if (stored) {
      const flags = JSON.parse(stored);
      for (const [key, value] of Object.entries(flags)) {
        this.flags.set(key as FeatureFlag, value as boolean);
      }
    }
  }

  private getCurrentUserId(): string {
    const user = auth.currentUser;
    return user?.uid || 'anonymous';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

---

## 7. Testing Plan

### 7.1 Unit Tests

| Component | Test Count | Coverage Target |
|-----------|------------|-----------------|
| MultiTokenManager | 15 tests | 95% |
| TokenStorageService | 20 tests | 90% |
| TokenResolver | 25 tests | 95% |
| TokenInterceptor | 15 tests | 90% |
| DefaultTokenProvider | 10 tests | 100% |
| **Total** | **85+ tests** | **92%** |

**Example Test Cases:**

```typescript
// src/services/__tests__/multiTokenManager.test.ts

describe('MultiTokenManager', () => {
  let manager: MultiTokenManager;

  beforeEach(() => {
    manager = MultiTokenManager.getInstance();
  });

  test('should add token for site', async () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    await manager.addToken('site1', token);
    const retrieved = await manager.getToken('site1');
    expect(retrieved).toBe(token);
  });

  test('should encrypt token before storage', async () => {
    const token = 'plain_token_123';
    await manager.addToken('site1', token);

    // Check IndexedDB directly
    const stored = await indexedDB.get('tokens', 'site1');
    expect(stored.tokenEncrypted).not.toBe(token);
    expect(stored.tokenEncrypted.length).toBeGreaterThan(token.length);
  });

  test('should cache token for 5 minutes', async () => {
    const token = 'cached_token_123';
    await manager.addToken('site1', token);

    // First call hits storage
    const retrieved1 = await manager.getToken('site1');
    expect(retrieved1).toBe(token);

    // Second call should be cached (faster)
    const start = performance.now();
    const retrieved2 = await manager.getToken('site1');
    const duration = performance.now() - start;

    expect(retrieved2).toBe(token);
    expect(duration).toBeLessThan(1); // < 1ms from cache
  });

  test('should handle expired tokens', async () => {
    const expiredToken = createExpiredJWT();
    await manager.addToken('site1', expiredToken);

    const validation = await manager.validateToken('site1');
    expect(validation.expired).toBe(true);
    expect(validation.shouldWarn).toBe(true);
  });

  test('should support unlimited sites', async () => {
    const siteCount = 100;

    for (let i = 0; i < siteCount; i++) {
      await manager.addToken(`site${i}`, `token_${i}`);
    }

    const allTokens = await manager.getAllSiteTokens();
    expect(allTokens.size).toBe(siteCount);
  });
});
```

### 7.2 Integration Tests

**Scenarios to Test:**

1. **Token Resolution Flow**
   - User has no tokens → Uses default → API succeeds
   - User adds site-specific token → Overrides default
   - Default token expires → Falls back to user token
   - No tokens available → Shows prompt dialog

2. **Multi-Site Switching**
   - User switches from Site A to Site B
   - Correct token used for each site
   - API calls work for both sites simultaneously
   - Token status indicators update correctly

3. **Expiration Handling**
   - Token expires in 6 days → Shows warning banner
   - Token expires in 1 hour → Shows urgent warning
   - Token already expired → Blocks API calls
   - User refreshes token → Warning dismisses

4. **Migration**
   - Old token migrates to new system
   - User can access data immediately after migration
   - Both old and new systems work during dual-write period
   - Rollback restores old functionality

### 7.3 E2E Tests (Playwright)

```typescript
// e2e/token-management.spec.ts

test.describe('Token Management', () => {
  test('should use default token on first login', async ({ page }) => {
    // Login with Google
    await page.goto('/login');
    await page.click('[data-testid="google-login"]');

    // Should navigate to dashboard (not settings)
    await expect(page).toHaveURL('/dashboard');

    // Should load data successfully
    await expect(page.locator('[data-testid="chart-data"]')).toBeVisible();
  });

  test('should add token for new site', async ({ page }) => {
    await page.goto('/settings');

    // Click "Add Token" button
    await page.click('[data-testid="add-token-button"]');

    // Fill in form
    await page.fill('[data-testid="site-name-input"]', 'New Hospital');
    await page.fill('[data-testid="site-id-input"]', 'new_hospital');
    await page.fill('[data-testid="token-input"]', validJWTToken);

    // Wait for validation
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();

    // Save token
    await page.click('[data-testid="save-token-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="success-alert"]')).toBeVisible();

    // Token should appear in list
    await expect(page.locator('[data-testid="token-list"]')).toContainText('New Hospital');
  });

  test('should warn about expiring token', async ({ page }) => {
    // Setup: Add token expiring in 5 days
    await setupExpiringToken('site1', 5);

    await page.goto('/dashboard');

    // Should show warning banner
    await expect(page.locator('[data-testid="expiry-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="expiry-warning"]')).toContainText('5 days');
  });
});
```

---

## 8. Security Considerations

### 8.1 Security Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Encryption at rest** | AES-GCM-256 for all tokens | ✅ Implemented |
| **Encryption in transit** | HTTPS/TLS 1.3 | ✅ Existing |
| **Key derivation** | PBKDF2 (100k iterations) | ✅ Implemented |
| **Device-specific keys** | Each device has unique encryption key | ✅ Implemented |
| **No plain text storage** | All storage layers encrypted | ✅ New requirement |
| **Token hashing** | SHA-256 hash for verification | ✅ Existing |
| **Secure deletion** | Multiple overwrites before delete | 🔄 To implement |
| **Rate limiting** | Max 10 token operations/minute | 🔄 To implement |
| **Audit logging** | All token operations logged | 🔄 To implement |

### 8.2 Security Checklist

**Before Deployment:**

- [ ] All tokens encrypted in IndexedDB
- [ ] Firestore tokens encrypted (not plain text)
- [ ] Environment variables not committed to git
- [ ] Default tokens rotated regularly (quarterly)
- [ ] PBKDF2 iterations set to 100,000+
- [ ] Token validation prevents injection attacks
- [ ] Rate limiting prevents brute force
- [ ] Audit logs enabled for all token operations
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Dependency security scan passed
- [ ] Penetration testing completed
- [ ] Security audit report approved

**Ongoing:**

- [ ] Monitor for unusual token access patterns
- [ ] Rotate default tokens every 90 days
- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Respond to security advisories within 48 hours

### 8.3 Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| **Browser storage compromise** | High | AES-GCM-256 encryption with device-specific keys |
| **Firestore breach** | High | Encrypt tokens before cloud storage |
| **Token theft via XSS** | Medium | CSP headers, React XSS protection, HTTPOnly cookies |
| **Token theft via network** | Low | HTTPS only, HSTS enabled |
| **Insider threat** | Medium | Audit logging, least privilege access |
| **Brute force attacks** | Low | Rate limiting, exponential backoff |
| **Token replay attacks** | Medium | Short token expiration (30-90 days) |

---

## 9. Timeline & Resources

### 9.1 Gantt Chart (8-10 weeks)

```
Week  1  2  3  4  5  6  7  8  9  10
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P1: Foundation      [████████]
P2: API Integration          [████████]
P3: UI/UX                         [████████]
P4: Migration                           [████]
P5: Testing                              [████████]
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deploy                                      ⬆
```

### 9.2 Resource Allocation

| Role | Time Commitment | Phases |
|------|----------------|--------|
| **Frontend Developer** | 100% (8 weeks) | P1, P2, P3 |
| **Backend Developer** | 50% (4 weeks) | P1, P4 |
| **QA Engineer** | 75% (6 weeks) | P5 |
| **DevOps Engineer** | 25% (2 weeks) | P4, P5 |
| **Security Engineer** | 25% (2 weeks) | P1, P5 |
| **Product Manager** | 10% (1 week) | All |

**Total Effort:** ~12 person-weeks

### 9.3 Cost Estimate

| Category | Cost |
|----------|------|
| Development (8 weeks × $150/hr × 40hr/wk) | $48,000 |
| QA (6 weeks × $100/hr × 30hr/wk) | $18,000 |
| DevOps (2 weeks × $120/hr × 10hr/wk) | $2,400 |
| Security Audit | $5,000 |
| Contingency (20%) | $14,680 |
| **Total** | **$88,080** |

---

## 10. Success Metrics

### 10.1 Key Performance Indicators (KPIs)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **User Onboarding Time** | 5 min (manual entry) | 30 sec (default token) | Google Analytics |
| **Token-Related Support Tickets** | 15/month | < 5/month | Help desk |
| **API Call Success Rate** | 94% | > 99% | Application logs |
| **Token Resolution Time** | N/A | < 10ms | Performance monitoring |
| **Multi-Site Adoption** | 0% | > 40% | Feature analytics |
| **Code Complexity** | 4 storage layers | 2 storage layers | Architecture review |
| **Security Incidents** | 1/year | 0/year | Security logs |

### 10.2 Success Criteria

**Must Have (Launch Blockers):**
- ✅ Default tokens work for primary site
- ✅ Users can add tokens for additional sites
- ✅ Token expiration warnings display correctly
- ✅ All existing tokens migrated successfully
- ✅ Security audit passed
- ✅ Performance targets met

**Should Have (Post-Launch):**
- 🔄 Token auto-refresh mechanism
- 🔄 Admin panel for token management
- 🔄 Token usage analytics
- 🔄 Export/import token configuration

**Nice to Have (Future):**
- 🔮 SSO integration for token provisioning
- 🔮 Centralized token management server
- 🔮 Token rotation automation

---

## 11. Risk Assessment

### 11.1 High-Risk Items

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data loss during migration** | Low | Critical | Thorough testing, dual-write period, backups |
| **Breaking changes affect existing users** | Medium | High | Feature flags, gradual rollout, rollback plan |
| **Performance degradation** | Low | High | Load testing, caching strategy, monitoring |
| **Security vulnerability** | Low | Critical | Security audit, penetration testing, code review |
| **IndexedDB browser compatibility** | Low | Medium | localStorage fallback, browser detection |

### 11.2 Mitigation Strategies

**Data Loss Prevention:**
1. **Backup before migration** - Export all tokens to JSON
2. **Dual-write period** - Write to both old and new systems
3. **Migration verification** - Automated checks after migration
4. **Rollback plan** - One-click rollback to old system

**Breaking Change Management:**
1. **Feature flags** - Gradual rollout (10% → 50% → 100%)
2. **Backward compatibility** - Support old API for 3 months
3. **User communication** - Email notifications before changes
4. **Support readiness** - Help docs and support training

---

## 12. Next Steps

### 12.1 Immediate Actions (This Week)

- [ ] **Review this plan** with team and stakeholders
- [ ] **Get approval** from technical lead and product manager
- [ ] **Setup development environment** with test tokens
- [ ] **Create project board** in GitHub/Jira
- [ ] **Schedule sprint planning** for Phase 1

### 12.2 Phase 1 Kickoff (Next Week)

- [ ] **Create feature branch** `feature/multi-token-system`
- [ ] **Setup TypeScript interfaces** (`token.types.ts`)
- [ ] **Begin Task 1.1** (MultiTokenManager)
- [ ] **Daily standups** at 10am
- [ ] **Weekly demo** every Friday

### 12.3 Communication Plan

| Stakeholder | Frequency | Format | Content |
|-------------|-----------|--------|---------|
| **Engineering Team** | Daily | Standup | Progress, blockers |
| **Product Team** | Weekly | Demo | Feature showcase |
| **Leadership** | Bi-weekly | Report | Metrics, timeline |
| **End Users** | Monthly | Email | Feature updates |

---

## Appendix

### A. Glossary

- **ACE IoT Token**: JWT bearer token for ACE IoT API authorization
- **Default Token**: Hardcoded token for primary site (no manual entry)
- **Multi-Site Token**: User-configured token for additional sites
- **Token Resolution**: Process of selecting correct token for API call
- **Fallback Chain**: Priority order for token selection
- **Dual-Write Period**: Phase where both old and new systems are active
- **Feature Flag**: Toggle to enable/disable new functionality

### B. References

- **Architecture Design**: `/docs/architecture/TOKEN_ARCHITECTURE_SUMMARY.md`
- **Implementation Guide**: `/docs/architecture/TOKEN_IMPLEMENTATION_GUIDE.md`
- **API Documentation**: `/docs/ACE_API_INTEGRATION_GUIDE.md`
- **Security Standards**: OWASP Top 10, NIST SP 800-63B

### C. Contact Information

- **Technical Lead**: [Name] - [email]
- **Product Manager**: [Name] - [email]
- **Security Engineer**: [Name] - [email]
- **DevOps Lead**: [Name] - [email]

---

**Document Version:** 1.0
**Last Updated:** 2025-01-31
**Next Review:** 2025-02-07
**Status:** ✅ Ready for Review
