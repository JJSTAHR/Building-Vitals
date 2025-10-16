/**
 * Chart Types and Metadata
 * Centralized chart type definitions with display information
 */

export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'deviationHeatmap'
  | 'boxplot'
  | 'gauge'
  | 'pie'
  | 'radar'
  | 'treemap';

export interface ChartTypeMetadata {
  id: ChartType;
  name: string;
  description: string;
  icon: string;
  category: 'time-series' | 'statistical' | 'comparison' | 'composition' | 'relationship';
  useCases: string[];
  requiresTimeRange: boolean;
  requiresMultipleMetrics?: boolean;
  requiresDimensions?: boolean;
}

export const CHART_TYPE_METADATA: Record<ChartType, ChartTypeMetadata> = {
  line: {
    id: 'line',
    name: 'Line Chart',
    description: 'Display trends over time with continuous lines',
    icon: '📈',
    category: 'time-series',
    useCases: ['Temperature trends', 'Energy consumption', 'Occupancy patterns'],
    requiresTimeRange: true,
    requiresMultipleMetrics: true,
  },
  bar: {
    id: 'bar',
    name: 'Bar Chart',
    description: 'Compare values across categories or time periods',
    icon: '📊',
    category: 'comparison',
    useCases: ['Energy by building', 'Monthly comparisons', 'System performance'],
    requiresTimeRange: true,
    requiresMultipleMetrics: true,
  },
  area: {
    id: 'area',
    name: 'Area Chart',
    description: 'Show cumulative values and trends with filled areas',
    icon: '🏔️',
    category: 'time-series',
    useCases: ['Cumulative energy', 'Stacked usage', 'Resource allocation'],
    requiresTimeRange: true,
    requiresMultipleMetrics: true,
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter Plot',
    description: 'Identify relationships and correlations between variables',
    icon: '⚫',
    category: 'relationship',
    useCases: ['Temperature vs efficiency', 'Energy vs occupancy', 'Correlation analysis'],
    requiresTimeRange: true,
  },
  heatmap: {
    id: 'heatmap',
    name: 'Heatmap',
    description: 'Visualize patterns across two dimensions with color intensity',
    icon: '🔥',
    category: 'relationship',
    useCases: ['Hour-of-day patterns', 'Building performance grid', 'Occupancy heatmap'],
    requiresTimeRange: true,
    requiresDimensions: true,
  },
  deviationHeatmap: {
    id: 'deviationHeatmap',
    name: 'Deviation Heatmap',
    description: 'Compare actual values against expected baselines',
    icon: '🎯',
    category: 'statistical',
    useCases: ['Anomaly detection', 'Baseline comparison', 'Performance deviation'],
    requiresTimeRange: true,
    requiresDimensions: true,
  },
  boxplot: {
    id: 'boxplot',
    name: 'Box Plot',
    description: 'Show statistical distribution with quartiles and outliers',
    icon: '📦',
    category: 'statistical',
    useCases: ['Temperature distribution', 'Outlier detection', 'Variance analysis'],
    requiresTimeRange: true,
  },
  gauge: {
    id: 'gauge',
    name: 'Gauge Chart',
    description: 'Display single value within a range with thresholds',
    icon: '🎚️',
    category: 'comparison',
    useCases: ['Current temperature', 'System status', 'KPI dashboard'],
    requiresTimeRange: false,
  },
  pie: {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Show composition and proportions of a whole',
    icon: '🥧',
    category: 'composition',
    useCases: ['Energy breakdown', 'System distribution', 'Resource allocation'],
    requiresTimeRange: true,
  },
  radar: {
    id: 'radar',
    name: 'Radar Chart',
    description: 'Compare multiple variables across categories',
    icon: '📡',
    category: 'comparison',
    useCases: ['Building comparison', 'System performance', 'Multi-factor analysis'],
    requiresTimeRange: true,
  },
  treemap: {
    id: 'treemap',
    name: 'Treemap',
    description: 'Display hierarchical data with nested rectangles',
    icon: '🗂️',
    category: 'composition',
    useCases: ['Energy hierarchy', 'System breakdown', 'Space allocation'],
    requiresTimeRange: true,
  },
};

export const CHART_CATEGORIES = {
  'time-series': {
    name: 'Time Series',
    description: 'Track changes and trends over time',
  },
  statistical: {
    name: 'Statistical',
    description: 'Analyze distributions and deviations',
  },
  comparison: {
    name: 'Comparison',
    description: 'Compare values across categories',
  },
  composition: {
    name: 'Composition',
    description: 'Show parts of a whole',
  },
  relationship: {
    name: 'Relationship',
    description: 'Explore correlations and patterns',
  },
} as const;
