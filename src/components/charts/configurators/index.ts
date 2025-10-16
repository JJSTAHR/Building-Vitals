/**
 * Chart Configurators Index
 * Central export point for all chart configuration components
 */

export * from './types';
export * from './chartTypes';
export { TimeRangeSelector } from './TimeRangeSelector';
export { LineChartConfigurator } from './LineChartConfigurator';
export type { LineChartConfig } from './LineChartConfigurator';
export { BarChartConfigurator } from './BarChartConfigurator';
export type { BarChartConfig } from './BarChartConfigurator';
export { PieChartConfigurator } from './PieChartConfigurator';
export type { PieChartConfig } from './PieChartConfigurator';
export { AreaChartConfigurator } from './AreaChartConfigurator';
export type { AreaChartConfig } from './AreaChartConfigurator';
export { ScatterChartConfigurator } from './ScatterChartConfigurator';
export type { ScatterChartConfig } from './ScatterChartConfigurator';
export { HeatmapConfigurator } from './HeatmapConfigurator';
export type { HeatmapConfig } from './HeatmapConfigurator';
export { BoxPlotConfigurator } from './BoxPlotConfigurator';
export type { BoxPlotConfig } from './BoxPlotConfigurator';
export { RadarChartConfigurator } from './RadarChartConfigurator';
export type { RadarChartConfig } from './RadarChartConfigurator';
export { GaugeChartConfigurator } from './GaugeChartConfigurator';
export type { GaugeChartConfig } from './GaugeChartConfigurator';
export { TreemapConfigurator } from './TreemapConfigurator';
export type { TreemapConfig } from './TreemapConfigurator';

// Keep existing BoxPlotAggregation export
export {
  BoxPlotAggregationConfigurator,
  type ConfigStepProps
} from './BoxPlotAggregationConfigurator';

// Chart type registry for dynamic configuration
// Note: chartTypes module provides comprehensive metadata
export const CHART_CONFIGURATORS = {
  line: LineChartConfigurator,
  bar: BarChartConfigurator,
  pie: PieChartConfigurator,
  area: AreaChartConfigurator,
  scatter: ScatterChartConfigurator,
  heatmap: HeatmapConfigurator,
  deviationHeatmap: HeatmapConfigurator, // Use same configurator with extended config
  boxplot: BoxPlotConfigurator,
  radar: RadarChartConfigurator,
  gauge: GaugeChartConfigurator,
  treemap: TreemapConfigurator,
} as const;

// Helper function to get configurator by chart type
export function getChartConfigurator(chartType: string) {
  return CHART_CONFIGURATORS[chartType as keyof typeof CHART_CONFIGURATORS];
}
