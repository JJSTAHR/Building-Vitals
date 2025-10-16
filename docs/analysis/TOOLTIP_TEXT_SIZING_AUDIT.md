# Tooltip Text Sizing Audit Report

**Date**: 2025-10-16
**Issue**: Tooltips don't properly fit long point names or lots of text
**Requested By**: User
**Status**: Analysis Complete

---

## Executive Summary

The tooltip sizing system uses a consistent but potentially restrictive configuration across all charts. The primary constraint is `max-width: min(350px, 85vw)` which may be too narrow for long point names (100+ characters) or multiple series with detailed information. Text wrapping is configured correctly with `word-wrap: break-word`, but the width constraint can create cramped tooltips.

### Key Findings

1. **Global max-width is 350px** - This is consistent but may be too restrictive for long content
2. **Text wrapping IS enabled** - `word-wrap: break-word` is correctly configured
3. **No white-space: nowrap issues** - Text is allowed to wrap properly
4. **Heatmap uses slightly wider tooltips** - 400px vs 350px for better detail display
5. **Tooltip HTML structure is clean** - No flex/grid layouts blocking expansion
6. **Scrolling is enabled** - `overflow-y: auto` with `max-height: 60vh`

---

## Detailed Analysis

### 1. Global Tooltip Configuration (chartDesignTokens.ts)

**Location**: `src/utils/chartDesignTokens.ts:280`

```typescript
extraCssText: 'max-width: min(350px, 85vw) !important; max-height: 60vh !important; overflow-y: auto; word-wrap: break-word; pointer-events: auto; z-index: 1500; box-sizing: border-box;'
```

**Analysis**:
- ✅ **Word wrapping enabled**: `word-wrap: break-word` allows long text to wrap
- ✅ **Vertical scrolling**: `overflow-y: auto` handles overflow content
- ✅ **Responsive width**: `85vw` prevents tooltips from exceeding viewport
- ⚠️ **Max-width constraint**: `min(350px, 85vw)` caps width at 350px on desktop
- ✅ **Box-sizing**: `box-sizing: border-box` includes padding in width calculation
- ✅ **No nowrap**: No CSS preventing text from wrapping

**Potential Issue**: 350px may be too narrow for:
- Point names >80 characters
- Multiple series with long names
- Detailed tooltip content with units and metadata

### 2. EChartsTimeSeriesChart Tooltip (Lines 966-1002)

**Location**: `src/components/charts/EChartsTimeSeriesChart.tsx:966-1002`

```typescript
const tooltipOptions = buildTooltip({
  trigger: 'axis',
  formatter: (params: any) => {
    if (!Array.isArray(params) || params.length === 0) return '';

    const timestamp = params[0]?.value?.[0];
    let html = `<div style="padding: 8px;">
      <div style="font-weight: bold; margin-bottom: 8px;">
        ${formatTooltipTime(timestamp)}
      </div>`;

    params.forEach((param: any) => {
      const value = param.value?.[1];
      if (value !== undefined) {
        const seriesIndex = param.seriesIndex;
        const originalData = processedData[seriesIndex];

        // Format tooltip with marker tags if available
        const pointName = showMarkerTags && originalData?.markerTags
          ? formatPointWithTags({
              name: param.seriesName,
              markerTags: originalData.markerTags,
              unit: originalData.unit,
            }, { maxTags: 2, includeUnit: false })
          : param.seriesName;

        html += `
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <div style="width: 12px; height: 12px; background: ${param.color}; border-radius: 2px;"></div>
            <span>${pointName}:</span>
            <strong>${value.toFixed(2)}${originalData?.unit ? ' ' + originalData.unit : ''}</strong>
          </div>`;
      }
    });

    html += '</div>';
    return html;
  },
  ...CHART_DESIGN_TOKENS.tooltip.base,
  // ... theme colors
});
```

**HTML Structure Analysis**:
- ✅ **Outer div**: `padding: 8px` - provides spacing
- ✅ **Timestamp div**: `font-weight: bold; margin-bottom: 8px` - no width constraint
- ✅ **Data rows**: `display: flex; align-items: center; gap: 8px` - **FLEX LAYOUT**
- ⚠️ **Flex on long names**: Flexbox with `gap: 8px` may not wrap long point names
- ❌ **No flex-wrap**: Missing `flex-wrap: wrap` on data rows
- ❌ **No max-width on span**: Long point names in `<span>${pointName}:</span>` may overflow

**Identified Issues**:
1. Flexbox layout without `flex-wrap: wrap` prevents wrapping
2. Long point names in flex items may overflow or get squished
3. No ellipsis or truncation for extremely long names
4. The 350px max-width combined with flex layout may cause cramping

### 3. EChartsAreaChart Tooltip (Lines 520-548)

**Location**: `src/components/charts/EChartsAreaChart.tsx:520-548`

```typescript
tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'axis',
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
  axisPointer: {
    type: useSimpleRendering ? 'line' : 'cross',
    animation: false,
    label: {
      backgroundColor: '#6a7985',
      precision: 0,
    },
  },
  confine: true,
  extraCssText: 'z-index: 999',
  transitionDuration: 0,
  alwaysShowContent: false,
  hideDelay: 100,
  enterable: false,
},
```

**Analysis**:
- ✅ **Uses global base config**: Inherits `CHART_DESIGN_TOKENS.tooltip.base`
- ⚠️ **Overrides extraCssText**: Only sets `z-index: 999`, losing max-width/word-wrap!
- ❌ **CRITICAL BUG**: AreaChart loses tooltip sizing CSS by overriding `extraCssText`
- ✅ **Proper theme colors**: Theme-aware background and border colors

**Identified Issue**:
- **AreaChart has BROKEN tooltip sizing** due to `extraCssText` override

### 4. EChartsDeviceDeviationHeatmap Tooltip (Lines 646-821)

**Location**: `src/components/charts/EChartsDeviceDeviationHeatmap.tsx:646-821`

```typescript
const tooltipFormatter = useCallback((params: any) => {
  if (!params || !params.data) return '';

  const [xIndex, yIndex, deviationValue] = params.value || [];
  const timestamp = chartData.xAxis[xIndex];
  const device = chartData.yAxis[yIndex];

  // Find the aggregated cell
  const cell = aggregatedData.find(/*...*/);

  // Find device config for target values
  const config = deviceConfigs.find(c => c.deviceName === device);

  if (!cell) {
    return `
      <div style="padding: 8px;">
        <strong>${device}</strong><br/>
        ${timestamp}<br/>
        Deviation: ${(deviationValue * 100).toFixed(1)}%
      </div>
    `;
  }

  // ... lots of detailed content ...

  return `
    <div style="padding: 10px; font-size: 12px; line-height: 1.5;">
      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">
        ${statusEmoji} ${device}
      </div>
      <div style="color: #888; font-size: 11px; margin-bottom: 8px;">
        ${formatTooltipTime(timestamp)}
      </div>
      <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px;">
        ${actualValueStr}
        <div style="margin-top: 4px;">
          <strong>Status:</strong> ...
          <strong>Deviation:</strong> ...
        </div>
        ${sustainedDeviation ? '...' : ''}
        ${anomalyCount > 0 ? '...' : ''}
      </div>
      <div style="color: ...; font-size: 10px; margin-top: 6px; padding-top: 6px; border-top: 1px solid ...">
        <strong>Aggregation:</strong> ${cell.diagnostics.count} readings<br/>
        <strong>Range:</strong> ${cell.diagnostics.min.toFixed(1)}% to ${cell.diagnostics.max.toFixed(1)}%
      </div>
    </div>
  `;
}, [aggregatedData, chartData, deviceConfigs, heatmapCells, series, theme]);

// ...

tooltip: {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  trigger: 'item',
  formatter: tooltipFormatter,
  // ...
  // Override global extraCssText with heatmap-specific sizing
  extraCssText: 'z-index: 1500; pointer-events: auto; max-width: min(400px, 85vw) !important; max-height: 60vh !important; overflow-y: auto; word-wrap: break-word; box-sizing: border-box;',
}
```

**Analysis**:
- ✅ **Wider max-width**: 400px vs 350px (14% wider)
- ✅ **Clean HTML structure**: No flex layouts causing issues
- ✅ **Proper word wrapping**: `word-wrap: break-word` preserved
- ✅ **Detailed content**: Multiple sections with diagnostics
- ⚠️ **Long device names**: Device names like `site/AHU-01/Zone-A/Temperature/Sensor` may still overflow
- ✅ **Scrolling works**: `overflow-y: auto` handles tall content

**Observation**:
- Heatmap recognizes need for wider tooltips (+50px)
- Still may be insufficient for 100+ character names

---

## Specific Test Cases

### Test Case 1: 100-Character Point Name
**Point Name**: `Building_A_Floor_3_HVAC_AHU_02_Supply_Air_Temperature_Sensor_Zone_Northwest_Conference_Room_Setpoint`
**Length**: 109 characters

**Current Behavior**:
- 350px width ≈ 50-60 characters per line (7px/char average)
- Would wrap to 2 lines
- Flex layout in TimeSeriesChart may squish it

**Expected Issues**:
- Flexbox without wrap may cause horizontal cramping
- Tooltip becomes tall and narrow
- Hard to read multi-line names in flex items

### Test Case 2: Multiple Series with Long Names
**Scenario**: 5 series, each with 80-character names

**Current Behavior**:
- Each series takes 2 lines in tooltip
- Total tooltip height: 10+ lines
- Scrolling kicks in at 60vh (≈400-600px height)

**Expected Issues**:
- Vertical scrolling needed
- Individual series rows become cramped
- Flex layout may misalign items

### Test Case 3: Heatmap with Detailed Diagnostics
**Scenario**: Device name + timestamp + value + target + deviation + status + aggregation info

**Current Behavior**:
- 400px width helps
- Clean HTML structure with divs
- No flex layout issues

**Works Better Because**:
- Wider max-width (400px)
- Block layout instead of flex
- Proper use of padding and spacing

---

## Root Causes Identified

### Primary Issues

1. **350px is too restrictive for modern point naming**
   - Location: `chartDesignTokens.ts:280`
   - Impact: All charts except heatmap
   - IoT point names often exceed 80-100 characters
   - Recommendation: Increase to 500px or use dynamic sizing

2. **Flex layout without flex-wrap in TimeSeriesChart**
   - Location: `EChartsTimeSeriesChart.tsx:993-999`
   - Impact: Long names don't wrap properly in flex containers
   - Missing: `flex-wrap: wrap` or `flex-direction: column`
   - Recommendation: Add `flex-wrap: wrap` to data row divs

3. **AreaChart BROKEN tooltip CSS**
   - Location: `EChartsAreaChart.tsx:542`
   - Impact: Loses all sizing CSS from design tokens
   - Bug: Overrides `extraCssText` with only `z-index: 999`
   - Recommendation: Concatenate with base CSS instead of overriding

### Secondary Issues

4. **No max-width on inner elements**
   - Long point names in `<span>` tags have no width constraint
   - Can overflow parent or cause unexpected wrapping
   - Recommendation: Add `max-width: 100%` to span elements

5. **No ellipsis for extreme cases**
   - No fallback for 200+ character names
   - Could benefit from optional truncation
   - Recommendation: Add `text-overflow: ellipsis` option

6. **Font size may be too large**
   - 12px font with padding reduces effective text area
   - Could reduce to 11px for more content per line
   - Recommendation: Test with 11px font size

---

## CSS Property Analysis

### Current CSS (chartDesignTokens.ts:280)
```css
max-width: min(350px, 85vw) !important;
max-height: 60vh !important;
overflow-y: auto;
word-wrap: break-word;
pointer-events: auto;
z-index: 1500;
box-sizing: border-box;
```

### Property-by-Property Review

| Property | Current Value | Status | Notes |
|----------|--------------|--------|-------|
| `max-width` | `min(350px, 85vw)` | ⚠️ Too narrow | Should be 500px+ for long names |
| `max-height` | `60vh` | ✅ Good | Allows scrolling on tall tooltips |
| `overflow-y` | `auto` | ✅ Good | Enables scrolling when needed |
| `word-wrap` | `break-word` | ✅ Good | Allows wrapping of long words |
| `white-space` | (not set) | ✅ Good | Defaults to `normal`, allows wrapping |
| `overflow-x` | (not set) | ⚠️ Missing | Should add `hidden` to prevent horizontal scroll |
| `text-overflow` | (not set) | ℹ️ Optional | Could add `ellipsis` for extreme cases |
| `line-height` | (uses default) | ℹ️ OK | Could explicitly set to 1.4 |
| `padding` | `8px` (from formatter) | ℹ️ OK | Reduces effective width by 16px |

---

## Recommendations

### High Priority (Fix Immediately)

1. **Fix AreaChart broken tooltip CSS** (CRITICAL)
   ```typescript
   // EChartsAreaChart.tsx:542
   // WRONG:
   extraCssText: 'z-index: 999',

   // RIGHT:
   extraCssText: CHART_DESIGN_TOKENS.tooltip.base.extraCssText + ' z-index: 999;',
   ```

2. **Increase global max-width to 500px**
   ```typescript
   // chartDesignTokens.ts:280
   extraCssText: 'max-width: min(500px, 85vw) !important; ...'
   ```

3. **Add flex-wrap to TimeSeriesChart tooltip**
   ```typescript
   // EChartsTimeSeriesChart.tsx:993
   <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px;">
   ```

### Medium Priority (Improve UX)

4. **Add overflow-x: hidden to prevent horizontal scrollbar**
   ```typescript
   extraCssText: '... overflow-x: hidden; overflow-y: auto; ...'
   ```

5. **Add max-width to span elements in tooltips**
   ```typescript
   <span style="max-width: 100%; word-wrap: break-word;">${pointName}:</span>
   ```

6. **Reduce font size for dense tooltips**
   ```typescript
   // For tooltips with >3 series
   textStyle: {
     fontSize: seriesCount > 3 ? 11 : 12,
   }
   ```

### Low Priority (Nice to Have)

7. **Add optional text truncation for extreme cases**
   ```typescript
   const truncateLongNames = (name: string, maxLength: number = 100) => {
     if (name.length <= maxLength) return name;
     return name.substring(0, maxLength - 3) + '...';
   };
   ```

8. **Make tooltip width adaptive based on content**
   ```typescript
   // Wider for heatmaps (400px), narrower for simple charts (350px)
   const tooltipMaxWidth = chartType === 'heatmap' ? 400 : seriesCount > 5 ? 450 : 350;
   ```

9. **Add title attribute for full names on hover**
   ```typescript
   <span title="${fullPointName}">${truncatedPointName}:</span>
   ```

---

## Affected Chart Components

| Chart Component | Tooltip Config | Issues | Priority |
|----------------|----------------|--------|----------|
| **EChartsTimeSeriesChart** | Uses base + flex layout | Flex without wrap, 350px too narrow | HIGH |
| **EChartsAreaChart** | Overrides CSS (BROKEN) | Loses all sizing CSS | CRITICAL |
| **EChartsDeviceDeviationHeatmap** | Custom 400px width | Works better, still could be wider | MEDIUM |
| **EChartsBarChart** (not reviewed) | Likely uses base | Probably has 350px limit | MEDIUM |
| **EChartsScatterChart** (not reviewed) | Likely uses base | Probably has 350px limit | LOW |
| **CalendarHeatmap** (not reviewed) | Likely uses base | Probably has 350px limit | LOW |

---

## Testing Checklist

After implementing fixes, test with:

- [ ] Point name: 50 characters (should fit easily)
- [ ] Point name: 100 characters (should wrap nicely)
- [ ] Point name: 150 characters (should wrap or truncate)
- [ ] 5 series with 80-character names (should scroll vertically)
- [ ] Mobile viewport (85vw should limit width)
- [ ] Dark mode (ensure text is readable)
- [ ] Heatmap with detailed diagnostics (ensure 400px+ width)
- [ ] AreaChart (verify CSS fix restored sizing)
- [ ] TimeSeriesChart with flex layout (verify wrapping works)

---

## Conclusion

The tooltip sizing issue stems from three main problems:

1. **350px max-width is too restrictive** for modern IoT point naming conventions (80-100+ characters common)
2. **Flex layout without flex-wrap** in TimeSeriesChart prevents proper wrapping of long names
3. **AreaChart completely breaks tooltip sizing** by overriding extraCssText incorrectly

The fixes are straightforward:
- Increase max-width to 500px globally
- Add flex-wrap to flex containers
- Fix AreaChart CSS concatenation
- Add overflow-x: hidden to prevent horizontal scrollbars

These changes will allow tooltips to properly display long point names while maintaining responsive behavior and proper text wrapping.

---

## Files Requiring Changes

1. `src/utils/chartDesignTokens.ts` - Line 280 (increase max-width)
2. `src/components/charts/EChartsTimeSeriesChart.tsx` - Line 993 (add flex-wrap)
3. `src/components/charts/EChartsAreaChart.tsx` - Line 542 (fix CSS override)
4. (Optional) All chart components - Review tooltip formatters for similar issues

---

**Analysis Complete** | **Status**: Ready for Implementation
**Next Steps**: User to review findings and approve fixes
