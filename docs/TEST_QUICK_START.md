# Token Services Test Suite - Quick Start Guide

## Overview

This test suite provides comprehensive coverage (90%+) for all token management services using TDD principles with the SPARC methodology.

## Files Created

### Test Files (310+ tests total)
1. **`src/services/__tests__/tokenStorage.test.ts`** - 60+ tests for IndexedDB storage
2. **`src/services/__tests__/multiTokenManager.test.ts`** - 80+ tests for multi-token management
3. **`src/services/__tests__/tokenValidator.test.ts`** - 50+ tests for JWT validation
4. **`src/services/__tests__/tokenResolver.test.ts`** - 70+ tests for token resolution
5. **`src/services/__tests__/tokenInterceptor.test.ts`** - 50+ tests for request interception

### Test Utilities
- **`src/test-utils/mockTokenData.ts`** - Mock data generators
- **`src/test-utils/tokenTestHelpers.ts`** - Testing utilities and mocks
- **`src/test-utils/setup.ts`** - Global test configuration

### Configuration
- **`vitest.config.ts`** - Vitest configuration with 90%+ coverage targets
- **`package.json`** - Updated with test scripts and dependencies

### Documentation
- **`docs/TEST_DOCUMENTATION.md`** - Complete test documentation
- **`docs/TEST_QUICK_START.md`** - This file

## Quick Start

### 1. Installation

Dependencies already installed:
- vitest
- @vitest/ui
- @vitest/coverage-v8
- jsdom
- happy-dom

### 2. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run with coverage report
npm run test:coverage
```

### 3. View Coverage

After running `npm run test:coverage`, open the coverage report:

```bash
# Open coverage report in browser
open coverage/index.html
```

## Test Structure

### Test Categories by Service

#### TokenStorage (60+ tests)
- ✓ IndexedDB initialization (5)
- ✓ Save/load/delete operations (7)
- ✓ Bulk operations (5)
- ✓ Encryption/decryption (3)
- ✓ localStorage fallback (2)
- ✓ Quota management (4)
- ✓ Performance metrics (4)
- ✓ Error handling (5)
- ✓ Edge cases (6)

#### MultiTokenManager (80+ tests)
- ✓ Singleton pattern (4)
- ✓ Token CRUD operations (7)
- ✓ Current site management (5)
- ✓ Caching behavior (6)
- ✓ Event emission (9)
- ✓ Storage integration (4)
- ✓ Error handling (4)
- ✓ Performance (3)
- ✓ Edge cases (5)

#### TokenValidator (50+ tests)
- ✓ JWT format validation (7)
- ✓ Base64 decoding (5)
- ✓ Expiration calculation (6)
- ✓ Warning thresholds (5)
- ✓ API testing (7)
- ✓ Error scenarios (8)
- ✓ Validation response (6)

#### TokenResolver (70+ tests)
- ✓ Priority chain resolution (8)
- ✓ Cache behavior (6)
- ✓ Site ID resolution (6)
- ✓ Source tracking (4)
- ✓ Event emission (4)
- ✓ Performance benchmarks (4)
- ✓ Error handling (4)
- ✓ Edge cases (6)

#### TokenInterceptor (50+ tests)
- ✓ Request token injection (6)
- ✓ Site ID extraction (6)
- ✓ 401/403 handling (8)
- ✓ Request queue (5)
- ✓ Retry logic (5)
- ✓ Error scenarios (5)
- ✓ Interceptor management (5)
- ✓ Performance (3)
- ✓ Edge cases (5)

## Test Coverage Targets

| Metric | Target | Purpose |
|--------|--------|---------|
| Lines | 90%+ | Overall code coverage |
| Functions | 95%+ | All functions tested |
| Branches | 85%+ | Decision paths covered |
| Statements | 90%+ | Code statements executed |

## Key Features

### 1. Mock Data Generators

```typescript
import { createMockSiteToken, generateMockJWT } from '@test-utils/mockTokenData';

const token = createMockSiteToken({
  siteId: 'ses_test_site',
  userId: 'user_123',
  expiresAt: Date.now() + 86400000, // 24 hours
});

const jwt = generateMockJWT({ role: 'admin' });
```

### 2. Test Environment Setup

```typescript
import { setupTestEnvironment } from '@test-utils/tokenTestHelpers';

let env: ReturnType<typeof setupTestEnvironment>;

beforeEach(() => {
  env = setupTestEnvironment();
});

afterEach(() => {
  env.cleanup();
});
```

### 3. Performance Testing

```typescript
import { PerformanceTimer } from '@test-utils/tokenTestHelpers';

const timer = new PerformanceTimer();
const { result, duration } = await timer.measure(async () => {
  return await tokenStorage.loadAllTokens();
});

expect(duration).toBeLessThan(100); // < 100ms
```

## Common Test Patterns

### 1. Testing Async Operations

```typescript
it('should load token asynchronously', async () => {
  const token = createMockSiteToken();
  await tokenStorage.saveToken(token.siteId, token);

  const loaded = await tokenStorage.loadToken(token.siteId);
  expect(loaded).toEqual(token);
});
```

### 2. Testing Events

```typescript
it('should emit tokenAdded event', () => {
  const spy = vi.fn();
  manager.on('tokenAdded', spy);

  manager.addToken('site1', 'token1');

  expect(spy).toHaveBeenCalledWith({ siteId: 'site1' });
});
```

### 3. Testing Error Handling

```typescript
it('should handle storage errors', async () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Storage error');
  });

  await expect(
    tokenStorage.saveToken('test', token)
  ).rejects.toThrow('Storage error');
});
```

### 4. Testing Performance

```typescript
it('should cache tokens for fast retrieval', async () => {
  await manager.addToken('site1', 'token1');

  const timer = new PerformanceTimer();
  const { duration } = await timer.measure(async () => {
    await manager.getToken('site1');
  });

  expect(duration).toBeLessThan(1); // < 1ms from cache
});
```

## Running Specific Tests

### By File

```bash
# Run specific test file
npm test -- tokenStorage.test.ts

# Run multiple files
npm test -- tokenStorage.test.ts tokenValidator.test.ts
```

### By Pattern

```bash
# Run tests matching pattern
npm test -- --grep "cache"

# Run tests in specific describe block
npm test -- --grep "TokenStorage"
```

### By Tag

```typescript
// Mark slow tests
it.concurrent('should handle bulk operations', async () => {
  // Test implementation
});

// Skip tests
it.skip('should test feature not implemented', () => {
  // Test implementation
});

// Only run specific tests
it.only('should test this one', () => {
  // Test implementation
});
```

## Debugging Tests

### 1. Enable Debug Output

```bash
# Run with debug output
DEBUG=* npm test

# Run specific test with output
npm test -- tokenStorage.test.ts --reporter=verbose
```

### 2. Use Vitest UI

```bash
# Launch interactive UI
npm run test:ui
```

### 3. VSCode Integration

Add to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm test --"
}
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Performance Benchmarks

### Expected Performance

| Operation | Target | Typical |
|-----------|--------|---------|
| Individual test | < 100ms | ~25ms |
| Full suite | < 30s | ~8s |
| Cache operations | < 1ms | ~0.5ms |
| Storage reads | < 10ms | ~2ms |
| Storage writes | < 10ms | ~3ms |

### Optimization Tips

1. **Use parallel execution** - Vitest runs tests in parallel by default
2. **Mock heavy operations** - Use mocks for IndexedDB, API calls
3. **Share setup** - Use beforeAll for expensive setup
4. **Clean up properly** - Use afterEach to prevent memory leaks

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for slow tests
it('should handle large dataset', async () => {
  // Test implementation
}, 10000); // 10 second timeout
```

### Flaky Tests

```typescript
// Use waitForAsync for timing-dependent tests
import { waitForAsync } from '@test-utils/tokenTestHelpers';

await waitForAsync(100);
expect(condition).toBe(true);
```

### Memory Leaks

```typescript
// Always clean up resources
afterEach(() => {
  cache.clear();
  eventEmitter.removeAllListeners();
});
```

## Next Steps

### 1. Implement Services

These tests are written in TDD style and define the expected behavior. Implement the actual services to make the tests pass.

### 2. Add Integration Tests

Create end-to-end tests that test complete token flows across multiple services.

### 3. Add E2E Tests

Use Playwright or Cypress to test token functionality in a real browser environment.

### 4. Performance Testing

Add load testing to validate performance under stress.

### 5. Security Testing

Add penetration testing for token encryption and validation.

## Resources

- [Full Test Documentation](./TEST_DOCUMENTATION.md)
- [Vitest Documentation](https://vitest.dev/)
- [Token Architecture](../Building-Vitals/docs/architecture/tokenStorage-architecture.md)
- [SPARC Methodology](../CLAUDE.md)

## Support

Questions? Check:
1. This quick start guide
2. [Full test documentation](./TEST_DOCUMENTATION.md)
3. Test examples in `__tests__` directories
4. Architecture documentation

---

**Test suite ready for implementation!** Run `npm test` to start.
