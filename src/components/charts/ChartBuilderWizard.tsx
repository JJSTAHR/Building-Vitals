/**
 * ChartBuilderWizard Component
 *
 * A comprehensive wizard for building and configuring charts with the following steps:
 * 1. Chart Type Selection - Choose from various chart types
 * 2. Configuration - Configure chart-specific settings
 * 3. Data Selection - Select buildings and data sources
 * 4. Preview & Save - Review and save the chart configuration
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChartType, CHART_TYPE_METADATA, CHART_CATEGORIES } from './configurators/chartTypes';

// Import all configurators
import { LineChartConfigurator, type LineChartConfig } from './configurators/LineChartConfigurator';
import { BarChartConfigurator, type BarChartConfig } from './configurators/BarChartConfigurator';
import { AreaChartConfigurator, type AreaChartConfig } from './configurators/AreaChartConfigurator';
import { ScatterChartConfigurator, type ScatterChartConfig } from './configurators/ScatterChartConfigurator';
import { HeatmapConfigurator, type HeatmapConfig } from './configurators/HeatmapConfigurator';
import { BoxPlotConfigurator, type BoxPlotConfig } from './configurators/BoxPlotConfigurator';
import { GaugeChartConfigurator, type GaugeChartConfig } from './configurators/GaugeChartConfigurator';
import { PieChartConfigurator, type PieChartConfig } from './configurators/PieChartConfigurator';
import { RadarChartConfigurator, type RadarChartConfig } from './configurators/RadarChartConfigurator';
import { TreemapConfigurator, type TreemapConfig } from './configurators/TreemapConfigurator';
import { TimeRangeConfig } from './configurators/types';

// Union type for all chart configurations
export type ChartConfiguration =
  | LineChartConfig
  | BarChartConfig
  | AreaChartConfig
  | ScatterChartConfig
  | HeatmapConfig
  | BoxPlotConfig
  | GaugeChartConfig
  | PieChartConfig
  | RadarChartConfig
  | TreemapConfig
  | DeviationHeatmapConfig;

// Deviation Heatmap Config (extends HeatmapConfig)
export interface DeviationHeatmapConfig extends HeatmapConfig {
  baselineType: 'average' | 'median' | 'custom';
  baselineValue?: number;
  showDeviationScale: boolean;
  deviationThresholds: Array<{ value: number; color: string; label: string }>;
}

// Wizard props
export interface ChartBuilderWizardProps {
  onComplete: (config: WizardResult) => void;
  onCancel?: () => void;
  initialConfig?: Partial<WizardState>;
  availableBuildings?: Array<{ id: string; name: string; system: string }>;
  availableMetrics?: Array<{ value: string; label: string; unit?: string }>;
  buildingSystems?: Array<{ value: string; label: string }>;
}

export interface WizardResult {
  chartType: ChartType;
  config: ChartConfiguration;
  selectedBuildings: string[];
  dataSource: string;
  title: string;
}

interface WizardState {
  step: number;
  chartType: ChartType | null;
  config: Partial<ChartConfiguration>;
  selectedBuildings: string[];
  dataSource: string;
  title: string;
}

const WIZARD_STEPS = [
  { id: 'type', label: 'Select Chart Type', description: 'Choose the visualization type' },
  { id: 'configure', label: 'Configure Chart', description: 'Set chart-specific options' },
  { id: 'data', label: 'Select Data', description: 'Choose buildings and data sources' },
  { id: 'preview', label: 'Preview & Save', description: 'Review and save your chart' },
];

const DEFAULT_METRICS = [
  { value: 'temperature', label: 'Temperature', unit: '°F' },
  { value: 'humidity', label: 'Humidity', unit: '%' },
  { value: 'co2', label: 'CO2 Level', unit: 'ppm' },
  { value: 'energy', label: 'Energy Consumption', unit: 'kWh' },
  { value: 'occupancy', label: 'Occupancy', unit: 'people' },
];

const DEFAULT_SYSTEMS = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'plumbing', label: 'Plumbing' },
];

const DEFAULT_BUILDINGS = [
  { id: 'bldg-1', name: 'Main Office', system: 'hvac' },
  { id: 'bldg-2', name: 'West Wing', system: 'hvac' },
  { id: 'bldg-3', name: 'Data Center', system: 'electrical' },
];

const DEFAULT_DIMENSIONS = [
  { value: 'hour', label: 'Hour of Day' },
  { value: 'dayOfWeek', label: 'Day of Week' },
  { value: 'building', label: 'Building' },
  { value: 'system', label: 'System Type' },
];

export const ChartBuilderWizard: React.FC<ChartBuilderWizardProps> = ({
  onComplete,
  onCancel,
  initialConfig,
  availableBuildings = DEFAULT_BUILDINGS,
  availableMetrics = DEFAULT_METRICS,
  buildingSystems = DEFAULT_SYSTEMS,
}) => {
  const [state, setState] = useState<WizardState>({
    step: 0,
    chartType: initialConfig?.chartType || null,
    config: initialConfig?.config || {},
    selectedBuildings: initialConfig?.selectedBuildings || [],
    dataSource: initialConfig?.dataSource || '',
    title: initialConfig?.title || '',
  });

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Validation for each step
  const canProceed = useMemo(() => {
    switch (state.step) {
      case 0: // Chart type selection
        return state.chartType !== null;
      case 1: // Configuration
        return state.config && Object.keys(state.config).length > 0;
      case 2: // Data selection
        return state.selectedBuildings.length > 0 && state.title.length > 0;
      case 3: // Preview
        return true;
      default:
        return false;
    }
  }, [state.step, state.chartType, state.config, state.selectedBuildings, state.title]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (state.step < WIZARD_STEPS.length - 1) {
      updateState({ step: state.step + 1 });
    } else {
      // Complete wizard
      onComplete({
        chartType: state.chartType!,
        config: state.config as ChartConfiguration,
        selectedBuildings: state.selectedBuildings,
        dataSource: state.dataSource,
        title: state.title,
      });
    }
  }, [state, updateState, onComplete]);

  const handleBack = useCallback(() => {
    if (state.step > 0) {
      updateState({ step: state.step - 1 });
    }
  }, [state.step, updateState]);

  const handleChartTypeSelect = useCallback((chartType: ChartType) => {
    updateState({ chartType, config: getDefaultConfig(chartType) });
  }, [updateState]);

  const handleConfigChange = useCallback((config: Partial<ChartConfiguration>) => {
    updateState({ config });
  }, [updateState]);

  // Render current step content
  const renderStepContent = () => {
    switch (state.step) {
      case 0:
        return (
          <ChartTypeSelection
            selectedType={state.chartType}
            onSelect={handleChartTypeSelect}
          />
        );
      case 1:
        return (
          <ChartConfiguration
            chartType={state.chartType!}
            config={state.config}
            onChange={handleConfigChange}
            availableMetrics={availableMetrics}
            buildingSystems={buildingSystems}
          />
        );
      case 2:
        return (
          <DataSelection
            selectedBuildings={state.selectedBuildings}
            onBuildingsChange={(buildings) => updateState({ selectedBuildings: buildings })}
            availableBuildings={availableBuildings}
            title={state.title}
            onTitleChange={(title) => updateState({ title })}
            dataSource={state.dataSource}
            onDataSourceChange={(source) => updateState({ dataSource: source })}
          />
        );
      case 3:
        return (
          <PreviewStep
            chartType={state.chartType!}
            config={state.config}
            selectedBuildings={state.selectedBuildings}
            title={state.title}
            availableBuildings={availableBuildings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="chart-builder-wizard bg-white rounded-lg shadow-lg" data-testid="chart-builder-wizard">
      {/* Header */}
      <div className="wizard-header border-b border-gray-200 p-6" data-testid="wizard-header">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {WIZARD_STEPS[state.step].label}
        </h2>
        <p className="text-gray-600">{WIZARD_STEPS[state.step].description}</p>

        {/* Step indicators */}
        <div className="flex items-center justify-between mt-6" data-testid="step-indicator">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    index === state.step
                      ? 'bg-blue-600 text-white'
                      : index < state.step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index < state.step ? '✓' : index + 1}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    index === state.step ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 rounded ${
                    index < state.step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content p-6 min-h-[500px]" data-testid="wizard-content">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="wizard-navigation border-t border-gray-200 p-6 flex items-center justify-between" data-testid="wizard-navigation">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
        >
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleBack}
            disabled={state.step === 0}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state.step === WIZARD_STEPS.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Step 1: Chart Type Selection
interface ChartTypeSelectionProps {
  selectedType: ChartType | null;
  onSelect: (type: ChartType) => void;
}

const ChartTypeSelection: React.FC<ChartTypeSelectionProps> = ({ selectedType, onSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const chartsByCategory = useMemo(() => {
    const grouped: Record<string, ChartType[]> = {};
    Object.values(CHART_TYPE_METADATA).forEach((metadata) => {
      if (!grouped[metadata.category]) {
        grouped[metadata.category] = [];
      }
      grouped[metadata.category].push(metadata.id);
    });
    return grouped;
  }, []);

  const filteredCharts = useMemo(() => {
    if (!selectedCategory) {
      return Object.keys(CHART_TYPE_METADATA) as ChartType[];
    }
    return chartsByCategory[selectedCategory] || [];
  }, [selectedCategory, chartsByCategory]);

  return (
    <div className="chart-type-selection" data-testid="chart-type-step">
      {/* Category filters */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Filter by Category</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Charts
          </button>
          {Object.entries(CHART_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chart type cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCharts.map((chartType) => {
          const metadata = CHART_TYPE_METADATA[chartType];
          const isSelected = selectedType === chartType;

          return (
            <button
              key={chartType}
              onClick={() => onSelect(chartType)}
              className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-3xl mb-2">{metadata.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{metadata.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{metadata.description}</p>
              <div className="text-xs text-gray-500 italic">
                {CHART_CATEGORIES[metadata.category].name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Step 2: Chart Configuration
interface ChartConfigurationProps {
  chartType: ChartType;
  config: Partial<ChartConfiguration>;
  onChange: (config: Partial<ChartConfiguration>) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
}

const ChartConfiguration: React.FC<ChartConfigurationProps> = ({
  chartType,
  config,
  onChange,
  availableMetrics,
  buildingSystems,
}) => {
  // Render the appropriate configurator based on chart type
  const renderConfigurator = () => {
    const commonProps = {
      availableMetrics,
      buildingSystems,
      dimensions: DEFAULT_DIMENSIONS,
      groupByOptions: DEFAULT_DIMENSIONS,
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChartConfigurator
            config={config as LineChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'bar':
        return (
          <BarChartConfigurator
            config={config as BarChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'area':
        return (
          <AreaChartConfigurator
            config={config as AreaChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'scatter':
        return (
          <ScatterChartConfigurator
            config={config as ScatterChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'heatmap':
      case 'deviationHeatmap':
        return (
          <HeatmapConfigurator
            config={config as HeatmapConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'boxplot':
        return (
          <BoxPlotConfigurator
            config={config as BoxPlotConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'gauge':
        return (
          <GaugeChartConfigurator
            config={config as GaugeChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'pie':
        return (
          <PieChartConfigurator
            config={config as PieChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'radar':
        return (
          <RadarChartConfigurator
            config={config as RadarChartConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      case 'treemap':
        return (
          <TreemapConfigurator
            config={config as TreemapConfig}
            onChange={onChange as any}
            {...commonProps}
          />
        );
      default:
        return <div className="text-gray-600">Configuration not available for this chart type.</div>;
    }
  };

  return (
    <div className="chart-configuration" data-testid="configuration-step">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-900 mb-1">
          {CHART_TYPE_METADATA[chartType].icon} {CHART_TYPE_METADATA[chartType].name}
        </h3>
        <p className="text-sm text-blue-700">
          {CHART_TYPE_METADATA[chartType].description}
        </p>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {renderConfigurator()}
      </div>
    </div>
  );
};

// Step 3: Data Selection
interface DataSelectionProps {
  selectedBuildings: string[];
  onBuildingsChange: (buildings: string[]) => void;
  availableBuildings: Array<{ id: string; name: string; system: string }>;
  title: string;
  onTitleChange: (title: string) => void;
  dataSource: string;
  onDataSourceChange: (source: string) => void;
}

const DataSelection: React.FC<DataSelectionProps> = ({
  selectedBuildings,
  onBuildingsChange,
  availableBuildings,
  title,
  onTitleChange,
  dataSource,
  onDataSourceChange,
}) => {
  const handleBuildingToggle = (buildingId: string) => {
    if (selectedBuildings.includes(buildingId)) {
      onBuildingsChange(selectedBuildings.filter((id) => id !== buildingId));
    } else {
      onBuildingsChange([...selectedBuildings, buildingId]);
    }
  };

  const handleSelectAll = () => {
    onBuildingsChange(availableBuildings.map((b) => b.id));
  };

  const handleDeselectAll = () => {
    onBuildingsChange([]);
  };

  return (
    <div className="data-selection space-y-6" data-testid="data-source-step">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter a descriptive title for your chart"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="data-source-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Source (Optional)
        </label>
        <input
          type="text"
          value={dataSource}
          onChange={(e) => onDataSourceChange(e.target.value)}
          placeholder="e.g., InfluxDB, PostgreSQL, API endpoint"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Select Buildings <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto border border-gray-200 rounded-md p-4">
          {availableBuildings.map((building) => (
            <label
              key={building.id}
              className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                selectedBuildings.includes(building.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedBuildings.includes(building.id)}
                onChange={() => handleBuildingToggle(building.id)}
                className="rounded text-blue-600 focus:ring-blue-500 mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">{building.name}</div>
                <div className="text-sm text-gray-500">{building.system}</div>
              </div>
            </label>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {selectedBuildings.length} of {availableBuildings.length} buildings selected
        </p>
      </div>
    </div>
  );
};

// Step 4: Preview
interface PreviewStepProps {
  chartType: ChartType;
  config: Partial<ChartConfiguration>;
  selectedBuildings: string[];
  title: string;
  availableBuildings: Array<{ id: string; name: string; system: string }>;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  chartType,
  config,
  selectedBuildings,
  title,
  availableBuildings,
}) => {
  const selectedBuildingDetails = availableBuildings.filter((b) =>
    selectedBuildings.includes(b.id)
  );

  const metadata = CHART_TYPE_METADATA[chartType];

  return (
    <div className="preview-step space-y-6" data-testid="preview-step">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {metadata.icon} {title || 'Untitled Chart'}
        </h3>
        <p className="text-gray-700">
          <span className="font-medium">Type:</span> {metadata.name}
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Category:</span> {CHART_CATEGORIES[metadata.category].name}
        </p>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Selected Buildings</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {selectedBuildingDetails.map((building) => (
            <div
              key={building.id}
              className="px-3 py-2 bg-gray-100 rounded-md text-sm"
            >
              <div className="font-medium text-gray-900">{building.name}</div>
              <div className="text-gray-600 text-xs">{building.system}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Configuration Summary</h4>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-[300px]" data-testid="config-preview">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Click "Complete" to save this chart configuration. You can
          edit it later from the dashboard.
        </p>
      </div>
    </div>
  );
};

// Helper function to get default config for a chart type
function getDefaultConfig(chartType: ChartType): Partial<ChartConfiguration> {
  const baseTimeRange: TimeRangeConfig = {
    range: '24h',
    refreshInterval: 300,
  };

  const baseConfig = {
    title: '',
    timeRange: baseTimeRange,
    buildingSystem: '',
  };

  switch (chartType) {
    case 'line':
      return {
        ...baseConfig,
        metrics: [],
        yAxis: { label: 'Value', unit: '' },
        xAxis: { label: 'Time' },
        legend: { show: true, position: 'top', orientation: 'horizontal' },
        grid: { showX: true, showY: true, lineStyle: 'solid' },
        aggregation: { method: 'avg' },
        smooth: false,
        showPoints: true,
        lineWidth: 2,
        fillArea: false,
        colorScheme: { primary: '#3b82f6' },
      };
    case 'bar':
      return {
        ...baseConfig,
        metrics: [],
        yAxis: { label: 'Value', unit: '' },
        xAxis: { label: 'Category' },
        legend: { show: true, position: 'top', orientation: 'horizontal' },
        aggregation: { method: 'sum' },
        orientation: 'vertical',
        stacked: false,
        barWidth: 80,
        showValues: true,
        colorScheme: { primary: '#3b82f6' },
        grouping: 'category',
      };
    case 'heatmap':
    case 'deviationHeatmap':
      return {
        ...baseConfig,
        metric: '',
        xDimension: '',
        yDimension: '',
        aggregation: { method: 'avg' },
        colorScale: 'linear',
        colorScheme: 'viridis',
        minColor: '#3b82f6',
        maxColor: '#ef4444',
        showValues: false,
        cellBorders: true,
        cellPadding: 2,
        interpolation: false,
      };
    case 'boxplot':
      return {
        ...baseConfig,
        metric: '',
        groupBy: '',
        aggregation: { method: 'avg' },
        orientation: 'vertical',
        showOutliers: true,
        outlierSymbol: 'circle',
        showMean: true,
        showMedian: true,
        notched: false,
        boxWidth: 80,
        whiskerMultiplier: 1.5,
        colorByGroup: false,
        colorScheme: ['#3b82f6'],
      };
    default:
      return baseConfig;
  }
}
