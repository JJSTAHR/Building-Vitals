# Token Types Quick Reference

## Import Statement
```typescript
import {
  SiteToken,
  TokenValidation,
  TokenError,
  TokenErrorType,
  // ... other types
} from '@/types/token.types';
```

## Most Commonly Used Types

### SiteToken
Main token storage interface
```typescript
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
  metadata?: TokenMetadata;
}
```

### TokenStatus
```typescript
type TokenStatus = 'active' | 'warning' | 'urgent' | 'expired';
```

### TokenSource
```typescript
type TokenSource = 'user' | 'default' | 'admin';
```

### TokenValidation
Result of validation operations
```typescript
interface TokenValidation {
  isValid: boolean;
  isExpired: boolean;
  status: TokenStatus;
  expiresAt: Date | null;
  daysUntilExpiration: number | null;
  errors: string[];
  warnings: string[];
  claims?: JWTPayload;
}
```

### TokenError
Custom error class for token operations
```typescript
class TokenError extends Error {
  type: TokenErrorType;
  cause?: Error;
  context?: Record<string, unknown>;
}
```

## Type Guards

### Check if object is SiteToken
```typescript
if (isSiteToken(obj)) {
  // TypeScript knows obj is SiteToken
  console.log(obj.siteId);
}
```

### Check if error is TokenError
```typescript
try {
  // operation
} catch (error) {
  if (isTokenError(error)) {
    console.error(error.type); // TokenErrorType
  }
}
```

### Check if object is TokenValidation
```typescript
if (isTokenValidation(result)) {
  console.log(result.status);
}
```

## Constants

```typescript
import { TOKEN_CONSTANTS } from '@/types/token.types';

TOKEN_CONSTANTS.DEFAULT_WARNING_DAYS;    // 7
TOKEN_CONSTANTS.DEFAULT_URGENT_DAYS;     // 3
TOKEN_CONSTANTS.DEFAULT_CACHE_TTL;       // 300
TOKEN_CONSTANTS.MAX_TOKEN_LENGTH;        // 10000
TOKEN_CONSTANTS.MIN_TOKEN_LENGTH;        // 20
TOKEN_CONSTANTS.ENCRYPTION_ALGORITHM;    // 'aes-256-gcm'
TOKEN_CONSTANTS.ENCRYPTION_VERSION;      // 1
TOKEN_CONSTANTS.HASH_ALGORITHM;          // 'sha256'
TOKEN_CONSTANTS.COLLECTION_NAME;         // 'site_tokens'
```

## Error Types Enum

```typescript
TokenErrorType.NOT_FOUND           // 'TOKEN_NOT_FOUND'
TokenErrorType.EXPIRED             // 'TOKEN_EXPIRED'
TokenErrorType.INVALID_FORMAT      // 'TOKEN_INVALID_FORMAT'
TokenErrorType.ENCRYPTION_FAILED   // 'TOKEN_ENCRYPTION_FAILED'
TokenErrorType.DECRYPTION_FAILED   // 'TOKEN_DECRYPTION_FAILED'
TokenErrorType.VALIDATION_FAILED   // 'TOKEN_VALIDATION_FAILED'
TokenErrorType.STORAGE_FAILED      // 'TOKEN_STORAGE_FAILED'
TokenErrorType.NETWORK_ERROR       // 'TOKEN_NETWORK_ERROR'
TokenErrorType.PERMISSION_DENIED   // 'TOKEN_PERMISSION_DENIED'
TokenErrorType.UNKNOWN             // 'TOKEN_UNKNOWN_ERROR'
```

## Common Patterns

### Creating a new token
```typescript
const newToken: SiteToken = {
  siteId: 'site-123',
  siteName: 'Building A',
  token: jwtToken,
  tokenHash: hashToken(jwtToken),
  createdAt: new Date(),
  updatedAt: new Date(),
  lastUsed: new Date(),
  expiresAt: new Date('2025-12-31'),
  isDefault: false,
  metadata: {
    source: 'user',
    notes: 'Production token'
  }
};
```

### Handling token errors
```typescript
try {
  await storeToken(token);
} catch (error) {
  if (isTokenError(error)) {
    switch (error.type) {
      case TokenErrorType.EXPIRED:
        showExpiredMessage();
        break;
      case TokenErrorType.INVALID_FORMAT:
        showInvalidFormatMessage();
        break;
      default:
        showGenericError(error.message);
    }
  }
}
```

### Checking token expiration
```typescript
function getExpiryStatus(token: SiteToken): ExpiryStatus {
  const now = new Date();
  const daysUntilExpiration = token.expiresAt
    ? Math.ceil((token.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (!token.expiresAt) {
    return {
      status: 'active',
      isExpired: false,
      isExpiringSoon: false,
      expiresAt: null,
      daysUntilExpiration: null,
      message: 'Token has no expiration',
      recommendedAction: 'none'
    };
  }

  if (daysUntilExpiration! < 0) {
    return {
      status: 'expired',
      isExpired: true,
      isExpiringSoon: false,
      expiresAt: token.expiresAt,
      daysUntilExpiration,
      message: 'Token has expired',
      recommendedAction: 'renew_now'
    };
  }

  if (daysUntilExpiration! <= TOKEN_CONSTANTS.DEFAULT_URGENT_DAYS) {
    return {
      status: 'urgent',
      isExpired: false,
      isExpiringSoon: true,
      expiresAt: token.expiresAt,
      daysUntilExpiration,
      message: `Token expires in ${daysUntilExpiration} days`,
      recommendedAction: 'renew_now'
    };
  }

  if (daysUntilExpiration! <= TOKEN_CONSTANTS.DEFAULT_WARNING_DAYS) {
    return {
      status: 'warning',
      isExpired: false,
      isExpiringSoon: true,
      expiresAt: token.expiresAt,
      daysUntilExpiration,
      message: `Token expires in ${daysUntilExpiration} days`,
      recommendedAction: 'renew_soon'
    };
  }

  return {
    status: 'active',
    isExpired: false,
    isExpiringSoon: false,
    expiresAt: token.expiresAt,
    daysUntilExpiration,
    message: `Token is active (${daysUntilExpiration} days remaining)`,
    recommendedAction: 'none'
  };
}
```

### Converting Firestore document
```typescript
import { firestoreToSiteToken } from '@/types/token.types';

const doc = await firestore.collection('site_tokens').doc(siteId).get();
const data = doc.data() as SiteTokenFirestore;
const token: SiteToken = firestoreToSiteToken(data);
```

### Batch operations
```typescript
const result: BatchTokenResult<SiteToken> = {
  success: [
    { siteId: 'site-1', data: token1 },
    { siteId: 'site-2', data: token2 }
  ],
  failed: [
    {
      siteId: 'site-3',
      error: new TokenError(TokenErrorType.EXPIRED, 'Token expired')
    }
  ],
  total: 3,
  successCount: 2,
  failedCount: 1
};
```

## Options Interfaces

### Store Options
```typescript
const storeOptions: StoreTokenOptions = {
  validate: true,      // Validate before storing
  encrypt: true,       // Encrypt token
  forceUpdate: false,  // Update even if unchanged
  metadata: {
    source: 'user',
    notes: 'Updated token'
  }
};
```

### Get Options
```typescript
const getOptions: GetTokenOptions = {
  decrypt: true,        // Decrypt on retrieval
  validate: true,       // Validate after retrieval
  updateLastUsed: true, // Update lastUsed timestamp
  allowExpired: false   // Reject expired tokens
};
```

## Service Configuration

```typescript
const config: TokenServiceConfig = {
  enableEncryption: true,
  enableValidation: true,
  enableAuditLog: true,
  cacheTTL: 300,
  collectionName: 'site_tokens',
  rotationPolicy: {
    enabled: true,
    warningDays: 7,
    urgentDays: 3,
    notifyUsers: true,
    notificationEmails: ['admin@example.com']
  }
};
```

## Complete Example: Token Lifecycle

```typescript
import {
  SiteToken,
  TokenError,
  TokenErrorType,
  TokenValidation,
  StoreTokenOptions,
  GetTokenOptions,
  isTokenError,
  TOKEN_CONSTANTS
} from '@/types/token.types';

// 1. Create token
async function createToken(siteId: string, jwtToken: string): Promise<SiteToken> {
  try {
    const token: SiteToken = {
      siteId,
      siteName: await getSiteName(siteId),
      token: jwtToken,
      tokenHash: hashToken(jwtToken),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: new Date(),
      expiresAt: extractExpiration(jwtToken),
      isDefault: false,
      metadata: {
        source: 'user',
        createdBy: getCurrentUserId(),
        environment: process.env.NODE_ENV || 'production'
      }
    };

    const options: StoreTokenOptions = {
      validate: true,
      encrypt: true
    };

    await storeToken(token, options);
    return token;
  } catch (error) {
    if (isTokenError(error)) {
      console.error(`Token creation failed: ${error.message}`);
      throw error;
    }
    throw new TokenError(
      TokenErrorType.UNKNOWN,
      'Failed to create token',
      error as Error
    );
  }
}

// 2. Retrieve token
async function getToken(siteId: string): Promise<SiteToken | null> {
  const options: GetTokenOptions = {
    decrypt: true,
    validate: true,
    updateLastUsed: true,
    allowExpired: false
  };

  try {
    return await retrieveToken(siteId, options);
  } catch (error) {
    if (isTokenError(error) && error.type === TokenErrorType.NOT_FOUND) {
      return null;
    }
    throw error;
  }
}

// 3. Validate token
function validateTokenStatus(token: SiteToken): TokenValidation {
  const validation: TokenValidation = {
    isValid: true,
    isExpired: false,
    status: 'active',
    expiresAt: token.expiresAt,
    daysUntilExpiration: null,
    errors: [],
    warnings: []
  };

  // Check expiration
  if (token.expiresAt) {
    const now = new Date();
    const days = Math.ceil(
      (token.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    validation.daysUntilExpiration = days;

    if (days < 0) {
      validation.isValid = false;
      validation.isExpired = true;
      validation.status = 'expired';
      validation.errors.push('Token has expired');
    } else if (days <= TOKEN_CONSTANTS.DEFAULT_URGENT_DAYS) {
      validation.status = 'urgent';
      validation.warnings.push(`Token expires in ${days} days`);
    } else if (days <= TOKEN_CONSTANTS.DEFAULT_WARNING_DAYS) {
      validation.status = 'warning';
      validation.warnings.push(`Token expires in ${days} days`);
    }
  }

  return validation;
}
```

## File Location

**Path**: `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\types\token.types.ts`

## See Also

- Full implementation documentation: `docs/token-types-implementation.md`
- Token management services (coming in Phase 1, Tasks 1.3-1.5)
