# Authentication Refactor - Implementation Checklist
## Multi-Site Token Management with Cloudflare Worker Integration

**Project:** Building Vitals Application
**Version:** 1.0
**Date:** 2025-01-31

---

## 🎯 Project Goals

Transform authentication from manual single-token to automated multi-site token management:

**FROM:**
- ❌ Users manually enter tokens in Settings
- ❌ Single token per user (no multi-site support)
- ❌ Token entry required before using app
- ❌ Plain text tokens in Firestore

**TO:**
- ✅ Default hardcoded tokens (zero-friction onboarding)
- ✅ Multi-site token support (unlimited sites)
- ✅ Automatic token injection in API calls
- ✅ Encrypted storage everywhere

---

## 📋 Complete Task List

### Phase 1: Foundation (Weeks 1-2)

#### ✅ Task 1.1: Setup Environment & Configuration
**Priority:** High | **Complexity:** Low | **Effort:** 2 hours

**Subtasks:**
- [ ] Create `.env.local` file with default tokens
- [ ] Add `VITE_DEFAULT_TOKEN_FALLS_CITY` environment variable
- [ ] Add `VITE_DEFAULT_TOKEN_SITE_2` environment variable (if needed)
- [ ] Add `VITE_DEFAULT_SITE_ID=ses_falls_city` variable
- [ ] Test environment variables load correctly
- [ ] Document environment setup in README

**Files to Create/Modify:**
- `.env.local` (create if not exists)
- `README.md` (update setup instructions)

**Verification:**
```bash
# Test environment variables
npm run dev
# Check console for loaded variables
```

**Acceptance Criteria:**
- [ ] Environment variables accessible via `import.meta.env`
- [ ] Default tokens not committed to git
- [ ] `.env.local.example` created with placeholders

---

#### ✅ Task 1.2: Create TypeScript Type Definitions
**Priority:** High | **Complexity:** Low | **Effort:** 1 hour

**Subtasks:**
- [ ] Create `src/types/token.types.ts` file
- [ ] Define `SiteToken` interface
- [ ] Define `TokenData` interface (encrypted storage format)
- [ ] Define `TokenValidation` interface
- [ ] Define `ExpiryStatus` interface
- [ ] Define `JWTPayload` interface
- [ ] Export all types

**Code to Create:**
```typescript
// src/types/token.types.ts

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

export interface TokenData {
  encrypted: string;
  iv: string;
  salt: string;
  version: number;
}

export interface TokenValidation {
  valid: boolean;
  expired: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  errors: string[];
}

export interface ExpiryStatus {
  expired: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  shouldWarn: boolean;
  shouldBlock: boolean;
}

export interface JWTPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  siteId?: string;
  [key: string]: any;
}
```

**Acceptance Criteria:**
- [ ] All interfaces correctly typed
- [ ] No TypeScript errors
- [ ] Exported types used in other files

---

#### ✅ Task 1.3: Create Default Token Provider
**Priority:** High | **Complexity:** Low | **Effort:** 2 hours

**Subtasks:**
- [ ] Create `src/config/defaultTokens.ts` file
- [ ] Load tokens from environment variables
- [ ] Create `getDefaultToken(siteId)` function
- [ ] Create `hasDefaultToken(siteId)` function
- [ ] Create `listSitesWithDefaultTokens()` function
- [ ] Add validation on module load
- [ ] Add console warnings for missing tokens (not errors)

**Code to Create:**
```typescript
// src/config/defaultTokens.ts

const DEFAULT_TOKENS: Record<string, string> = {
  'ses_falls_city': import.meta.env.VITE_DEFAULT_TOKEN_FALLS_CITY || '',
  'site_2': import.meta.env.VITE_DEFAULT_TOKEN_SITE_2 || '',
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

// Validate on module load
const validation = listSitesWithDefaultTokens();
console.log(`Default tokens available for ${validation.length} sites:`, validation);
```

**Testing:**
- [ ] Unit tests for all functions
- [ ] Test with missing environment variables
- [ ] Test with valid environment variables

**Acceptance Criteria:**
- [ ] Returns correct token for configured sites
- [ ] Returns null for unconfigured sites
- [ ] No errors on app startup
- [ ] Console shows available sites on load

---

#### ✅ Task 1.4: Create TokenStorageService (IndexedDB)
**Priority:** High | **Complexity:** High | **Effort:** 16 hours

**Subtasks:**
- [ ] Create `src/services/tokenStorage.ts` file
- [ ] Initialize IndexedDB with `tokens` object store
- [ ] Create indexes: `siteId`, `createdAt`, `expiresAt`
- [ ] Implement `saveToken(siteId, data)` method
- [ ] Implement `loadToken(siteId)` method
- [ ] Implement `loadAllTokens()` method
- [ ] Implement `deleteToken(siteId)` method
- [ ] Add encryption integration
- [ ] Add localStorage fallback
- [ ] Handle IndexedDB quota errors
- [ ] Implement token hashing (SHA-256)
- [ ] Add bulk operations support

**Key Methods:**
```typescript
class TokenStorageService {
  async init(): Promise<void>
  async saveToken(siteId: string, data: SiteToken): Promise<void>
  async loadToken(siteId: string): Promise<SiteToken | null>
  async loadAllTokens(): Promise<Map<string, SiteToken>>
  async deleteToken(siteId: string): Promise<void>
  async clearAllTokens(): Promise<void>
}
```

**Testing:**
- [ ] Unit tests: 20+ tests
- [ ] Test encryption/decryption
- [ ] Test IndexedDB fallback to localStorage
- [ ] Test quota exceeded handling
- [ ] Test bulk operations (100+ tokens)
- [ ] Performance test: < 10ms per operation

**Acceptance Criteria:**
- [ ] All tokens encrypted before storage
- [ ] IndexedDB correctly initialized
- [ ] Fallback to localStorage works
- [ ] Quota errors handled gracefully
- [ ] 90%+ code coverage
- [ ] All async operations properly handled

---

#### ✅ Task 1.5: Create MultiTokenManager Service
**Priority:** High | **Complexity:** Medium-High | **Effort:** 12 hours

**Subtasks:**
- [ ] Create `src/services/multiTokenManager.ts` file
- [ ] Implement singleton pattern
- [ ] Integrate TokenStorageService
- [ ] Implement `addToken(siteId, token)` method
- [ ] Implement `getToken(siteId)` method with caching
- [ ] Implement `removeToken(siteId)` method
- [ ] Implement `getAllSiteTokens()` method
- [ ] Implement `setCurrentSite(siteId)` method
- [ ] Add 5-minute cache with TTL
- [ ] Add event emitter for token changes
- [ ] Add token validation integration

**Key Methods:**
```typescript
class MultiTokenManager {
  static getInstance(): MultiTokenManager
  async addToken(siteId: string, token: string): Promise<void>
  async getToken(siteId: string): Promise<string | null>
  async removeToken(siteId: string): Promise<void>
  async getAllSiteTokens(): Promise<Map<string, SiteToken>>
  setCurrentSite(siteId: string): void
  getCurrentSite(): string
  invalidateCache(siteId?: string): void
}
```

**Events to Emit:**
- `tokenAdded` - When token added
- `tokenRemoved` - When token removed
- `tokenUpdated` - When token updated
- `currentSiteChanged` - When current site changes

**Testing:**
- [ ] Unit tests: 15+ tests
- [ ] Test singleton pattern
- [ ] Test caching behavior
- [ ] Test event emission
- [ ] Test with 100+ tokens
- [ ] Performance test: < 1ms from cache

**Acceptance Criteria:**
- [ ] Singleton correctly implemented
- [ ] Cache reduces DB queries by 90%+
- [ ] Events trigger correctly
- [ ] Supports unlimited sites
- [ ] 95%+ code coverage

---

#### ✅ Task 1.6: Create Token Validation Service
**Priority:** Medium | **Complexity:** Medium | **Effort:** 8 hours

**Subtasks:**
- [ ] Create `src/services/tokenValidator.ts` file
- [ ] Implement JWT decoding
- [ ] Implement expiration checking
- [ ] Implement format validation
- [ ] Add API test method (live validation)
- [ ] Calculate days until expiry
- [ ] Determine warning thresholds

**Key Methods:**
```typescript
class TokenValidator {
  static validate(token: string): Promise<TokenValidation>
  static decodeJWT(token: string): JWTPayload
  static checkExpiration(token: string): ExpiryStatus
  static testWithAPI(token: string): Promise<boolean>
  static isValidFormat(token: string): boolean
}
```

**Validation Rules:**
- JWT format: 3 parts separated by dots
- Expiration: < 7 days = warning, < 1 day = urgent, expired = block
- API test: Make actual API call to verify token works

**Testing:**
- [ ] Unit tests: 12+ tests
- [ ] Test with valid tokens
- [ ] Test with expired tokens
- [ ] Test with malformed tokens
- [ ] Test API validation (mocked)

**Acceptance Criteria:**
- [ ] Correctly identifies valid/invalid tokens
- [ ] Expiration calculated accurately
- [ ] API test makes real call
- [ ] 90%+ code coverage

---

### Phase 2: API Integration (Weeks 3-4)

#### ✅ Task 2.1: Create TokenResolver with Fallback Chain
**Priority:** High | **Complexity:** Medium | **Effort:** 10 hours

**Subtasks:**
- [ ] Create `src/services/tokenResolver.ts` file
- [ ] Implement priority chain logic:
  - 1. Site-specific token (user-configured)
  - 2. Default token (hardcoded)
  - 3. User's global token (legacy)
  - 4. Return null (prompt user)
- [ ] Add 5-minute cache with TTL
- [ ] Log resolution decisions
- [ ] Emit events for missing tokens
- [ ] Track resolution source (debugging)

**Key Method:**
```typescript
class TokenResolver {
  async resolveToken(siteId: string): Promise<string | null>
  invalidateCache(siteId?: string): void
  getResolutionSource(siteId: string): 'site' | 'default' | 'global' | null
}
```

**Testing:**
- [ ] Unit tests: 25+ tests covering all scenarios
- [ ] Test each fallback level
- [ ] Test cache behavior
- [ ] Test with missing tokens
- [ ] Performance test: < 5ms cached, < 10ms uncached

**Acceptance Criteria:**
- [ ] Correctly follows priority chain
- [ ] Cache hit rate > 90%
- [ ] Missing tokens emit events (not errors)
- [ ] 95%+ code coverage

---

#### ✅ Task 2.2: Create Token Interceptor for axios
**Priority:** High | **Complexity:** Medium | **Effort:** 12 hours

**Subtasks:**
- [ ] Create `src/services/tokenInterceptor.ts` file
- [ ] Setup axios request interceptor
- [ ] Extract siteId from request URL/context
- [ ] Use TokenResolver to get token
- [ ] Inject token into `X-ACE-Token` header
- [ ] Setup axios response interceptor
- [ ] Handle 401/403 responses
- [ ] Implement request queue during token refresh
- [ ] Add retry logic after token refresh

**Key Integration Points:**
```typescript
// Request interceptor
axiosInstance.interceptors.request.use(async (config) => {
  const siteId = extractSiteId(config);
  const token = await tokenResolver.resolveToken(siteId);
  if (token) {
    config.headers['X-ACE-Token'] = token;
  }
  return config;
});

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Handle token refresh
    }
    return Promise.reject(error);
  }
);
```

**Testing:**
- [ ] Integration tests: 15+ scenarios
- [ ] Test token injection
- [ ] Test 401/403 handling
- [ ] Test request queueing
- [ ] Test retry logic

**Acceptance Criteria:**
- [ ] All API requests automatically have token
- [ ] Correct token used based on site context
- [ ] 401/403 errors trigger refresh
- [ ] Failed requests retried after refresh
- [ ] No manual token header setting required

---

#### ✅ Task 2.3: Update Cloudflare Worker Integration
**Priority:** High | **Complexity:** Medium | **Effort:** 6 hours

**Context:**
The Cloudflare Worker fetches `/configured_points` and needs the correct token. This is the PRIMARY integration point.

**Workflow:**
1. User selects chart type
2. User selects site
3. Worker fetches `/configured_points` using token
4. Worker cleans data (removes ALL-CAPS, adds display_name)
5. Worker caches in KV
6. Frontend displays cleaned points
7. User selects points
8. System fetches timeseries using original Name field
9. Chart renders

**Subtasks:**
- [ ] Review `workers/ai-enhanced-worker.js` current token handling
- [ ] Ensure worker receives token from frontend correctly
- [ ] Update worker to use `X-ACE-Token` header
- [ ] Test worker with site-specific tokens
- [ ] Update worker error logging for token issues
- [ ] Test `/configured_points` with multiple sites

**Key Files:**
- `workers/ai-enhanced-worker.js` (review token handling)
- `src/services/api/cloudflareWorkerClient.ts` (update token passing)

**Testing:**
- [ ] Test worker with default token
- [ ] Test worker with user-added token
- [ ] Test worker with expired token
- [ ] Verify enhanced error logging shows token issues

**Acceptance Criteria:**
- [ ] Worker correctly receives token for each site
- [ ] `/configured_points` fetch succeeds with token
- [ ] Token errors logged clearly
- [ ] Multi-site support works in worker

---

#### ✅ Task 2.4: Update axiosInstance Configuration
**Priority:** High | **Complexity:** Low | **Effort:** 4 hours

**Subtasks:**
- [ ] Update `src/services/axiosInstance.ts`
- [ ] Remove manual `setAceToken()` calls
- [ ] Rely on interceptor for token injection
- [ ] Update base URL configuration
- [ ] Add request/response logging (development only)

**Code Changes:**
```typescript
// src/services/axiosInstance.ts

import axios from 'axios';
import { tokenInterceptor } from './tokenInterceptor';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token interceptor handles all token injection
// No manual setAceToken() needed

export default axiosInstance;
```

**Testing:**
- [ ] Test API calls without manual token setting
- [ ] Verify token automatically injected
- [ ] Test with multiple sites

**Acceptance Criteria:**
- [ ] No manual token header setting required
- [ ] Interceptor handles all token injection
- [ ] All existing API calls still work

---

### Phase 3: UI/UX Enhancement (Weeks 5-6)

#### ✅ Task 3.1: Create AddTokenDialog Component
**Priority:** High | **Complexity:** Medium | **Effort:** 10 hours

**Subtasks:**
- [ ] Create `src/components/settings/AddTokenDialog.tsx`
- [ ] Design Material-UI dialog layout
- [ ] Add form fields: Site Name, Site ID, Token
- [ ] Implement real-time token validation
- [ ] Show token expiration after validation
- [ ] Add "Test Token" button (live API test)
- [ ] Add show/hide token toggle
- [ ] Implement success/error feedback
- [ ] Make mobile-responsive

**UI Elements:**
- Site Name input (text)
- Site ID input (text, lowercase, no spaces)
- Token input (password with toggle)
- Validation indicator (✓/✗ icon)
- Expiration date display
- Test Token button
- Save/Cancel buttons

**Testing:**
- [ ] Unit tests for validation logic
- [ ] Integration tests for save flow
- [ ] Test mobile responsiveness
- [ ] Test with valid/invalid tokens

**Acceptance Criteria:**
- [ ] Dialog opens on "Add Token" click
- [ ] Real-time validation shows ✓/✗
- [ ] Token expiration displayed
- [ ] "Test Token" verifies with API
- [ ] Success message on save
- [ ] Mobile-friendly design

---

#### ✅ Task 3.2: Create TokenStatusIndicator Component
**Priority:** Medium | **Complexity:** Low | **Effort:** 6 hours

**Subtasks:**
- [ ] Create `src/components/settings/TokenStatusIndicator.tsx`
- [ ] Design status badges (Active, Warning, Expired)
- [ ] Show days until expiration
- [ ] Add color coding (green/yellow/red)
- [ ] Make clickable to show details

**Status Levels:**
- **Active** (green): > 7 days until expiry
- **Warning** (yellow): 1-7 days until expiry
- **Urgent** (orange): < 1 day until expiry
- **Expired** (red): Already expired

**Testing:**
- [ ] Unit tests for status calculation
- [ ] Visual tests with Storybook
- [ ] Test with various expiry dates

**Acceptance Criteria:**
- [ ] Correct status displayed
- [ ] Color coding works
- [ ] Days remaining shown
- [ ] Responsive design

---

#### ✅ Task 3.3: Enhance TokenManager Component
**Priority:** High | **Complexity:** Medium | **Effort:** 12 hours

**Subtasks:**
- [ ] Update `src/components/settings/TokenManager.tsx`
- [ ] Add support for multiple tokens
- [ ] Display list of configured sites
- [ ] Show status indicator for each site
- [ ] Add "Add Token" button → opens AddTokenDialog
- [ ] Add "Remove Token" action
- [ ] Add "Refresh Token" action
- [ ] Show default token indicator
- [ ] Add site selector

**UI Layout:**
```
┌──────────────────────────────────────────┐
│ Token Management                         │
├──────────────────────────────────────────┤
│ [+ Add Token]                            │
├──────────────────────────────────────────┤
│ Sites:                                   │
│                                          │
│ ✓ Falls City Hospital (Default)         │
│   [Active - 45 days remaining]          │
│   [Remove] [Refresh]                     │
│                                          │
│ ✓ Site 2                                 │
│   [Warning - 5 days remaining]           │
│   [Remove] [Refresh]                     │
└──────────────────────────────────────────┘
```

**Testing:**
- [ ] Integration tests for all actions
- [ ] Test with 0, 1, 5, 10+ sites
- [ ] Test mobile layout
- [ ] Test remove confirmation

**Acceptance Criteria:**
- [ ] Lists all configured sites
- [ ] Shows status for each
- [ ] Add/Remove/Refresh work correctly
- [ ] Default token indicated
- [ ] Mobile-responsive

---

#### ✅ Task 3.4: Update Site Selector Component
**Priority:** Medium | **Complexity:** Low | **Effort:** 4 hours

**Subtasks:**
- [ ] Update `src/components/common/SiteSelector.tsx`
- [ ] Show token status indicator next to each site
- [ ] Disable sites without tokens (with explanation)
- [ ] Add "Add Token" link for disabled sites

**UI Enhancement:**
```
┌─────────────────────────────────┐
│ Select Site:                    │
│ [v] Falls City [✓]              │
│     Site 2 [⚠ Expiring]         │
│     Site 3 [+ Add Token]        │
└─────────────────────────────────┘
```

**Testing:**
- [ ] Test with various token states
- [ ] Test "Add Token" link
- [ ] Test disabled state

**Acceptance Criteria:**
- [ ] Token status visible
- [ ] Disabled sites explained
- [ ] "Add Token" link works

---

#### ✅ Task 3.5: Create Token Expiry Warning Banner
**Priority:** Medium | **Complexity:** Low | **Effort:** 4 hours

**Subtasks:**
- [ ] Create `src/components/common/TokenExpiryWarning.tsx`
- [ ] Show banner when token < 7 days from expiry
- [ ] Display days remaining
- [ ] Add "Refresh Token" action
- [ ] Add "Dismiss" action (temporary)
- [ ] Make banner sticky (top of page)

**Warning Levels:**
- **7 days**: Yellow banner, dismissible
- **3 days**: Orange banner, dismissible
- **1 day**: Red banner, not dismissible
- **Expired**: Red banner, blocks actions

**Testing:**
- [ ] Test with various expiry dates
- [ ] Test dismiss behavior
- [ ] Test refresh action

**Acceptance Criteria:**
- [ ] Banner shows at correct thresholds
- [ ] Correct colors for each level
- [ ] Refresh action works
- [ ] Dismiss saves preference

---

### Phase 4: Migration & Compatibility (Week 7)

#### ✅ Task 4.1: Create Token Migration Service
**Priority:** High | **Complexity:** High | **Effort:** 10 hours

**Subtasks:**
- [ ] Create `src/services/tokenMigration.ts`
- [ ] Implement `migrateUserTokens(userId)` method
- [ ] Implement `migrateAllUsers()` batch method
- [ ] Read old token from Firestore
- [ ] Determine siteId (default to `__global__`)
- [ ] Save to new multi-token system
- [ ] Verify migration success
- [ ] Log migration events
- [ ] Handle migration errors gracefully

**Migration Flow:**
```
1. Read old token from Firestore (users/{uid}/aceJwt)
2. Extract site info (or default to __global__)
3. Save to IndexedDB via MultiTokenManager
4. Verify token readable from new system
5. Log success to Firestore (migrations collection)
6. Keep old token for rollback (dual-write period)
```

**Testing:**
- [ ] Unit tests: 15+ tests
- [ ] Test with single user
- [ ] Test batch migration (100+ users)
- [ ] Test migration failure handling
- [ ] Test rollback scenario

**Acceptance Criteria:**
- [ ] Zero data loss
- [ ] All tokens migrated correctly
- [ ] Migration logged for audit
- [ ] Rollback possible

---

#### ✅ Task 4.2: Implement Feature Flag System
**Priority:** Medium | **Complexity:** Medium | **Effort:** 6 hours

**Subtasks:**
- [ ] Create `src/utils/featureFlags.ts`
- [ ] Implement flag storage (localStorage)
- [ ] Add `NEW_TOKEN_SYSTEM` flag
- [ ] Implement percentage-based rollout
- [ ] Add admin UI for flag control

**Feature Flag Usage:**
```typescript
const featureFlags = FeatureFlagService.getInstance();

if (featureFlags.isEnabled('NEW_TOKEN_SYSTEM')) {
  // Use new multi-token system
  const token = await multiTokenManager.getToken(siteId);
} else {
  // Use old single-token system
  const token = await tokenService.getToken(userId);
}
```

**Rollout Plan:**
- Week 8: 10% of users
- Week 9: 50% of users
- Week 10: 100% of users

**Testing:**
- [ ] Test flag enable/disable
- [ ] Test percentage-based rollout
- [ ] Test with different user segments

**Acceptance Criteria:**
- [ ] Flags toggle correctly
- [ ] Percentage rollout works
- [ ] Admin UI functional

---

#### ✅ Task 4.3: Implement Dual-Write System
**Priority:** High | **Complexity:** Medium | **Effort:** 8 hours

**Subtasks:**
- [ ] Update token save operations to write to both systems
- [ ] Update token load operations to read from new, fallback to old
- [ ] Add monitoring for sync issues
- [ ] Log discrepancies between systems

**Dual-Write Logic:**
```typescript
async function saveToken(siteId: string, token: string) {
  // Write to new system
  await multiTokenManager.addToken(siteId, token);

  // Also write to old system (for rollback)
  await oldTokenService.saveToken(userId, token);

  // Log dual-write success
  console.log('Token saved to both systems');
}

async function loadToken(siteId: string) {
  // Try new system first
  let token = await multiTokenManager.getToken(siteId);

  if (!token) {
    // Fallback to old system
    token = await oldTokenService.getToken(userId);

    if (token) {
      // Migrate to new system
      await multiTokenManager.addToken(siteId, token);
    }
  }

  return token;
}
```

**Testing:**
- [ ] Test write to both systems
- [ ] Test read fallback
- [ ] Test automatic migration
- [ ] Monitor for sync issues

**Acceptance Criteria:**
- [ ] Both systems stay in sync
- [ ] Fallback works correctly
- [ ] No data loss during transition

---

#### ✅ Task 4.4: Create Migration Dashboard (Admin)
**Priority:** Low | **Complexity:** Medium | **Effort:** 8 hours

**Subtasks:**
- [ ] Add migration section to Admin page
- [ ] Show migration stats:
  - Total users
  - Users migrated
  - Users pending
  - Migration errors
- [ ] Add "Run Migration" button (admin only)
- [ ] Show migration logs
- [ ] Add rollback button

**UI Layout:**
```
┌────────────────────────────────────────┐
│ Token Migration Dashboard              │
├────────────────────────────────────────┤
│ Status: In Progress                    │
│                                        │
│ Total Users: 150                       │
│ Migrated: 120 (80%)                    │
│ Pending: 30 (20%)                      │
│ Errors: 0                              │
│                                        │
│ [Run Migration] [View Logs] [Rollback]│
└────────────────────────────────────────┘
```

**Testing:**
- [ ] Test with admin user
- [ ] Test migration button
- [ ] Test logs display

**Acceptance Criteria:**
- [ ] Stats display correctly
- [ ] Migration runs successfully
- [ ] Logs show details
- [ ] Rollback works

---

### Phase 5: Testing & Polish (Weeks 8-9)

#### ✅ Task 5.1: Write Unit Tests
**Priority:** High | **Complexity:** Medium | **Effort:** 16 hours

**Test Coverage Goals:**
- MultiTokenManager: 95%
- TokenStorageService: 90%
- TokenResolver: 95%
- TokenInterceptor: 90%
- DefaultTokenProvider: 100%
- **Overall Target:** 92%+

**Test Categories:**
- [ ] Happy path tests
- [ ] Error handling tests
- [ ] Edge case tests
- [ ] Performance tests
- [ ] Security tests

**Key Test Files to Create:**
- [ ] `src/services/__tests__/multiTokenManager.test.ts`
- [ ] `src/services/__tests__/tokenStorage.test.ts`
- [ ] `src/services/__tests__/tokenResolver.test.ts`
- [ ] `src/services/__tests__/tokenInterceptor.test.ts`
- [ ] `src/config/__tests__/defaultTokens.test.ts`

**Acceptance Criteria:**
- [ ] 90%+ code coverage
- [ ] All tests pass
- [ ] No flaky tests
- [ ] Tests run < 30 seconds

---

#### ✅ Task 5.2: Write Integration Tests
**Priority:** High | **Complexity:** Medium | **Effort:** 12 hours

**Scenarios to Test:**

**Token Resolution Flow:**
- [ ] User has no tokens → Uses default → API succeeds
- [ ] User adds site-specific token → Overrides default
- [ ] Default token expires → Falls back to user token
- [ ] No tokens available → Shows prompt dialog

**Multi-Site Switching:**
- [ ] User switches from Site A to Site B
- [ ] Correct token used for each site
- [ ] API calls work for both sites simultaneously
- [ ] Token status indicators update correctly

**Expiration Handling:**
- [ ] Token expires in 6 days → Shows warning banner
- [ ] Token expires in 1 hour → Shows urgent warning
- [ ] Token already expired → Blocks API calls
- [ ] User refreshes token → Warning dismisses

**Migration:**
- [ ] Old token migrates to new system
- [ ] User can access data immediately after migration
- [ ] Both systems work during dual-write period
- [ ] Rollback restores old functionality

**Acceptance Criteria:**
- [ ] 15+ integration tests
- [ ] All scenarios covered
- [ ] Tests pass consistently

---

#### ✅ Task 5.3: Write E2E Tests (Playwright)
**Priority:** Medium | **Complexity:** High | **Effort:** 12 hours

**Test Scenarios:**

**Default Token Flow:**
- [ ] New user logs in with Google
- [ ] Should navigate to dashboard (not settings)
- [ ] Should load data successfully using default token
- [ ] Should display charts without manual token entry

**Add Token for New Site:**
- [ ] Navigate to Settings
- [ ] Click "Add Token" button
- [ ] Fill in site name, site ID, token
- [ ] Wait for validation success
- [ ] Save token
- [ ] Verify token appears in list
- [ ] Navigate to dashboard
- [ ] Switch to new site
- [ ] Verify data loads

**Token Expiry Warning:**
- [ ] Setup token expiring in 5 days
- [ ] Navigate to dashboard
- [ ] Verify warning banner appears
- [ ] Verify "5 days remaining" shown
- [ ] Click "Refresh Token"
- [ ] Verify dialog opens
- [ ] Enter new token
- [ ] Verify warning dismisses

**Acceptance Criteria:**
- [ ] 10+ E2E tests
- [ ] Tests run in CI/CD
- [ ] Tests pass on Chrome, Firefox, Safari
- [ ] Mobile tests pass

---

#### ✅ Task 5.4: Performance Testing
**Priority:** Medium | **Complexity:** Medium | **Effort:** 8 hours

**Performance Targets:**

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Token retrieval (cached) | < 1ms | Performance.now() |
| Token retrieval (IndexedDB) | < 10ms | Performance.now() |
| Token encryption | < 5ms | Performance.now() |
| Token validation | < 2ms | Performance.now() |
| Bulk operations (100 tokens) | < 50ms | Performance.now() |
| Page load with default token | < 100ms overhead | Lighthouse |

**Testing:**
- [ ] Benchmark all core operations
- [ ] Test with 100+ tokens
- [ ] Test cache hit rates
- [ ] Run Lighthouse performance audit
- [ ] Optimize bottlenecks

**Acceptance Criteria:**
- [ ] All targets met
- [ ] No performance regressions
- [ ] Cache hit rate > 90%

---

#### ✅ Task 5.5: Security Audit
**Priority:** High | **Complexity:** High | **Effort:** 8 hours

**Security Checklist:**

**Encryption:**
- [ ] All tokens encrypted in IndexedDB
- [ ] Firestore tokens encrypted (not plain text)
- [ ] PBKDF2 iterations set to 100,000+
- [ ] Device-specific encryption keys
- [ ] Secure key derivation

**Storage:**
- [ ] No tokens in localStorage (plain text)
- [ ] No tokens in Redux DevTools (production)
- [ ] No tokens logged to console (production)
- [ ] Secure deletion (multiple overwrites)

**Transport:**
- [ ] HTTPS only (no HTTP)
- [ ] TLS 1.3
- [ ] HSTS enabled
- [ ] CSP headers configured

**Access Control:**
- [ ] Rate limiting on token operations
- [ ] Audit logging enabled
- [ ] User can only access their tokens
- [ ] Admin roles properly enforced

**Testing:**
- [ ] Penetration testing
- [ ] Vulnerability scanning
- [ ] Dependency audit (npm audit)
- [ ] OWASP Top 10 review

**Acceptance Criteria:**
- [ ] No critical vulnerabilities
- [ ] All medium/high issues resolved
- [ ] Security report approved

---

#### ✅ Task 5.6: Create User Documentation
**Priority:** Medium | **Complexity:** Low | **Effort:** 6 hours

**Documentation to Create:**

**User Guides:**
- [ ] How to add a token for a new site
- [ ] How to refresh an expiring token
- [ ] How to switch between sites
- [ ] Troubleshooting guide

**Admin Guides:**
- [ ] How to run migration
- [ ] How to manage feature flags
- [ ] How to monitor token usage
- [ ] How to handle support tickets

**Developer Guides:**
- [ ] API reference for token services
- [ ] Architecture overview
- [ ] Testing guide
- [ ] Deployment guide

**Files to Create:**
- [ ] `docs/user-guide/TOKEN_MANAGEMENT.md`
- [ ] `docs/admin-guide/MIGRATION.md`
- [ ] `docs/developer-guide/TOKEN_API.md`

**Acceptance Criteria:**
- [ ] All guides complete
- [ ] Screenshots included
- [ ] Step-by-step instructions
- [ ] Reviewed by team

---

### Phase 6: Deployment (Week 10)

#### ✅ Task 6.1: Prepare Production Environment
**Priority:** High | **Complexity:** Medium | **Effort:** 6 hours

**Subtasks:**
- [ ] Add production environment variables to hosting
- [ ] Setup production default tokens (rotated from development)
- [ ] Configure Firebase Security Rules
- [ ] Setup monitoring alerts
- [ ] Configure error tracking (Sentry)
- [ ] Test staging environment

**Environment Variables (Production):**
```bash
VITE_DEFAULT_TOKEN_FALLS_CITY=<production_token>
VITE_DEFAULT_TOKEN_SITE_2=<production_token>
VITE_DEFAULT_SITE_ID=ses_falls_city
VITE_ENCRYPTION_SECRET=<production_secret>
```

**Acceptance Criteria:**
- [ ] All environment variables set
- [ ] Staging tests pass
- [ ] Monitoring configured
- [ ] Rollback plan documented

---

#### ✅ Task 6.2: Deploy with Feature Flag (10%)
**Priority:** High | **Complexity:** Low | **Effort:** 4 hours

**Deployment Steps:**
1. [ ] Deploy code to production
2. [ ] Enable feature flag for 10% of users
3. [ ] Monitor for 24 hours
4. [ ] Check error rates
5. [ ] Review user feedback
6. [ ] If stable, proceed to 50%

**Monitoring Metrics:**
- [ ] Error rate < 0.1%
- [ ] API success rate > 99%
- [ ] Page load time < 3 seconds
- [ ] No critical bugs reported

**Acceptance Criteria:**
- [ ] Deployed successfully
- [ ] 10% users using new system
- [ ] No critical issues
- [ ] Metrics within targets

---

#### ✅ Task 6.3: Deploy to 50% of Users
**Priority:** High | **Complexity:** Low | **Effort:** 2 hours

**Deployment Steps:**
1. [ ] Enable feature flag for 50% of users
2. [ ] Monitor for 48 hours
3. [ ] Check migration progress
4. [ ] Review support tickets
5. [ ] If stable, proceed to 100%

**Acceptance Criteria:**
- [ ] 50% users migrated
- [ ] No increase in error rates
- [ ] Support tickets normal
- [ ] Performance stable

---

#### ✅ Task 6.4: Deploy to 100% of Users
**Priority:** High | **Complexity:** Low | **Effort:** 2 hours

**Deployment Steps:**
1. [ ] Enable feature flag for 100% of users
2. [ ] Monitor for 1 week
3. [ ] Verify all users migrated
4. [ ] Remove old token code (after 3 months)

**Acceptance Criteria:**
- [ ] All users on new system
- [ ] No critical issues
- [ ] Migration complete
- [ ] Old code deprecated

---

## 📊 Progress Tracking

### Overall Progress

**Phase 1: Foundation** [░░░░░░░░░░] 0% (0/6 tasks)
**Phase 2: API Integration** [░░░░░░░░░░] 0% (0/4 tasks)
**Phase 3: UI/UX** [░░░░░░░░░░] 0% (0/5 tasks)
**Phase 4: Migration** [░░░░░░░░░░] 0% (0/4 tasks)
**Phase 5: Testing** [░░░░░░░░░░] 0% (0/6 tasks)
**Phase 6: Deployment** [░░░░░░░░░░] 0% (0/4 tasks)

**Total Progress: 0% (0/29 tasks complete)**

---

## 🚀 Quick Start

### For Developers

1. **Read the Master Plan**: `docs/AUTH_REFACTOR_MASTER_PLAN.md`
2. **Setup environment**: Copy `.env.local.example` to `.env.local`
3. **Start with Phase 1, Task 1.1**: Environment setup
4. **Check off tasks** as you complete them
5. **Run tests** after each task
6. **Update progress** in this document

### For Project Managers

1. **Review timeline**: 8-10 weeks total
2. **Assign resources**: 1-2 developers, 1 QA engineer
3. **Track progress**: Weekly demos every Friday
4. **Monitor risks**: Review risk assessment weekly
5. **Communicate**: Bi-weekly updates to stakeholders

---

## 📞 Support & Communication

**Daily Standups:** 10:00 AM (15 minutes)
**Weekly Demos:** Friday 2:00 PM
**Bi-weekly Reports:** To leadership

**Slack Channels:**
- `#auth-refactor` - Development discussion
- `#auth-refactor-bugs` - Bug reports
- `#auth-refactor-qa` - QA coordination

**Documentation:**
- Master Plan: `docs/AUTH_REFACTOR_MASTER_PLAN.md`
- Architecture: `docs/architecture/TOKEN_ARCHITECTURE_SUMMARY.md`
- Implementation: `docs/architecture/TOKEN_IMPLEMENTATION_GUIDE.md`

---

**Status:** ✅ Ready to Begin
**Next Action:** Phase 1, Task 1.1 - Setup Environment
**Estimated Start Date:** [To be determined]
**Estimated Completion Date:** [8-10 weeks from start]
