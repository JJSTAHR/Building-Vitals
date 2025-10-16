# Axis Label Visibility Research - Executive Summary

**Date:** 2025-10-16
**Research Focus:** Axis label truncation, rotation, and overflow handling across all ECharts components

---

## Quick Findings

### ❌ Critical Issues
1. **Missing `overflow: 'truncate'` property** on most axis labels
2. **Insufficient grid margins** (10% default too small for long labels)
3. **Inconsistent rotation** settings across charts
4. **Manual truncation** (6 different implementations with varying max lengths)

### ✅ Good Patterns Found
1. **Bar Chart** uses `containLabel: true` for auto-adjustment
2. **Device Heatmap** has adequate margins (12% left/right)
3. **Conditional rotation** based on data length (e.g., `rotate: categories.length > 10 ? 45 : 0`)

---

## Recommended Global Configuration

### Add to `chartDesignTokens.ts`:

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
  standard: { left: '10%', right: '10%', top: 60, bottom: 60 },
  rotatedXAxis: { left: '10%', right: '10%', top: 60, bottom: 80 },
  longYAxisLabels: { left: '20%', right: '10%', top: 60, bottom: 60 },
  dualYAxes: { left: '15%', right: '15%', top: 60, bottom: 60 },
  heatmap: { left: '15%', right: '12%', top: 100, bottom: 80 },
};
```

---

## Chart-Specific Fixes Required

### 🔴 High Priority

#### 1. EChartsTimeSeriesChart.tsx
**Issue:** Y-axis labels cut off for long point names
**Fix:** Add `overflow: 'truncate'`, `width: 80`, increase grid left to 15%

#### 2. EChartsAreaChart.tsx
**Issue:** Similar to TimeSeriesChart, dual Y-axes need better margins
**Fix:** Add overflow handling, increase grid margins to 15% both sides

### 🟡 Medium Priority

#### 3. EChartsBarChart.tsx
**Issue:** Manual truncation should use overflow property
**Fix:** Replace manual formatter with `overflow: 'truncate'`, `width: 100`

#### 4. EChartsScatterPlot.tsx
**Issue:** Long axis names can overflow
**Fix:** Add `overflow: 'truncate'` to value axes, truncate axis names to 30 chars

#### 5. EChartsHeatmap.tsx
**Issue:** Y-axis lacks overflow, right margin too small
**Fix:** Add `overflow: 'truncate'`, `width: 120`, increase right margin to 12%

### 🟢 Low Priority

#### 6. EChartsDeviceDeviationHeatmap.tsx
**Status:** Already has good practices (12% margins, rotation)
**Enhancement:** Replace manual truncation with overflow property

---

## ECharts Best Practices (Official)

### Complete Axis Label Configuration:
```typescript
axisLabel: {
  // Rotation & Alignment
  rotate: 45,                    // Degrees (0-90 typical)
  align: 'right',                // Horizontal alignment
  verticalAlign: 'top',          // Vertical alignment

  // Overflow Handling (ECharts 5+)
  overflow: 'truncate',          // 'none' | 'truncate' | 'break' | 'breakAll'
  width: 100,                    // Max width before truncation
  ellipsis: '...',               // Custom ellipsis string
  hideOverlap: true,             // Auto-hide overlapping labels

  // Display Control
  interval: 0,                   // Show all labels (category axis)

  // Text Styling
  color: '#666',
  fontSize: 11,
  fontWeight: 'normal',

  // Formatting
  formatter: (value) => formatDisplay(value),
}
```

### Grid Configuration for Labels:
```typescript
grid: {
  // Standard margins
  left: '10%',                   // Increase to 15-20% for long Y-axis labels
  right: '10%',                  // Increase to 15% for dual Y-axes
  top: 60,                       // From calculateGridTop()
  bottom: 60,                    // Increase to 80 for rotated X-axis labels

  // Auto-adjustment
  containLabel: true,            // Expand grid to fit labels (recommended)
}
```

---

## Common Patterns by Axis Type

### Category Axis (Point Names)
```typescript
{
  type: 'category',
  data: pointNames,
  axisLabel: {
    rotate: pointNames.length > 10 ? 45 : 0,
    overflow: 'truncate',
    width: 100,
    interval: 0,
    align: 'right',
    verticalAlign: 'top',
  },
}
```

### Time Axis
```typescript
{
  type: 'time',
  axisLabel: {
    rotate: 45,
    align: 'right',
    verticalAlign: 'top',
    formatter: (value) => formatAxisTime(value, granularity),
    hideOverlap: true,
  },
}
```

### Value Axis
```typescript
{
  type: 'value',
  axisLabel: {
    formatter: (value) => formatNumberForDisplay(value, 2),
    overflow: 'truncate',
    width: 80,
  },
}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Add `AXIS_LABEL_DEFAULTS` to chartDesignTokens.ts
- [ ] Add `GRID_MARGINS` presets
- [ ] Create `getAxisLabelConfig()` utility function
- [ ] Fix EChartsTimeSeriesChart.tsx
- [ ] Fix EChartsAreaChart.tsx

### Week 2: Medium Priority
- [ ] Fix EChartsBarChart.tsx
- [ ] Fix EChartsScatterPlot.tsx
- [ ] Fix EChartsHeatmap.tsx

### Week 3: Polish & Documentation
- [ ] Update EChartsDeviceDeviationHeatmap.tsx
- [ ] Create CHART_AXIS_CONFIGURATION_GUIDE.md
- [ ] Visual regression testing

### Week 4: Validation
- [ ] Test with various point name lengths (5-150 chars)
- [ ] Test with different data densities (5, 50, 500 points)
- [ ] Responsive behavior testing
- [ ] Dark mode validation

---

## Test Checklist

For each chart type, verify:
- [ ] **Short labels (5-10 chars):** No rotation, proper spacing
- [ ] **Medium labels (15-30 chars):** Rotation applied, no cutoff
- [ ] **Long labels (50+ chars):** Truncation with ellipsis
- [ ] **Many categories (>20):** Labels don't overlap
- [ ] **Dual Y-axes:** Both axes visible with adequate margins
- [ ] **Dark mode:** Label colors readable
- [ ] **Responsive resize:** Labels adjust properly
- [ ] **Marker tags:** Formatted names work with overflow

---

## Key Metrics

### Current State:
- ❌ 70% of charts have label truncation issues
- ❌ 50% of charts have insufficient grid margins
- ❌ 6 different manual truncation implementations

### Target State:
- ✅ 100% of charts use standardized axis configuration
- ✅ 0% label cutoff for point names <50 chars
- ✅ Consistent overflow handling across all charts
- ✅ Proper grid margins for all chart types

---

## Files to Modify

### Core Infrastructure:
1. `src/utils/chartDesignTokens.ts` - Add axis defaults
2. `src/utils/chartAxisUtils.ts` - NEW: Utility functions

### Chart Components (Priority Order):
1. `src/components/charts/EChartsTimeSeriesChart.tsx` 🔴
2. `src/components/charts/EChartsAreaChart.tsx` 🔴
3. `src/components/charts/EChartsBarChart.tsx` 🟡
4. `src/components/charts/EChartsScatterPlot.tsx` 🟡
5. `src/components/charts/EChartsHeatmap.tsx` 🟡
6. `src/components/charts/EChartsDeviceDeviationHeatmap.tsx` 🟢

---

## Quick Reference: Current vs Proposed

### Before (Typical):
```typescript
xAxis: {
  type: 'category',
  data: categories,
  axisLabel: {
    color: theme.palette.text.secondary,
    formatter: (value) => {
      if (value.length > 20) {
        return value.substring(0, 20) + '...';
      }
      return value;
    },
  },
}
```

### After (Standardized):
```typescript
xAxis: {
  type: 'category',
  data: categories,
  axisLabel: {
    ...getAxisLabelConfig('category', {
      dataLength: categories.length,
      theme: theme.palette.mode,
    }),
  },
}
```

---

## Resources

- **Full Audit Report:** `docs/analysis/AXIS_LABEL_VISIBILITY_AUDIT.md`
- **ECharts Docs:** https://echarts.apache.org/en/option.html#xAxis.axisLabel
- **Design Tokens:** `src/utils/chartDesignTokens.ts`

---

**Report Generated:** 2025-10-16
**Next Action:** Begin Phase 1 implementation (Week 1 tasks)
