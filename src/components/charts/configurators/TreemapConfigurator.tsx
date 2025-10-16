/**
 * TreemapConfigurator Component
 * Configuration interface for treemap charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, DataAggregation } from './types';

export interface TreemapConfig extends BaseChartConfig {
  metric: string;
  hierarchy: string[];
  aggregation: DataAggregation;
  colorMetric?: string;
  colorScheme: 'gradient' | 'categorical';
  colorRange: [string, string];
  tilingSche: 'squarify' | 'binary' | 'slice' | 'dice' | 'slicedice';
  showLabels: boolean;
  labelMinSize: number;
  showValues: boolean;
  borderWidth: number;
  borderColor: string;
  highlightOnHover: boolean;
  enableDrilldown: boolean;
}

interface TreemapConfiguratorProps {
  config: TreemapConfig;
  onChange: (config: TreemapConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  hierarchyOptions: Array<{ value: string; label: string }>;
}

export const TreemapConfigurator: React.FC<TreemapConfiguratorProps> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
  hierarchyOptions,
}) => {
  const updateConfig = (updates: Partial<TreemapConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateHierarchy = (index: number, value: string) => {
    const newHierarchy = [...config.hierarchy];
    newHierarchy[index] = value;
    updateConfig({ hierarchy: newHierarchy });
  };

  const addHierarchyLevel = () => {
    updateConfig({ hierarchy: [...config.hierarchy, ''] });
  };

  const removeHierarchyLevel = (index: number) => {
    updateConfig({
      hierarchy: config.hierarchy.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="treemap-configurator space-y-6 p-6">
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
          Size Metric
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
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Hierarchy Levels
          </label>
          <button
            type="button"
            onClick={addHierarchyLevel}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Level
          </button>
        </div>
        <div className="space-y-2">
          {config.hierarchy.map((level, index) => (
            <div key={index} className="flex gap-2">
              <select
                value={level}
                onChange={(e) => updateHierarchy(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select level {index + 1}...</option>
                {hierarchyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {config.hierarchy.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeHierarchyLevel(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-800 border border-gray-300 rounded-md"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color Metric (Optional)
        </label>
        <select
          value={config.colorMetric || ''}
          onChange={(e) =>
            updateConfig({ colorMetric: e.target.value || undefined })
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
          Color Scheme
        </label>
        <select
          value={config.colorScheme}
          onChange={(e) =>
            updateConfig({ colorScheme: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="gradient">Gradient</option>
          <option value="categorical">Categorical</option>
        </select>
      </div>

      {config.colorScheme === 'gradient' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Color
            </label>
            <input
              type="color"
              value={config.colorRange[0]}
              onChange={(e) =>
                updateConfig({
                  colorRange: [e.target.value, config.colorRange[1]],
                })
              }
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Color
            </label>
            <input
              type="color"
              value={config.colorRange[1]}
              onChange={(e) =>
                updateConfig({
                  colorRange: [config.colorRange[0], e.target.value],
                })
              }
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tiling Algorithm
        </label>
        <select
          value={config.tilingScheme}
          onChange={(e) =>
            updateConfig({ tilingScheme: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="squarify">Squarify (aspect ratio optimized)</option>
          <option value="binary">Binary</option>
          <option value="slice">Slice (horizontal)</option>
          <option value="dice">Dice (vertical)</option>
          <option value="slicedice">Slice-Dice (alternating)</option>
        </select>
      </div>

      <div className="space-y-3">
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
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Cell Size for Label (px)
            </label>
            <input
              type="number"
              min="20"
              max="200"
              value={config.labelMinSize}
              onChange={(e) =>
                updateConfig({ labelMinSize: parseInt(e.target.value) })
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
            checked={config.showValues}
            onChange={(e) => updateConfig({ showValues: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Values</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.highlightOnHover}
            onChange={(e) =>
              updateConfig({ highlightOnHover: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Highlight on Hover</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.enableDrilldown}
            onChange={(e) =>
              updateConfig({ enableDrilldown: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Enable Drilldown Navigation
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Border Width
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          value={config.borderWidth}
          onChange={(e) =>
            updateConfig({ borderWidth: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.borderWidth}px
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Border Color
        </label>
        <input
          type="color"
          value={config.borderColor}
          onChange={(e) => updateConfig({ borderColor: e.target.value })}
          className="w-full h-10 border border-gray-300 rounded-md"
        />
      </div>
    </div>
  );
};
