/**
 * GaugeChartConfigurator Component
 * Configuration interface for gauge charts
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig } from './types';

export interface GaugeChartConfig extends BaseChartConfig {
  metric: string;
  minValue: number;
  maxValue: number;
  targetValue?: number;
  unit: string;
  ranges: Array<{
    from: number;
    to: number;
    color: string;
    label: string;
  }>;
  showNeedle: boolean;
  needleColor: string;
  showValue: boolean;
  valueFormat: 'decimal' | 'percentage' | 'integer';
  decimalPlaces: number;
  arcWidth: number;
  startAngle: number;
  endAngle: number;
  animation: boolean;
  animationDuration: number;
}

interface GaugeChartConfiguratorProps {
  config: GaugeChartConfig;
  onChange: (config: GaugeChartConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
}

export const GaugeChartConfigurator: React.FC<
  GaugeChartConfiguratorProps
> = ({ config, onChange, availableMetrics, buildingSystems }) => {
  const updateConfig = (updates: Partial<GaugeChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  const addRange = () => {
    const newRange = {
      from: 0,
      to: 100,
      color: '#3b82f6',
      label: 'New Range',
    };
    updateConfig({ ranges: [...config.ranges, newRange] });
  };

  const updateRange = (index: number, updates: Partial<typeof config.ranges[0]>) => {
    const newRanges = [...config.ranges];
    newRanges[index] = { ...newRanges[index], ...updates };
    updateConfig({ ranges: newRanges });
  };

  const removeRange = (index: number) => {
    updateConfig({ ranges: config.ranges.filter((_, i) => i !== index) });
  };

  return (
    <div className="gauge-chart-configurator space-y-6 p-6">
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

      <div className="grid grid-cols-3 gap-4">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Value
          </label>
          <input
            type="number"
            value={config.targetValue || ''}
            onChange={(e) =>
              updateConfig({
                targetValue: e.target.value
                  ? parseFloat(e.target.value)
                  : undefined,
              })
            }
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Unit
        </label>
        <input
          type="text"
          value={config.unit}
          onChange={(e) => updateConfig({ unit: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., °F, %, kW"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Value Ranges
          </label>
          <button
            type="button"
            onClick={addRange}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Range
          </button>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
          {config.ranges.map((range, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded"
            >
              <input
                type="number"
                value={range.from}
                onChange={(e) =>
                  updateRange(index, { from: parseFloat(e.target.value) })
                }
                className="col-span-2 px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="From"
              />
              <span className="col-span-1 text-center text-sm text-gray-500">
                to
              </span>
              <input
                type="number"
                value={range.to}
                onChange={(e) =>
                  updateRange(index, { to: parseFloat(e.target.value) })
                }
                className="col-span-2 px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="To"
              />
              <input
                type="color"
                value={range.color}
                onChange={(e) => updateRange(index, { color: e.target.value })}
                className="col-span-1 h-8 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={range.label}
                onChange={(e) => updateRange(index, { label: e.target.value })}
                className="col-span-5 px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="Label"
              />
              <button
                type="button"
                onClick={() => removeRange(index)}
                className="col-span-1 text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Angle (degrees)
          </label>
          <input
            type="number"
            min="-180"
            max="180"
            value={config.startAngle}
            onChange={(e) =>
              updateConfig({ startAngle: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Angle (degrees)
          </label>
          <input
            type="number"
            min="-180"
            max="180"
            value={config.endAngle}
            onChange={(e) =>
              updateConfig({ endAngle: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Arc Width (%)
        </label>
        <input
          type="range"
          min="10"
          max="50"
          step="5"
          value={config.arcWidth}
          onChange={(e) =>
            updateConfig({ arcWidth: parseInt(e.target.value) })
          }
          className="w-full"
        />
        <div className="text-sm text-gray-500 text-center">
          {config.arcWidth}%
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showNeedle}
            onChange={(e) => updateConfig({ showNeedle: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Needle</span>
        </label>
        {config.showNeedle && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Needle Color
            </label>
            <input
              type="color"
              value={config.needleColor}
              onChange={(e) => updateConfig({ needleColor: e.target.value })}
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showValue}
            onChange={(e) => updateConfig({ showValue: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show Value</span>
        </label>
        {config.showValue && (
          <div className="ml-6 space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Value Format
              </label>
              <select
                value={config.valueFormat}
                onChange={(e) =>
                  updateConfig({ valueFormat: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="decimal">Decimal</option>
                <option value="integer">Integer</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            {config.valueFormat === 'decimal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decimal Places
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={config.decimalPlaces}
                  onChange={(e) =>
                    updateConfig({ decimalPlaces: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.animation}
            onChange={(e) => updateConfig({ animation: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Enable Animation</span>
        </label>
        {config.animation && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Animation Duration (ms)
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              step="100"
              value={config.animationDuration}
              onChange={(e) =>
                updateConfig({ animationDuration: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
