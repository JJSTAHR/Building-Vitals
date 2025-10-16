/**
 * PieChartConfigurator Component
 * Configuration interface for pie/donut charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, LegendConfig, DataAggregation } from './types';

export interface PieChartConfig extends BaseChartConfig {
  metric: string;
  groupBy: string;
  legend: LegendConfig;
  aggregation: DataAggregation;
  donutMode: boolean;
  innerRadius: number;
  showPercentages: boolean;
  showLabels: boolean;
  labelPosition: 'inside' | 'outside';
  colorScheme: string[];
  sortOrder: 'ascending' | 'descending' | 'none';
  maxSlices: number;
  combineSmallSlices: boolean;
  smallSliceThreshold: number;
}

interface PieChartConfiguratorProps {
  config: PieChartConfig;
  onChange: (config: PieChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  groupByOptions: Array<{ value: string; label: string }>;
}

export const PieChartConfigurator: React.FC<PieChartConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
  groupByOptions,
}) => {
  const updateConfig = (updates: Partial<PieChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="pie-chart-configurator space-y-6 p-6">
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
          <option value="sum">Sum</option>
          <option value="avg">Average</option>
          <option value="count">Count</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.donutMode}
            onChange={(e) => updateConfig({ donutMode: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Donut Mode</span>
        </label>
        {config.donutMode && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inner Radius (%)
            </label>
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={config.innerRadius}
              onChange={(e) =>
                updateConfig({ innerRadius: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500 text-center">
              {config.innerRadius}%
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showPercentages}
            onChange={(e) =>
              updateConfig({ showPercentages: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Percentages</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showLabels}
            onChange={(e) => updateConfig({ showLabels: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Labels</span>
        </label>
        {config.showLabels && (
          <div className="ml-6 space-x-2">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={config.labelPosition === 'inside'}
                onChange={() => updateConfig({ labelPosition: 'inside' })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Inside</span>
            </label>
            <label className="inline-flex items-center ml-4">
              <input
                type="radio"
                checked={config.labelPosition === 'outside'}
                onChange={() => updateConfig({ labelPosition: 'outside' })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Outside</span>
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort Order
        </label>
        <select
          value={config.sortOrder}
          onChange={(e) =>
            updateConfig({ sortOrder: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="none">None</option>
          <option value="ascending">Ascending</option>
          <option value="descending">Descending</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maximum Slices
        </label>
        <input
          type="number"
          min="3"
          max="20"
          value={config.maxSlices}
          onChange={(e) =>
            updateConfig({ maxSlices: parseInt(e.target.value) })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.combineSmallSlices}
            onChange={(e) =>
              updateConfig({ combineSmallSlices: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Combine Small Slices into "Other"
          </span>
        </label>
        {config.combineSmallSlices && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Small Slice Threshold (%)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              step="0.5"
              value={config.smallSliceThreshold}
              onChange={(e) =>
                updateConfig({
                  smallSliceThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
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
        {config.legend.show && (
          <div className="mt-2 ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Legend Position
            </label>
            <select
              value={config.legend.position}
              onChange={(e) =>
                updateConfig({
                  legend: {
                    ...config.legend,
                    position: e.target.value as any,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="top">Top</option>
              <option value="right">Right</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
