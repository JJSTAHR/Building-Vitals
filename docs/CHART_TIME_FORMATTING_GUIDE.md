# Chart Time Formatting Guide

## Overview

The `chartTimeFormatter` utility provides centralized, consistent 12-hour AM/PM time formatting across all charts in the Building Vitals application. It automatically handles UTC to local timezone conversion and offers various granularity levels for different chart contexts.

## Features

- **12-Hour AM/PM Format**: All times displayed in user-friendly 12-hour format
- **Automatic Timezone Conversion**: UTC timestamps automatically converted to browser's local timezone
- **Multiple Granularities**: Second, minute, hour, day, and month-level formatting
- **ECharts Integration**: Helper functions optimized for Apache ECharts
- **Type Safety**: Full TypeScript support with comprehensive types
- **Relative Time**: Human-readable relative time formatting ("2 hours ago")
- **Time Range Formatting**: Smart formatting for time ranges (same day vs. different days)

## Installation

The utility is already included in the project at:
```
src/utils/chartTimeFormatter.ts
```

## Basic Usage

### Import

```typescript
import {
  formatAxisTime,
  formatTooltipTime,
  formatTimeRange,
  getOptimalGranularity,
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  createEChartsFormatter
} from '@/utils/chartTimeFormatter';
```

### Formatting Axis Labels

```typescript
// Basic axis formatting (default: minute granularity)
const label = formatAxisTime(timestamp);
// Output: "2:30 PM"

// With different granularities
formatAxisTime(timestamp, 'second')  // "2:30:45 PM"
formatAxisTime(timestamp, 'minute')  // "2:30 PM"
formatAxisTime(timestamp, 'hour')    // "2 PM"
formatAxisTime(timestamp, 'day')     // "Jan 15, 2 PM"
formatAxisTime(timestamp, 'month')   // "Jan 15"
```

### Formatting Tooltips

```typescript
// Full date and time with seconds
const tooltip = formatTooltipTime(timestamp);
// Output: "Jan 15, 2024, 2:30:45 PM"

// Without seconds
const tooltip = formatTooltipTime(timestamp, { showSeconds: false });
// Output: "Jan 15, 2024, 2:30 PM"
```

### Formatting Time Ranges

```typescript
// Same day range
const range = formatTimeRange(startTime, endTime);
// Output: "2:30 PM - 5:45 PM"

// Different day range
const range = formatTimeRange(dayOneTime, dayTwoTime);
// Output: "Jan 15, 2:30 PM - Jan 16, 5:45 PM"
```

### Auto-Detecting Granularity

```typescript
const granularity = getOptimalGranularity(startTime, endTime);
// Returns: 'minute' | 'hour' | 'day' | 'month'

// Based on time range:
// < 1 hour    → 'minute'
// < 1 day     → 'hour'
// < 1 week    → 'day'
// < 1 month   → 'day'
// >= 1 month  → 'month'
```

## ECharts Integration

### Complete Chart Example

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  getOptimalGranularity
} from '@/utils/chartTimeFormatter';

export const TemperatureChart: React.FC<{ data: ChartData[] }> = ({ data }) => {
  const option = useMemo(() => {
    const timestamps = data.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const granularity = getOptimalGranularity(minTime, maxTime);

    return {
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime]),
          rotate: 45,
          hideOverlap: true
        }
      },
      yAxis: {
        type: 'value',
        name: 'Temperature (°F)'
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const time = formatEChartsTooltip(params[0].value[0]);
          const value = params[0].value[1];
          return `${time}<br/>${params[0].seriesName}: ${value}°F`;
        }
      },
      series: [{
        name: 'Temperature',
        type: 'line',
        data: data.map(d => [d.timestamp, d.value]),
        smooth: true
      }]
    };
  }, [data]);

  return <ReactECharts option={option} />;
};
```

### Using Custom Formatter

```typescript
import { createEChartsFormatter } from '@/utils/chartTimeFormatter';

const option = {
  xAxis: {
    type: 'time',
    axisLabel: {
      // Create reusable formatter
      formatter: createEChartsFormatter({ granularity: 'hour' })
    }
  }
};
```

### Multi-Series with Time Range Legend

```typescript
const option = {
  legend: {
    data: ['Series 1', 'Series 2'],
    formatter: (name: string) => {
      const seriesData = getSeriesData(name);
      const range = formatTimeRange(
        seriesData[0].timestamp,
        seriesData[seriesData.length - 1].timestamp
      );
      return `${name} (${range})`;
    }
  }
};
```

## Migration Guide

### Before (Hardcoded Formatters)

```typescript
// Old approach - inconsistent formatting
xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => {
      const date = new Date(value);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
  }
}

// Problems:
// ❌ 24-hour format (not user-friendly)
// ❌ No AM/PM indicator
// ❌ Doesn't account for timezone
// ❌ Inconsistent across charts
// ❌ No granularity options
```

### After (Centralized Formatter)

```typescript
// New approach - consistent, configurable
import { formatEChartsAxisLabel, getOptimalGranularity } from '@/utils/chartTimeFormatter';

xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
  }
}

// Benefits:
// ✅ User-friendly 12-hour format
// ✅ AM/PM indicators
// ✅ Automatic timezone conversion
// ✅ Consistent across all charts
// ✅ Automatic granularity detection
// ✅ Type-safe with TypeScript
```

### Step-by-Step Migration

1. **Import the utility:**
   ```typescript
   import {
     formatEChartsAxisLabel,
     formatEChartsTooltip,
     getOptimalGranularity
   } from '@/utils/chartTimeFormatter';
   ```

2. **Replace axis formatters:**
   ```typescript
   // Before
   formatter: (value: number) => new Date(value).toLocaleString()

   // After
   formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
   ```

3. **Replace tooltip formatters:**
   ```typescript
   // Before
   formatter: (params: any) => {
     const date = new Date(params.value[0]);
     return `${date.toLocaleString()}: ${params.value[1]}`;
   }

   // After
   formatter: (params: any) => {
     const time = formatEChartsTooltip(params.value[0]);
     return `${time}: ${params.value[1]}`;
   }
   ```

4. **Test thoroughly:**
   - Verify 12-hour AM/PM format
   - Check timezone conversion
   - Test different time ranges
   - Validate granularity auto-detection

## Timezone Handling

### Understanding UTC to Local Conversion

All timestamps in the system are stored in UTC (milliseconds since Unix epoch). The formatter automatically converts them to the user's local timezone:

```typescript
// Input: UTC timestamp
const utcTimestamp = 1705334445000; // Jan 15, 2024, 2:30:45 PM UTC

// Output: Local timezone (example: EST = UTC-5)
formatTooltipTime(utcTimestamp);
// → "Jan 15, 2024, 9:30:45 AM" (if browser is in EST)

// Output: Local timezone (example: PST = UTC-8)
formatTooltipTime(utcTimestamp);
// → "Jan 15, 2024, 6:30:45 AM" (if browser is in PST)
```

### Browser Timezone Detection

The formatter uses JavaScript's built-in `Date.toLocaleString()` which automatically:
- Detects browser's timezone setting
- Handles daylight saving time (DST) transitions
- Respects user's system locale preferences

### Testing Timezone Conversion

```typescript
// Create UTC timestamp
const utcDate = new Date('2024-01-15T14:30:00Z');
const timestamp = utcDate.getTime();

// Format will show local time
const local = formatTooltipTime(timestamp);
console.log('Local time:', local);

// To verify UTC value
console.log('UTC time:', utcDate.toISOString());
```

## Common Patterns

### Pattern 1: Temperature/Humidity Charts (Minute Granularity)

```typescript
const option = {
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: createEChartsFormatter({ granularity: 'minute' })
    }
  },
  tooltip: {
    formatter: (params: any) => {
      const time = formatEChartsTooltip(params[0].value[0]);
      const temp = params[0].value[1];
      return `${time}<br/>Temperature: ${temp}°F`;
    }
  }
};
```

### Pattern 2: Daily Trends (Hour Granularity)

```typescript
const option = {
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: createEChartsFormatter({ granularity: 'hour' })
    }
  },
  dataZoom: [{
    type: 'slider',
    labelFormatter: (value: number) => formatAxisTime(value, 'day')
  }]
};
```

### Pattern 3: Weekly/Monthly Reports (Day Granularity)

```typescript
const option = {
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: createEChartsFormatter({ granularity: 'day' })
    }
  },
  legend: {
    formatter: (name: string) => {
      const data = getSeriesData(name);
      return `${name} (${formatTimeRange(data[0].time, data[data.length-1].time)})`;
    }
  }
};
```

### Pattern 4: Real-Time Monitoring (Auto Granularity)

```typescript
const option = useMemo(() => {
  const times = data.map(d => d.timestamp);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
      }
    },
    title: {
      text: `Data from ${formatTimeRange(minTime, maxTime)}`
    }
  };
}, [data]);
```

### Pattern 5: Relative Time Display

```typescript
import { formatRelativeTime } from '@/utils/chartTimeFormatter';

const LastUpdated: React.FC<{ timestamp: number }> = ({ timestamp }) => {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    const update = () => setRelativeTime(formatRelativeTime(timestamp));
    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span>Last updated: {relativeTime}</span>;
};
```

## API Reference

### Core Functions

#### `formatAxisTime(timestamp, granularity?)`
Formats timestamp for chart axis labels.

**Parameters:**
- `timestamp` (number): UTC timestamp in milliseconds
- `granularity` (TimeGranularity, optional): Display granularity (default: 'minute')

**Returns:** Formatted time string

**Example:**
```typescript
formatAxisTime(1705334445000, 'hour') // "2 PM"
```

---

#### `formatTooltipTime(timestamp, options?)`
Formats timestamp for tooltips with full date information.

**Parameters:**
- `timestamp` (number): UTC timestamp in milliseconds
- `options` (object, optional): `{ showSeconds?: boolean }`

**Returns:** Full formatted date and time string

**Example:**
```typescript
formatTooltipTime(1705334445000) // "Jan 15, 2024, 2:30:45 PM"
```

---

#### `formatTimeRange(startTime, endTime)`
Formats time range intelligently based on whether times are same day or different days.

**Parameters:**
- `startTime` (number): Start timestamp in milliseconds
- `endTime` (number): End timestamp in milliseconds

**Returns:** Formatted time range string

**Example:**
```typescript
formatTimeRange(start, end) // "2:30 PM - 5:45 PM" (same day)
formatTimeRange(start, end) // "Jan 15, 2:30 PM - Jan 16, 5:45 PM" (different days)
```

---

#### `getOptimalGranularity(startTime, endTime)`
Determines optimal time granularity based on time range.

**Parameters:**
- `startTime` (number): Start timestamp
- `endTime` (number): End timestamp

**Returns:** Recommended TimeGranularity

**Example:**
```typescript
getOptimalGranularity(now, now + 3600000) // 'hour'
```

---

#### `formatEChartsAxisLabel(timestamp, dataRange?)`
ECharts-optimized axis label formatter with auto-granularity.

**Parameters:**
- `timestamp` (number): Timestamp to format
- `dataRange` (tuple, optional): `[minTime, maxTime]` for auto-granularity

**Returns:** Formatted label string

**Example:**
```typescript
formatter: (value) => formatEChartsAxisLabel(value, [min, max])
```

---

#### `formatEChartsTooltip(timestamp, showSeconds?)`
ECharts-optimized tooltip formatter.

**Parameters:**
- `timestamp` (number): Timestamp to format
- `showSeconds` (boolean, optional): Include seconds (default: true)

**Returns:** Formatted tooltip string

**Example:**
```typescript
formatter: (params) => formatEChartsTooltip(params.value[0])
```

---

#### `createEChartsFormatter(options?)`
Creates custom formatter function for ECharts.

**Parameters:**
- `options` (TimeFormatterOptions, optional): Formatting options

**Returns:** Formatter function `(value: number) => string`

**Example:**
```typescript
const formatter = createEChartsFormatter({ granularity: 'hour' });
axisLabel: { formatter }
```

---

#### `formatRelativeTime(timestamp, baseTime?)`
Formats timestamp as relative time (e.g., "2 hours ago").

**Parameters:**
- `timestamp` (number): Timestamp to format
- `baseTime` (number, optional): Base time for comparison (default: now)

**Returns:** Relative time string

**Example:**
```typescript
formatRelativeTime(Date.now() - 3600000) // "1 hour ago"
```

---

#### `parseTimestamp(time)`
Parses various time formats into milliseconds timestamp.

**Parameters:**
- `time` (number | Date | string): Time value

**Returns:** Timestamp in milliseconds

**Example:**
```typescript
parseTimestamp('2024-01-15T14:30:00Z') // 1705334445000
```

---

#### `isValidTimestamp(timestamp)`
Validates timestamp value.

**Parameters:**
- `timestamp` (number): Timestamp to validate

**Returns:** boolean

**Example:**
```typescript
isValidTimestamp(1705334445000) // true
isValidTimestamp(NaN) // false
```

---

### Types

```typescript
type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'month';

interface TimeFormatterOptions {
  granularity?: TimeGranularity;
  showSeconds?: boolean;
  showDate?: boolean;
  hour12?: boolean; // Always true for our use case
}
```

## Best Practices

1. **Always Use Auto-Granularity for Dynamic Data:**
   ```typescript
   const granularity = getOptimalGranularity(minTime, maxTime);
   ```

2. **Provide Data Range for Optimal Formatting:**
   ```typescript
   formatter: (value) => formatEChartsAxisLabel(value, [minTime, maxTime])
   ```

3. **Use Relative Time for "Last Updated" Displays:**
   ```typescript
   const updateText = formatRelativeTime(lastUpdateTime);
   ```

4. **Validate Timestamps Before Formatting:**
   ```typescript
   if (isValidTimestamp(timestamp)) {
     return formatTooltipTime(timestamp);
   }
   ```

5. **Cache Formatter Functions:**
   ```typescript
   const formatter = useMemo(
     () => createEChartsFormatter({ granularity }),
     [granularity]
   );
   ```

## Troubleshooting

### Issue: Times showing incorrectly

**Solution:** Ensure timestamps are in milliseconds (not seconds):
```typescript
// Wrong
const timestamp = 1705334445; // seconds

// Correct
const timestamp = 1705334445000; // milliseconds
```

### Issue: Inconsistent timezone display

**Solution:** All timestamps should be UTC. Browser automatically converts to local:
```typescript
// Store in UTC
const utcTimestamp = Date.UTC(2024, 0, 15, 14, 30, 0);

// Display in local
formatTooltipTime(utcTimestamp); // Auto-converts to local
```

### Issue: Chart labels overlapping

**Solution:** Use appropriate granularity and rotation:
```typescript
xAxis: {
  axisLabel: {
    formatter: formatEChartsAxisLabel,
    rotate: 45,
    hideOverlap: true
  }
}
```

### Issue: Need different format for export

**Solution:** Use granularity parameter:
```typescript
// For display
formatAxisTime(timestamp, 'minute') // "2:30 PM"

// For export/logs
formatTooltipTime(timestamp) // "Jan 15, 2024, 2:30:45 PM"
```

## Performance Considerations

The formatter uses native JavaScript `toLocaleString()` which is highly optimized. For charts with thousands of data points:

1. **Cache formatter functions:**
   ```typescript
   const formatter = useMemo(() => createEChartsFormatter(options), [options]);
   ```

2. **Use appropriate granularity:**
   ```typescript
   // For large datasets, use coarser granularity
   const granularity = dataPoints.length > 1000 ? 'hour' : 'minute';
   ```

3. **Leverage ECharts sampling:**
   ```typescript
   series: [{
     data: largeDataset,
     sampling: 'lttb', // Largest-Triangle-Three-Buckets
     large: true
   }]
   ```

## Testing

Run the comprehensive test suite:

```bash
npm test chartTimeFormatter.test.ts
```

The tests cover:
- ✅ UTC to local conversion
- ✅ 12-hour AM/PM formatting
- ✅ All granularity levels
- ✅ Time range formatting
- ✅ Optimal granularity detection
- ✅ Timezone edge cases (DST, midnight, noon)
- ✅ ECharts integration helpers
- ✅ Relative time formatting
- ✅ Input validation

## Support

For issues or questions:
- Check this guide first
- Review the test file for usage examples
- Consult the TypeScript types for API details
- Contact the development team

## Changelog

### Version 1.0.0 (Current)
- Initial release
- 12-hour AM/PM formatting
- Automatic UTC to local conversion
- Multiple granularity levels
- ECharts integration helpers
- Comprehensive test coverage
- Full TypeScript support
