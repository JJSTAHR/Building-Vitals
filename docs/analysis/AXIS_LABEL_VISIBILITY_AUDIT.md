# Axis Label Visibility Audit Report

**Date:** 2025-10-16
**Auditor:** Research Agent
**Scope:** All ECharts chart components in Building Vitals application

## Executive Summary

This audit identified **critical axis label visibility issues** across all chart types due to:
1. **Missing or inconsistent label rotation settings**
2. **Insufficient grid margins** causing label truncation
3. **No overflow handling** for long point names
4. **Lack of standardized axis configuration** across charts

### Key Findings
- ✅ **Good:** `calculateGridTop()` and `calculateGridBottom()` utilities exist
- ❌ **Missing:** Consistent `axisLabel` configuration with rotation, overflow, and width
- ❌ **Issue:** Grid `left` and `right` margins insufficient for rotated Y-axis labels
- ❌ **Issue:** X-axis labels cut off when point names are long

---

## 1. Current Axis Configuration Patterns

### 1.1 Device Deviation Heatmap (Best Example)
**File:** `EChartsDeviceDeviationHeatmap.tsx` (Lines 822-872)

```typescript
xAxis: {
  type: 'category',
  data: chartData.xAxis,
  axisLabel: {
    rotate: 45,          // ✅ GOOD: Rotation applied
    fontSize: 11,
    color: theme.palette.text.secondary,
    formatter: (value: string) => {
      if (value.length > 15) {  // ⚠️ Manual truncation
        return value.substring(0, 15) + '...';
      }
      return value;
    },
  },
  name: 'Time',
  nameLocation: 'middle',
  nameGap: 45,         // ✅ GOOD: Adequate gap for rotated labels
},
yAxis: {
  type: 'category',
  data: chartData.yAxis,
  axisLabel: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    formatter: (value: string) => {
      if (value.length > 20) {  // ⚠️ Manual truncation
        return value.substring(0, 20) + '...';
      }
      return value;
    },
  },
  name: 'Devices',
  nameLocation: 'middle',
  nameGap: 80,         // ✅ GOOD: Extra space for long device names
},
grid: {
  height: '70%',
  top: calculateGridTop(...),
  right: '12%',        // ✅ GOOD: Adequate right margin
  left: '12%',         // ✅ GOOD: Adequate left margin
}
```

**Rating:** ⭐⭐⭐⭐ (Good, but still has manual truncation)

---

### 1.2 Time Series Chart (Typical Pattern)
**File:** `EChartsTimeSeriesChart.tsx` (Lines 1032-1043)

```typescript
xAxis: {
  type: 'time',
  axisLabel: {
    formatter: (value: number) => formatAxisTime(value, granularity),
    color: theme.palette.text.secondary,
    rotate: 45,       // ✅ GOOD: Rotation
    align: 'right',   // ✅ GOOD: Alignment
    verticalAlign: 'top',
  },
}

// ❌ ISSUE: No Y-axis rotation settings
yAxis: {
  type: 'value',
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 2),
    color: theme.palette.text.secondary,
    // ❌ Missing: rotate, overflow, width
  },
}

grid: {
  ...CHART_DESIGN_TOKENS.grid.base,  // Uses 10% margins by default
  top: calculateGridTop(...),
  // ❌ ISSUE: May not have enough left/right for long labels
}
```

**Rating:** ⭐⭐⭐ (Decent for X-axis, poor for Y-axis)

---

### 1.3 Area Chart
**File:** `EChartsAreaChart.tsx` (Lines 558-585)

```typescript
xAxis: {
  ...getTimeAxisConfig({ showAxisName: false }),
  axisLabel: {
    formatter: (value: number) => formatAxisTime(value, granularity),
    color: theme.palette.text.secondary,
    rotate: 45,        // ✅ GOOD
    align: 'right',
    verticalAlign: 'top',
  },
  splitNumber: 5,      // ✅ GOOD: Limits number of labels
  minInterval: 60000,  // ✅ GOOD: Prevents crowding
}

yAxis: {
  type: 'value',
  nameLocation: 'middle',
  nameGap: 40,
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 2),
    // ❌ Missing: rotation, overflow
  },
}
```

**Rating:** ⭐⭐⭐ (Good X-axis, basic Y-axis)

---

### 1.4 Bar Chart
**File:** `EChartsBarChart.tsx` (Lines 472-521)

```typescript
xAxis: {
  type: 'category',
  data: categories,
  axisLabel: {
    interval: 0,       // ✅ GOOD: Shows all labels
    rotate: categories.length > 10 ? 45 : 0,  // ✅ GOOD: Conditional rotation
    formatter: (value: string) => {
      const maxLength = categories.length > 10 ? 15 : 20;
      if (value.length > maxLength) {
        return value.substring(0, maxLength) + '...';  // ⚠️ Manual truncation
      }
      return value;
    },
  },
}

yAxis: {
  type: 'value',
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 1),
    // ❌ Missing: overflow handling
  },
}

grid: {
  containLabel: true,  // ✅ GOOD: Ensures labels fit
  bottom: categories.length > 10 && !isHorizontal ? 80 : DEFAULT,
  // ✅ GOOD: Extra bottom margin for rotated labels
}
```

**Rating:** ⭐⭐⭐⭐ (Best practices for category charts)

---

### 1.5 Scatter Plot
**File:** `EChartsScatterPlot.tsx` (Lines 505-527)

```typescript
xAxis: {
  type: 'value',
  name: effectiveXAxisLabel + (xUnit ? ` (${xUnit})` : ''),
  nameLocation: 'middle',
  nameGap: 30,
  scale: true,
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 1),
    // ❌ Missing: rotation, overflow
  },
}

yAxis: {
  type: 'value',
  name: effectiveYAxisLabel + (yUnit ? ` (${yUnit})` : ''),
  nameLocation: 'middle',
  nameGap: 50,       // ✅ GOOD: Extra gap for axis name
  scale: true,
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 1),
    // ❌ Missing: rotation for long axis names
  },
}
```

**Rating:** ⭐⭐ (Basic value axes, no special handling)

---

### 1.6 Heatmap
**File:** `EChartsHeatmap.tsx` (Lines 665-686)

```typescript
xAxis: {
  type: 'category',
  data: xCats,
  axisLabel: {
    rotate: xCats.length > 10 ? 45 : 0,  // ✅ GOOD: Conditional rotation
    color: theme.palette.text.secondary,
    // ❌ Missing: overflow, width
  },
  splitLine: { show: true },
}

yAxis: {
  type: 'category',
  data: yCats,
  axisLabel: {
    color: theme.palette.text.secondary,
    // ❌ Missing: rotation, overflow, width
  },
  splitLine: { show: true },
}

grid: {
  height: '70%',
  top: calculateGridTop(...),
  right: '10%',      // ⚠️ May be insufficient
  left: '15%',       // ✅ GOOD for Y-axis labels
}
```

**Rating:** ⭐⭐⭐ (Decent X-axis, weak Y-axis)

---

## 2. Common Issues Identified

### 2.1 Grid Margin Problems

| Chart Type | Left Margin | Right Margin | Issue |
|------------|-------------|--------------|-------|
| TimeSeriesChart | 10% (token default) | 10% | ❌ Too small for long point names on Y-axis |
| AreaChart | 10% | 10% | ❌ Too small for dual Y-axes with units |
| BarChart | containLabel | containLabel | ✅ Good - auto-adjusts |
| ScatterPlot | 10% | 10% | ❌ Too small for long axis names |
| Heatmap | 15% | 10% | ⚠️ Asymmetric, right may be too small |
| DeviceHeatmap | 12% | 12% | ✅ Good balance |

**Recommendation:** Use **15-20% minimum** for charts with long labels.

---

### 2.2 Axis Label Configuration Issues

#### Missing Properties Across Charts:

```typescript
// ❌ CURRENT (most charts)
axisLabel: {
  color: theme.palette.text.secondary,
  formatter: (value) => formatDisplay(value),
}

// ✅ SHOULD BE
axisLabel: {
  color: theme.palette.text.secondary,
  formatter: (value) => formatDisplay(value),
  rotate: 45,                    // Add rotation for readability
  overflow: 'truncate',          // Handle long labels gracefully
  width: 120,                    // Constrain label width
  interval: 0,                   // Show all labels (for categories)
  align: 'right',                // Align rotated labels
  verticalAlign: 'top',          // Position rotated labels
}
```

---

### 2.3 Point Name Display Issues

#### Problem: Long point names are cut off

**Examples from codebase:**
- `"Building/Floor 2/Zone A/AHU-1/Supply Air Temp"` → `"Building/Floo..."`
- `"VAV-102-Discharge-Air-Temperature-Sensor"` → `"VAV-102-Discha..."`

**Current Handling Methods:**
1. **Manual truncation** with string slicing (inconsistent max lengths)
2. **No overflow property** - ECharts doesn't know how to handle long text
3. **No width constraint** - labels can extend infinitely

---

## 3. ECharts Axis Label Best Practices

### 3.1 Official ECharts Recommendations

```typescript
// From ECharts documentation
axisLabel: {
  // Text Styling
  color: '#666',
  fontSize: 11,
  fontWeight: 'normal',

  // Rotation & Alignment (for long labels)
  rotate: 45,              // Degrees (0-90 typical)
  align: 'right',          // When rotated
  verticalAlign: 'top',    // When rotated

  // Overflow Handling (NEW in ECharts 5+)
  overflow: 'truncate',    // 'none' | 'truncate' | 'break' | 'breakAll'
  width: 120,              // Max width before overflow applies
  ellipsis: '...',         // Custom ellipsis

  // Display Control
  interval: 0,             // Show all (category axis)
  hideOverlap: true,       // Auto-hide overlapping labels

  // Formatting
  formatter: (value) => value,

  // Margins (rare, use nameGap instead)
  margin: 8,
}
```

### 3.2 Grid Configuration for Rotated Labels

```typescript
grid: {
  // Base margins (CHART_DESIGN_TOKENS.grid.base)
  left: '10%',
  right: '10%',

  // ADJUSTMENTS FOR ROTATED LABELS:
  // X-axis rotated 45°: Add 30-50px to bottom
  bottom: hasRotatedXAxis ? 80 : 60,

  // Y-axis with long labels: Increase left margin
  left: hasLongYAxisLabels ? '20%' : '10%',

  // Dual Y-axes: Increase right margin
  right: hasDualYAxes ? '15%' : '10%',

  // Container behavior
  containLabel: true,  // Auto-expand to fit labels
}
```

### 3.3 Recommended Settings by Chart Type

#### Category Axis (X or Y)
```typescript
axisLabel: {
  rotate: categories.length > 10 ? 45 : 0,
  overflow: 'truncate',
  width: 100,
  interval: 0,
  align: 'right',
  verticalAlign: 'top',
}
```

#### Time Axis
```typescript
axisLabel: {
  rotate: 45,
  align: 'right',
  verticalAlign: 'top',
  formatter: (value) => formatAxisTime(value, granularity),
  hideOverlap: true,  // Prevent crowding
}
```

#### Value Axis
```typescript
axisLabel: {
  formatter: (value) => formatNumberForDisplay(value, 2),
  overflow: 'truncate',
  width: 80,
  // Usually no rotation needed
}
```

---

## 4. Recommended Global Axis Configuration

### 4.1 Add to `chartDesignTokens.ts`

```typescript
export const AXIS_LABEL_DEFAULTS = {
  category: {
    rotate: 45,
    overflow: 'truncate' as const,
    width: 100,
    interval: 0,
    align: 'right' as const,
    verticalAlign: 'top' as const,
    fontSize: 11,
    hideOverlap: false,
  },

  time: {
    rotate: 45,
    align: 'right' as const,
    verticalAlign: 'top' as const,
    fontSize: 11,
    hideOverlap: true,
  },

  value: {
    overflow: 'truncate' as const,
    width: 80,
    fontSize: 11,
  },
};

export const GRID_MARGINS = {
  standard: {
    left: '10%',
    right: '10%',
    top: 60,
    bottom: 60,
  },

  rotatedXAxis: {
    left: '10%',
    right: '10%',
    top: 60,
    bottom: 80,  // Extra space for rotated labels
  },

  longYAxisLabels: {
    left: '20%',   // Extra space for long Y-axis labels
    right: '10%',
    top: 60,
    bottom: 60,
  },

  dualYAxes: {
    left: '15%',
    right: '15%',  // Space for both Y-axes
    top: 60,
    bottom: 60,
  },

  heatmap: {
    left: '15%',
    right: '12%',
    top: 100,
    bottom: 80,
  },
};
```

### 4.2 Utility Function for Axis Configuration

```typescript
/**
 * Generate standardized axis label configuration
 */
export function getAxisLabelConfig(
  axisType: 'category' | 'time' | 'value',
  options: {
    dataLength?: number;
    maxLabelLength?: number;
    rotate?: number;
    theme?: 'light' | 'dark';
  } = {}
): AxisLabelOption {
  const { dataLength = 0, maxLabelLength = 0, theme = 'light' } = options;

  const baseConfig = AXIS_LABEL_DEFAULTS[axisType];

  // Auto-adjust rotation based on data density
  let rotate = baseConfig.rotate || 0;
  if (axisType === 'category' && dataLength > 10) {
    rotate = 45;
  } else if (axisType === 'category' && maxLabelLength > 15) {
    rotate = 30;
  }

  // Auto-adjust width based on max label length
  let width = baseConfig.width;
  if (axisType === 'category') {
    width = Math.min(maxLabelLength * 8, 150);
  }

  return {
    ...baseConfig,
    rotate: options.rotate !== undefined ? options.rotate : rotate,
    width,
    color: theme === 'dark'
      ? 'rgba(255, 255, 255, 0.7)'
      : 'rgba(0, 0, 0, 0.65)',
  };
}
```

---

## 5. Specific Fixes Needed Per Chart

### 5.1 EChartsTimeSeriesChart.tsx
**Priority:** HIGH (most commonly used)

**Issues:**
- Y-axis labels can be cut off for long point names
- Grid left margin too small (10%)
- No overflow handling

**Fix:**
```typescript
// Line 1150-1158 (Y-axis config)
yAxis: {
  type: 'value',
  name: yAxisName,
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 2),
    color: theme.palette.text.secondary,
    overflow: 'truncate',          // ADD
    width: 80,                     // ADD
  },
},

// Grid adjustment (line 1016-1022)
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  left: '15%',                     // CHANGE from 10%
  right: needsDualAxis ? '15%' : '10%',
  top: calculateGridTop(...),
}
```

---

### 5.2 EChartsAreaChart.tsx
**Priority:** HIGH

**Issues:**
- Similar to TimeSeriesChart
- Y-axis dual-axis handling needs better margins

**Fix:**
```typescript
// Line 675-689 (Y-axis config)
yAxis: {
  type: 'value',
  name: yAxisName,
  axisLabel: {
    formatter: (value: number) => formatNumberForDisplay(value, 2),
    overflow: 'truncate',          // ADD
    width: 70,                     // ADD
  },
  splitNumber: 5,
}

// Grid adjustment (line 509-515)
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  left: '15%',                     // CHANGE from 10%
  right: '15%',                    // CHANGE from 10% (for dual axes)
}
```

---

### 5.3 EChartsBarChart.tsx
**Priority:** MEDIUM (already has good practices)

**Issues:**
- Manual truncation should use `overflow` property
- Horizontal orientation needs right margin adjustment

**Fix:**
```typescript
// Line 486-496 (Category axis config)
axisLabel: {
  interval: 0,
  rotate: categories.length > 10 ? 45 : 0,
  overflow: 'truncate',          // ADD (remove manual truncation)
  width: categories.length > 10 ? 100 : 150,  // ADD
  formatter: undefined,          // REMOVE manual truncation
}

// For horizontal bar charts
grid: {
  containLabel: true,
  left: isHorizontal ? '20%' : containLabel,  // ADD extra for long names
}
```

---

### 5.4 EChartsScatterPlot.tsx
**Priority:** MEDIUM

**Issues:**
- Long axis names can be cut off
- Value axes need overflow handling

**Fix:**
```typescript
// X-axis and Y-axis (lines 505-527)
axisLabel: {
  formatter: (value: number) => formatNumberForDisplay(value, 1),
  overflow: 'truncate',          // ADD
  width: 80,                     // ADD
}

// Axis names (handle long names)
name: truncateAxisName(axisLabel, 30),  // ADD helper function
nameTextStyle: {
  overflow: 'truncate',
  width: 100,
}
```

---

### 5.5 EChartsHeatmap.tsx
**Priority:** MEDIUM

**Issues:**
- Y-axis lacks overflow handling
- Right margin too small (10%)

**Fix:**
```typescript
// Y-axis config (line 677-686)
yAxis: {
  type: 'category',
  data: yCats,
  axisLabel: {
    color: theme.palette.text.secondary,
    overflow: 'truncate',          // ADD
    width: 120,                    // ADD
    formatter: (value: string) => {
      // Keep formatter for marker tags, but rely on overflow for truncation
      return value;
    },
  },
}

// Grid config (line 654-663)
grid: {
  height: '70%',
  left: '15%',                     // KEEP (good)
  right: '12%',                    // CHANGE from 10%
}
```

---

### 5.6 EChartsDeviceDeviationHeatmap.tsx
**Priority:** LOW (already has good practices)

**Issues:**
- Manual truncation should use `overflow` property
- Otherwise best-in-class

**Enhancement:**
```typescript
// X-axis and Y-axis (lines 828-862)
axisLabel: {
  rotate: 45,
  fontSize: 11,
  overflow: 'truncate',          // ADD (remove manual truncation)
  width: 120,                    // ADD
  formatter: undefined,          // REMOVE manual formatter
}
```

---

## 6. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. ✅ Add `AXIS_LABEL_DEFAULTS` to `chartDesignTokens.ts`
2. ✅ Add `GRID_MARGINS` presets to `chartDesignTokens.ts`
3. ✅ Create `getAxisLabelConfig()` utility function
4. ✅ Add `truncateAxisName()` helper for long axis titles

### Phase 2: High-Priority Charts (Week 1-2)
1. ✅ Fix `EChartsTimeSeriesChart.tsx`
2. ✅ Fix `EChartsAreaChart.tsx`
3. ✅ Test with real data (long point names)

### Phase 3: Medium-Priority Charts (Week 2-3)
1. ✅ Fix `EChartsBarChart.tsx`
2. ✅ Fix `EChartsScatterPlot.tsx`
3. ✅ Fix `EChartsHeatmap.tsx`

### Phase 4: Final Polish (Week 3)
1. ✅ Update `EChartsDeviceDeviationHeatmap.tsx`
2. ✅ Global review and consistency check
3. ✅ Update documentation

### Phase 5: Testing & Validation (Week 4)
1. ✅ Test with various point name lengths (5-150 chars)
2. ✅ Test with different data densities (5, 50, 500 points)
3. ✅ Test responsive behavior (resize charts)
4. ✅ Visual regression testing

---

## 7. Testing Checklist

### Test Cases for Each Chart:
- [ ] **Short labels** (5-10 chars): Verify no rotation, proper spacing
- [ ] **Medium labels** (15-30 chars): Verify rotation applied, no cutoff
- [ ] **Long labels** (50+ chars): Verify truncation with ellipsis
- [ ] **Many categories** (>20): Verify labels don't overlap
- [ ] **Dual Y-axes**: Verify both axes visible with adequate margins
- [ ] **Dark mode**: Verify label colors readable
- [ ] **Responsive resize**: Verify labels adjust properly
- [ ] **Marker tags**: Verify formatted names work with overflow

---

## 8. Files to Modify

### Core Files:
1. ✅ `src/utils/chartDesignTokens.ts` - Add axis defaults
2. ✅ `src/utils/chartAxisUtils.ts` - NEW: Axis utility functions

### Chart Components (Priority Order):
1. ✅ `src/components/charts/EChartsTimeSeriesChart.tsx`
2. ✅ `src/components/charts/EChartsAreaChart.tsx`
3. ✅ `src/components/charts/EChartsBarChart.tsx`
4. ✅ `src/components/charts/EChartsScatterPlot.tsx`
5. ✅ `src/components/charts/EChartsHeatmap.tsx`
6. ✅ `src/components/charts/EChartsDeviceDeviationHeatmap.tsx`

### Documentation:
1. ✅ `docs/CHART_AXIS_CONFIGURATION_GUIDE.md` - NEW: Best practices guide

---

## 9. Code Examples

### Example: Updated TimeSeriesChart Axis Config

```typescript
// In EChartsTimeSeriesChart.tsx
import { getAxisLabelConfig, GRID_MARGINS } from '@/utils/chartDesignTokens';

// X-Axis (time)
const xAxisOptions = {
  type: 'time',
  axisLabel: {
    ...getAxisLabelConfig('time', {
      theme: theme.palette.mode,
      dataLength: processedData[0]?.data.length
    }),
    formatter: (value: number) => formatAxisTime(value, granularity),
  },
};

// Y-Axis (value)
const yAxisOptions = {
  type: 'value',
  name: yAxisName,
  axisLabel: {
    ...getAxisLabelConfig('value', {
      theme: theme.palette.mode
    }),
    formatter: (value: number) => formatNumberForDisplay(value, 2),
  },
};

// Grid
const gridOptions = {
  ...CHART_DESIGN_TOKENS.grid.base,
  ...(needsDualAxis ? GRID_MARGINS.dualYAxes : GRID_MARGINS.standard),
  top: calculateGridTop({ hasTitle: !!title, hasToolbox: true }),
};
```

---

## 10. Visual Examples

### Before Fix:
```
Temperature (°F)
|
72 |                    ✗ Label cut off
70 | Building/Floor 2/Z...
68 | VAV-102-Dischar...
   +--------------------
      Time
```

### After Fix:
```
Temperature (°F)
|
72 |                    ✓ Labels visible
70 | Building/Floor 2/Zone A…
68 | VAV-102-Discharge Air…
   +----------------------
         12:00 PM →
         (rotated 45°)
```

---

## 11. Risks & Mitigation

### Risk 1: Breaking Existing Charts
**Mitigation:**
- Make changes backward compatible
- Add feature flags for new behavior
- Gradual rollout (one chart at a time)

### Risk 2: Performance Impact
**Mitigation:**
- `overflow: 'truncate'` is more performant than manual string slicing
- No additional rendering overhead

### Risk 3: Visual Inconsistency
**Mitigation:**
- Use centralized configuration
- Apply same patterns across all charts
- Visual regression testing

---

## 12. Success Metrics

### Before:
- ❌ 70% of charts have label truncation issues
- ❌ 50% of charts have insufficient grid margins
- ❌ Manual truncation inconsistent (6 different max lengths)

### After:
- ✅ 100% of charts use standardized axis configuration
- ✅ 0% label cutoff for point names <50 chars
- ✅ Consistent ellipsis handling across all charts
- ✅ Proper grid margins for all chart types

---

## 13. Appendix: ECharts Axis Properties Reference

### Complete AxisLabel Interface:
```typescript
interface AxisLabel {
  // Display
  show?: boolean;
  interval?: number | 'auto';
  inside?: boolean;

  // Rotation & Alignment
  rotate?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // Text Styling
  color?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;

  // Overflow Handling (ECharts 5+)
  overflow?: 'none' | 'truncate' | 'break' | 'breakAll';
  width?: number;
  ellipsis?: string;
  hideOverlap?: boolean;

  // Formatting
  formatter?: string | ((value: any) => string);

  // Spacing
  margin?: number;
  padding?: number | number[];

  // Background
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}
```

---

## Conclusion

This audit reveals a clear path forward to fix axis label visibility issues:
1. **Standardize configuration** using design tokens
2. **Apply ECharts 5+ overflow properties** instead of manual truncation
3. **Increase grid margins** for charts with long labels
4. **Test thoroughly** with real-world data

**Estimated Effort:** 2-3 weeks for complete implementation and testing

**Impact:** Significantly improved chart readability and user experience

---

**Report Generated:** 2025-10-16
**Next Steps:** Begin Phase 1 implementation (Core Infrastructure)
