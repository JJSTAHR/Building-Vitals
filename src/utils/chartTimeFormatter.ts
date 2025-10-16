/**
 * Centralized Time Formatter Utility for Charts
 *
 * Provides consistent 12-hour AM/PM time formatting across all charts.
 * Automatically handles UTC to local timezone conversion.
 *
 * @module chartTimeFormatter
 */

export type TimeGranularity = 'second' | 'minute' | 'hour' | 'day' | 'month';

export interface TimeFormatterOptions {
  granularity?: TimeGranularity;
  showSeconds?: boolean;
  showDate?: boolean;
  hour12?: boolean; // Always true for our use case
}

/**
 * Format timestamp for chart X-axis labels (12-hour AM/PM)
 * Automatically converts UTC to browser's local timezone
 *
 * @param timestamp - UTC timestamp in milliseconds
 * @param granularity - Time display granularity
 * @returns Formatted time string
 *
 * @example
 * formatAxisTime(1705334445000, 'minute') // "2:30 PM"
 * formatAxisTime(1705334445000, 'hour') // "2 PM"
 * formatAxisTime(1705334445000, 'day') // "Jan 15, 2 PM"
 */
export function formatAxisTime(
  timestamp: number,
  granularity: TimeGranularity = 'minute'
): string {
  const date = new Date(timestamp); // Auto converts UTC to local

  switch (granularity) {
    case 'second':
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }); // e.g., "2:30:45 PM"

    case 'minute':
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }); // e.g., "2:30 PM"

    case 'hour':
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: true
      }); // e.g., "2 PM"

    case 'day':
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true
      }); // e.g., "Jan 15, 2 PM"

    case 'month':
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric'
      }); // e.g., "Jan 15"

    default:
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
  }
}

/**
 * Format timestamp for tooltips (full date + 12-hour time)
 *
 * @param timestamp - UTC timestamp in milliseconds
 * @param options - Optional formatting options
 * @returns Full formatted date and time string
 *
 * @example
 * formatTooltipTime(1705334445000) // "Jan 15, 2024, 2:30:45 PM"
 * formatTooltipTime(1705334445000, { showSeconds: false }) // "Jan 15, 2024, 2:30 PM"
 */
export function formatTooltipTime(
  timestamp: number,
  options: { showSeconds?: boolean } = {}
): string {
  const { showSeconds = true } = options;
  const date = new Date(timestamp);

  const baseOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  if (showSeconds) {
    baseOptions.second = '2-digit';
  }

  return date.toLocaleString('en-US', baseOptions);
}

/**
 * Format time range for legends and labels
 *
 * @param startTime - Start timestamp in milliseconds
 * @param endTime - End timestamp in milliseconds
 * @returns Formatted time range string
 *
 * @example
 * // Same day
 * formatTimeRange(1705334445000, 1705345245000) // "2:30 PM - 5:45 PM"
 *
 * // Different days
 * formatTimeRange(1705334445000, 1705420845000) // "Jan 15, 2:30 PM - Jan 16, 5:45 PM"
 */
export function formatTimeRange(startTime: number, endTime: number): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Same day: "2:30 PM - 5:45 PM"
  if (start.toDateString() === end.toDateString()) {
    return `${formatAxisTime(startTime, 'minute')} - ${formatAxisTime(endTime, 'minute')}`;
  }

  // Different days: "Jan 15, 2:30 PM - Jan 16, 5:45 PM"
  const startStr = start.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const endStr = end.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${startStr} - ${endStr}`;
}

/**
 * Determine optimal time granularity based on time range
 *
 * @param startTime - Start timestamp in milliseconds
 * @param endTime - End timestamp in milliseconds
 * @returns Recommended granularity level
 *
 * @example
 * getOptimalGranularity(now, now + 1800000) // 'minute' (30 min range)
 * getOptimalGranularity(now, now + 86400000) // 'hour' (1 day range)
 * getOptimalGranularity(now, now + 2592000000) // 'day' (30 day range)
 */
export function getOptimalGranularity(
  startTime: number,
  endTime: number
): TimeGranularity {
  const range = endTime - startTime;
  const oneHour = 3600000;
  const oneDay = 86400000;
  const oneWeek = 604800000;
  const oneMonth = 2592000000;

  if (range < oneHour) return 'minute';
  if (range < oneDay) return 'hour';
  if (range < oneWeek) return 'day';
  if (range < oneMonth) return 'day';
  return 'month';
}

/**
 * Format timestamp for ECharts axis labels with automatic granularity
 *
 * @param timestamp - UTC timestamp in milliseconds
 * @param dataRange - Optional data range for auto-granularity [startTime, endTime]
 * @returns Formatted time string
 *
 * @example
 * // Use with ECharts xAxis.axisLabel.formatter
 * xAxis: {
 *   type: 'time',
 *   axisLabel: {
 *     formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
 *   }
 * }
 */
export function formatEChartsAxisLabel(
  timestamp: number,
  dataRange?: [number, number]
): string {
  if (dataRange) {
    const granularity = getOptimalGranularity(dataRange[0], dataRange[1]);
    return formatAxisTime(timestamp, granularity);
  }
  return formatAxisTime(timestamp, 'minute');
}

/**
 * Format timestamp for ECharts tooltip
 *
 * @param timestamp - UTC timestamp in milliseconds
 * @param showSeconds - Whether to include seconds
 * @returns Formatted tooltip time string
 *
 * @example
 * // Use with ECharts tooltip.formatter
 * tooltip: {
 *   formatter: (params: any) => {
 *     const time = formatEChartsTooltip(params.value[0]);
 *     const value = params.value[1];
 *     return `${time}<br/>${params.seriesName}: ${value}`;
 *   }
 * }
 */
export function formatEChartsTooltip(
  timestamp: number,
  showSeconds: boolean = true
): string {
  return formatTooltipTime(timestamp, { showSeconds });
}

/**
 * Create a custom formatter function for ECharts
 *
 * @param options - Formatting options
 * @returns Formatter function compatible with ECharts
 *
 * @example
 * xAxis: {
 *   type: 'time',
 *   axisLabel: {
 *     formatter: createEChartsFormatter({ granularity: 'hour' })
 *   }
 * }
 */
export function createEChartsFormatter(
  options: TimeFormatterOptions = {}
): (value: number) => string {
  const { granularity = 'minute' } = options;
  return (value: number) => formatAxisTime(value, granularity);
}

/**
 * Parse various time formats into milliseconds timestamp
 *
 * @param time - Time value (timestamp, Date, or ISO string)
 * @returns Timestamp in milliseconds
 *
 * @example
 * parseTimestamp(1705334445000) // 1705334445000
 * parseTimestamp(new Date()) // current timestamp
 * parseTimestamp('2024-01-15T14:30:45Z') // 1705334445000
 */
export function parseTimestamp(time: number | Date | string): number {
  if (typeof time === 'number') {
    return time;
  }
  if (time instanceof Date) {
    return time.getTime();
  }
  return new Date(time).getTime();
}

/**
 * Check if a timestamp is valid
 *
 * @param timestamp - Timestamp to validate
 * @returns True if timestamp is valid
 *
 * @example
 * isValidTimestamp(1705334445000) // true
 * isValidTimestamp(NaN) // false
 * isValidTimestamp(-1) // false
 */
export function isValidTimestamp(timestamp: number): boolean {
  return !isNaN(timestamp) && timestamp > 0 && timestamp < 8640000000000000;
}

/**
 * Format relative time (e.g., "2 hours ago", "in 30 minutes")
 *
 * @param timestamp - Timestamp in milliseconds
 * @param baseTime - Base time for comparison (defaults to now)
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(Date.now() - 3600000) // "1 hour ago"
 * formatRelativeTime(Date.now() + 1800000) // "in 30 minutes"
 */
export function formatRelativeTime(
  timestamp: number,
  baseTime: number = Date.now()
): string {
  const diff = timestamp - baseTime;
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  const week = 604800000;
  const month = 2592000000;

  let value: number;
  let unit: string;

  if (absDiff < minute) {
    value = Math.round(absDiff / 1000);
    unit = value === 1 ? 'second' : 'seconds';
  } else if (absDiff < hour) {
    value = Math.round(absDiff / minute);
    unit = value === 1 ? 'minute' : 'minutes';
  } else if (absDiff < day) {
    value = Math.round(absDiff / hour);
    unit = value === 1 ? 'hour' : 'hours';
  } else if (absDiff < week) {
    value = Math.round(absDiff / day);
    unit = value === 1 ? 'day' : 'days';
  } else if (absDiff < month) {
    value = Math.round(absDiff / week);
    unit = value === 1 ? 'week' : 'weeks';
  } else {
    value = Math.round(absDiff / month);
    unit = value === 1 ? 'month' : 'months';
  }

  return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`;
}

// Export all types and functions
export default {
  formatAxisTime,
  formatTooltipTime,
  formatTimeRange,
  getOptimalGranularity,
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  createEChartsFormatter,
  parseTimestamp,
  isValidTimestamp,
  formatRelativeTime
};
