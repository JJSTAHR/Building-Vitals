# Axis Label Fix - Code Snippets

**Implementation Guide for Axis Label Visibility Fixes**

---

## 1. Core Infrastructure (chartDesignTokens.ts)

### Add to `src/utils/chartDesignTokens.ts`:

```typescript
// Add these exports to chartDesignTokens.ts

/**
 * Standardized axis label configurations by axis type
 */
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
    hideOverlap: true, // Prevent time label crowding
  },

  value: {
    overflow: 'truncate' as const,
    width: 80,
    fontSize: 11,
    // No rotation needed for value axes
  },
} as const;

/**
 * Grid margin presets for different chart configurations
 */
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
    bottom: 80, // Extra space for rotated X-axis labels
  },

  longYAxisLabels: {
    left: '20%', // Extra space for long Y-axis labels
    right: '10%',
    top: 60,
    bottom: 60,
  },

  dualYAxes: {
    left: '15%', // Space for left Y-axis
    right: '15%', // Space for right Y-axis
    top: 60,
    bottom: 60,
  },

  heatmap: {
    left: '15%',
    right: '12%',
    top: 100,
    bottom: 80, // Extra space for category labels
  },
} as const;

/**
 * Generate axis label configuration with smart defaults
 * @param axisType - Type of axis (category, time, value)
 * @param options - Customization options
 * @returns Complete axisLabel configuration object
 */
export function getAxisLabelConfig(
  axisType: 'category' | 'time' | 'value',
  options: {
    dataLength?: number;
    maxLabelLength?: number;
    rotate?: number;
    theme?: 'light' | 'dark';
    forceRotation?: boolean;
  } = {}
) {
  const {
    dataLength = 0,
    maxLabelLength = 0,
    theme = 'light',
    forceRotation = false,
  } = options;

  const baseConfig = { ...AXIS_LABEL_DEFAULTS[axisType] };

  // Auto-adjust rotation based on data density
  let rotate = baseConfig.rotate || 0;

  if (axisType === 'category') {
    if (forceRotation) {
      rotate = 45;
    } else if (dataLength > 10) {
      rotate = 45;
    } else if (maxLabelLength > 15) {
      rotate = 30;
    } else {
      rotate = 0; // No rotation for short labels
    }
  }

  // Auto-adjust width based on max label length
  let width = baseConfig.width;
  if (axisType === 'category' && maxLabelLength > 0) {
    width = Math.min(maxLabelLength * 7, 150); // Approximate char width
  }

  // Theme-specific colors
  const color =
    theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)';

  return {
    ...baseConfig,
    rotate: options.rotate !== undefined ? options.rotate : rotate,
    width,
    color,
  };
}

/**
 * Truncate axis name/title if too long
 * @param name - Axis name
 * @param maxLength - Maximum characters before truncation
 * @returns Truncated name with ellipsis if needed
 */
export function truncateAxisName(name: string, maxLength: number = 30): string {
  if (!name || name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

/**
 * Calculate optimal grid margins based on chart configuration
 * @param config - Chart configuration
 * @returns Grid margin object
 */
export function getOptimalGridMargins(config: {
  hasRotatedXAxis?: boolean;
  hasLongYAxisLabels?: boolean;
  hasDualYAxes?: boolean;
  isHeatmap?: boolean;
}): typeof GRID_MARGINS.standard {
  const {
    hasRotatedXAxis = false,
    hasLongYAxisLabels = false,
    hasDualYAxes = false,
    isHeatmap = false,
  } = config;

  // Priority: Most specific to least specific
  if (isHeatmap) return GRID_MARGINS.heatmap;
  if (hasDualYAxes) return GRID_MARGINS.dualYAxes;
  if (hasLongYAxisLabels) return GRID_MARGINS.longYAxisLabels;
  if (hasRotatedXAxis) return GRID_MARGINS.rotatedXAxis;

  return GRID_MARGINS.standard;
}
```

---

## 2. Fix EChartsTimeSeriesChart.tsx

### Location: Lines 1020-1160 (X-axis and Y-axis configuration)

```typescript
// Replace existing xAxis configuration (around line 1035)
xAxis: {
  type: 'time',
  axisLabel: {
    ...getAxisLabelConfig('time', {
      theme: theme.palette.mode,
      dataLength: processedData[0]?.data.length,
    }),
    formatter: (value: number) => formatAxisTime(value, granularity),
  },
  axisPointer: {
    label: {
      formatter: (params: any) => formatTooltipTime(params.value),
    },
  },
  splitNumber: 5,
  minInterval: 60000,
}

// Replace existing yAxis configuration (around line 1150)
yAxis: (() => {
  const uniqueUnits = [...new Set(processedData.map(s => s.unit).filter(Boolean))];
  const yAxisName = uniqueUnits.length === 1 ? uniqueUnits[0] :
                    uniqueUnits.length > 1 ? 'Multiple Units' : 'Value';

  // Check if we need dual Y-axes
  if (needsDualYAxes) {
    // ... existing dual Y-axis logic ...
    return [
      {
        type: 'value',
        name: truncateAxisName(leftAxisName, 30),
        position: 'left',
        axisLabel: {
          ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
          formatter: (value: number) => formatNumberForDisplay(value, 2),
        },
      },
      {
        type: 'value',
        name: truncateAxisName(rightAxisName, 30),
        position: 'right',
        axisLabel: {
          ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
          formatter: (value: number) => formatNumberForDisplay(value, 2),
        },
      }
    ];
  }

  // Single Y-axis
  return {
    type: 'value',
    name: truncateAxisName(yAxisName, 30),
    nameLocation: 'middle',
    nameGap: 50,
    axisLabel: {
      ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
      formatter: (value: number) => formatNumberForDisplay(value, 2),
    },
    splitLine: {
      show: true,
      lineStyle: { type: 'dashed', opacity: 0.3 },
    },
    splitNumber: 5,
  };
})()

// Replace grid configuration (around line 1016)
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  ...getOptimalGridMargins({
    hasRotatedXAxis: true,
    hasDualYAxes: needsDualYAxes,
    hasLongYAxisLabels: processedData.some(s => s.name.length > 20),
  }),
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: true,
  }),
}
```

---

## 3. Fix EChartsAreaChart.tsx

### Location: Lines 509-690 (Grid and axis configuration)

```typescript
// Replace grid configuration (around line 509)
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  ...getOptimalGridMargins({
    hasRotatedXAxis: true,
    hasDualYAxes: needsDualAxis,
  }),
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: true,
  }),
}

// Replace xAxis configuration (around line 568)
xAxis: {
  ...getTimeAxisConfig({ showAxisName: false }),
  axisLabel: {
    ...getAxisLabelConfig('time', {
      theme: theme.palette.mode,
      dataLength: safeData[0]?.data.length,
    }),
    formatter: (value: number) => formatAxisTime(value, granularity),
  },
  splitNumber: 5,
  minInterval: 60000,
}

// Replace yAxis configuration (around line 588)
yAxis: (() => {
  // ... existing dual Y-axis detection logic ...

  // Single Y-axis fallback
  const yAxisName = uniqueUnits.length === 1 ? uniqueUnits[0] :
                    uniqueUnits.length > 1 ? 'Multiple Units' : 'Value';

  return {
    type: 'value',
    name: truncateAxisName(yAxisName, 30),
    nameLocation: 'middle',
    nameGap: 50,
    axisLabel: {
      ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
      formatter: (value: number) => formatNumberForDisplay(value, 2),
    },
    splitLine: {
      show: true,
      lineStyle: { type: 'dashed', opacity: 0.3 },
    },
    splitNumber: 5,
  };
})()
```

---

## 4. Fix EChartsBarChart.tsx

### Location: Lines 456-521 (Axis configuration)

```typescript
// Replace xAxis configuration (around line 472)
xAxis: isHorizontal
  ? {
      type: 'value' as const,
      scale: true,
      axisLabel: {
        ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
        formatter: (value: number) => formatNumberForDisplay(value, 1),
      },
    }
  : {
      type: 'category' as const,
      data: categories,
      axisLabel: {
        ...getAxisLabelConfig('category', {
          dataLength: categories.length,
          theme: theme.palette.mode,
          forceRotation: categories.length > 10,
        }),
        interval: 0,
        // Remove manual formatter - let overflow handle truncation
      },
    }

// Replace yAxis configuration (around line 498)
yAxis: isHorizontal
  ? {
      type: 'category' as const,
      data: categories,
      axisLabel: {
        ...getAxisLabelConfig('category', {
          theme: theme.palette.mode,
        }),
        // Override width for horizontal bars (more space available)
        width: 150,
        rotate: 0, // No rotation for horizontal bar Y-axis
      },
    }
  : {
      type: 'value' as const,
      scale: true,
      axisLabel: {
        ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
        formatter: (value: number) => formatNumberForDisplay(value, 1),
      },
    }

// Update grid configuration (around line 456)
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  containLabel: true,
  ...getOptimalGridMargins({
    hasRotatedXAxis: !isHorizontal && categories.length > 10,
    hasLongYAxisLabels: isHorizontal && categories.some(c => c.length > 20),
  }),
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: enableToolbox,
  }),
}
```

---

## 5. Fix EChartsScatterPlot.tsx

### Location: Lines 505-527 (Axis configuration)

```typescript
// Replace xAxis configuration (around line 505)
xAxis: {
  type: 'value',
  name: truncateAxisName(
    effectiveXAxisLabel + (xUnit ? ` (${xUnit})` : ''),
    30
  ),
  nameLocation: 'middle',
  nameGap: 35,
  scale: true,
  axisLabel: {
    ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
    formatter: (value: number) => formatNumberForDisplay(value, 1),
  },
}

// Replace yAxis configuration (around line 515)
yAxis: {
  type: 'value',
  name: truncateAxisName(
    effectiveYAxisLabel + (yUnit ? ` (${yUnit})` : ''),
    30
  ),
  nameLocation: 'middle',
  nameGap: 55,
  scale: true,
  min: (value: any) => value.min - Math.abs(value.min * 0.1),
  max: (value: any) => value.max + Math.abs(value.max * 0.1),
  axisLabel: {
    ...getAxisLabelConfig('value', { theme: theme.palette.mode }),
    formatter: (value: number) => formatNumberForDisplay(value, 1),
  },
}

// Update grid configuration
grid: {
  ...CHART_DESIGN_TOKENS.grid.base,
  ...GRID_MARGINS.standard,
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: true,
  }),
}
```

---

## 6. Fix EChartsHeatmap.tsx

### Location: Lines 665-686 (Axis configuration)

```typescript
// Replace xAxis configuration (around line 665)
const xAxisOptions = {
  type: 'category',
  data: xCats,
  axisLabel: {
    ...getAxisLabelConfig('category', {
      dataLength: xCats.length,
      theme: theme.palette.mode,
    }),
    color: theme.palette.text.secondary,
  },
  splitLine: {
    show: true,
  },
};

// Replace yAxis configuration (around line 677)
const yAxisOptions = {
  type: 'category',
  data: yCats,
  axisLabel: {
    ...getAxisLabelConfig('category', {
      theme: theme.palette.mode,
    }),
    width: 120, // Override for Y-axis (more space available)
    rotate: 0,  // No rotation for Y-axis categories
    color: theme.palette.text.secondary,
  },
  splitLine: {
    show: true,
  },
};

// Update grid configuration (around line 654)
const gridOptions = {
  ...CHART_DESIGN_TOKENS.grid.base,
  ...GRID_MARGINS.heatmap,
  height: '70%',
  top: calculateGridTop({
    hasTitle: !!title,
    hasToolbox: true,
  }),
};
```

---

## 7. Fix EChartsDeviceDeviationHeatmap.tsx

### Location: Lines 822-872 (Axis configuration)

```typescript
// Replace xAxis configuration (around line 828)
xAxis: {
  type: 'category',
  data: chartData.xAxis,
  axisLabel: {
    ...getAxisLabelConfig('category', {
      dataLength: chartData.xAxis.length,
      theme: theme.palette.mode,
    }),
    fontSize: 11,
    // Remove manual formatter - let overflow handle it
  },
  name: 'Time',
  nameLocation: 'middle',
  nameGap: 50,
}

// Replace yAxis configuration (around line 848)
yAxis: {
  type: 'category',
  data: chartData.yAxis,
  axisLabel: {
    ...getAxisLabelConfig('category', {
      theme: theme.palette.mode,
    }),
    width: 140, // Extra width for device names
    rotate: 0,  // No rotation for Y-axis
    fontSize: 11,
    // Remove manual formatter
  },
  name: 'Devices',
  nameLocation: 'middle',
  nameGap: 90,
}

// Grid configuration (already good, keep as is)
grid: {
  height: '70%',
  top: calculateGridTop(...),
  right: '12%',
  left: '12%',
}
```

---

## 8. Import Statements

### Add to each modified chart file:

```typescript
// At the top of the file, update the imports from chartDesignTokens
import {
  CHART_DESIGN_TOKENS,
  calculateGridTop,
  calculateGridBottom,
  getAxisLabelConfig,
  truncateAxisName,
  getOptimalGridMargins,
  GRID_MARGINS,
} from '@/utils/chartDesignTokens';
```

---

## 9. Testing Code Snippet

### Add to test files:

```typescript
describe('Axis Label Configuration', () => {
  it('should apply proper rotation for long labels', () => {
    const config = getAxisLabelConfig('category', {
      dataLength: 15,
      theme: 'light',
    });

    expect(config.rotate).toBe(45);
    expect(config.overflow).toBe('truncate');
    expect(config.align).toBe('right');
  });

  it('should not rotate for short labels', () => {
    const config = getAxisLabelConfig('category', {
      dataLength: 5,
      theme: 'light',
    });

    expect(config.rotate).toBe(0);
  });

  it('should truncate axis names properly', () => {
    const longName = 'Very Long Axis Name That Should Be Truncated';
    const result = truncateAxisName(longName, 20);

    expect(result.length).toBe(20);
    expect(result).toContain('…');
  });

  it('should calculate optimal grid margins', () => {
    const margins = getOptimalGridMargins({
      hasDualYAxes: true,
    });

    expect(margins.left).toBe('15%');
    expect(margins.right).toBe('15%');
  });
});
```

---

## 10. Visual Regression Test Cases

### Test with these sample data sets:

```typescript
// Short labels
const shortLabels = [
  'Zone 1',
  'Zone 2',
  'Zone 3',
];

// Medium labels
const mediumLabels = [
  'Building A Zone 1',
  'Building A Zone 2',
  'Building B Zone 1',
];

// Long labels (typical point names)
const longLabels = [
  'Building/Floor 2/Zone A/AHU-1/Supply Air Temp',
  'Building/Floor 2/Zone A/AHU-1/Return Air Temp',
  'Building/Floor 2/Zone A/VAV-102/Discharge Air Temp',
];

// Very long labels (edge case)
const veryLongLabels = [
  'Campus West/Building Main/Floor 2/Zone A/AHU-1/Supply Air Temperature Sensor',
  'Campus West/Building Main/Floor 2/Zone B/AHU-2/Return Air Temperature Sensor',
];

// Test with different data densities
const densityTests = [
  { count: 5, labels: shortLabels },
  { count: 15, labels: mediumLabels },
  { count: 30, labels: longLabels },
  { count: 50, labels: veryLongLabels },
];
```

---

## Summary of Changes

### Files Modified:
1. ✅ `src/utils/chartDesignTokens.ts` - Add axis defaults and utilities
2. ✅ `src/components/charts/EChartsTimeSeriesChart.tsx` - Apply fixes
3. ✅ `src/components/charts/EChartsAreaChart.tsx` - Apply fixes
4. ✅ `src/components/charts/EChartsBarChart.tsx` - Apply fixes
5. ✅ `src/components/charts/EChartsScatterPlot.tsx` - Apply fixes
6. ✅ `src/components/charts/EChartsHeatmap.tsx` - Apply fixes
7. ✅ `src/components/charts/EChartsDeviceDeviationHeatmap.tsx` - Apply fixes

### Key Changes:
- ✅ Added `getAxisLabelConfig()` utility function
- ✅ Added `truncateAxisName()` helper
- ✅ Added `getOptimalGridMargins()` calculator
- ✅ Replaced manual truncation with ECharts `overflow: 'truncate'`
- ✅ Standardized rotation settings across all charts
- ✅ Increased grid margins where needed
- ✅ Applied consistent label widths

---

**Implementation Date:** 2025-10-16
**Ready for Code Review:** Yes
