# Dual-Name Display System Architecture

## Executive Summary

This document defines the complete architecture for displaying both cleaned display names and original API point names across ALL chart types in the Building Vitals platform. The system will enhance user experience by showing human-readable labels while maintaining traceability to the original API data sources.

---

## 1. Current State Analysis

### 1.1 Data Flow
```
Point Object (API) → Container Component → ChartSeriesData → Chart Component → ECharts
```

### 1.2 Existing Fields
```typescript
// From api.ts
interface Point {
  name: string;              // Original API name (e.g., "r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor")
  display_name?: string;     // Cleaned name (e.g., "VAV Rm 200 Discharge Air Temp")
  original_name?: string;    // Backup of original name
  unit?: string;             // "°F", "kW", etc.
  // ... other fields
}

// From types.ts
interface ChartSeriesData {
  name: string;              // Currently stores display_name OR name
  data: Array<[number, number]>;
  unit?: string;
  markerTags?: string[];
  pointMetadata?: PointMetadata;
}
```

### 1.3 Problem Statement
- Charts currently show only ONE name (either display_name or name)
- Users lose traceability to original API point names
- Debugging and troubleshooting is difficult
- No consistent pattern for dual-name display

---

## 2. Architectural Solution

### 2.1 Core Principle: Non-Breaking Extension
**We will NOT modify the existing `ChartSeriesData.name` field. Instead, we'll add a new field for the original name.**

### 2.2 Enhanced Type Definitions

#### 2.2.1 Update `ChartSeriesData` Interface
```typescript
// src/components/charts/types.ts

export interface ChartSeriesData {
  name: string;                    // Human-readable display name (display_name || name)
  originalName?: string;           // Original API point name (for reference)
  data: Array<[number, number]>;
  unit?: string;
  color?: string;
  markerTags?: string[];
  pointMetadata?: PointMetadata;
}
```

#### 2.2.2 New Utility Types
```typescript
// src/utils/chartFormatters.ts

export interface PointNameDisplay {
  displayName: string;             // Clean, readable name
  originalName: string;            // Raw API name
  unit?: string;                   // Unit for context
}

export interface AxisLabelConfig {
  format: 'multiline' | 'inline' | 'tooltip-only';
  maxDisplayLength?: number;       // Truncate display name
  maxOriginalLength?: number;      // Truncate original name
  showUnit?: boolean;              // Include unit in label
}
```

---

## 3. Implementation Strategy

### 3.1 Core Utility Function

#### 3.1.1 Point Name Formatter
```typescript
// src/utils/chartFormatters.ts

/**
 * Format point names for chart display
 *
 * @param point - Point object with name and display_name
 * @param config - Display configuration
 * @returns Formatted label string
 *
 * @example
 * // Multiline format (for Y-axis)
 * formatPointName(point, { format: 'multiline' })
 * // Returns:
 * // "VAV Rm 200 Discharge Air Temp\n(r:campus_1 r:building_4 VAV:vav_rm_200...)"
 *
 * // Inline format (for series names)
 * formatPointName(point, { format: 'inline' })
 * // Returns: "VAV Rm 200 Discharge Air Temp (r:campus_1...)"
 *
 * // Tooltip only (for hover details)
 * formatPointName(point, { format: 'tooltip-only' })
 * // Returns structured HTML
 */
export function formatPointName(
  point: { name: string; display_name?: string; unit?: string },
  config: AxisLabelConfig = { format: 'multiline' }
): string {
  const displayName = point.display_name || point.name;
  const originalName = point.name;

  // If they're the same (no cleaning applied), show only once
  if (displayName === originalName) {
    return displayName;
  }

  const { format, maxDisplayLength = 40, maxOriginalLength = 50 } = config;

  // Truncate if needed
  const truncatedDisplay = truncateLabel(displayName, maxDisplayLength);
  const truncatedOriginal = truncateLabel(originalName, maxOriginalLength);

  switch (format) {
    case 'multiline':
      // For Y-axis labels - readable on two lines
      return `${truncatedDisplay}\n(${truncatedOriginal})`;

    case 'inline':
      // For series names - compact single line
      return `${truncatedDisplay} (${truncatedOriginal})`;

    case 'tooltip-only':
      // For tooltips - full detail with HTML formatting
      return `
        <div style="margin-bottom: 4px;">
          <strong>${displayName}</strong>
        </div>
        <div style="color: rgba(255,255,255,0.6); font-size: 11px;">
          API: ${originalName}
        </div>
      `;

    default:
      return displayName;
  }
}

/**
 * Truncate long labels intelligently
 * Preserves important parts at beginning and end
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;

  // For very long names, show start and end with "..." in middle
  const startChars = Math.floor((maxLength - 3) * 0.6);
  const endChars = Math.floor((maxLength - 3) * 0.4);

  return `${label.substring(0, startChars)}...${label.substring(label.length - endChars)}`;
}

/**
 * Extract PointNameDisplay from Point object
 * Standardizes name extraction across the application
 */
export function extractPointNameDisplay(
  point: { name: string; display_name?: string; unit?: string }
): PointNameDisplay {
  return {
    displayName: point.display_name || point.name,
    originalName: point.name,
    unit: point.unit,
  };
}
```

#### 3.1.2 ECharts-Specific Formatters
```typescript
// src/utils/chartFormatters.ts

/**
 * Create Y-axis label formatter with dual names
 * Returns a function suitable for ECharts yAxis.axisLabel.formatter
 */
export function createDualNameAxisFormatter(
  format: 'multiline' | 'inline' = 'multiline'
) {
  return (value: string): string => {
    // Value will be the point display name
    // We need to look up the original name from metadata
    // This is handled by the chart component passing both names
    return value; // Chart will pre-format these
  };
}

/**
 * Create rich text configuration for ECharts
 * Enables styling of multiline labels
 */
export function getDualNameRichTextStyle(): Record<string, any> {
  return {
    displayName: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 16,
      color: 'inherit',
    },
    originalName: {
      fontSize: 10,
      fontWeight: 400,
      lineHeight: 14,
      color: 'rgba(0, 0, 0, 0.6)', // Dimmed
    },
  };
}

/**
 * Format tooltip with dual names
 * Enhanced version of createTimeSeriesToolTipFormatter
 */
export function createDualNameTooltipFormatter(
  data: Array<{
    name: string;
    originalName?: string;
    unit?: string;
    markerTags?: string[];
  }>
) {
  return (params: any) => {
    if (!Array.isArray(params)) {
      params = [params];
    }

    let content = '';
    const timestamp = params[0]?.data?.[0];

    if (timestamp) {
      const date = new Date(timestamp);
      content += formatTimestampForTooltip(date);
    }

    params.forEach((param: any) => {
      const seriesIndex = param.seriesIndex;
      const seriesData = data[seriesIndex];
      const value = param.data?.[1];

      if (value !== undefined && seriesData) {
        const formattedValue = formatNumberForDisplay(value, 2, seriesData.unit);

        content += `
          <div style="margin-top: 8px;">
            ${param.marker}
            <div style="margin-left: 8px;">
              <strong>${seriesData.name}</strong>: ${formattedValue}
              ${seriesData.originalName && seriesData.originalName !== seriesData.name ? `
                <br/>
                <span style="color: rgba(255,255,255,0.5); font-size: 10px;">
                  ${seriesData.originalName}
                </span>
              ` : ''}
            </div>
          </div>
        `;
      }
    });

    return content;
  };
}
```

---

## 4. Container Component Updates

### 4.1 Standard Pattern for All Containers

```typescript
// Example: src/components/charts/containers/TimeSeriesChartContainer.tsx

const TimeSeriesChartContainer: React.FC<Props> = ({
  selectedPoints,
  timeRange,
  ...chartProps
}) => {
  const { data, isLoading, error } = useChartData({
    selectedPoints,
    timeRange,
  });

  // Transform data to include both names
  const chartData: ChartSeriesData[] =
    data?.series?.map((series) => ({
      name: series.name,                    // Already contains display_name || name
      originalName: series.originalName,    // NEW: Original API name
      data: series.data,
      unit: series.unit,
      markerTags: series.markerTag ? [series.markerTag] : series.markerTags || [],
      pointMetadata: {
        unit: series.unit,
        markerTag: series.markerTag,
      },
    })) || [];

  return (
    <EChartsTimeSeriesChart
      data={chartData}
      loading={isLoading}
      error={error}
      {...chartProps}
    />
  );
};
```

### 4.2 Hook Updates Required

```typescript
// src/hooks/useChartData.ts

// Ensure the hook returns both display_name and original name
export function useChartData(options: UseChartDataOptions) {
  // ... existing logic ...

  const series = points.map(point => ({
    name: point.display_name || point.name,  // Display name for UI
    originalName: point.name,                // Original API name
    data: timeseriesData[point.name] || [],
    unit: point.unit,
    markerTag: point.marker_tags?.[0],
    markerTags: point.marker_tags,
  }));

  return { series, isLoading, error };
}
```

---

## 5. Chart-Specific Integration

### 5.1 Time Series Charts

```typescript
// src/components/charts/EChartsTimeSeriesChart.tsx

// Y-Axis Configuration
const yAxis: EChartsAxisOption = {
  type: 'value',
  name: data.length === 1
    ? formatPointName(
        { name: data[0].originalName || data[0].name, display_name: data[0].name, unit: data[0].unit },
        { format: 'multiline', maxDisplayLength: 30, maxOriginalLength: 40 }
      )
    : 'Value',
  nameTextStyle: {
    fontSize: 11,
    align: 'right',
  },
  nameGap: 50,
  nameLocation: 'middle',
  // Enable rich text for multiline formatting
  nameTextStyle: {
    rich: getDualNameRichTextStyle(),
  },
};

// Series Configuration
const series: LineSeriesOption[] = data.map((seriesData) => ({
  name: seriesData.name, // Display name in legend
  type: 'line',
  data: seriesData.data,
  // Store original name in series metadata for tooltips
  encode: {
    originalName: seriesData.originalName,
  },
}));

// Tooltip Configuration
const tooltip: TooltipComponentOption = {
  ...CHART_DESIGN_TOKENS.tooltip.base,
  formatter: createDualNameTooltipFormatter(data),
};
```

### 5.2 Bar Charts

```typescript
// src/components/charts/EChartsBarChart.tsx

// X-Axis Configuration (for vertical bars)
const xAxis: EChartsAxisOption = {
  type: 'category',
  data: data.map(item =>
    formatPointName(
      { name: item.originalName || item.name, display_name: item.name },
      { format: 'inline', maxDisplayLength: 20 }
    )
  ),
  axisLabel: {
    rotate: 45,
    fontSize: 10,
    overflow: 'truncate',
    width: 100,
  },
};

// Tooltip shows full names
const tooltip: TooltipComponentOption = {
  formatter: (params: any) => {
    const dataItem = data[params.dataIndex];
    return `
      <div>
        <strong>${dataItem.name}</strong><br/>
        <span style="font-size: 10px; color: rgba(255,255,255,0.6);">
          ${dataItem.originalName || dataItem.name}
        </span><br/>
        <strong>${formatNumberForDisplay(params.value, 2, dataItem.unit)}</strong>
      </div>
    `;
  },
};
```

### 5.3 Scatter Plots

```typescript
// src/components/charts/EChartsScatterPlot.tsx

// Axes show original names in tooltip only
const xAxis: EChartsAxisOption = {
  name: props.xAxisLabel || 'X Axis',
  nameLocation: 'middle',
  nameGap: 30,
};

const yAxis: EChartsAxisOption = {
  name: props.yAxisLabel || 'Y Axis',
  nameLocation: 'middle',
  nameGap: 50,
};

// Tooltip shows both X and Y point names
const tooltip: TooltipComponentOption = {
  formatter: (params: any) => {
    const xPoint = data[0]; // X-axis point
    const yPoint = data[1]; // Y-axis point

    return `
      <div>
        <strong>X:</strong> ${xPoint.name}<br/>
        <span style="font-size: 10px;">(${xPoint.originalName})</span><br/>
        <strong>Value:</strong> ${formatNumberForDisplay(params.value[0], 2, xPoint.unit)}<br/>
        <br/>
        <strong>Y:</strong> ${yPoint.name}<br/>
        <span style="font-size: 10px;">(${yPoint.originalName})</span><br/>
        <strong>Value:</strong> ${formatNumberForDisplay(params.value[1], 2, yPoint.unit)}
      </div>
    `;
  },
};
```

### 5.4 Heatmaps

```typescript
// src/components/charts/EChartsHeatmap.tsx

// Y-Axis shows point names (one per row)
const yAxis: EChartsAxisOption = {
  type: 'category',
  data: data.map(series =>
    formatPointName(
      { name: series.originalName || series.name, display_name: series.name },
      { format: 'multiline', maxDisplayLength: 25, maxOriginalLength: 35 }
    )
  ),
  axisLabel: {
    fontSize: 10,
    overflow: 'truncate',
    width: 150, // Wide enough for two lines
  },
};

// Tooltip includes full point name
const tooltip: TooltipComponentOption = {
  formatter: (params: any) => {
    const seriesData = data[params.seriesIndex];
    return `
      <div>
        <strong>${seriesData.name}</strong><br/>
        <span style="font-size: 10px; color: rgba(255,255,255,0.6);">
          ${seriesData.originalName}
        </span><br/>
        <strong>Time:</strong> ${formatTimestamp(params.value[0])}<br/>
        <strong>Value:</strong> ${formatNumberForDisplay(params.value[1], 2, seriesData.unit)}
      </div>
    `;
  },
};
```

---

## 6. Design Token Integration

### 6.1 Add to `chartDesignTokens.ts`

```typescript
// src/utils/chartDesignTokens.ts

export const DUAL_NAME_CONFIG = {
  /** Default format for Y-axis labels */
  yAxisFormat: 'multiline' as const,

  /** Default format for series names (legend) */
  seriesFormat: 'inline' as const,

  /** Default format for tooltips */
  tooltipFormat: 'tooltip-only' as const,

  /** Maximum display name length before truncation */
  maxDisplayLength: 35,

  /** Maximum original name length before truncation */
  maxOriginalLength: 45,

  /** Typography for display name */
  displayNameStyle: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 16,
  },

  /** Typography for original name (dimmed) */
  originalNameStyle: {
    fontSize: 10,
    fontWeight: 400,
    lineHeight: 14,
    opacity: 0.7,
  },
} as const;
```

---

## 7. Migration Strategy

### 7.1 Phase 1: Foundation (1 developer, 2 hours)
- [ ] Add `originalName` field to `ChartSeriesData` interface
- [ ] Create utility functions in `chartFormatters.ts`
- [ ] Add design tokens to `chartDesignTokens.ts`
- [ ] Update `useChartData` hook to include `originalName`
- [ ] Write unit tests for formatters

### 7.2 Phase 2: Core Charts (2 developers, 4 hours)
**Parallel Implementation:**

**Developer 1:**
- [ ] `TimeSeriesChartContainer.tsx` → Update data transformation
- [ ] `EChartsTimeSeriesChart.tsx` → Integrate formatters
- [ ] `AreaChartContainer.tsx` → Update data transformation
- [ ] `EChartsAreaChart.tsx` → Integrate formatters

**Developer 2:**
- [ ] `BarChartContainer.tsx` → Update data transformation
- [ ] `EChartsBarChart.tsx` → Integrate formatters
- [ ] `ScatterPlotContainer.tsx` → Update data transformation
- [ ] `EChartsScatterPlot.tsx` → Integrate formatters

### 7.3 Phase 3: Specialized Charts (2 developers, 3 hours)
**Developer 1:**
- [ ] Device Deviation Heatmap
- [ ] Candlestick Chart
- [ ] Calendar Chart
- [ ] Psychrometric Chart

**Developer 2:**
- [ ] Perfect Economizer Chart
- [ ] SPC Chart
- [ ] Sankey Diagram
- [ ] Gauge Charts

### 7.4 Phase 4: Testing & Validation (1 developer, 2 hours)
- [ ] Visual regression tests for each chart type
- [ ] Tooltip interaction tests
- [ ] Long name truncation tests
- [ ] Edge case handling (missing display_name, identical names)
- [ ] Performance testing with 50+ series

---

## 8. Edge Cases & Error Handling

### 8.1 Missing `display_name`
```typescript
// Graceful fallback
const displayName = point.display_name || point.name;
const originalName = point.name;

// If identical, show only once
if (displayName === originalName) {
  return displayName;
}
```

### 8.2 Extremely Long Names
```typescript
// Truncate intelligently
const truncated = truncateLabel(name, maxLength);
// "r:campus_1 r:build...vav_rm_200 sensor"
```

### 8.3 Special Characters in Names
```typescript
// ECharts handles HTML entities, but wrap in <span> for safety
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 8.4 Performance with Many Series
```typescript
// Cache formatted names
const nameCache = new Map<string, string>();

function getCachedFormattedName(point: Point, config: AxisLabelConfig): string {
  const cacheKey = `${point.name}_${config.format}_${config.maxDisplayLength}`;

  if (!nameCache.has(cacheKey)) {
    nameCache.set(cacheKey, formatPointName(point, config));
  }

  return nameCache.get(cacheKey)!;
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests
```typescript
// src/utils/__tests__/chartFormatters.test.ts

describe('formatPointName', () => {
  it('should format multiline labels correctly', () => {
    const point = {
      name: 'r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor',
      display_name: 'VAV Rm 200 Discharge Air Temp',
    };

    const result = formatPointName(point, { format: 'multiline' });

    expect(result).toBe(
      'VAV Rm 200 Discharge Air Temp\n(r:campus_1 r:building_4 VAV:vav_rm_200...)'
    );
  });

  it('should handle identical names', () => {
    const point = {
      name: 'Simple Name',
      display_name: 'Simple Name',
    };

    const result = formatPointName(point, { format: 'multiline' });
    expect(result).toBe('Simple Name');
  });

  it('should truncate long names intelligently', () => {
    const veryLongName = 'a'.repeat(100);
    const truncated = truncateLabel(veryLongName, 30);

    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(truncated).toContain('...');
  });
});
```

### 9.2 Integration Tests
```typescript
// src/components/charts/__tests__/TimeSeriesChart.dualName.test.tsx

describe('TimeSeriesChart Dual Name Display', () => {
  it('should show both names in tooltip', async () => {
    const mockData: ChartSeriesData[] = [{
      name: 'VAV Rm 200 Temp',
      originalName: 'r:campus_1 r:building_4 VAV:vav_rm_200 temp',
      data: [[Date.now(), 72]],
      unit: '°F',
    }];

    render(<TimeSeriesChart data={mockData} />);

    const chartElement = screen.getByRole('img'); // ECharts canvas
    fireEvent.mouseOver(chartElement);

    await waitFor(() => {
      expect(screen.getByText(/VAV Rm 200 Temp/)).toBeInTheDocument();
      expect(screen.getByText(/r:campus_1/)).toBeInTheDocument();
    });
  });
});
```

---

## 10. Performance Considerations

### 10.1 Rendering Optimization
- **Label Caching**: Cache formatted labels to avoid recalculation
- **Lazy Formatting**: Only format visible labels (for virtual scrolling)
- **Memoization**: Use `useMemo` for formatted name arrays

### 10.2 Memory Management
```typescript
// Limit cache size
const MAX_CACHE_SIZE = 500;

function addToCache(key: string, value: string) {
  if (nameCache.size >= MAX_CACHE_SIZE) {
    const firstKey = nameCache.keys().next().value;
    nameCache.delete(firstKey);
  }
  nameCache.set(key, value);
}
```

### 10.3 Bundle Size
- **Tree Shaking**: Ensure formatter functions are tree-shakeable
- **Estimated Addition**: ~3KB gzipped for all formatters

---

## 11. User Experience Guidelines

### 11.1 Visual Hierarchy
1. **Display Name**: Bold, 12px, primary color
2. **Original Name**: Regular, 10px, 60% opacity
3. **Unit**: Italic, 11px, secondary color

### 11.2 Interaction Design
- **Hover**: Tooltip shows full untruncated names
- **Click**: Copy full name to clipboard (future enhancement)
- **Legend**: Shows display name only (hover for original)

### 11.3 Accessibility
- **Screen Readers**: Announce both names with proper labels
- **Keyboard Navigation**: Tab through labels, Enter to reveal full name
- **High Contrast**: Ensure 4.5:1 contrast ratio for original name text

---

## 12. Configuration Options

### 12.1 User Preferences (Future Enhancement)
```typescript
interface ChartNamePreferences {
  showOriginalNames: boolean;      // Toggle display of original names
  nameFormat: 'multiline' | 'inline' | 'tooltip-only';
  maxDisplayLength: number;
  maxOriginalLength: number;
}

// Store in user settings
const defaultPreferences: ChartNamePreferences = {
  showOriginalNames: true,
  nameFormat: 'multiline',
  maxDisplayLength: 35,
  maxOriginalLength: 45,
};
```

---

## 13. Documentation Requirements

### 13.1 Developer Documentation
- [ ] Update `CHART_VISUAL_STYLE_GUIDE.md` with dual-name examples
- [ ] Add formatter examples to `CHART_UTILITIES_GUIDE.md`
- [ ] Update `CHART_DESIGN_TOKENS.md` with dual-name config

### 13.2 User Documentation
- [ ] Add section to user guide explaining name displays
- [ ] Screenshot examples of multiline vs inline formats
- [ ] FAQ about original vs display names

---

## 14. Success Metrics

### 14.1 Functional Requirements
- ✅ All 24+ chart types display both names
- ✅ Names are readable and properly truncated
- ✅ Tooltips show full untruncated names
- ✅ Performance impact < 5% on render time

### 14.2 Quality Requirements
- ✅ 100% unit test coverage for formatters
- ✅ Zero visual regressions in existing charts
- ✅ Accessibility score maintained at 95+
- ✅ Bundle size increase < 5KB gzipped

---

## 15. Example Outputs

### 15.1 Time Series Chart Y-Axis
```
VAV Rm 200 Discharge Temp
(r:campus_1 r:building_4 VAV:vav_rm_200 dis...)
```

### 15.2 Bar Chart X-Axis
```
VAV Rm 200 Temp (r:campus_1...)
```

### 15.3 Tooltip
```html
<div>
  <strong>VAV Rm 200 Discharge Air Temp</strong>: 72.5°F
  <div style="font-size: 10px; opacity: 0.6;">
    API: r:campus_1 r:building_4 VAV:vav_rm_200 discharge-air-temp sensor
  </div>
</div>
```

### 15.4 Legend
```
Series Name: VAV Rm 200 Temp
(Hover for full API name)
```

---

## 16. Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing charts | High | Low | Extensive regression testing, non-breaking API changes |
| Performance degradation | Medium | Low | Caching, memoization, performance benchmarks |
| User confusion | Medium | Medium | Clear visual hierarchy, user testing, documentation |
| Long names overflow UI | Low | Medium | Intelligent truncation, tooltip fallback |
| Inconsistent implementation | Medium | Medium | Design tokens, shared utilities, code reviews |

---

## 17. Future Enhancements

### 17.1 Phase 2 Features
- [ ] User preference to toggle original names
- [ ] Click-to-copy full name functionality
- [ ] Semantic highlighting of name components (e.g., equipment type, location)
- [ ] Name history tracking (if point is renamed)

### 17.2 Phase 3 Features
- [ ] AI-powered name suggestions
- [ ] Bulk name editing interface
- [ ] Name validation and quality checks
- [ ] Name translation/localization support

---

## 18. Implementation Checklist

### 18.1 Code Changes
- [ ] Update `ChartSeriesData` interface in `types.ts`
- [ ] Add formatters to `chartFormatters.ts`
- [ ] Update `chartDesignTokens.ts`
- [ ] Modify `useChartData` hook
- [ ] Update all 24 container components
- [ ] Update all 24 chart components

### 18.2 Testing
- [ ] Unit tests for formatters
- [ ] Integration tests for each chart type
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Accessibility audit

### 18.3 Documentation
- [ ] Update developer docs
- [ ] Update user guide
- [ ] Create migration guide
- [ ] Record demo video

### 18.4 Deployment
- [ ] Feature flag for gradual rollout
- [ ] Monitoring and error tracking
- [ ] User feedback collection
- [ ] Performance monitoring

---

## 19. Timeline Estimate

| Phase | Duration | Developers | Total Hours |
|-------|----------|------------|-------------|
| Phase 1: Foundation | 2 hours | 1 | 2 |
| Phase 2: Core Charts | 4 hours | 2 | 8 |
| Phase 3: Specialized Charts | 3 hours | 2 | 6 |
| Phase 4: Testing & Validation | 2 hours | 1 | 2 |
| **Total** | **11 hours** | **2-3** | **18** |

**Estimated Completion:** 2-3 business days with 2 developers working in parallel

---

## 20. Conclusion

This architecture provides a comprehensive, maintainable, and user-friendly solution for displaying both cleaned and original point names across all charts. The design is:

- **Non-Breaking**: Extends existing types without modification
- **DRY**: Single source of truth for formatting logic
- **Type-Safe**: Full TypeScript support
- **Performant**: Caching and memoization strategies
- **Flexible**: Configurable formats for different use cases
- **Maintainable**: Clear patterns and shared utilities

The implementation can be completed in parallel by multiple developers, with clear separation of concerns and minimal risk of conflicts.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-16
**Author:** System Architecture Designer
**Status:** Ready for Implementation
