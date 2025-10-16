/**
 * Common types and interfaces for chart configurators
 */

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

export interface TimeRangeConfig {
  range: TimeRange;
  customStart?: Date;
  customEnd?: Date;
  refreshInterval?: number; // in seconds
}

export interface BaseChartConfig {
  title: string;
  timeRange: TimeRangeConfig;
  buildingSystem?: string; // HVAC, Electrical, Plumbing, etc.
  dataSource?: string;
  refreshEnabled?: boolean;
}

export interface ColorScheme {
  primary: string;
  secondary?: string;
  gradient?: boolean;
  customColors?: string[];
}

export interface AxisConfig {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  logarithmic?: boolean;
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'right' | 'bottom' | 'left';
  orientation: 'horizontal' | 'vertical';
}

export interface TooltipConfig {
  enabled: boolean;
  showPercentage?: boolean;
  showTrend?: boolean;
  customFormat?: string;
}

export interface GridConfig {
  showX: boolean;
  showY: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export type AggregationMethod = 'avg' | 'sum' | 'min' | 'max' | 'count';

export interface DataAggregation {
  method: AggregationMethod;
  interval?: string; // e.g., '5m', '1h', '1d'
}
