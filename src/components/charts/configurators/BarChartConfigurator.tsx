/**
 * BarChartConfigurator Component
 * Configuration interface for bar charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import {
  BaseChartConfig,
  AxisConfig,
  LegendConfig,
  DataAggregation,
  ColorScheme,
} from './types';

export interface BarChartConfig extends BaseChartConfig {
  metrics: string[];
  yAxis: AxisConfig;
  xAxis: AxisConfig;
  legend: LegendConfig;
  aggregation: DataAggregation;
  orientation: 'vertical' | 'horizontal';
  stacked: boolean;
  barWidth: number;
  showValues: boolean;
  colorScheme: ColorScheme;
  grouping: 'category' | 'time' | 'system';
}

interface BarChartConfiguratorProps {
  config: BarChartConfig;
  onChange: (config: BarChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
}

export const BarChartConfigurator: React.FC<BarChartConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
}) => {
  const updateConfig = (updates: Partial<BarChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="bar-chart-configurator space-y-6 p-6">
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
          Metrics to Display
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
          {availableMetrics.map((metric) => (
            <label key={metric.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.metrics.includes(metric.value)}
                onChange={(e) => {
                  const newMetrics = e.target.checked
                    ? [...config.metrics, metric.value]
                    : config.metrics.filter((m) => m !== metric.value);
                  updateConfig({ metrics: newMetrics });
                }}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{metric.label}</span>
            </label>
          ))}
        </div>
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grouping Method
        </label>
        <select
          value={config.grouping}
          onChange={(e) =>
            updateConfig({ grouping: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="category">By Category</option>
          <option value="time">By Time Period</option>
          <option value="system">By Building System</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Aggregation
        </label>
        <div className="grid grid-cols-2 gap-4">
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
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="avg">Average</option>
            <option value="sum">Sum</option>
            <option value="min">Minimum</option>
            <option value="max">Maximum</option>
            <option value="count">Count</option>
          </select>
          <input
            type="text"
            value={config.aggregation.interval || ''}
            onChange={(e) =>
              updateConfig({
                aggregation: {
                  ...config.aggregation,
                  interval: e.target.value,
                },
              })
            }
            placeholder="e.g., 1h, 1d"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.stacked}
            onChange={(e) => updateConfig({ stacked: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Stacked Bars</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showValues}
            onChange={(e) => updateConfig({ showValues: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Values on Bars</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.legend.show}
            onChange={(e) =>
              updateConfig({
                legend: { ...config.legend, show: e.target.checked },
              })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Legend</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bar Width (%)
        </label>
        <input
          type="range"
          min="20"
          max="100"
          step="5"
          value={config.barWidth}
          onChange={(e) =>
            updateConfig({ barWidth: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.barWidth}%
        </div>
      </div>
    </div>
  );
};
