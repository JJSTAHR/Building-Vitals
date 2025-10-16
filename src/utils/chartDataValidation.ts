/**
 * Chart Data Validation Utilities (Quick Win #3 Mock Implementation)
 *
 * Provides validation functions for chart data.
 * This is a mock implementation for integration testing purposes.
 *
 * @module utils/chartDataValidation
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface TimeSeriesDataPoint {
  timestamp: number | Date;
  value: number;
}

export interface TimeSeriesData {
  name: string;
  data: TimeSeriesDataPoint[] | [number, number][];
  unit?: string;
  color?: string;
}

/**
 * Validates time series data structure
 */
export function validateTimeSeriesData(data: any): ValidationResult {
  // Check if data exists
  if (!data) {
    return {
      valid: false,
      error: 'Data is null or undefined'
    };
  }

  // Check if data is an array
  if (!Array.isArray(data)) {
    return {
      valid: false,
      error: 'Data must be an array'
    };
  }

  // Check if data is empty
  if (data.length === 0) {
    return {
      valid: false,
      error: 'Data array is empty'
    };
  }

  const warnings: string[] = [];

  // Validate each series
  for (let i = 0; i < data.length; i++) {
    const series = data[i];

    // Check series structure
    if (!series || typeof series !== 'object') {
      return {
        valid: false,
        error: `Series at index ${i} is not an object`
      };
    }

    // Check series name
    if (!series.name || typeof series.name !== 'string') {
      return {
        valid: false,
        error: `Series at index ${i} has invalid or missing name`
      };
    }

    // Check series data
    if (!Array.isArray(series.data)) {
      return {
        valid: false,
        error: `Series "${series.name}" data is not an array`
      };
    }

    if (series.data.length === 0) {
      warnings.push(`Series "${series.name}" has no data points`);
      continue;
    }

    // Validate data points
    for (let j = 0; j < series.data.length; j++) {
      const point = series.data[j];

      // Check if point is array format [timestamp, value]
      if (Array.isArray(point)) {
        if (point.length < 2) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} has less than 2 values`
          };
        }

        const [timestamp, value] = point;

        // Validate timestamp
        const isValidTimestamp =
          (typeof timestamp === 'number' && isFinite(timestamp)) ||
          (timestamp instanceof Date && !isNaN(timestamp.getTime()));

        if (!isValidTimestamp) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} has invalid timestamp`
          };
        }

        // Validate value
        if (typeof value !== 'number' || !isFinite(value)) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} has invalid value`
          };
        }
      }
      // Check if point is object format { timestamp, value }
      else if (point && typeof point === 'object') {
        const timestamp = point.timestamp || point.time;
        const value = point.value;

        if (timestamp === undefined || value === undefined) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} missing timestamp or value`
          };
        }

        // Validate timestamp
        const isValidTimestamp =
          (typeof timestamp === 'number' && isFinite(timestamp)) ||
          (timestamp instanceof Date && !isNaN(timestamp.getTime()));

        if (!isValidTimestamp) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} has invalid timestamp`
          };
        }

        // Validate value
        if (typeof value !== 'number' || !isFinite(value)) {
          return {
            valid: false,
            error: `Series "${series.name}" point ${j} has invalid value`
          };
        }
      } else {
        return {
          valid: false,
          error: `Series "${series.name}" point ${j} has invalid format`
        };
      }
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validates a single data point
 */
export function validateDataPoint(point: any): boolean {
  if (Array.isArray(point) && point.length >= 2) {
    const [timestamp, value] = point;
    const isValidTimestamp =
      (typeof timestamp === 'number' && isFinite(timestamp)) ||
      (timestamp instanceof Date && !isNaN(timestamp.getTime()));
    const isValidValue = typeof value === 'number' && isFinite(value);
    return isValidTimestamp && isValidValue;
  }

  if (point && typeof point === 'object') {
    const timestamp = point.timestamp || point.time;
    const value = point.value;
    const isValidTimestamp =
      (typeof timestamp === 'number' && isFinite(timestamp)) ||
      (timestamp instanceof Date && !isNaN(timestamp.getTime()));
    const isValidValue = typeof value === 'number' && isFinite(value);
    return isValidTimestamp && isValidValue;
  }

  return false;
}

/**
 * Checks if data has any valid points
 */
export function hasValidData(data: any): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  // Check if it's series data
  if (data[0]?.data && Array.isArray(data[0].data)) {
    return data.some(series =>
      series.data &&
      Array.isArray(series.data) &&
      series.data.length > 0
    );
  }

  // Check if it's direct data points
  return true;
}
