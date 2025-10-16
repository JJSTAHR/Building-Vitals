# Before/After Code Comparison - Time Formatting Fixes

## Chart 1: EChartsPsychrometric.tsx

### Location 1: Import Statement
```typescript
// BEFORE
import { formatNumberForDisplay } from '../../utils/formatters';
import { enhanceChart } from '../../utils/chartEnhancements';

// AFTER
import { formatNumberForDisplay } from '../../utils/formatters';
import { enhanceChart } from '../../utils/chartEnhancements';
import { formatTooltipTime, formatAxisTime } from '@/utils/chartTimeFormatter';
```

### Location 2: Time Range Label (Line ~443)
```typescript
// BEFORE
const formatDate = (date: Date) => {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// AFTER
const formatDate = (date: Date) => {
  return formatTooltipTime(date.getTime());
};
```

**Output Example**:
- Before: `"1/15/2024 14:30"` (inconsistent, 24-hour format)
- After: `"Jan 15, 2024, 2:30 PM"` (consistent, 12-hour with AM/PM)

### Location 3: Timeline Animation Label (Line ~851)
```typescript
// BEFORE
data: sortedTimes.map(timestamp => ({
  value: timestamp,
  name: new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
})),

// AFTER
data: sortedTimes.map(timestamp => ({
  value: timestamp,
  name: formatAxisTime(timestamp, 'minute')
})),
```

**Output Example**:
- Before: `"2:30 PM"` (correct but duplicated code)
- After: `"2:30 PM"` (same output, centralized)

### Location 4: Tooltip Timestamp (Line ~966)
```typescript
// BEFORE
const date = timestamp ? new Date(timestamp) : null;
const timeStr = date ? date.toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}) : 'Unknown time';

// AFTER
const timeStr = timestamp ? formatTooltipTime(timestamp) : 'Unknown time';
```

**Output Example**:
- Before: `"Jan 15, 02:30"` (missing AM/PM, inconsistent format)
- After: `"Jan 15, 2024, 2:30 PM"` (complete with year and AM/PM)

### Location 5: DataZoom Label (Line ~1094)
```typescript
// BEFORE
labelFormatter: (value: number) => {
  const index = Math.floor((value / 100) * finalData.length);
  const point = finalData[index];
  if (point?.timestamp) {
    return new Date(point.timestamp).toLocaleTimeString();
  }
  return '';
}

// AFTER
labelFormatter: (value: number) => {
  const index = Math.floor((value / 100) * finalData.length);
  const point = finalData[index];
  if (point?.timestamp) {
    return formatAxisTime(point.timestamp, 'minute');
  }
  return '';
}
```

**Output Example**:
- Before: `"2:30:00 PM"` (includes seconds, verbose)
- After: `"2:30 PM"` (concise, no seconds)

### Location 6: Timeline Series Name (Line ~1237)
```typescript
// BEFORE
name: `Conditions at ${new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,

// AFTER
name: `Conditions at ${formatAxisTime(timestamp, 'minute')}`,
```

**Output Example**:
- Before: `"Conditions at 2:30 PM"` (duplicated code)
- After: `"Conditions at 2:30 PM"` (same output, centralized)

### Location 7: Visual Map Formatter (Line ~1413)
```typescript
// BEFORE
formatter: function (value: number) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// AFTER
formatter: function (value: number) {
  return formatAxisTime(value, 'minute');
}
```

**Output Example**:
- Before: `"02:30 PM"` (zero-padded hour)
- After: `"2:30 PM"` (consistent with formatter)

---

## Chart 2: MockDataEnabledLineChart.tsx

### Location 1: Import Statement
```typescript
// BEFORE
import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import * as echarts from 'echarts';

// AFTER
import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import * as echarts from 'echarts';
import { formatTooltipTime, formatAxisTime } from '@/utils/chartTimeFormatter';
```

### Location 2: Tooltip Time Display (Line ~139)
```typescript
// BEFORE
formatter: (params: any) => {
  if (!Array.isArray(params)) return '';

  const time = new Date(params[0].value[0]).toLocaleString();
  let tooltip = `<div style="font-weight: bold; margin-bottom: 5px;">${time}</div>`;

// AFTER
formatter: (params: any) => {
  if (!Array.isArray(params)) return '';

  const time = formatTooltipTime(params[0].value[0]);
  let tooltip = `<div style="font-weight: bold; margin-bottom: 5px;">${time}</div>`;
```

**Output Example**:
- Before: `"1/15/2024, 2:30:00 PM"` (locale-dependent, inconsistent)
- After: `"Jan 15, 2024, 2:30 PM"` (consistent format, no seconds)

### Location 3: X-Axis Labels (Line ~174)
```typescript
// BEFORE
axisLabel: {
  formatter: (value: number) => {
    const date = new Date(value);
    return date.toLocaleDateString() + '\n' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// AFTER
axisLabel: {
  formatter: (value: number) => {
    return formatAxisTime(value, 'minute');
  }
}
```

**Output Example**:
- Before: `"1/15/2024\n14:30"` (multi-line, 24-hour format possible)
- After: `"2:30 PM"` (clean, single-line, consistent)

---

## Chart 3: VAVFaultVisualization.tsx

### Location 1: Import Statement
```typescript
// BEFORE
import { alpha, useTheme } from '@mui/material/styles';
import type { VAVAlarm, VAVHealthAnalysis } from '../../utils/vavDiagnosticsASHRAE';

// AFTER
import { alpha, useTheme } from '@mui/material/styles';
import type { VAVAlarm, VAVHealthAnalysis } from '../../utils/vavDiagnosticsASHRAE';
import { formatTooltipTime, formatAxisTime } from '@/utils/chartTimeFormatter';
```

### Location 2: Fault Timestamp Display (Line ~207)
```typescript
// BEFORE
<Typography variant="caption" sx={{ opacity: 0.9 }}>
  {new Date(fault.timestamp).toLocaleTimeString()}
</Typography>

// AFTER
<Typography variant="caption" sx={{ opacity: 0.9 }}>
  {formatAxisTime(fault.timestamp, 'minute')}
</Typography>
```

**Output Example**:
- Before: `"2:30:00 PM"` (includes seconds)
- After: `"2:30 PM"` (concise, no seconds)

---

## Summary of Changes

### Pattern Analysis

**Old Pattern (Inconsistent)**:
```typescript
// Multiple different approaches
new Date(timestamp).toLocaleString()
new Date(timestamp).toLocaleTimeString()
date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
```

**New Pattern (Consistent)**:
```typescript
// Two centralized functions with clear purposes
formatTooltipTime(timestamp)    // For detailed displays: "Jan 15, 2024, 2:30 PM"
formatAxisTime(timestamp, 'minute')  // For labels: "2:30 PM"
```

### Benefits of New Approach

1. **Consistency**: All times display in same format
2. **Maintainability**: One place to update format
3. **Type Safety**: Functions properly typed
4. **Granularity Control**: Choose display detail level
5. **Testability**: Centralized logic easier to test
6. **Documentation**: Functions well-documented
7. **Performance**: No repeated date parsing

### Format Comparison Table

| Context | Old Format | New Format | Improvement |
|---------|-----------|------------|-------------|
| Tooltip | `"1/15/2024, 2:30:00 PM"` | `"Jan 15, 2024, 2:30 PM"` | Readable month, no seconds |
| Axis Label | `"1/15/2024\n14:30"` | `"2:30 PM"` | Concise, consistent |
| Timeline | `"02:30 PM"` | `"2:30 PM"` | No zero-padding |
| Fault Display | `"2:30:00 PM"` | `"2:30 PM"` | No seconds |
| Visual Map | `"14:30"` | `"2:30 PM"` | 12-hour with AM/PM |

---

**Document Date**: January 16, 2025
**Review Status**: Ready for code review
**Lines of Code Changed**: 12 lines across 3 files
**Code Complexity**: Reduced (centralized utilities)
