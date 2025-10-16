/**
 * Chart Tooltip Formatter Utility
 *
 * Provides standardized tooltip formatting for all chart types in the Building Vitals system.
 * Ensures consistent value display, number formatting, and theme-aware styling.
 */

import { formatNumberForDisplay } from './formatNumberForDisplay';

/**
 * Chart type categories for tooltip formatting
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'pie'
  | 'treemap'
  | 'box'
  | 'radar'
  | 'gauge';

/**
 * Tooltip data point interface
 */
export interface TooltipDataPoint {
  /** Series name or label */
  seriesName?: string;
  /** Data point name/label */
  name?: string;
  /** Primary value */
  value: number | number[] | null;
  /** Unit of measurement */
  unit?: string;
  /** Deviation value (e.g., standard deviation) */
  deviation?: number;
  /** Percentage value (e.g., percentage of total) */
  percentage?: number;
  /** Color marker for the series */
  color?: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Tooltip formatter options
 */
export interface TooltipFormatterOptions {
  /** Chart type for appropriate formatting */
  chartType: ChartType;
  /** Theme mode for styling */
  theme?: 'light' | 'dark';
  /** Custom title for the tooltip */
  title?: string;
  /** Show percentage values */
  showPercentage?: boolean;
  /** Show deviation values */
  showDeviation?: boolean;
  /** Decimal places for number formatting */
  decimalPlaces?: number;
  /** Custom formatter function for specific values */
  customValueFormatter?: (value: number) => string;
  /** Include series markers */
  showMarkers?: boolean;
}

/**
 * Generate HTML marker with color
 */
function createMarker(color: string): string {
  return `<span style="display:inline-block;margin-right:4px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
}

/**
 * Format a single value with unit
 */
function formatValue(
  value: number,
  unit?: string,
  decimalPlaces?: number,
  customFormatter?: (value: number) => string
): string {
  if (customFormatter) {
    return customFormatter(value);
  }

  const formattedValue = formatNumberForDisplay(value, decimalPlaces);
  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

/**
 * Format deviation value
 */
function formatDeviation(deviation: number, unit?: string): string {
  const formattedDev = formatNumberForDisplay(deviation);
  return unit ? `± ${formattedDev} ${unit}` : `± ${formattedDev}`;
}

/**
 * Format percentage value
 */
function formatPercentage(percentage: number): string {
  return `(${formatNumberForDisplay(percentage, 1)}%)`;
}

/**
 * Format tooltip for simple value charts (line, bar, area)
 */
function formatSimpleTooltip(
  dataPoint: TooltipDataPoint,
  options: TooltipFormatterOptions
): string {
  const { value, seriesName, name, color, unit, deviation, percentage } = dataPoint;
  const { showMarkers, showDeviation, showPercentage, decimalPlaces, customValueFormatter } = options;

  if (value === null || value === undefined) {
    return '<div style="padding:8px;">No data</div>';
  }

  const numValue = typeof value === 'number' ? value : value[0];
  const marker = showMarkers && color ? createMarker(color) : '';
  const formattedValue = formatValue(numValue, unit, decimalPlaces, customValueFormatter);
  const deviationText = showDeviation && deviation !== undefined
    ? ` ${formatDeviation(deviation, unit)}`
    : '';
  const percentageText = showPercentage && percentage !== undefined
    ? ` ${formatPercentage(percentage)}`
    : '';

  const label = seriesName || name || 'Value';

  return `${marker}<strong>${label}:</strong> ${formattedValue}${deviationText}${percentageText}`;
}

/**
 * Format tooltip for multi-dimensional charts (scatter, heatmap)
 */
function formatMultiDimensionalTooltip(
  dataPoint: TooltipDataPoint,
  options: TooltipFormatterOptions
): string {
  const { value, name, color, unit } = dataPoint;
  const { showMarkers, decimalPlaces, customValueFormatter, chartType } = options;

  if (!Array.isArray(value) || value.length === 0) {
    return '<div style="padding:8px;">No data</div>';
  }

  const marker = showMarkers && color ? createMarker(color) : '';
  const label = name || 'Point';

  let content = `${marker}<strong>${label}</strong><br/>`;

  if (chartType === 'scatter') {
    const [x, y] = value;
    content += `X: ${formatValue(x, unit, decimalPlaces, customValueFormatter)}<br/>`;
    content += `Y: ${formatValue(y, unit, decimalPlaces, customValueFormatter)}`;
  } else if (chartType === 'heatmap') {
    const [x, y, heatValue] = value;
    content += `Row: ${x}<br/>`;
    content += `Column: ${y}<br/>`;
    content += `Value: ${formatValue(heatValue, unit, decimalPlaces, customValueFormatter)}`;
  }

  return content;
}

/**
 * Format tooltip for box plot charts
 */
function formatBoxPlotTooltip(
  dataPoint: TooltipDataPoint,
  options: TooltipFormatterOptions
): string {
  const { value, name, unit } = dataPoint;
  const { decimalPlaces, customValueFormatter } = options;

  if (!Array.isArray(value) || value.length < 5) {
    return '<div style="padding:8px;">Invalid box plot data</div>';
  }

  const [min, q1, median, q3, max] = value;
  const label = name || 'Distribution';

  return `
    <strong>${label}</strong><br/>
    Max: ${formatValue(max, unit, decimalPlaces, customValueFormatter)}<br/>
    Q3: ${formatValue(q3, unit, decimalPlaces, customValueFormatter)}<br/>
    Median: ${formatValue(median, unit, decimalPlaces, customValueFormatter)}<br/>
    Q1: ${formatValue(q1, unit, decimalPlaces, customValueFormatter)}<br/>
    Min: ${formatValue(min, unit, decimalPlaces, customValueFormatter)}
  `;
}

/**
 * Format tooltip for proportional charts (pie, treemap)
 */
function formatProportionalTooltip(
  dataPoint: TooltipDataPoint,
  options: TooltipFormatterOptions
): string {
  const { value, name, color, unit, percentage } = dataPoint;
  const { showMarkers, decimalPlaces, customValueFormatter } = options;

  if (value === null || value === undefined) {
    return '<div style="padding:8px;">No data</div>';
  }

  const numValue = typeof value === 'number' ? value : value[0];
  const marker = showMarkers && color ? createMarker(color) : '';
  const formattedValue = formatValue(numValue, unit, decimalPlaces, customValueFormatter);
  const percentageText = percentage !== undefined ? ` ${formatPercentage(percentage)}` : '';

  const label = name || 'Category';

  return `${marker}<strong>${label}:</strong> ${formattedValue}${percentageText}`;
}

/**
 * Main tooltip formatter function
 *
 * Creates standardized, theme-aware tooltips for all chart types
 *
 * @param dataPoints - Array of data points to display in tooltip
 * @param options - Formatting options
 * @returns Formatted HTML string for tooltip
 *
 * @example
 * ```typescript
 * // Simple line chart tooltip
 * const tooltip = formatChartTooltip(
 *   [{ seriesName: 'Temperature', value: 72.5, unit: '°F', color: '#FF6384' }],
 *   { chartType: 'line', theme: 'dark', showMarkers: true }
 * );
 *
 * // Scatter plot tooltip
 * const scatterTooltip = formatChartTooltip(
 *   [{ name: 'Point A', value: [10, 20], unit: 'units', color: '#36A2EB' }],
 *   { chartType: 'scatter', showMarkers: true }
 * );
 * ```
 */
export function formatChartTooltip(
  dataPoints: TooltipDataPoint | TooltipDataPoint[],
  options: TooltipFormatterOptions
): string {
  const {
    chartType,
    theme = 'light',
    title,
    showMarkers = true,
    showPercentage = false,
    showDeviation = false,
    decimalPlaces = 2
  } = options;

  // Ensure dataPoints is an array
  const points = Array.isArray(dataPoints) ? dataPoints : [dataPoints];

  // Theme-aware styling
  const backgroundColor = theme === 'dark' ? '#1f2937' : '#ffffff';
  const textColor = theme === 'dark' ? '#f9fafb' : '#111827';
  const borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';

  // Build tooltip HTML
  let html = `
    <div style="
      background-color: ${backgroundColor};
      color: ${textColor};
      border: 1px solid ${borderColor};
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      font-size: 14px;
      line-height: 1.5;
      min-width: 150px;
    ">
  `;

  // Add title if provided
  if (title) {
    html += `<div style="font-weight: 600; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid ${borderColor};">${title}</div>`;
  }

  // Format each data point based on chart type
  const formattedPoints = points.map(point => {
    const enhancedOptions = {
      ...options,
      showMarkers,
      showPercentage,
      showDeviation,
      decimalPlaces
    };

    switch (chartType) {
      case 'line':
      case 'bar':
      case 'area':
      case 'radar':
      case 'gauge':
        return formatSimpleTooltip(point, enhancedOptions);

      case 'scatter':
      case 'heatmap':
        return formatMultiDimensionalTooltip(point, enhancedOptions);

      case 'box':
        return formatBoxPlotTooltip(point, enhancedOptions);

      case 'pie':
      case 'treemap':
        return formatProportionalTooltip(point, enhancedOptions);

      default:
        return formatSimpleTooltip(point, enhancedOptions);
    }
  });

  // Join formatted points
  html += formattedPoints.join('<br/>');
  html += '</div>';

  return html;
}

/**
 * Create a tooltip formatter function for ECharts
 *
 * Returns a function compatible with ECharts tooltip.formatter option
 *
 * @param options - Base formatting options
 * @returns ECharts-compatible formatter function
 *
 * @example
 * ```typescript
 * const option = {
 *   tooltip: {
 *     trigger: 'axis',
 *     formatter: createEChartsTooltipFormatter({
 *       chartType: 'line',
 *       theme: 'dark',
 *       showMarkers: true,
 *       unit: '°F'
 *     })
 *   }
 * };
 * ```
 */
export function createEChartsTooltipFormatter(
  options: Omit<TooltipFormatterOptions, 'title'>
) {
  return (params: any) => {
    // Handle single data point or array of data points
    const dataPoints = Array.isArray(params) ? params : [params];

    // Extract title from first param if available
    const title = dataPoints[0]?.axisValueLabel || dataPoints[0]?.name;

    // Convert ECharts params to TooltipDataPoint format
    const formattedPoints: TooltipDataPoint[] = dataPoints.map((param: any) => ({
      seriesName: param.seriesName,
      name: param.name,
      value: param.value,
      color: param.color,
      unit: options.unit,
      percentage: param.percent,
      ...param.data // Include any additional data
    }));

    return formatChartTooltip(formattedPoints, {
      ...options,
      title
    });
  };
}

/**
 * Utility function to extract percentage from total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Utility function to format time-based tooltip titles
 */
export function formatTimeTitle(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
