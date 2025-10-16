/**
 * HeatmapConfigurator Component
 * Configuration interface for heatmap charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, DataAggregation } from './types';

export interface HeatmapConfig extends BaseChartConfig {
  metric: string;
  xDimension: string;
  yDimension: string;
  aggregation: DataAggregation;
  colorScale: 'linear' | 'logarithmic' | 'quantile';
  colorScheme: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'viridis';
  minColor: string;
  maxColor: string;
  showValues: boolean;
  cellBorders: boolean;
  cellPadding: number;
  interpolation: boolean;
  thresholds?: Array<{ value: number; color: string }>;
}

interface HeatmapConfiguratorProps {
  config: HeatmapConfig;
  onChange: (config: HeatmapConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  dimensions: Array<{ value: string; label: string }>;
}

export const HeatmapConfigurator: React.FC<HeatmapConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
  dimensions,
}) => {
  const updateConfig = (updates: Partial<HeatmapConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="heatmap-configurator space-y-6 p-6">
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
        showRefreshInterval={true}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            X-Axis Dimension
          </label>
          <select
            value={config.xDimension}
            onChange={(e) => updateConfig({ xDimension: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select dimension...</option>
            {dimensions.map((dim) => (
              <option key={dim.value} value={dim.value}>
                {dim.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Y-Axis Dimension
          </label>
          <select
            value={config.yDimension}
            onChange={(e) => updateConfig({ yDimension: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select dimension...</option>
            {dimensions.map((dim) => (
              <option key={dim.value} value={dim.value}>
                {dim.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Aggregation
        </label>
        <select
          value={config.aggregation.method}
          onChange={(e) =>
            updateConfig({
              aggregation: {
                ...config.aggregation,
                method: e.target.value as any,
              },
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="avg">Average</option>
          <option value="sum">Sum</option>
          <option value="min">Minimum</option>
          <option value="max">Maximum</option>
          <option value="count">Count</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color Scale Type
        </label>
        <select
          value={config.colorScale}
          onChange={(e) =>
            updateConfig({ colorScale: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="linear">Linear</option>
          <option value="logarithmic">Logarithmic</option>
          <option value="quantile">Quantile</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color Scheme
        </label>
        <select
          value={config.colorScheme}
          onChange={(e) =>
            updateConfig({ colorScheme: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="red">Red</option>
          <option value="yellow">Yellow</option>
          <option value="purple">Purple</option>
          <option value="viridis">Viridis</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Value Color
          </label>
          <input
            type="color"
            value={config.minColor}
            onChange={(e) => updateConfig({ minColor: e.target.value })}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Value Color
          </label>
          <input
            type="color"
            value={config.maxColor}
            onChange={(e) => updateConfig({ maxColor: e.target.value })}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showValues}
            onChange={(e) => updateConfig({ showValues: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Values in Cells</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.cellBorders}
            onChange={(e) => updateConfig({ cellBorders: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Cell Borders</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.interpolation}
            onChange={(e) => updateConfig({ interpolation: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Smooth Interpolation (for continuous data)
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cell Padding
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={config.cellPadding}
          onChange={(e) =>
            updateConfig({ cellPadding: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.cellPadding}px
        </div>
      </div>
    </div>
  );
};
