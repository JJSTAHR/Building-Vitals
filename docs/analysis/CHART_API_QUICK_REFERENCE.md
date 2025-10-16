# Chart Data API - Quick Reference

**Last Updated**: 2025-10-15

---

## TL;DR - How Charts Get Data

```
User Selection → useChartData Hook → Cloudflare Worker → ACE IoT API → Transform → ECharts
```

**Data Format**: `Array<[timestamp_ms, value]>` (tuples only)

**Key Files**:
- Hook: `src/hooks/useChartData.ts`
- Service: `src/services/queryWorkerService.ts`
- Transform: `src/utils/aceDataTransform.ts`
- Chart: `src/components/charts/EChartsTimeSeriesChart.tsx`

---

## 1. Query API Endpoint

### Cloudflare Worker Paginated Endpoint

```
GET https://ace-iot-ai-proxy.jstahr.workers.dev/api/sites/{siteName}/timeseries/paginated
```

**Query Parameters**:
```typescript
{
  start_time: "2025-10-14T00:00:00.000Z",  // ISO 8601
  end_time: "2025-10-15T00:00:00.000Z",    // ISO 8601
  raw_data: true,                          // Preserves collection intervals
  page_size: 50000,                        // Balanced for speed
  point_names: "point1,point2,point3"      // Worker-side filtering (99%+ reduction)
}
```

**Response**:
```typescript
{
  point_samples: [
    { name: "ses/site/device/point", value: "72.5", time: "2025-10-15T10:00:00Z" }
  ],
  next_cursor: "cursor_token",
  has_more: true
}
```

---

## 2. Parameter Flow

### Selected Points → API

```typescript
// ❌ WRONG (uses display name)
const pointNames = selectedPoints.map(p => p.name);

// ✅ CORRECT (uses full BACnet path)
const pointNames = selectedPoints.map(p => (p as any)?.original_name || p.name);
```

### Time Range → ISO 8601

```typescript
// Hook: useChartData({ timeRange: "24h" })
// Converts to:
{
  startTime: "2025-10-14T15:30:00.000Z",
  endTime: "2025-10-15T15:30:00.000Z"
}

// Supported: "1h", "3h", "6h", "12h", "24h", "7d", "30d", "90d", "365d", "custom"
```

### Site Name Extraction

```typescript
// From point name: "ses/site_name/device/point"
const siteName = firstPointName.split('/')[1] || 'ses_falls_city';
```

---

## 3. Data Transformation

### ACE API → Chart Format

```typescript
// INPUT (ACE API):
{
  point_samples: [
    { name: "ses/site/ahu-1/temp", value: "72.5", time: "2025-10-15T10:00:00Z" }
  ]
}

// OUTPUT (Chart):
[
  {
    name: "ses/site/ahu-1/temp",
    formattedName: "AHU-1 Supply Temp",
    data: [[1697364000000, 72.5], [1697364030000, 72.8]],
    unit: "°F",
    markerTags: ["Floor 2", "AHU-1"]
  }
]
```

### Key Transformations

1. **Group by point name** → `GroupedTimeseriesData`
2. **Parse time** → milliseconds: `new Date(sample.time).getTime()`
3. **Parse value** → number: `parseFloat(sample.value)`
4. **Sort by timestamp** → chronological order
5. **Convert to tuples** → `[timestamp, value]` format

---

## 4. Expected Chart Data Format

### Universal Interface

```typescript
interface TransformedChartData {
  name: string;                    // Point name (API identifier)
  formattedName?: string;          // Display name with marker tags
  data: Array<[number, number]>;   // [timestamp (ms), value] tuples
  unit?: string;                   // Display unit (e.g., "°F", "PSI")
  markerTags?: string[];           // Hierarchical tags

  // Auto-added for >2000 points
  large?: boolean;
  largeThreshold?: number;
  progressive?: number;
  sampling?: 'lttb';
}
```

### Chart-Specific Formats

**TimeSeries**: Use data as-is
**Area**: Use data as-is (filled)
**Bar**: Extract latest value: `data[data.length - 1][1]`
**Heatmap**: Transform to `{ x: hour, y: pointName, value }`
**Gauge**: Extract latest value: `data[data.length - 1][1]`

---

## 5. Data Aggregation

### No Forced Aggregation

```typescript
rawData: true  // CRITICAL - preserves collection intervals!
```

**Result**: Preserves actual 30s, 1min, 5min intervals (no forced 5-min buckets)

### Worker-Side Filtering (99%+ Reduction)

```typescript
// Always include for multi-point sites
if (pointNames && pointNames.length > 0) {
  url.searchParams.set('point_names', pointNames.join(','));
}
```

### ECharts Visual Sampling (Optional)

```typescript
// Auto-enabled for >5000 points per series
{
  sampling: 'lttb',           // Largest-Triangle-Three-Buckets
  large: true,                // GPU acceleration
  progressive: 5000           // Progressive rendering
}
```

**Note**: Visual sampling only - all data preserved in memory

---

## 6. How to Use in Your Chart

### Pattern 1: Basic Hook Integration

```typescript
import { useChartData } from '@/hooks/useChartData';
import EChartsTimeSeriesChart from '@/components/charts/EChartsTimeSeriesChart';

function MyChart({ selectedPoints, timeRange }) {
  const { series, isLoading, error } = useChartData({
    selectedPoints,
    timeRange,
    enabled: true
  });

  return (
    <EChartsTimeSeriesChart
      data={series}
      loading={isLoading}
      error={error}
      height={400}
      showDataZoom
      showLegend
    />
  );
}
```

### Pattern 2: ACE Data Wrapper

```typescript
import ACEDataChartWrapper from '@/components/charts/ACEDataChartWrapper';

function MyChart({ aceData, pointMetadata }) {
  return (
    <ACEDataChartWrapper
      aceData={aceData}
      pointMetadata={pointMetadata}
      chartType="timeseries"
      height="400px"
    />
  );
}
```

### Pattern 3: Progressive Loading

```typescript
const { series, isLoading } = useChartData({
  selectedPoints,
  timeRange: "365d",
  onProgress: (samplesCount, hasMore, partialData) => {
    console.log(`Loaded ${samplesCount} samples`);
    // Chart auto-updates with partial data
  }
});
```

---

## 7. Chart Libraries

### Primary: Apache ECharts

**NPM**: `echarts`, `echarts-for-react`
**Extensions**: `echarts-gl` (3D/WebGL)

**Key Features**:
- LTTB downsampling
- Dual Y-axis support
- GPU acceleration (large mode)
- Progressive rendering
- Interactive zoom/pan

---

## 8. Common Issues & Solutions

### Issue 1: Empty Chart

**Symptom**: Chart shows "No data available"

**Debug**:
```typescript
console.log('[useChartData] Point names:', pointNames);
console.log('[useChartData] Time range:', startTime, endTime);
console.log('[useChartData] Series:', series);
```

**Solutions**:
1. Check `original_name` vs `name` usage
2. Verify time range calculation
3. Check ACE token in Redux: `state.auth.aceToken`
4. Validate point names match API format

### Issue 2: Wrong Data Range

**Symptom**: Chart shows incorrect time span

**Debug**:
```typescript
// Look for this log
🔍 [useChartData] TimeRange calculation: {
  timeSpanDays: "365.0",
  isCorrect365Days: true
}
```

**Solutions**:
1. Check `calculateTimeRange()` function
2. Verify custom date handling
3. Check global time range sync

### Issue 3: Performance Issues

**Symptom**: Chart slow to render

**Solutions**:
1. Enable downsampling: `enableDownsampling={true}`
2. Use worker-side filtering with `point_names`
3. Enable large mode (auto at >2000 points)
4. Check progressive rendering settings

---

## 9. Critical Implementation Rules

### ✅ DO

- Use `original_name` for API calls
- Set `raw_data=true` to preserve intervals
- Enable worker-side filtering with `point_names`
- Use progressive loading for >24h ranges
- Validate data at multiple layers

### ❌ DON'T

- Use `name` field for API filtering (display only)
- Force aggregation (breaks deviation analysis)
- Fetch all site points without filtering
- Ignore validation errors
- Hardcode timestamps (use ISO 8601)

---

## 10. Performance Benchmarks

| Dataset | Response Time | Notes |
|---------|---------------|-------|
| 24h (1 point) | ~3-5 seconds | First page in ~3s |
| 24h (10 points) | ~10-15 seconds | Progressive updates |
| 365d (1 point) | ~2 seconds | Worker optimized |
| 50K points | ~7MB payload | Page size: 50,000 |

**Optimization**: Worker-side filtering reduces payload by 99%+

---

## 11. Debugging Commands

### Browser Console

```javascript
// Check Redux token
window.store.getState().auth.aceToken

// Check selected points
window.store.getState().dashboard.selectedPoints

// Check time range
window.store.getState().globalTimeRange

// Manual test query
fetch('https://ace-iot-ai-proxy.jstahr.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-14T00:00:00.000Z&end_time=2025-10-15T00:00:00.000Z&raw_data=true&page_size=1000', {
  headers: { 'X-ACE-Token': 'YOUR_TOKEN' }
}).then(r => r.json()).then(console.log)
```

---

## 12. File Quick Reference

| Need | File |
|------|------|
| Fetch data | `src/hooks/useChartData.ts` |
| Worker client | `src/services/queryWorkerService.ts` |
| Paginated API | `src/services/paginatedTimeseriesService.ts` |
| Transform | `src/utils/aceDataTransform.ts` |
| TimeSeries chart | `src/components/charts/EChartsTimeSeriesChart.tsx` |
| Chart wrapper | `src/components/charts/ACEDataChartWrapper.tsx` |

---

## 13. Next Steps

For detailed implementation:
1. Read: `docs/analysis/CHART_DATA_CONSUMPTION_ANALYSIS.md`
2. Review: `src/hooks/useChartData.ts` (main hook)
3. Examine: `src/components/charts/EChartsTimeSeriesChart.tsx` (reference implementation)

For architecture context:
1. Read: `docs/architecture/UNIFIED_DATA_FETCHING_ARCHITECTURE.md`
2. Read: `docs/QUERY_WORKER_MIGRATION.md`
3. Read: `docs/MIGRATION_COMPLETE.md`
