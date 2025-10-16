/**
 * Chart Defaults Configuration (Quick Win #5 Mock Implementation)
 *
 * Centralized default values for all chart components.
 * This is a mock implementation for integration testing purposes.
 *
 * @module config/chartDefaults
 */

/**
 * Base chart defaults applied to all chart types
 */
export const CHART_DEFAULTS = {
  // Layout & Sizing
  height: 400,
  width: '100%',
  minHeight: 300,

  // Loading & Error States
  loading: false,
  error: null,

  // Common Features
  showLegend: true,
  showDataZoom: true,
  enableToolbox: true,
  showMarkerTags: true,
  showExportToolbar: true,

  // Performance
  enableAnimation: false, // Disabled for performance
  enableDownsampling: false,
  downsamplingThreshold: 5000,

  // Data View
  enableDataView: false,
  enableMagicType: false,

  // Export
  exportPosition: 'top-right' as const,

  // Theming
  customColors: undefined as string[] | undefined,

  // Accessibility
  enableErrorBoundary: true
} as const;

/**
 * Chart-type-specific default overrides
 */
export const CHART_TYPE_DEFAULTS = {
  timeSeries: {
    ...CHART_DEFAULTS,
    showDataZoom: true,
    enableDownsampling: true,
    chartType: 'timeSeries' as const
  },

  bar: {
    ...CHART_DEFAULTS,
    orientation: 'vertical' as const,
    showValues: true,
    showDataZoom: false,
    chartType: 'bar' as const
  },

  scatter: {
    ...CHART_DEFAULTS,
    showRegression: true,
    showDataZoom: false,
    chartType: 'scatter' as const
  },

  heatmap: {
    ...CHART_DEFAULTS,
    showValues: false,
    showDataZoom: false,
    showLegend: false,
    colorScheme: 'default' as const,
    chartType: 'heatmap' as const
  },

  area: {
    ...CHART_DEFAULTS,
    stacked: false,
    showDataZoom: true,
    chartType: 'area' as const
  },

  gauge: {
    ...CHART_DEFAULTS,
    showDataZoom: false,
    showLegend: false,
    chartType: 'gauge' as const
  }
} as const;

/**
 * Get defaults for a specific chart type
 */
export function getChartDefaults<T extends keyof typeof CHART_TYPE_DEFAULTS>(
  chartType: T
): typeof CHART_TYPE_DEFAULTS[T] {
  return CHART_TYPE_DEFAULTS[chartType];
}

/**
 * Merge custom props with defaults
 */
export function withDefaults<T extends Record<string, any>>(
  props: T,
  defaults: Partial<T> = CHART_DEFAULTS as any
): T {
  return { ...defaults, ...props };
}
