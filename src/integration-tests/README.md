# Integration Tests

## Quick Start

```bash
# Run all integration tests
npm run test:integration

# Run with coverage
npm run test:integration:coverage

# Run in watch mode
npm run test:integration:watch

# Run with UI
npm run test:integration:ui
```

## Test Suites

### 1. Token Management Integration
**File**: `tokenManagement.integration.test.ts`

Tests complete token lifecycle and system interactions:
- Full lifecycle: add → validate → use → refresh → remove
- Multi-site token resolution
- Default token fallback
- Storage persistence
- Axios interceptor integration
- Migration from legacy system

### 2. Performance Integration
**File**: `performance.integration.test.ts`

Tests performance under load:
- 1000 token retrievals in < 5s
- 95%+ cache hit rate
- Batch operations < 3s
- Memory usage < 10MB

### 3. Security Integration
**File**: `security.integration.test.ts`

Tests security measures:
- Token encryption/decryption
- Malformed token rejection
- XSS prevention
- Access control
- No sensitive data leaks

## Mock API Server

Location: `mocks/apiServer.ts`

Simulates ACE API with endpoints:
- `GET /api/sites` - List sites
- `GET /api/sites/:id/points` - Get points
- `GET /api/data?siteId=:id` - Query data
- `POST /api/data` - Post data

## Test Utilities

Location: `setup.ts`

```typescript
import { testUtils } from './setup';

// Generate tokens
const validToken = testUtils.generateValidToken('site_id');
const expiredToken = testUtils.generateExpiredToken('site_id');

// Mock Firestore
await testUtils.mockFirestore.setDoc(userId, data);
const doc = await testUtils.mockFirestore.getDoc(userId);

// Wait for async
await testUtils.waitFor(1000);
```

## Coverage

Target: 80%+ for all metrics
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

View coverage:
```bash
npm run test:integration:coverage
open coverage/integration/index.html
```

## Documentation

See `docs/INTEGRATION_TESTS.md` for complete documentation.

## Status

⏳ **Ready to run once services are implemented**

Required services:
- MultiTokenManager
- TokenValidator
- TokenResolver
- TokenStorageService
- TokenService
- TokenMigrationService

See `docs/INTEGRATION_TEST_SUMMARY.md` for expected interfaces.
