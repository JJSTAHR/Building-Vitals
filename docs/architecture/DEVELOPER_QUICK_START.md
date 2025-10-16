# Developer Quick Start: Unified Data Fetching

**Last Updated:** 2025-10-13
**Target Audience:** Chart Developers

---

## TL;DR

**Golden Rules:**
1. ✅ ALWAYS use `useChartData` hook for data fetching
2. ✅ ALWAYS use paginated endpoint (it's automatic)
3. ✅ NEVER aggregate or downsample data yourself
4. ✅ Use chart adapters for transformations
5. ✅ Apply `useBaseChartOptions` for ECharts config

---

## Quick Example: Creating a New Chart

```typescript
// src/components/charts/MyNewChart.tsx

import { useChartData } from '../../hooks/useChartData';
import { useBaseChartOptions } from '../../hooks/useBaseChartOptions';
import ReactECharts from 'echarts-for-react';

interface MyNewChartProps {
  selectedPoints: Point[];
  timeRange?: string;
}

export function MyNewChart({ selectedPoints, timeRange }: MyNewChartProps) {
  // Step 1: Fetch data (automatic pagination, raw data, binary transfer)
  const { data, echartsConfig, metadata, isLoading, error } = useChartData({
    selectedPoints,
    timeRange,
    chartType: 'my-new-chart', // Optional: for custom adapter
  });

  // Step 2: Get base ECharts options (automatic optimization)
  const baseOptions = useBaseChartOptions(
    metadata?.totalDataPoints || 0,
    'my-new-chart'
  );

  if (isLoading) return <ChartLoadingSkeleton />;
  if (error) return <ChartErrorBoundary error={error} />;

  // Step 3: Render chart
  return (
    <ReactECharts
      option={{
        ...baseOptions,           // Base config with optimizations
        ...echartsConfig,          // Large dataset config (if needed)
        series: data.series,       // Your data
        // ... your custom options
      }}
      style={{ height: '400px', width: '100%' }}
    />
  );
}
```

**That's it!** Data is fetched at native collection intervals, optimized for rendering, and ready to display.

---

## Common Patterns

### Pattern 1: Basic Time Series Chart

```typescript
function TimeSeriesChart({ selectedPoints }: Props) {
  const { data, echartsConfig, metadata } = useChartData({
    selectedPoints,
    chartType: 'timeseries', // Uses TimeSeriesAdapter (pass-through)
  });

  const baseOptions = useBaseChartOptions(
    metadata?.totalDataPoints || 0,
    'timeseries'
  );

  return (
    <ReactECharts
      option={{
        ...baseOptions,
        ...echartsConfig,
        series: data.series,
        xAxis: { type: 'time' },
        yAxis: { type: 'value' },
      }}
    />
  );
}
```

### Pattern 2: SPC Chart with Control Limits

```typescript
function SPCChart({ selectedPoints }: Props) {
  const { data, echartsConfig, metadata } = useChartData({
    selectedPoints,
    chartType: 'spc',
    chartOptions: {
      enableSPC: {
        ucl: 3,              // 3 standard deviations
        centerLine: 'mean',
      },
    },
  });

  // Adapter provides control limit series automatically
  const { series, additionalSeries, chartSpecificData } = data;

  return (
    <>
      <ReactECharts
        option={{
          series: [
            ...series,              // Data series
            ...additionalSeries,    // UCL, Center Line, LCL
          ],
          ...echartsConfig,
        }}
      />
      {/* Display violations */}
      {chartSpecificData?.violations && (
        <ViolationsList violations={chartSpecificData.violations} />
      )}
    </>
  );
}
```

### Pattern 3: Chart with Multiple Metrics

```typescript
function EconomizerChart({ selectedPoints }: Props) {
  const { data, echartsConfig, metadata } = useChartData({
    selectedPoints,
    chartType: 'economizer',
    chartOptions: {
      enableEconomizer: {
        oatPointName: 'site/oat',
        satPointName: 'site/sat',
        ratPointName: 'site/rat',
      },
    },
  });

  const efficiency = data.chartSpecificData?.efficiency || 0;

  return (
    <>
      <Typography>Economizer Efficiency: {efficiency.toFixed(1)}%</Typography>
      <ReactECharts option={{ series: data.series, ...echartsConfig }} />
    </>
  );
}
```

---

## Hook Options Reference

### `useChartData` Options

```typescript
interface ChartDataOptions {
  // REQUIRED
  selectedPoints: Point[];              // Points to fetch data for

  // Optional
  timeRange?: string;                   // '24h', '7d', '30d', '365d'
  customStartDate?: string;             // ISO 8601 format
  customEndDate?: string;               // ISO 8601 format
  monitorId?: string;                   // For global time range sync
  refreshInterval?: number;             // Auto-refresh in ms
  enabled?: boolean;                    // Default: true

  // Chart-specific
  chartType?: string;                   // 'timeseries', 'spc', 'economizer', etc.
  chartOptions?: {
    enableSPC?: { ... };
    enableEconomizer?: { ... };
    enableDeviation?: { ... };
  };

  // Performance
  enableLargeDatasetMode?: boolean;     // Auto-enabled for >2000 points
  progressiveRenderingThreshold?: number; // Default: 10000
  samplingStrategy?: 'lttb' | 'average' | 'min-max' | 'none';

  // Binary transfer
  useBinary?: boolean;                  // Default: true (MessagePack)
}
```

### `useChartData` Return Value

```typescript
interface ChartDataResult {
  // Main data
  data: {
    series: ChartSeries[];              // ECharts series format
  };

  // Metadata
  metadata: {
    totalDataPoints: number;            // Count across all series
    collectionInterval: number;         // Detected interval (ms)
    hasRawData: boolean;                // Always true
    performanceMetrics: { ... };
  };

  // ECharts config (apply automatically)
  echartsConfig: {
    large: boolean;
    largeThreshold: number;
    progressive: number;
    progressiveThreshold: number;
    sampling: string;
  };

  // Query state
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

---

## Chart Type Configuration

**Location:** `src/config/chartDataConfig.ts`

**Available Chart Types:**
- `timeseries` - Default time series (pass-through)
- `spc` - Statistical Process Control
- `economizer` - Perfect Economizer analysis
- `deviation` - Deviation heatmap
- `gauge` - Gauge/current value

**Adding a New Type:**

```typescript
// 1. Add to configuration
export const CHART_DATA_CONFIG = {
  chartTypes: {
    'my-new-chart': {
      samplingStrategy: 'lttb',
      progressiveThreshold: 10000,
    },
  },
};

// 2. Create adapter (optional)
// src/adapters/chart-adapters/MyNewChartAdapter.ts
export class MyNewChartAdapter extends BaseChartAdapter {
  transform(input: ChartDataInput): ChartDataOutput {
    // Your transformation logic
  }
}

// 3. Register adapter
import { registerChartAdapter } from '../adapters/chart-adapters';
registerChartAdapter('my-new-chart', MyNewChartAdapter);
```

---

## Performance Tips

### Automatic Optimizations

These are applied automatically by `useChartData` + `useBaseChartOptions`:

- ✅ **Binary transfer:** MessagePack reduces payload by 60%
- ✅ **Large dataset mode:** Enabled for >2000 points
- ✅ **Progressive rendering:** Chunks for >10,000 points
- ✅ **LTTB sampling:** Visual downsampling (data preserved)
- ✅ **WebGL mode:** GPU acceleration for >50,000 points

### Manual Optimizations

If you need to further optimize:

```typescript
// Disable animations for large datasets
const chartOptions = {
  animation: metadata.totalDataPoints > 5000 ? false : true,
};

// Simplify symbols
const seriesOptions = {
  symbol: metadata.totalDataPoints > 2000 ? 'none' : 'circle',
  symbolSize: metadata.totalDataPoints > 10000 ? 2 : 4,
};

// Optimize tooltip
const tooltipOptions = {
  trigger: metadata.totalDataPoints > 5000 ? 'axis' : 'item',
};
```

---

## Common Pitfalls

### ❌ DON'T: Fetch data directly

```typescript
// BAD
useEffect(() => {
  fetch('/api/timeseries').then(setData);
}, []);
```

### ✅ DO: Use useChartData hook

```typescript
// GOOD
const { data } = useChartData({ selectedPoints });
```

---

### ❌ DON'T: Aggregate data yourself

```typescript
// BAD
const aggregated = data.filter((_, i) => i % 10 === 0); // Losing data!
```

### ✅ DO: Let ECharts handle visual optimization

```typescript
// GOOD
const { data, echartsConfig } = useChartData({ selectedPoints });
// echartsConfig.sampling handles visual optimization
```

---

### ❌ DON'T: Override raw_data=false

```typescript
// BAD - loses collection interval fidelity
fetchTimeseries({ rawData: false });
```

### ✅ DO: Trust the default (raw_data=true)

```typescript
// GOOD - preserves 30s, 1min intervals
useChartData({ selectedPoints }); // raw_data=true by default
```

---

### ❌ DON'T: Implement custom pagination

```typescript
// BAD - reinventing the wheel
let cursor = null;
while (hasMore) {
  const page = await fetchPage(cursor);
  cursor = page.next_cursor;
}
```

### ✅ DO: Hook handles pagination automatically

```typescript
// GOOD
const { data } = useChartData({ selectedPoints });
// Pagination happens behind the scenes
```

---

## Testing Your Chart

### Unit Test Template

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useChartData } from '../hooks/useChartData';

describe('MyNewChart', () => {
  it('should use useChartData hook', () => {
    const { result } = renderHook(() =>
      useChartData({
        selectedPoints: mockPoints,
        chartType: 'my-new-chart',
      })
    );

    expect(result.current.data).toBeDefined();
  });

  it('should handle 100K+ data points', async () => {
    const largeDataset = generateMockPoints(100000);
    const { result } = renderHook(() =>
      useChartData({ selectedPoints: largeDataset })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.echartsConfig.large).toBe(true);
  });

  it('should preserve raw data intervals', async () => {
    const { result } = renderHook(() =>
      useChartData({ selectedPoints: mockPoints })
    );

    await waitFor(() => {
      expect(result.current.metadata.hasRawData).toBe(true);
    });
  });
});
```

---

## Debugging

### Enable Debug Logging

```typescript
// Add to component
const { data, metadata, performanceMetrics } = useChartData({
  selectedPoints,
  enableMetrics: true, // Enable performance tracking
});

console.log('Metadata:', metadata);
console.log('Performance:', performanceMetrics);
```

### Check ECharts Config

```typescript
const { echartsConfig } = useChartData({ selectedPoints });

console.log('Large mode enabled:', echartsConfig.large);
console.log('Sampling strategy:', echartsConfig.sampling);
console.log('Progressive threshold:', echartsConfig.progressiveThreshold);
```

### Inspect Raw Data

```typescript
const { data } = useChartData({ selectedPoints });

console.log('Series count:', data.series.length);
console.log('First series:', data.series[0]);
console.log('Data points:', data.series[0].data.length);
```

---

## FAQ

**Q: Can I use custom time ranges?**

A: Yes! Pass `customStartDate` and `customEndDate`:

```typescript
useChartData({
  selectedPoints,
  customStartDate: '2024-01-01T00:00:00Z',
  customEndDate: '2024-12-31T23:59:59Z',
});
```

---

**Q: How do I refresh data?**

A: Use the `refetch` function:

```typescript
const { data, refetch } = useChartData({ selectedPoints });

// Later...
refetch(); // Fetches fresh data
```

Or use auto-refresh:

```typescript
useChartData({
  selectedPoints,
  refreshInterval: 60000, // Refresh every 60 seconds
});
```

---

**Q: What if I need aggregated data?**

A: Apply aggregation AFTER fetching raw data, in your chart component or adapter. Never request aggregated data from the API.

```typescript
const { data } = useChartData({ selectedPoints });

// Aggregate in component if needed
const hourlyAverage = aggregateByHour(data.series[0].data);
```

---

**Q: How do I handle errors?**

A: The hook returns an `error` object:

```typescript
const { data, error, isLoading } = useChartData({ selectedPoints });

if (error) {
  return <ErrorMessage error={error} />;
}
```

---

**Q: Can I disable binary transfer?**

A: Yes, but not recommended:

```typescript
useChartData({
  selectedPoints,
  useBinary: false, // Falls back to JSON (60% larger payload)
});
```

---

## Additional Resources

- **Full Architecture:** [UNIFIED_DATA_FETCHING_ARCHITECTURE.md](./UNIFIED_DATA_FETCHING_ARCHITECTURE.md)
- **Adapter Spec:** [CHART_ADAPTER_SPECIFICATION.md](./CHART_ADAPTER_SPECIFICATION.md)
- **Migration Guide:** [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)
- **ECharts Docs:** [https://echarts.apache.org](https://echarts.apache.org)
- **ACE API Spec:** [PAGINATED_ENDPOINT_SPEC.md](../specs/PAGINATED_ENDPOINT_SPEC.md)

---

## Getting Help

**Questions?** Ask in:
- Slack: `#chart-development`
- GitHub Issues: Tag `@architecture-team`
- Team Meetings: Thursdays 2pm

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
