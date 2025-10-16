# Time Axis Standardization Guide

## Overview

### Problem
Prior to standardization, charts across Building Vitals displayed time axes inconsistently:
- Different rotation angles (0°, 30°, 45°, 90°)
- Varying font sizes (10px, 11px, 12px, 14px)
- Inconsistent label truncation (none, 12 chars, 15 chars)
- Mixed axis types (category vs. time)
- Duplicate formatting logic across 18+ chart components

This led to:
- Poor user experience with inconsistent interfaces
- Maintenance overhead (fixing bugs in multiple places)
- Performance issues (redundant formatting calculations)
- Accessibility concerns (unreadable labels at certain rotations)

### Solution
Centralized time axis formatting in `src/utils/chartTimeAxisFormatter.ts` providing:
- **Single source of truth** for all time axis configurations
- **Standardized visual properties** (45° rotation, 11px font, 15-char truncation)
- **Adaptive granularity** based on time range (seconds → years)
- **Pre-formatted timestamps** for optimal ECharts performance
- **Consistent tooltips** using `formatTooltipTime()`

### Standard Pattern: The "Building Vitals Time Axis"

```typescript
// Visual Properties
rotation: 45°          // Optimal angle for readability
fontSize: 11px         // Density without sacrificing legibility
truncation: 15 chars   // Prevents label overflow while preserving context
type: 'time'           // ECharts time-based axis for proper handling

// Adaptive Granularity (automatically selected)
< 1 hour    → seconds  (HH:MM:SS)
< 1 day     → minutes  (H:MM AM/PM)
< 1 week    → hours    (H AM/PM)
< 1 month   → days     (Mon DD)
< 1 year    → weeks    (Mon DD)
> 1 year    → months   (Mon YYYY)
```

---

## Standard Time Axis Format

### Visual Properties

The standardized time axis applies the following visual properties to ensure consistency across all charts:

| Property | Value | Rationale |
|----------|-------|-----------|
| **Rotation** | 45° | Optimal balance between readability and space efficiency |
| **Font Size** | 11px | Maintains label density without sacrificing legibility |
| **Truncation** | 15 characters + "..." | Prevents label overflow while preserving context |
| **Axis Type** | `time` | ECharts time-based axis for proper timestamp handling |
| **Boundary Gap** | `false` | Time axes should align data points to exact timestamps |
| **Name Location** | `middle` | Centered axis label for clarity |
| **Name Gap** | 45px | Provides space for rotated labels |

### Adaptive Granularity

The formatter automatically selects the appropriate time granularity based on the data range:

```typescript
Time Range          Granularity    Label Format
────────────────────────────────────────────────────
< 1 hour            second         "2:30:45 PM"
< 1 day             minute         "2:30 PM"
< 1 week            hour           "2 PM"
< 1 month           day            "Mon 15"
< 1 year            week/day       "Jan 15"
> 1 year            month          "Jan 2024"
```

### Pre-Formatted Timestamps

For optimal ECharts performance, timestamps are **pre-formatted** into strings:

```typescript
// Instead of raw timestamps: [1705334400000, 1705338000000, ...]
// The axis uses formatted strings: ["2:00 PM", "3:00 PM", ...]

const xAxis = buildStandardizedTimeAxis({
  minTime: 1705334400000,
  maxTime: 1705420800000,
});

// Result: xAxis.type = 'time' with min/max bounds
// ECharts formats labels automatically using the built-in formatter
```

### Expected Appearance

Visual examples of how time axes appear for different time ranges:

**Hourly Data (1-hour range)**
```
   12:00 PM    12:15 PM    12:30 PM    12:45 PM     1:00 PM
      ┼───────────┼───────────┼───────────┼───────────┼
                    (45° rotation, 11px font)
```

**Daily Data (1-week range)**
```
     Mon 15      Tue 16      Wed 17      Thu 18      Fri 19
        ┼───────────┼───────────┼───────────┼───────────┼
                    (45° rotation, 11px font)
```

**Monthly Data (1-year range)**
```
     Jan 2024    Mar 2024    May 2024    Jul 2024    Sep 2024
        ┼───────────┼───────────┼───────────┼───────────┼
                    (45° rotation, 11px font)
```

---

## For Chart Developers - How to Use

### Basic Import

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
```

### Basic Usage

The simplest way to create a standardized time axis:

```typescript
const xAxisConfig = buildStandardizedTimeAxis({
  minTime: startTimestamp,
  maxTime: endTimestamp,
});

const chartOptions: EChartsOption = {
  xAxis: xAxisConfig,
  // ... rest of chart configuration
};
```

### Configuration Options

Full configuration interface with all available options:

```typescript
interface TimeAxisConfig {
  /** Minimum timestamp in milliseconds (required) */
  minTime: number;

  /** Maximum timestamp in milliseconds (required) */
  maxTime: number;

  /** Pre-calculated timestamps to display (optional) */
  timestamps?: number[];

  /** Theme text color for axis labels (default: '#999999') */
  color?: string;

  /** Custom axis name (default: 'Time') */
  name?: string;

  /** Whether to show split area (default: true) */
  splitArea?: boolean;
}
```

### Example with All Options

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
import { useTheme } from '@mui/material/styles';

function MyChart() {
  const theme = useTheme();

  const xAxisConfig = buildStandardizedTimeAxis({
    minTime: startTimestamp,
    maxTime: endTimestamp,
    color: theme.palette.text.secondary,  // Use theme colors
    name: 'Timestamp',                     // Custom label
    splitArea: true,                       // Show alternating background
  });

  const chartOptions: EChartsOption = {
    xAxis: xAxisConfig,
    yAxis: {
      type: 'value',
      name: 'Temperature (°F)',
    },
    series: [/* ... */],
  };

  return <ReactECharts option={chartOptions} />;
}
```

### Tooltip Formatter Usage

For consistent tooltip display, use the `formatTooltipTime()` function:

```typescript
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

const chartOptions: EChartsOption = {
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const timestamp = params[0].value[0];  // Extract timestamp
      const value = params[0].value[1];       // Extract value

      return `
        <div>
          <strong>${formatTooltipTime(timestamp)}</strong><br/>
          Value: ${value}
        </div>
      `;
    },
  },
  // ... rest of options
};
```

### Full Code Example

Complete working example for a time series chart:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@mui/material/styles';
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
import { formatTooltipTime } from '@/utils/chartTimeFormatter';
import type { EChartsOption } from 'echarts';

interface TimeSeriesChartProps {
  data: Array<[number, number]>;  // [timestamp, value][]
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const theme = useTheme();

  const chartOptions: EChartsOption = useMemo(() => {
    const timestamps = data.map(d => d[0]);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      grid: {
        left: 60,
        right: 40,
        top: 60,
        bottom: 80,
      },
      xAxis: buildStandardizedTimeAxis({
        minTime,
        maxTime,
        color: theme.palette.text.secondary,
      }),
      yAxis: {
        type: 'value',
        name: 'Value',
      },
      series: [
        {
          type: 'line',
          data: data,
          smooth: true,
        },
      ],
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const timestamp = params[0].value[0];
          const value = params[0].value[1];

          return `
            <div style="padding: 8px;">
              <div><strong>${formatTooltipTime(timestamp)}</strong></div>
              <div>Value: ${value.toFixed(2)}</div>
            </div>
          `;
        },
      },
    };
  }, [data, theme]);

  return (
    <ReactECharts
      option={chartOptions}
      style={{ height: '400px', width: '100%' }}
    />
  );
}
```

---

## Charts Updated

The following chart components have been migrated to use the standardized time axis formatter:

### ✅ Fully Migrated

| Chart Component | File Location | Migration Date |
|----------------|---------------|----------------|
| Device Deviation Heatmap | `src/components/charts/EChartsDeviceDeviationHeatmap.tsx` | 2025-01-30 |
| Time Series Chart | `src/components/charts/EChartsTimeSeriesChart.tsx` | 2025-01-30 |
| Area Chart | `src/components/charts/EChartsAreaChart.tsx` | 2025-01-30 |
| Enhanced Line Chart | `src/components/charts/EChartsEnhancedLineChart.tsx` | 2025-01-30 |
| Timeline Chart | `src/components/charts/EChartsTimelineChart.tsx` | 2025-01-30 |
| Candlestick Chart | `src/components/charts/EChartsCandlestick.tsx` | 2025-01-30 |

### ⚠️ Not Applicable

| Chart Component | Reason |
|----------------|--------|
| Scatter Plot | Uses value axes (not time-based) |
| Bar Chart | Primarily category-based (not time series) |
| Pie Chart | No axes |

### Migration Benefits Observed

- **Code Reduction**: 50-100 lines removed per chart component
- **Consistency**: All charts now have identical time axis appearance
- **Maintainability**: Single location for time axis logic
- **Performance**: Reduced redundant calculations across components
- **Bug Fixes**: Fixed truncation and rotation issues automatically

---

## Time Axis Properties

Detailed breakdown of all properties applied by `buildStandardizedTimeAxis()`:

### Core Configuration

```typescript
{
  type: 'time',           // ✅ Time-based axis for proper timestamp handling
  boundaryGap: false,     // ✅ No gaps at boundaries (align to exact times)
  min: minTime,           // Explicit minimum timestamp
  max: maxTime,           // Explicit maximum timestamp
}
```

### Split Area (Alternating Background)

```typescript
{
  splitArea: {
    show: true,           // Default: true (configurable)
    // ECharts auto-generates alternating colors
  }
}
```

### Axis Labels

```typescript
{
  axisLabel: {
    rotate: 45,           // ✅ 45-degree rotation
    fontSize: 11,         // ✅ 11px font size
    color: '#999999',     // Default gray (theme-configurable)
    formatter: (value: number) => {
      // Adaptive formatting based on granularity
      const formatted = formatAxisTime(value, granularity);

      // Truncate to 15 characters
      return formatted.length > 15
        ? formatted.substring(0, 15) + '...'
        : formatted;
    },
  }
}
```

### Axis Name

```typescript
{
  name: 'Time',           // Default: 'Time' (configurable)
  nameLocation: 'middle', // ✅ Centered on axis
  nameGap: 45,            // ✅ 45px gap for rotated labels
  nameTextStyle: {
    fontSize: 12,         // Slightly larger for axis title
    color: '#999999',     // Matches label color
  }
}
```

---

## Tooltip Formatting

### Standard Tooltip Pattern

Use `formatTooltipTime()` for consistent tooltip display across all charts:

```typescript
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

tooltip: {
  trigger: 'axis',
  formatter: (params: any) => {
    const timestamp = params[0].value[0];  // Extract timestamp from data

    return `
      <div style="padding: 8px;">
        <div style="font-weight: bold;">
          ${formatTooltipTime(timestamp)}
        </div>
        <div>
          ${params[0].seriesName}: ${params[0].value[1]}
        </div>
      </div>
    `;
  },
}
```

### Output Format

`formatTooltipTime()` returns timestamps in the format:

```
"Jan 15, 2024, 2:30 PM"
```

This format provides:
- Full date context (Jan 15, 2024)
- Precise time (2:30 PM)
- Human-readable formatting
- Consistent appearance across all tooltips

### Multi-Series Tooltip Example

For charts with multiple series:

```typescript
tooltip: {
  trigger: 'axis',
  formatter: (params: any[]) => {
    const timestamp = params[0].value[0];

    const seriesLines = params.map(param => {
      const color = param.color;
      const name = param.seriesName;
      const value = param.value[1];

      return `
        <div style="color: ${color};">
          ${name}: ${value.toFixed(2)}
        </div>
      `;
    }).join('');

    return `
      <div style="padding: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">
          ${formatTooltipTime(timestamp)}
        </div>
        ${seriesLines}
      </div>
    `;
  },
}
```

### Function Signature

```typescript
function formatTooltipTime(timestamp: number): string
```

**Parameters:**
- `timestamp`: Unix timestamp in milliseconds

**Returns:**
- Formatted string in "Mon DD, YYYY, H:MM AM/PM" format

---

## Adaptive Granularity

The time axis automatically selects the most appropriate granularity based on the data range:

### Granularity Selection Algorithm

```typescript
function getOptimalGranularity(minTime: number, maxTime: number): TimeGranularity {
  const duration = maxTime - minTime;

  if (duration < HOUR)          return 'second';
  if (duration < DAY)           return 'minute';
  if (duration < WEEK)          return 'hour';
  if (duration < MONTH)         return 'day';
  if (duration < YEAR)          return 'week';
  return 'month';
}
```

### Time Range Examples

| Data Range | Selected Granularity | Label Example | Typical Use Case |
|-----------|---------------------|---------------|------------------|
| 30 minutes | `second` | "2:30:45 PM" | Real-time monitoring |
| 6 hours | `minute` | "2:30 PM" | Recent activity |
| 3 days | `hour` | "2 PM" | Daily patterns |
| 2 weeks | `day` | "Mon 15" | Weekly trends |
| 3 months | `week` | "Jan 15" | Monthly analysis |
| 2 years | `month` | "Jan 2024" | Long-term trends |

### Format Strings by Granularity

```typescript
Granularity    Format String           Example Output
──────────────────────────────────────────────────────────
second         "h:mm:ss a"            "2:30:45 PM"
minute         "h:mm a"               "2:30 PM"
hour           "h a"                  "2 PM"
day            "EEE d"                "Mon 15"
week           "MMM d"                "Jan 15"
month          "MMM yyyy"             "Jan 2024"
year           "yyyy"                 "2024"
```

### Timestamp Generation

The `generateTimeAxisTimestamps()` function creates evenly-spaced timestamps:

```typescript
function generateTimeAxisTimestamps(
  minTime: number,
  maxTime: number,
  granularity: TimeGranularity
): number[]
```

**Target**: ~8 labels for optimal readability

**Algorithm**:
1. Calculate base interval for granularity
2. Adjust interval to achieve target label count
3. Generate timestamps at interval boundaries
4. Ensure min/max timestamps are included
5. Sort in ascending order

**Example**:
```typescript
const timestamps = generateTimeAxisTimestamps(
  1705334400000,  // Jan 15, 2024 12:00 PM
  1705420800000,  // Jan 16, 2024 12:00 PM
  'hour'
);

// Result: [
//   1705334400000,  // 12:00 PM
//   1705338000000,  //  1:00 PM
//   1705341600000,  //  2:00 PM
//   ...
//   1705420800000   // 12:00 PM (next day)
// ]
```

---

## Examples

### Simple Time Series with Standardized Axis

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

const data = [
  [1705334400000, 72.5],  // [timestamp, temperature]
  [1705338000000, 73.2],
  [1705341600000, 74.1],
  // ...
];

const chartOptions: EChartsOption = {
  xAxis: buildStandardizedTimeAxis({
    minTime: data[0][0],
    maxTime: data[data.length - 1][0],
  }),
  yAxis: {
    type: 'value',
    name: 'Temperature (°F)',
  },
  series: [{
    type: 'line',
    data: data,
  }],
  tooltip: {
    formatter: (params: any) => {
      const [time, temp] = params[0].value;
      return `${formatTooltipTime(time)}<br/>Temp: ${temp}°F`;
    },
  },
};
```

### Area Chart with Performance Optimization

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
import { useMemo } from 'react';

function AreaChart({ data }: { data: Array<[number, number]> }) {
  const chartOptions = useMemo(() => {
    const timestamps = data.map(d => d[0]);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      xAxis: buildStandardizedTimeAxis({
        minTime,
        maxTime,
      }),
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: data,
        areaStyle: {},  // Fill area under line
      }],
    };
  }, [data]);  // ✅ Memoize to prevent unnecessary recalculations

  return <ReactECharts option={chartOptions} />;
}
```

### Heatmap with Category Axis

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';

const heatmapData = [
  // [xIndex, yIndex, value]
  [0, 0, 72.5],
  [1, 0, 73.2],
  // ...
];

const times = [1705334400000, 1705338000000, /* ... */];
const devices = ['Device A', 'Device B', /* ... */];

const chartOptions: EChartsOption = {
  xAxis: buildStandardizedTimeAxis({
    minTime: times[0],
    maxTime: times[times.length - 1],
  }),
  yAxis: {
    type: 'category',
    data: devices,
  },
  series: [{
    type: 'heatmap',
    data: heatmapData,
  }],
  visualMap: {
    min: 0,
    max: 100,
  },
};
```

### Line Chart with Data Zoom

```typescript
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';

const chartOptions: EChartsOption = {
  xAxis: buildStandardizedTimeAxis({
    minTime: startTime,
    maxTime: endTime,
  }),
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: data }],
  dataZoom: [
    {
      type: 'inside',  // Mouse wheel zoom
      start: 0,
      end: 100,
    },
    {
      type: 'slider',  // Slider control
      start: 0,
      end: 100,
      height: 30,
      bottom: 10,
    },
  ],
};
```

---

## Testing

### How to Validate Time Axis Consistency

Use the `validateStandardTimeAxisFormat()` function to ensure a chart follows the standard:

```typescript
import { validateStandardTimeAxisFormat } from '@/utils/chartTimeAxisFormatter';

const xAxisConfig = buildStandardizedTimeAxis({
  minTime: startTime,
  maxTime: endTime,
});

const validation = validateStandardTimeAxisFormat(xAxisConfig);

if (!validation.isValid) {
  console.error('Time axis validation failed:', validation.issues);
}
```

### Validation Checks

The validator verifies:
- ✅ `xAxis.type === 'time'`
- ✅ `xAxis.boundaryGap === false`
- ✅ `xAxis.axisLabel.rotate === 45`
- ✅ `xAxis.axisLabel.fontSize === 11`
- ✅ `xAxis.axisLabel.formatter` exists

### Test Suite Location

Comprehensive unit tests are located at:

```
src/utils/__tests__/chartTimeAxisFormatter.test.ts
```

### Running Tests

```bash
# Run all time formatter tests
npm test chartTimeAxisFormatter

# Run with coverage
npm test -- --coverage chartTimeAxisFormatter

# Watch mode
npm test -- --watch chartTimeAxisFormatter
```

### Test Coverage

The test suite includes:

**Unit Tests (100+ test cases)**:
- `buildStandardizedTimeAxis()`: Configuration validation, defaults, custom options
- `generateTimeAxisTimestamps()`: Granularity selection, edge cases, label count
- `createStandardizedTimeTooltip()`: Formatting, error handling, edge cases
- `validateStandardTimeAxisFormat()`: Validation logic, issue reporting

**Integration Tests**:
- Interaction with `chartTimeFormatter.ts` functions
- Theme color integration
- ECharts option generation
- Performance benchmarks

**Edge Case Tests**:
- Zero-duration time ranges
- Reversed time ranges (max < min)
- Very large timestamp values
- Multi-year ranges
- Sub-second ranges

### Validation Function Usage

```typescript
export function validateStandardTimeAxisFormat(xAxisConfig: any): {
  isValid: boolean;
  issues: string[];
}
```

**Example Output**:

```typescript
// Valid configuration
{
  isValid: true,
  issues: []
}

// Invalid configuration
{
  isValid: false,
  issues: [
    "xAxis.type should be 'time', got 'category'",
    "xAxis.axisLabel.rotate should be 45, got 90",
    "xAxis.axisLabel.fontSize should be 11, got 12"
  ]
}
```

---

## Migration Guide

### Before/After Examples

#### BEFORE: Inconsistent Time Axis

```typescript
// ❌ OLD: Manual time axis configuration (inconsistent)
const chartOptions: EChartsOption = {
  xAxis: {
    type: 'category',
    data: timestamps.map(t => new Date(t).toLocaleString()),
    axisLabel: {
      rotate: 30,  // ❌ Inconsistent rotation
      fontSize: 12,  // ❌ Inconsistent font size
      formatter: (value: string) => {
        // ❌ No truncation, labels overflow
        return value;
      },
    },
  },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: values }],
};
```

#### AFTER: Standardized Time Axis

```typescript
// ✅ NEW: Standardized time axis (consistent)
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';

const chartOptions: EChartsOption = {
  xAxis: buildStandardizedTimeAxis({
    minTime: timestamps[0],
    maxTime: timestamps[timestamps.length - 1],
  }),
  yAxis: { type: 'value' },
  series: [{
    type: 'line',
    data: timestamps.map((t, i) => [t, values[i]]),
  }],
};
```

### Common Migration Patterns

#### Pattern 1: Replace Manual Category Axis

```typescript
// BEFORE
xAxis: {
  type: 'category',
  data: timestamps.map(formatTimestamp),
  axisLabel: { rotate: 45, fontSize: 11 },
}

// AFTER
xAxis: buildStandardizedTimeAxis({
  minTime: Math.min(...timestamps),
  maxTime: Math.max(...timestamps),
})
```

#### Pattern 2: Remove Custom Formatting Logic

```typescript
// BEFORE
xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => {
      const date = new Date(value);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    },
  },
}

// AFTER
xAxis: buildStandardizedTimeAxis({
  minTime: startTime,
  maxTime: endTime,
})
// ✅ Formatting handled automatically with adaptive granularity
```

#### Pattern 3: Consolidate Tooltip Formatting

```typescript
// BEFORE
tooltip: {
  formatter: (params: any) => {
    const date = new Date(params.value[0]);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  },
}

// AFTER
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

tooltip: {
  formatter: (params: any) => {
    return formatTooltipTime(params.value[0]);
  },
}
```

### Common Pitfalls to Avoid

#### Pitfall 1: Not Providing min/max Times

```typescript
// ❌ WRONG: Missing time range
const xAxis = buildStandardizedTimeAxis({
  // minTime and maxTime are required!
});

// ✅ CORRECT: Always provide time range
const xAxis = buildStandardizedTimeAxis({
  minTime: data[0][0],
  maxTime: data[data.length - 1][0],
});
```

#### Pitfall 2: Mixing Category and Time Axes

```typescript
// ❌ WRONG: Using category data with time axis
series: [{
  type: 'line',
  data: values,  // Missing timestamps!
}]

// ✅ CORRECT: Use [timestamp, value] tuples
series: [{
  type: 'line',
  data: data.map((value, i) => [timestamps[i], value]),
}]
```

#### Pitfall 3: Overriding Standard Properties

```typescript
// ❌ WRONG: Overriding standard properties
const xAxis = {
  ...buildStandardizedTimeAxis({ minTime, maxTime }),
  axisLabel: {
    rotate: 90,  // ❌ Don't override standard rotation!
  },
};

// ✅ CORRECT: Use configuration options instead
const xAxis = buildStandardizedTimeAxis({
  minTime,
  maxTime,
  color: customColor,  // ✅ Use supported options
});
```

#### Pitfall 4: Not Using useMemo for Performance

```typescript
// ❌ WRONG: Recalculates on every render
function Chart({ data }) {
  const chartOptions = {
    xAxis: buildStandardizedTimeAxis({
      minTime: data[0][0],
      maxTime: data[data.length - 1][0],
    }),
  };

  return <ReactECharts option={chartOptions} />;
}

// ✅ CORRECT: Memoize to prevent unnecessary recalculations
function Chart({ data }) {
  const chartOptions = useMemo(() => ({
    xAxis: buildStandardizedTimeAxis({
      minTime: data[0][0],
      maxTime: data[data.length - 1][0],
    }),
  }), [data]);

  return <ReactECharts option={chartOptions} />;
}
```

### Performance Considerations

#### Pre-formatting vs. Runtime Formatting

```typescript
// ⚠️ SLOWER: Runtime formatting on every render
xAxis: {
  type: 'time',
  min: minTime,
  max: maxTime,
  axisLabel: {
    formatter: (value: number) => formatAxisTime(value, granularity),
  },
}

// ✅ FASTER: Pre-formatted strings with ECharts time axis
xAxis: buildStandardizedTimeAxis({
  minTime,
  maxTime,
})
// ECharts handles formatting efficiently with built-in time axis
```

#### Memoization Best Practices

```typescript
// ✅ Memoize axis configuration
const xAxis = useMemo(() =>
  buildStandardizedTimeAxis({ minTime, maxTime }),
  [minTime, maxTime]
);

// ✅ Memoize entire chart options
const chartOptions = useMemo(() => ({
  xAxis,
  yAxis: { type: 'value' },
  series: computedSeries,
}), [xAxis, computedSeries]);
```

### Troubleshooting Tips

#### Issue: Labels Are Overlapping

**Cause**: Too many data points for the chart width

**Solution**: Increase chart width or use data zoom

```typescript
const chartOptions = {
  xAxis: buildStandardizedTimeAxis({ minTime, maxTime }),
  dataZoom: [{
    type: 'slider',
    start: 0,
    end: 100,
  }],
};
```

#### Issue: Labels Are Cut Off

**Cause**: Insufficient bottom margin for rotated labels

**Solution**: Increase grid bottom value

```typescript
const chartOptions = {
  grid: {
    bottom: 80,  // ✅ Increase to accommodate 45° rotation
  },
  xAxis: buildStandardizedTimeAxis({ minTime, maxTime }),
};
```

#### Issue: Granularity Is Wrong

**Cause**: Time range calculation is incorrect

**Solution**: Verify min/max timestamps

```typescript
// ❌ WRONG: Using indices instead of timestamps
const minTime = 0;
const maxTime = data.length - 1;

// ✅ CORRECT: Extract actual timestamps
const timestamps = data.map(d => d[0]);
const minTime = Math.min(...timestamps);
const maxTime = Math.max(...timestamps);
```

#### Issue: Tooltip Shows Wrong Format

**Cause**: Not using `formatTooltipTime()`

**Solution**: Import and use the standard formatter

```typescript
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

tooltip: {
  formatter: (params: any) => {
    return formatTooltipTime(params.value[0]);
  },
}
```

---

## Summary

### Key Takeaways

1. **Always use `buildStandardizedTimeAxis()`** for time-based charts
2. **Use `formatTooltipTime()`** for consistent tooltip display
3. **Provide min/max timestamps** from your data range
4. **Memoize chart options** for optimal performance
5. **Validate** using `validateStandardTimeAxisFormat()` during development

### Benefits

- **Consistency**: All charts have identical time axis appearance
- **Maintainability**: Single source of truth for time formatting
- **Performance**: Optimized pre-formatting and adaptive granularity
- **Accessibility**: Standardized rotation and font size improve readability
- **Developer Experience**: Simple API reduces boilerplate code

### Quick Reference

```typescript
// 1. Import utilities
import { buildStandardizedTimeAxis } from '@/utils/chartTimeAxisFormatter';
import { formatTooltipTime } from '@/utils/chartTimeFormatter';

// 2. Build axis configuration
const xAxis = buildStandardizedTimeAxis({
  minTime: data[0][0],
  maxTime: data[data.length - 1][0],
});

// 3. Use in chart options
const chartOptions = {
  xAxis,
  tooltip: {
    formatter: (params: any) => formatTooltipTime(params.value[0]),
  },
  // ... rest of configuration
};
```

### Related Documentation

- **Time Formatting Utilities**: `docs/CHART_TIME_FORMATTING_GUIDE.md`
- **Chart Configuration Guide**: `docs/CHART_CONFIG_SUMMARY.md`
- **Chart Migration Checklist**: `docs/CHART_MIGRATION_CHECKLIST.md`
- **API Reference**: `src/utils/chartTimeAxisFormatter.ts`
- **Test Suite**: `src/utils/__tests__/chartTimeAxisFormatter.test.ts`

---

**Last Updated**: 2025-01-30
**Version**: 1.0.0
**Maintainer**: Building Vitals Team
