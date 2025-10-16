# Paginated Endpoint Test Plan

## Overview

This document outlines the comprehensive testing strategy for the paginated timeseries endpoint refactor. The goal is to ensure reliability, performance, and correctness of the new pagination implementation.

---

## Test Categories

### 1. Unit Tests

**Purpose**: Validate individual functions in isolation.

**Test Files**: `tests/paginated-timeseries.test.ts`

**Coverage Requirements**:
- Statements: >85%
- Branches: >80%
- Functions: >90%
- Lines: >85%

**Functions Under Test**:

#### `fetchPaginatedTimeseries()`
- ✅ Single page response (has_more: false)
- ✅ Multi-page pagination with cursors
- ✅ raw_data parameter handling
- ✅ Progress callback invocation
- ✅ API error handling (4xx, 5xx)
- ✅ Network failure handling
- ✅ Infinite loop prevention
- ✅ Collection interval merging

#### `filterAndGroupTimeseries()`
- ✅ Point filtering logic
- ✅ Grouping by point name
- ✅ Timestamp sorting (ascending)
- ✅ Empty data handling
- ✅ Property preservation

#### `fetchTimeseriesForPoints()`
- ✅ Integrated fetch + filter workflow
- ✅ Collection interval preservation
- ✅ Progress callback pass-through

---

### 2. Integration Tests

**Purpose**: Validate end-to-end data flow across system boundaries.

#### Worker ↔ ACE API Integration

**Test Scenario**: Worker fetches paginated data from ACE API

```typescript
// Test implementation in tests/integration/worker-ace-api.test.ts

describe('Worker → ACE API Integration', () => {
  it('should fetch multi-page timeseries from real ACE endpoint', async () => {
    const result = await worker.fetchTimeseries({
      building_id: TEST_BUILDING_ID,
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      point_names: ['temp_sensor_1', 'humidity_sensor_1']
    });

    expect(result.data).toBeDefined();
    expect(result.collection_intervals).toBeDefined();
  });
});
```

**Acceptance Criteria**:
- ✅ Successfully fetches data from staging ACE API
- ✅ Handles pagination correctly (3+ pages)
- ✅ Returns filtered data for selected points
- ✅ Preserves collection intervals

#### Frontend ↔ Worker Integration

**Test Scenario**: Frontend service calls worker endpoint

```typescript
// Test implementation in tests/integration/frontend-worker.test.ts

describe('Frontend → Worker Integration', () => {
  it('should fetch timeseries through service layer', async () => {
    const service = new TimeseriesService(workerUrl);

    const result = await service.getTimeseriesForPoints(
      ['temp_sensor_1'],
      '2025-01-01',
      '2025-01-31',
      'building-123'
    );

    expect(result.groupedData.temp_sensor_1).toBeDefined();
    expect(result.groupedData.temp_sensor_1.length).toBeGreaterThan(0);
  });
});
```

**Acceptance Criteria**:
- ✅ Frontend can call worker endpoint
- ✅ Data transformation is correct
- ✅ Error handling works across layers
- ✅ Timeouts handled gracefully

---

### 3. Performance Tests

**Purpose**: Ensure system performs under realistic load.

#### Test Scenarios

**Scenario 1: Large Dataset (1M+ samples)**

```bash
# Manual test command
npm run test:perf -- --dataset=large
```

**Expected Results**:
- Fetch time: <10 seconds for 1M samples
- Memory usage: <500MB peak
- No memory leaks after completion

**Scenario 2: Multiple Pagination Cycles (10+ pages)**

**Expected Results**:
- Per-page fetch time: <2 seconds
- Total fetch time: <25 seconds for 10 pages
- Consistent memory usage across pages

**Scenario 3: Concurrent Requests**

**Test**: 10 concurrent timeseries requests

**Expected Results**:
- All requests complete successfully
- No rate limiting errors
- Aggregate throughput: >50 samples/second

**Scenario 4: Filtering Performance**

**Test**: Filter 1M samples down to 10 selected points

**Expected Results**:
- Filtering time: <100ms
- O(n) time complexity
- Memory efficient (no unnecessary copies)

---

### 4. Edge Case Tests

#### Empty Results

**Test**: Query date range with no data

**Expected Behavior**:
- Returns empty samples array
- Returns empty collection_intervals object
- No errors thrown

#### Single Page Response

**Test**: Query returns all data in first page

**Expected Behavior**:
- Only 1 fetch call made
- has_more = false
- next_cursor = null

#### Invalid Cursors

**Test**: Send malformed cursor to API

**Expected Behavior**:
- API returns 400 error
- Function throws descriptive error
- Error message includes status code

#### Token Expiration

**Test**: Access token expires mid-pagination

**Expected Behavior**:
- API returns 401 error
- Function throws authentication error
- Error message suggests token refresh

#### Network Failures

**Test**: Network timeout during fetch

**Expected Behavior**:
- Function throws network error
- No partial data corruption
- Retryable operation

#### Malformed JSON

**Test**: API returns invalid JSON

**Expected Behavior**:
- JSON parse error caught
- Function throws descriptive error
- No application crash

---

## Test Data Requirements

### Mock Data Specifications

#### Small Dataset (Unit Tests)
- **Size**: 10-100 samples
- **Points**: 2-5 unique point names
- **Duration**: 1 hour to 1 day
- **Pages**: 1-3 pages

#### Medium Dataset (Integration Tests)
- **Size**: 10,000-100,000 samples
- **Points**: 10-50 unique point names
- **Duration**: 1 week to 1 month
- **Pages**: 5-20 pages

#### Large Dataset (Performance Tests)
- **Size**: 1,000,000+ samples
- **Points**: 100+ unique point names
- **Duration**: 1+ months
- **Pages**: 50+ pages

### Test Building Configuration

**Test Building ID**: `building-test-123`

**Test Points**:
```json
[
  "temp_sensor_1",
  "temp_sensor_2",
  "humidity_sensor_1",
  "humidity_sensor_2",
  "co2_sensor_1"
]
```

**Collection Intervals**:
```json
{
  "temp_sensor_1": 300,     // 5 minutes
  "temp_sensor_2": 300,
  "humidity_sensor_1": 600,  // 10 minutes
  "humidity_sensor_2": 600,
  "co2_sensor_1": 900        // 15 minutes
}
```

---

## Manual Testing Procedures

### Procedure 1: Verify Pagination Flow

**Steps**:

1. Open browser DevTools → Network tab
2. Navigate to timeseries chart page
3. Select date range with 10,000+ samples
4. Select 3-5 points
5. Click "Load Data"

**Verification**:
- Multiple API calls visible in Network tab
- Each call includes `cursor` parameter (except first)
- Final call has `has_more: false`
- Chart renders complete dataset

**Expected Result**: ✅ All data loaded and displayed correctly

---

### Procedure 2: Test Progress Indicator

**Steps**:

1. Navigate to timeseries chart page
2. Select large date range (1+ month)
3. Select 10+ points
4. Click "Load Data"
5. Observe progress indicator

**Verification**:
- Progress bar appears
- Sample count increments on each page
- Progress updates smoothly
- Final state shows "Complete"

**Expected Result**: ✅ Progress indicator provides accurate feedback

---

### Procedure 3: Verify Error Handling

**Test 3a: Network Error**

**Steps**:
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try to load timeseries data

**Expected Result**: ✅ User-friendly error message displayed

**Test 3b: Invalid Date Range**

**Steps**:
1. Set start_date > end_date
2. Try to load data

**Expected Result**: ✅ Validation error before API call

**Test 3c: Token Expiration**

**Steps**:
1. Let session expire (or manually clear token)
2. Try to load timeseries data

**Expected Result**: ✅ Redirect to login or token refresh

---

### Procedure 4: Performance Validation

**Steps**:

1. Open browser DevTools → Performance tab
2. Start recording
3. Load large dataset (1M+ samples)
4. Stop recording when complete
5. Analyze flame graph

**Verification**:
- No long tasks (>50ms)
- Memory usage stable
- No layout thrashing
- Efficient rendering

**Expected Result**: ✅ Page remains responsive during load

---

## Acceptance Criteria

### Functional Requirements

- ✅ System correctly fetches multi-page timeseries data
- ✅ Pagination stops when `has_more: false`
- ✅ Cursors passed correctly between requests
- ✅ Samples filtered to selected points only
- ✅ Collection intervals preserved for all points
- ✅ Timestamps sorted chronologically
- ✅ Progress callbacks invoked on each page

### Non-Functional Requirements

- ✅ Unit test coverage >85%
- ✅ All integration tests pass
- ✅ Performance tests meet benchmarks
- ✅ No memory leaks detected
- ✅ Error messages are user-friendly
- ✅ Code follows project style guide
- ✅ Documentation is complete and accurate

### User Experience Requirements

- ✅ Progress indicator shows during load
- ✅ Page remains responsive
- ✅ Errors handled gracefully
- ✅ Data loads in <30 seconds for typical queries
- ✅ Charts render correctly after load

---

## Test Execution Schedule

### Phase 1: Unit Tests (Day 1)
- Run automated unit tests
- Fix failing tests
- Achieve >85% coverage

### Phase 2: Integration Tests (Day 2)
- Set up test environment
- Run worker ↔ ACE API tests
- Run frontend ↔ worker tests
- Validate end-to-end flow

### Phase 3: Performance Tests (Day 3)
- Run large dataset tests
- Run pagination cycle tests
- Run concurrent request tests
- Analyze and document results

### Phase 4: Manual Testing (Day 4)
- Execute all manual test procedures
- Document findings
- Create bug reports for issues

### Phase 5: Regression Testing (Day 5)
- Re-run all automated tests
- Verify bug fixes
- Final acceptance sign-off

---

## Test Environment

### Required Tools
- Node.js v18+
- npm v9+
- Vitest (test runner)
- Playwright (E2E tests)
- Chrome DevTools

### Environment Variables

```env
# Test environment configuration
ACE_API_URL=https://staging-api.ace.com
TEST_BUILDING_ID=building-test-123
TEST_AUTH_TOKEN=<staging-token>
TEST_TIMEOUT=30000
```

### Test Commands

```bash
# Run all unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:perf

# Run specific test file
npm test tests/paginated-timeseries.test.ts

# Run tests in watch mode
npm test -- --watch
```

---

## Bug Reporting Template

```markdown
### Bug Report

**Title**: [Brief description]

**Test Case**: [Which test failed]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Environment**:
- Browser: [Browser name and version]
- OS: [Operating system]
- API Environment: [staging/production]

**Screenshots/Logs**:
[Attach relevant files]

**Severity**: [Critical/High/Medium/Low]

**Priority**: [P0/P1/P2/P3]
```

---

## Sign-Off Criteria

### Development Team Sign-Off
- [ ] All unit tests pass
- [ ] Code coverage >85%
- [ ] Integration tests pass
- [ ] Performance benchmarks met
- [ ] Code reviewed and approved

### QA Team Sign-Off
- [ ] All manual test procedures completed
- [ ] No critical bugs remain
- [ ] Regression tests pass
- [ ] User acceptance testing completed
- [ ] Documentation reviewed

### Product Team Sign-Off
- [ ] Feature meets requirements
- [ ] User experience validated
- [ ] Performance acceptable
- [ ] Ready for production deployment

---

## Appendix

### A. Test Data Generators

```typescript
// Generate mock timeseries data
function generateMockTimeseries(
  pointNames: string[],
  startDate: string,
  endDate: string,
  intervalSeconds: number
): TimeseriesSample[] {
  const samples: TimeseriesSample[] = [];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  for (let ts = start; ts <= end; ts += intervalSeconds * 1000) {
    for (const pointName of pointNames) {
      samples.push({
        point_name: pointName,
        timestamp: new Date(ts).toISOString(),
        value: Math.random() * 100
      });
    }
  }

  return samples;
}
```

### B. Performance Monitoring

```typescript
// Measure fetch performance
async function measureFetchPerformance() {
  const start = performance.now();

  await fetchPaginatedTimeseries(token, params);

  const duration = performance.now() - start;
  console.log(`Fetch completed in ${duration}ms`);

  return duration;
}
```

### C. Useful Testing Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Performance Testing Guide](https://web.dev/performance/)
- [ACE API Documentation](https://api-docs.ace.com)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Owner**: Testing Team
**Status**: Active
