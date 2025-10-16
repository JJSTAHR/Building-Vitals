# Chart Timeseries Data Consumption Analysis

**Date**: 2025-10-15
**Analyst**: Claude (Frontend Development Specialist)
**Purpose**: Comprehensive analysis of how charts consume and render timeseries data

---

## Executive Summary

The Building Vitals application uses a sophisticated multi-layer data pipeline for chart rendering:

1. **Query Layer**: `useChartData` hook fetches timeseries via Cloudflare Worker
2. **API Layer**: Cloudflare Worker (`fetchTimeseriesForPoints`) queries paginated ACE IoT API
3. **Transform Layer**: `aceDataTransform` converts ACE format to chart-compatible format
4. **Chart Layer**: ECharts-based components (TimeSeries, Area, Bar, Heatmap, Gauge) render data
5. **Library**: Apache ECharts with echarts-gl for 3D/WebGL rendering

**Key Finding**: Charts use `[timestamp, value]` tuple format exclusively. All data transformations preserve actual collection intervals (30s, 1min) without forced aggregation.

---

## 1. Chart Component Architecture

### Primary Chart Components

| Component | File Path | Library | Purpose |
|-----------|-----------|---------|---------|
| `EChartsTimeSeriesChart` | `src/components/charts/EChartsTimeSeriesChart.tsx` | ECharts | Multi-series line charts with dual Y-axis |
| `EChartsAreaChart` | `src/components/charts/EChartsAreaChart.tsx` | ECharts | Stacked/filled area charts |
| `EChartsBarChart` | `src/components/charts/EChartsBarChart.tsx` | ECharts | Bar/column charts for latest values |
| `EChartsHeatmap` | `src/components/charts/EChartsHeatmap.tsx` | ECharts | 2D heatmaps for deviation analysis |
| `EChartsGaugeChart` | `src/components/charts/EChartsGaugeChart.tsx` | ECharts | Real-time gauge displays |
| `ACEDataChartWrapper` | `src/components/charts/ACEDataChartWrapper.tsx` | N/A | Unified wrapper for ACE IoT data |

### Chart Library: Apache ECharts

**Version**: Latest (via echarts-for-react)
**Extensions**: echarts-gl for 3D/WebGL rendering

**Key Features Used**:
- LTTB downsampling for >5000 points per series
- Dual Y-axis for magnitude differences >2 orders
- Real-time data updates with configurable refresh
- Interactive data zoom (slider + mouse wheel)
- GPU-accelerated rendering for large datasets

---

## 2. Data Query API Endpoint

### Primary Endpoint: Cloudflare Worker Paginated Timeseries

**URL Pattern**:
```
https://ace-iot-ai-proxy.jstahr.workers.dev/api/sites/{siteName}/timeseries/paginated
```

**Query Parameters**:
```typescript
{
  start_time: string;    // ISO 8601 format (e.g., "2025-10-14T00:00:00.000Z")
  end_time: string;      // ISO 8601 format
  raw_data: boolean;     // Default: true (preserves collection intervals)
  page_size: number;     // Default: 50000 (balanced for speed)
  point_names?: string;  // Comma-separated list for worker-side filtering
}
```

**Response Format**:
```typescript
interface PaginatedResponse {
  point_samples: PointSample[];
  next_cursor: string | null;
  has_more: boolean;
}

interface PointSample {
  name: string;     // Full BACnet path (e.g., "ses/site/device/point")
  value: string;    // Numeric value as string
  time: string;     // ISO 8601 timestamp
}
```

### Data Flow: Query Worker Service

**Service**: `src/services/queryWorkerService.ts`
**Function**: `fetchTimeseriesForPoints()`

**Flow**:
1. **Hook Layer** (`useChartData`) → calls `fetchTimeseriesForPoints()`
2. **Service Layer** → calls `fetchPaginatedTimeseries()` with progressive loading
3. **Worker Layer** → Cloudflare Worker fetches from ACE IoT API
4. **Filter Layer** → `filterAndGroupTimeseries()` groups by point name
5. **Return** → `GroupedTimeseriesData` object

**Progressive Loading**:
- First page returns in ~3 seconds for immediate chart rendering
- Subsequent pages update chart progressively
- Total fetch completes in ~10-20 seconds for 24h of data

---

## 3. Parameter Passing: Selected Points → API

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Selection (Dashboard)                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Selected Points: Point[]                                    │ │
│ │ - id?: string                                               │ │
│ │ - name: string (display name)                               │ │
│ │ - original_name?: string (full BACnet path)                 │ │
│ │ - unit?: string                                             │ │
│ │ - markerTags?: string[]                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Time Range Configuration                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Time Range: string (e.g., "24h", "7d", "365d")             │ │
│ │ Custom Start/End: Date (for custom ranges)                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ useChartData Hook (src/hooks/useChartData.ts)                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1. Extract point names (prefer original_name)               │ │
│ │ 2. Calculate time range (ISO 8601 format)                   │ │
│ │ 3. Query via fetchTimeseriesForPoints()                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Query Worker Service (src/services/queryWorkerService.ts)       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ fetchPaginatedTimeseries({                                  │ │
│ │   siteName: extracted from point name,                      │ │
│ │   startTime: ISO 8601,                                      │ │
│ │   endTime: ISO 8601,                                        │ │
│ │   rawData: true,                                            │ │
│ │   pageSize: 50000,                                          │ │
│ │   pointNames: [original_name, ...]                          │ │
│ │ })                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker (ace-iot-ai-proxy.jstahr.workers.dev)        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GET /api/sites/{site}/timeseries/paginated                  │ │
│ │ Query Params: start_time, end_time, raw_data, point_names  │ │
│ │ Worker-side filtering for 99%+ data reduction               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ ACE IoT API (External)                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Returns: { point_samples: PointSample[] }                   │ │
│ │ Format: { name, value, time }                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Parameter Mappings

**Point Name Resolution**:
```typescript
// CRITICAL: Use original_name (full BACnet path) for API filtering
const pointNames = selectedPoints.map(p =>
  (p as any)?.original_name || p.name
);

// Example:
// - original_name: "ses/ses_falls_city/ahu-1/supply-temp"
// - name: "Supply Temp" (display only)
```

**Time Range Calculation** (`useChartData.ts:716-809`):
```typescript
function calculateTimeRange(
  timeRange: string,
  customStartDate?: string | null,
  customEndDate?: string | null
): { startTime: string; endTime: string }

// Examples:
// "24h" → { startTime: "2025-10-14T15:30:00.000Z", endTime: "2025-10-15T15:30:00.000Z" }
// "365d" → { startTime: "2024-10-15T15:30:00.000Z", endTime: "2025-10-15T15:30:00.000Z" }
// "custom" → { startTime: customStartDate, endTime: customEndDate }
```

**Site Name Extraction**:
```typescript
// Extract from point name: "ses/site_name/device/point"
const siteName = firstPointName.split('/')[1] || 'ses_falls_city';
```

---

## 4. Data Transformation Before Rendering

### Transformation Pipeline

#### Layer 1: ACE API Response → Grouped Data

**File**: `src/services/paginatedTimeseriesService.ts`
**Function**: `filterAndGroupTimeseries()`

**Input**:
```typescript
PointSample[] = [
  { name: "ses/site/ahu-1/temp", value: "72.5", time: "2025-10-15T10:00:00Z" },
  { name: "ses/site/ahu-1/temp", value: "72.8", time: "2025-10-15T10:00:30Z" },
  { name: "ses/site/ahu-2/temp", value: "71.2", time: "2025-10-15T10:00:00Z" }
]
```

**Output**:
```typescript
GroupedTimeseriesData = {
  "ses/site/ahu-1/temp": [
    { timestamp: 1697364000000, value: 72.5 },
    { timestamp: 1697364030000, value: 72.8 }
  ],
  "ses/site/ahu-2/temp": [
    { timestamp: 1697364000000, value: 71.2 }
  ]
}
```

**Key Operations**:
1. Filter samples by selected point names
2. Parse `time` (ISO string) → `timestamp` (milliseconds)
3. Parse `value` (string) → `value` (number)
4. Sort by timestamp (chronological order)
5. Group by point name

#### Layer 2: Grouped Data → Chart Series Format

**File**: `src/hooks/useChartData.ts`
**Function**: `useChartDataSimple()` series mapping

**Input**: `GroupedTimeseriesData`

**Output**:
```typescript
TransformedChartData[] = [
  {
    name: "ses/site/ahu-1/temp",
    formattedName: "AHU-1 Supply Temp",
    data: [[1697364000000, 72.5], [1697364030000, 72.8]],
    unit: "°F",
    markerTags: ["Floor 2", "AHU-1"],
    large: true,            // For >2000 points
    largeThreshold: 2000,
    progressive: 5000,
    sampling: 'lttb'        // Visual sampling, data preserved
  }
]
```

**Key Operations**:
1. Convert `{timestamp, value}` → `[timestamp, value]` tuples
2. Add formatted name with marker tags
3. Apply temperature conversion (weather API points only)
4. Add ECharts performance optimizations for large datasets
5. Attach metadata (unit, markerTags)

#### Layer 3: ACE Data Wrapper (Alternative Path)

**File**: `src/utils/aceDataTransform.ts`
**Function**: `transformACETimeseriesToChartData()`

**Purpose**: Direct transformation from ACE API response format

**Input**:
```typescript
ACETimeseriesResponse = {
  point_samples: PointSample[]
}
```

**Output**: `TransformedChartData[]` (same as Layer 2)

**Usage**: Used by `ACEDataChartWrapper` for direct ACE API integration

---

## 5. Data Aggregation and Grouping Logic

### No Forced Aggregation (Critical Feature)

**Default Behavior**: `raw_data=true` in API requests

```typescript
// From paginatedTimeseriesService.ts:61
rawData = true,  // DEFAULT to true - preserve collection intervals!
```

**Impact**:
- Preserves actual collection intervals: 30s, 1min, 5min
- No forced 5-minute buckets
- Essential for deviation heatmaps and anomaly detection
- Enables high-resolution data visualization

### Worker-Side Filtering (99%+ Reduction)

**Optimization**: Filter data at Cloudflare Worker edge

```typescript
// From paginatedTimeseriesService.ts:95
if (pointNames && pointNames.length > 0) {
  url.searchParams.set('point_names', pointNames.join(','));
}
```

**Benefits**:
- Reduces payload by 99%+ for multi-point sites
- 10-20x faster data fetching
- Lower bandwidth consumption
- Prevents timeout on large datasets

### ECharts Built-in Aggregation (Visual Only)

**LTTB Downsampling** (optional, for >5000 points):

```typescript
// From EChartsTimeSeriesChart.tsx:628-638
if (enableDownsampling) {
  series.forEach(s => {
    if (s.data && s.data.length > downsamplingThreshold) {
      s.sampling = 'lttb';  // Visual sampling
      s.progressiveThreshold = downsamplingThreshold;
    }
  });
}
```

**Key Points**:
- **Visual sampling only** (data preserved in memory)
- Uses Largest-Triangle-Three-Buckets algorithm
- Triggered for >5000 points per series
- User can disable via `enableDownsampling={false}`

### Large Dataset Optimizations

**Auto-enabled for >2000 points** (`useChartData.ts:641-648`):

```typescript
const largeDatasetConfig = processedData.length > 2000 ? {
  large: true,              // GPU acceleration
  largeThreshold: 2000,
  progressive: 5000,        // Progressive rendering
  progressiveThreshold: 10000,
  progressiveChunkMode: 'sequential',
  sampling: 'lttb'          // Visual sampling
} : {};
```

---

## 6. Expected Data Format for Charts

### Universal Chart Data Format

**Interface**: `TransformedChartData`

```typescript
interface TransformedChartData {
  name: string;                    // Point name (API identifier)
  formattedName?: string;          // Display name with marker tags
  data: Array<[number, number]>;   // [timestamp (ms), value] tuples
  unit?: string;                   // Display unit (e.g., "°F", "PSI")
  markerTags?: string[];           // Hierarchical tags
  pointMetadata?: any;             // Additional metadata

  // ECharts performance options (auto-added for large datasets)
  large?: boolean;
  largeThreshold?: number;
  progressive?: number;
  progressiveThreshold?: number;
  progressiveChunkMode?: string;
  sampling?: 'lttb' | 'average' | 'min' | 'max';
}
```

### Chart-Specific Data Transformations

#### 1. TimeSeries Chart (Default)
**Input**: `TransformedChartData[]`
**No transformation** - uses data as-is

#### 2. Area Chart
**Input**: `TransformedChartData[]`
**Transformation**: Same as TimeSeries, but with filled areas

#### 3. Bar Chart
**Input**: `TransformedChartData[]`
**Transformation**: Extract latest value

```typescript
const barData = safeData.map((series) => {
  const latestValue = series.data.length > 0
    ? series.data[series.data.length - 1][1]
    : 0;
  return { name: series.name, value: latestValue, unit: series.unit };
});
```

#### 4. Heatmap
**Input**: `TransformedChartData[]`
**Transformation**: Convert to x-y-value grid

```typescript
const heatmapData = [];
safeData.forEach((series) => {
  series.data.forEach(([timestamp, value]) => {
    const date = new Date(timestamp);
    heatmapData.push({
      x: date.getHours(),     // Hour of day
      y: series.name,         // Point name
      value: value            // Numeric value
    });
  });
});
```

#### 5. Gauge Chart
**Input**: `TransformedChartData[]` (single series)
**Transformation**: Extract latest value

```typescript
const latestValue = firstSeries.data[firstSeries.data.length - 1][1];
```

---

## 7. Timestamp Format Standards

### ACE IoT API Format (Input)
```typescript
"2025-10-15T14:30:45.123Z"  // ISO 8601 with 'Z' suffix
```

### Internal Format (Charts)
```typescript
1697371845123  // Unix timestamp in milliseconds
```

### Conversion Functions

**Parse**: `new Date(sample.time).getTime()`

```typescript
// From paginatedTimeseriesService.ts:221
const timestamp = new Date(sample.time).getTime();
```

**Format for API**: `formatLocalTimeForAPI(date)`

```typescript
// From useChartData.ts:806
startTime: formatLocalTimeForAPI(start)
```

**Display in Tooltip**: `new Date(timestamp).toLocaleString()`

```typescript
// From EChartsTimeSeriesChart.tsx:826
${new Date(timestamp).toLocaleString()}
```

---

## 8. Chart Interaction with Selected Points

### Point Selection Flow

```
User Selection → Point[] → useChartData → API Query → Data Transform → Chart Render
```

### Two-Field System (Critical Architecture)

**Point Object Structure**:
```typescript
interface Point {
  id?: string;
  name: string;              // Display name (human-readable)
  original_name?: string;    // Full BACnet path (API identifier)
  unit?: string;
  markerTags?: string[];
  marker_tags?: string[];    // Alternative field name
}
```

**Field Usage**:
- **`original_name`**: Used for API filtering and data fetching
- **`name`**: Used for display in legends, tooltips, and UI
- **`markerTags`**: Used for hierarchical grouping and labeling

### Point Name Resolution Priority

```typescript
// From useChartData.ts:207-216
const apiName = (p as any)?.original_name || p.name;
```

**Priority Order**:
1. `original_name` (preferred - full BACnet path)
2. `name` (fallback - might be cleaned display name)

---

## 9. Performance Characteristics

### Query Performance

| Metric | Value | Notes |
|--------|-------|-------|
| First page response | ~3 seconds | Progressive loading enabled |
| Total 24h data fetch | ~10-20 seconds | ~50K points typical |
| 365d data fetch | ~33,058 points in 2 seconds | Worker optimized |
| Worker-side filtering reduction | 99%+ | When point_names filter used |
| Progressive updates | Yes | Charts update per page |

### Chart Rendering Performance

| Dataset Size | Optimization | Notes |
|--------------|--------------|-------|
| < 2,000 points | Standard rendering | No special optimizations |
| 2,000 - 5,000 points | Large mode + GPU | Auto-enabled |
| 5,000 - 10,000 points | Progressive rendering | Chunks of 5,000 |
| > 10,000 points | LTTB sampling | Visual sampling only |

### Memory Management

**Caching Strategy**:
- Query cache: 5 minutes (React Query)
- Stale time: 2 minutes for standard, 5 minutes for batched
- GC time: 5 minutes for standard, 10 minutes for batched

---

## 10. Data Validation and Error Handling

### Validation Layers

#### Layer 1: Service Layer Validation

**File**: `src/services/paginatedTimeseriesService.ts:219-228`

```typescript
allSamples.forEach(sample => {
  if (selectedPointNames.includes(sample.name)) {
    const timestamp = new Date(sample.time).getTime();
    const value = parseFloat(sample.value);

    if (!isNaN(timestamp) && !isNaN(value)) {
      grouped[sample.name].push({ timestamp, value });
    }
  }
});
```

**Checks**:
- Valid timestamp (not NaN)
- Valid numeric value (not NaN)
- Point name matches selection

#### Layer 2: Chart Data Validation

**File**: `src/utils/aceDataTransform.ts:132-168`

```typescript
export function validateChartData(data: any): TransformedChartData[] {
  return data.filter((series) => {
    if (!series.name) return false;
    if (!Array.isArray(series.data)) return false;

    // Remove invalid data points
    series.data = series.data.filter(([timestamp, value]) => {
      if (typeof timestamp !== 'number' || typeof value !== 'number') return false;
      if (isNaN(timestamp) || isNaN(value)) return false;

      // Check for reasonable timestamp range (year 2000 to 2100)
      if (timestamp < 946684800000 || timestamp > 4102444800000) return false;

      return true;
    });

    return true;
  });
}
```

**Checks**:
- Series has name
- Data is array
- Timestamps are numbers
- Values are numbers
- Timestamps within reasonable range (2000-2100)

#### Layer 3: ECharts Rendering Validation

**File**: `src/components/charts/EChartsTimeSeriesChart.tsx:536-563`

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
}).map(point => {
  const [timestamp, value] = point;
  const normalizedTimestamp = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  return [normalizedTimestamp, value];
});
```

**Checks**:
- Point is array with 2+ elements
- Timestamp is finite number or valid Date
- Value is finite number
- Normalize Date to milliseconds

### Error Display

**No Data State**:
```typescript
<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <Typography>No data available</Typography>
</Box>
```

**Error State**:
```typescript
<Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
  Error loading chart: {error.message}
</Box>
```

---

## 11. Advanced Features

### Dual Y-Axis Support

**Auto-enabled** when series differ by >2 orders of magnitude:

```typescript
// From EChartsTimeSeriesChart.tsx:884-977
const magDiff = Math.max(...magnitudes) - Math.min(...magnitudes);
const hasDifferentUnits = uniqueUnits.length > 1;

if (magDiff > 2 || (hasDifferentUnits && magDiff > 1)) {
  needsDualAxis = true;
  // Split series into left/right axes
}
```

**Example**: Temperature (70°F) vs. Pressure (0.02 PSI)

### Temperature Conversion (Weather API Only)

**Auto-converts** weather API points from Celsius to Fahrenheit:

```typescript
// From useChartData.ts:610-623
const isWeatherTemp = pointName && isWeatherTemperaturePoint(pointName);

const processedData = isWeatherTemp
  ? convertTemperatureData(formattedData, 'C', 'F')
  : formattedData;

const displayUnit = isWeatherTemp ? '°F' : (ts.unit || originalPoint?.unit || '');
```

### Marker Tags Integration

**Hierarchical Labeling**:

```typescript
// From EChartsTimeSeriesChart.tsx:516-522
const formattedName = showMarkerTags && processedData[index]?.markerTags
  ? formatPointWithTags({
      name: seriesData.name,
      markerTags: processedData[index].markerTags,
      unit: seriesData.unit,
    }, { maxTags: 2, includeUnit: false })
  : seriesData.formattedName || seriesData.name;
```

**Example**: "AHU-1 → Supply Temp → Floor 2"

---

## 12. Critical Implementation Notes

### 1. Use `original_name` for API Calls

**Wrong**:
```typescript
const pointNames = selectedPoints.map(p => p.name);
```

**Correct**:
```typescript
const pointNames = selectedPoints.map(p => (p as any)?.original_name || p.name);
```

### 2. Always Use `raw_data=true`

**Purpose**: Preserves actual collection intervals

```typescript
rawData: true  // CRITICAL - preserves collection intervals!
```

### 3. Progressive Loading Pattern

**Implementation**:
```typescript
const firstPage = await fetchPage(null);
allSamples.push(...firstPage.point_samples);

// Send first page immediately for instant chart rendering
if (onProgress) {
  onProgress(allSamples.length, firstPage.has_more, [...allSamples]);
}
```

### 4. Worker-Side Filtering

**Always include** for multi-point sites:

```typescript
if (pointNames && pointNames.length > 0) {
  url.searchParams.set('point_names', pointNames.join(','));
}
```

### 5. Timestamp Format Consistency

**API Query**: ISO 8601 with 'Z'
**Chart Data**: Milliseconds (number)
**Display**: Localized string

---

## 13. Common Integration Patterns

### Pattern 1: Basic Chart Integration

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
  timeRange,
  onProgress: (samplesCount, hasMore, partialData) => {
    console.log(`Loaded ${samplesCount} samples, more: ${hasMore}`);
    // Chart auto-updates with partialData
  }
});
```

---

## 14. Debugging and Monitoring

### Console Logging Markers

**Search for these in browser console**:

| Marker | Purpose | Location |
|--------|---------|----------|
| `[useChartData]` | Data fetching flow | useChartData.ts |
| `[Paginated Timeseries]` | Worker queries | paginatedTimeseriesService.ts |
| `[EChartsTimeSeriesChart]` | Chart rendering | EChartsTimeSeriesChart.tsx |
| `🔍 [useChartData]` | Critical debug traces | useChartData.ts |
| `📊 [useChartData]` | Performance metrics | useChartData.ts |

### Performance Metrics Logging

```typescript
console.log('📊 [useChartData] Performance:', {
  responseTime: `${responseTime}ms`,
  usedBatching: shouldUseBatching,
  pointCount: pointNames.length,
  metrics: metricsRef.current
});
```

### Data Validation Logging

```typescript
console.warn(`[EChartsTimeSeriesChart] Filtered out ${sortedData.length - validatedData.length} invalid data points`);
```

---

## 15. Recommendations

### For New Chart Implementations

1. **Use `ACEDataChartWrapper`** for automatic ACE API integration
2. **Leverage `useChartData` hook** for custom implementations
3. **Enable progressive loading** for time ranges >24h
4. **Use worker-side filtering** for multi-point sites
5. **Prefer `original_name`** over `name` for API calls

### For Performance Optimization

1. **Enable downsampling** for >5000 points per series
2. **Use `large` mode** for >2000 points (auto-enabled)
3. **Implement progressive rendering** for >10,000 points
4. **Cache aggressively** with React Query staleTime/gcTime
5. **Batch API requests** for multiple points

### For Data Accuracy

1. **Always use `raw_data=true`** to preserve collection intervals
2. **Validate timestamps** within reasonable range (2000-2100)
3. **Filter NaN values** at multiple layers
4. **Preserve marker tags** for hierarchical context
5. **Use dual Y-axis** for magnitude differences >2 orders

---

## 16. File Reference Index

### Core Data Flow Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/hooks/useChartData.ts` | Main data fetching hook | `useChartDataSimple()`, `calculateTimeRange()` |
| `src/services/queryWorkerService.ts` | Query worker integration | `fetchTimeseriesForPoints()` |
| `src/services/paginatedTimeseriesService.ts` | Paginated API client | `fetchPaginatedTimeseries()`, `filterAndGroupTimeseries()` |
| `src/utils/aceDataTransform.ts` | Data transformation | `transformACETimeseriesToChartData()`, `validateChartData()` |

### Chart Components

| File | Chart Type | Key Props |
|------|-----------|-----------|
| `src/components/charts/EChartsTimeSeriesChart.tsx` | Line chart | `data`, `showDataZoom`, `thresholds` |
| `src/components/charts/EChartsAreaChart.tsx` | Area chart | `data`, `stacked` |
| `src/components/charts/EChartsBarChart.tsx` | Bar chart | `data`, `orientation` |
| `src/components/charts/EChartsHeatmap.tsx` | Heatmap | `data`, `colorRange` |
| `src/components/charts/ACEDataChartWrapper.tsx` | Wrapper | `aceData`, `chartType` |

### Supporting Files

| File | Purpose |
|------|---------|
| `src/utils/chartDataValidation.ts` | Data validation utilities |
| `src/utils/temperatureConversion.ts` | Weather API temperature conversion |
| `src/utils/pointLabelManager.ts` | Point name formatting |
| `src/utils/timezoneUtils.ts` | Timezone handling |

---

## Conclusion

The Building Vitals chart system uses a sophisticated multi-layer architecture optimized for:

- **High-resolution data** (no forced aggregation)
- **Progressive loading** (first data visible in ~3s)
- **Worker-side filtering** (99%+ payload reduction)
- **GPU-accelerated rendering** (for large datasets)
- **Dual Y-axis support** (for mixed units/magnitudes)

All charts consume data in the universal `[timestamp, value]` tuple format, with automatic transformations handling the conversion from ACE IoT API's `{name, value, time}` format.

The system prioritizes data accuracy and rendering performance, making it suitable for diagnostic analysis, deviation heatmaps, and anomaly detection requiring every data point.
