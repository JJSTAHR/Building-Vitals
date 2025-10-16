/**
 * DeviationHeatmapConfigurator Component
 * Configuration interface for deviation heatmaps with special building system integration
 * Shows deviations from baseline/target values across building zones and systems
 */

import React from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { BaseChartConfig, DataAggregation } from './types';

export interface DeviationHeatmapConfig extends BaseChartConfig {
  metric: string;
  xDimension: string;
  yDimension: string;
  aggregation: DataAggregation;
  baselineType: 'target' | 'historical' | 'custom';
  targetValue?: number;
  historicalPeriod?: string;
  customBaseline?: { [key: string]: number };
  deviationScale: 'absolute' | 'percentage' | 'normalized';
  colorScheme: 'diverging' | 'sequential';
  centerColor: string;
  positiveColor: string;
  negativeColor: string;
  thresholdWarning: number;
  thresholdCritical: number;
  showValues: boolean;
  showBaseline: boolean;
  highlightOutliers: boolean;
  cellBorders: boolean;
  // Building system specific
  buildingZones: string[];
  systemTypes: string[];
  alertOnDeviation: boolean;
  alertThreshold: number;
  compareToSchedule: boolean;
  scheduleProfile?: string;
}

interface DeviationHeatmapConfiguratorProps {
  config: DeviationHeatmapConfig;
  onChange: (config: DeviationHeatmapConfig) => void;
  availableMetrics: Array<{ value: string; label: string }>;
  buildingSystems: Array<{ value: string; label: string }>;
  dimensions: Array<{ value: string; label: string }>;
  zones: Array<{ value: string; label: string }>;
  scheduleProfiles: Array<{ value: string; label: string }>;
}

export const DeviationHeatmapConfigurator: React.FC<
  DeviationHeatmapConfiguratorProps
> = ({
  config,
  onChange,
  availableMetrics,
  buildingSystems,
  dimensions,
  zones,
  scheduleProfiles,
}) => {
  const updateConfig = (updates: Partial<DeviationHeatmapConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="deviation-heatmap-configurator space-y-6 p-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Building System Deviation Analysis
        </h3>
        <p className="text-xs text-blue-700">
          Visualize deviations from target values across building zones and
          systems. Identify areas of inefficiency, comfort issues, or equipment
          problems.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Temperature Deviation by Zone"
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
          Metric to Analyze
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
            X-Axis (Horizontal)
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
            Y-Axis (Vertical)
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
          Building Zones to Include
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
          {zones.map((zone) => (
            <label key={zone.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.buildingZones.includes(zone.value)}
                onChange={(e) => {
                  const newZones = e.target.checked
                    ? [...config.buildingZones, zone.value]
                    : config.buildingZones.filter((z) => z !== zone.value);
                  updateConfig({ buildingZones: newZones });
                }}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{zone.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Baseline Configuration
        </h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Baseline Type
          </label>
          <select
            value={config.baselineType}
            onChange={(e) =>
              updateConfig({ baselineType: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="target">Target Value (setpoint)</option>
            <option value="historical">Historical Average</option>
            <option value="custom">Custom Baseline per Zone</option>
          </select>
        </div>

        {config.baselineType === 'target' && (
          <div className="mt-3">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 72 for temperature"
            />
          </div>
        )}

        {config.baselineType === 'historical' && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Historical Period
            </label>
            <select
              value={config.historicalPeriod || ''}
              onChange={(e) =>
                updateConfig({ historicalPeriod: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select period...</option>
              <option value="same-day-last-week">Same day last week</option>
              <option value="last-7-days">Last 7 days average</option>
              <option value="last-30-days">Last 30 days average</option>
              <option value="same-period-last-year">Same period last year</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.compareToSchedule}
            onChange={(e) =>
              updateConfig({ compareToSchedule: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Compare to Building Schedule
          </span>
        </label>
        {config.compareToSchedule && (
          <div className="mt-2 ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Profile
            </label>
            <select
              value={config.scheduleProfile || ''}
              onChange={(e) =>
                updateConfig({ scheduleProfile: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select schedule...</option>
              {scheduleProfiles.map((profile) => (
                <option key={profile.value} value={profile.value}>
                  {profile.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Deviation Scale
        </label>
        <select
          value={config.deviationScale}
          onChange={(e) =>
            updateConfig({ deviationScale: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="absolute">Absolute (e.g., +3°F, -2°F)</option>
          <option value="percentage">Percentage (e.g., +5%, -3%)</option>
          <option value="normalized">Normalized (0-1 scale)</option>
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
          <option value="diverging">Diverging (positive/negative)</option>
          <option value="sequential">Sequential (magnitude only)</option>
        </select>
      </div>

      {config.colorScheme === 'diverging' && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Negative Color
            </label>
            <input
              type="color"
              value={config.negativeColor}
              onChange={(e) =>
                updateConfig({ negativeColor: e.target.value })
              }
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Center Color
            </label>
            <input
              type="color"
              value={config.centerColor}
              onChange={(e) => updateConfig({ centerColor: e.target.value })}
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Positive Color
            </label>
            <input
              type="color"
              value={config.positiveColor}
              onChange={(e) =>
                updateConfig({ positiveColor: e.target.value })
              }
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Alert Thresholds
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning Threshold
            </label>
            <input
              type="number"
              value={config.thresholdWarning}
              onChange={(e) =>
                updateConfig({
                  thresholdWarning: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Critical Threshold
            </label>
            <input
              type="number"
              value={config.thresholdCritical}
              onChange={(e) =>
                updateConfig({
                  thresholdCritical: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.alertOnDeviation}
            onChange={(e) =>
              updateConfig({ alertOnDeviation: e.target.checked })
            }
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Enable Real-time Alerts
          </span>
        </label>
        {config.alertOnDeviation && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Threshold
            </label>
            <input
              type="number"
              value={config.alertThreshold}
              onChange={(e) =>
                updateConfig({ alertThreshold: parseFloat(e.target.value) })
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
          <span className="text-sm text-gray-700">
            Show Deviation Values
          </span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={config.showBaseline}
            onChange={(e) => updateConfig({ showBaseline: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Show Baseline Reference
          </span>
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
          <span className="text-sm text-gray-700">
            Highlight Extreme Outliers
          </span>
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
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-amber-900 mb-2">
          Common Use Cases
        </h4>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• Temperature deviation across HVAC zones</li>
          <li>• Energy usage vs. targets by building area</li>
          <li>• Humidity levels compared to comfort ranges</li>
          <li>• Equipment efficiency vs. rated performance</li>
          <li>• Occupancy patterns vs. scheduled usage</li>
        </ul>
      </div>
    </div>
  );
};
