# Token Management Architecture - Visual Diagrams

## System Context Diagram (C4 Level 1)

```
                                ┌──────────────────────────┐
                                │                          │
                                │   Building Vitals User   │
                                │                          │
                                └────────────┬─────────────┘
                                             │
                                             │ Uses
                                             │
                                ┌────────────▼─────────────┐
                                │                          │
                                │  Building Vitals Web App │
                                │  (React + TypeScript)    │
                                │                          │
                                └────┬────────────┬────────┘
                                     │            │
                        Authenticates│            │ Fetches Data
                                     │            │
                        ┌────────────▼────┐  ┌────▼────────────────┐
                        │                 │  │                     │
                        │  Firebase Auth  │  │  ACE IoT API        │
                        │  & Firestore    │  │  (via Cloudflare)   │
                        │                 │  │                     │
                        └─────────────────┘  └─────────────────────┘
```

## Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser Environment                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  React Application Layer                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │    │
│  │  │Dashboard │  │ Settings │  │  Charts  │  │  Common  │  │    │
│  │  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  │    │
│  └────────┼─────────────┼─────────────┼─────────────┼────────┘    │
│           │             │             │             │               │
│  ┌────────▼─────────────▼─────────────▼─────────────▼────────┐    │
│  │              Token Management Service Layer                │    │
│  │  ┌────────────────────────────────────────────────────┐   │    │
│  │  │        TokenManagerService (Singleton)             │   │    │
│  │  │  • getCurrentToken()                               │   │    │
│  │  │  • setCurrentSite()                                │   │    │
│  │  │  • addSiteToken()                                  │   │    │
│  │  │  • validateToken()                                 │   │    │
│  │  └──┬─────────────────────────────────────────────┬───┘   │    │
│  │     │                                             │       │    │
│  │  ┌──▼──────────────────┐          ┌──────────────▼───┐   │    │
│  │  │ TokenStorageService │          │ TokenValidation  │   │    │
│  │  │ • encrypt/decrypt   │          │    Service       │   │    │
│  │  │ • save/load tokens  │          │ • decodeJWT()    │   │    │
│  │  └──┬──────────────────┘          └──────────────────┘   │    │
│  └─────┼──────────────────────────────────────────────────────┘    │
│        │                                                            │
│  ┌─────▼──────────────────────────────────────────────────────┐   │
│  │                   API Client Layer                          │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │         TokenInterceptor Middleware                   │  │   │
│  │  │  Request: Inject X-ACE-Token + Check Expiry          │  │   │
│  │  │  Response: Handle 401/403 + Trigger Refresh          │  │   │
│  │  └──────────────────────┬───────────────────────────────┘  │   │
│  │                         │                                   │   │
│  │  ┌──────────────────────▼───────────────────────────────┐  │   │
│  │  │    CloudflareWorkerClient / BatchApiService          │  │   │
│  │  └──────────────────────┬───────────────────────────────┘  │   │
│  └─────────────────────────┼──────────────────────────────────┘   │
│                            │                                       │
│  ┌─────────────────────────▼──────────────────────────────────┐   │
│  │               Storage Layer (Browser)                      │   │
│  │  ┌──────────────────┐         ┌─────────────────────┐     │   │
│  │  │  IndexedDB       │         │  LocalStorage       │     │   │
│  │  │  (Primary)       │         │  (Fallback)         │     │   │
│  │  │  • tokens        │         │  • currentSite      │     │   │
│  │  │  • metadata      │         │  • preferences      │     │   │
│  │  │  (Encrypted)     │         │  (Encrypted)        │     │   │
│  │  └──────────────────┘         └─────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                            │ Sync (Optional)
                            │
                ┌───────────▼──────────────┐
                │   Firebase Backend       │
                │  ┌────────────────────┐  │
                │  │  Firestore Users   │  │
                │  │  • aceJwt (plain)  │  │
                │  │  • tokenMetadata   │  │
                │  └────────────────────┘  │
                └──────────────────────────┘
```

## Component Diagram - Token Management Service

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TokenManagerService                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Private State:                                                      │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • tokens: Map<siteId, SiteToken>                        │        │
│  │ • currentSiteId: string | null                          │        │
│  │ • defaultSiteId: string | null                          │        │
│  │ • eventEmitter: EventEmitter                            │        │
│  │ • cache: TokenCache                                     │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Public Methods:                                                     │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ Token Retrieval                                         │        │
│  │ ├─ getCurrentToken(): string | null                    │        │
│  │ ├─ getTokenForSite(siteId): string | null              │        │
│  │ └─ getDefaultToken(): string | null                    │        │
│  │                                                          │        │
│  │ Site Management                                          │        │
│  │ ├─ setCurrentSite(siteId): void                        │        │
│  │ ├─ getCurrentSite(): string | null                     │        │
│  │ └─ setDefaultSite(siteId): void                        │        │
│  │                                                          │        │
│  │ Token CRUD                                               │        │
│  │ ├─ addSiteToken(siteId, name, token): Promise<void>    │        │
│  │ ├─ updateSiteToken(siteId, token): Promise<void>       │        │
│  │ ├─ removeSiteToken(siteId): Promise<void>              │        │
│  │ └─ clearAllTokens(): Promise<void>                     │        │
│  │                                                          │        │
│  │ Validation                                               │        │
│  │ ├─ validateToken(token): boolean                       │        │
│  │ ├─ isTokenExpired(token): boolean                      │        │
│  │ └─ getTokenMetadata(token): TokenMetadata              │        │
│  │                                                          │        │
│  │ Token Refresh                                            │        │
│  │ ├─ refreshToken(siteId, newToken): Promise<void>       │        │
│  │ └─ scheduleExpiryCheck(siteId): void                   │        │
│  │                                                          │        │
│  │ Bulk Operations                                          │        │
│  │ ├─ getAllTokens(): SiteToken[]                         │        │
│  │ └─ bulkImportTokens(tokens): Promise<void>             │        │
│  │                                                          │        │
│  │ Events                                                   │        │
│  │ ├─ onTokenExpired(callback): void                      │        │
│  │ ├─ onTokenChanged(callback): void                      │        │
│  │ └─ onTokenInvalid(callback): void                      │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Dependencies:                                                       │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • TokenStorageService                                   │        │
│  │ • TokenValidationService                                │        │
│  │ • TokenEncryption                                       │        │
│  │ • EventEmitter                                          │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram - Adding a New Token

```
User          TokenManager       TokenStorage      Validation       IndexedDB
 │               Component          Service          Service            │
 │                  │                  │                │               │
 │  Enter Token    │                  │                │               │
 │─────────────────>│                  │                │               │
 │                  │                  │                │               │
 │                  │  Validate JWT   │                │               │
 │                  │─────────────────────────────────>│               │
 │                  │                  │                │               │
 │                  │  Extract Metadata                │               │
 │                  │<──────────────────────────────────│               │
 │                  │  {identity, exp}                 │               │
 │                  │                  │                │               │
 │                  │  Test Token      │                │               │
 │                  │─────────────────────────────────>│               │
 │                  │  (Call ACE API)  │                │               │
 │                  │                  │                │               │
 │  Test Result    │<──────────────────────────────────│               │
 │<─────────────────│  {valid: true}   │                │               │
 │                  │                  │                │               │
 │  Click Save     │                  │                │               │
 │─────────────────>│                  │                │               │
 │                  │                  │                │               │
 │                  │  Encrypt Token  │                │               │
 │                  │─────────────────>│                │               │
 │                  │                  │                │               │
 │                  │  Encrypted Data  │                │               │
 │                  │<─────────────────│                │               │
 │                  │                  │                │               │
 │                  │  Save Token     │                │               │
 │                  │─────────────────>│                │               │
 │                  │                  │                │               │
 │                  │                  │  Put Object   │               │
 │                  │                  │───────────────────────────────>│
 │                  │                  │                │               │
 │                  │                  │  Success      │               │
 │                  │                  │<───────────────────────────────│
 │                  │  Success         │                │               │
 │                  │<─────────────────│                │               │
 │                  │                  │                │               │
 │                  │  Schedule Expiry Check            │               │
 │                  │───────────────────────────────────>│               │
 │                  │                  │                │               │
 │  Show Success   │                  │                │               │
 │<─────────────────│                  │                │               │
 │                  │                  │                │               │
```

## Sequence Diagram - Token Expiry Handling

```
API Client    TokenInterceptor   TokenManager    User Interface    Storage
    │                │                │                │              │
    │  Make Request  │                │                │              │
    │───────────────>│                │                │              │
    │                │                │                │              │
    │                │  Get Current   │                │              │
    │                │     Token      │                │              │
    │                │───────────────>│                │              │
    │                │                │                │              │
    │                │  Check Expiry  │                │              │
    │                │───────────────>│                │              │
    │                │                │                │              │
    │                │  Expired!      │                │              │
    │                │<───────────────│                │              │
    │                │                │                │              │
    │                │  Emit Event    │                │              │
    │                │───────────────>│                │              │
    │                │                │                │              │
    │                │                │  Show Expiry  │              │
    │                │                │    Dialog     │              │
    │                │                │──────────────>│              │
    │                │                │                │              │
    │                │                │  User Enters  │              │
    │                │                │   New Token   │              │
    │                │                │<───────────────│              │
    │                │                │                │              │
    │                │  Update Token  │                │              │
    │                │<───────────────│                │              │
    │                │                │                │              │
    │                │                │  Save Token   │              │
    │                │                │───────────────────────────────>│
    │                │                │                │              │
    │                │  New Token     │                │              │
    │                │<───────────────│                │              │
    │                │                │                │              │
    │  Retry Request │                │                │              │
    │   (with new    │                │                │              │
    │     token)     │                │                │              │
    │<───────────────│                │                │              │
    │                │                │                │              │
    │  Success       │                │                │              │
    │───────────────>│                │                │              │
    │                │                │                │              │
```

## Data Flow Diagram - Multi-Site Token Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Actions                                 │
└───┬─────────────┬─────────────┬─────────────┬─────────────┬─────────┘
    │             │             │             │             │
    │ Add Token   │ Switch Site │ Make API    │ Token       │ Delete
    │             │             │   Call      │ Expires     │ Token
    │             │             │             │             │
┌───▼─────────────▼─────────────▼─────────────▼─────────────▼─────────┐
│                    TokenManagerService                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │              Token Registry (In-Memory)                 │        │
│  │  ┌──────────────────────────────────────────────────┐   │        │
│  │  │ Site A: {                                         │   │        │
│  │  │   token: "jwt_token_a",                          │   │        │
│  │  │   status: "active",                              │   │        │
│  │  │   expiresAt: "2025-12-31",                       │   │        │
│  │  │   isDefault: true                                │   │        │
│  │  │ }                                                 │   │        │
│  │  ├──────────────────────────────────────────────────┤   │        │
│  │  │ Site B: {                                         │   │        │
│  │  │   token: "jwt_token_b",                          │   │        │
│  │  │   status: "active",                              │   │        │
│  │  │   expiresAt: "2025-06-15"                        │   │        │
│  │  │ }                                                 │   │        │
│  │  ├──────────────────────────────────────────────────┤   │        │
│  │  │ Site C: {                                         │   │        │
│  │  │   token: "jwt_token_c",                          │   │        │
│  │  │   status: "expired",                             │   │        │
│  │  │   expiresAt: "2025-01-10"                        │   │        │
│  │  │ }                                                 │   │        │
│  │  └──────────────────────────────────────────────────┘   │        │
│  │                                                          │        │
│  │  Current Site: "Site A"                                 │        │
│  │  Default Site: "Site A"                                 │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Operations:                                                         │
│  ├─ Add Token    → Validate → Encrypt → Store → Update Registry    │
│  ├─ Switch Site  → Update currentSite → Return new token            │
│  ├─ Get Token    → Check expiry → Return token or trigger refresh   │
│  ├─ Token Expire → Emit event → Show UI prompt                      │
│  └─ Delete Token → Remove from storage → Update registry            │
│                                                                       │
└───┬─────────────┬─────────────┬─────────────┬─────────────┬─────────┘
    │             │             │             │             │
    │ Persist     │ API Calls   │ Events      │ Sync        │ UI Updates
    │             │             │             │             │
┌───▼─────────┐ ┌─▼───────────┐ ┌─▼─────────┐ ┌─▼─────────┐ ┌─▼─────────┐
│  IndexedDB  │ │ ACE IoT API │ │  Event    │ │ Firestore │ │  React    │
│   Storage   │ │             │ │   Bus     │ │  Backend  │ │    UI     │
└─────────────┘ └─────────────┘ └───────────┘ └───────────┘ └───────────┘
```

## State Machine - Token Lifecycle

```
                         ┌──────────────┐
                         │   NEW        │
                         │ (Not Added)  │
                         └──────┬───────┘
                                │
                         Add Token + Validate
                                │
                         ┌──────▼───────┐
                    ┌────┤   PENDING    │
                    │    │ (Validating) │
                    │    └──────┬───────┘
                    │           │
              Validation Failed │ Validation Success
                    │           │
             ┌──────▼─────┐     │      ┌──────────────┐
             │   INVALID  │     └─────>│    ACTIVE    │
             │            │            │  (In Use)    │
             └────────────┘            └──────┬───────┘
                                              │
                                              │ Uses < Expiry Warning
                                              │ (7 days before)
                                              │
                                       ┌──────▼─────────┐
                        Refresh Token  │  EXPIRING SOON │  Ignore Warning
                         ┌─────────────┤  (Warning)     │────────┐
                         │             └────────┬───────┘        │
                         │                      │                 │
                         │          Reaches Expiry Date          │
                         │                      │                 │
                         │              ┌───────▼────────┐        │
                         │              │    EXPIRED     │<───────┘
                         │              │  (No Access)   │
                         │              └───────┬────────┘
                         │                      │
                         │          Enter New Token │ Delete
                         │                      │
                         └──────────────────────┘
                                       │
                                       │ Delete
                                       │
                                ┌──────▼─────┐
                                │  DELETED   │
                                │  (Removed) │
                                └────────────┘

State Transitions:
- NEW → PENDING: User enters token
- PENDING → ACTIVE: Token validation succeeds
- PENDING → INVALID: Token validation fails
- ACTIVE → EXPIRING_SOON: 7 days before expiry
- EXPIRING_SOON → ACTIVE: User refreshes token
- EXPIRING_SOON → EXPIRED: Expiry date reached
- ACTIVE → EXPIRED: Expiry date reached
- EXPIRED → ACTIVE: User enters new token
- * → DELETED: User deletes token
```

## Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Security Layers                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Layer 1: Transport Security                                         │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • HTTPS/TLS for all API calls                           │        │
│  │ • Secure WebSocket connections                           │        │
│  │ • Certificate pinning (optional)                        │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Layer 2: Storage Encryption                                         │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ Web Crypto API (AES-GCM-256)                            │        │
│  │  ├─ Random IV per token                                 │        │
│  │  ├─ PBKDF2 key derivation (100k iterations)             │        │
│  │  ├─ Authenticated encryption (GCM mode)                 │        │
│  │  └─ Device-specific encryption keys                     │        │
│  │                                                          │        │
│  │ Key Derivation:                                          │        │
│  │  sessionId + deviceFingerprint + salt                   │        │
│  │           ↓                                              │        │
│  │       PBKDF2-SHA256                                      │        │
│  │           ↓                                              │        │
│  │    256-bit AES Key                                       │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Layer 3: Access Control                                             │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Token scoped to specific sites                        │        │
│  │ • Multi-tenant isolation                                │        │
│  │ • Rate limiting per token                               │        │
│  │ • Request origin validation                             │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Layer 4: Monitoring & Audit                                         │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • All token operations logged                           │        │
│  │ • Anomaly detection (unusual usage patterns)            │        │
│  │ • Failed authentication tracking                        │        │
│  │ • Token usage metrics                                   │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Layer 5: Secure Cleanup                                             │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Immediate removal from memory on logout               │        │
│  │ • Secure deletion from IndexedDB                        │        │
│  │ • Multiple overwrite passes                             │        │
│  │ • Token revocation on suspicious activity               │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Encryption Flow:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Plain Token │───>│ Web Crypto   │───>│  Encrypted  │───>│ IndexedDB│
│  (Memory)   │    │  AES-GCM-256 │    │  + IV + Tag │    │ Storage  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
                           ▲
                           │
                    ┌──────┴──────┐
                    │ Derived Key │
                    │  (PBKDF2)   │
                    └──────▲──────┘
                           │
              ┌────────────┴────────────┐
              │ sessionId + deviceId    │
              └─────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Production Environment                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Client Tier                                                         │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ Browser (Chrome, Firefox, Safari, Edge)                 │        │
│  │  ┌──────────────────────────────────────────────────┐   │        │
│  │  │ React App (Token Management Built-in)            │   │        │
│  │  │  • TokenManagerService                           │   │        │
│  │  │  • TokenStorageService (IndexedDB)               │   │        │
│  │  │  • TokenValidationService                        │   │        │
│  │  └──────────────────────────────────────────────────┘   │        │
│  └─────────────────────────────────────────────────────────┘        │
│                            │                                         │
│                            │ HTTPS                                   │
│                            │                                         │
│  CDN/Edge Tier             │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ Cloudflare CDN                                          │        │
│  │  • Static assets caching                               │        │
│  │  • DDoS protection                                      │        │
│  │  • SSL/TLS termination                                 │        │
│  └─────────────────────────┬───────────────────────────────┘        │
│                            │                                         │
│  Application Tier          │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ Firebase Hosting                                        │        │
│  │  • Serves React app                                     │        │
│  │  • Custom domain                                        │        │
│  │  • Auto-scaling                                         │        │
│  └─────────────────────────┬───────────────────────────────┘        │
│                            │                                         │
│  API Tier                  │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ Cloudflare Workers                                      │        │
│  │  • ACE IoT API proxy                                    │        │
│  │  • Token validation                                     │        │
│  │  • Rate limiting                                        │        │
│  │  • Response caching                                     │        │
│  └─────────────────────────┬───────────────────────────────┘        │
│                            │                                         │
│  Backend Services          │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ Firebase Functions                                      │        │
│  │  • Token management endpoints                           │        │
│  │  • Cross-device sync                                    │        │
│  │  • Audit logging                                        │        │
│  └─────────────────────────┬───────────────────────────────┘        │
│                            │                                         │
│  Data Tier                 │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ Firestore                                               │        │
│  │  • User token metadata                                  │        │
│  │  • Audit logs                                           │        │
│  │  • Cross-device sync                                    │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  External API              │                                         │
│  ┌─────────────────────────▼───────────────────────────────┐        │
│  │ ACE IoT API                                             │        │
│  │  • Building data endpoints                              │        │
│  │  • JWT authentication                                   │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Deployment Stages:
1. Development  → localhost:3001
2. Staging      → staging.buildingvitals.com
3. Production   → buildingvitals.com

Environments use separate:
- Firebase projects
- Cloudflare Worker instances
- API tokens
```

## Performance Optimization Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Token Performance Optimizations                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. In-Memory Caching                                                │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ TokenCache (5-minute TTL)                               │        │
│  │  • Avoid repeated IndexedDB reads                       │        │
│  │  • LRU eviction policy                                  │        │
│  │  • Max size: 100 tokens                                 │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  2. Lazy Service Loading                                             │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ Dynamic Imports                                          │        │
│  │  • Load encryption only when needed                     │        │
│  │  • Defer validation until first use                    │        │
│  │  • Bundle splitting reduces initial load               │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  3. Batch Operations                                                 │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Bulk token validation                                 │        │
│  │ • Transaction-based storage writes                      │        │
│  │ • Parallel decryption for multiple tokens               │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  4. Predictive Token Refresh                                         │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Schedule checks 7 days before expiry                  │        │
│  │ • Background validation during idle time                │        │
│  │ • Proactive warning notifications                       │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  5. IndexedDB Optimization                                           │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Indexed queries (byStatus, byExpiry)                  │        │
│  │ • Cursor-based iteration for large datasets             │        │
│  │ • Compression for token metadata                        │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  Performance Metrics:                                                │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ • Token retrieval: < 1ms (cached), < 10ms (IndexedDB)   │        │
│  │ • Token encryption: < 5ms                               │        │
│  │ • Token validation: < 2ms                               │        │
│  │ • Bulk operations: 100 tokens in < 50ms                 │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```
