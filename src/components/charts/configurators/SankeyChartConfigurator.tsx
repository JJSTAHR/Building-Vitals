/**
 * SankeyChartConfigurator Component
 * Configuration interface for Sankey flow diagrams
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, DataAggregation } from './types';

export interface SankeyChartConfig extends BaseChartConfig {
  metric: string;
  sourceField: string;
  targetField: string;
  aggregation: DataAggregation;
  nodeWidth: number;
  nodePadding: number;
  nodeAlignment: 'left' | 'right' | 'center' | 'justify';
  linkOpacity: number;
  showValues: boolean;
  valuePosition: 'node' | 'link' | 'both';
  colorScheme: 'category' | 'gradient' | 'custom';
  customColors: { [key: string]: string };
  highlightConnected: boolean;
  enableInteraction: boolean;
  minLinkThreshold: number;
  sortNodes: 'auto' | 'manual' | 'alphabetical';
}

interface SankeyChartConfiguratorProps {
  config: SankeyChartConfig;
  onChange: (config: SankeyChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  flowFields: Array<{ value: string; label: string }>;
}

export const SankeyChartConfigurator: React.FC<
  SankeyChartConfiguratorProps
> = ({ config, onChange, availableMetrics, buildingSystems, flowFields }) => {
  const updateConfig = (updates: Partial<SankeyChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="sankey-chart-configurator space-y-6 p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Energy Flow Diagram"
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
          Flow Metric
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
        <p className="text-xs text-gray-500 mt-1">
          The metric that determines link thickness (e.g., energy, water flow)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source Field
          </label>
          <select
            value={config.sourceField}
            onChange={(e) => updateConfig({ sourceField: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select source...</option>
            {flowFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Field
          </label>
          <select
            value={config.targetField}
            onChange={(e) => updateConfig({ targetField: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select target...</option>
            {flowFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
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
          <option value="sum">Sum (total flow)</option>
          <option value="avg">Average</option>
          <option value="max">Maximum</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Node Alignment
        </label>
        <select
          value={config.nodeAlignment}
          onChange={(e) =>
            updateConfig({ nodeAlignment: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="center">Center</option>
          <option value="justify">Justify (automatic)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort Nodes
        </label>
        <select
          value={config.sortNodes}
          onChange={(e) =>
            updateConfig({ sortNodes: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="auto">Automatic (by flow)</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="manual">Manual (preserve order)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Node Width
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="1"
          value={config.nodeWidth}
          onChange={(e) =>
            updateConfig({ nodeWidth: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.nodeWidth}px
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Node Padding
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="1"
          value={config.nodePadding}
          onChange={(e) =>
            updateConfig({ nodePadding: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.nodePadding}px
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Link Opacity
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.linkOpacity}
          onChange={(e) =>
            updateConfig({ linkOpacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {Math.round(config.linkOpacity * 100)}%
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Link Threshold
        </label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={config.minLinkThreshold}
          onChange={(e) =>
            updateConfig({ minLinkThreshold: parseFloat(e.target.value) })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="0 = show all links"
        />
        <p className="text-xs text-gray-500 mt-1">
          Hide links with values below this threshold
        </p>
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
        {config.showValues && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Value Position
            </label>
            <select
              value={config.valuePosition}
              onChange={(e) =>
                updateConfig({ valuePosition: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="node">On Nodes</option>
              <option value="link">On Links</option>
              <option value="both">Both</option>
            </select>
          </div>
        )}
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
          <option value="category">By Category</option>
          <option value="gradient">By Flow Volume</option>
          <option value="custom">Custom Colors</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.highlightConnected}
            onChange={(e) =>
              updateConfig({ highlightConnected: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Highlight Connected Nodes on Hover
          </span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.enableInteraction}
            onChange={(e) =>
              updateConfig({ enableInteraction: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Enable Node Dragging/Rearrangement
          </span>
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Building System Integration
        </h4>
        <p className="text-xs text-blue-700">
          Sankey diagrams can visualize energy flow between building systems:
          <br />• HVAC energy distribution
          <br />• Water usage across zones
          <br />• Electrical load distribution
          <br />• Heat transfer between systems
        </p>
      </div>
    </div>
  );
};
