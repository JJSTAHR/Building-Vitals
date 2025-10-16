# ChartLoadingState Integration Guide

**Version:** 1.0.0
**Date:** 2025-01-31
**Quick Win:** #4 - Standardized Loading States

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Basic Usage](#basic-usage)
4. [Advanced Usage](#advanced-usage)
5. [Migration Guide](#migration-guide)
6. [API Reference](#api-reference)
7. [Examples](#examples)
8. [Best Practices](#best-practices)

---

## Overview

The enhanced `ChartLoadingState` component provides a comprehensive, production-ready solution for handling all chart loading states, including:

- **Multiple variants**: Spinner and skeleton loaders
- **Chart-specific skeletons**: Line, bar, heatmap, scatter, and generic
- **Progress indication**: Percentage and step-based tracking
- **ECharts integration**: Native loading state management
- **Error handling**: Consistent error display with retry functionality
- **Empty states**: No-data messaging with refresh options
- **Responsive sizing**: Small, medium, and large variants

---

## Features

### 1. Loading Variants

#### Spinner Variant (Default)
- Circular progress indicator
- Customizable size (small, medium, large)
- Optional progress percentage
- Optional step tracking

#### Skeleton Variant
- Chart-specific placeholder UI
- Realistic loading animations
- Maintains layout stability
- Reduces perceived loading time

### 2. Skeleton Types

| Type | Description | Best For |
|------|-------------|----------|
| `line` | Multiple horizontal lines with varying widths | Time series charts, line charts |
| `bar` | Vertical bars with animation | Bar charts, column charts |
| `heatmap` | Grid of animated squares | Calendar heatmaps, correlation matrices |
| `scatter` | Random dot patterns | Scatter plots, bubble charts |
| `generic` | Simple rectangular skeleton | Any chart type (fallback) |

### 3. Progress Indication

- **Percentage**: Show 0-100% completion
- **Steps**: Display "Step X of Y" for multi-stage loading
- **Combined**: Show both percentage and steps
- **Progress bar**: Visual linear progress indicator

---

## Basic Usage

### Simple Spinner Loading

```tsx
import { ChartLoadingState } from '@/components/charts/ChartLoadingState';

function MyChart() {
  const { data, isLoading, error } = useChartData();

  return (
    <div>
      <ChartLoadingState
        loading={isLoading}
        error={error}
        hasData={data.length > 0}
        loadingMessage="Loading chart data..."
      />
      {!isLoading && !error && data.length > 0 && (
        <MyChartComponent data={data} />
      )}
    </div>
  );
}
```

### Skeleton Loader

```tsx
<ChartLoadingState
  loading={isLoading}
  hasData={data.length > 0}
  variant="skeleton"
  skeletonType="line"
  height={400}
/>
```

### With Progress Indication

```tsx
<ChartLoadingState
  loading={isLoading}
  hasData={false}
  showProgress={true}
  progress={67}
  currentStep={2}
  totalSteps={3}
  loadingMessage="Fetching sensor data..."
/>
```

---

## Advanced Usage

### ECharts Integration

When using with ECharts, pass the chart ref to enable native loading states:

```tsx
import React, { useRef } from 'react';
import EChartsReact from 'echarts-for-react';
import { ChartLoadingState } from '@/components/charts/ChartLoadingState';

function EChartsExample() {
  const chartRef = useRef<EChartsReact>(null);
  const { data, isLoading, error, refetch } = useChartData();

  return (
    <div style={{ height: 400 }}>
      <ChartLoadingState
        loading={isLoading}
        error={error}
        hasData={data.length > 0}
        chartRef={chartRef}
        onRetry={refetch}
        height={400}
      />
      <EChartsReact
        ref={chartRef}
        option={chartOptions}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
```

### Multi-Step Loading

For complex data fetching scenarios:

```tsx
function ComplexChart() {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);

  const steps = [
    'Fetching points...',
    'Loading historical data...',
    'Calculating statistics...',
    'Rendering chart...'
  ];

  useEffect(() => {
    // Update progress based on step
    setProgress((step / steps.length) * 100);
  }, [step]);

  return (
    <ChartLoadingState
      loading={isLoading}
      hasData={false}
      showProgress={true}
      progress={progress}
      currentStep={step}
      totalSteps={steps.length}
      loadingMessage={steps[step - 1]}
      size="large"
    />
  );
}
```

### Custom Error Handling

```tsx
function ChartWithErrorRecovery() {
  const { data, isLoading, error, refetch } = useChartData();
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    refetch();
  };

  return (
    <ChartLoadingState
      loading={isLoading}
      error={error}
      hasData={data.length > 0}
      onRetry={handleRetry}
      errorMessage={
        retryCount >= 3
          ? 'Unable to load data after multiple attempts. Please contact support.'
          : 'Failed to load chart data. Please try again.'
      }
    />
  );
}
```

### Skeleton with Height Animation

```tsx
function ResponsiveChart() {
  const [height, setHeight] = useState(400);

  return (
    <ChartLoadingState
      loading={isLoading}
      hasData={false}
      variant="skeleton"
      skeletonType="bar"
      height={height}
    />
  );
}
```

---

## Migration Guide

### From Old ChartLoadingState

The new component is **backward compatible** with the previous version. No breaking changes.

#### Before:
```tsx
<ChartLoadingState
  loading={isLoading}
  error={error}
  hasData={data.length > 0}
  chartRef={chartRef}
  onRetry={refetch}
  height={400}
  loadingMessage="Loading..."
/>
```

#### After (Enhanced):
```tsx
<ChartLoadingState
  loading={isLoading}
  error={error}
  hasData={data.length > 0}
  chartRef={chartRef}
  onRetry={refetch}
  height={400}
  loadingMessage="Loading..."
  // NEW: Add skeleton loader
  variant="skeleton"
  skeletonType="line"
  // NEW: Add progress tracking
  showProgress={true}
  progress={loadingProgress}
/>
```

### From Custom Loading Components

#### Before:
```tsx
// Custom loading spinner
{isLoading && (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
    <CircularProgress />
    <Typography>Loading...</Typography>
  </Box>
)}

// Custom error display
{error && (
  <Alert severity="error">
    {error.message}
    <Button onClick={refetch}>Retry</Button>
  </Alert>
)}

// Custom no-data state
{!isLoading && !error && data.length === 0 && (
  <Typography>No data available</Typography>
)}
```

#### After:
```tsx
<ChartLoadingState
  loading={isLoading}
  error={error}
  hasData={data.length > 0}
  onRetry={refetch}
  loadingMessage="Loading..."
  errorMessage={error?.message}
  noDataMessage="No data available"
/>
```

**Benefits:**
- **90% less code** - Single component handles all states
- **Consistent UX** - Same loading experience across all charts
- **Better performance** - Optimized animations and rendering
- **Accessibility** - Built-in ARIA labels and keyboard support

---

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | `boolean` | Required | Whether the chart is loading |
| `hasData` | `boolean` | Required | Whether data is available |
| `error` | `Error \| null` | `undefined` | Error object if loading failed |
| `chartRef` | `React.RefObject<EChartsReactCore>` | `undefined` | ECharts instance ref for native loading |
| `onRetry` | `() => void` | `undefined` | Callback to retry loading |
| `height` | `string \| number` | `400` | Container height |
| `loadingMessage` | `string` | `'Loading chart data...'` | Loading message text |
| `noDataMessage` | `string` | `'No data available...'` | No data message text |
| `errorMessage` | `string` | `undefined` | Custom error message (overrides error.message) |
| `variant` | `'spinner' \| 'skeleton'` | `'spinner'` | Loading indicator type |
| `skeletonType` | `'line' \| 'bar' \| 'heatmap' \| 'scatter' \| 'generic'` | `'generic'` | Skeleton loader style |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Spinner size |
| `showProgress` | `boolean` | `false` | Show progress indicator |
| `progress` | `number` | `undefined` | Progress percentage (0-100) |
| `currentStep` | `number` | `undefined` | Current step number |
| `totalSteps` | `number` | `undefined` | Total number of steps |

### Type Exports

```tsx
import type {
  ChartLoadingStateProps,
  ChartLoadingVariant,
  SkeletonType,
  LoadingSize,
} from '@/components/charts/ChartLoadingState';
```

---

## Examples

### Example 1: Time Series Chart

```tsx
import { ChartLoadingState } from '@/components/charts/ChartLoadingState';
import { useTimeSeriesData } from '@/hooks/useTimeSeriesData';

function TimeSeriesChart({ pointIds }: { pointIds: string[] }) {
  const { data, isLoading, error, refetch } = useTimeSeriesData(pointIds);

  return (
    <Box sx={{ height: 500 }}>
      <ChartLoadingState
        loading={isLoading}
        error={error}
        hasData={data.length > 0}
        onRetry={refetch}
        variant="skeleton"
        skeletonType="line"
        height={500}
        loadingMessage="Loading time series data..."
        errorMessage="Failed to load sensor readings. Please check your connection."
        noDataMessage="No data points available for the selected time range."
      />
      {!isLoading && !error && data.length > 0 && (
        <EChartsReact option={buildTimeSeriesOptions(data)} />
      )}
    </Box>
  );
}
```

### Example 2: Bar Chart with Progress

```tsx
function BarChartWithProgress({ siteId }: { siteId: string }) {
  const [progress, setProgress] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['barChart', siteId],
    queryFn: async () => {
      setProgress(25);
      const points = await fetchPoints(siteId);
      setProgress(50);
      const values = await fetchValues(points);
      setProgress(75);
      const aggregated = await aggregateData(values);
      setProgress(100);
      return aggregated;
    },
  });

  return (
    <ChartLoadingState
      loading={isLoading}
      hasData={data?.length > 0}
      variant="skeleton"
      skeletonType="bar"
      showProgress={true}
      progress={progress}
      height={400}
    />
  );
}
```

### Example 3: Heatmap with Steps

```tsx
function HeatmapChart({ dataRange }: { dataRange: DateRange }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Fetching point list...',
    'Loading historical data...',
    'Calculating correlations...',
    'Generating heatmap...'
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['heatmap', dataRange],
    queryFn: async () => {
      setStep(1);
      const points = await getPoints();
      setStep(2);
      const history = await getHistory(points, dataRange);
      setStep(3);
      const correlations = calculateCorrelations(history);
      setStep(4);
      return correlations;
    },
  });

  return (
    <ChartLoadingState
      loading={isLoading}
      hasData={!!data}
      variant="skeleton"
      skeletonType="heatmap"
      showProgress={true}
      currentStep={step}
      totalSteps={steps.length}
      loadingMessage={steps[step - 1]}
      height={600}
    />
  );
}
```

### Example 4: Scatter Plot with Size Options

```tsx
function ScatterPlot({ size }: { size: 'small' | 'medium' | 'large' }) {
  const { data, isLoading, error } = useScatterData();

  const height = size === 'small' ? 300 : size === 'large' ? 600 : 450;

  return (
    <ChartLoadingState
      loading={isLoading}
      error={error}
      hasData={data?.length > 0}
      variant="skeleton"
      skeletonType="scatter"
      size={size}
      height={height}
    />
  );
}
```

### Example 5: Retry with Exponential Backoff

```tsx
function ChartWithSmartRetry() {
  const [retryDelay, setRetryDelay] = useState(1000);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['chartData'],
    queryFn: fetchChartData,
    retry: 3,
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 10000);
      setRetryDelay(delay);
      return delay;
    },
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['chartData'] });
  };

  return (
    <ChartLoadingState
      loading={isLoading}
      error={error}
      hasData={!!data}
      onRetry={handleRetry}
      errorMessage={`Failed to load data. Retrying in ${retryDelay / 1000}s...`}
    />
  );
}
```

---

## Best Practices

### 1. Choose the Right Variant

**Use Spinner When:**
- First-time loading
- Quick operations (<2 seconds)
- Mobile devices (better performance)
- Unknown chart type

**Use Skeleton When:**
- Subsequent loads (users know what to expect)
- Slower operations (2+ seconds)
- Desktop devices (richer experience)
- Known chart layout

### 2. Match Skeleton to Chart Type

```tsx
// Line chart → line skeleton
<ChartLoadingState variant="skeleton" skeletonType="line" />

// Bar chart → bar skeleton
<ChartLoadingState variant="skeleton" skeletonType="bar" />

// Heatmap → heatmap skeleton
<ChartLoadingState variant="skeleton" skeletonType="heatmap" />

// Unknown → generic skeleton
<ChartLoadingState variant="skeleton" skeletonType="generic" />
```

### 3. Provide Meaningful Messages

```tsx
// ✅ Good: Specific and actionable
<ChartLoadingState
  loadingMessage="Fetching last 7 days of temperature readings..."
  errorMessage="Network error. Check your connection and try again."
  noDataMessage="No temperature readings found for this period. Try a different date range."
/>

// ❌ Bad: Generic and unhelpful
<ChartLoadingState
  loadingMessage="Loading..."
  errorMessage="Error"
  noDataMessage="No data"
/>
```

### 4. Use Progress for Multi-Step Operations

```tsx
const steps = [
  'Authenticating...',
  'Fetching points...',
  'Loading data...',
  'Processing results...'
];

<ChartLoadingState
  showProgress={true}
  currentStep={currentStep}
  totalSteps={steps.length}
  loadingMessage={steps[currentStep - 1]}
/>
```

### 5. Handle Errors Gracefully

```tsx
// Always provide retry functionality
<ChartLoadingState
  error={error}
  onRetry={refetch}
  errorMessage={
    error?.response?.status === 404
      ? 'Data not found. This chart may have been deleted.'
      : error?.response?.status === 403
      ? 'Access denied. Please contact your administrator.'
      : 'Failed to load chart. Please try again.'
  }
/>
```

### 6. Optimize Height for Different Screens

```tsx
function ResponsiveChart() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const height = isMobile ? 300 : 500;

  return (
    <ChartLoadingState
      loading={isLoading}
      hasData={false}
      height={height}
      size={isMobile ? 'small' : 'medium'}
    />
  );
}
```

### 7. Test All States

```tsx
// ✅ Test loading state
<ChartLoadingState loading={true} hasData={false} />

// ✅ Test error state
<ChartLoadingState loading={false} error={new Error('Test error')} hasData={false} />

// ✅ Test no data state
<ChartLoadingState loading={false} hasData={false} />

// ✅ Test loaded state
<ChartLoadingState loading={false} hasData={true} />
```

---

## Performance Tips

### 1. Avoid Re-renders

```tsx
// ✅ Memoize loading message
const loadingMessage = useMemo(
  () => `Loading ${pointIds.length} data points...`,
  [pointIds.length]
);

<ChartLoadingState loadingMessage={loadingMessage} />
```

### 2. Use ECharts Native Loading

```tsx
// ✅ Let ECharts handle its own loading
<ChartLoadingState chartRef={chartRef} loading={isLoading} />

// ❌ Don't render both
{isLoading && <Spinner />}
<ChartLoadingState chartRef={chartRef} loading={isLoading} />
```

### 3. Lazy Load Heavy Skeletons

```tsx
// For heatmaps with 1000+ cells, use generic skeleton
const skeletonType = cellCount > 500 ? 'generic' : 'heatmap';

<ChartLoadingState variant="skeleton" skeletonType={skeletonType} />
```

---

## Troubleshooting

### Problem: Skeleton doesn't match chart layout

**Solution:** Use the correct `skeletonType` or fall back to `generic`:

```tsx
<ChartLoadingState
  variant="skeleton"
  skeletonType={chartType === 'line' ? 'line' : 'generic'}
/>
```

### Problem: Loading state flashes briefly

**Solution:** Add a minimum loading time:

```tsx
const [showLoading, setShowLoading] = useState(false);

useEffect(() => {
  if (isLoading) {
    setShowLoading(true);
  } else {
    const timer = setTimeout(() => setShowLoading(false), 300);
    return () => clearTimeout(timer);
  }
}, [isLoading]);

<ChartLoadingState loading={showLoading} />
```

### Problem: Progress not updating

**Solution:** Ensure progress is a controlled value:

```tsx
const [progress, setProgress] = useState(0);

// Update progress in your data fetching logic
const fetchData = async () => {
  setProgress(0);
  const step1 = await fetch1(); // setProgress(33)
  const step2 = await fetch2(); // setProgress(66)
  const step3 = await fetch3(); // setProgress(100)
};
```

---

## Conclusion

The enhanced `ChartLoadingState` component provides a production-ready, comprehensive solution for all chart loading scenarios. By following this guide and best practices, you can deliver a consistent, professional user experience across your entire application.

For questions or feature requests, please contact the development team or open an issue in the repository.

---

**Last Updated:** 2025-01-31
**Maintained By:** Building Vitals Development Team
