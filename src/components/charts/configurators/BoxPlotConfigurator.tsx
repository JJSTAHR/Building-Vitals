/**
 * BoxPlotConfigurator Component
 * Configuration interface for box and whisker plots
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, DataAggregation } from './types';

export interface BoxPlotConfig extends BaseChartConfig {
  metric: string;
  groupBy: string;
  aggregation: DataAggregation;
  orientation: 'vertical' | 'horizontal';
  showOutliers: boolean;
  outlierSymbol: 'circle' | 'diamond' | 'square';
  showMean: boolean;
  showMedian: boolean;
  notched: boolean;
  boxWidth: number;
  whiskerMultiplier: number;
  colorByGroup: boolean;
  colorScheme: string[];
}

interface BoxPlotConfiguratorProps {
  config: BoxPlotConfig;
  onChange: (config: BoxPlotConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  groupByOptions: Array<{ value: string; label: string }>;
}

export const BoxPlotConfigurator: React.FC<BoxPlotConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
  groupByOptions,
}) => {
  const updateConfig = (updates: Partial<BoxPlotConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="boxplot-configurator space-y-6 p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter chart title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Building System
        </label>
        <select
          value={config.buildingSystem || ''}
          onChange={(e) => updateConfig({ buildingSystem: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Systems</option>
          {buildingSystems.map((system) => (
            <option key={system.value} value={system.value}>
              {system.label}
            </option>
          ))}
        </select>
      </div>

      <TimeRangeSelector
        value={config.timeRange}
        onChange={(timeRange) => updateConfig({ timeRange })}
        showRefreshInterval={false}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Metric
        </label>
        <select
          value={config.metric}
          onChange={(e) => updateConfig({ metric: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select metric...</option>
          {availableMetrics.map((metric) => (
            <option key={metric.value} value={metric.value}>
              {metric.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Group By
        </label>
        <select
          value={config.groupBy}
          onChange={(e) => updateConfig({ groupBy: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select grouping...</option>
          {groupByOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Orientation
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateConfig({ orientation: 'vertical' })}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              config.orientation === 'vertical'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Vertical
          </button>
          <button
            type="button"
            onClick={() => updateConfig({ orientation: 'horizontal' })}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              config.orientation === 'horizontal'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Horizontal
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showOutliers}
            onChange={(e) => updateConfig({ showOutliers: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Outliers</span>
        </label>
        {config.showOutliers && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outlier Symbol
            </label>
            <select
              value={config.outlierSymbol}
              onChange={(e) =>
                updateConfig({ outlierSymbol: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="circle">Circle</option>
              <option value="diamond">Diamond</option>
              <option value="square">Square</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showMean}
            onChange={(e) => updateConfig({ showMean: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Mean Line</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showMedian}
            onChange={(e) => updateConfig({ showMedian: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Median Line</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.notched}
            onChange={(e) => updateConfig({ notched: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Notched Box Plot</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.colorByGroup}
            onChange={(e) => updateConfig({ colorByGroup: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Color by Group</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Box Width (%)
        </label>
        <input
          type="range"
          min="20"
          max="100"
          step="5"
          value={config.boxWidth}
          onChange={(e) =>
            updateConfig({ boxWidth: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.boxWidth}%
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Whisker Multiplier (IQR)
        </label>
        <input
          type="number"
          min="0.5"
          max="3"
          step="0.5"
          value={config.whiskerMultiplier}
          onChange={(e) =>
            updateConfig({ whiskerMultiplier: parseFloat(e.target.value) })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Standard value is 1.5. Higher values show more extreme outliers.
        </p>
      </div>
    </div>
  );
};
