# Tooltip Regression Debug Report

**Date**: 2025-10-16
**Issue**: Recent tooltip "fixes" made tooltips worse - now covering entire charts
**Status**: Root cause identified

---

## Executive Summary

Recent changes to tooltip configuration introduced THREE critical regressions that made tooltips cover charts instead of improving them:

1. **400px max-width** is TOO LARGE for most tooltip content
2. **z-index: 10000** floats tooltips above everything, preventing chart interaction
3. **Removed smart positioning function** that kept tooltips from blocking data

**User Impact**: Charts became unusable because tooltips obscure data and never go away.

---

## Timeline of Changes

### BEFORE "Fixes" (Working State)

**Location**: `useBaseChartOptions.ts` (lines 283-310)

```typescript
tooltip: {
  trigger: 'axis',
  backgroundColor: themeConfig.tooltipBackground,
  borderColor: themeConfig.tooltipBorder,
  borderWidth: 1,
  textStyle: {
    color: isDarkMode ? sesColorPalette.textPrimary : 'rgba(10, 14, 39, 0.9)',
  },
  axisPointer: {
    type: 'cross',
    lineStyle: {
      color: alpha(themeConfig.textColor, 0.3),
      type: 'dashed',
    },
    crossStyle: {
      color: alpha(themeConfig.textColor, 0.3),
    },
  },
  // ✅ SMART POSITIONING FUNCTION
  position: function (point: any, params: any, dom: any, rect: any, size: any) {
    const tooltipWidth = size.contentSize[0];
    const tooltipHeight = size.contentSize[1];
    const viewWidth = size.viewSize[0];
    const viewHeight = size.viewSize[1];

    let x = point[0] + 20;
    let y = point[1] - tooltipHeight / 2;

    // Adjust horizontal position if tooltip goes off screen
    if (x + tooltipWidth > viewWidth - 10) {
      x = point[0] - tooltipWidth - 20;
    }

    // Adjust vertical position if tooltip goes off screen
    if (y < 10) {
      y = 10;
    } else if (y + tooltipHeight > viewHeight - 10) {
      y = viewHeight - tooltipHeight - 10;
    }

    return [x, y];
  },
  // ✅ SENSIBLE AUTO-SIZING
  extraCssText: 'max-height: 400px; overflow-y: auto; min-width: 150px; width: auto;',
}
```

**Why this worked**:
- Smart positioning function kept tooltips visible but NOT blocking data
- Auto-width (`width: auto`) sized tooltip to content
- Only limited height, not width
- No excessive z-index

---

### AFTER "Fixes" (Broken State)

**Location**: `chartDesignTokens.ts` (lines 259-288)

```typescript
tooltip: {
  base: {
    trigger: 'axis' as const,
    confine: true, // ⚠️ PROBLEM #1: Prevents smart positioning
    enterable: true, // ⚠️ PROBLEM #2: Tooltip stays when mouse enters it
    hideDelay: 200, // ⚠️ PROBLEM #3: Delays tooltip hiding
    borderWidth: 1,
    padding: SPACING.sm, // 8px
    textStyle: {
      fontSize: TYPOGRAPHY.caption.fontSize,
    },
    axisPointer: {
      type: 'cross' as const,
      animation: false,
      lineStyle: {
        type: 'dashed' as const,
      },
    },
    // ⚠️ CRITICAL PROBLEM #4: Fixed width constraint
    extraCssText: 'max-width: 400px; word-wrap: break-word; pointer-events: auto; z-index: 10000;',
    // ❌ CRITICAL PROBLEM #5: Smart positioning function REMOVED
  },
}
```

---

## Root Cause Analysis

### Problem #1: `confine: true` Prevents Smart Positioning

**What it does**: Forces tooltip to stay within chart boundaries
**Why it's bad**: When combined with removing the positioning function, tooltips get confined to chart area and can't intelligently position themselves away from data points

**Evidence**:
```typescript
// Found in 16 files:
// chartFeatures.ts:412:    confine: true, // Keep tooltip within chart bounds
// echartsOptimization.ts:50:      confine: true,
// chartDesignTokens.ts:263:      confine: true,
```

**Impact**: Tooltip stuck in chart area, can't move to side

---

### Problem #2: `extraCssText: 'max-width: 400px'`

**What it does**: Allows tooltips to be up to 400px wide
**Why it's bad**: Most tooltip content is 150-200px. A 400px tooltip covers massive portions of the chart

**Before**: `min-width: 150px; width: auto;` (tooltip sized to content)
**After**: `max-width: 400px` (tooltip can grow huge)

**Calculation**:
- Typical chart width: 800-1200px
- 400px tooltip = 33-50% of chart width
- User complaint: "tooltips cover entire charts" ✅ CONFIRMED

**Impact**: Unnecessarily large tooltips block data visualization

---

### Problem #3: `z-index: 10000`

**What it does**: Places tooltip above all other elements
**Why it's bad**: Creates a floating overlay that's always on top, preventing interaction with chart underneath

**Before**: No explicit z-index (normal stacking order)
**After**: `z-index: 10000` (highest priority)

**Evidence from grep**:
```typescript
// chartDesignTokens.ts:280: extraCssText: '... z-index: 10000;'
```

**Impact**: Tooltip floats above chart controls, making chart unusable

---

### Problem #4: Removed Smart Positioning Function

**What it did**: Dynamically positioned tooltip to avoid edges and data points
**Why removal broke it**: Without this function, ECharts uses default positioning which doesn't account for chart boundaries

**Before**: 26-line intelligent positioning function
**After**: Comment says "Smart positioning function defined in useBaseChartOptions" but it's NOT actually used

**Code comparison**:
```typescript
// ✅ BEFORE: Smart positioning in useBaseChartOptions.ts
position: function (point, params, dom, rect, size) {
  // 26 lines of intelligent positioning logic
  return [x, y];
}

// ❌ AFTER: Design tokens just has comment, no function
// chartDesignTokens.ts:281: // Smart positioning function defined in useBaseChartOptions
// But chartDesignTokens doesn't include the function!
```

**Impact**: Tooltips appear wherever ECharts defaults place them, often covering data

---

### Problem #5: `enterable: true` + `hideDelay: 200`

**What it does**: Allows mouse to enter tooltip, delays hiding for 200ms
**Why it's bad**: Combined effect makes tooltip "sticky" - it doesn't disappear when you move mouse away

**Before**: No enterable, immediate hide
**After**: Tooltip persists, user has to actively move mouse away from it

**Impact**: Tooltips stay visible longer, increasing chance they block important data

---

## Additional Evidence from Heatmap Charts

Found specific issue in `EChartsDeviceDeviationHeatmap.tsx:784`:
```typescript
position: 'top', // Simple string - let ECharts handle positioning
```

**This is WRONG for line charts**: `position: 'top'` is appropriate for heatmaps (data at bottom, tooltip above). But when this configuration leaked to line charts, tooltips always appear above the cursor, blocking the data lines.

**Cross-contamination**: Design tokens meant for heatmaps were applied to ALL chart types.

---

## What We Changed (and Why It Broke)

| Setting | Before | After | Impact |
|---------|--------|-------|--------|
| `max-width` | `width: auto` | `400px` | Tooltips 2-3x larger than needed |
| `z-index` | default (~1) | `10000` | Tooltip floats above controls |
| `position` | Smart function | None/`'top'` | Can't avoid data points |
| `confine` | false/undefined | `true` | Can't position outside chart |
| `enterable` | false/undefined | `true` | Tooltip persists |
| `hideDelay` | 0/default | `200` | Tooltip lingers |

**Net effect**: Tooltips are too large, stay too long, can't move intelligently, and float above everything.

---

## Specific Regression Identified

### Commit d3fc67e: "Fix chart time formatting and tooltip auto-sizing"

This commit appears to be when the tooltip configuration changed. The commit message says "tooltip auto-sizing" but actually REMOVED auto-sizing!

**Irony**: The "fix" for tooltip sizing made tooltip sizing worse.

---

## Recommended Fix Strategy

### Option 1: Rollback (Safest)

Revert tooltip configuration in `chartDesignTokens.ts` to match `useBaseChartOptions.ts` working state:

```typescript
// chartDesignTokens.ts - REVERT TO:
tooltip: {
  base: {
    trigger: 'axis' as const,
    borderWidth: 1,
    padding: SPACING.sm,
    textStyle: {
      fontSize: TYPOGRAPHY.caption.fontSize,
    },
    axisPointer: {
      type: 'cross' as const,
      animation: false,
      lineStyle: {
        type: 'dashed' as const,
      },
    },
    // RESTORE smart positioning
    position: function (point: any, params: any, dom: any, size: any) {
      const tooltipWidth = size.contentSize[0];
      const tooltipHeight = size.contentSize[1];
      const viewWidth = size.viewSize[0];
      const viewHeight = size.viewSize[1];

      let x = point[0] + 20;
      let y = point[1] - tooltipHeight / 2;

      if (x + tooltipWidth > viewWidth - 10) {
        x = point[0] - tooltipWidth - 20;
      }

      if (y < 10) {
        y = 10;
      } else if (y + tooltipHeight > viewHeight - 10) {
        y = viewHeight - tooltipHeight - 10;
      }

      return [x, y];
    },
    // RESTORE auto-width
    extraCssText: 'max-height: 400px; overflow-y: auto; min-width: 150px; width: auto;',
  },
}
```

### Option 2: Surgical Fix (Moderate Risk)

Keep design tokens approach but fix the specific problems:

```typescript
tooltip: {
  base: {
    trigger: 'axis' as const,
    confine: false, // ✅ FIX #1: Allow positioning outside chart
    enterable: false, // ✅ FIX #2: Don't make tooltip sticky
    hideDelay: 0, // ✅ FIX #3: Hide immediately
    borderWidth: 1,
    padding: SPACING.sm,
    textStyle: {
      fontSize: TYPOGRAPHY.caption.fontSize,
    },
    axisPointer: {
      type: 'cross' as const,
      animation: false,
      lineStyle: {
        type: 'dashed' as const,
      },
    },
    // ✅ FIX #4: Sensible width constraint
    extraCssText: 'max-height: 400px; overflow-y: auto; min-width: 150px; max-width: 250px; width: auto;',
    // ✅ FIX #5: Add smart positioning function
    position: function (point: any, params: any, dom: any, size: any) {
      // ... smart positioning logic ...
    },
  },
}
```

### Option 3: Chart-Type-Specific (Best Long-term)

Create separate tooltip configs for different chart types:

```typescript
tooltip: {
  // Line charts - smart positioning, auto-width
  timeSeries: { ... },

  // Heatmaps - top positioning OK
  heatmap: {
    position: 'top' as const,
    confine: true,
  },

  // Bar charts - different needs
  bar: { ... },
}
```

---

## Testing Criteria

To verify fix works:

1. **Width test**: Tooltip should be 150-250px wide, NOT 400px
2. **Positioning test**: Tooltip should move to side when near edge, NOT cover data
3. **Z-index test**: Chart controls should remain clickable when tooltip visible
4. **Persistence test**: Tooltip should disappear immediately when mouse moves away
5. **Confinement test**: Tooltip should be able to position OUTSIDE chart bounds when needed

---

## Files Requiring Changes

Primary file:
- `src/utils/chartDesignTokens.ts` (lines 259-288)

Secondary files to verify:
- `src/hooks/useBaseChartOptions.ts` (verify it uses design tokens correctly)
- `src/components/charts/EChartsDeviceDeviationHeatmap.tsx` (heatmap-specific positioning)
- `src/components/charts/EChartsTimeSeriesChart.tsx` (verify tooltip usage)

---

## Conclusion

**Root cause**: Well-intentioned "standardization" that:
1. Replaced working smart positioning with fixed settings
2. Increased max-width from auto to 400px
3. Added excessive z-index
4. Made tooltip sticky with enterable + hideDelay
5. Applied heatmap-specific settings to all charts

**Recommendation**: **Option 1 (Rollback)** - Safest to restore working configuration from `useBaseChartOptions.ts` while we develop a proper chart-type-specific solution.

**Prevention**: Before applying "fixes", test with actual user workflows. A tooltip covering the chart is worse than a slightly mispositioned tooltip.
