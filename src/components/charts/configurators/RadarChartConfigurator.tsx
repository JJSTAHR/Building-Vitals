/**
 * RadarChartConfigurator Component
 * Configuration interface for radar/spider charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, LegendConfig, DataAggregation } from './types';

export interface RadarChartConfig extends BaseChartConfig {
  metrics: string[];
  series: string[];
  legend: LegendConfig;
  aggregation: DataAggregation;
  fillOpacity: number;
  showPoints: boolean;
  pointSize: number;
  axisScale: 'linear' | 'logarithmic';
  minValue: number;
  maxValue: number;
  gridLevels: number;
  colorScheme: string[];
  normalized: boolean;
}

interface RadarChartConfiguratorProps {
  config: RadarChartConfig;
  onChange: (config: RadarChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  availableSeries: Array<{ value: string; label: string }>;
}

export const RadarChartConfigurator: React.FC<
  RadarChartConfiguratorProps
> = ({ config, onChange, availableMetrics, buildingSystems, availableSeries }) => {
  const updateConfig = (updates: Partial<RadarChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="radar-chart-configurator space-y-6 p-6">
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
          Axes (Metrics)
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
          Series to Compare
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
          {availableSeries.map((series) => (
            <label key={series.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.series.includes(series.value)}
                onChange={(e) => {
                  const newSeries = e.target.checked
                    ? [...config.series, series.value]
                    : config.series.filter((s) => s !== series.value);
                  updateConfig({ series: newSeries });
                }}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{series.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Axis Scale
        </label>
        <select
          value={config.axisScale}
          onChange={(e) =>
            updateConfig({ axisScale: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="linear">Linear</option>
          <option value="logarithmic">Logarithmic</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Value
          </label>
          <input
            type="number"
            value={config.minValue}
            onChange={(e) =>
              updateConfig({ minValue: parseFloat(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Value
          </label>
          <input
            type="number"
            value={config.maxValue}
            onChange={(e) =>
              updateConfig({ maxValue: parseFloat(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grid Levels
        </label>
        <input
          type="number"
          min="3"
          max="10"
          value={config.gridLevels}
          onChange={(e) =>
            updateConfig({ gridLevels: parseInt(e.target.value) })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showPoints}
            onChange={(e) => updateConfig({ showPoints: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Data Points</span>
        </label>
        {config.showPoints && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Point Size
            </label>
            <input
              type="range"
              min="2"
              max="10"
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
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fill Opacity
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.fillOpacity}
          onChange={(e) =>
            updateConfig({ fillOpacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {Math.round(config.fillOpacity * 100)}%
        </div>
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.normalized}
            onChange={(e) => updateConfig({ normalized: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Normalize Values (0-1 scale)
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Useful for comparing metrics with different units
        </p>
      </div>

      <div>
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
    </div>
  );
};
