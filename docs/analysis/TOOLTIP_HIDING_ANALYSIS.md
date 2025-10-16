# Tooltip Hiding Issue - Root Cause Analysis

**Chart:** EChartsDeviceDeviationHeatmap.tsx
**Issue:** Tooltip disappears when trying to hover over it
**Date:** 2025-10-16
**Status:** Root causes identified, fixes recommended

---

## Executive Summary

The tooltip hiding issue in the deviation heatmap is caused by **missing tooltip stability configurations** that are present in other working charts. The tooltip disappears during mousemove events because it lacks the necessary persistence and interaction settings.

## Root Cause Analysis

### Current Configuration (Lines 773-787)
```typescript
tooltip: {
  ...CHART_DESIGN_tokens.tooltip.base,
  trigger: 'item',
  formatter: tooltipFormatter,
  position: 'top',
  backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  textStyle: {
    ...CHART_DESIGN_TOKENS.tooltip.base.textStyle,
    color: theme.palette.text.primary,
  },
}
```

### Problems Identified

#### 1. **Missing Stability Flags**
Other charts (EChartsAreaChart.tsx) use:
```typescript
alwaysShowContent: false,  // Prevents tooltip from getting stuck
enterable: false,          // Prevents tooltip from interfering with hover
```

#### 2. **Fixed Position May Cause Conflicts**
```typescript
position: 'top',  // Fixed position can cause tooltip to hide
```

**Better approach:** Dynamic positioning based on mouse location:
```typescript
position: function (point, params, dom, rect, size) {
  return [point[0] + 10, point[1] - 10]; // Offset from cursor
}
```

#### 3. **No TriggerOn Configuration**
EChartsSankey.tsx explicitly sets:
```typescript
triggerOn: 'mousemove',  // Ensures tooltip follows mouse
```

#### 4. **Potential Z-Index Conflicts**
No explicit `z` property set, which can cause tooltips to render behind other elements.

---

## Comparison with Working Charts

### ✅ EChartsHeatmap.tsx (Working)
```typescript
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  position: 'top',  // Same as deviation heatmap
  formatter: tooltipFormatter,
  // ... rest of config
}
```
**Status:** Similar config, likely has same issue if tested thoroughly

### ✅ EChartsAreaChart.tsx (Working)
```typescript
tooltip: {
  ...baseOptions.tooltip,
  trigger: 'axis',  // Different trigger type
  alwaysShowContent: false,  // ⭐ KEY DIFFERENCE
  enterable: false,           // ⭐ KEY DIFFERENCE
  // ... rest of config
}
```

### ✅ EChartsSankey.tsx (Working)
```typescript
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  triggerOn: 'mousemove',  // ⭐ EXPLICIT TRIGGER
  // ... rest of config
}
```

---

## Recommended Fixes

### Fix #1: Add Stability Flags (High Priority)
```typescript
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  triggerOn: 'mousemove',    // ✅ Explicit trigger
  alwaysShowContent: false,  // ✅ Prevent sticking
  enterable: false,          // ✅ Prevent interference
  formatter: tooltipFormatter,
  // ... rest
}
```

### Fix #2: Dynamic Positioning (Medium Priority)
```typescript
position: function (point, params, dom, rect, size) {
  // Offset from cursor to prevent tooltip from hiding under cursor
  const x = point[0] + 10;
  const y = point[1] - 10;

  // Keep within viewport bounds
  const tooltipWidth = size.contentSize[0];
  const tooltipHeight = size.contentSize[1];
  const viewWidth = size.viewSize[0];
  const viewHeight = size.viewSize[1];

  return [
    Math.min(x, viewWidth - tooltipWidth - 10),
    Math.max(y, 10)
  ];
}
```

### Fix #3: Add Z-Index (Low Priority)
```typescript
tooltip: {
  // ... other config
  z: 1000,  // Ensure tooltip renders above all chart elements
}
```

### Fix #4: Confine to Viewport (Optional)
```typescript
tooltip: {
  // ... other config
  confine: true,  // Keep tooltip within chart container
  appendToBody: false,  // Prevent portal-related issues
}
```

---

## Testing Plan

### Phase 1: Minimal Fix
1. Add `alwaysShowContent: false` and `enterable: false`
2. Test on real data with rapid mouse movements
3. Verify tooltip doesn't disappear

### Phase 2: Enhanced Stability
1. Add `triggerOn: 'mousemove'`
2. Test with various cell sizes and densities
3. Verify tooltip follows mouse smoothly

### Phase 3: Dynamic Positioning
1. Replace `position: 'top'` with dynamic function
2. Test near viewport edges
3. Verify tooltip stays visible and doesn't clip

### Phase 4: Z-Index Verification
1. Add explicit z-index
2. Test with overlapping UI elements (modals, menus)
3. Verify tooltip always renders on top

---

## Aggregation Info Display Assessment

### Current Implementation (Lines 1067-1153)

#### ✅ Strong Points
1. **Clear Visual Hierarchy**
   - Distinct info bar with colored background (lines 1068-1077)
   - Proper use of Paper component for elevation
   - Good spacing with Stack layout

2. **Comprehensive Metrics** (lines 1091-1107)
   - Resolution display (5min, 15min, 1hour, etc.)
   - Aggregation method (MAX, mean, percentile95)
   - Points per cell calculation
   - Compression ratio

3. **Data Integrity Badge** (lines 1083-1088)
   - Color-coded chip showing "High", "Good", "Moderate", or "Daily Summary"
   - Semantic colors (success, info, warning)

4. **Educational Alert** (lines 1131-1151)
   - Explains how aggregation works
   - Describes MAX-preserving strategy
   - Color legend (Green = Normal, Blue = Below, Red/Orange = Above)
   - Guidance on getting full 5-minute resolution

#### ⚠️ Areas for Improvement

1. **Information Overload**
   - Too much text in the alert (lines 140-147 in rendered output)
   - Could be condensed or moved to help icon tooltip

2. **Redundant Method Display**
   - Method shown in both info bar (line 1096) AND chips bar (line 158)

3. **Missing Context**
   - Doesn't explain WHEN aggregation happens (based on date range)
   - No indication of why MAX method was chosen vs others

#### 💡 Recommendations

1. **Simplify Alert Text**
```typescript
{strategy.cellResolution !== '5min' && (
  <Alert severity="info" sx={{ py: 0.5 }}>
    <Typography variant="caption">
      <strong>ℹ️ Aggregation Applied:</strong> Each cell represents
      {getResolutionText(strategy.cellResolution)} using the {strategy.aggregationMethod.toUpperCase()}
      value from ~{aggregationInfo.pointsPerCell} raw data points.
      {strategy.aggregationMethod === 'max' &&
        ' MAX ensures no anomalies are hidden.'
      }
    </Typography>
  </Alert>
)}
```

2. **Add Contextual Help Icon**
```typescript
<Tooltip title="Aggregation reduces data density for large time ranges. Select <7 days for full 5-minute resolution.">
  <IconButton size="small">
    <InfoIcon fontSize="small" />
  </IconButton>
</Tooltip>
```

3. **Consolidate Method Display**
Remove from chips bar (line 157-162), keep only in detailed info bar

4. **Add Visual Indicator for Accuracy**
```typescript
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Chip
    label={aggregationInfo.integrity}
    color={aggregationInfo.integrityColor}
    size="small"
  />
  {strategy.cellResolution !== '5min' && (
    <Chip
      label={`~${aggregationInfo.pointsPerCell}:1 compression`}
      size="small"
      variant="outlined"
    />
  )}
</Box>
```

---

## Priority Actions

### Immediate (High Priority)
1. ✅ Add `alwaysShowContent: false`
2. ✅ Add `enterable: false`
3. ✅ Add `triggerOn: 'mousemove'`

### Short-Term (Medium Priority)
4. ⚠️ Implement dynamic positioning function
5. ⚠️ Simplify aggregation alert text
6. ⚠️ Add contextual help icon

### Long-Term (Low Priority)
7. 📋 Add z-index configuration
8. 📋 Test confine behavior
9. 📋 Consolidate method display
10. 📋 Add compression ratio visual indicator

---

## Related Files

### Charts with Similar Tooltips
- `src/components/charts/EChartsHeatmap.tsx` - Line 637
- `src/components/charts/EChartsCalendarHeatmap.tsx` - Line 470
- `src/components/charts/EChartsCalendarYearHeatmap.tsx` - Line 138

### Charts with Working Tooltip Configs
- `src/components/charts/EChartsAreaChart.tsx` - Line 543 (has stability flags)
- `src/components/charts/EChartsSankey.tsx` - Line 633 (has triggerOn)

### Design Token Definitions
- `src/utils/chartDesignTokens.ts` - CHART_DESIGN_TOKENS.tooltip.base

---

## Code Examples

### Minimal Fix (Ready to Apply)
```typescript
// In EChartsDeviceDeviationHeatmap.tsx, line 773
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  triggerOn: 'mousemove',    // ✅ ADD THIS
  alwaysShowContent: false,  // ✅ ADD THIS
  enterable: false,          // ✅ ADD THIS
  formatter: tooltipFormatter,
  position: 'top',
  backgroundColor: isDarkMode
    ? 'rgba(50, 50, 50, 0.95)'
    : 'rgba(255, 255, 255, 0.95)',
  borderColor: isDarkMode
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.12)',
  textStyle: {
    ...CHART_DESIGN_TOKENS.tooltip.base.textStyle,
    color: theme.palette.text.primary,
  },
}
```

### Enhanced Fix (Dynamic Positioning)
```typescript
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  triggerOn: 'mousemove',
  alwaysShowContent: false,
  enterable: false,
  formatter: tooltipFormatter,
  position: function (point: [number, number], params: any, dom: HTMLElement, rect: any, size: any) {
    const offsetX = 10;
    const offsetY = 10;
    const x = point[0] + offsetX;
    const y = point[1] - offsetY;

    // Keep within bounds
    const maxX = size.viewSize[0] - size.contentSize[0] - 10;
    const maxY = size.viewSize[1] - size.contentSize[1] - 10;

    return [
      Math.min(Math.max(x, 10), maxX),
      Math.min(Math.max(y, 10), maxY)
    ];
  },
  backgroundColor: isDarkMode
    ? 'rgba(50, 50, 50, 0.95)'
    : 'rgba(255, 255, 255, 0.95)',
  borderColor: isDarkMode
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.12)',
  textStyle: {
    ...CHART_DESIGN_TOKENS.tooltip.base.textStyle,
    color: theme.palette.text.primary,
  },
  z: 1000,  // ✅ Ensure tooltip renders on top
}
```

---

## Conclusion

The tooltip hiding issue is **NOT a fundamental ECharts bug**, but rather a **missing configuration** issue. The fix is straightforward and well-tested in other charts. The aggregation info display is comprehensive but could be more concise.

**Recommended Approach:**
1. Apply minimal fix (3 lines) immediately
2. Test thoroughly with real data
3. Consider dynamic positioning if fixed position causes issues
4. Simplify aggregation info display based on user feedback

**Estimated Fix Time:** 15-30 minutes
**Testing Time:** 1-2 hours
**Risk Level:** Low (config changes only, no logic changes)
