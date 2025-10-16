/**
 * TimeRangeSelector Component
 * Shared time range selector for all chart types
 */

import React, { useState } from 'react';
import { TimeRange, TimeRangeConfig } from './types';

interface TimeRangeSelectorProps {
  value: TimeRangeConfig;
  onChange: (config: TimeRangeConfig) => void;
  showRefreshInterval?: boolean;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const REFRESH_INTERVALS = [
  { value: 0, label: 'Manual' },
  { value: 5, label: '5 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
];

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  showRefreshInterval = false,
}) => {
  const [showCustom, setShowCustom] = useState(value.range === 'custom');

  const handleRangeChange = (range: TimeRange) => {
    setShowCustom(range === 'custom');
    onChange({
      ...value,
      range,
      customStart: range === 'custom' ? value.customStart : undefined,
      customEnd: range === 'custom' ? value.customEnd : undefined,
    });
  };

  const handleCustomStartChange = (date: string) => {
    onChange({
      ...value,
      customStart: new Date(date),
    });
  };

  const handleCustomEndChange = (date: string) => {
    onChange({
      ...value,
      customEnd: new Date(date),
    });
  };

  const handleRefreshIntervalChange = (interval: number) => {
    onChange({
      ...value,
      refreshInterval: interval,
    });
  };

  return (
    <div className="time-range-selector space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Range
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleRangeChange(option.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                value.range === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {showCustom && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={
                value.customStart
                  ? value.customStart.toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="datetime-local"
              value={
                value.customEnd
                  ? value.customEnd.toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {showRefreshInterval && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto Refresh
          </label>
          <select
            value={value.refreshInterval || 0}
            onChange={(e) =>
              handleRefreshIntervalChange(parseInt(e.target.value))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {REFRESH_INTERVALS.map((interval) => (
              <option key={interval.value} value={interval.value}>
                {interval.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
