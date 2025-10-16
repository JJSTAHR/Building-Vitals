# Monitoring and Analytics Test Suite

Comprehensive test suite for the monitoring and analytics system, covering worker analytics, dashboard components, integration flows, and performance benchmarks.

## 📁 Directory Structure

```
tests/monitoring/
├── fixtures/           # Test data and fixtures
│   └── analytics-fixtures.ts
├── mocks/              # Mock implementations
│   └── analytics-engine-mock.ts
├── unit/               # Unit tests
│   ├── worker-analytics.test.ts
│   └── dashboard.test.tsx
├── integration/        # Integration tests
│   └── end-to-end-analytics.test.ts
├── performance/        # Performance benchmarks
│   └── analytics-performance.test.ts
├── e2e/                # End-to-end validation
│   └── validate-analytics.ts
└── README.md           # This file
```

## 🧪 Test Coverage

### Unit Tests

#### Worker Analytics Tests (`unit/worker-analytics.test.ts`)
- ✅ Request tracking and correlation IDs
- ✅ Error tracking and categorization
- ✅ Performance markers (fast, normal, slow, critical)
- ✅ Cache metrics (hits, misses, efficiency)
- ✅ Query and aggregation functions
- ✅ Analytics overhead measurement

#### Dashboard Component Tests (`unit/dashboard.test.tsx`)
- ✅ Component rendering
- ✅ Real-time metric updates
- ✅ Manual refresh functionality
- ✅ Metric calculations (cache hit rate, error rate)
- ✅ Error handling
- ✅ Performance optimization
- ✅ Accessibility features

### Integration Tests

#### End-to-End Analytics (`integration/end-to-end-analytics.test.ts`)
- ✅ Complete request lifecycle tracking
- ✅ Error correlation across datasets
- ✅ Analytics to dashboard data flow
- ✅ Historical data aggregation (hourly, daily)
- ✅ Alert trigger detection
- ✅ High-volume request handling
- ✅ Concurrent write operations

### Performance Tests

#### Analytics Performance Benchmarks (`performance/analytics-performance.test.ts`)
- ✅ Write performance (1K, 10K data points)
- ✅ Query performance with filters
- ✅ Aggregation and percentile calculations
- ✅ Memory overhead tracking
- ✅ Concurrent operation handling
- ✅ Dashboard render performance
- ✅ Production load simulation (60K requests/hour)

### E2E Validation

#### Analytics Accuracy Validation (`e2e/validate-analytics.ts`)
- ✅ Request generation and tracking
- ✅ Metrics accuracy verification
- ✅ Error correlation validation
- ✅ Cache metrics validation
- ✅ Multi-scenario testing (low/medium/high traffic)

## 🚀 Running Tests

### Run All Tests
```bash
npm run test
```

### Run Unit Tests Only
```bash
npm run test:unit -- tests/monitoring/unit
```

### Run Integration Tests
```bash
npm run test:integration -- tests/monitoring/integration
```

### Run Performance Tests
```bash
npm run test -- tests/monitoring/performance
```

### Run E2E Validation
```bash
npx tsx tests/monitoring/e2e/validate-analytics.ts
```

### Run Tests with Coverage
```bash
npm run test:coverage -- tests/monitoring
```

### Run Tests in Watch Mode
```bash
npm run test:watch -- tests/monitoring
```

## 📊 Coverage Goals

| Category | Target | Status |
|----------|--------|--------|
| Statements | 90% | ✅ |
| Branches | 85% | ✅ |
| Functions | 95% | ✅ |
| Lines | 90% | ✅ |

## 🔧 Test Utilities

### Fixtures (`fixtures/analytics-fixtures.ts`)

```typescript
import { generateMockAnalyticsEvents, generateMockMetrics } from '../fixtures/analytics-fixtures';

// Generate sample analytics events
const events = generateMockAnalyticsEvents(100);

// Generate mock metrics
const metrics = generateMockMetrics();

// Use predefined scenarios
import { errorScenarios, performanceMarkers, cacheScenarios } from '../fixtures/analytics-fixtures';
```

### Mocks (`mocks/analytics-engine-mock.ts`)

```typescript
import { createMockAnalyticsEngine, createMockWorkerEnv } from '../mocks/analytics-engine-mock';

// Create mock environment
const mockEnv = createMockWorkerEnv();

// Write analytics data
mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
  blobs: ['GET', '/api/test', '200'],
  indexes: [100, 200],
  doubles: [1024, 95.5],
});

// Query data
const results = mockEnv.ANALYTICS.getDataset('requests').query({
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
});
```

## 📈 Performance Benchmarks

### Write Performance
- **1,000 data points**: < 100ms
- **10,000 data points**: < 500ms
- **Throughput**: > 20,000 writes/sec

### Query Performance
- **Full dataset (10K)**: < 50ms
- **Filtered query**: < 100ms
- **Limited query (100)**: < 10ms

### Aggregation Performance
- **Basic statistics**: < 50ms
- **Percentiles**: < 100ms
- **Time window grouping**: < 100ms

### Dashboard Performance
- **Metrics calculation**: < 200ms
- **Render time**: < 100ms

### Production Load
- **60K requests/hour**: < 10 seconds processing
- **Throughput**: > 6,000 req/sec

## 🐛 Debugging Tests

### Enable Verbose Output
```bash
npm run test -- --reporter=verbose tests/monitoring
```

### Run Single Test File
```bash
npm run test -- tests/monitoring/unit/worker-analytics.test.ts
```

### Run Specific Test
```bash
npm run test -- -t "should track request lifecycle"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${file}"],
  "console": "integratedTerminal"
}
```

## 🔍 Test Scenarios

### Error Scenarios
- Network timeout
- Server errors (500)
- Unauthorized (401)
- Rate limiting (429)

### Performance Markers
- Fast requests (< 100ms)
- Normal requests (100-500ms)
- Slow requests (500-3000ms)
- Critical slow (> 3000ms)

### Cache Scenarios
- Cache hit
- Cache miss
- Cache expired

### Time Ranges
- Last hour
- Last 24 hours
- Last 7 days

## 📝 Writing New Tests

### Template for Unit Test
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('My Feature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Template for Integration Test
```typescript
describe('Integration: Feature Flow', () => {
  it('should complete end-to-end flow', async () => {
    // Step 1: Setup
    const mockEnv = createMockWorkerEnv();

    // Step 2: Execute flow
    await executeFlow(mockEnv);

    // Step 3: Verify results
    const results = await queryResults(mockEnv);
    expect(results).toHaveLength(expectedCount);
  });
});
```

## 🎯 Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in `afterEach`
3. **Descriptive Names**: Use clear test descriptions
4. **Arrange-Act-Assert**: Follow the AAA pattern
5. **Mock External Dependencies**: Use mocks for external services
6. **Performance**: Keep tests fast (< 100ms for unit tests)
7. **Coverage**: Aim for 90%+ coverage
8. **Real-world Scenarios**: Test realistic use cases

## 🔗 Related Documentation

- [Analytics System Documentation](../../docs/ANALYTICS_SYSTEM.md)
- [Monitoring Dashboard Guide](../../docs/MONITORING_DASHBOARD.md)
- [Performance Optimization](../../docs/PERFORMANCE.md)
- [Testing Strategy](../../docs/TESTING_STRATEGY.md)

## 🤝 Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Add tests to appropriate directory (unit/integration/performance)
3. Update this README with new test descriptions
4. Ensure all tests pass before committing
5. Maintain 90%+ code coverage

## 📞 Support

For questions or issues with tests:

1. Check test output for detailed error messages
2. Review related test files for examples
3. Consult the main project documentation
4. Open an issue with test failure details

---

**Last Updated**: 2025-10-12
**Test Suite Version**: 1.0.0
**Total Tests**: 50+
**Coverage Target**: 90%+
