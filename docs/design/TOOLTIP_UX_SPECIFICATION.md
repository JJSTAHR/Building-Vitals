# Tooltip UX Specification
**Building Vitals - Unified Chart System**

Version: 1.0.0
Date: 2025-10-16
Status: Design Specification

---

## Executive Summary

This document defines the optimal tooltip configuration strategy for the Building Vitals chart system. Tooltips must balance four critical requirements:

1. **Visibility** - Always readable without obstruction
2. **Proximity** - Close to data but not covering it
3. **Consistency** - Predictable behavior across chart types
4. **Interaction** - Hoverable when needed, dismissible when not

---

## 1. Core Design Principles

### 1.1 Spatial Relationship
**Principle**: Tooltips appear NEAR the cursor, not ON the data point.

**Rationale**: Users need to see both the tooltip content AND the underlying data simultaneously to make informed decisions about building operations.

**Distance**: Minimum 10px offset from cursor to prevent cursor occlusion.

### 1.2 Viewport Containment
**Principle**: Tooltips never extend beyond viewport boundaries.

**Rationale**: Content cut off by viewport edges is unusable. Users should never need to scroll to read tooltip content.

**Implementation**: Use `confine: true` with intelligent positioning.

### 1.3 Content-Driven Sizing
**Principle**: Tooltip size adapts to content, with sensible limits.

**Rationale**: Fixed widths either truncate valuable data or waste space. Dynamic sizing provides optimal information density.

**Limits**:
- Min: 150px (prevents cramped single values)
- Max: 400px (prevents excessive width on multi-series)
- Responsive: Adjust max-width based on viewport

### 1.4 Predictable Positioning
**Principle**: Tooltips follow consistent positioning logic across all chart types.

**Rationale**: Users develop muscle memory for tooltip location. Inconsistent positioning increases cognitive load.

**Strategy**: Quadrant-based positioning with fallback cascade.

---

## 2. Recommended Configuration by Chart Type

### 2.1 Line Charts (Time Series)

**Primary Use Case**: Trend analysis across multiple series over time.

**Configuration**:
```typescript
tooltip: {
  trigger: 'axis',
  position: function(point, params, dom, rect, size) {
    const [x, y] = point;
    const [contentWidth, contentHeight] = size.contentSize;
    const [viewWidth, viewHeight] = size.viewSize;

    // Start with right-offset positioning
    let tooltipX = x + 15;
    let tooltipY = y - contentHeight / 2;

    // If would overflow right, shift left of cursor
    if (tooltipX + contentWidth > viewWidth - 10) {
      tooltipX = x - contentWidth - 15;
    }

    // Vertical containment
    tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

    return [tooltipX, tooltipY];
  },
  confine: true,
  hideDelay: 200,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  borderColor: alpha(theme.palette.divider, 0.2),
  borderWidth: 1,
  padding: [12, 16],
  textStyle: {
    fontSize: 12,
    color: theme.palette.text.primary
  },
  extraCssText: `
    max-width: 400px;
    min-width: 150px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 10000;
  `
}
```

**Positioning Logic**:
```
┌─────────────────────────────┐
│ Chart Area                  │
│                             │
│        ●─────────┐          │
│       Point    Tooltip      │
│                   │          │
│        (preferred position)  │
│                             │
│    ┌─────────●              │
│  Tooltip    Point            │
│    │                         │
│  (fallback when near right) │
└─────────────────────────────┘
```

**Rationale**:
- Right-offset prevents covering trend lines
- Vertical centering keeps tooltip near focused data
- Fallback to left prevents viewport overflow
- 15px offset prevents cursor obstruction

---

### 2.2 Heatmaps (2D Grid)

**Primary Use Case**: Deviation analysis and pattern identification across devices and time.

**Configuration**:
```typescript
tooltip: {
  trigger: 'item',
  position: 'top', // Let ECharts auto-position above cell
  confine: true,
  hideDelay: 200,
  enterable: true, // Allow hovering for interaction
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  borderColor: alpha(theme.palette.divider, 0.2),
  borderWidth: 1,
  padding: [12, 16],
  textStyle: {
    fontSize: 12,
    color: theme.palette.text.primary
  },
  extraCssText: `
    max-width: 350px;
    min-width: 200px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 10000;
    pointer-events: auto;
  `
}
```

**Positioning Logic**:
```
Grid Cell Layout:

┌──────────┬──────────┬──────────┐
│          │          │          │
│  Cell    │  Cell    │  Cell    │
│          │          │          │
├──────────┼──────────┼──────────┤
│          │ ┌────────┐          │
│  Cell    │ │Tooltip │  Cell    │
│          │ └────────┘          │
├──────────┼────▲─────┼──────────┤
│          │  Cell    │          │
│  Cell    │ (hovered)│  Cell    │
│          │          │          │
└──────────┴──────────┴──────────┘

Tooltip appears ABOVE hovered cell
Falls back to below if near top edge
```

**Rationale**:
- 'top' position prevents covering adjacent cells
- Cells are discrete - no need for cursor tracking
- `enterable: true` allows interaction with tooltip content
- Smaller max-width (350px) for denser grid layouts
- Higher min-width (200px) for richer cell metadata

**Special Considerations**:
- Heatmaps often have rich tooltips (statistics, deviations, thresholds)
- Users may need to interact with tooltip content (copy values, click actions)
- Position must not obscure surrounding cells for comparison

---

### 2.3 Area Charts (Filled Regions)

**Primary Use Case**: Cumulative trends and zone-based analysis.

**Configuration**:
```typescript
tooltip: {
  trigger: 'axis',
  position: function(point, params, dom, rect, size) {
    const [x, y] = point;
    const [contentWidth, contentHeight] = size.contentSize;
    const [viewWidth, viewHeight] = size.viewSize;

    // Prefer above-right to avoid area fill
    let tooltipX = x + 15;
    let tooltipY = y - contentHeight - 15;

    // Horizontal fallback
    if (tooltipX + contentWidth > viewWidth - 10) {
      tooltipX = x - contentWidth - 15;
    }

    // Vertical fallback (if near top, show below)
    if (tooltipY < 10) {
      tooltipY = y + 15;
    }

    // Final containment check
    tooltipX = Math.max(10, Math.min(tooltipX, viewWidth - contentWidth - 10));
    tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

    return [tooltipX, tooltipY];
  },
  confine: true,
  hideDelay: 200,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  borderColor: alpha(theme.palette.divider, 0.2),
  borderWidth: 1,
  padding: [12, 16],
  textStyle: {
    fontSize: 12,
    color: theme.palette.text.primary
  },
  extraCssText: `
    max-width: 400px;
    min-width: 150px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 10000;
  `
}
```

**Positioning Logic**:
```
Priority Quadrants (numbered by preference):

    1 (above-right)    2 (above-left)
         ┌────────────────────────┐
         │                        │
         │    ▲                   │
         │  Cursor                │
         │                        │
         └────────────────────────┘
    3 (below-right)    4 (below-left)
```

**Rationale**:
- Above positioning avoids obscuring area fill
- Area charts use opacity - tooltip must float above
- Right-offset is primary, but has 4 fallback positions
- More aggressive containment due to area fill importance

---

### 2.4 Bar Charts (Discrete Categories)

**Primary Use Case**: Comparison across discrete categories or devices.

**Configuration**:
```typescript
tooltip: {
  trigger: 'item',
  position: function(point, params, dom, rect, size) {
    const [x, y] = point;
    const [contentWidth, contentHeight] = size.contentSize;
    const [viewWidth, viewHeight] = size.viewSize;

    // Position beside bar (right preferred)
    let tooltipX = x + 20;
    let tooltipY = y - contentHeight / 2;

    // If bar is on right side of chart, show tooltip on left
    if (x > viewWidth * 0.6) {
      tooltipX = x - contentWidth - 20;
    }

    // Vertical centering with containment
    tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

    return [tooltipX, tooltipY];
  },
  confine: true,
  hideDelay: 150, // Shorter for item-based tooltips
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  borderColor: alpha(theme.palette.divider, 0.2),
  borderWidth: 1,
  padding: [10, 14],
  textStyle: {
    fontSize: 12,
    color: theme.palette.text.primary
  },
  extraCssText: `
    max-width: 300px;
    min-width: 150px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 10000;
  `
}
```

**Positioning Logic**:
```
Left Side Bars:          Right Side Bars:

    ┌──────────────┐           ┌──────────────┐
    │ ┌────────┐   │           │   ┌────────┐ │
    │ │  Bar   │┌──┴──┐        │┌──┴──┐Bar   │ │
    │ │        ││Tltp │        ││Tltp ││      │ │
    │ └────────┘└─────┘        │└─────┘└──────┘ │
    └──────────────┘           └──────────────┘
     (tooltip right)            (tooltip left)
```

**Rationale**:
- Side positioning never covers the bar value
- Smaller max-width (300px) for concise bar data
- Shorter hideDelay for discrete hover targets
- Viewport-aware: switches side at 60% threshold

---

## 3. Responsive Design Strategy

### 3.1 Mobile Devices (< 768px)

**Challenges**:
- Limited screen real estate
- Touch targets vs hover
- Vertical orientation reduces width

**Configuration Overrides**:
```typescript
tooltip: {
  position: 'top', // Simple positioning for mobile
  confine: true,
  hideDelay: 300, // Longer delay for touch
  extraCssText: `
    max-width: min(90vw, 320px);
    min-width: 200px;
    font-size: 11px;
  `
}
```

**Rationale**:
- Simple 'top' position reduces complexity
- Max-width relative to viewport (90vw)
- Slightly smaller font for space efficiency
- Longer hideDelay accounts for touch imprecision

### 3.2 Tablet (768px - 1024px)

**Configuration**:
```typescript
tooltip: {
  extraCssText: `
    max-width: 350px;
    min-width: 180px;
  `
}
```

**Rationale**:
- Moderate sizing between mobile and desktop
- Standard positioning logic works well
- Portrait vs landscape handled by confine

### 3.3 Desktop (> 1024px)

**Configuration**:
```typescript
tooltip: {
  extraCssText: `
    max-width: 400px;
    min-width: 150px;
  `
}
```

**Rationale**:
- Full-featured tooltips with maximum information
- Larger max-width for multi-series data
- Custom positioning functions have room to work

### 3.4 Large Displays (> 1920px)

**Configuration**:
```typescript
tooltip: {
  extraCssText: `
    max-width: 480px;
    min-width: 200px;
    font-size: 13px;
  `
}
```

**Rationale**:
- Scale up for better readability at distance
- More horizontal space for dense data
- Slightly larger font compensates for viewing distance

---

## 4. Implementation Code

### 4.1 Unified Tooltip Factory

**File**: `src/utils/tooltipFactory.ts`

```typescript
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export type ChartType = 'line' | 'heatmap' | 'area' | 'bar' | 'scatter';
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'large';

export interface TooltipConfig {
  trigger: 'axis' | 'item' | 'none';
  position: string | Function;
  confine: boolean;
  hideDelay: number;
  enterable?: boolean;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  padding: number[];
  textStyle: {
    fontSize: number;
    color: string;
  };
  extraCssText: string;
}

/**
 * Get device type based on viewport width
 */
export function getDeviceType(width: number): DeviceType {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1920) return 'desktop';
  return 'large';
}

/**
 * Get max-width for tooltip based on device and chart type
 */
function getMaxWidth(deviceType: DeviceType, chartType: ChartType): string {
  const widths = {
    line: { mobile: 'min(90vw, 320px)', tablet: '350px', desktop: '400px', large: '480px' },
    heatmap: { mobile: 'min(90vw, 300px)', tablet: '330px', desktop: '350px', large: '420px' },
    area: { mobile: 'min(90vw, 320px)', tablet: '350px', desktop: '400px', large: '480px' },
    bar: { mobile: 'min(90vw, 280px)', tablet: '300px', desktop: '300px', large: '360px' },
    scatter: { mobile: 'min(90vw, 280px)', tablet: '300px', desktop: '320px', large: '380px' },
  };

  return widths[chartType][deviceType];
}

/**
 * Get min-width for tooltip based on device and chart type
 */
function getMinWidth(deviceType: DeviceType, chartType: ChartType): string {
  if (deviceType === 'mobile') {
    return chartType === 'heatmap' ? '180px' : '150px';
  }

  return chartType === 'heatmap' ? '200px' : '150px';
}

/**
 * Line chart positioning function
 */
function lineChartPosition(point: number[], params: any, dom: HTMLElement, rect: any, size: any): number[] {
  const [x, y] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;

  // Start with right-offset positioning
  let tooltipX = x + 15;
  let tooltipY = y - contentHeight / 2;

  // If would overflow right, shift left of cursor
  if (tooltipX + contentWidth > viewWidth - 10) {
    tooltipX = x - contentWidth - 15;
  }

  // Vertical containment
  tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

  return [tooltipX, tooltipY];
}

/**
 * Area chart positioning function (avoids area fill)
 */
function areaChartPosition(point: number[], params: any, dom: HTMLElement, rect: any, size: any): number[] {
  const [x, y] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;

  // Prefer above-right to avoid area fill
  let tooltipX = x + 15;
  let tooltipY = y - contentHeight - 15;

  // Horizontal fallback
  if (tooltipX + contentWidth > viewWidth - 10) {
    tooltipX = x - contentWidth - 15;
  }

  // Vertical fallback (if near top, show below)
  if (tooltipY < 10) {
    tooltipY = y + 15;
  }

  // Final containment check
  tooltipX = Math.max(10, Math.min(tooltipX, viewWidth - contentWidth - 10));
  tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

  return [tooltipX, tooltipY];
}

/**
 * Bar chart positioning function (beside bar)
 */
function barChartPosition(point: number[], params: any, dom: HTMLElement, rect: any, size: any): number[] {
  const [x, y] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;

  // Position beside bar (right preferred)
  let tooltipX = x + 20;
  let tooltipY = y - contentHeight / 2;

  // If bar is on right side of chart, show tooltip on left
  if (x > viewWidth * 0.6) {
    tooltipX = x - contentWidth - 20;
  }

  // Vertical centering with containment
  tooltipY = Math.max(10, Math.min(tooltipY, viewHeight - contentHeight - 10));

  return [tooltipX, tooltipY];
}

/**
 * Create tooltip configuration for a specific chart type and theme
 *
 * @param chartType - Type of chart (line, heatmap, area, bar, scatter)
 * @param theme - MUI theme object
 * @param viewportWidth - Current viewport width in pixels
 * @returns Complete tooltip configuration object
 *
 * @example
 * ```typescript
 * const tooltipConfig = createTooltipConfig('line', theme, window.innerWidth);
 *
 * const chartOptions = {
 *   ...otherOptions,
 *   tooltip: tooltipConfig
 * };
 * ```
 */
export function createTooltipConfig(
  chartType: ChartType,
  theme: Theme,
  viewportWidth: number = window.innerWidth
): TooltipConfig {
  const deviceType = getDeviceType(viewportWidth);
  const maxWidth = getMaxWidth(deviceType, chartType);
  const minWidth = getMinWidth(deviceType, chartType);

  // Base configuration (shared across all types)
  const baseConfig = {
    confine: true,
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
    borderColor: alpha(theme.palette.divider, 0.2),
    borderWidth: 1,
    textStyle: {
      fontSize: deviceType === 'mobile' ? 11 : deviceType === 'large' ? 13 : 12,
      color: theme.palette.text.primary,
    },
  };

  // Chart-type specific configuration
  const typeConfigs = {
    line: {
      trigger: 'axis' as const,
      position: deviceType === 'mobile' ? 'top' : lineChartPosition,
      hideDelay: 200,
      padding: [12, 16],
    },
    heatmap: {
      trigger: 'item' as const,
      position: 'top',
      hideDelay: 200,
      enterable: true,
      padding: [12, 16],
    },
    area: {
      trigger: 'axis' as const,
      position: deviceType === 'mobile' ? 'top' : areaChartPosition,
      hideDelay: 200,
      padding: [12, 16],
    },
    bar: {
      trigger: 'item' as const,
      position: deviceType === 'mobile' ? 'top' : barChartPosition,
      hideDelay: 150,
      padding: [10, 14],
    },
    scatter: {
      trigger: 'item' as const,
      position: deviceType === 'mobile' ? 'top' : lineChartPosition,
      hideDelay: 150,
      padding: [10, 14],
    },
  };

  const typeConfig = typeConfigs[chartType];

  // Extra CSS styling
  const extraCssText = `
    max-width: ${maxWidth};
    min-width: ${minWidth};
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px ${alpha('#000000', 0.15)};
    z-index: 10000;
    ${chartType === 'heatmap' ? 'pointer-events: auto;' : ''}
  `.trim();

  return {
    ...baseConfig,
    ...typeConfig,
    extraCssText,
  };
}

/**
 * Hook to get responsive tooltip config that updates on window resize
 *
 * @param chartType - Type of chart
 * @param theme - MUI theme object
 * @returns Tooltip configuration that updates on resize
 *
 * @example
 * ```typescript
 * const MyChart = () => {
 *   const theme = useTheme();
 *   const tooltipConfig = useResponsiveTooltip('line', theme);
 *
 *   const chartOptions = useMemo(() => ({
 *     ...otherOptions,
 *     tooltip: tooltipConfig
 *   }), [tooltipConfig]);
 *
 *   return <EChartsWrapper option={chartOptions} />;
 * };
 * ```
 */
export function useResponsiveTooltip(chartType: ChartType, theme: Theme): TooltipConfig {
  const [config, setConfig] = React.useState(() =>
    createTooltipConfig(chartType, theme, window.innerWidth)
  );

  React.useEffect(() => {
    const handleResize = () => {
      setConfig(createTooltipConfig(chartType, theme, window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chartType, theme]);

  return config;
}
```

---

### 4.2 Usage Examples

#### Example 1: Line Chart with Responsive Tooltip

```typescript
import { useTheme } from '@mui/material/styles';
import { useResponsiveTooltip } from '@/utils/tooltipFactory';

const TemperatureLineChart = () => {
  const theme = useTheme();
  const tooltipConfig = useResponsiveTooltip('line', theme);

  const chartOptions = useMemo(() => ({
    title: { text: 'Zone Temperatures' },
    tooltip: tooltipConfig,
    xAxis: { type: 'time' },
    yAxis: { type: 'value' },
    series: [
      { name: 'Zone 1', type: 'line', data: temperatureData1 },
      { name: 'Zone 2', type: 'line', data: temperatureData2 },
    ]
  }), [tooltipConfig, temperatureData1, temperatureData2]);

  return <ReactECharts option={chartOptions} />;
};
```

#### Example 2: Heatmap with Custom Formatter

```typescript
import { useTheme } from '@mui/material/styles';
import { createTooltipConfig } from '@/utils/tooltipFactory';

const DeviationHeatmap = () => {
  const theme = useTheme();

  const chartOptions = useMemo(() => {
    const tooltipConfig = createTooltipConfig('heatmap', theme);

    return {
      title: { text: 'Device Deviation Heatmap' },
      tooltip: {
        ...tooltipConfig,
        formatter: (params: any) => {
          const device = params.name;
          const deviation = params.value[2];
          const timestamp = params.value[0];

          return `
            <div style="padding: 8px;">
              <strong>${device}</strong><br/>
              Time: ${formatDate(timestamp)}<br/>
              Deviation: <span style="color: ${getDeviationColor(deviation)}">
                ${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%
              </span>
            </div>
          `;
        }
      },
      // ... rest of config
    };
  }, [theme, heatmapData]);

  return <ReactECharts option={chartOptions} />;
};
```

---

## 5. Configuration Parameters Reference

### 5.1 Complete Parameter Matrix

| Parameter | Line | Heatmap | Area | Bar | Purpose |
|-----------|------|---------|------|-----|---------|
| `trigger` | axis | item | axis | item | What triggers the tooltip |
| `position` | function | 'top' | function | function | Positioning logic |
| `confine` | true | true | true | true | Keep within chart bounds |
| `hideDelay` | 200ms | 200ms | 200ms | 150ms | Delay before hiding |
| `enterable` | false | **true** | false | false | Allow tooltip hover |
| `padding` | [12,16] | [12,16] | [12,16] | [10,14] | Internal spacing |
| `max-width` | 400px | 350px | 400px | 300px | Maximum tooltip width (desktop) |
| `min-width` | 150px | 200px | 150px | 150px | Minimum tooltip width |
| `z-index` | 10000 | 10000 | 10000 | 10000 | Stacking order |

### 5.2 Design Token Integration

**Current Status**: Building Vitals already has comprehensive design tokens. Integrate tooltip configuration:

```typescript
// src/utils/chartDesignTokens.ts

export const CHART_DESIGN_TOKENS = {
  // ... existing tokens ...

  tooltip: {
    base: {
      confine: true,
      borderWidth: 1,
      padding: [12, 16],
      hideDelay: 200,
      textStyle: {
        fontSize: 12,
        fontFamily: '"Inter", "SF Pro Display", sans-serif',
      },
      extraCssText: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: 10000,
      }
    },

    sizing: {
      mobile: {
        maxWidth: 'min(90vw, 320px)',
        minWidth: '150px',
        fontSize: 11,
      },
      tablet: {
        maxWidth: '350px',
        minWidth: '180px',
        fontSize: 12,
      },
      desktop: {
        maxWidth: '400px',
        minWidth: '150px',
        fontSize: 12,
      },
      large: {
        maxWidth: '480px',
        minWidth: '200px',
        fontSize: 13,
      }
    },

    chartSpecific: {
      line: {
        trigger: 'axis',
        hideDelay: 200,
      },
      heatmap: {
        trigger: 'item',
        hideDelay: 200,
        enterable: true,
        maxWidth: '350px', // Override default
      },
      area: {
        trigger: 'axis',
        hideDelay: 200,
      },
      bar: {
        trigger: 'item',
        hideDelay: 150,
        maxWidth: '300px', // Override default
        padding: [10, 14],
      }
    }
  }
};
```

---

## 6. Positioning Function Visual Guide

### 6.1 Line Chart Positioning Algorithm

```
┌─────────────────────────────────────────┐
│                                         │
│  Step 1: Default Position (right)      │
│                                         │
│        cursor (x,y)                     │
│          ●                              │
│          ↓ +15px offset                 │
│          ┌──────────────┐               │
│          │   Tooltip    │               │
│          └──────────────┘               │
│                                         │
│  Step 2: Check Right Overflow          │
│                                         │
│                          cursor (x,y)   │
│                            ●            │
│           Would overflow → │            │
│  ┌──────────────┐          ↓            │
│  │   Tooltip    │ ← Move left (-15px)  │
│  └──────────────┘                       │
│                                         │
│  Step 3: Vertical Containment          │
│                                         │
│  ┌ cursor near top ●                    │
│  │ ┌──────────────┐                     │
│  │ │   Tooltip    │                     │
│  │ └──────────────┘                     │
│  └→ Clamp to 10px from edge            │
│                                         │
│                   cursor near bottom ● ┐│
│                  ┌──────────────┐      ││
│                  │   Tooltip    │      ││
│                  └──────────────┘      ││
│                   Clamp to 10px ←──────┘│
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 Heatmap Cell Positioning

```
Heatmap Grid with Tooltip Positioning:

┌────┬────┬────┬────┬────┐
│    │    │    │    │    │ ← Top row: tooltip appears BELOW
│ A1 │ A2 │ A3 │ A4 │ A5 │
│    │    │ ▲  │    │    │
└────┴────┴┼───┴────┴────┘
           │
      ┌────┴─────┐
      │ Tooltip  │
      │ A3: 72°F │
      │ Normal   │
      └──────────┘

┌────┬────┬────┬────┬────┐
│    │    │    │    │    │
│ B1 │ B2 │ B3 │ B4 │ B5 │
│    │    │ ●  │    │    │ ← Middle rows: tooltip appears ABOVE
└────┴────┴┼───┴────┴────┘
      ┌────┴─────┐
      │ Tooltip  │
      │ B3: 68°F │
      │ -2% dev  │
      └──────────┘
           │
┌────┬────┬┼───┬────┬────┐
│    │    │ ▼  │    │    │
│ C1 │ C2 │ C3 │ C4 │ C5 │
│    │    │    │    │    │
└────┴────┴────┴────┴────┘

Bottom row behavior same as top (tooltip below)
```

### 6.3 Area Chart Quadrant Logic

```
Area Chart with Filled Regions:

Priority Order: 1 → 2 → 3 → 4

Quadrant 1 (above-right) - PREFERRED
┌─────────────────────────┐
│ ┌─────────┐             │
│ │ Tooltip │             │
│ └─────────┘             │
│     ↘                   │
│      ●────cursor        │
│    Area Fill            │
│  (should not be hidden) │
└─────────────────────────┘

Quadrant 2 (above-left) - If Q1 overflows right
┌─────────────────────────┐
│         ┌─────────┐     │
│         │ Tooltip │     │
│         └─────────┘     │
│             ↙           │
│     cursor──●           │
│        Area Fill        │
│                         │
└─────────────────────────┘

Quadrant 3 (below-right) - If Q1 overflows top
┌─────────────────────────┐
│        Area Fill        │
│      ●────cursor        │
│     ↗                   │
│ ┌─────────┐             │
│ │ Tooltip │             │
│ └─────────┘             │
│                         │
└─────────────────────────┘

Quadrant 4 (below-left) - If Q2+Q3 fail
┌─────────────────────────┐
│        Area Fill        │
│     cursor──●           │
│             ↖           │
│         ┌─────────┐     │
│         │ Tooltip │     │
│         └─────────┘     │
│                         │
└─────────────────────────┘
```

---

## 7. Testing & Validation

### 7.1 Automated Tests

**Test File**: `src/utils/__tests__/tooltipFactory.test.ts`

```typescript
import { createTooltipConfig, getDeviceType } from '../tooltipFactory';
import { createTheme } from '@mui/material/styles';

describe('Tooltip Factory', () => {
  const theme = createTheme();

  describe('Device Type Detection', () => {
    it('should detect mobile for width < 768px', () => {
      expect(getDeviceType(375)).toBe('mobile');
      expect(getDeviceType(767)).toBe('mobile');
    });

    it('should detect tablet for width 768px-1023px', () => {
      expect(getDeviceType(768)).toBe('tablet');
      expect(getDeviceType(1023)).toBe('tablet');
    });

    it('should detect desktop for width 1024px-1919px', () => {
      expect(getDeviceType(1024)).toBe('desktop');
      expect(getDeviceType(1919)).toBe('desktop');
    });

    it('should detect large for width >= 1920px', () => {
      expect(getDeviceType(1920)).toBe('large');
      expect(getDeviceType(3840)).toBe('large');
    });
  });

  describe('Tooltip Configuration', () => {
    it('should create line chart tooltip with axis trigger', () => {
      const config = createTooltipConfig('line', theme, 1440);
      expect(config.trigger).toBe('axis');
      expect(config.confine).toBe(true);
      expect(config.hideDelay).toBe(200);
    });

    it('should create heatmap tooltip with enterable enabled', () => {
      const config = createTooltipConfig('heatmap', theme, 1440);
      expect(config.trigger).toBe('item');
      expect(config.enterable).toBe(true);
      expect(config.position).toBe('top');
    });

    it('should use mobile-specific config for small viewports', () => {
      const config = createTooltipConfig('line', theme, 375);
      expect(config.position).toBe('top');
      expect(config.textStyle.fontSize).toBe(11);
      expect(config.extraCssText).toContain('min(90vw, 320px)');
    });

    it('should use desktop-specific config for large viewports', () => {
      const config = createTooltipConfig('line', theme, 1920);
      expect(typeof config.position).toBe('function');
      expect(config.textStyle.fontSize).toBe(13);
      expect(config.extraCssText).toContain('480px');
    });
  });

  describe('Positioning Functions', () => {
    it('should position tooltip to right of cursor by default', () => {
      const config = createTooltipConfig('line', theme, 1440);
      const position = (config.position as Function)(
        [100, 200], // cursor position
        null,
        null as any,
        null,
        { contentSize: [200, 100], viewSize: [1440, 900] }
      );

      expect(position[0]).toBe(115); // x + 15px offset
      expect(position[1]).toBeLessThanOrEqual(200); // centered vertically
    });

    it('should flip tooltip to left when near right edge', () => {
      const config = createTooltipConfig('line', theme, 1440);
      const position = (config.position as Function)(
        [1300, 200], // cursor near right edge
        null,
        null as any,
        null,
        { contentSize: [200, 100], viewSize: [1440, 900] }
      );

      expect(position[0]).toBeLessThan(1300); // flipped to left
    });

    it('should contain tooltip within vertical bounds', () => {
      const config = createTooltipConfig('line', theme, 1440);
      const position = (config.position as Function)(
        [700, 10], // cursor near top
        null,
        null as any,
        null,
        { contentSize: [200, 100], viewSize: [1440, 900] }
      );

      expect(position[1]).toBeGreaterThanOrEqual(10); // min 10px from top
    });
  });
});
```

### 7.2 Manual Test Checklist

#### Desktop Browser Tests

- [ ] **Line Chart - Right Position**
  - Hover over data point in left half of chart
  - Tooltip appears to the right of cursor
  - Tooltip does not cover trend line
  - Distance: ~15px from cursor

- [ ] **Line Chart - Left Fallback**
  - Hover over data point in right 20% of chart
  - Tooltip flips to left of cursor
  - No horizontal overflow
  - Still readable and not covering data

- [ ] **Heatmap - Above Cell**
  - Hover over middle-row cells
  - Tooltip appears above hovered cell
  - Adjacent cells remain visible
  - Can hover tooltip without losing it

- [ ] **Heatmap - Below Cell (Top Row)**
  - Hover over top-row cells
  - Tooltip appears below cell (fallback)
  - Does not obscure other rows

- [ ] **Area Chart - Above-Right**
  - Hover over area chart
  - Tooltip appears above and right of cursor
  - Area fill remains visible
  - Quadrant fallback works at edges

- [ ] **Bar Chart - Side Positioning**
  - Hover over left-side bars
  - Tooltip appears to right of bar
  - Hover over right-side bars
  - Tooltip appears to left of bar

#### Mobile Device Tests (< 768px)

- [ ] **Touch Target Size**
  - Touch data points easily
  - No accidental dismissals
  - 300ms hideDelay provides stability

- [ ] **Simple 'top' Positioning**
  - All tooltips use simple 'top' position
  - No complex position calculations
  - Viewport containment works

- [ ] **Responsive Width**
  - Max-width respects 90vw
  - Content is readable
  - Font size is appropriate (11px)

- [ ] **Portrait vs Landscape**
  - Tooltips work in both orientations
  - Confine keeps them in bounds
  - Content doesn't get cut off

#### Tablet Device Tests (768px - 1024px)

- [ ] **Moderate Sizing**
  - Max-width ~350px feels balanced
  - Not too cramped, not too spacious
  - Works in both orientations

- [ ] **Positioning Functions**
  - Desktop-style positioning works
  - Enough room for intelligent placement
  - Fallbacks function correctly

#### Cross-Browser Tests

- [ ] **Chrome/Edge (Chromium)**
  - Backdrop blur renders correctly
  - Transitions are smooth
  - Z-index stacking works

- [ ] **Firefox**
  - Backdrop blur fallback
  - Positioning is accurate
  - Confine boundary respected

- [ ] **Safari (macOS/iOS)**
  - -webkit-backdrop-filter works
  - Touch interactions smooth
  - No rendering glitches

---

## 8. Performance Considerations

### 8.1 Position Function Optimization

**Current Implementation Status**: GOOD
- Position functions are already memoized within ECharts
- Simple arithmetic operations (< 1ms execution time)
- No expensive DOM queries

**Best Practices**:
```typescript
// ✅ GOOD: Simple calculations
function positionTooltip(point, params, dom, rect, size) {
  const [x, y] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  // ... simple math operations
  return [tooltipX, tooltipY];
}

// ❌ AVOID: Expensive operations
function positionTooltip(point, params, dom, rect, size) {
  // BAD: DOM queries
  const headerHeight = document.querySelector('.chart-header').offsetHeight;

  // BAD: Complex calculations
  const fibonacci = calculateFibonacci(contentWidth);

  // BAD: External API calls
  const offset = await fetchOffsetFromServer();
}
```

### 8.2 Formatter Function Performance

**Concern**: Complex tooltip content generation

**Optimization Strategy**:
```typescript
// Cache expensive calculations outside formatter
const cachedThresholds = useMemo(() => {
  return deviceConfigs.map(config => ({
    device: config.deviceName,
    threshold: calculateThreshold(config)
  }));
}, [deviceConfigs]);

// Use cached values in formatter
formatter: (params) => {
  const device = params.name;
  const threshold = cachedThresholds.find(t => t.device === device)?.threshold;

  // Fast formatting
  return `<div>${device}: ${params.value} (${threshold})</div>`;
}
```

### 8.3 Backdrop Blur Performance

**Issue**: Backdrop-filter can be GPU-intensive

**Mitigation**:
```css
/* Enable hardware acceleration */
extraCssText: `
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transform: translateZ(0); /* Force GPU layer */
  will-change: transform; /* Hint browser */
`
```

**Fallback for Low-End Devices**:
```typescript
const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(10px)');

const extraCssText = supportsBackdropFilter
  ? 'backdrop-filter: blur(10px);'
  : 'background-color: rgba(255, 255, 255, 0.98);'; // Opaque fallback
```

---

## 9. Accessibility Considerations

### 9.1 Keyboard Navigation

**Requirement**: Tooltips must be accessible via keyboard

**Implementation**:
```typescript
// For interactive tooltips (heatmaps)
tooltip: {
  enterable: true,
  alwaysShowContent: false, // Only show on focus/hover
}

// Support keyboard focus on chart elements
onChartReady: (chart) => {
  const chartDom = chart.getDom();
  chartDom.setAttribute('tabindex', '0');

  chartDom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Show tooltip for focused element
      chart.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: focusedIndex
      });
    }
  });
}
```

### 9.2 Screen Reader Support

**Requirement**: Tooltip content must be screen reader accessible

**Implementation**:
```typescript
// Add ARIA labels to chart elements
formatter: (params) => {
  const ariaLabel = `${params.seriesName}: ${params.value} ${unit} at ${params.axisValue}`;

  return `
    <div role="tooltip" aria-label="${ariaLabel}">
      <strong>${params.seriesName}</strong><br/>
      Value: ${params.value} ${unit}<br/>
      Time: ${params.axisValue}
    </div>
  `;
}
```

### 9.3 High Contrast Mode

**Requirement**: Tooltips must be visible in high contrast mode

**Implementation**:
```typescript
const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

tooltip: {
  borderWidth: isHighContrast ? 2 : 1,
  borderColor: isHighContrast ? theme.palette.text.primary : alpha(theme.palette.divider, 0.2),
  backgroundColor: theme.palette.background.paper, // Use solid color, no alpha
}
```

### 9.4 Motion Preferences

**Requirement**: Respect reduced motion preferences

**Implementation**:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

tooltip: {
  transitionDuration: prefersReducedMotion ? 0 : 0.2,
  extraCssText: `
    transition: ${prefersReducedMotion ? 'none' : 'all 0.2s ease'};
  `
}
```

---

## 10. Migration Guide

### 10.1 Current State Assessment

**File**: `src/theme/professionalChartTheme.ts` (Lines 174-225)

**Current Implementation**:
```typescript
tooltip: {
  trigger: 'axis',
  position: function (point: any, params: any, dom: any, rect: any, size: any) {
    const x = point[0];
    const y = point[1];
    const tooltipWidth = size.contentSize[0];
    const tooltipHeight = size.contentSize[1];
    const viewWidth = size.viewSize[0];
    const viewHeight = size.viewSize[1];

    let tooltipX = x + 10;
    if (tooltipX + tooltipWidth > viewWidth) {
      tooltipX = x - tooltipWidth - 10;
    }

    let tooltipY = y + 10;
    if (tooltipY + tooltipHeight > viewHeight) {
      tooltipY = y - tooltipHeight - 10;
    }

    tooltipX = Math.max(5, Math.min(tooltipX, viewWidth - tooltipWidth - 5));
    tooltipY = Math.max(5, Math.min(tooltipY, viewHeight - tooltipHeight - 5));

    return [tooltipX, tooltipY];
  },
  extraCssText: `
    backdrop-filter: blur(20px);
    max-height: 400px;
    overflow-y: auto;
    min-width: 150px;
    width: auto;
  `,
  // ... other settings
}
```

**Issues**:
1. ✅ Good: Has custom position function
2. ✅ Good: Uses backdrop-filter
3. ❌ Issue: No confine property
4. ❌ Issue: Generic for all chart types (should be chart-specific)
5. ❌ Issue: No responsive sizing
6. ⚠️  Concern: 5px buffer too small (recommend 10px)

### 10.2 Migration Strategy

**Phase 1: Add Tooltip Factory (Week 1)**

1. Create `src/utils/tooltipFactory.ts` with complete implementation
2. Add unit tests
3. Update design tokens to include tooltip configuration
4. Document new API

**Phase 2: Gradual Migration (Week 2-3)**

1. Migrate line charts first (most common)
2. Migrate heatmaps (most complex)
3. Migrate remaining chart types
4. Run parallel A/B test to validate

**Phase 3: Deprecate Old System (Week 4)**

1. Remove old tooltip config from professionalChartTheme
2. Update all chart components to use factory
3. Remove fallback code
4. Update documentation

### 10.3 Migration Example

**Before** (Current):
```typescript
// In EChartsTimeSeriesChart.tsx
const chartOptions = {
  ...professionalChartTheme,
  series: seriesData,
  // Uses default tooltip from theme
};
```

**After** (New):
```typescript
// In EChartsTimeSeriesChart.tsx
import { useResponsiveTooltip } from '@/utils/tooltipFactory';

const EChartsTimeSeriesChart = (props) => {
  const theme = useTheme();
  const tooltipConfig = useResponsiveTooltip('line', theme);

  const chartOptions = useMemo(() => ({
    ...professionalChartTheme,
    tooltip: tooltipConfig, // Override with chart-specific config
    series: seriesData,
  }), [tooltipConfig, seriesData]);

  return <ReactECharts option={chartOptions} />;
};
```

---

## 11. Future Enhancements

### 11.1 Smart Content Truncation

**Concept**: Automatically truncate long tooltip content based on available space

**Implementation Idea**:
```typescript
formatter: (params) => {
  const maxHeight = size.viewSize[1] * 0.4; // Max 40% of viewport
  const lineHeight = 20;
  const maxLines = Math.floor(maxHeight / lineHeight);

  let lines = generateTooltipLines(params);

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines - 1);
    lines.push('<div style="color: #888;">... (click to expand)</div>');
  }

  return lines.join('<br/>');
}
```

### 11.2 Tooltip Pinning

**Concept**: Click to "pin" tooltip in place for detailed inspection

**Implementation Idea**:
```typescript
let pinnedTooltip = null;

onChartClick: (params) => {
  if (pinnedTooltip) {
    // Remove existing pin
    pinnedTooltip.remove();
    pinnedTooltip = null;
  } else {
    // Create pinned tooltip
    pinnedTooltip = createPinnedTooltip(params);
  }
}
```

### 11.3 Tooltip Comparison Mode

**Concept**: Pin multiple tooltips to compare data points

**Implementation Idea**:
```typescript
const [pinnedTooltips, setPinnedTooltips] = useState([]);

const handlePin = (params) => {
  setPinnedTooltips(prev => [...prev, {
    id: Date.now(),
    data: params,
    position: getCurrentTooltipPosition()
  }]);
};

// Render pinned tooltips as overlays
{pinnedTooltips.map(tooltip => (
  <PinnedTooltip
    key={tooltip.id}
    data={tooltip.data}
    position={tooltip.position}
    onClose={() => removePinnedTooltip(tooltip.id)}
  />
))}
```

### 11.4 Tooltip Analytics

**Concept**: Track which tooltips users interact with most

**Implementation Idea**:
```typescript
const trackTooltipView = (chartType: string, seriesName: string) => {
  analytics.track('tooltip_viewed', {
    chartType,
    seriesName,
    timestamp: Date.now()
  });
};

formatter: (params) => {
  trackTooltipView(chartType, params.seriesName);
  return generateTooltipContent(params);
}
```

---

## 12. Summary & Recommendations

### 12.1 Key Takeaways

1. **Position**: Smart positioning based on chart type and viewport
2. **Confine**: Always use `confine: true` for viewport containment
3. **Sizing**: Dynamic with chart-specific max-widths (300-400px)
4. **Responsive**: Adjust based on device type and orientation
5. **Performance**: Optimize position functions and formatter complexity

### 12.2 Immediate Action Items

**Priority 1 (This Sprint)**:
1. ✅ Create `tooltipFactory.ts` utility
2. ✅ Add tooltip design tokens to `chartDesignTokens.ts`
3. ✅ Migrate line charts to use new factory
4. ✅ Migrate heatmaps to use new factory

**Priority 2 (Next Sprint)**:
1. Migrate remaining chart types
2. Add comprehensive unit tests
3. Conduct user testing on mobile devices
4. Add accessibility enhancements

**Priority 3 (Future)**:
1. Implement tooltip pinning
2. Add comparison mode
3. Integrate analytics tracking
4. Explore smart content truncation

### 12.3 Success Metrics

**User Experience**:
- Tooltip readability score > 95% (user survey)
- Zero tooltip overflow reports
- < 1% of users report tooltip positioning issues

**Performance**:
- Position function execution < 1ms
- Formatter execution < 5ms
- No dropped frames during tooltip transitions

**Accessibility**:
- 100% keyboard navigable
- WCAG AAA contrast compliance
- Screen reader compatibility verified

---

## Appendix A: Quick Reference Card

### Recommended Settings at a Glance

| Chart Type | Trigger | Position | Max Width | HideDelay | Enterable |
|------------|---------|----------|-----------|-----------|-----------|
| Line       | axis    | function | 400px     | 200ms     | false     |
| Heatmap    | item    | 'top'    | 350px     | 200ms     | **true**  |
| Area       | axis    | function | 400px     | 200ms     | false     |
| Bar        | item    | function | 300px     | 150ms     | false     |
| Scatter    | item    | function | 320px     | 150ms     | false     |

### Mobile Overrides

All chart types on mobile (< 768px):
- Position: `'top'` (simple)
- Max Width: `min(90vw, 320px)`
- Font Size: `11px`
- Hide Delay: `300ms` (longer for touch)

---

## Appendix B: Related Files

**Design System**:
- `src/utils/chartDesignTokens.ts` - Design token definitions
- `src/theme/professionalChartTheme.ts` - Current theme (to be refactored)

**Chart Components**:
- `src/components/charts/EChartsTimeSeriesChart.tsx` - Line chart
- `src/components/charts/EChartsDeviceDeviationHeatmap.tsx` - Heatmap
- `src/components/charts/EChartsHeatmap.tsx` - Generic heatmap
- `src/components/charts/AdvancedTooltip.tsx` - Custom tooltip component

**Utilities**:
- `src/utils/chartOptionBuilders.ts` - Chart configuration builders
- `src/utils/formatters.ts` - Number and date formatters

---

## Appendix C: Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Backdrop Filter | ✅ 76+ | ✅ 103+ | ✅ 9+ | ✅ 79+ |
| CSS Grid | ✅ 57+ | ✅ 52+ | ✅ 10+ | ✅ 16+ |
| Custom Position | ✅ All | ✅ All | ✅ All | ✅ All |
| Confine | ✅ All | ✅ All | ✅ All | ✅ All |
| Z-Index | ✅ All | ✅ All | ✅ All | ✅ All |

**Fallback Strategy for Backdrop Filter**:
```typescript
const supportsBackdrop = CSS.supports('backdrop-filter', 'blur(10px)') ||
                        CSS.supports('-webkit-backdrop-filter', 'blur(10px)');

extraCssText: supportsBackdrop
  ? 'backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);'
  : 'background-color: rgba(255, 255, 255, 0.98);'
```

---

**Document End**

For questions or clarifications, contact the UI/UX team or refer to the Building Vitals design system documentation.
