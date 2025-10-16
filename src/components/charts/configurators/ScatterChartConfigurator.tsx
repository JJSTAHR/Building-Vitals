/**
 * ScatterChartConfigurator Component
 * Configuration interface for scatter plots
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import {
  BaseChartConfig,
  AxisConfig,
  LegendConfig,
  GridConfig,
  ColorScheme,
} from './types';

export interface ScatterChartConfig extends BaseChartConfig {
  xMetric: string;
  yMetric: string;
  sizeMetric?: string;
  colorMetric?: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  legend: LegendConfig;
  grid: GridConfig;
  pointSize: number;
  pointOpacity: number;
  showTrendLine: boolean;
  trendLineType: 'linear' | 'polynomial' | 'exponential';
  colorScheme: ColorScheme;
  clusterAnalysis: boolean;
  highlightOutliers: boolean;
  outlierThreshold: number;
}

interface ScatterChartConfiguratorProps {
  config: ScatterChartConfig;
  onChange: (config: ScatterChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
}

export const ScatterChartConfigurator: React.FC<
  ScatterChartConfiguratorProps
> = ({ config, onChange, availableMetrics, buildingSystems }) => {
  const updateConfig = (updates: Partial<ScatterChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="scatter-chart-configurator space-y-6 p-6">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            X-Axis Metric
          </label>
          <select
            value={config.xMetric}
            onChange={(e) => updateConfig({ xMetric: e.target.value })}
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
            Y-Axis Metric
          </label>
          <select
            value={config.yMetric}
            onChange={(e) => updateConfig({ yMetric: e.target.value })}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            X-Axis Label
          </label>
          <input
            type="text"
            value={config.xAxis.label}
            onChange={(e) =>
              updateConfig({
                xAxis: { ...config.xAxis, label: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Size Metric (Optional)
          </label>
          <select
            value={config.sizeMetric || ''}
            onChange={(e) =>
              updateConfig({
                sizeMetric: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None</option>
            {availableMetrics.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color Metric (Optional)
          </label>
          <select
            value={config.colorMetric || ''}
            onChange={(e) =>
              updateConfig({
                colorMetric: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None</option>
            {availableMetrics.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Point Size
        </label>
        <input
          type="range"
          min="2"
          max="20"
          step="1"
          value={config.pointSize}
          onChange={(e) =>
            updateConfig({ pointSize: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.pointSize}px
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Point Opacity
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.pointOpacity}
          onChange={(e) =>
            updateConfig({ pointOpacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {Math.round(config.pointOpacity * 100)}%
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showTrendLine}
            onChange={(e) =>
              updateConfig({ showTrendLine: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Trend Line</span>
        </label>
        {config.showTrendLine && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trend Line Type
            </label>
            <select
              value={config.trendLineType}
              onChange={(e) =>
                updateConfig({ trendLineType: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="linear">Linear</option>
              <option value="polynomial">Polynomial</option>
              <option value="exponential">Exponential</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.clusterAnalysis}
            onChange={(e) =>
              updateConfig({ clusterAnalysis: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Enable Cluster Analysis</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.highlightOutliers}
            onChange={(e) =>
              updateConfig({ highlightOutliers: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Highlight Outliers</span>
        </label>
        {config.highlightOutliers && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outlier Threshold (Standard Deviations)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.5"
              value={config.outlierThreshold}
              onChange={(e) =>
                updateConfig({
                  outlierThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
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
    </div>
  );
};
