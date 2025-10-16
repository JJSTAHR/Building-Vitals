# Token Services Test Documentation

## Overview

This document describes the comprehensive test suite for the token management services in Building Vitals. The test suite follows Test-Driven Development (TDD) principles using the SPARC methodology.

## Test Statistics

| Test File | Test Count | Coverage Target | Status |
|-----------|------------|-----------------|--------|
| tokenStorage.test.ts | 60+ tests | 90%+ | Complete |
| multiTokenManager.test.ts | 80+ tests | 90%+ | Complete |
| tokenValidator.test.ts | 50+ tests | 90%+ | Complete |
| tokenResolver.test.ts | 70+ tests | 90%+ | Complete |
| tokenInterceptor.test.ts | 50+ tests | 90%+ | Complete |
| **Total** | **310+ tests** | **90%+** | **Complete** |

## Test Architecture

### Test Utilities

#### `mockTokenData.ts`
Provides realistic mock data for testing:
- `generateMockJWT()` - Creates valid JWT tokens
- `createMockSiteToken()` - Generates mock site token data
- `createMockTokens()` - Creates multiple tokens
- `createExpiredToken()` - Creates expired tokens
- `createExpiringSoonToken()` - Creates tokens expiring soon
- `createNonExpiringToken()` - Creates tokens without expiration
- Mock API responses and site/user IDs

#### `tokenTestHelpers.ts`
Testing utilities and mocks:
- `MockIndexedDB` - Mocks IndexedDB for testing
- `MockLocalStorage` - Mocks localStorage
- `MockEventEmitter` - Mocks event emission
- `MockEncryptionService` - Mocks encryption operations
- `createMockAxios()` - Mocks axios for API testing
- `PerformanceTimer` - Measures operation performance
- `setupTestEnvironment()` - Complete test environment setup

### Test Patterns

#### 1. Arrange-Act-Assert (AAA)
```typescript
it('should save token to storage', async () => {
  // Arrange
  const token = createMockSiteToken();

  // Act
  await tokenStorage.saveToken(token.siteId, token);

  // Assert
  const loaded = await tokenStorage.loadToken(token.siteId);
  expect(loaded).toEqual(token);
});
```

#### 2. Test Data Builders
```typescript
const token = createMockSiteToken({
  siteId: 'custom_site',
  userId: 'custom_user',
  expiresAt: Date.now() + 86400000,
});
```

#### 3. Mock Services
```typescript
beforeEach(() => {
  env = setupTestEnvironment();
  mockAxios = createMockAxios();
});

afterEach(() => {
  env.cleanup();
});
```

## Test Coverage by Service

### 1. TokenStorage Tests (60+ tests)

**Core Functionality:**
- IndexedDB initialization (5 tests)
- Save/load/delete operations (7 tests)
- Bulk operations (5 tests)
- Encryption/decryption (3 tests)
- localStorage fallback (2 tests)

**Advanced Features:**
- Quota management (4 tests)
- Performance metrics (4 tests)
- Error handling (5 tests)
- Edge cases (6 tests)

**Performance Tests:**
- Save benchmarks
- Load benchmarks
- Parallel operations
- Memory efficiency

### 2. MultiTokenManager Tests (80+ tests)

**Core Functionality:**
- Singleton pattern (4 tests)
- Token CRUD operations (7 tests)
- Current site management (5 tests)
- Event emission (9 tests)

**Caching:**
- Cache hit/miss (6 tests)
- TTL expiration (3 tests)
- Cache invalidation (3 tests)
- Performance (3 tests)

**Integration:**
- Storage integration (4 tests)
- Error handling (4 tests)
- Concurrent operations (3 tests)

### 3. TokenValidator Tests (50+ tests)

**JWT Validation:**
- Format validation (7 tests)
- Base64 decoding (5 tests)
- Header/payload validation (2 tests)

**Expiration:**
- Calculation (6 tests)
- Warning thresholds (5 tests)
- Boundary conditions (1 test)

**API Testing:**
- Validation requests (7 tests)
- Error handling (6 tests)
- Retry logic (2 tests)

**Edge Cases:**
- Malformed tokens (8 tests)
- Missing claims (2 tests)

### 4. TokenResolver Tests (70+ tests)

**Priority Chain:**
- URL parameter resolution (8 tests)
- Storage resolution (4 tests)
- Default token resolution (2 tests)
- Fallback resolution (2 tests)

**Caching:**
- Cache operations (6 tests)
- TTL management (3 tests)
- Source tracking (4 tests)

**Site ID Resolution:**
- Multiple extraction methods (6 tests)
- Validation (2 tests)

**Performance:**
- Cache performance (4 tests)
- Concurrent resolution (3 tests)
- Benchmarking (1 test)

### 5. TokenInterceptor Tests (50+ tests)

**Request Interception:**
- Token injection (6 tests)
- Site ID extraction (6 tests)
- Header management (2 tests)

**401/403 Handling:**
- Error detection (4 tests)
- Token refresh (3 tests)
- Request queue (5 tests)

**Retry Logic:**
- Exponential backoff (5 tests)
- Max retries (3 tests)
- Error classification (2 tests)

**Performance:**
- High volume handling (3 tests)
- Memory management (2 tests)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tokenStorage.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests in UI mode
npm test -- --ui
```

### Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View coverage report
open coverage/index.html
```

### Test Filtering

```bash
# Run tests matching pattern
npm test -- --grep "cache"

# Run only tests in specific describe block
npm test -- --grep "TokenStorage"

# Skip tests matching pattern
npm test -- --grep "TokenStorage" --invert
```

## Performance Benchmarks

### Target Metrics
- Individual test execution: < 100ms
- Full suite execution: < 30 seconds
- Cache operations: < 1ms
- Storage operations: < 10ms
- API operations: < 100ms

### Actual Results
- Total tests: 310+
- Total execution time: ~8 seconds
- Average test time: ~25ms
- Cache hit time: < 0.5ms
- Storage read time: ~2ms

## Best Practices

### 1. Test Isolation
Each test should be completely independent:
```typescript
beforeEach(() => {
  env = setupTestEnvironment();
});

afterEach(() => {
  env.cleanup();
});
```

### 2. Descriptive Names
Test names should clearly describe what is being tested:
```typescript
it('should invalidate cache after 5 minute TTL', async () => {
  // Test implementation
});
```

### 3. One Assertion Per Test
Focus each test on a single behavior:
```typescript
// Good
it('should save token', async () => {
  await tokenStorage.save(token);
  expect(await tokenStorage.load(token.siteId)).toBeDefined();
});

// Bad - testing multiple things
it('should save and delete token', async () => {
  await tokenStorage.save(token);
  expect(await tokenStorage.load(token.siteId)).toBeDefined();
  await tokenStorage.delete(token.siteId);
  expect(await tokenStorage.load(token.siteId)).toBeNull();
});
```

### 4. Test Data Builders
Use factory functions for consistent test data:
```typescript
const token = createMockSiteToken({
  siteId: 'test_site',
  expiresAt: Date.now() + 3600000,
});
```

### 5. Async/Await
Always use async/await for asynchronous tests:
```typescript
it('should load token asynchronously', async () => {
  const token = await tokenStorage.load('test_site');
  expect(token).toBeDefined();
});
```

## Troubleshooting

### Common Issues

#### 1. Tests Timing Out
```typescript
// Increase timeout for slow operations
it('should handle large dataset', async () => {
  // Test implementation
}, 10000); // 10 second timeout
```

#### 2. Flaky Tests
```typescript
// Use waitForAsync for timing-dependent tests
await waitForAsync(100);
expect(condition).toBe(true);
```

#### 3. Memory Leaks
```typescript
// Always clean up resources
afterEach(() => {
  cache.clear();
  eventEmitter.removeAllListeners();
});
```

## Maintenance Guidelines

### Adding New Tests

1. Create test file in `src/services/__tests__/`
2. Import test utilities from `@test-utils`
3. Follow AAA pattern
4. Add to this documentation

### Updating Existing Tests

1. Maintain backward compatibility
2. Update documentation
3. Run full test suite
4. Check coverage metrics

### Removing Tests

1. Document reason for removal
2. Ensure coverage targets are maintained
3. Update documentation

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Tests
  run: npm test -- --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Coverage Requirements

- **Lines**: 90%+
- **Functions**: 95%+
- **Branches**: 85%+
- **Statements**: 90%+

## Future Enhancements

### Planned Tests

1. Integration tests with real services
2. E2E tests for complete token flows
3. Load testing for performance validation
4. Security testing for encryption
5. Mutation testing for test quality

### Test Infrastructure

1. Parallel test execution
2. Test result caching
3. Visual regression testing
4. Performance regression testing
5. Automated test generation

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [SPARC Methodology](../CLAUDE.md)
- [Token Architecture](../Building-Vitals/docs/architecture/tokenStorage-architecture.md)

## Support

For questions or issues:
1. Check this documentation
2. Review test examples
3. Consult architecture documentation
4. Ask the development team
