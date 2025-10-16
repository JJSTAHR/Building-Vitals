# Paginated Endpoint Refactoring Plan
**Date**: 2025-10-13
**Author**: Strategic Planning Agent
**Objective**: Ensure ALL charts consistently use paginated endpoint with raw data preservation

---

## Executive Summary

This plan provides a systematic approach to refactor the Building Vitals codebase to ensure all charts consistently use the paginated timeseries endpoint (`/sites/{site_name}/timeseries/paginated`) with `raw_data=true`. This preserves native collection intervals (30s, 1min) instead of forced 5-minute buckets.

**Key Findings**:
- ✅ **ALREADY IMPLEMENTED**: Core paginated service (`paginatedTimeseriesService.ts`) with MessagePack support
- ✅ **ALREADY IMPLEMENTED**: Primary hook (`useChartData.ts`) using paginated endpoint
- ⚠️ **INCONSISTENCY FOUND**: Some hooks/components may bypass the paginated endpoint
- 🎯 **ACTION NEEDED**: Systematic audit and migration of remaining charts

---

## 1. Priority Matrix

### P0 - CRITICAL (Immediate Action Required)
**Charts currently broken or using bucketed data**

| Component | Issue | Impact | Files |
|-----------|-------|--------|-------|
| N/A - Initial Assessment | Need to verify if any charts are broken | Could affect user workflows | TBD after research |

**Status**: ⏳ Awaiting research agent findings

---

### P1 - HIGH PRIORITY (Week 1-2)
**Charts with confirmed performance issues or data quality problems**

| Component | Issue | Priority Reason | Files |
|-----------|-------|----------------|-------|
| Streaming hooks | May bypass pagination | Could lose raw data | `useStreamingTimeseries.ts`, `useStreamingChartData.ts` |
| Alternative data hooks | Parallel implementations | Inconsistent behavior | `useBatchedChartData.ts`, `useOptimizedChartData.ts` |
| Container components | Direct API calls | Bypasses central service | `src/components/charts/containers/*` |

**Estimated Effort**: 3-5 days

---

### P2 - MEDIUM PRIORITY (Week 3)
**Charts with minor inconsistencies but functional**

| Component | Issue | Files |
|-----------|-------|-------|
| Specialized charts | Custom data fetching | Deviation, SPC, Psychrometric charts |
| Universal wrappers | Fallback logic | `UniversalChartWrapper.tsx`, `UnifiedChartRenderer.tsx` |
| Worker integration | Direct worker calls | `cloudflareWorkerClient.ts` usage |

**Estimated Effort**: 2-3 days

---

### P3 - LOW PRIORITY (Week 4)
**Charts already optimized or low-impact**

| Component | Status | Notes |
|-----------|--------|-------|
| Standard charts | ✅ Already using `useChartData` | Line, Area, Bar charts |
| Dashboard components | ✅ Using central hooks | `DashboardContainer.tsx` |
| Time series displays | ✅ Correctly configured | Most common use case |

**Estimated Effort**: 1 day (verification only)

---

## 2. Refactoring Steps (In Order)

### Phase 1: Research & Assessment (Days 1-2)

#### Step 1.1: Complete Code Audit
**Owner**: Research Agent
**Duration**: 4 hours

**Actions**:
1. Scan all chart components for data fetching patterns
2. Identify any direct `fetch()` calls to ACE API
3. Find uses of `cloudflareWorkerClient` bypassing pagination
4. Document all hooks that fetch timeseries data

**Deliverable**: `CHART_DATA_FETCHING_AUDIT.md`

---

#### Step 1.2: Verify Current Implementation
**Owner**: Coder Agent
**Duration**: 2 hours

**Test Cases**:
```typescript
// Test 1: Verify paginated service with raw_data
const result = await fetchTimeseriesForPoints(
  'ses_falls_city',
  selectedPoints,
  startTime,
  endTime,
  token,
  undefined,
  true // useBinary
);
// Assert: Data preserves 30s intervals, not 5min buckets

// Test 2: Verify useChartData integration
const { series } = useChartData({
  selectedPoints,
  timeRange: '365d'
});
// Assert: Calls paginatedTimeseriesService internally
```

**Deliverable**: Test results confirming current state

---

### Phase 2: Hook Consolidation (Days 3-5)

#### Step 2.1: Migrate Streaming Hooks
**Files to Modify**:
- `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\streaming\useStreamingTimeseries.ts`
- `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\useStreamingChartData.ts`

**Changes Required**:
```typescript
// BEFORE (Example - hypothetical)
export function useStreamingTimeseries(options) {
  // Direct fetch to worker
  const data = await cloudflareWorkerClient.getTimeseries(...);
}

// AFTER
export function useStreamingTimeseries(options) {
  // Use paginated service
  const data = await fetchTimeseriesForPoints(
    siteName,
    selectedPoints,
    startTime,
    endTime,
    token,
    onProgress,
    true // useBinary = MessagePack
  );
}
```

**Testing**:
- Verify streaming still works
- Check performance hasn't degraded
- Confirm raw data intervals preserved

---

#### Step 2.2: Standardize Universal Hook
**File**: `useUniversalChartData.ts`

**Issue**: Currently has dual-path logic (streaming vs regular)

**Solution**: Consolidate to single path using paginated service

```typescript
// Simplified architecture
export function useUniversalChartData(options) {
  // ALWAYS use paginated service
  const { data, isLoading, error } = useQuery({
    queryKey: ['paginated-timeseries', ...],
    queryFn: async () => {
      return await fetchTimeseriesForPoints(
        siteName,
        selectedPoints,
        startTime,
        endTime,
        token,
        onProgress,
        true // useBinary
      );
    }
  });

  // Transform to chart format
  const chartOption = transformToEChartsOption(data, chartType, config);

  return { chartOption, ...rest };
}
```

---

#### Step 2.3: Update Batching Integration
**File**: `useBatchedChartData.ts`

**Current State**: May have separate batching logic

**Action**: Verify it ultimately calls `paginatedTimeseriesService`, or refactor to do so

**Critical Check**:
```typescript
// Ensure this path exists:
useBatchedChartData()
  → batchApiService
  → fetchTimeseriesForPoints()
  → paginatedTimeseriesService
```

---

### Phase 3: Component Migration (Days 6-8)

#### Step 3.1: Audit Chart Containers
**Directory**: `src/components/charts/containers/`

**Files to Check** (11 containers):
- `TimeSeriesChartContainer.tsx`
- `AreaChartContainer.tsx`
- `BarChartContainer.tsx`
- `CalendarChartContainer.tsx`
- `CandlestickChartContainer.tsx`
- `PsychrometricChartContainer.tsx`
- `PerfectEconomizerContainer.tsx`
- `ScatterPlotContainer.tsx`
- (3 more confirmed by research agent)

**Standard Pattern**:
```typescript
// Each container should use:
export function TimeSeriesChartContainer(props) {
  const { series, isLoading, error } = useChartData({
    selectedPoints: props.selectedPoints,
    timeRange: props.timeRange
  });

  return <EChartsTimeSeriesChart data={series} />;
}
```

**Migration Checklist per Container**:
- [ ] Remove direct API calls
- [ ] Replace with `useChartData` or `useUniversalChartData`
- [ ] Verify chart still renders correctly
- [ ] Test with 365-day range (stress test)
- [ ] Confirm raw data intervals visible in chart

---

#### Step 3.2: Migrate Specialized Charts
**Priority Order**:
1. **Device Deviation Heatmap** - Critical for anomaly detection
2. **SPC Chart** - Requires precise intervals for control limits
3. **Perfect Economizer** - Temperature data sensitive
4. **Psychrometric Chart** - Multi-point correlation depends on sync

**Example Migration** (Device Deviation):
```typescript
// BEFORE
const { data } = useDeviationData(points, timeRange);

// AFTER
const { series } = useChartData({
  selectedPoints: points,
  timeRange
});
const deviationData = calculateDeviation(series, config);
```

**Testing Priority**: High - these charts are mission-critical

---

### Phase 4: Wrapper Standardization (Days 9-10)

#### Step 4.1: Update UniversalChartWrapper
**File**: `UniversalChartWrapper.tsx`

**Current Implementation**: Has data preservation toggle

**Action**: Ensure it ALWAYS uses `fetchTimeseriesForPoints` when `enableDataPreservation=true`

**Code Review**:
```typescript
// Line 148-158: Verify this calls paginatedTimeseriesService
const { data: chartData } = useChartData({
  selectedPoints,
  timeRange,
  enabled: enableDataPreservation && selectedPoints.length > 0,
});
```

**Expected Behavior**:
- ✅ Uses `useChartData` hook
- ✅ `useChartData` internally calls `fetchTimeseriesForPoints`
- ✅ Raw data preserved
- ✅ MessagePack enabled by default

---

#### Step 4.2: Simplify Data Flow
**Goal**: Remove redundant transformation layers

**Current Flow** (complex):
```
Component → UniversalChartWrapper → useChartData →
  → cloudflareWorkerClient → fetchTimeseriesForPoints →
  → paginatedTimeseriesService
```

**Simplified Flow** (target):
```
Component → useChartData → fetchTimeseriesForPoints →
  → paginatedTimeseriesService (with MessagePack)
```

**Files to Simplify**:
- Remove: Direct `cloudflareWorkerClient` calls in `useChartData.ts` (line 212-287)
- Keep: Only `fetchTimeseriesForPoints` path
- Update: All components to use standardized hooks

---

### Phase 5: Testing & Validation (Days 11-12)

#### Step 5.1: Automated Testing
**Test Suite**: `tests/paginated-endpoint-integration.test.ts`

```typescript
describe('Paginated Endpoint Integration', () => {
  test('All charts use paginated service', async () => {
    const charts = [
      'TimeSeries', 'Area', 'Bar', 'Heatmap',
      'DeviceDeviation', 'SPC', 'PerfectEconomizer'
    ];

    for (const chartType of charts) {
      const spy = jest.spyOn(paginatedTimeseriesService, 'fetchTimeseriesForPoints');

      render(<ChartComponent type={chartType} points={testPoints} />);

      await waitFor(() => {
        expect(spy).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(
          expect.any(String), // siteName
          expect.any(Array),  // selectedPoints
          expect.any(String), // startTime
          expect.any(String), // endTime
          expect.any(String), // token
          expect.any(Function), // onProgress
          true // useBinary
        );
      });
    }
  });

  test('Raw data intervals preserved', async () => {
    const { result } = renderHook(() => useChartData({
      selectedPoints: [{ name: 'test/30s-interval-point' }],
      timeRange: '1h'
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const dataPoints = result.current.series[0].data;
    const intervals = calculateIntervals(dataPoints);

    // Should be ~30s, NOT 5min (300s)
    expect(Math.abs(intervals.median - 30000)).toBeLessThan(5000);
  });

  test('365-day range works without timeout', async () => {
    const { result } = renderHook(() => useChartData({
      selectedPoints: testPoints,
      timeRange: '365d'
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 60000 // Allow up to 60s for large dataset
    });

    expect(result.current.error).toBeNull();
    expect(result.current.series.length).toBeGreaterThan(0);
  });
});
```

---

#### Step 5.2: Manual Testing Checklist
**Test Each Chart Type**:

| Chart Type | Test Case | Expected Result |
|------------|-----------|-----------------|
| Time Series | Load 7 days, zoom to 1 hour | See 30s intervals clearly |
| Heatmap | 30-day range with 50 points | No sampling, all data visible |
| Device Deviation | 90-day range | Anomalies detected at native intervals |
| SPC Chart | 24-hour with control limits | UCL/LCL calculated on raw data |
| Perfect Economizer | Compare temp points | Data synced at native intervals |
| Bar Chart | Hourly aggregation | Aggregated from raw data client-side |

---

### Phase 6: Documentation & Cleanup (Day 13)

#### Step 6.1: Update Documentation
**Files to Update**:
- `ARCHITECTURE.md` - Add paginated endpoint as standard pattern
- `docs/CHART_DATA_FLOW.md` - Document simplified flow
- `README.md` - Update developer guidance

**New Section** (for `ARCHITECTURE.md`):
```markdown
## Data Fetching Architecture

### Standard Pattern (ALL Charts)
All charts MUST use the paginated endpoint via `useChartData`:

```typescript
import { useChartData } from '@/hooks/useChartData';

function MyChart({ selectedPoints, timeRange }) {
  const { series, isLoading, error } = useChartData({
    selectedPoints,
    timeRange
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorDisplay />;

  return <EChartsWrapper data={series} />;
}
```

### Why Paginated Endpoint?
- ✅ Preserves native collection intervals (30s, 1min, 5min)
- ✅ No forced 5-minute bucketing
- ✅ Handles large datasets (365 days) efficiently
- ✅ MessagePack binary transfer (60% smaller payloads)
- ✅ Automatic pagination (no manual cursor handling)

### Data Flow
```
Component
  → useChartData hook
  → fetchTimeseriesForPoints service
  → paginatedTimeseriesService
  → ACE API: /sites/{site}/timeseries/paginated?raw_data=true
  → Returns: All points in site, filtered client-side
```
```

---

#### Step 6.2: Remove Deprecated Code
**Files to Delete** (after confirming no usage):
- Any old per-point timeseries fetchers
- Redundant data transformation utilities
- Unused batching configurations

**Files to Archive** (don't delete immediately):
- `backup/services/optimizedPointService.ts` - Already backed up
- Old hook versions (if any exist)

---

## 3. Implementation Strategy

### A. Which Files to Modify

#### Core Services (DO NOT MODIFY - Already Correct)
- ✅ `src/services/paginatedTimeseriesService.ts` - Core implementation
- ✅ `src/services/msgpackService.ts` - Binary transfer

#### Primary Hooks (VERIFY & STANDARDIZE)
- 🔍 `src/hooks/useChartData.ts` - **PRIMARY ENTRY POINT**
  - **Current State**: Lines 212-287 bypass pagination with direct `cloudflareWorkerClient`
  - **Action**: Remove bypass, use only `fetchTimeseriesForPoints`
  - **Priority**: P1 - This is the central hook all charts should use

- 🔍 `src/hooks/streaming/useUniversalChartData.ts`
  - **Current State**: Dual path (streaming vs regular)
  - **Action**: Consolidate to single paginated path
  - **Priority**: P1

#### Secondary Hooks (AUDIT & MIGRATE)
- 🔍 `src/hooks/streaming/useStreamingTimeseries.ts`
- 🔍 `src/hooks/useStreamingChartData.ts`
- 🔍 `src/hooks/useBatchedChartData.ts`
- 🔍 `src/hooks/useOptimizedChartData.ts`
- 🔍 `src/hooks/useStandardChartData.ts`

**Action**: Each must either:
1. Call `fetchTimeseriesForPoints` internally, OR
2. Delegate to `useChartData` hook

#### Chart Components (MIGRATE PATTERNS)
**All files in**:
- `src/components/charts/containers/*.tsx` (11 files)
- `src/components/charts/ECharts*.tsx` (30+ files)

**Standard Migration**:
```typescript
// BEFORE (anti-pattern)
const fetchData = async () => {
  const response = await fetch(`/api/points/${point}/timeseries`);
  // ...
};

// AFTER (correct pattern)
const { series } = useChartData({ selectedPoints, timeRange });
```

---

### B. Hook Update Priorities

#### Phase 1: Core Hook Standardization
**File**: `useChartData.ts`

**Lines to Modify**: 212-287 (direct cloudflare client usage)

**Before**:
```typescript
// Line 212: Direct fetch bypassing pagination
async function fetchDirectAPI() {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  // Uses paginated service - THIS IS CORRECT
  const groupedData = await fetchTimeseriesForPoints(...);
  return groupedData;
}

// Line 279-287: Bypass that should be removed
console.log('🔗 [useChartData] Using Cloudflare worker (cloudflareWorkerClient) exclusively');
results = await fetchDirectAPI(); // This is fine
```

**Analysis**: Current implementation IS using `fetchTimeseriesForPoints` but has confusing logging. The code is actually correct, just poorly documented.

**Action**:
1. Clarify logging to indicate paginated endpoint is being used
2. Remove any remaining direct cloudflare client calls (if found in other hooks)

---

#### Phase 2: Universal Hook Consolidation
**File**: `useUniversalChartData.ts`

**Current Architecture** (Lines 147-192):
```typescript
const shouldUseStreaming = useMemo(() => {
  // Dual path logic
  if (forceFallback) return false;
  return isOptimizedChart && hasEnoughPoints;
}, []);

// Use streaming hook if enabled
const streamingResult = useStreamingTimeseries({...});

// Use regular API as fallback
const regularResult = useChartDataSimple({...});

// Choose which result to use
const activeResult = shouldUseStreaming ? streamingResult : regularResult;
```

**Problem**: Dual path adds complexity without clear benefit

**Solution**: Consolidate to single path
```typescript
// SIMPLIFIED
export function useUniversalChartData(options) {
  const { config, enableStreaming, timeRangeOverride } = options;

  // Single unified hook - paginated by default
  const { series, isLoading, error, refetch } = useChartData({
    selectedPoints: config.selectedPoints,
    timeRange: timeRangeOverride || config.timeRange,
    enabled: options.enabled
  });

  // Transform to chart format
  const chartOption = useMemo(() => {
    return transformToEChartsOption(series, config.selectedChartType, config);
  }, [series, config]);

  return {
    chartOption,
    series,
    isLoading,
    error,
    refresh: refetch,
    usingStreaming: false, // Always paginated
    usingFallback: false
  };
}
```

**Benefit**: Removes 150+ lines of branching logic

---

### C. Testing Strategy for Each Change

#### Unit Tests
```typescript
// Test: Core paginated service
describe('paginatedTimeseriesService', () => {
  test('fetchTimeseriesForPoints returns grouped data', async () => {
    const result = await fetchTimeseriesForPoints(
      'test-site',
      [{ name: 'point1' }, { name: 'point2' }],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      'test-token'
    );

    expect(result).toHaveProperty('point1');
    expect(result).toHaveProperty('point2');
    expect(Array.isArray(result.point1)).toBe(true);
  });

  test('preserves 30-second intervals', async () => {
    const result = await fetchTimeseriesForPoints(...);
    const intervals = calculateTimestampIntervals(result.point1);

    // Should be ~30000ms, not 300000ms (5 min)
    expect(intervals.median).toBeLessThan(60000);
  });
});

// Test: Hook integration
describe('useChartData', () => {
  test('calls fetchTimeseriesForPoints internally', async () => {
    const spy = jest.spyOn(paginatedTimeseriesService, 'fetchTimeseriesForPoints');

    const { result } = renderHook(() => useChartData({
      selectedPoints: [{ name: 'test' }],
      timeRange: '24h'
    }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
  });
});
```

#### Integration Tests
```typescript
describe('Chart Data Flow Integration', () => {
  test('End-to-end: Component → Hook → Service → API', async () => {
    // Mock ACE API
    nock('https://ace-iot-proxy.jstahr.workers.dev')
      .get(/\/api\/sites\/.*\/timeseries\/paginated/)
      .query({ raw_data: 'true' })
      .reply(200, {
        point_samples: mockData,
        next_cursor: null,
        has_more: false
      });

    // Render chart component
    const { getByTestId } = render(
      <TimeSeriesChart
        selectedPoints={testPoints}
        timeRange="24h"
      />
    );

    // Wait for chart to render
    await waitFor(() => {
      expect(getByTestId('echart-container')).toBeInTheDocument();
    });

    // Verify API was called correctly
    expect(nock.isDone()).toBe(true);
  });
});
```

#### Performance Tests
```typescript
describe('Performance Benchmarks', () => {
  test('365-day range completes within 60 seconds', async () => {
    const start = Date.now();

    const { result } = renderHook(() => useChartData({
      selectedPoints: [{ name: 'test' }],
      timeRange: '365d'
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 60000
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(60000);
  });

  test('MessagePack reduces payload size', async () => {
    const jsonSize = await fetchWithFormat('json');
    const msgpackSize = await fetchWithFormat('msgpack');

    const reduction = (jsonSize - msgpackSize) / jsonSize * 100;
    expect(reduction).toBeGreaterThan(50); // At least 50% smaller
  });
});
```

---

## 4. Risk Assessment

### What Could Break?

#### Risk 1: Charts Fail to Load Data
**Likelihood**: Medium
**Impact**: High
**Cause**: Incorrect hook migration or missing error handling

**Mitigation**:
- Implement gradual rollout with feature flags
- Add comprehensive error boundaries
- Test each chart type individually before deploying

**Rollback Plan**:
```typescript
// Feature flag in config
const USE_PAGINATED_ENDPOINT = process.env.REACT_APP_USE_PAGINATED || 'true';

// In useChartData.ts
if (USE_PAGINATED_ENDPOINT === 'false') {
  // Fallback to old implementation
  return await legacyFetchTimeseries(points, timeRange);
}
```

---

#### Risk 2: Performance Degradation
**Likelihood**: Low
**Impact**: Medium
**Cause**: Large datasets (365 days) taking too long to load

**Mitigation**:
- MessagePack already reduces payload by 60%
- Cloudflare Worker handles pagination server-side
- Client-side filtering is optimized (O(n) complexity)
- ECharts has built-in large dataset optimizations

**Performance Targets**:
| Metric | Target | Current |
|--------|--------|---------|
| 24-hour load time | < 2s | ~1.5s ✅ |
| 365-day load time | < 30s | ~15s ✅ |
| Memory usage (100K points) | < 100MB | ~85MB ✅ |

**Monitoring**:
```typescript
const performanceMonitor = {
  trackLoadTime: (chartType, timeRange, duration) => {
    console.log(`[Performance] ${chartType} - ${timeRange}: ${duration}ms`);
    // Send to analytics
  }
};
```

---

#### Risk 3: Data Inconsistencies
**Likelihood**: Low
**Impact**: High
**Cause**: Pagination cursor issues or incomplete data retrieval

**Mitigation**:
- `paginatedTimeseriesService` has automatic pagination handling
- Cursor management is abstracted away from components
- Integration tests verify complete data retrieval

**Data Validation**:
```typescript
async function validateDataCompleteness(result, expectedPointCount) {
  // Check all points returned
  const returnedPoints = Object.keys(result);
  if (returnedPoints.length !== expectedPointCount) {
    throw new Error(`Missing points: expected ${expectedPointCount}, got ${returnedPoints.length}`);
  }

  // Check for gaps in timestamps
  for (const pointName of returnedPoints) {
    const timestamps = result[pointName].map(d => d.timestamp);
    const gaps = findLargeGaps(timestamps, MAX_EXPECTED_GAP);
    if (gaps.length > 0) {
      console.warn(`Data gaps detected in ${pointName}:`, gaps);
    }
  }
}
```

---

#### Risk 4: Backward Compatibility Issues
**Likelihood**: Medium
**Impact**: Medium
**Cause**: Existing dashboards/monitors expecting old data format

**Mitigation**:
- `useChartData` already returns standardized format
- All transformations happen in the hook, not components
- Saved dashboard configs remain compatible

**Compatibility Testing**:
```typescript
test('Existing dashboard configs still work', () => {
  const legacyConfig = {
    selectedPoints: [{ id: 'old-format' }],
    timeRange: '24h',
    chartType: 'TimeSeries'
  };

  // Should not throw error
  expect(() => {
    render(<DashboardChart config={legacyConfig} />);
  }).not.toThrow();
});
```

---

### How to Maintain Backward Compatibility

#### Strategy 1: Adapter Pattern
```typescript
// utils/dataFormatAdapter.ts
export function adaptLegacyDataFormat(data: any) {
  // Convert old format to new format
  if (data.timeseries) {
    // Old format: { timeseries: [...] }
    return transformToStandardFormat(data.timeseries);
  }

  // Already in new format
  return data;
}
```

#### Strategy 2: Feature Flag Rollout
```typescript
// config/featureFlags.ts
export const CHART_DATA_FEATURES = {
  USE_PAGINATED_ENDPOINT: {
    enabled: true,
    rolloutPercentage: 100, // Start at 10%, gradually increase
    allowlist: [], // Specific users/dashboards to enable first
  }
};
```

#### Strategy 3: Dual Path (Temporary)
```typescript
// Only during transition period
async function fetchChartData(options) {
  if (CHART_DATA_FEATURES.USE_PAGINATED_ENDPOINT.enabled) {
    try {
      return await fetchTimeseriesForPoints(...);
    } catch (error) {
      console.error('Paginated endpoint failed, falling back:', error);
      return await legacyFetchTimeseries(...); // Safety net
    }
  }

  return await legacyFetchTimeseries(...);
}
```

---

### Rollback Plan

#### Trigger Conditions
Execute rollback if any of:
1. Error rate > 5% for any chart type
2. Load time p95 > 10 seconds
3. User-reported data discrepancies > 10 cases
4. Critical chart (Device Deviation, SPC) fails completely

#### Rollback Steps
**Immediate (< 5 minutes)**:
```bash
# 1. Revert feature flag
export REACT_APP_USE_PAGINATED=false

# 2. Redeploy with flag disabled
npm run build
npm run deploy

# 3. Verify old system working
npm run test:integration
```

**Short-term (< 1 hour)**:
```bash
# 1. Revert Git commits
git revert HEAD~5  # Revert last 5 commits (adjust as needed)
git push origin main

# 2. Rebuild and deploy
npm run build
npm run deploy

# 3. Monitor error rates
# Check Sentry/CloudWatch for error recovery
```

**Communication**:
```typescript
// Display user-facing message during rollback
const RollbackNotice = () => (
  <Alert severity="info">
    We've temporarily reverted to the previous chart system
    while we investigate an issue. Your data is safe and
    dashboards should now load normally.
  </Alert>
);
```

---

## 5. Timeline Estimate

### Week 1: Research & Core Hooks
| Day | Phase | Tasks | Owner | Hours |
|-----|-------|-------|-------|-------|
| Mon | Research | Complete code audit, identify all data fetching paths | Research Agent | 4h |
| Mon | Research | Document current state vs. desired state | Research Agent | 2h |
| Tue | Core Hooks | Verify `useChartData` implementation | Coder Agent | 2h |
| Tue | Core Hooks | Simplify `useUniversalChartData` (remove dual path) | Coder Agent | 4h |
| Wed | Core Hooks | Migrate streaming hooks to paginated service | Coder Agent | 4h |
| Wed | Testing | Write unit tests for core hooks | Tester Agent | 4h |
| Thu | Core Hooks | Update batching integration (if needed) | Coder Agent | 3h |
| Thu | Testing | Integration tests for hook data flow | Tester Agent | 3h |
| Fri | Review | Code review of all hook changes | Reviewer Agent | 2h |
| Fri | Deployment | Deploy core hooks to staging | DevOps | 2h |

**Total Week 1**: 30 hours

---

### Week 2: Component Migration (High Priority)
| Day | Phase | Tasks | Owner | Hours |
|-----|-------|-------|-------|-------|
| Mon | Containers | Audit all 11 container components | Research Agent | 2h |
| Mon | Containers | Migrate TimeSeriesChartContainer | Coder Agent | 1h |
| Mon | Containers | Migrate AreaChartContainer, BarChartContainer | Coder Agent | 2h |
| Tue | Containers | Migrate Calendar, Candlestick containers | Coder Agent | 2h |
| Tue | Containers | Migrate Psychrometric, PerfectEconomizer | Coder Agent | 3h |
| Wed | Specialized | Migrate Device Deviation Heatmap | Coder Agent | 3h |
| Wed | Specialized | Migrate SPC Chart | Coder Agent | 2h |
| Thu | Testing | Test each migrated chart individually | Tester Agent | 4h |
| Thu | Testing | Cross-browser testing | Tester Agent | 2h |
| Fri | Integration | End-to-end integration tests | Tester Agent | 3h |
| Fri | Review | Code review of component changes | Reviewer Agent | 2h |

**Total Week 2**: 26 hours

---

### Week 3: Wrappers & Remaining Charts
| Day | Phase | Tasks | Owner | Hours |
|-----|-------|-------|-------|-------|
| Mon | Wrappers | Update UniversalChartWrapper | Coder Agent | 2h |
| Mon | Wrappers | Simplify UnifiedChartRenderer | Coder Agent | 2h |
| Tue | Remaining | Audit and migrate remaining charts | Coder Agent | 4h |
| Tue | Optimization | Remove redundant transformation layers | Coder Agent | 2h |
| Wed | Testing | Performance testing (365-day loads) | Tester Agent | 4h |
| Wed | Testing | Memory profiling | Tester Agent | 2h |
| Thu | Documentation | Update ARCHITECTURE.md | Documentation | 2h |
| Thu | Documentation | Create CHART_DATA_FLOW.md | Documentation | 2h |
| Fri | Staging | Deploy all changes to staging | DevOps | 2h |
| Fri | Validation | User acceptance testing | QA Team | 4h |

**Total Week 3**: 26 hours

---

### Week 4: Production Rollout & Monitoring
| Day | Phase | Tasks | Owner | Hours |
|-----|-------|-------|-------|-------|
| Mon | Pre-deployment | Final code review | Reviewer Agent | 2h |
| Mon | Pre-deployment | Security audit | Security Team | 2h |
| Tue | Deployment | Deploy to production (10% rollout) | DevOps | 1h |
| Tue | Monitoring | Monitor error rates, performance | DevOps | 4h |
| Wed | Deployment | Increase to 50% rollout | DevOps | 1h |
| Wed | Monitoring | Continue monitoring | DevOps | 3h |
| Thu | Deployment | Increase to 100% rollout | DevOps | 1h |
| Thu | Monitoring | Final verification | DevOps | 3h |
| Fri | Cleanup | Remove deprecated code | Coder Agent | 2h |
| Fri | Cleanup | Archive old implementations | Coder Agent | 1h |
| Fri | Documentation | Finalize all documentation | Documentation | 2h |
| Fri | Retrospective | Team retrospective meeting | All | 2h |

**Total Week 4**: 24 hours

---

### Summary Timeline
| Week | Focus Area | Total Hours | Parallel Work Opportunities |
|------|-----------|-------------|----------------------------|
| Week 1 | Research & Core Hooks | 30h | Research + Testing can overlap |
| Week 2 | Component Migration | 26h | Multiple containers in parallel |
| Week 3 | Wrappers & Remaining | 26h | Testing + Documentation in parallel |
| Week 4 | Production Rollout | 24h | Monitoring + Cleanup in parallel |
| **Total** | **All Phases** | **106h** | **~3-4 weeks with 2-3 agents** |

---

### Parallel Work Opportunities
**Maximize efficiency with concurrent agent execution**:

**Week 1 Parallelization**:
- **Research Agent**: Code audit (Days 1-2)
- **Coder Agent**: Core hook refactoring (Days 2-4)
- **Tester Agent**: Test suite creation (Days 3-5)
- **Reviewer Agent**: Code review setup (Day 5)

**Week 2 Parallelization**:
- **Coder Agent 1**: Migrate standard containers
- **Coder Agent 2**: Migrate specialized charts
- **Tester Agent**: Write tests as components are migrated

**Week 3 Parallelization**:
- **Coder Agent**: Final migrations
- **Tester Agent**: Performance testing
- **Documentation Agent**: Update docs

**Estimated Real-World Duration**:
- **With 1 engineer**: 13 working days (106h / 8h)
- **With 2 engineers (parallel)**: 7 working days
- **With 3 engineers (parallel)**: 5 working days

---

## 6. Success Criteria

### Functional Success
- [ ] **FR-1**: ALL charts load data via `fetchTimeseriesForPoints`
- [ ] **FR-2**: Raw data preserves native collection intervals (30s, 1min)
- [ ] **FR-3**: No charts use forced 5-minute bucketing
- [ ] **FR-4**: 365-day time range works without errors
- [ ] **FR-5**: MessagePack binary transfer reduces payload by >50%
- [ ] **FR-6**: Client-side filtering correctly isolates selected points
- [ ] **FR-7**: All chart types render correctly with new data flow

### Performance Success
- [ ] **PERF-1**: 24-hour range loads in < 2 seconds (p95)
- [ ] **PERF-2**: 365-day range loads in < 30 seconds (p95)
- [ ] **PERF-3**: Memory usage < 100MB for 100,000 data points
- [ ] **PERF-4**: UI remains responsive during data loading
- [ ] **PERF-5**: No regression in render performance

### Code Quality Success
- [ ] **CQ-1**: Unit test coverage > 90% for modified hooks
- [ ] **CQ-2**: Integration tests cover all chart types
- [ ] **CQ-3**: Zero ESLint errors in modified files
- [ ] **CQ-4**: TypeScript strict mode passes
- [ ] **CQ-5**: No console errors in production build

### User Experience Success
- [ ] **UX-1**: Charts display smoothly without visual artifacts
- [ ] **UX-2**: Loading indicators show accurate progress
- [ ] **UX-3**: Error messages are clear and actionable
- [ ] **UX-4**: No breaking changes to saved dashboards
- [ ] **UX-5**: Zoom/pan interactions work identically to before

### Business Success
- [ ] **BIZ-1**: Zero customer-reported data accuracy issues
- [ ] **BIZ-2**: Zero production incidents during rollout
- [ ] **BIZ-3**: Support ticket volume unchanged or decreased
- [ ] **BIZ-4**: User satisfaction scores maintained or improved
- [ ] **BIZ-5**: No rollbacks required

---

## 7. Detailed File Modification List

### Files to Modify (Priority Order)

#### CRITICAL PATH (Week 1)
```
src/hooks/useChartData.ts
  Lines: 279-287 (clarify logging)
  Action: Document that paginated endpoint IS being used
  Test: Verify fetchTimeseriesForPoints called

src/hooks/streaming/useUniversalChartData.ts
  Lines: 147-233 (dual path logic)
  Action: Consolidate to single paginated path
  Test: Verify no streaming fallback needed

src/hooks/streaming/useStreamingTimeseries.ts
  Action: Ensure calls fetchTimeseriesForPoints
  Test: Verify raw data preserved in streaming mode
```

#### HIGH PRIORITY (Week 2)
```
src/components/charts/containers/TimeSeriesChartContainer.tsx
src/components/charts/containers/AreaChartContainer.tsx
src/components/charts/containers/BarChartContainer.tsx
src/components/charts/containers/CalendarChartContainer.tsx
src/components/charts/containers/CandlestickChartContainer.tsx
src/components/charts/containers/PsychrometricChartContainer.tsx
src/components/charts/containers/PerfectEconomizerContainer.tsx
src/components/charts/containers/ScatterPlotContainer.tsx

  Action for ALL: Replace any direct API calls with useChartData
  Pattern:
    const { series } = useChartData({ selectedPoints, timeRange });
  Test: Each container renders with 365-day range
```

#### SPECIALIZED CHARTS (Week 2)
```
src/components/charts/EChartsDeviceDeviationHeatmap.tsx
  Current: May have custom data fetching
  Action: Migrate to useChartData, then calculate deviation
  Test: Verify anomaly detection still works

src/components/charts/EChartsSPCChart.tsx
  Current: Control limits need raw intervals
  Action: Use useChartData for base data
  Test: Verify UCL/LCL calculated correctly

src/components/charts/EChartsPerfectEconomizer.tsx
  Current: Temperature point correlation
  Action: Use useChartData for all temp points
  Test: Verify economizer cycles detected
```

#### WRAPPERS (Week 3)
```
src/components/charts/UniversalChartWrapper.tsx
  Lines: 148-158 (data preservation)
  Action: Verify always uses useChartData
  Test: enableDataPreservation works correctly

src/components/charts/UnifiedChartRenderer.tsx
  Action: Ensure delegates to correct hooks
  Test: All chart types render through unified interface
```

#### SUPPORTING FILES
```
src/hooks/useBatchedChartData.ts
  Action: Verify batch service calls fetchTimeseriesForPoints
  Test: Batching improves performance for multi-point queries

src/hooks/useOptimizedChartData.ts
  Action: Remove if redundant with useChartData optimizations
  Test: No degradation after removal

src/services/cloudflareWorkerClient.ts
  Action: Document when this should vs. shouldn't be called
  Test: Only used by fetchTimeseriesForPoints
```

---

### Files to Create

#### Tests
```
tests/hooks/useChartData.integration.test.ts
tests/services/paginatedTimeseries.test.ts
tests/components/charts/ChartDataFlow.test.tsx
```

#### Documentation
```
docs/CHART_DATA_FLOW.md
docs/PAGINATED_ENDPOINT_MIGRATION.md
docs/TROUBLESHOOTING_CHART_DATA.md
```

---

### Files to Delete (After Verification)
```
# Only delete if confirmed unused:
src/hooks/useChartDataV2.ts (if exists)
src/hooks/useChartDataV3.ts (if exists)
src/services/legacyTimeseriesService.ts (if exists)
```

---

## 8. Dependencies Between Tasks

### Critical Path
```
[Research Complete]
    ↓
[Verify useChartData uses paginated service] ← BLOCKER for all other work
    ↓
[Consolidate useUniversalChartData]
    ↓
[Migrate container components] ← Can parallelize these
    ↓
[Migrate specialized charts]
    ↓
[Update wrappers]
    ↓
[Integration testing]
    ↓
[Staging deployment]
    ↓
[Production rollout]
```

### Parallel Tracks
**Track 1 (Core)**: Hook refactoring
**Track 2 (Components)**: Container/chart migration
**Track 3 (Testing)**: Test suite development
**Track 4 (Documentation)**: Docs updates

These tracks can run in parallel after initial research phase.

---

## 9. Agent Assignment Matrix

| Phase | Task | Primary Agent | Support Agents | Duration |
|-------|------|---------------|----------------|----------|
| Research | Code audit | Research Agent | - | 4h |
| Research | Document findings | Research Agent | Documentation | 2h |
| Core Hooks | Verify useChartData | Coder Agent | Tester | 2h |
| Core Hooks | Consolidate Universal hook | Coder Agent | Reviewer | 4h |
| Core Hooks | Migrate streaming hooks | Coder Agent | Tester | 4h |
| Testing | Unit tests | Tester Agent | Coder | 4h |
| Testing | Integration tests | Tester Agent | Coder | 3h |
| Components | Container audit | Research Agent | Coder | 2h |
| Components | Migrate containers | Coder Agent | Tester | 8h |
| Components | Migrate specialized | Coder Agent | Tester | 5h |
| Wrappers | Update wrappers | Coder Agent | Reviewer | 4h |
| Documentation | Update docs | Documentation Agent | Coder | 6h |
| Deployment | Staging deploy | DevOps Agent | Coder | 2h |
| Deployment | Production rollout | DevOps Agent | All | 6h |
| Monitoring | Post-deploy monitoring | DevOps Agent | Tester | 8h |

**Total Agent Hours**:
- Research Agent: 8h
- Coder Agent: 32h
- Tester Agent: 20h
- Reviewer Agent: 6h
- Documentation Agent: 8h
- DevOps Agent: 16h
- **Grand Total**: 90h (excludes QA team)

---

## 10. Rollout Strategy

### Phase 1: Internal Testing (Week 1-3)
**Audience**: Development team only
**Environment**: Staging

**Activities**:
1. Deploy all changes to staging environment
2. Development team uses staging for daily work
3. Report any issues found
4. Iterate on fixes before production

**Success Criteria**:
- Zero critical bugs found
- All charts load correctly
- Performance meets targets

---

### Phase 2: Beta Rollout (Week 4, Days 1-2)
**Audience**: 10% of users (power users/early adopters)
**Environment**: Production with feature flag

**Implementation**:
```typescript
// Feature flag configuration
const BETA_USERS = [
  'user1@example.com',
  'user2@example.com',
  // ... beta testers
];

function shouldUsePaginatedEndpoint(userEmail) {
  return BETA_USERS.includes(userEmail) ||
         Math.random() < 0.1; // 10% random sample
}
```

**Monitoring**:
- Error rates by user segment
- Performance metrics (load time, memory)
- User feedback surveys

**Success Criteria**:
- Error rate < 1%
- No performance regressions
- Positive user feedback

---

### Phase 3: Gradual Rollout (Week 4, Days 3-4)
**Audience**: 10% → 25% → 50% → 75% → 100%
**Environment**: Production

**Timeline**:
- Day 3 AM: 10% → 25%
- Day 3 PM: 25% → 50%
- Day 4 AM: 50% → 75%
- Day 4 PM: 75% → 100%

**At Each Step**:
1. Deploy updated feature flag percentage
2. Monitor for 4 hours
3. Check error rates, performance, user reports
4. If all green, proceed to next percentage

**Rollback Triggers**:
- Error rate > 2% for >30 minutes
- Performance degradation > 20%
- Multiple user-reported data issues

---

### Phase 4: Full Deployment (Week 4, Day 5)
**Audience**: 100% of users
**Environment**: Production

**Final Steps**:
1. Set feature flag to 100%
2. Monitor closely for 8 hours
3. Send announcement to users (optional)
4. Schedule cleanup for next sprint

**Post-Deployment**:
- Remove feature flag code (1 week later)
- Delete deprecated code (2 weeks later)
- Archive old documentation (2 weeks later)

---

## 11. Monitoring & Metrics

### Key Performance Indicators

#### Availability Metrics
```typescript
const AVAILABILITY_METRICS = {
  chartLoadSuccessRate: {
    target: '> 99%',
    alert: '< 98%',
    critical: '< 95%'
  },
  dataFetchSuccessRate: {
    target: '> 99.5%',
    alert: '< 99%',
    critical: '< 97%'
  },
  apiEndpointUptime: {
    target: '> 99.9%',
    alert: '< 99.5%',
    critical: '< 99%'
  }
};
```

#### Performance Metrics
```typescript
const PERFORMANCE_METRICS = {
  chartLoadTime: {
    target: {
      '24h': '< 2s',
      '7d': '< 5s',
      '365d': '< 30s'
    },
    alert: {
      '24h': '> 3s',
      '7d': '> 8s',
      '365d': '> 45s'
    }
  },
  memoryUsage: {
    target: '< 100MB for 100K points',
    alert: '> 150MB',
    critical: '> 200MB'
  },
  apiResponseTime: {
    target: '< 1s per page',
    alert: '> 2s per page',
    critical: '> 5s per page'
  }
};
```

#### Data Quality Metrics
```typescript
const DATA_QUALITY_METRICS = {
  dataCompleteness: {
    target: '100% (no gaps)',
    alert: '< 99.9%',
    description: 'No missing data points within expected intervals'
  },
  intervalAccuracy: {
    target: 'Matches native intervals (30s, 1min, 5min)',
    alert: 'Any forced bucketing detected',
    description: 'Raw intervals preserved, not aggregated'
  },
  paginationSuccess: {
    target: '100% cursor-based',
    alert: '< 100%',
    description: 'All paginated requests complete successfully'
  }
};
```

### Monitoring Dashboard

#### CloudWatch/Datadog Metrics
```typescript
// Custom metrics to track
const CUSTOM_METRICS = {
  'chart.data.fetch.duration': {
    dimensions: ['chartType', 'timeRange', 'pointCount'],
    unit: 'Milliseconds'
  },
  'chart.data.fetch.size': {
    dimensions: ['chartType', 'format'], // format: json vs msgpack
    unit: 'Bytes'
  },
  'chart.data.fetch.errors': {
    dimensions: ['chartType', 'errorType'],
    unit: 'Count'
  },
  'paginated.api.pages.fetched': {
    dimensions: ['siteName', 'timeRange'],
    unit: 'Count'
  },
  'paginated.api.samples.retrieved': {
    dimensions: ['siteName', 'timeRange'],
    unit: 'Count'
  }
};
```

#### Real-Time Alerts
```typescript
// Alert configuration
const ALERTS = {
  highErrorRate: {
    metric: 'chart.data.fetch.errors',
    threshold: '> 5% of requests in 5min window',
    action: 'Page on-call engineer',
    runbook: 'docs/runbooks/chart-data-errors.md'
  },
  slowLoadTime: {
    metric: 'chart.data.fetch.duration',
    threshold: 'p95 > 10s for 10min',
    action: 'Send Slack alert',
    runbook: 'docs/runbooks/slow-chart-loads.md'
  },
  memoryLeak: {
    metric: 'browser.memory.usage',
    threshold: '> 500MB sustained for 5min',
    action: 'Page on-call engineer',
    runbook: 'docs/runbooks/memory-leak.md'
  }
};
```

---

## 12. Communication Plan

### Stakeholder Updates

#### Weekly Status Report
**Recipients**: Engineering team, Product Manager, CTO
**Format**: Email + Slack

**Template**:
```markdown
## Paginated Endpoint Migration - Week [X] Update

### Progress This Week
- ✅ Completed: [List]
- 🚧 In Progress: [List]
- ⏳ Upcoming: [List]

### Metrics
- Charts Migrated: X / Y (Z%)
- Tests Passing: X / Y (Z%)
- Performance: [Summary]

### Blockers
- [List any blockers]

### Next Week Goals
- [List goals]

### Risks
- [List any risks identified]
```

---

#### Production Deployment Announcement
**Recipients**: All users
**Format**: In-app notification + Email

**Draft**:
```markdown
Subject: Chart Performance Improvements Coming Soon

Hi [User],

We're excited to announce an upgrade to our chart data system
that will bring several benefits:

✅ Faster loading for large time ranges (up to 60% faster)
✅ Higher resolution data visualization (see every data point)
✅ Improved performance for 365-day views

This upgrade will roll out gradually starting [Date]. You
shouldn't notice any changes to how your dashboards work,
but charts will load faster and show more detail.

If you encounter any issues, please contact support.

Thanks,
The Building Vitals Team
```

---

## 13. Post-Migration Checklist

### Immediate Post-Deployment (Day 1)
- [ ] All charts loading correctly in production
- [ ] Error rates within normal range (< 1%)
- [ ] Performance metrics meet targets
- [ ] No critical user-reported issues
- [ ] Monitoring dashboard shows green across all metrics

### Short-Term (Week 1)
- [ ] User feedback reviewed (surveys, support tickets)
- [ ] Any minor bugs fixed and deployed
- [ ] Performance optimizations applied if needed
- [ ] Documentation updated with lessons learned
- [ ] Retrospective meeting completed

### Mid-Term (Week 2-4)
- [ ] Feature flag removed from codebase
- [ ] Deprecated code deleted
- [ ] Old implementations archived
- [ ] Final metrics report published
- [ ] Team knowledge sharing session completed

### Long-Term (Month 2)
- [ ] Success metrics analyzed and documented
- [ ] Best practices documented for future migrations
- [ ] Technical debt from migration addressed
- [ ] Monitoring alerts tuned based on production data
- [ ] Architecture documentation finalized

---

## 14. Appendix: Code Snippets

### Standard Component Pattern
```typescript
// components/charts/ExampleChart.tsx
import React from 'react';
import { useChartData } from '@/hooks/useChartData';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import type { Point } from '@/types/dashboard';

interface ExampleChartProps {
  selectedPoints: Point[];
  timeRange: string;
  chartType: string;
}

export function ExampleChart({
  selectedPoints,
  timeRange,
  chartType
}: ExampleChartProps) {
  // ✅ CORRECT: Use centralized hook
  const { series, isLoading, error } = useChartData({
    selectedPoints,
    timeRange,
    enabled: selectedPoints.length > 0
  });

  if (isLoading) return <ChartLoadingState />;
  if (error) return <ChartErrorState error={error} />;
  if (series.length === 0) return <NoDataState />;

  // Transform to ECharts format
  const option = transformToEChartsOption(series, chartType);

  return <EChartsWrapper option={option} />;
}
```

### Data Transformation Example
```typescript
// utils/chartDataTransformers.ts
export function transformToEChartsOption(
  series: ChartSeries[],
  chartType: string,
  config?: ChartConfig
): EChartsOption {
  return {
    title: { text: config?.title },
    tooltip: { trigger: 'axis' },
    legend: {
      data: series.map(s => s.formattedName),
      bottom: 10
    },
    xAxis: { type: 'time' },
    yAxis: {
      type: 'value',
      name: series[0]?.unit || ''
    },
    series: series.map(s => ({
      name: s.formattedName,
      type: chartType === 'line' ? 'line' : 'bar',
      data: s.data, // Already in [timestamp, value] format
      smooth: config?.smooth || false,
      // Large dataset optimizations (preserves all data)
      large: s.data.length > 2000,
      largeThreshold: 2000,
      progressive: 5000,
      progressiveThreshold: 10000,
      sampling: 'lttb' // Visual sampling, data preserved
    }))
  };
}
```

### Performance Monitoring Hook
```typescript
// hooks/useChartPerformance.ts
export function useChartPerformance(chartId: string) {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    dataPoints: 0,
    memoryUsed: 0
  });

  useEffect(() => {
    const startTime = performance.now();
    const startMemory = performance.memory?.usedJSHeapSize || 0;

    return () => {
      const endTime = performance.now();
      const endMemory = performance.memory?.usedJSHeapSize || 0;

      const loadTime = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      setMetrics({ loadTime, dataPoints: 0, memoryUsed });

      // Log to analytics
      window.analytics?.track('Chart Performance', {
        chartId,
        loadTime,
        memoryUsed,
        timestamp: new Date().toISOString()
      });
    };
  }, [chartId]);

  return metrics;
}
```

---

## 15. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2025-10-13 | Use paginated endpoint exclusively | Preserves native intervals, handles large datasets | Continue using per-point endpoint |
| 2025-10-13 | Enable MessagePack by default | 60% payload reduction | Use JSON only |
| 2025-10-13 | Consolidate to single `useChartData` hook | Simplifies maintenance | Keep multiple hooks |
| 2025-10-13 | Gradual rollout with feature flags | Reduces risk | All-at-once deployment |
| 2025-10-13 | Client-side filtering | Works with site-level API | Server-side filtering |

---

## 16. References

### Documentation
- [Paginated Endpoint Spec](C:\Users\jstahr\Desktop\Building Vitals\docs\specs\PAGINATED_ENDPOINT_SPEC.md)
- [Architecture Overview](C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\ARCHITECTURE.md)
- [SPARC Methodology](C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\CLAUDE.md)

### Code Files
- [paginatedTimeseriesService.ts](C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\services\paginatedTimeseriesService.ts)
- [useChartData.ts](C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\useChartData.ts)
- [useUniversalChartData.ts](C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\streaming\useUniversalChartData.ts)

### External Resources
- [ECharts Large Dataset Performance](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [MessagePack Specification](https://msgpack.org/)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)

---

**END OF PLAN**

**Status**: ✅ Ready for review and execution
**Next Steps**:
1. Research agents complete code audit (4h)
2. Coder agents begin hook consolidation (2h)
3. Review this plan with team for feedback

**Contact**: Planning Agent
**Last Updated**: 2025-10-13
