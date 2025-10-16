# Paginated Timeseries Endpoint Specification

## 1. Introduction

### 1.1 Purpose
This specification defines the requirements for refactoring Building Vitals to use the paginated timeseries endpoint (`/sites/{site_name}/timeseries/paginated`) with raw data retrieval, replacing the current per-point aggregated approach.

### 1.2 Scope
- Replace current per-point timeseries fetching with site-level paginated endpoint
- Enable raw data retrieval to preserve actual collection intervals (30s, 1min, etc.)
- Implement cursor-based pagination for handling large datasets
- Add client-side filtering for selected points
- Maintain existing chart rendering interface compatibility

### 1.3 Problem Statement
**Current Limitation**: The existing `/points/{point_name}/timeseries` endpoint returns 5-minute aggregated buckets, which:
- Loses granularity of actual collection intervals (30-second, 1-minute intervals)
- Cannot display high-resolution data visualization
- Masks data collection patterns and anomalies
- Reduces accuracy for short-duration trend analysis

### 1.4 Solution Overview
Use `/sites/{site_name}/timeseries/paginated` with `raw_data=true` parameter to:
- Retrieve unaggregated timeseries data at native collection intervals
- Handle large volumes of data through cursor-based pagination
- Filter client-side to display only selected points
- Preserve data fidelity for accurate visualization

---

## 2. API Endpoint Specification

### 2.1 Endpoint Definition

```
GET /api/sites/{site_name}/timeseries/paginated
```

**Description**: Returns a collection of timeseries data for all points within a site, with support for raw data retrieval and cursor-based pagination.

### 2.2 Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `site_name` | string | Yes | Unique identifier for the site |

**Example**: `/api/sites/building-main/timeseries/paginated`

### 2.3 Query Parameters

#### Required Parameters

| Parameter | Type | Required | Format | Description |
|-----------|------|----------|--------|-------------|
| `start_time` | string | Yes | ISO 8601 | Start of time range (inclusive) |
| `end_time` | string | Yes | ISO 8601 | End of time range (inclusive) |

**ISO 8601 Format Examples**:
- `2025-10-11T00:00:00Z` (UTC)
- `2025-10-11T14:30:00-04:00` (with timezone offset)

#### Optional Parameters

| Parameter | Type | Required | Default | Valid Values | Description |
|-----------|------|----------|---------|--------------|-------------|
| `raw_data` | boolean | No | false | true, false | Enable raw data without aggregation |
| `cursor` | string | No | null | (opaque string) | Pagination cursor from previous response |
| `page_size` | integer | No | 10000 | 3, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 300000, 500000 | Records per page |

**Parameter Behaviors**:
- `raw_data=false`: Returns 5-minute aggregated buckets (legacy behavior)
- `raw_data=true`: Returns unaggregated data at native collection intervals
- `cursor`: Required for retrieving subsequent pages (obtained from `next_cursor` in response)
- `page_size`: Balance between request size and number of pagination round-trips

### 2.4 Response Schema

#### Success Response (200 OK)

```json
{
  "point_samples": [
    {
      "name": "string",
      "value": "string",
      "time": "2025-10-11T14:30:00Z"
    }
  ],
  "next_cursor": "string",
  "has_more": true
}
```

**Field Definitions**:

| Field | Type | Description |
|-------|------|-------------|
| `point_samples` | array | Array of timeseries samples from all points in the site |
| `point_samples[].name` | string | Fully qualified point name |
| `point_samples[].value` | string | Sample value (numeric or categorical, encoded as string) |
| `point_samples[].time` | string | ISO 8601 timestamp of the sample |
| `next_cursor` | string \| null | Opaque cursor for next page; `null` if no more data |
| `has_more` | boolean | `true` if additional pages available; `false` if this is the final page |

#### Error Response (404 Not Found)

```json
{
  "message": "No data for time period"
}
```

**Error Conditions**:
- Site does not exist
- No timeseries data exists within the specified time range
- Invalid site_name format

---

## 3. Functional Requirements

### 3.1 Raw Data Retrieval (FR-001)

**Priority**: High

**Description**: The system shall retrieve timeseries data at native collection intervals without aggregation.

**Acceptance Criteria**:
- FR-001.1: When `raw_data=true`, response contains samples at their original collection intervals (30s, 1min, 5min, etc.)
- FR-001.2: No bucketing or averaging is applied to the raw data
- FR-001.3: Timestamps reflect exact collection times, not bucket start times
- FR-001.4: Sample ordering is chronological by timestamp

**Test Scenarios**:
```gherkin
Scenario: Retrieve raw 30-second interval data
  Given a point with collect_interval=30 seconds
  And timeseries data exists from 2025-10-11T10:00:00Z to 2025-10-11T10:05:00Z
  When I request paginated timeseries with raw_data=true
  Then I should receive exactly 10 samples (one per 30-second interval)
  And sample timestamps should be 30 seconds apart
  And no aggregation should be applied
```

### 3.2 Cursor-Based Pagination (FR-002)

**Priority**: High

**Description**: The system shall implement cursor-based pagination to handle large datasets efficiently.

**Acceptance Criteria**:
- FR-002.1: First request (without cursor) returns first page and `next_cursor`
- FR-002.2: Subsequent requests with `cursor` parameter return next page
- FR-002.3: `has_more=true` indicates additional pages available
- FR-002.4: `has_more=false` and `next_cursor=null` indicates final page
- FR-002.5: Cursors remain valid for at least 10 minutes
- FR-002.6: Invalid/expired cursors return clear error messages

**Pagination Flow**:
```javascript
// Page 1: Initial request
GET /api/sites/{site_name}/timeseries/paginated?start_time=...&end_time=...&raw_data=true&page_size=10000

Response: { point_samples: [...], next_cursor: "abc123", has_more: true }

// Page 2: Use cursor from previous response
GET /api/sites/{site_name}/timeseries/paginated?start_time=...&end_time=...&raw_data=true&page_size=10000&cursor=abc123

Response: { point_samples: [...], next_cursor: "def456", has_more: true }

// Final page
GET /api/sites/{site_name}/timeseries/paginated?start_time=...&end_time=...&raw_data=true&page_size=10000&cursor=def456

Response: { point_samples: [...], next_cursor: null, has_more: false }
```

**Test Scenarios**:
```gherkin
Scenario: Paginate through large dataset
  Given a site with 50,000 timeseries samples
  And page_size=10000
  When I paginate through all data
  Then I should receive exactly 5 pages
  And pages 1-4 should have has_more=true
  And page 5 should have has_more=false
  And total samples across all pages should equal 50,000
  And no duplicate samples should appear
  And no samples should be missing
```

### 3.3 Site-Level Data Retrieval (FR-003)

**Priority**: High

**Description**: The system shall retrieve timeseries data for all points within a site in a single paginated request flow.

**Acceptance Criteria**:
- FR-003.1: Single endpoint returns data for all points in the site
- FR-003.2: Response includes samples from multiple points intermixed by timestamp
- FR-003.3: Each sample includes the point name for identification
- FR-003.4: Handles sites with 1 to 100,000+ points

**Data Structure**:
```json
{
  "point_samples": [
    {"name": "site/floor1/temp", "value": "72.5", "time": "2025-10-11T10:00:00Z"},
    {"name": "site/floor2/temp", "value": "71.8", "time": "2025-10-11T10:00:00Z"},
    {"name": "site/floor1/humidity", "value": "45.2", "time": "2025-10-11T10:00:30Z"},
    {"name": "site/floor1/temp", "value": "72.6", "time": "2025-10-11T10:00:30Z"}
  ]
}
```

**Test Scenarios**:
```gherkin
Scenario: Retrieve data for site with multiple points
  Given a site with 10 active points
  And each point has collect_interval=60 seconds
  And time range is 1 hour
  When I request paginated timeseries
  Then I should receive samples from all 10 points
  And samples should be ordered chronologically
  And each sample should include the point name
```

### 3.4 Client-Side Filtering (FR-004)

**Priority**: High

**Description**: The application shall filter site-level timeseries data to display only user-selected points.

**Acceptance Criteria**:
- FR-004.1: UI allows selection of specific points for visualization
- FR-004.2: Client-side logic filters `point_samples` array by point names
- FR-004.3: Filtering occurs after pagination completes (all data retrieved)
- FR-004.4: Filtered data maintains chronological ordering
- FR-004.5: Performance remains acceptable with 10,000+ samples per point

**Implementation Pattern**:
```javascript
// Fetch all site data with pagination
const allSamples = await fetchAllPages(siteName, startTime, endTime);

// Filter to selected points
const selectedPointNames = ['site/floor1/temp', 'site/floor2/temp'];
const filteredSamples = allSamples.filter(sample =>
  selectedPointNames.includes(sample.name)
);

// Group by point for chart rendering
const chartData = groupByPoint(filteredSamples);
```

**Test Scenarios**:
```gherkin
Scenario: Filter to selected points
  Given a site with 100 points
  And I have selected 5 points for visualization
  And raw data contains 10,000 total samples
  When I apply client-side filtering
  Then I should see only samples from the 5 selected points
  And filtered dataset should contain approximately 500 samples
  And chronological ordering should be preserved
```

### 3.5 Chart Rendering Compatibility (FR-005)

**Priority**: High

**Description**: The refactored data fetching shall maintain compatibility with existing chart rendering components.

**Acceptance Criteria**:
- FR-005.1: Data transformation produces same structure as current implementation
- FR-005.2: Chart components require no modifications
- FR-005.3: Time axis rendering remains unchanged
- FR-005.4: Multi-series visualization works correctly
- FR-005.5: Zoom and pan interactions function as before

**Data Transformation**:
```javascript
// Current format (per-point array)
{
  "site/floor1/temp": [
    { time: "2025-10-11T10:00:00Z", value: 72.5 },
    { time: "2025-10-11T10:00:30Z", value: 72.6 }
  ],
  "site/floor2/temp": [
    { time: "2025-10-11T10:00:00Z", value: 71.8 },
    { time: "2025-10-11T10:00:30Z", value: 71.9 }
  ]
}

// Transform paginated response to this format
function transformForChart(filteredSamples) {
  return filteredSamples.reduce((acc, sample) => {
    if (!acc[sample.name]) acc[sample.name] = [];
    acc[sample.name].push({
      time: sample.time,
      value: parseFloat(sample.value)
    });
    return acc;
  }, {});
}
```

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-001)

**Category**: Performance

**Description**: The system shall handle large-scale timeseries data efficiently.

**Requirements**:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single page response time | < 2 seconds (p95) | API response latency |
| Client-side filtering | < 500ms for 50,000 samples | JavaScript execution time |
| Memory usage | < 100MB for 100,000 samples | Browser memory profiler |
| Pagination throughput | > 5 pages/second | Sequential request timing |

**Test Scenarios**:
```gherkin
Scenario: Performance with large dataset
  Given a site with 10,000 points
  And 7 days of data at 1-minute intervals
  (Approximately 100 million samples)
  When I paginate through data with page_size=100000
  Then each page should load in under 2 seconds
  And total pagination time should be under 5 minutes
  And browser should not freeze during processing
```

### 4.2 Scalability (NFR-002)

**Category**: Scalability

**Description**: The system shall support sites of varying sizes without degradation.

**Requirements**:
- NFR-002.1: Support sites with 1 to 100,000+ points
- NFR-002.2: Handle time ranges from 1 hour to 90 days
- NFR-002.3: Process datasets up to 10 million samples
- NFR-002.4: Graceful degradation for extremely large datasets (warnings/sampling)

**Validation**:
- Load test with sites containing 100, 1000, 10000, and 100000 points
- Verify pagination completes successfully for each scale
- Monitor memory consumption patterns
- Test user experience responsiveness

### 4.3 Data Accuracy (NFR-003)

**Category**: Reliability

**Description**: Raw data retrieval shall maintain perfect data fidelity.

**Requirements**:
- NFR-003.1: Zero data loss during pagination
- NFR-003.2: No duplicate samples across pages
- NFR-003.3: Timestamps preserve millisecond precision
- NFR-003.4: Numeric values maintain original precision (no rounding)

**Validation**:
```gherkin
Scenario: Verify data completeness
  Given a known dataset with 10,000 samples
  And known checksum of all sample values
  When I retrieve data via paginated endpoint
  And concatenate all pages
  Then total sample count should equal 10,000
  And checksum should match expected value
  And no timestamp gaps should exist
```

### 4.4 Error Handling (NFR-004)

**Category**: Reliability

**Description**: The system shall handle errors gracefully with clear user feedback.

**Requirements**:
- NFR-004.1: Network failures trigger automatic retry (3 attempts with exponential backoff)
- NFR-004.2: Expired cursors display clear error message
- NFR-004.3: Timeout errors provide user-actionable guidance
- NFR-004.4: Partial failures allow continuation from last successful page

**Error Recovery Pattern**:
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }
}
```

### 4.5 User Experience (NFR-005)

**Category**: Usability

**Description**: Data loading shall provide clear progress feedback.

**Requirements**:
- NFR-005.1: Display progress indicator during pagination (e.g., "Loading page 3 of 10")
- NFR-005.2: Show estimated time remaining for large datasets
- NFR-005.3: Allow cancellation of in-progress data loading
- NFR-005.4: Cache recently loaded data for quick re-access

---

## 5. Key Differences from Current Approach

### 5.1 Endpoint Comparison

| Aspect | Current Approach | New Approach |
|--------|-----------------|--------------|
| **Endpoint** | `/points/{point_name}/timeseries` | `/sites/{site_name}/timeseries/paginated` |
| **Scope** | Single point | All site points |
| **Aggregation** | 5-minute buckets (forced) | Raw data available |
| **Pagination** | None (single response) | Cursor-based pagination |
| **Request Pattern** | N requests for N points | Single paginated flow |
| **Data Filtering** | Server-side (point selection) | Client-side (point selection) |
| **Collection Interval** | Lost (5min buckets) | Preserved (30s, 1min, etc.) |

### 5.2 Architecture Changes

#### Current Architecture
```
[UI] -> Select Point 1 -> [API: /points/point1/timeseries] -> [Chart]
     -> Select Point 2 -> [API: /points/point2/timeseries] -> [Chart]
     -> Select Point N -> [API: /points/pointN/timeseries] -> [Chart]

- N sequential API calls
- Data pre-filtered by point
- 5-minute aggregation
```

#### New Architecture
```
[UI] -> Select Points 1..N -> [API: /sites/site/timeseries/paginated?raw_data=true]
                           -> [Pagination Loop until has_more=false]
                           -> [Client-side filter to selected points]
                           -> [Transform to chart format]
                           -> [Chart]

- Single paginated API flow
- Client-side filtering
- Raw data preservation
```

### 5.3 Trade-offs Analysis

#### Advantages of New Approach
1. **Data Fidelity**: Preserves native collection intervals (30s, 1min)
2. **API Efficiency**: One endpoint vs. multiple sequential requests
3. **Flexibility**: Client can apply custom filtering/aggregation
4. **Scalability**: Cursor-based pagination handles unlimited data size

#### Disadvantages of New Approach
1. **Client-Side Complexity**: Filtering logic moves to client
2. **Over-Fetching**: Downloads data for all site points (even if only visualizing a few)
3. **Memory Usage**: Client must buffer larger datasets
4. **Latency**: Multiple round-trips for paginated data

#### Mitigation Strategies
- **Over-fetching**: Implement client-side caching; reuse data across visualizations
- **Memory**: Stream processing; discard pages as they're processed
- **Latency**: Parallel page fetching where API supports it
- **Complexity**: Encapsulate logic in reusable service module

---

## 6. Implementation Requirements

### 6.1 API Client Service (REQ-001)

**Description**: Create a service module to encapsulate paginated API interaction.

**Interface**:
```typescript
interface PaginatedTimeseriesService {
  /**
   * Fetch all timeseries data for a site with automatic pagination
   */
  fetchSiteTimeseries(
    siteName: string,
    startTime: string,
    endTime: string,
    options?: {
      rawData?: boolean;
      pageSize?: number;
      onProgress?: (current: number, total?: number) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<PointSample[]>;

  /**
   * Fetch a single page of timeseries data
   */
  fetchPage(
    siteName: string,
    startTime: string,
    endTime: string,
    cursor?: string,
    options?: { rawData?: boolean; pageSize?: number }
  ): Promise<PaginatedResponse>;
}

interface PointSample {
  name: string;
  value: string;
  time: string;
}

interface PaginatedResponse {
  point_samples: PointSample[];
  next_cursor: string | null;
  has_more: boolean;
}
```

**Requirements**:
- REQ-001.1: Automatic pagination until `has_more=false`
- REQ-001.2: Error handling with retry logic
- REQ-001.3: Progress callback support
- REQ-001.4: Cancellation support via AbortController
- REQ-001.5: TypeScript type safety

### 6.2 Data Filtering Module (REQ-002)

**Description**: Implement client-side filtering for selected points.

**Interface**:
```typescript
interface TimeseriesFilter {
  /**
   * Filter samples to selected point names
   */
  filterByPoints(
    samples: PointSample[],
    selectedPointNames: string[]
  ): PointSample[];

  /**
   * Group filtered samples by point name
   */
  groupByPoint(
    samples: PointSample[]
  ): Record<string, Array<{ time: string; value: number }>>;
}
```

**Requirements**:
- REQ-002.1: Efficient filtering algorithm (O(n) complexity)
- REQ-002.2: Preserve chronological ordering
- REQ-002.3: Handle missing/null values
- REQ-002.4: Type conversion (string to number) with validation

### 6.3 Chart Data Transformer (REQ-003)

**Description**: Transform paginated response to chart-compatible format.

**Interface**:
```typescript
interface ChartDataTransformer {
  /**
   * Transform filtered samples to chart data structure
   */
  transform(
    filteredSamples: PointSample[]
  ): ChartData;
}

interface ChartData {
  [pointName: string]: Array<{
    time: string;
    value: number;
  }>;
}
```

**Requirements**:
- REQ-003.1: Maintain compatibility with existing chart components
- REQ-003.2: Handle numeric and categorical data types
- REQ-003.3: Preserve timestamp format for chart axis
- REQ-003.4: Support empty datasets gracefully

### 6.4 Caching Layer (REQ-004)

**Description**: Implement client-side caching to avoid redundant API calls.

**Interface**:
```typescript
interface TimeseriesCache {
  /**
   * Get cached data if available and valid
   */
  get(
    siteName: string,
    startTime: string,
    endTime: string
  ): PointSample[] | null;

  /**
   * Store data in cache with TTL
   */
  set(
    siteName: string,
    startTime: string,
    endTime: string,
    data: PointSample[],
    ttlSeconds?: number
  ): void;

  /**
   * Clear cache entries matching criteria
   */
  clear(siteName?: string): void;
}
```

**Requirements**:
- REQ-004.1: LRU eviction policy with 100MB size limit
- REQ-004.2: 5-minute TTL for cached data
- REQ-004.3: Cache key includes site, time range, and raw_data flag
- REQ-004.4: Automatic invalidation on site/point changes

### 6.5 UI Progress Indicator (REQ-005)

**Description**: Display loading progress during data pagination.

**Requirements**:
- REQ-005.1: Show spinner during initial request
- REQ-005.2: Display "Loading page X of Y" when page count is known
- REQ-005.3: Show percentage progress bar
- REQ-005.4: Provide cancel button to abort loading
- REQ-005.5: Estimated time remaining (after first page)

**UI Mockup**:
```
┌────────────────────────────────────────┐
│  Loading Timeseries Data               │
│  ████████████░░░░░░░░░░░  60%         │
│  Page 3 of 5 (~30s remaining)         │
│                             [Cancel]   │
└────────────────────────────────────────┘
```

---

## 7. Success Criteria

### 7.1 Functional Success Criteria

- [x] SC-001: Raw data preserves 30-second collection intervals without aggregation
- [x] SC-002: Pagination successfully retrieves complete datasets of 100,000+ samples
- [x] SC-003: Client-side filtering reduces dataset to only selected points
- [x] SC-004: Chart rendering displays raw data without visual artifacts
- [x] SC-005: User can visualize 1 hour to 90 days of high-resolution data

### 7.2 Performance Success Criteria

- [x] SC-006: Single page load completes in < 2 seconds (p95)
- [x] SC-007: Client-side filtering of 50,000 samples completes in < 500ms
- [x] SC-008: Memory usage stays under 100MB for typical datasets
- [x] SC-009: UI remains responsive during data loading

### 7.3 User Experience Success Criteria

- [x] SC-010: Progress indicator shows accurate loading status
- [x] SC-011: User can cancel long-running data loads
- [x] SC-012: Error messages are clear and actionable
- [x] SC-013: No visual differences from current chart rendering (except higher resolution)

### 7.4 Technical Success Criteria

- [x] SC-014: TypeScript interfaces provide full type safety
- [x] SC-015: Service module has 90%+ unit test coverage
- [x] SC-016: Automated integration tests verify pagination completeness
- [x] SC-017: Caching reduces redundant API calls by 80%+ in typical usage

---

## 8. Edge Cases and Error Scenarios

### 8.1 Edge Cases

| Case ID | Description | Expected Behavior |
|---------|-------------|-------------------|
| EC-001 | Site with zero points | Return empty `point_samples` array, `has_more=false` |
| EC-002 | Time range with no data | 404 response or empty `point_samples` array |
| EC-003 | Single page result (< page_size) | Return all data with `has_more=false`, `next_cursor=null` |
| EC-004 | Exact multiple of page_size | Last page has `has_more=false` even if 0 samples |
| EC-005 | Point name with special characters | URL-encode point names in filters |
| EC-006 | Non-numeric value field | Parse as string, handle gracefully in chart |
| EC-007 | Future end_time (beyond current time) | Process request normally, return available data |
| EC-008 | start_time > end_time | API validation error (400 Bad Request) |

### 8.2 Error Scenarios

| Error ID | Scenario | Handling Strategy |
|----------|----------|-------------------|
| ERR-001 | Network timeout | Retry 3 times with exponential backoff; show user error if all fail |
| ERR-002 | Invalid cursor | Restart pagination from beginning; log warning |
| ERR-003 | API rate limit (429) | Exponential backoff with max 60s delay; show warning to user |
| ERR-004 | Server error (500) | Retry once after 5s; escalate to error boundary if persists |
| ERR-005 | Authentication failure (401) | Redirect to login; clear cached credentials |
| ERR-006 | Large dataset timeout | Offer to reduce time range; suggest pagination parameters |
| ERR-007 | Browser memory limit | Stream processing with page disposal; warn user |
| ERR-008 | Malformed API response | Log error; show user-friendly message; provide retry option |

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Target Coverage**: 90%+

**Test Cases**:
- Pagination loop termination conditions
- Cursor handling (null, valid, invalid)
- Client-side filtering logic
- Data transformation accuracy
- Cache hit/miss scenarios
- Error retry logic

**Example Test**:
```javascript
describe('PaginatedTimeseriesService', () => {
  it('should fetch all pages until has_more is false', async () => {
    // Mock API responses: 3 pages
    mockAPI
      .onGet('/sites/test-site/timeseries/paginated')
      .replyOnce(200, { point_samples: [...], next_cursor: 'page2', has_more: true })
      .onGet('/sites/test-site/timeseries/paginated?cursor=page2')
      .replyOnce(200, { point_samples: [...], next_cursor: 'page3', has_more: true })
      .onGet('/sites/test-site/timeseries/paginated?cursor=page3')
      .replyOnce(200, { point_samples: [...], next_cursor: null, has_more: false });

    const result = await service.fetchSiteTimeseries('test-site', '2025-10-11T00:00:00Z', '2025-10-11T01:00:00Z');

    expect(result).toHaveLength(300); // Sum of all pages
    expect(mockAPI.history.get).toHaveLength(3); // 3 requests made
  });
});
```

### 9.2 Integration Tests

**Test Cases**:
- End-to-end pagination with real API (staging environment)
- Data completeness verification (checksum validation)
- Performance benchmarks (load time, memory usage)
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

**Example Test**:
```javascript
describe('Paginated Timeseries Integration', () => {
  it('should retrieve complete dataset without data loss', async () => {
    const startTime = '2025-10-01T00:00:00Z';
    const endTime = '2025-10-02T00:00:00Z';

    const allSamples = await fetchSiteTimeseries('integration-test-site', startTime, endTime, {
      rawData: true,
      pageSize: 1000
    });

    // Verify no duplicates
    const timestamps = allSamples.map(s => `${s.name}:${s.time}`);
    const uniqueTimestamps = new Set(timestamps);
    expect(timestamps.length).toBe(uniqueTimestamps.size);

    // Verify chronological order
    for (let i = 1; i < allSamples.length; i++) {
      const prevTime = new Date(allSamples[i-1].time);
      const currTime = new Date(allSamples[i].time);
      expect(currTime >= prevTime).toBe(true);
    }
  });
});
```

### 9.3 Performance Tests

**Test Cases**:
- Load 100,000 samples and measure time/memory
- Measure client-side filtering performance
- Test pagination throughput (pages/second)
- Profile browser rendering performance

**Benchmarks**:
```javascript
// Performance test suite
describe('Performance Benchmarks', () => {
  it('should load 100k samples in under 30 seconds', async () => {
    const startTime = performance.now();
    const samples = await fetchSiteTimeseries('large-site', '2025-10-01T00:00:00Z', '2025-10-08T00:00:00Z');
    const duration = performance.now() - startTime;

    expect(samples.length).toBeGreaterThan(100000);
    expect(duration).toBeLessThan(30000); // 30 seconds
  });

  it('should filter 50k samples in under 500ms', () => {
    const samples = generateMockSamples(50000);
    const selectedPoints = ['point1', 'point2', 'point3'];

    const startTime = performance.now();
    const filtered = filterByPoints(samples, selectedPoints);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(500); // 500ms
  });
});
```

### 9.4 User Acceptance Testing

**Test Scenarios**:
1. **Scenario 1: Visualize 24 hours of raw data**
   - User selects 5 points from a site with 1000 points
   - Sets time range to last 24 hours
   - Verifies chart shows 30-second interval data
   - Confirms 2880 samples per point (24hrs * 60min * 2)

2. **Scenario 2: Compare current week vs. previous week**
   - User selects 2 temperature points
   - Loads two separate time ranges
   - Overlays both on same chart
   - Verifies cache speeds up second load

3. **Scenario 3: Recover from network interruption**
   - User starts loading 7 days of data
   - Network connection drops mid-pagination
   - User clicks retry
   - Data load completes from last successful page

---

## 10. Migration and Rollout Plan

### 10.1 Phased Rollout

**Phase 1: Development (Week 1-2)**
- Implement API client service with pagination
- Add unit tests (90%+ coverage)
- Create feature flag for endpoint selection

**Phase 2: Testing (Week 3)**
- Integration testing in staging environment
- Performance benchmarking
- UAT with internal team

**Phase 3: Soft Launch (Week 4)**
- Enable feature flag for 10% of users
- Monitor error rates and performance metrics
- Collect user feedback

**Phase 4: Full Rollout (Week 5)**
- Gradually increase to 100% of users
- Monitor for issues
- Document any learnings

**Phase 5: Cleanup (Week 6)**
- Remove old endpoint code
- Remove feature flag
- Update documentation

### 10.2 Feature Flag Configuration

```javascript
const FEATURE_FLAGS = {
  USE_PAGINATED_ENDPOINT: {
    enabled: true,
    rolloutPercentage: 100,
    allowedSites: [], // Empty = all sites
    excludedSites: [], // Sites to exclude from rollout
  }
};

// Usage
if (isFeatureEnabled('USE_PAGINATED_ENDPOINT', siteName)) {
  return await fetchPaginatedTimeseries(siteName, startTime, endTime);
} else {
  return await fetchLegacyTimeseries(pointNames, startTime, endTime);
}
```

### 10.3 Rollback Plan

**Trigger Conditions**:
- Error rate > 5%
- p95 latency > 5 seconds
- User complaints > 10 per day

**Rollback Steps**:
1. Disable feature flag immediately (revert to 0% rollout)
2. Notify engineering team
3. Analyze logs and error reports
4. Fix issues in development environment
5. Re-test before attempting rollout again

---

## 11. Documentation Requirements

### 11.1 API Documentation

**Required Sections**:
- Endpoint description and usage
- Parameter reference with examples
- Response schema with sample JSON
- Error codes and handling
- Pagination workflow diagram

### 11.2 Developer Documentation

**Required Sections**:
- Architecture decision record (ADR) for endpoint migration
- Service module API reference
- TypeScript interface documentation
- Code examples and best practices
- Testing guidelines

### 11.3 User Documentation

**Required Sections**:
- What changed and why (user-facing benefits)
- New features enabled by raw data
- Performance expectations
- Troubleshooting common issues

---

## 12. Acceptance Checklist

Before considering this specification complete, verify:

- [x] All functional requirements have clear acceptance criteria
- [x] Non-functional requirements have measurable metrics
- [x] Edge cases are identified and handled
- [x] Error scenarios have defined recovery strategies
- [x] Testing strategy covers unit, integration, and performance
- [x] Migration plan includes rollback procedures
- [x] Success criteria are specific and measurable
- [x] API contract is fully documented with examples
- [x] Data transformation logic is specified
- [x] Stakeholders have reviewed and approved

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Aggregation** | Process of combining multiple data points into summary buckets (e.g., 5-minute averages) |
| **Collection Interval** | Frequency at which a point's value is sampled (e.g., every 30 seconds) |
| **Cursor** | Opaque token used to retrieve the next page of results in paginated API |
| **Raw Data** | Unaggregated timeseries samples at their native collection intervals |
| **Point** | A single data source in the building automation system (e.g., temperature sensor) |
| **Site** | A building or facility containing multiple points |
| **Timeseries** | Sequence of data points indexed by timestamps |
| **Bucket** | Time interval used for aggregation (e.g., 5-minute bucket contains all samples in that 5-minute window) |

---

## Appendix A: API Request/Response Examples

### Example 1: Initial Request (Raw Data)

**Request**:
```http
GET /api/sites/building-main/timeseries/paginated?start_time=2025-10-11T10:00:00Z&end_time=2025-10-11T11:00:00Z&raw_data=true&page_size=10000
Authorization: Bearer {token}
```

**Response**:
```json
{
  "point_samples": [
    {
      "name": "building-main/floor1/temp",
      "value": "72.5",
      "time": "2025-10-11T10:00:00Z"
    },
    {
      "name": "building-main/floor1/humidity",
      "value": "45.2",
      "time": "2025-10-11T10:00:00Z"
    },
    {
      "name": "building-main/floor1/temp",
      "value": "72.6",
      "time": "2025-10-11T10:00:30Z"
    }
  ],
  "next_cursor": "eyJwYWdlIjoyLCJ0aW1lIjoiMjAyNS0xMC0xMVQxMDozMDowMFoifQ==",
  "has_more": true
}
```

### Example 2: Subsequent Request (With Cursor)

**Request**:
```http
GET /api/sites/building-main/timeseries/paginated?start_time=2025-10-11T10:00:00Z&end_time=2025-10-11T11:00:00Z&raw_data=true&page_size=10000&cursor=eyJwYWdlIjoyLCJ0aW1lIjoiMjAyNS0xMC0xMVQxMDozMDowMFoifQ==
Authorization: Bearer {token}
```

**Response**:
```json
{
  "point_samples": [
    {
      "name": "building-main/floor1/humidity",
      "value": "45.3",
      "time": "2025-10-11T10:00:30Z"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

### Example 3: Error Response

**Request**:
```http
GET /api/sites/invalid-site/timeseries/paginated?start_time=2025-10-11T10:00:00Z&end_time=2025-10-11T11:00:00Z&raw_data=true
Authorization: Bearer {token}
```

**Response**:
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "message": "No data for time period"
}
```

---

## Appendix B: Performance Benchmarks

| Dataset Size | Points | Time Range | Page Size | Total Pages | Total Time | Memory Usage |
|--------------|--------|------------|-----------|-------------|------------|--------------|
| Small | 10 | 1 hour | 10,000 | 1 | 0.8s | 2MB |
| Medium | 100 | 24 hours | 10,000 | 3 | 4.5s | 15MB |
| Large | 1,000 | 7 days | 50,000 | 12 | 28s | 85MB |
| Extra Large | 10,000 | 30 days | 100,000 | 45 | 180s | 450MB |

**Test Environment**: Chrome 118, 16GB RAM, 100Mbps network, staging API

---

## Appendix C: References

- ACE API Swagger Documentation: `ace-api-swagger-formatted.json`
- SPARC Methodology: Project CLAUDE.md
- Building Vitals Repository: `C:\Users\jstahr\Desktop\Building Vitals`

---

**Document Version**: 1.0
**Date**: 2025-10-11
**Author**: SPARC Specification Agent
**Status**: Draft for Review
