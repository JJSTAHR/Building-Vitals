# Chart Time Formatter - Quick Reference

## Overview

Production-ready centralized utility for consistent 12-hour AM/PM time formatting across all charts with automatic UTC to local timezone conversion.

## Files Created

### Core Utility
- `src/utils/chartTimeFormatter.ts` (360 lines)
  - 10 main functions
  - Full TypeScript support
  - Comprehensive JSDoc documentation

### Tests
- `src/utils/__tests__/chartTimeFormatter.test.ts`
  - 44 unit tests (all passing ✅)
  - Covers all functions and edge cases
  - Timezone-agnostic testing

### Documentation
- `docs/CHART_TIME_FORMATTING_GUIDE.md` (comprehensive guide)
  - API reference
  - Usage examples
  - Migration guide
  - Best practices

### Examples
- `examples/chartTimeFormatterExample.tsx`
  - 6 complete chart examples
  - Real-world usage patterns
  - ECharts integration demos

## Quick Start

### Basic Import

```typescript
import {
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  formatTimeRange,
  getOptimalGranularity
} from '@/utils/chartTimeFormatter';
```

### Simple Chart Integration

```typescript
const option = {
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
    }
  },
  tooltip: {
    formatter: (params: any) => {
      const time = formatEChartsTooltip(params[0].value[0]);
      return `${time}<br/>${params[0].seriesName}: ${params[0].value[1]}`;
    }
  }
};
```

## Key Functions

| Function | Purpose | Example Output |
|----------|---------|----------------|
| `formatAxisTime(ts, 'minute')` | Axis labels | "2:30 PM" |
| `formatTooltipTime(ts)` | Tooltip text | "Jan 15, 2024, 2:30:45 PM" |
| `formatTimeRange(start, end)` | Time ranges | "2:30 PM - 5:45 PM" |
| `getOptimalGranularity(s, e)` | Auto-detect level | 'minute', 'hour', 'day', etc. |
| `formatRelativeTime(ts)` | Relative time | "2 hours ago" |

## Granularity Levels

- **second**: "2:30:45 PM"
- **minute**: "2:30 PM"
- **hour**: "2 PM"
- **day**: "Jan 15, 2 PM"
- **month**: "Jan 15"

## Features

✅ **12-Hour AM/PM Format** - User-friendly time display
✅ **Auto Timezone Conversion** - UTC to browser local time
✅ **Smart Granularity** - Auto-detects optimal level based on data range
✅ **ECharts Optimized** - Helper functions for seamless integration
✅ **Type Safe** - Full TypeScript support with comprehensive types
✅ **Well Tested** - 44 passing unit tests covering all scenarios
✅ **Documented** - Extensive documentation and examples

## Migration Path

### Before (Hardcoded)
```typescript
formatter: (value) => {
  const date = new Date(value);
  return `${date.getHours()}:${date.getMinutes()}`;
}
```

### After (Centralized)
```typescript
import { formatEChartsAxisLabel } from '@/utils/chartTimeFormatter';

formatter: (value) => formatEChartsAxisLabel(value, [minTime, maxTime])
```

## Timezone Behavior

All timestamps are **stored in UTC** and **displayed in local time**:

```typescript
// Input: UTC timestamp
const utcTimestamp = 1705334445000; // Jan 15, 2024, 2:30:45 PM UTC

// Output: Local timezone (example: EST = UTC-5)
formatTooltipTime(utcTimestamp);
// → "Jan 15, 2024, 9:30:45 AM" (in EST)

// Output: Local timezone (example: PST = UTC-8)
formatTooltipTime(utcTimestamp);
// → "Jan 15, 2024, 6:30:45 AM" (in PST)
```

## Common Patterns

### Pattern 1: Temperature/Humidity (Minute Granularity)
```typescript
xAxis: {
  axisLabel: {
    formatter: createEChartsFormatter({ granularity: 'minute' })
  }
}
```

### Pattern 2: Daily Trends (Hour Granularity)
```typescript
xAxis: {
  axisLabel: {
    formatter: createEChartsFormatter({ granularity: 'hour' })
  }
}
```

### Pattern 3: Auto-Granularity (Recommended)
```typescript
const granularity = getOptimalGranularity(minTime, maxTime);
xAxis: {
  axisLabel: {
    formatter: createEChartsFormatter({ granularity })
  }
}
```

### Pattern 4: Real-Time with "Last Updated"
```typescript
const lastUpdated = formatRelativeTime(timestamp);
// Updates automatically: "2 minutes ago" → "3 minutes ago"
```

## Testing

Run tests:
```bash
npm test chartTimeFormatter.test.ts
```

Expected: **44/44 tests passing** ✅

## Performance

- Uses native `toLocaleString()` - highly optimized
- Cache formatter functions with `useMemo`
- Use appropriate granularity for large datasets
- Leverage ECharts sampling for 1000+ points

## API Summary

### Core Formatting
- `formatAxisTime(timestamp, granularity?)` - Format axis labels
- `formatTooltipTime(timestamp, options?)` - Format tooltips
- `formatTimeRange(start, end)` - Format time ranges

### ECharts Integration
- `formatEChartsAxisLabel(value, range?)` - Axis labels with auto-granularity
- `formatEChartsTooltip(value, showSeconds?)` - Tooltip formatter
- `createEChartsFormatter(options?)` - Custom formatter function

### Utilities
- `getOptimalGranularity(start, end)` - Auto-detect granularity
- `parseTimestamp(time)` - Parse various time formats
- `isValidTimestamp(timestamp)` - Validate timestamps
- `formatRelativeTime(timestamp, base?)` - Relative time ("2 hours ago")

## TypeScript Types

```typescript
type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'month';

interface TimeFormatterOptions {
  granularity?: TimeGranularity;
  showSeconds?: boolean;
  showDate?: boolean;
  hour12?: boolean;
}
```

## Next Steps

1. **Review Documentation**: Read `CHART_TIME_FORMATTING_GUIDE.md`
2. **Study Examples**: Check `examples/chartTimeFormatterExample.tsx`
3. **Run Tests**: Verify with `npm test chartTimeFormatter.test.ts`
4. **Start Migration**: Replace hardcoded formatters in existing charts
5. **Test Integration**: Verify charts display correctly with 12-hour format

## Support Resources

- **API Reference**: See `CHART_TIME_FORMATTING_GUIDE.md`
- **Examples**: See `examples/chartTimeFormatterExample.tsx`
- **Tests**: See `src/utils/__tests__/chartTimeFormatter.test.ts`
- **Source Code**: See `src/utils/chartTimeFormatter.ts` (well-documented)

## Benefits

### Before Centralization
❌ Inconsistent 24-hour format
❌ No AM/PM indicators
❌ Manual timezone handling
❌ Duplicated code in each chart
❌ Hard to maintain

### After Centralization
✅ Consistent 12-hour AM/PM format
✅ Clear AM/PM indicators
✅ Automatic timezone conversion
✅ Single source of truth
✅ Easy to maintain and update
✅ Type-safe with TypeScript
✅ Well-tested and documented

## Estimated Impact

- **Charts to Update**: ~10-15 chart components
- **Time per Chart**: ~5-10 minutes
- **Total Migration**: ~2-3 hours
- **Long-term Benefit**: Consistent UX + easier maintenance

---

**Status**: ✅ Ready for Production
**Test Coverage**: 44/44 passing
**Documentation**: Complete
**Examples**: 6 patterns provided
