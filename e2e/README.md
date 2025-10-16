# E2E Tests Quick Start

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Specific Browser
```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Mobile Tests
```bash
npm run test:e2e:mobile
```

### Specific Test Suite
```bash
npm run test:e2e:security
npm run test:e2e:performance
```

### Interactive Mode
```bash
npm run test:e2e:ui
npm run test:e2e:debug
```

### View Report
```bash
npm run test:e2e:report
```

## Test Organization

- `tokenManagement.e2e.test.ts` - Core functionality (11 tests)
- `security.e2e.test.ts` - Security validation (15 tests)
- `performance.e2e.test.ts` - Performance benchmarks (10 tests)

## Page Objects

- `pages/SettingsPage.ts` - Token management operations
- `pages/DashboardPage.ts` - Dashboard interactions

## Test Data

- `fixtures/testData.ts` - Test users, tokens, and helper functions

For detailed documentation, see `docs/E2E_TESTS.md`
