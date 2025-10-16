# Quick Wins Refactoring - Technical Specifications

**Project**: Building Vitals Chart System Refactoring
**Phase**: Quick Wins (Low-Risk, High-Impact)
**Created**: 2025-10-13
**Estimated Total Effort**: 16 hours
**Est. LOC Reduction**: ~1,200 lines

## Executive Summary

This specification documents 6 quick win refactoring opportunities identified in the Building Vitals chart system. These improvements eliminate code duplication, standardize patterns, and improve maintainability without requiring significant architectural changes or introducing risk.

### Key Benefits
- **Reduced LOC**: Eliminate ~1,200 lines of duplicated code
- **Improved Consistency**: Standardize patterns across 143+ chart components
- **Better DX**: Centralized utilities are easier to maintain and test
- **Zero Breaking Changes**: All refactorings are backward-compatible
- **Quick ROI**: 16 hours investment, permanent maintainability gains

---

## Current State Analysis

### Chart Component Inventory
- **Total Chart Components**: 143 .tsx files
- **Components with Loading States**: 19+ files
- **Components with Error Handling**: 25+ files
- **Components with Resize Logic**: 8 files with ResizeObserver
- **Components with Default Props**: 2 test files (limited usage)

### Code Duplication Metrics
```
Resize Handling:        ~240 LOC duplicated across 8 files
Error Handling:         ~375 LOC duplicated across 25 files
Loading States:         ~285 LOC duplicated across 19 files
Validation Functions:   ~180 LOC potential duplication
Default Props:          ~100 LOC in prop definitions
JSDoc Comments:         ~0 LOC (currently missing)

TOTAL DUPLICATION:      ~1,180 lines of code
```

---

## Quick Win #1: Centralize Resize Handling

### 1.1 Current State

**Problem**: Resize handling is implemented inconsistently across chart components.

**Current Implementations Found**:

1. **EChartsWrapper.tsx** (Lines 148-270): Full ResizeObserver with immediate + debounced resize
   ```typescript
   // 122 LOC implementation with:
   - ResizeObserver for container changes
   - Window resize listener
   - Custom grid-resize event listener
   - Immediate resize via requestAnimationFrame
   - Debounced resize with 150ms delay
   - Multiple initial resize attempts (100ms, 300ms, 500ms)
   - Container size tracking
   ```

2. **EChartsAreaChart.tsx** (Lines 423-434): Custom resize with ResizeObserver + scheduling
   ```typescript
   // 12 LOC implementation
   const resizeObserver = new ResizeObserver(() => {
     scheduleUpdate();  // Uses RAF batching
   });
   ```

3. **EChartsTimeSeriesChart.tsx** (Lines 1142-1160): Window resize listener only
   ```typescript
   // 19 LOC implementation
   window.addEventListener('resize', handleResize);
   window.addEventListener('grid-resize', handleResize);
   ```

4. **EChartsBarChart.tsx** (Lines 456-474): Similar window resize pattern
   ```typescript
   // 19 LOC implementation
   ```

5. **EChartsScatterPlot.tsx** (Lines 107-126): Window resize listener
   ```typescript
   // 20 LOC implementation
   ```

6. **EChartsHeatmap.tsx** (Lines 728-746): Window resize listener
   ```typescript
   // 19 LOC implementation
   ```

7. **useChartResize.ts** (Lines 1-297): Comprehensive custom hook (EXISTS BUT UNDERUTILIZED)
   ```typescript
   // 297 LOC - Full-featured hook with:
   - Configurable debounce delays
   - Immediate + debounced resize
   - ResizeObserver integration
   - Window resize listeners
   - Animation support
   - Debug logging
   - Manual trigger capability
   ```

**Key Findings**:
- `useChartResize.ts` hook exists with ALL required features but is NOT being used
- Each chart implements its own resize logic (8 different implementations)
- Inconsistent behavior: some use ResizeObserver, some use window events only
- Duplication: ~240 lines of code performing similar operations

### 1.2 Target State

**Solution**: Use existing `useChartResize` hook universally, eliminate all custom implementations.

**Benefits**:
- Single source of truth for resize behavior
- Consistent resize performance across all charts
- Easier to debug and maintain
- Already tested and battle-hardened

### 1.3 API Design

**Existing Hook API** (from `src/hooks/useChartResize.ts`):

```typescript
// PRIMARY HOOK (full-featured)
const {
  containerRef,          // Ref to attach to chart container
  containerSize,         // Current { width, height }
  registerChart,         // Register ECharts instance
  triggerResize,         // Manual resize trigger
  isResizing,           // Resize in progress flag
} = useChartResize({
  debounceDelay?: number;         // Default: 150ms
  enableImmediateResize?: boolean; // Default: true
  enableAnimation?: boolean;       // Default: true
  animationDuration?: number;      // Default: 200ms
  animationEasing?: string;        // Default: 'cubicOut'
  sizeThreshold?: number;          // Default: 1px
  debug?: boolean;                 // Default: false
  chartId?: string;               // For debugging
});

// SIMPLIFIED VARIANT (basic use cases)
const hooks = useSimpleChartResize(chartRef, chartId);

// PERFORMANCE VARIANT (large datasets)
const hooks = useOptimizedChartResize(chartRef, chartId);
```

**Usage Pattern**:
```typescript
const MyChart: React.FC = () => {
  const { containerRef, registerChart } = useChartResize({
    chartId: 'my-chart'
  });

  const handleChartReady = (instance: EChartsType) => {
    registerChart(instance);
    // ... other setup
  };

  return (
    <div ref={containerRef}>
      <EChartsReact onChartReady={handleChartReady} />
    </div>
  );
};
```

### 1.4 Migration Path

**Phase 1: Adopt in EChartsWrapper** (Critical path - affects all charts)
1. Import `useChartResize` hook
2. Replace custom ResizeObserver logic (Lines 148-270)
3. Use `containerRef` and `registerChart` from hook
4. Remove custom resize handlers
5. Test with multiple chart types

**Phase 2: Update Individual Charts** (6 charts)
1. EChartsAreaChart - Replace custom scheduleUpdate logic
2. EChartsTimeSeriesChart - Replace window listeners
3. EChartsBarChart - Replace window listeners
4. EChartsScatterPlot - Replace window listeners
5. EChartsHeatmap - Replace window listeners
6. Any other charts with custom resize logic

**Phase 3: Verification**
1. Test resize behavior in grid layouts
2. Test react-grid-layout integration
3. Test window resize events
4. Verify animation performance
5. Check for memory leaks

### 1.5 Success Criteria

- [ ] All charts use `useChartResize` hook
- [ ] Zero custom ResizeObserver implementations in chart components
- [ ] Consistent resize behavior across all chart types
- [ ] No regression in resize performance
- [ ] ~240 LOC eliminated
- [ ] All tests pass

**Effort**: 2 hours
**Risk**: Low (hook already exists and is tested)
**Impact**: High (affects all 143 charts via EChartsWrapper)

---

## Quick Win #2: Standardize Error Handling

### 2.1 Current State

**Problem**: Error handling is inconsistent across 25+ chart components.

**Current Patterns Found**:

1. **Inline Error Display** (13 occurrences):
   ```typescript
   if (error) {
     return (
       <Box sx={{ height, display: 'flex', alignItems: 'center', ... }}>
         Error loading chart: {error.message}
       </Box>
     );
   }
   ```

2. **MUI Alert Error Display** (6 occurrences in EChartsWrapper):
   ```typescript
   if (error) {
     return (
       <div className="echarts-wrapper echarts-error">
         <Alert severity="error">{error.message || 'Failed to load chart'}</Alert>
       </div>
     );
   }
   ```

3. **Error Boundary Pattern** (found in error-boundaries/):
   ```typescript
   <ChartErrorBoundaryWrapper
     chartType={chartType}
     chartId={chartId}
     onError={(error, errorInfo) => { /* ... */ }}
   >
     <MyChart />
   </ChartErrorBoundaryWrapper>
   ```

**Issues**:
- Inconsistent error display styling
- No standard error logging
- Missing error recovery mechanisms
- Duplicated error JSX (~15 LOC per component × 25 = 375 LOC)

### 2.2 Target State

**Solution**: Create centralized error display component with consistent behavior.

**Key Features**:
- Standard error UI across all charts
- Automatic error logging/reporting
- Optional retry mechanism
- Error boundary integration
- Graceful degradation

### 2.3 API Design

```typescript
// NEW COMPONENT: src/components/charts/ChartErrorDisplay.tsx

interface ChartErrorDisplayProps {
  error: Error | null;
  chartType?: string;
  height?: string | number;
  onRetry?: () => void;
  showDetails?: boolean;  // Show stack trace in dev
  fallback?: React.ReactNode;  // Custom error UI
}

export const ChartErrorDisplay: React.FC<ChartErrorDisplayProps> = ({
  error,
  chartType = 'chart',
  height = 400,
  onRetry,
  showDetails = process.env.NODE_ENV === 'development',
  fallback
}) => {
  if (!error) return null;

  // Log error automatically
  useEffect(() => {
    console.error(`[${chartType}] Error:`, error);
    // Could integrate with error tracking service here
  }, [error, chartType]);

  if (fallback) return <>{fallback}</>;

  return (
    <Box sx={{
      height: typeof height === 'number' ? `${height}px` : height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 2,
      p: 3
    }}>
      <Alert severity="error" sx={{ maxWidth: 600 }}>
        <AlertTitle>Error Loading {chartType}</AlertTitle>
        {error.message || 'An unexpected error occurred'}
      </Alert>

      {onRetry && (
        <Button variant="outlined" onClick={onRetry} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      )}

      {showDetails && error.stack && (
        <Accordion>
          <AccordionSummary>Error Details</AccordionSummary>
          <AccordionDetails>
            <pre style={{ fontSize: 11, overflow: 'auto' }}>
              {error.stack}
            </pre>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
```

**Usage Pattern**:
```typescript
// BEFORE (repeated in 25+ files):
if (error) {
  return (
    <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Error: {error.message}
    </Box>
  );
}

// AFTER (1 line):
<ChartErrorDisplay error={error} chartType="Time Series" height={height} onRetry={refetch} />
```

### 2.4 Migration Path

**Phase 1: Create Component**
1. Create `src/components/charts/ChartErrorDisplay.tsx`
2. Add tests for error display component
3. Add Storybook stories for different error states

**Phase 2: Integrate with Base Components**
1. Update `EChartsWrapper` to use `ChartErrorDisplay`
2. Update `BaseChartContainer` to use `ChartErrorDisplay`
3. Test with various error scenarios

**Phase 3: Update Individual Charts** (25 charts)
1. Replace inline error displays with `<ChartErrorDisplay />`
2. Remove duplicated error handling JSX
3. Add onRetry handlers where appropriate
4. Update tests

**Phase 4: Documentation**
1. Update component docs
2. Add error handling guidelines
3. Create migration guide for chart developers

### 2.5 Success Criteria

- [ ] `ChartErrorDisplay` component created
- [ ] All 25+ charts use standard error display
- [ ] Consistent error styling across all charts
- [ ] Error logging integrated
- [ ] Retry functionality available where needed
- [ ] ~375 LOC eliminated
- [ ] All error scenarios tested

**Effort**: 3 hours
**Risk**: Low (presentation component, no logic changes)
**Impact**: High (affects 25+ charts)

---

## Quick Win #3: Extract Common Validators

### 2.3 Current State

**Problem**: Data validation logic is scattered and potentially duplicated.

**Existing Utilities** (from `src/utils/typeGuards.ts`):
```typescript
// 49 LOC of validation utilities
export function isNonEmptyString(value: any): value is string
export function isValidNumber(value: any): value is number
export function isValidDate(value: any): value is Date
export function hasProperty<T, K>(obj: T, key: K): obj is T & Record<K, unknown>
export function isArrayOf<T>(value: any, guard: (item: any) => item is T): value is T[]
export function isSeriesArray(value: any): value is any[]
```

**Chart-Specific Validation Patterns Found**:

1. **Data Structure Validation** (EChartsTimeSeriesChart, Lines 150-187):
   ```typescript
   const processedData = useMemo(() => {
     if (!data || !Array.isArray(data)) return [];

     const filtered = data.filter(series => {
       return series &&
         series.data &&
         Array.isArray(series.data) &&
         series.data.length > 0;
     });

     return filtered;
   }, [data]);
   ```

2. **Data Point Validation** (EChartsTimeSeriesChart, Lines 376-391):
   ```typescript
   const validatedData = sortedData.filter(point => {
     if (Array.isArray(point) && point.length >= 2) {
       const [timestamp, value] = point;
       const isValidTimestamp = (typeof timestamp === 'number' && isFinite(timestamp)) ||
                               (timestamp instanceof Date && !isNaN(timestamp.getTime()));
       const isValidValue = typeof value === 'number' && isFinite(value);
       return isValidTimestamp && isValidValue;
     }
     return false;
   });
   ```

3. **Series Validation** (EChartsHeatmap, Lines 299-316):
   ```typescript
   const validatedData = useMemo(() => {
     if (Array.isArray(dataSource) && dataSource.length > 0) {
       // Check if it's series data
       if (dataSource[0]?.data && Array.isArray(dataSource[0].data)) {
         return dataSource.filter(s =>
           s &&
           s.data &&
           Array.isArray(s.data) &&
           s.data.length > 0
         );
       }
       // Check if it's already heatmap data
       if (typeof dataSource[0] === 'object' && 'value' in dataSource[0]) {
         return dataSource;
       }
     }
     return [];
   }, [dataSource]);
   ```

**Analysis**:
- Similar validation patterns repeated across multiple charts
- Each chart validates data structure independently
- No centralized chart data validators
- Estimated ~180 LOC of validation logic that could be shared

### 2.3.2 Target State

**Solution**: Create comprehensive chart data validation utilities.

### 2.3.3 API Design

```typescript
// NEW FILE: src/utils/chartValidators.ts

import { isValidNumber, isArrayOf, hasProperty } from './typeGuards';

/**
 * Validates a time series data point [timestamp, value]
 */
export function isValidTimeSeriesPoint(point: any): point is [number, number] {
  if (!Array.isArray(point) || point.length < 2) return false;

  const [timestamp, value] = point;

  // Validate timestamp (number or Date)
  const isValidTimestamp =
    (typeof timestamp === 'number' && isFinite(timestamp)) ||
    (timestamp instanceof Date && !isNaN(timestamp.getTime()));

  // Validate value (finite number)
  const isValidValue = typeof value === 'number' && isFinite(value);

  return isValidTimestamp && isValidValue;
}

/**
 * Validates a chart series object
 */
export interface ChartSeries {
  name: string;
  data: Array<[number, number]>;
  unit?: string;
  color?: string;
  markerTags?: string[];
}

export function isValidChartSeries(series: any): series is ChartSeries {
  return (
    series &&
    typeof series === 'object' &&
    typeof series.name === 'string' &&
    Array.isArray(series.data) &&
    series.data.length > 0 &&
    series.data.every(isValidTimeSeriesPoint)
  );
}

/**
 * Validates and filters an array of chart series
 */
export function validateChartData(data: any): ChartSeries[] {
  if (!Array.isArray(data)) {
    console.warn('[ChartValidator] Data is not an array:', typeof data);
    return [];
  }

  const validSeries = data.filter(isValidChartSeries);

  if (validSeries.length < data.length) {
    console.warn(
      `[ChartValidator] Filtered out ${data.length - validSeries.length} invalid series`
    );
  }

  return validSeries;
}

/**
 * Validates scatter plot data point [x, y]
 */
export function isValidScatterPoint(point: any): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    isValidNumber(point[0]) &&
    isValidNumber(point[1])
  );
}

/**
 * Validates heatmap data point { x, y, value }
 */
export interface HeatmapPoint {
  x: number | string;
  y: number | string;
  value: number;
}

export function isValidHeatmapPoint(point: any): point is HeatmapPoint {
  return (
    point &&
    typeof point === 'object' &&
    (typeof point.x === 'number' || typeof point.x === 'string') &&
    (typeof point.y === 'number' || typeof point.y === 'string') &&
    typeof point.value === 'number' &&
    isFinite(point.value)
  );
}

/**
 * Validates bar chart data point
 */
export interface BarChartPoint {
  name: string;
  value: number;
  unit?: string;
  color?: string;
}

export function isValidBarChartPoint(point: any): point is BarChartPoint {
  return (
    point &&
    typeof point === 'object' &&
    typeof point.name === 'string' &&
    typeof point.value === 'number' &&
    isFinite(point.value)
  );
}

/**
 * Safe data extraction with validation
 */
export function extractValidPoints<T>(
  data: any[],
  validator: (point: any) => point is T
): T[] {
  if (!Array.isArray(data)) return [];
  return data.filter(validator);
}

/**
 * Validates data is not empty
 */
export function hasValidData(data: any): boolean {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;

  // Check if it's series data
  if (data[0]?.data && Array.isArray(data[0].data)) {
    return data.some(series => series.data && series.data.length > 0);
  }

  // Check if it's direct data points
  return true;
}

/**
 * Normalized data point to [number, number] format
 */
export function normalizeTimeSeriesPoint(point: any): [number, number] | null {
  // Already in correct format
  if (Array.isArray(point) && point.length >= 2) {
    const [timestamp, value] = point;
    const normalizedTimestamp = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    if (typeof normalizedTimestamp === 'number' && typeof value === 'number') {
      return [normalizedTimestamp, value];
    }
  }

  // Object format { timestamp, value } or { time, value }
  if (point && typeof point === 'object') {
    const timestamp = point.timestamp || point.time;
    const value = point.value;

    if (timestamp !== undefined && value !== undefined) {
      const normalizedTimestamp = timestamp instanceof Date ? timestamp.getTime() : timestamp;
      if (typeof normalizedTimestamp === 'number' && typeof value === 'number') {
        return [normalizedTimestamp, value];
      }
    }
  }

  return null;
}
```

### 2.3.4 Migration Path

**Phase 1: Create Validators**
1. Create `src/utils/chartValidators.ts`
2. Add comprehensive tests (jest)
3. Add TypeScript type tests
4. Document all validators

**Phase 2: Integrate with Base Components**
1. Update `EChartsWrapper` to use validators
2. Update `chartDataTransformers.ts` to use validators
3. Test with various data formats

**Phase 3: Update Individual Charts** (143 charts)
1. Replace inline validation logic with validator functions
2. Use `validateChartData()` in data processing useMemo
3. Use `isValidTimeSeriesPoint()` for point filtering
4. Use `normalizeTimeSeriesPoint()` for data normalization
5. Update tests

**Phase 4: Add Validation Logging**
1. Add dev-mode warnings for invalid data
2. Create validation error messages
3. Add Sentry/error tracking integration

### 2.3.5 Success Criteria

- [ ] `chartValidators.ts` created with 10+ validators
- [ ] All validators have unit tests
- [ ] TypeScript types are properly exported
- [ ] Base components use validators
- [ ] At least 10 charts migrated to use validators
- [ ] Documentation updated
- [ ] ~180 LOC of duplicated validation eliminated
- [ ] Validation is more consistent and reliable

**Effort**: 2 hours
**Risk**: Low (pure functions, easy to test)
**Impact**: Medium (improves data quality and consistency)

---

## Quick Win #4: Standardize Loading States

### 2.4.1 Current State

**Problem**: Loading states are implemented inconsistently across 19+ chart components.

**Current Patterns Found**:

1. **Simple Box Loading** (13 occurrences):
   ```typescript
   if (loading) {
     return (
       <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         Loading...
       </Box>
     );
   }
   ```

2. **ChartSkeletonLoader** (in EChartsWrapper, Line 278):
   ```typescript
   if (loading) {
     return (
       <div className="echarts-wrapper echarts-loading">
         <ChartSkeletonLoader
           height={height}
           chartType="line"
           showHeader={false}
           animated
         />
       </div>
     );
   }
   ```

3. **ChartLoadingState Component** (exists but underutilized):
   ```typescript
   // src/components/charts/ChartLoadingState.tsx
   // Comprehensive loading component but not widely adopted
   ```

**Issues**:
- Inconsistent loading UX across charts
- Some charts show "Loading...", others show skeleton
- No loading progress indication
- Duplicated loading JSX (~15 LOC per component × 19 = 285 LOC)

### 2.4.2 Target State

**Solution**: Standardize on existing `ChartSkeletonLoader` or create enhanced version.

**Key Features**:
- Consistent skeleton UI for all chart types
- Animated loading states
- Optional progress indication
- Proper sizing (matches chart height)
- Accessible loading states

### 2.4.3 API Design

```typescript
// ENHANCED VERSION: src/components/charts/ChartLoadingState.tsx

interface ChartLoadingStateProps {
  loading?: boolean;
  height?: string | number;
  chartType?: 'line' | 'bar' | 'scatter' | 'heatmap' | 'gauge' | 'generic';
  showProgress?: boolean;
  progress?: number; // 0-100
  message?: string;
  animated?: boolean;
  showHeader?: boolean;
}

export const ChartLoadingState: React.FC<ChartLoadingStateProps> = ({
  loading = true,
  height = 400,
  chartType = 'generic',
  showProgress = false,
  progress = 0,
  message = 'Loading chart data...',
  animated = true,
  showHeader = false
}) => {
  if (!loading) return null;

  return (
    <Box
      className="chart-loading-state"
      sx={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        position: 'relative'
      }}
      role="status"
      aria-label={message}
    >
      {/* Skeleton based on chart type */}
      <ChartSkeletonLoader
        height={height}
        chartType={chartType}
        showHeader={showHeader}
        animated={animated}
      />

      {/* Optional progress bar */}
      {showProgress && (
        <Box sx={{ width: '60%', maxWidth: 400 }}>
          <LinearProgress
            variant={progress > 0 ? 'determinate' : 'indeterminate'}
            value={progress}
          />
          <Typography variant="caption" sx={{ mt: 1, textAlign: 'center', display: 'block' }}>
            {message} {progress > 0 && `${Math.round(progress)}%`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Convenience hook for loading state
export function useChartLoadingState(
  isLoading: boolean,
  chartType?: string,
  options?: {
    showProgress?: boolean;
    estimatedDuration?: number; // ms
  }
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading || !options?.showProgress || !options?.estimatedDuration) {
      setProgress(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculated = Math.min(95, (elapsed / options.estimatedDuration) * 100);
      setProgress(calculated);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading, options?.showProgress, options?.estimatedDuration]);

  return { progress };
}
```

**Usage Pattern**:
```typescript
// BEFORE (repeated in 19+ files):
if (loading) {
  return (
    <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading...
    </Box>
  );
}

// AFTER (1 line):
<ChartLoadingState
  loading={loading}
  height={height}
  chartType="line"
  showProgress
  message="Loading time series data..."
/>

// OR with early return:
if (loading) {
  return <ChartLoadingState loading height={height} chartType="line" />;
}
```

### 2.4.4 Migration Path

**Phase 1: Enhance Component**
1. Update `src/components/charts/ChartLoadingState.tsx`
2. Add progress bar support
3. Add Storybook stories for all chart types
4. Add tests

**Phase 2: Integrate with Base Components**
1. Update `EChartsWrapper` to use enhanced `ChartLoadingState`
2. Update `BaseChartContainer` to use `ChartLoadingState`
3. Test loading states with slow network

**Phase 3: Update Individual Charts** (19 charts)
1. Replace inline loading displays with `<ChartLoadingState />`
2. Remove duplicated loading JSX
3. Add appropriate `chartType` prop
4. Add progress indication for long-loading charts
5. Update tests

**Phase 4: Documentation**
1. Update component docs
2. Add loading state guidelines
3. Create visual loading state guide

### 2.4.5 Success Criteria

- [ ] `ChartLoadingState` component enhanced
- [ ] All 19+ charts use standard loading state
- [ ] Consistent loading UX across all charts
- [ ] Progress indication available for slow operations
- [ ] Loading states are accessible (ARIA labels)
- [ ] ~285 LOC eliminated
- [ ] All loading scenarios tested

**Effort**: 2 hours
**Risk**: Low (presentation component, no logic changes)
**Impact**: Medium (affects 19+ charts, improves UX)

---

## Quick Win #5: Add JSDoc Comments

### 2.5.1 Current State

**Problem**: Chart components lack comprehensive JSDoc documentation.

**Current State**:
- Most chart components have NO JSDoc comments
- Function/interface documentation is minimal
- Props are not documented
- Examples are not provided in comments
- IDE intellisense is limited

**Example of Current State** (EChartsTimeSeriesChart):
```typescript
// NO JSDoc before component
const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  loading,
  error,
  height = 400,
  // ... 40+ props with NO documentation
}) => {
  // Component implementation
};
```

**Impact**:
- Developers must read implementation to understand usage
- No inline prop documentation in IDE
- Harder to onboard new developers
- Increases cognitive load

### 2.5.2 Target State

**Solution**: Add comprehensive JSDoc comments to all chart components.

**Key Features**:
- Component-level documentation
- Prop-level documentation
- Usage examples in comments
- TypeScript intellisense integration
- Links to related components

### 2.5.3 API Design

```typescript
/**
 * Time Series Line Chart Component
 *
 * Displays time-based data as connected line segments with support for multiple series,
 * thresholds, deviation analysis, and interactive features.
 *
 * @example
 * ```tsx
 * <EChartsTimeSeriesChart
 *   data={[
 *     { name: 'Temperature', data: [[timestamp1, 72], [timestamp2, 73]], unit: '°F' }
 *   ]}
 *   height={400}
 *   showDataZoom
 *   showLegend
 * />
 * ```
 *
 * @example With Thresholds
 * ```tsx
 * <EChartsTimeSeriesChart
 *   data={temperatureSeries}
 *   thresholds={[
 *     { value: 75, name: 'High Limit', color: '#f44336' },
 *     { value: 68, name: 'Low Limit', color: '#2196f3' }
 *   ]}
 *   showSetpointLines
 * />
 * ```
 *
 * @see {@link TimeSeriesChartProps} for all available props
 * @see {@link useChartData} for data fetching
 */
const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  /**
   * Array of time series data to display. Each series contains:
   * - name: Display name for the series
   * - data: Array of [timestamp, value] tuples
   * - unit: Optional unit string (e.g., '°F', 'kW')
   * - color: Optional color override
   *
   * @example
   * ```tsx
   * data={[
   *   {
   *     name: 'Zone Temperature',
   *     data: [[1640000000000, 72], [1640003600000, 73]],
   *     unit: '°F',
   *     color: '#2196f3'
   *   }
   * ]}
   * ```
   */
  data,

  /**
   * Loading state - displays skeleton loader when true
   * @default false
   */
  loading,

  /**
   * Error object - displays error message when provided
   */
  error,

  /**
   * Chart height in pixels or CSS string
   * @default 400
   * @example height={500}
   * @example height="100%"
   */
  height = 400,

  /**
   * Chart title displayed at top center
   * @example title="Zone Temperature Trend"
   */
  title,

  /**
   * Enable horizontal zoom slider at bottom
   * @default true
   */
  showDataZoom = true,

  /**
   * Show legend with series names
   * @default true
   */
  showLegend = true,

  // ... other props with JSDoc
}) => {
  // Implementation
};
```

**JSDoc Template for Chart Components**:
```typescript
/**
 * [Component Name] Chart Component
 *
 * [Brief description of what the chart visualizes]
 *
 * Features:
 * - [Feature 1]
 * - [Feature 2]
 * - [Feature 3]
 *
 * @example Basic Usage
 * ```tsx
 * <ComponentName
 *   data={myData}
 *   height={400}
 * />
 * ```
 *
 * @example Advanced Usage
 * ```tsx
 * <ComponentName
 *   data={myData}
 *   height={400}
 *   [advanced props]
 * />
 * ```
 *
 * @see {@link ComponentNameProps} for all props
 * @see [Related Component 1]
 * @see [Related Component 2]
 */
```

### 2.5.4 Migration Path

**Phase 1: Create JSDoc Standards**
1. Create JSDoc style guide (`docs/JSDOC_STANDARDS.md`)
2. Create templates for common patterns
3. Add linting rules to enforce JSDoc
4. Document examples repository

**Phase 2: Core Components** (5-10 components)
1. EChartsTimeSeriesChart
2. EChartsAreaChart
3. EChartsBarChart
4. EChartsScatterPlot
5. EChartsHeatmap
6. EChartsWrapper
7. BaseChartContainer
8. UnifiedChartRenderer

**Phase 3: Supporting Components** (20-30 components)
1. Specialized charts (Gauge, Radar, Sankey, etc.)
2. Chart containers
3. Chart utilities
4. Chart hooks

**Phase 4: Remaining Components** (rest of 143 components)
1. Batch add JSDoc to remaining charts
2. Focus on public APIs first
3. Add examples where helpful

**Phase 5: Automation**
1. Add pre-commit hook to check for JSDoc
2. Add CI check for missing JSDoc
3. Generate API documentation from JSDoc

### 2.5.5 Success Criteria

- [ ] JSDoc style guide created
- [ ] All core chart components (8) have complete JSDoc
- [ ] At least 50% of chart components have JSDoc
- [ ] All public interfaces documented
- [ ] Examples provided for complex components
- [ ] IDE intellisense shows prop documentation
- [ ] Linting enforces JSDoc for new components
- [ ] Auto-generated API docs available

**Effort**: 4 hours
**Risk**: Very Low (documentation only, no code changes)
**Impact**: High (improves developer experience significantly)

---

## Quick Win #6: Consistent Default Props

### 2.6.1 Current State

**Problem**: Default prop values are inconsistent across chart components.

**Current Patterns Found**:

1. **Inline Defaults** (most common):
   ```typescript
   const MyChart: React.FC<Props> = ({
     height = 400,
     loading = false,
     showLegend = true,
     showDataZoom = true,
     enableToolbox = true,
     // ... inconsistent defaults across charts
   }) => { }
   ```

2. **Default Props** (rare, found in 2 test files):
   ```typescript
   MyChart.defaultProps = {
     height: 400,
     loading: false,
     // ... (deprecated pattern in React 18)
   };
   ```

**Analysis of Default Values Across Charts**:

| Prop | Occurrence Count | Different Defaults |
|------|-----------------|-------------------|
| `height` | 143 components | `400`, `'400px'`, `'100%'`, `500` |
| `loading` | 19 components | `false`, `undefined` |
| `error` | 25 components | `null`, `undefined` |
| `showLegend` | 40+ components | `true`, `false`, `undefined` |
| `showDataZoom` | 40+ components | `true`, `false`, `undefined` |
| `enableToolbox` | 40+ components | `true`, `false`, `undefined` |
| `showMarkerTags` | 30+ components | `true`, `false`, `undefined` |
| `enableAnimation` | 20+ components | `false`, `true`, `undefined` |

**Issues**:
- Same prop has different defaults in different charts
- Unclear which default value is "canonical"
- Hard to change defaults globally
- Inconsistent behavior across similar charts
- ~100 LOC of redundant default assignments

### 2.6.2 Target State

**Solution**: Create centralized default prop configuration.

**Key Features**:
- Single source of truth for defaults
- Type-safe defaults
- Easy to override per-component
- Easy to change globally
- Self-documenting

### 2.6.3 API Design

```typescript
// NEW FILE: src/config/chartDefaults.ts

/**
 * Centralized default values for all chart components
 *
 * These defaults apply to all chart types unless explicitly overridden.
 * Changing values here affects all charts that don't override them.
 */
export const CHART_DEFAULTS = {
  /**
   * Layout & Sizing
   */
  height: 400 as number | string,
  width: '100%' as number | string,
  minHeight: 300,

  /**
   * Loading & Error States
   */
  loading: false,
  error: null as Error | null,

  /**
   * Common Features
   */
  showLegend: true,
  showDataZoom: true,
  enableToolbox: true,
  showMarkerTags: true,
  showExportToolbar: true,

  /**
   * Performance
   */
  enableAnimation: false, // Disabled for performance
  enableDownsampling: false,
  downsamplingThreshold: 5000,

  /**
   * Data View
   */
  enableDataView: false, // Disabled due to overlay issues
  enableMagicType: false,

  /**
   * Export
   */
  exportPosition: 'top-right' as const,

  /**
   * Theming
   */
  customColors: undefined as string[] | undefined,

  /**
   * Accessibility
   */
  enableErrorBoundary: true,

} as const;

/**
 * Chart-type-specific default overrides
 */
export const CHART_TYPE_DEFAULTS = {
  timeSeries: {
    ...CHART_DEFAULTS,
    showDataZoom: true,
    enableDownsampling: true,
  },

  bar: {
    ...CHART_DEFAULTS,
    orientation: 'vertical' as const,
    showValues: true,
    showDataZoom: false,
  },

  scatter: {
    ...CHART_DEFAULTS,
    showRegression: true,
    showDataZoom: false,
  },

  heatmap: {
    ...CHART_DEFAULTS,
    showValues: false,
    showDataZoom: false,
    showLegend: false, // Uses visual map instead
    colorScheme: 'default' as const,
  },

  area: {
    ...CHART_DEFAULTS,
    stacked: false,
    showDataZoom: true,
  },

  gauge: {
    ...CHART_DEFAULTS,
    showDataZoom: false,
    showLegend: false,
  },

  radar: {
    ...CHART_DEFAULTS,
    showDataZoom: false,
  },
} as const;

/**
 * Helper function to get defaults for a chart type
 */
export function getChartDefaults<T extends keyof typeof CHART_TYPE_DEFAULTS>(
  chartType: T
): typeof CHART_TYPE_DEFAULTS[T] {
  return CHART_TYPE_DEFAULTS[chartType];
}

/**
 * Helper function to merge custom props with defaults
 */
export function withDefaults<T extends Record<string, any>>(
  props: T,
  defaults: Partial<T> = CHART_DEFAULTS as any
): Required<T> {
  return { ...defaults, ...props } as Required<T>;
}

/**
 * Type-safe default prop helper for components
 */
export function useChartDefaults<T extends Record<string, any>>(
  props: T,
  chartType?: keyof typeof CHART_TYPE_DEFAULTS
): T {
  const defaults = chartType
    ? getChartDefaults(chartType)
    : CHART_DEFAULTS;

  return { ...defaults, ...props } as T;
}
```

**Usage Pattern**:
```typescript
// BEFORE (100+ LOC across all charts):
const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 400,
  showDataZoom = true,
  showLegend = true,
  enableToolbox = true,
  enableDataView = false,
  enableMagicType = false,
  showMarkerTags = true,
  // ... 30+ more props with inline defaults
}) => { }

// AFTER (much cleaner):
import { CHART_TYPE_DEFAULTS } from '../../config/chartDefaults';

const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = (props) => {
  // Merge props with defaults
  const {
    data,
    loading,
    error,
    height,
    showDataZoom,
    showLegend,
    enableToolbox,
    // ... all props
  } = { ...CHART_TYPE_DEFAULTS.timeSeries, ...props };

  // Component implementation uses destructured values
};

// OR using hook:
const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = (props) => {
  const chartProps = useChartDefaults(props, 'timeSeries');

  // Component implementation uses chartProps.height, chartProps.loading, etc.
};
```

**Alternative Pattern (Minimal Changes)**:
```typescript
// For minimal migration, just reference defaults:
const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  loading = CHART_DEFAULTS.loading,
  error = CHART_DEFAULTS.error,
  height = CHART_DEFAULTS.height,
  showDataZoom = CHART_TYPE_DEFAULTS.timeSeries.showDataZoom,
  showLegend = CHART_DEFAULTS.showLegend,
  // ... reference centralized defaults
}) => { }
```

### 2.6.4 Migration Path

**Phase 1: Create Defaults Configuration**
1. Create `src/config/chartDefaults.ts`
2. Audit existing defaults across all charts
3. Determine canonical default values
4. Add TypeScript types
5. Add tests for default values
6. Document rationale for each default

**Phase 2: Core Components** (5 components)
1. EChartsTimeSeriesChart
2. EChartsAreaChart
3. EChartsBarChart
4. EChartsScatterPlot
5. EChartsHeatmap
Test thoroughly to ensure no behavior changes

**Phase 3: Base Components** (3 components)
1. EChartsWrapper
2. BaseChartContainer
3. UnifiedChartRenderer
Ensure defaults propagate correctly

**Phase 4: Remaining Charts** (135 components)
1. Batch update all other charts
2. Use find/replace with verification
3. Run full test suite after each batch
4. Monitor for regressions

**Phase 5: Documentation**
1. Document default values
2. Add migration guide
3. Create ADR (Architecture Decision Record)
4. Update component guidelines

### 2.6.5 Success Criteria

- [ ] `chartDefaults.ts` created with all defaults
- [ ] All 143 charts use centralized defaults
- [ ] No inline default values in chart components
- [ ] All defaults documented with rationale
- [ ] Tests verify default behavior
- [ ] Easy to change defaults globally
- [ ] ~100 LOC of redundant defaults eliminated
- [ ] No behavior regressions

**Effort**: 3 hours
**Risk**: Medium (potential for subtle behavior changes)
**Impact**: Medium (improves consistency and maintainability)

---

## Implementation Priority

### Recommended Order

1. **#1 - Centralize Resize Handling** (2h)
   - **Why First**: Already has working hook, just needs adoption
   - **Risk**: Low
   - **Impact**: Immediate improvement to all 143 charts via EChartsWrapper

2. **#3 - Extract Common Validators** (2h)
   - **Why Second**: Pure functions, easy to test, no UI changes
   - **Risk**: Low
   - **Benefit**: Improves data quality immediately

3. **#2 - Standardize Error Handling** (3h)
   - **Why Third**: Simple UI component, high visibility
   - **Risk**: Low
   - **Benefit**: Better UX, easier debugging

4. **#4 - Standardize Loading States** (2h)
   - **Why Fourth**: Similar to error handling, completes the UX trio
   - **Risk**: Low
   - **Benefit**: Consistent loading experience

5. **#6 - Consistent Default Props** (3h)
   - **Why Fifth**: Requires careful migration, but high long-term value
   - **Risk**: Medium (potential for subtle changes)
   - **Benefit**: Easier to maintain, clearer intent

6. **#5 - Add JSDoc Comments** (4h)
   - **Why Last**: Can be done incrementally, doesn't block other work
   - **Risk**: Very Low
   - **Benefit**: Better DX, can be done continuously

### Parallel Workstreams

These can be done in parallel by different developers:

- **Stream A**: #1 (Resize) → #3 (Validators) → #6 (Defaults)
- **Stream B**: #2 (Errors) → #4 (Loading) → #5 (JSDoc)

**Total Time (Serial)**: 16 hours
**Total Time (Parallel)**: ~8-10 hours with 2 developers

---

## Testing Strategy

### Unit Tests
- Validator functions (100% coverage)
- Default value merging
- Hook behavior

### Integration Tests
- Resize behavior in grid layouts
- Error display across chart types
- Loading state transitions
- Data validation pipeline

### Visual Regression Tests
- Loading states
- Error displays
- Chart with new defaults

### Performance Tests
- Resize performance (before/after)
- Validation overhead
- Memory leaks

---

## Rollback Plan

### For Each Quick Win

1. **Resize Handling**
   - Revert to individual implementations
   - Hook is optional, can coexist with old code

2. **Error/Loading States**
   - Components can fall back to inline displays
   - No data changes, safe to revert

3. **Validators**
   - Pure functions, no side effects
   - Can remove imports and restore inline validation

4. **Default Props**
   - Most risky - may need careful rollback
   - Keep old default values in comments during migration

5. **JSDoc**
   - Zero risk - documentation only
   - No rollback needed

---

## Success Metrics

### Code Quality
- [ ] -1,200 LOC (lines of code removed)
- [ ] +600 LOC (new utilities and hooks)
- [ ] Net: -600 LOC (~0.5% reduction in codebase)

### Consistency
- [ ] 100% of charts use standard resize handling
- [ ] 100% of charts use standard error display
- [ ] 100% of charts use standard loading states
- [ ] 100% of charts use centralized validators
- [ ] 100% of charts use centralized defaults

### Developer Experience
- [ ] 50%+ of components have JSDoc
- [ ] IDE intellisense shows prop docs
- [ ] Easier onboarding for new developers
- [ ] Fewer questions about "how to..."

### Maintenance
- [ ] Easier to change resize behavior globally
- [ ] Easier to change error display
- [ ] Easier to update default values
- [ ] Easier to add new validators

---

## Dependencies & Prerequisites

### Before Starting
- [ ] Review and approve specifications
- [ ] Create feature branch
- [ ] Set up test environment
- [ ] Back up current code state

### During Implementation
- [ ] Run tests after each change
- [ ] Update documentation
- [ ] Create ADRs for major decisions
- [ ] Monitor for regressions

### After Completion
- [ ] Full test suite passes
- [ ] Visual regression tests pass
- [ ] Performance tests pass
- [ ] Documentation updated
- [ ] Team review completed
- [ ] Merge to main branch

---

## Risks & Mitigation

### Risk 1: Subtle Behavior Changes (Medium)
**Mitigation**:
- Comprehensive testing before/after
- Visual regression tests
- Gradual rollout (core charts first)
- Keep old code in comments during migration
- Easy rollback plan

### Risk 2: Performance Regression (Low)
**Mitigation**:
- Performance benchmarks before/after
- Profile resize handling
- Monitor bundle size
- Test with large datasets

### Risk 3: Breaking Changes in Props (Low)
**Mitigation**:
- Maintain backward compatibility
- Deprecation warnings before removal
- Update TypeScript types
- Migration guide for breaking changes

### Risk 4: Incomplete Migration (Medium)
**Mitigation**:
- Track migration progress
- Automated checks for old patterns
- Linting rules to prevent old patterns
- Documentation of migration status

---

## Future Opportunities (Not in Quick Wins)

These were identified but require more effort:

1. **Centralized Theme Management** (8h)
2. **Unified Data Fetching** (12h)
3. **Common Animation Library** (6h)
4. **Shared Export Utilities** (4h)
5. **Accessibility Improvements** (10h)
6. **Performance Monitoring** (8h)

Total potential savings: 48+ hours, ~3,000+ LOC

---

## Appendix A: File Locations

### Existing Files to Modify
- `src/hooks/useChartResize.ts` (exists, needs adoption)
- `src/utils/typeGuards.ts` (exists, needs expansion)
- `src/components/charts/EChartsWrapper.tsx`
- `src/components/charts/ChartLoadingState.tsx` (exists, needs enhancement)
- 143 chart component files

### New Files to Create
- `src/utils/chartValidators.ts` (new)
- `src/components/charts/ChartErrorDisplay.tsx` (new)
- `src/config/chartDefaults.ts` (new)
- `docs/JSDOC_STANDARDS.md` (new)
- `docs/refactoring/MIGRATION_GUIDE.md` (new)

---

## Appendix B: Code Examples

### Before & After Comparison

**Before** (EChartsTimeSeriesChart - 1192 lines):
```typescript
// Lines 133-140: Custom cleanup
useEffect(() => {
  return () => {
    if (chartInstanceRef.current?._resizeCleanup) {
      (chartInstanceRef.current)._resizeCleanup();
    }
  };
}, []);

// Lines 150-187: Custom validation (38 LOC)
const processedData = useMemo(() => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  const filtered = data.filter(series => {
    const isValid = series &&
      series.data &&
      Array.isArray(series.data) &&
      series.data.length > 0;
    return isValid;
  });
  return filtered;
}, [data]);

// Lines 1142-1160: Custom resize (19 LOC)
const handleResize = () => {
  if (instance) {
    instance.resize();
  }
};
window.addEventListener('resize', handleResize);
window.addEventListener('grid-resize', handleResize);

// Lines 1046-1060: Inline error display (15 LOC)
if (error) {
  return (
    <Box sx={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'error.main',
    }}>
      Error loading chart: {error.message}
    </Box>
  );
}
```

**After** (EChartsTimeSeriesChart - ~1100 lines):
```typescript
// Resize handling (2 LOC):
const { containerRef, registerChart } = useChartResize({ chartId: 'timeseries' });

// Validation (1 LOC):
const validData = validateChartData(data);

// Error display (1 LOC):
<ChartErrorDisplay error={error} chartType="Time Series" height={height} />

// Defaults (1 LOC):
const chartProps = useChartDefaults(props, 'timeSeries');

// Total saved: ~70 LOC per chart
```

---

## Appendix C: References

### Related Documentation
- Architecture Decision Records (ADRs)
- Component Guidelines
- Testing Standards
- Code Style Guide

### External Resources
- React 18 Best Practices
- TypeScript Documentation
- ECharts Documentation
- Accessibility Guidelines (WCAG 2.1)

---

## Appendix D: Questions & Answers

**Q: Will this break existing charts?**
A: No. All changes are backward-compatible. We'll maintain old patterns during migration and only remove them after full migration.

**Q: Do we need to update all 143 charts at once?**
A: No. We can migrate gradually. Core changes to `EChartsWrapper` will benefit all charts immediately. Individual chart updates can happen over time.

**Q: What if we find issues during migration?**
A: Each quick win has a rollback plan. We can revert individual changes without affecting others.

**Q: How do we test this thoroughly?**
A: Unit tests for utilities, integration tests for components, visual regression tests for UI, and manual testing of critical charts.

**Q: What's the maintenance burden of new utilities?**
A: Lower than current state. Centralized code is easier to maintain than duplicated code. We'll reduce overall LOC and complexity.

---

## Sign-off

**Specifications Prepared By**: SPARC Specification Agent
**Date**: 2025-10-13
**Status**: Ready for Review

**Approvals Needed**:
- [ ] Tech Lead Review
- [ ] Architecture Review
- [ ] QA Review
- [ ] Product Owner Review

**Next Steps**:
1. Review specifications with team
2. Estimate actual implementation time
3. Assign quick wins to developers
4. Create implementation tracking board
5. Begin Phase 1 implementation
