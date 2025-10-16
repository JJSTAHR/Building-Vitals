# Token Management - Implementation Quick Reference

## Quick Start Checklist

### Phase 1: Core Services (Week 1-2)

#### 1.1 Create Type Definitions
```typescript
// src/types/token.types.ts
export interface SiteToken {
  siteId: string;
  siteName: string;
  token: string;
  identity?: string;
  expiresAt?: Date;
  addedAt: Date;
  lastUsed?: Date;
  isDefault: boolean;
  status: TokenStatus;
}

export type TokenStatus = 'active' | 'expired' | 'invalid' | 'revoked';

export interface EncryptedToken {
  iv: string;
  ciphertext: string;
  authTag: string;
  algorithm: string;
  metadata: TokenMetadata;
}

export interface TokenMetadata {
  siteId: string;
  siteName: string;
  identity?: string;
  expiresAt?: Date;
  isDefault: boolean;
  status: TokenStatus;
}
```

#### 1.2 Implement TokenEncryption Service
```typescript
// src/services/token/TokenEncryption.ts
import { EncryptedData } from '../../types/token.types';

export class TokenEncryption {
  async encrypt(plaintext: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const password = await this.getDerivedPassword();
    const key = await this.deriveKey(password, salt);

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
    // Implementation...
  }

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

  private async getDerivedPassword(): Promise<string> {
    const sessionId = sessionStorage.getItem('sessionId') || crypto.randomUUID();
    const deviceId = await this.getDeviceFingerprint();
    return `${sessionId}:${deviceId}:building-vitals-tokens`;
  }
}
```

#### 1.3 Implement TokenStorageService
```typescript
// src/services/token/TokenStorageService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TokenDB extends DBSchema {
  tokens: {
    key: string;
    value: EncryptedToken;
    indexes: { 'by-status': string; 'by-expiry': Date };
  };
  metadata: {
    key: string;
    value: any;
  };
}

export class TokenStorageService {
  private db: IDBPDatabase<TokenDB> | null = null;
  private encryption: TokenEncryption;

  constructor() {
    this.encryption = new TokenEncryption();
    this.initDB();
  }

  private async initDB() {
    this.db = await openDB<TokenDB>('building-vitals-tokens', 1, {
      upgrade(db) {
        const tokenStore = db.createObjectStore('tokens', { keyPath: 'siteId' });
        tokenStore.createIndex('by-status', 'metadata.status');
        tokenStore.createIndex('by-expiry', 'metadata.expiresAt');

        db.createObjectStore('metadata', { keyPath: 'key' });
      },
    });
  }

  async saveToken(siteId: string, token: string, metadata: TokenMetadata): Promise<void> {
    const encrypted = await this.encryption.encrypt(token);

    await this.db!.put('tokens', {
      siteId,
      ...encrypted,
      metadata,
    });
  }

  async loadToken(siteId: string): Promise<string | null> {
    const encrypted = await this.db!.get('tokens', siteId);
    if (!encrypted) return null;

    return this.encryption.decrypt(encrypted);
  }

  async loadAllTokens(): Promise<Map<string, string>> {
    const tokens = new Map();
    const cursor = await this.db!.transaction('tokens').store.openCursor();

    while (cursor) {
      const encrypted = cursor.value;
      const decrypted = await this.encryption.decrypt(encrypted);
      tokens.set(encrypted.siteId, decrypted);
      cursor.continue();
    }

    return tokens;
  }

  async deleteToken(siteId: string): Promise<void> {
    await this.db!.delete('tokens', siteId);
  }

  async clearAll(): Promise<void> {
    await this.db!.clear('tokens');
    await this.db!.clear('metadata');
  }
}
```

#### 1.4 Implement TokenValidationService
```typescript
// src/services/token/TokenValidationService.ts
export class TokenValidationService {
  decodeJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      return null;
    }
  }

  checkExpiry(token: string): ExpiryStatus {
    const payload = this.decodeJWT(token);
    if (!payload || !payload.exp) {
      return {
        isExpired: false,
        expiresAt: null,
        timeRemaining: Infinity,
        expiresIn: 'Never',
      };
    }

    const expiresAt = new Date(payload.exp * 1000);
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const isExpired = timeRemaining <= 0;

    return {
      isExpired,
      expiresAt,
      timeRemaining,
      expiresIn: this.formatTimeRemaining(timeRemaining),
    };
  }

  validateJWTFormat(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      atob(parts[0]); // Header
      atob(parts[1]); // Payload
      return true;
    } catch {
      return false;
    }
  }

  async testToken(token: string, baseUrl: string): Promise<TokenTestResult> {
    try {
      const response = await fetch(`${baseUrl}/api/sites`, {
        headers: { 'X-ACE-Token': token },
      });

      if (response.ok) {
        const data = await response.json();
        const payload = this.decodeJWT(token);

        return {
          success: true,
          valid: true,
          message: `Token valid! Found ${data.items?.length || 0} sites`,
          details: {
            sitesFound: data.items?.length || 0,
            identity: payload?.identity,
            expiresAt: payload?.exp ? new Date(payload.exp * 1000) : undefined,
          },
        };
      } else {
        return {
          success: false,
          valid: false,
          message: `Token invalid: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        valid: false,
        message: `Test failed: ${error.message}`,
      };
    }
  }

  private formatTimeRemaining(ms: number): string {
    if (ms < 0) {
      const abs = Math.abs(ms);
      const days = Math.floor(abs / (1000 * 60 * 60 * 24));
      return `Expired ${days} day${days !== 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;

    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}
```

#### 1.5 Implement TokenManagerService (Singleton)
```typescript
// src/services/token/TokenManagerService.ts
export class TokenManagerService {
  private static instance: TokenManagerService;
  private tokens: Map<string, SiteToken> = new Map();
  private currentSiteId: string | null = null;
  private defaultSiteId: string | null = null;
  private storage: TokenStorageService;
  private validation: TokenValidationService;
  private eventBus: EventEmitter;

  private constructor() {
    this.storage = new TokenStorageService();
    this.validation = new TokenValidationService();
    this.eventBus = new EventEmitter();
    this.initialize();
  }

  static getInstance(): TokenManagerService {
    if (!TokenManagerService.instance) {
      TokenManagerService.instance = new TokenManagerService();
    }
    return TokenManagerService.instance;
  }

  private async initialize(): Promise<void> {
    // Load default token from environment
    const defaultToken = import.meta.env.VITE_DEFAULT_ACE_TOKEN;
    const defaultSiteId = import.meta.env.VITE_DEFAULT_SITE_ID;

    if (defaultToken && defaultSiteId) {
      await this.addSiteToken(
        defaultSiteId,
        'Default Site',
        defaultToken,
        true
      );
    }

    // Load stored tokens
    const storedTokens = await this.storage.loadAllTokens();
    for (const [siteId, token] of storedTokens) {
      const metadata = await this.storage.loadMetadata(siteId);
      if (metadata) {
        this.tokens.set(siteId, {
          ...metadata,
          token,
        });
      }
    }

    // Set current site to default
    if (this.defaultSiteId) {
      this.currentSiteId = this.defaultSiteId;
    }
  }

  getCurrentToken(): string | null {
    if (!this.currentSiteId) return null;
    return this.getTokenForSite(this.currentSiteId);
  }

  getTokenForSite(siteId: string): string | null {
    const siteToken = this.tokens.get(siteId);
    if (!siteToken) return null;

    // Check if expired
    if (this.validation.checkExpiry(siteToken.token).isExpired) {
      this.handleExpiredToken(siteId);
      return null;
    }

    // Update last used
    siteToken.lastUsed = new Date();
    this.storage.saveMetadata(siteId, siteToken);

    return siteToken.token;
  }

  async addSiteToken(
    siteId: string,
    siteName: string,
    token: string,
    isDefault = false
  ): Promise<void> {
    // Validate token
    if (!this.validation.validateJWTFormat(token)) {
      throw new Error('Invalid JWT format');
    }

    // Extract metadata
    const payload = this.validation.decodeJWT(token);
    const expiryStatus = this.validation.checkExpiry(token);

    const siteToken: SiteToken = {
      siteId,
      siteName,
      token,
      identity: payload?.identity,
      expiresAt: expiryStatus.expiresAt || undefined,
      addedAt: new Date(),
      isDefault,
      status: expiryStatus.isExpired ? 'expired' : 'active',
    };

    // Save to storage
    await this.storage.saveToken(siteId, token, siteToken);

    // Update in-memory map
    this.tokens.set(siteId, siteToken);

    // Set as default if specified
    if (isDefault) {
      this.defaultSiteId = siteId;
      this.currentSiteId = siteId;
    }

    // Schedule expiry check
    this.scheduleExpiryCheck(siteId, expiryStatus.timeRemaining);

    // Emit event
    this.eventBus.emit('token:added', { siteId });
  }

  async updateSiteToken(siteId: string, newToken: string): Promise<void> {
    const existing = this.tokens.get(siteId);
    if (!existing) {
      throw new Error(`Site ${siteId} not found`);
    }

    await this.addSiteToken(
      siteId,
      existing.siteName,
      newToken,
      existing.isDefault
    );

    this.eventBus.emit('token:updated', { siteId });
  }

  async removeSiteToken(siteId: string): Promise<void> {
    await this.storage.deleteToken(siteId);
    this.tokens.delete(siteId);

    if (this.currentSiteId === siteId) {
      this.currentSiteId = null;
    }

    if (this.defaultSiteId === siteId) {
      this.defaultSiteId = null;
    }

    this.eventBus.emit('token:removed', { siteId });
  }

  setCurrentSite(siteId: string): void {
    if (!this.tokens.has(siteId)) {
      throw new Error(`Site ${siteId} not found`);
    }

    this.currentSiteId = siteId;
    this.eventBus.emit('site:changed', { siteId });
  }

  getCurrentSite(): string | null {
    return this.currentSiteId;
  }

  getAllTokens(): SiteToken[] {
    return Array.from(this.tokens.values());
  }

  isTokenExpired(token: string): boolean {
    return this.validation.checkExpiry(token).isExpired;
  }

  private handleExpiredToken(siteId: string): void {
    const token = this.tokens.get(siteId);
    if (token) {
      token.status = 'expired';
      this.storage.saveMetadata(siteId, token);
    }

    this.eventBus.emit('token:expired', { siteId });
  }

  private scheduleExpiryCheck(siteId: string, timeRemaining: number): void {
    const warningTime = timeRemaining - (7 * 24 * 60 * 60 * 1000); // 7 days before

    if (warningTime > 0) {
      setTimeout(() => {
        this.eventBus.emit('token:expiring-soon', { siteId });
      }, warningTime);
    }
  }

  onTokenExpired(callback: (siteId: string) => void): void {
    this.eventBus.on('token:expired', callback);
  }

  onTokenChanged(callback: (siteId: string) => void): void {
    this.eventBus.on('token:updated', callback);
    this.eventBus.on('token:added', callback);
  }
}
```

### Phase 2: API Integration (Week 2-3)

#### 2.1 Create Token Interceptor
```typescript
// src/services/token/tokenInterceptor.ts
export class TokenInterceptor {
  private tokenManager: TokenManagerService;

  constructor() {
    this.tokenManager = TokenManagerService.getInstance();
  }

  async interceptRequest(config: RequestInit): Promise<RequestInit> {
    const token = this.tokenManager.getCurrentToken();

    if (!token) {
      throw new TokenMissingError('No token available for current site');
    }

    // Check expiry
    if (this.tokenManager.isTokenExpired(token)) {
      throw new TokenExpiredError('Token has expired');
    }

    return {
      ...config,
      headers: {
        ...config.headers,
        'X-ACE-Token': token,
      },
    };
  }

  async interceptResponse(response: Response): Promise<Response> {
    if (response.status === 401 || response.status === 403) {
      const siteId = this.tokenManager.getCurrentSite();
      if (siteId) {
        eventBus.emit('token:invalid', { siteId });
      }
      throw new TokenInvalidError('Token is invalid or revoked');
    }

    return response;
  }
}
```

#### 2.2 Update CloudflareWorkerClient
```typescript
// src/services/api/cloudflareWorkerClient.ts (updated)
class CloudflareWorkerClient {
  private baseUrl: string;
  private tokenManager: TokenManagerService;
  private interceptor: TokenInterceptor;

  constructor() {
    this.baseUrl = import.meta.env.VITE_WORKER_URL || '';
    this.tokenManager = TokenManagerService.getInstance();
    this.interceptor = new TokenInterceptor();
  }

  async fetchSites() {
    const token = this.tokenManager.getCurrentToken();

    if (!token) {
      throw new Error('No ACE token available. Please configure your token in Settings.');
    }

    const config = await this.interceptor.interceptRequest({
      headers: {},
    });

    const response = await fetch(`${this.baseUrl}/api/sites`, config);

    await this.interceptor.interceptResponse(response);

    if (!response.ok) {
      throw new Error(`Failed to fetch sites: ${response.statusText}`);
    }

    return response.json();
  }

  // Similar updates for other methods...
}
```

### Phase 3: UI Components (Week 3-4)

#### 3.1 Enhance TokenManager Component
```typescript
// src/components/settings/TokenManager.tsx (enhanced)
import { TokenManagerService } from '../../services/token/TokenManagerService';

export const TokenManager: React.FC = () => {
  const tokenManager = TokenManagerService.getInstance();
  const [tokens, setTokens] = useState<SiteToken[]>([]);
  const [currentSite, setCurrentSite] = useState<string | null>(null);

  useEffect(() => {
    loadTokens();

    // Subscribe to token events
    const handleTokenChange = () => loadTokens();
    tokenManager.onTokenChanged(handleTokenChange);
    tokenManager.onTokenExpired(handleExpiredToken);

    return () => {
      // Cleanup subscriptions
    };
  }, []);

  const loadTokens = () => {
    setTokens(tokenManager.getAllTokens());
    setCurrentSite(tokenManager.getCurrentSite());
  };

  const handleAddToken = async (siteId: string, siteName: string, token: string) => {
    try {
      await tokenManager.addSiteToken(siteId, siteName, token);
      loadTokens();
      showSuccess('Token added successfully');
    } catch (error) {
      showError(error.message);
    }
  };

  const handleExpiredToken = (siteId: string) => {
    setDialogOpen(true);
    setExpiredSiteId(siteId);
  };

  // Rest of component...
};
```

#### 3.2 Create TokenExpiryDialog
```typescript
// src/components/settings/TokenExpiryDialog.tsx
export const TokenExpiryDialog: React.FC<Props> = ({ open, siteId, onClose }) => {
  const tokenManager = TokenManagerService.getInstance();
  const [newToken, setNewToken] = useState('');

  const handleRefresh = async () => {
    try {
      await tokenManager.updateSiteToken(siteId, newToken);
      showSuccess('Token refreshed successfully');
      onClose();
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Token Expired</DialogTitle>
      <DialogContent>
        <Typography>
          Your token for site "{siteId}" has expired.
          Please enter a new token to continue.
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="New Token"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleRefresh} variant="contained">
          Refresh Token
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### Testing Checklist

```typescript
// src/__tests__/token/TokenManagerService.test.ts
describe('TokenManagerService', () => {
  it('should add and retrieve tokens', async () => {
    const manager = TokenManagerService.getInstance();
    await manager.addSiteToken('site1', 'Site 1', 'jwt.token.here');

    const token = manager.getTokenForSite('site1');
    expect(token).toBe('jwt.token.here');
  });

  it('should detect expired tokens', () => {
    const expiredToken = 'eyJ...'; // Expired JWT
    expect(manager.isTokenExpired(expiredToken)).toBe(true);
  });

  it('should handle token rotation', async () => {
    await manager.updateSiteToken('site1', 'new.jwt.token');
    const token = manager.getTokenForSite('site1');
    expect(token).toBe('new.jwt.token');
  });
});
```

## Common Integration Patterns

### Pattern 1: Default Token Setup
```typescript
// .env
VITE_DEFAULT_SITE_ID=ses_falls_city
VITE_DEFAULT_ACE_TOKEN=your_default_jwt_token_here
```

### Pattern 2: Multi-Site API Calls
```typescript
const fetchMultipleSites = async (siteIds: string[]) => {
  const results = await Promise.allSettled(
    siteIds.map(async (siteId) => {
      tokenManager.setCurrentSite(siteId);
      return apiService.fetchPoints(siteId);
    })
  );
  return results;
};
```

### Pattern 3: Token Refresh on Expiry Warning
```typescript
tokenManager.onTokenExpired((siteId) => {
  showDialog({
    title: 'Token Expiring Soon',
    message: `Token for ${siteId} expires in 7 days`,
    actions: [
      { label: 'Refresh Now', onClick: () => showTokenRefreshDialog(siteId) },
      { label: 'Remind Tomorrow', onClick: () => scheduleReminder(siteId) },
    ],
  });
});
```

## Troubleshooting

### Issue: Tokens not persisting
**Solution**: Check IndexedDB initialization
```typescript
// Check browser console for errors
console.log(await indexedDB.databases());
```

### Issue: Token decryption failing
**Solution**: Ensure consistent session/device ID
```typescript
// Verify encryption key derivation
const sessionId = sessionStorage.getItem('sessionId');
console.log('Session ID:', sessionId);
```

### Issue: 401 errors after token refresh
**Solution**: Clear cached tokens
```typescript
tokenManager.clearCache();
await tokenManager.initialize();
```

## Performance Monitoring

```typescript
// Add metrics collection
class TokenMetrics {
  static recordOperation(operation: string, duration: number) {
    console.log(`[TokenMetrics] ${operation}: ${duration}ms`);
    // Send to analytics
  }
}

// Usage
const start = performance.now();
await tokenManager.addSiteToken(...);
TokenMetrics.recordOperation('addToken', performance.now() - start);
```

## Security Best Practices

1. **Never log tokens**: Always sanitize before logging
2. **Clear on logout**: Implement secure cleanup
3. **Rotate regularly**: Prompt users to refresh tokens every 90 days
4. **Monitor usage**: Track failed authentication attempts
5. **Encrypt everything**: Use Web Crypto API for all token storage

## Migration Script

```typescript
// scripts/migrateTokens.ts
export async function migrateExistingTokens() {
  const tokenManager = TokenManagerService.getInstance();

  // Get old tokens from localStorage
  const oldToken = localStorage.getItem('ace_token');
  const oldSiteId = localStorage.getItem('current_site');

  if (oldToken && oldSiteId) {
    await tokenManager.addSiteToken(
      oldSiteId,
      'Migrated Site',
      oldToken,
      true
    );

    // Clean up old storage
    localStorage.removeItem('ace_token');
    localStorage.removeItem('current_site');

    console.log('Token migration complete');
  }
}
```

## Deployment Steps

1. **Pre-deployment**:
   - Run all tests
   - Test migration script
   - Backup user data

2. **Deployment**:
   - Deploy TokenManagerService
   - Deploy updated API clients
   - Deploy UI components
   - Run migration script

3. **Post-deployment**:
   - Monitor error logs
   - Track token usage metrics
   - Gather user feedback

4. **Rollback Plan**:
   - Keep old token management code for 1 week
   - Feature flag for gradual rollout
   - Emergency rollback script ready
