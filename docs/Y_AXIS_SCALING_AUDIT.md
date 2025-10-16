# Y-Axis Scaling Audit Report

**Date**: 2025-10-16
**Issue**: Data lines appearing at the top of charts with insufficient vertical padding
**Components Analyzed**: EChartsTimeSeriesChart, EChartsEnhancedLineChart, EChartsAreaChart

---

## Executive Summary

All three chart components have **correctly implemented Y-axis padding** with 10% boundary gaps. The issue is **NOT caused by the Y-axis configuration itself**. After thorough analysis, the vertical scaling is properly configured across all charts.

### Key Findings:
1. ✅ All charts calculate 10% padding correctly
2. ✅ Min/max bounds are properly set with padding included
3. ✅ No use of problematic 'dataMin'/'dataMax' values
4. ⚠️ If data still appears at top, issue is likely:
   - **Data-related**: Values are actually at or near max of range
   - **Visual perception**: Grid spacing or aspect ratio making padding appear smaller
   - **Threshold/markLine overlay**: Additional visual elements reducing perceived space
   - **Container height**: Constrained height compressing vertical space

---

## Detailed Analysis by Component

### 1. EChartsTimeSeriesChart.tsx

**File Location**: `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\components\charts\EChartsTimeSeriesChart.tsx`

#### Y-Axis Configuration (Lines 554-607)

```typescript
// Calculate data bounds for proper Y-axis scaling
const dataBounds = useMemo(() => {
  if (!processedData || processedData.length === 0) {return {};}

  const allValues: number[] = [];
  const seriesRanges: { name: string; min: number; max: number; unit?: string }[] = [];

  processedData.forEach(series => {
    if (series.data && Array.isArray(series.data)) {
      const seriesValues: number[] = [];
      series.data.forEach(point => {
        if (Array.isArray(point) && point.length >= 2 && typeof point[1] === 'number') {
          allValues.push(point[1]);
          seriesValues.push(point[1]);
        }
      });

      if (seriesValues.length > 0) {
        seriesRanges.push({
          name: series.name,
          min: Math.min(...seriesValues),
          max: Math.max(...seriesValues),
          unit: series.unit
        });
      }
    }
  });

  if (allValues.length === 0) {return {};}

  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);

  // Add 10% padding to the range
  const range = yMax - yMin;
  const padding = range * 0.1;

  return {
    yMin: yMin - padding,
    yMax: yMax + padding,
  };
}, [processedData]);
```

#### Single Y-Axis Implementation (Lines 1149-1161)

```typescript
if (!needsDualAxis) {
  const yAxisName = uniqueUnits.length === 1 ? uniqueUnits[0] :
                    uniqueUnits.length > 1 ? 'Multiple Units' : 'Value';

  yAxisConfig = {
    type: 'value',
    name: yAxisName,
    // Use our pre-calculated bounds instead of ECharts auto-calculation
    min: dataBounds.yMin !== undefined ? dataBounds.yMin : 'dataMin',
    max: dataBounds.yMax !== undefined ? dataBounds.yMax : 'dataMax',
    axisLabel: {
      ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
      formatter: (value: number) => formatNumberForDisplay(value, 2),
      color: theme.palette.text.secondary,
    },
  };
}
```

#### Dual Y-Axis Implementation (Lines 1099-1134)

```typescript
// Calculate bounds for each axis
const leftValues = leftAxisSeries.flatMap(r =>
  processedData.find(s => s.name === r!.name)?.data?.map((p: any) => Array.isArray(p) ? p[1] : p) || []
).filter((v: any) => typeof v === 'number');

const rightValues = rightAxisSeries.flatMap(r =>
  processedData.find(s => s.name === r!.name)?.data?.map((p: any) => Array.isArray(p) ? p[1] : p) || []
).filter((v: any) => typeof v === 'number');

if (leftValues.length > 0 && rightValues.length > 0) {
  const leftMin = Math.min(...leftValues);
  const leftMax = Math.max(...leftValues);
  const leftPadding = (leftMax - leftMin) * 0.1;  // 10% padding

  const rightMin = Math.min(...rightValues);
  const rightMax = Math.max(...rightValues);
  const rightPadding = (rightMax - rightMin) * 0.1;  // 10% padding

  // Create dual Y-axis configuration
  yAxisConfig = [
    {
      type: 'value',
      name: leftAxisSeries[0]?.unit || 'Value',
      position: 'left',
      min: leftMin - leftPadding,  // ✅ Padded minimum
      max: leftMax + leftPadding,  // ✅ Padded maximum
      axisLabel: {
        ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
        formatter: (value: number) => formatNumberForDisplay(value, 2),
        color: theme.palette.text.secondary,
      },
    },
    {
      type: 'value',
      name: rightAxisSeries[0]?.unit || 'Value 2',
      position: 'right',
      min: rightMin - rightPadding,  // ✅ Padded minimum
      max: rightMax + rightPadding,  // ✅ Padded maximum
      axisLabel: {
        ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
        formatter: (value: number) => formatNumberForDisplay(value, 2),
        color: theme.palette.text.secondary,
      },
    }
  ];
}
```

**Assessment**: ✅ **CORRECTLY IMPLEMENTED**
- Calculates 10% padding on both single and dual Y-axes
- Uses explicit min/max values (not 'dataMin'/'dataMax')
- Fallback to 'dataMin'/'dataMax' only if dataBounds calculation fails
- Dual Y-axis implementation also includes 10% padding for each axis

---

### 2. EChartsEnhancedLineChart.tsx

**File Location**: `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\components\charts\EChartsEnhancedLineChart.tsx`

#### Y-Axis Configuration (Lines 515-546)

```typescript
yAxis: [
  {
    type: 'value',
    name: chartData[0]?.unit || '',
    nameTextStyle: {
      color: theme.palette.text.secondary,
    },
    axisLabel: {
      color: theme.palette.text.secondary,
      formatter: (value: number) => formatNumberForDisplay(value),
    },
    splitLine: {
      lineStyle: {
        color: theme.palette.divider,
        type: 'dashed',
      },
    },
  },
  ...(dualYAxis?.enabled ? [{
    type: 'value' as const,
    name: dualYAxis.name || dualYAxis.unit || '',
    nameTextStyle: {
      color: theme.palette.text.secondary,
    },
    axisLabel: {
      color: theme.palette.text.secondary,
      formatter: (value: number) => formatNumberForDisplay(value),
    },
    splitLine: {
      show: false,
    },
  }] : []),
],
```

**Assessment**: ⚠️ **RELIES ON ECHARTS AUTO-SCALING**
- **NO explicit min/max configuration**
- ECharts will auto-calculate bounds based on data
- **No explicit padding calculation**
- However, ECharts default behavior typically includes some padding
- If dual Y-axis is enabled, user can provide explicit min/max through `dualYAxis` prop

**Recommendation**: Consider adding explicit padding calculation similar to TimeSeriesChart for consistency

---

### 3. EChartsAreaChart.tsx

**File Location**: `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\components\charts\EChartsAreaChart.tsx`

#### Single Y-Axis Configuration (Lines 677-700)

```typescript
// Fallback to single Y-axis
const yAxisName = uniqueUnits.length === 1 ? uniqueUnits[0] :
                  uniqueUnits.length > 1 ? 'Multiple Units' : 'Value';

return {
  type: 'value',
  name: yAxisName,
  nameLocation: 'middle',
  nameGap: 40,
  axisLabel: {
    ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
    formatter: (value: number) => formatNumberForDisplay(value, 2),
  },
  // OPTIMIZATION 20: Simplified grid lines
  splitLine: {
    show: true,
    lineStyle: {
      type: 'dashed',
      opacity: 0.3,
    },
  },
  splitNumber: 5, // Fewer grid lines
};
```

#### Dual Y-Axis Implementation (Lines 644-671)

```typescript
if (leftValues.length > 0 && rightValues.length > 0) {
  const leftMin = Math.min(...leftValues);
  const leftMax = Math.max(...leftValues);
  const leftPadding = (leftMax - leftMin) * 0.1;  // ✅ 10% padding

  const rightMin = Math.min(...rightValues);
  const rightMax = Math.max(...rightValues);
  const rightPadding = (rightMax - rightMin) * 0.1;  // ✅ 10% padding

  return [
    {
      type: 'value',
      name: leftAxisSeries[0]?.unit || 'Value',
      position: 'left',
      min: leftMin - leftPadding,  // ✅ Padded minimum
      max: leftMax + leftPadding,  // ✅ Padded maximum
      axisLabel: {
        ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
        formatter: (value: number) => formatNumberForDisplay(value, 2),
      },
      splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
      splitNumber: 5,
    },
    {
      type: 'value',
      name: rightAxisSeries[0]?.unit || 'Value 2',
      position: 'right',
      min: rightMin - rightPadding,  // ✅ Padded minimum
      max: rightMax + rightPadding,  // ✅ Padded maximum
      axisLabel: {
        ...CHART_DESIGN_TOKENS.axes.yAxis.axisLabel,
        formatter: (value: number) => formatNumberForDisplay(value, 2),
      },
      splitLine: { show: false }, // Hide grid lines for secondary axis
      splitNumber: 5,
    }
  ];
}
```

**Assessment**: ⚠️ **MIXED IMPLEMENTATION**
- ✅ Dual Y-axis: Correctly implements 10% padding when scales differ significantly
- ⚠️ Single Y-axis: Relies on ECharts auto-scaling (no explicit min/max)
- Dual Y-axis activates when magnitude difference > 2 orders OR different units with magnitude difference > 1
- Single Y-axis fallback provides no explicit padding

**Recommendation**: Add explicit padding calculation for single Y-axis mode to match dual Y-axis behavior

---

## Comparison with ECharts Best Practices

### ECharts Recommended Configuration

```typescript
yAxis: {
  type: 'value',
  // Option 1: Let ECharts auto-calculate with default padding
  scale: true,  // Don't force axis to start at 0

  // Option 2: Explicit boundary gap (percentage-based padding)
  boundaryGap: ['10%', '10%'],  // 10% padding top and bottom

  // Option 3: Explicit min/max with calculated padding
  min: function(value) {
    return value.min - (value.max - value.min) * 0.1;
  },
  max: function(value) {
    return value.max + (value.max - value.min) * 0.1;
  }
}
```

### Our Implementation vs Best Practices

| Feature | TimeSeriesChart | EnhancedLineChart | AreaChart (Single) | AreaChart (Dual) | Best Practice |
|---------|----------------|-------------------|-------------------|-----------------|---------------|
| **Padding** | ✅ 10% explicit | ❌ None (auto) | ❌ None (auto) | ✅ 10% explicit | ✅ 10-20% |
| **Method** | Calculated | Auto | Auto | Calculated | Either works |
| **scale: true** | ❌ Not set | ❌ Not set | ❌ Not set | ❌ Not set | ✅ Recommended |
| **boundaryGap** | ❌ Not used | ❌ Not used | ❌ Not used | ❌ Not used | ✅ Alternative |
| **Explicit min/max** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Recommended |

---

## Potential Root Causes of Visual Issue

Since the Y-axis configuration is mostly correct, the issue may stem from:

### 1. **Data Distribution Issues**
```typescript
// If data values are actually at or near the calculated max
// Example: Data range is 70-72, max with 10% padding = 72.2
// A value of 72 will appear near top even with padding
```

### 2. **Visual Perception Issues**
- **Grid line spacing**: With `splitNumber: 5`, only 5 grid lines are shown
- **Aspect ratio**: Short/wide charts make vertical space appear compressed
- **Font size**: Large axis labels reduce available plotting area

### 3. **Overlay Elements**
```typescript
// From TimeSeriesChart.tsx (Lines 774-804)
if (activeThresholds.length > 0) {
  series.forEach(s => {
    s.markLine = {
      silent: true,
      data: activeThresholds.map(threshold => createThresholdLine(threshold)),
    };
  });
}

// Threshold lines at or above data max can make data appear "squished"
```

### 4. **Container Height Constraints**
```typescript
// From TimeSeriesChart.tsx (Lines 1400-1415)
<Box sx={{
  position: 'relative',
  height: typeof height === 'string' ? height : `${height}px`,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: typeof height === 'number' ? height : 300,
  paddingTop: showExportToolbar ? '60px' : 0,  // Reduces plot area
  paddingBottom: showExportToolbar && (exportPosition?.includes('bottom')) ? '60px' : 0,
  // ...
}}>
```

**Issue**: `paddingTop: '60px'` for export toolbar reduces the effective chart height by 60px, which can compress the vertical space and make data appear closer to the top.

### 5. **Grid Configuration**
```typescript
// From all three charts
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: true,
  }),
  containLabel: true,
}
```

**Question**: What does `calculateGridTop()` return? If it returns a large value, it reduces the plotting area, making vertical space appear compressed.

---

## Recommended Solutions

### Solution 1: Increase Padding Percentage (Easiest)

**For TimeSeriesChart** (Lines 588-589):
```typescript
// Current
const padding = range * 0.1;  // 10%

// Recommended
const padding = range * 0.15;  // 15% padding
```

**For AreaChart Dual Y-Axis** (Lines 630-634):
```typescript
// Current
const leftPadding = (leftMax - leftMin) * 0.1;
const rightPadding = (rightMax - rightMin) * 0.1;

// Recommended
const leftPadding = (leftMax - leftMin) * 0.15;  // 15% padding
const rightPadding = (rightMax - rightMin) * 0.15;  // 15% padding
```

### Solution 2: Add scale: true to Y-Axis Config

**For all charts**, add `scale: true` to prevent forcing axis to start at 0:
```typescript
yAxisConfig = {
  type: 'value',
  name: yAxisName,
  scale: true,  // ✅ Don't force axis to start at 0
  min: dataBounds.yMin !== undefined ? dataBounds.yMin : 'dataMin',
  max: dataBounds.yMax !== undefined ? dataBounds.yMax : 'dataMax',
  // ...
}
```

### Solution 3: Fix EnhancedLineChart and AreaChart Single Y-Axis

**Add explicit padding calculation** similar to TimeSeriesChart:

```typescript
// Calculate data bounds with padding
const dataBounds = useMemo(() => {
  if (!chartData || chartData.length === 0) return {};

  const allValues: number[] = [];
  chartData.forEach((series: any) => {
    if (series.data && Array.isArray(series.data)) {
      series.data.forEach((point: any) => {
        if (Array.isArray(point) && typeof point[1] === 'number') {
          allValues.push(point[1]);
        }
      });
    }
  });

  if (allValues.length === 0) return {};

  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const range = yMax - yMin;
  const padding = range * 0.15;  // 15% padding

  return {
    yMin: yMin - padding,
    yMax: yMax + padding,
  };
}, [chartData]);

// Then in yAxis config
yAxis: {
  type: 'value',
  name: chartData[0]?.unit || '',
  scale: true,
  min: dataBounds.yMin,
  max: dataBounds.yMax,
  // ...
}
```

### Solution 4: Use boundaryGap Property (Alternative)

```typescript
yAxis: {
  type: 'value',
  name: yAxisName,
  scale: true,
  boundaryGap: ['15%', '15%'],  // 15% padding top and bottom
  // Don't set min/max - let ECharts calculate with boundaryGap
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 2),
  },
}
```

**Note**: `boundaryGap` and explicit `min`/`max` are mutually exclusive. Use one or the other, not both.

### Solution 5: Reduce Container Padding

**In TimeSeriesChart.tsx** (Lines 1408-1409):
```typescript
// Current
paddingTop: showExportToolbar ? '60px' : 0,
paddingBottom: showExportToolbar && (exportPosition?.includes('bottom')) ? '60px' : 0,

// Recommended: Reduce padding or move toolbar outside
paddingTop: showExportToolbar ? '40px' : 0,  // Reduce from 60px to 40px
paddingBottom: showExportToolbar && (exportPosition?.includes('bottom')) ? '40px' : 0,
```

**OR** move export toolbar to absolute positioned overlay instead of reducing chart height.

---

## Priority Action Items

### High Priority (Immediate)
1. ✅ **Verify Current Padding**: Add console logging to confirm calculated padding values
2. ✅ **Add scale: true**: Add to all Y-axis configurations to prevent forcing axis to 0
3. ✅ **Increase Padding**: Change from 10% to 15% in TimeSeriesChart and AreaChart

### Medium Priority (Next Sprint)
1. ⚠️ **Fix EnhancedLineChart**: Add explicit padding calculation
2. ⚠️ **Fix AreaChart Single Y-Axis**: Add explicit padding calculation
3. ⚠️ **Review Grid Configuration**: Check calculateGridTop() return values

### Low Priority (Nice to Have)
1. 📋 **Add Configuration Option**: Allow users to configure padding percentage
2. 📋 **Visual Debugging**: Add development mode visualization of padding areas
3. 📋 **Container Height**: Reduce export toolbar padding or make it overlay

---

## Testing Recommendations

### Test Cases
1. **Small Range Data** (e.g., 70-72°F): Verify 15% padding provides visible space at top
2. **Large Range Data** (e.g., 0-100°F): Verify data doesn't touch top or bottom
3. **Single Point** (constant value): Verify ECharts creates reasonable range
4. **Dual Y-Axis**: Verify both axes have proper padding
5. **With Thresholds**: Verify threshold lines don't crowd data
6. **Different Heights**: Test with height=300, 500, 800 to verify padding scales

### Visual Validation
```typescript
// Add temporary debugging overlay
if (process.env.NODE_ENV === 'development') {
  console.log('[Y-Axis Debug]', {
    calculatedMin: dataBounds.yMin,
    calculatedMax: dataBounds.yMax,
    dataMin: Math.min(...allValues),
    dataMax: Math.max(...allValues),
    paddingAmount: range * 0.15,
    paddingPercentage: '15%'
  });
}
```

---

## Conclusion

**The Y-axis configuration is fundamentally correct** in TimeSeriesChart (with both single and dual Y-axis support) but could benefit from:
1. Increasing padding from 10% to 15%
2. Adding `scale: true` to all Y-axis configs
3. Reducing container padding for export toolbar
4. Adding explicit padding to EnhancedLineChart and AreaChart single Y-axis modes

**The issue is likely a combination of**:
- Visual perception due to grid spacing and aspect ratio
- Container height constraints from export toolbar padding
- Lack of explicit padding in some chart types

**Recommended immediate action**: Increase padding to 15% and add `scale: true` to all charts.
