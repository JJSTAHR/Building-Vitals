# Chart Time Formatter Migration Checklist

## Overview

This checklist guides you through migrating existing charts to use the centralized time formatter utility.

## Pre-Migration Steps

### 1. Review Current Implementation
- [ ] Identify all chart components using time formatting
- [ ] Document current formatting patterns
- [ ] Note any custom formatting requirements
- [ ] Check for timezone-related issues

### 2. Understand the New Utility
- [ ] Read `CHART_TIME_FORMATTER_SUMMARY.md`
- [ ] Review `CHART_TIME_FORMATTING_GUIDE.md`
- [ ] Study examples in `chartTimeFormatterExample.tsx`
- [ ] Run tests: `npm test chartTimeFormatter.test.ts`

## Chart Components to Update

Use this template for each chart:

```markdown
### Chart: [Chart Name]
- **File**: [path/to/chart.tsx]
- **Current Format**: [e.g., "24-hour", "custom function"]
- **Target Granularity**: [minute/hour/day]
- **Status**: [ ] Not Started / [ ] In Progress / [ ] Complete / [ ] Tested
- **Notes**: [any special requirements]
```

## Migration Steps (Per Chart)

### Step 1: Import the Utility

```typescript
// Add to top of file
import {
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  getOptimalGranularity,
  formatTimeRange
} from '@/utils/chartTimeFormatter';
```

**Checklist:**
- [ ] Added import statement
- [ ] Verified import path is correct
- [ ] No TypeScript errors

### Step 2: Calculate Time Range

```typescript
// In useMemo or component body
const timestamps = data.map(d => d.timestamp);
const minTime = Math.min(...timestamps);
const maxTime = Math.max(...timestamps);
const granularity = getOptimalGranularity(minTime, maxTime);
```

**Checklist:**
- [ ] Extracted min/max timestamps
- [ ] Calculated optimal granularity
- [ ] Stored in useMemo for performance

### Step 3: Update X-Axis Formatter

**Before:**
```typescript
xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => {
      const date = new Date(value);
      return `${date.getHours()}:${date.getMinutes()}`;
    }
  }
}
```

**After:**
```typescript
xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime]),
    rotate: 45,
    hideOverlap: true
  }
}
```

**Checklist:**
- [ ] Replaced custom formatter with `formatEChartsAxisLabel`
- [ ] Passed data range for auto-granularity
- [ ] Added rotation/overlap handling if needed
- [ ] Verified labels display correctly

### Step 4: Update Tooltip Formatter

**Before:**
```typescript
tooltip: {
  formatter: (params: any) => {
    const date = new Date(params.value[0]);
    return `${date.toLocaleString()}: ${params.value[1]}`;
  }
}
```

**After:**
```typescript
tooltip: {
  trigger: 'axis',
  formatter: (params: any) => {
    const time = formatEChartsTooltip(params[0].value[0]);
    const value = params[0].value[1];
    return `${time}<br/>${params[0].seriesName}: ${value}`;
  }
}
```

**Checklist:**
- [ ] Replaced custom formatter with `formatEChartsTooltip`
- [ ] Updated to use array params (`params[0]`)
- [ ] Added series name and value
- [ ] Tested tooltip display

### Step 5: Update Title/Legend (Optional)

```typescript
title: {
  text: 'Chart Title',
  subtext: formatTimeRange(minTime, maxTime)
}
```

**Checklist:**
- [ ] Added time range to subtitle
- [ ] Updated legend if using time ranges
- [ ] Verified text displays correctly

### Step 6: Update DataZoom (If Applicable)

```typescript
dataZoom: [{
  type: 'slider',
  xAxisIndex: 0,
  labelFormatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
}]
```

**Checklist:**
- [ ] Updated dataZoom label formatter
- [ ] Tested zoom functionality
- [ ] Verified labels update correctly

### Step 7: Test the Chart

**Visual Testing:**
- [ ] Times display in 12-hour format
- [ ] AM/PM indicators are present
- [ ] Times are in local timezone (not UTC)
- [ ] Granularity is appropriate for data range
- [ ] Labels don't overlap
- [ ] Tooltips show full date and time
- [ ] All text is readable

**Functional Testing:**
- [ ] Chart renders without errors
- [ ] Data displays correctly
- [ ] Hover tooltips work
- [ ] Zoom/pan works (if applicable)
- [ ] Legend interactions work

**Edge Cases:**
- [ ] Test with single data point
- [ ] Test with large datasets (1000+ points)
- [ ] Test with very short time ranges (< 1 hour)
- [ ] Test with very long time ranges (> 1 month)
- [ ] Test midnight/noon times
- [ ] Test year transitions

### Step 8: Clean Up

**Checklist:**
- [ ] Removed old formatter functions
- [ ] Removed unused imports
- [ ] Removed commented-out code
- [ ] Updated component comments/docs
- [ ] No console warnings/errors

## Common Chart Types

### Temperature/Humidity Charts

```typescript
// Use minute granularity
import { createEChartsFormatter } from '@/utils/chartTimeFormatter';

xAxis: {
  axisLabel: {
    formatter: createEChartsFormatter({ granularity: 'minute' })
  }
}
```

**Charts to Update:**
- [ ] Temperature chart
- [ ] Humidity chart
- [ ] Combined temp/humidity chart

### Energy Consumption Charts

```typescript
// Use hour or day granularity
const granularity = getOptimalGranularity(minTime, maxTime);

xAxis: {
  axisLabel: {
    formatter: createEChartsFormatter({ granularity })
  }
}
```

**Charts to Update:**
- [ ] Energy consumption chart
- [ ] Power usage chart
- [ ] Cost analysis chart

### Sensor Data Charts

```typescript
// Use auto-granularity
formatter: (value) => formatEChartsAxisLabel(value, [minTime, maxTime])
```

**Charts to Update:**
- [ ] CO2 levels chart
- [ ] Occupancy chart
- [ ] Air quality chart
- [ ] Pressure chart

### Comparison Charts

```typescript
// Add time range to legend
legend: {
  formatter: (name: string) => {
    const seriesData = getSeriesData(name);
    const range = formatTimeRange(
      seriesData[0].timestamp,
      seriesData[seriesData.length - 1].timestamp
    );
    return `${name} (${range})`;
  }
}
```

**Charts to Update:**
- [ ] Building comparison chart
- [ ] Floor comparison chart
- [ ] Zone comparison chart

## Validation Checklist

### Before Deployment

- [ ] All charts updated and tested
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] All tests passing
- [ ] Visual regression tests pass
- [ ] Performance is acceptable
- [ ] Documentation updated

### Post-Deployment

- [ ] Monitor for user-reported issues
- [ ] Check analytics for errors
- [ ] Verify timezone handling in different regions
- [ ] Gather user feedback on readability

## Rollback Plan

If issues are found:

1. **Identify Affected Charts**
   - [ ] Document which charts have issues
   - [ ] Note specific problems

2. **Quick Fix Options**
   - [ ] Use explicit granularity instead of auto
   - [ ] Adjust label rotation/spacing
   - [ ] Modify tooltip format

3. **Full Rollback (If Necessary)**
   - [ ] Revert to previous formatters
   - [ ] Document issues for future fix
   - [ ] Create tickets for problems

## Performance Optimization

### For Charts with Large Datasets (1000+ points)

```typescript
// Use coarser granularity
const granularity = dataPoints.length > 1000 ? 'hour' : 'minute';

// Enable ECharts sampling
series: [{
  data: largeDataset,
  sampling: 'lttb',
  large: true
}]

// Cache formatter
const formatter = useMemo(
  () => createEChartsFormatter({ granularity }),
  [granularity]
);
```

**Checklist:**
- [ ] Implemented sampling for large datasets
- [ ] Cached formatter functions
- [ ] Tested performance with large data
- [ ] No lag or stuttering

## Testing Checklist

### Unit Tests

- [ ] All 44 formatter tests passing
- [ ] No new test failures
- [ ] Coverage maintained

### Integration Tests

- [ ] Charts render with real data
- [ ] Formatting consistent across charts
- [ ] No breaking changes

### Visual Tests

- [ ] Screenshot comparison passed
- [ ] No UI regressions
- [ ] Responsive layout works

### Browser Tests

- [ ] Chrome ✓
- [ ] Firefox ✓
- [ ] Safari ✓
- [ ] Edge ✓

### Timezone Tests

- [ ] Tested in multiple timezones
- [ ] DST transitions handled
- [ ] UTC conversion works

## Documentation Updates

- [ ] Update component documentation
- [ ] Update user guide (if applicable)
- [ ] Add code comments for complex logic
- [ ] Update changelog

## Final Sign-Off

### Developer Checklist

- [ ] All migration steps completed
- [ ] All tests passing
- [ ] Code reviewed
- [ ] No known issues
- [ ] Ready for deployment

### Reviewer Checklist

- [ ] Code changes reviewed
- [ ] Tests verified
- [ ] Visual inspection complete
- [ ] Performance acceptable
- [ ] Approved for merge

## Troubleshooting

### Issue: Times showing in 24-hour format

**Solution:**
```typescript
// Ensure using the formatter correctly
formatter: (value) => formatEChartsAxisLabel(value, [minTime, maxTime])
// NOT: value => new Date(value).toLocaleString()
```

### Issue: Wrong timezone displayed

**Solution:**
```typescript
// Ensure timestamps are in milliseconds (not seconds)
const timestamp = 1705334445000; // ✓ milliseconds
// NOT: 1705334445 (seconds)
```

### Issue: Labels overlapping

**Solution:**
```typescript
xAxis: {
  axisLabel: {
    formatter: formatEChartsAxisLabel,
    rotate: 45,
    hideOverlap: true,
    interval: 0 // or 'auto'
  }
}
```

### Issue: Tooltip not showing seconds

**Solution:**
```typescript
// Use showSeconds parameter
formatter: (params) => formatEChartsTooltip(params[0].value[0], true)
```

## Resources

- **API Reference**: `docs/CHART_TIME_FORMATTING_GUIDE.md`
- **Examples**: `examples/chartTimeFormatterExample.tsx`
- **Tests**: `src/utils/__tests__/chartTimeFormatter.test.ts`
- **Source**: `src/utils/chartTimeFormatter.ts`
- **Summary**: `docs/CHART_TIME_FORMATTER_SUMMARY.md`

## Estimated Timeline

- **Small Chart (1-2 series)**: 5-10 minutes
- **Medium Chart (3-5 series)**: 10-20 minutes
- **Complex Chart (6+ series, custom features)**: 20-30 minutes
- **Testing per Chart**: 5-10 minutes
- **Total for 10-15 Charts**: 2-4 hours

## Success Criteria

✅ All charts use centralized formatter
✅ 12-hour AM/PM format everywhere
✅ Consistent timezone handling
✅ No visual regressions
✅ Performance maintained
✅ All tests passing
✅ Documentation complete

---

**Last Updated**: [Date]
**Migration Status**: [ ] Not Started / [ ] In Progress / [ ] Complete
**Migrated Charts**: 0 / [Total]
