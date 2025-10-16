/**
 * LineChartConfigurator Component
 * Configuration interface for line charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import {
  BaseChartConfig,
  AxisConfig,
  LegendConfig,
  GridConfig,
  DataAggregation,
  ColorScheme,
} from './types';

export interface LineChartConfig extends BaseChartConfig {
  metrics: string[];
  yAxis: AxisConfig;
  xAxis: AxisConfig;
  legend: LegendConfig;
  grid: GridConfig;
  aggregation: DataAggregation;
  smooth: boolean;
  showPoints: boolean;
  lineWidth: number;
  fillArea: boolean;
  colorScheme: ColorScheme;
  thresholds?: Array<{ value: number; label: string; color: string }>;
}

interface LineChartConfiguratorProps {
  config: LineChartConfig;
  onChange: (config: LineChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
}

export const LineChartConfigurator: React.FC<LineChartConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
}) => {
  const updateConfig = (updates: Partial<LineChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="line-chart-configurator space-y-6 p-6">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Y-Axis Label
          </label>
          <input
            type="text"
            value={config.yAxis.label}
            onChange={(e) =>
              updateConfig({
                yAxis: { ...config.yAxis, label: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unit
          </label>
          <input
            type="text"
            value={config.yAxis.unit || ''}
            onChange={(e) =>
              updateConfig({
                yAxis: { ...config.yAxis, unit: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., °F, kW"
          />
        </div>
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
            placeholder="e.g., 5m, 1h"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.smooth}
            onChange={(e) => updateConfig({ smooth: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Smooth Lines</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showPoints}
            onChange={(e) => updateConfig({ showPoints: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Data Points</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.fillArea}
            onChange={(e) => updateConfig({ fillArea: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Fill Area Under Line</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.grid.showX}
            onChange={(e) =>
              updateConfig({
                grid: { ...config.grid, showX: e.target.checked },
              })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show X-Axis Grid</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.grid.showY}
            onChange={(e) =>
              updateConfig({
                grid: { ...config.grid, showY: e.target.checked },
              })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Y-Axis Grid</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Line Width
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={config.lineWidth}
          onChange={(e) =>
            updateConfig({ lineWidth: parseFloat(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.lineWidth}px
        </div>
      </div>
    </div>
  );
};
