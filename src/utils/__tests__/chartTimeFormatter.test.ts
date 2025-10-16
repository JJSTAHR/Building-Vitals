/**
 * Unit Tests for Chart Time Formatter
 *
 * Tests UTC to local conversion, 12-hour AM/PM formatting,
 * different granularities, time range formatting, and optimal granularity detection.
 */

import {
  formatAxisTime,
  formatTooltipTime,
  formatTimeRange,
  getOptimalGranularity,
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  createEChartsFormatter,
  parseTimestamp,
  isValidTimestamp,
  formatRelativeTime,
  type TimeGranularity
} from '../chartTimeFormatter';

describe('chartTimeFormatter', () => {
  // Fixed timestamps for consistent testing
  const testTimestamp = 1705334445000; // Jan 15, 2024, 2:30:45 PM UTC
  const testTimestamp2 = 1705345245000; // Jan 15, 2024, 5:30:45 PM UTC (3 hours later)
  const testTimestampNextDay = 1705420845000; // Jan 16, 2024, 2:30:45 PM UTC (next day)

  describe('formatAxisTime', () => {
    it('should format time with minute granularity (default)', () => {
      const result = formatAxisTime(testTimestamp);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should format time with second granularity', () => {
      const result = formatAxisTime(testTimestamp, 'second');
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
    });

    it('should format time with hour granularity', () => {
      const result = formatAxisTime(testTimestamp, 'hour');
      expect(result).toMatch(/\d{1,2}\s(AM|PM)/);
    });

    it('should format time with day granularity', () => {
      const result = formatAxisTime(testTimestamp, 'day');
      expect(result).toMatch(/\w{3}\s\d{1,2},\s\d{1,2}\s(AM|PM)/);
    });

    it('should format time with month granularity', () => {
      const result = formatAxisTime(testTimestamp, 'month');
      expect(result).toMatch(/\w{3}\s\d{1,2}/);
    });

    it('should use 12-hour format with AM/PM', () => {
      const morningTime = new Date('2024-01-15T09:30:00Z').getTime();
      const eveningTime = new Date('2024-01-15T21:30:00Z').getTime();

      const morningResult = formatAxisTime(morningTime, 'minute');
      const eveningResult = formatAxisTime(eveningTime, 'minute');

      expect(morningResult).toContain('AM');
      expect(eveningResult).toContain('PM');
    });

    it('should handle midnight correctly', () => {
      // Create local midnight (not UTC midnight)
      const midnight = new Date(2024, 0, 15, 0, 0, 0).getTime();
      const result = formatAxisTime(midnight, 'minute');
      expect(result).toMatch(/12:00\s(AM|PM)/);
    });

    it('should handle noon correctly', () => {
      // Create local noon (not UTC noon)
      const noon = new Date(2024, 0, 15, 12, 0, 0).getTime();
      const result = formatAxisTime(noon, 'minute');
      expect(result).toMatch(/12:00\s(AM|PM)/);
    });
  });

  describe('formatTooltipTime', () => {
    it('should format full date and time with seconds by default', () => {
      const result = formatTooltipTime(testTimestamp);
      expect(result).toMatch(/\w{3}\s\d{1,2},\s\d{4},\s\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
    });

    it('should format without seconds when option is set', () => {
      const result = formatTooltipTime(testTimestamp, { showSeconds: false });
      expect(result).toMatch(/\w{3}\s\d{1,2},\s\d{4},\s\d{1,2}:\d{2}\s(AM|PM)/);
      // Should not have seconds (third colon-separated number)
      expect(result).not.toMatch(/:\d{2}:\d{2}\s(AM|PM)/);
    });

    it('should include year in tooltip', () => {
      const result = formatTooltipTime(testTimestamp);
      expect(result).toContain('2024');
    });
  });

  describe('formatTimeRange', () => {
    it('should format same-day time range compactly', () => {
      const result = formatTimeRange(testTimestamp, testTimestamp2);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)\s-\s\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should format different-day time range with dates', () => {
      const result = formatTimeRange(testTimestamp, testTimestampNextDay);
      expect(result).toMatch(/\w{3}\s\d{1,2},\s\d{1,2}:\d{2}\s(AM|PM)\s-\s\w{3}\s\d{1,2},\s\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should handle ranges crossing midnight', () => {
      // Create times that cross midnight in local timezone
      const beforeMidnight = new Date(2024, 0, 15, 23, 30, 0).getTime();
      const afterMidnight = new Date(2024, 0, 16, 1, 30, 0).getTime();
      const result = formatTimeRange(beforeMidnight, afterMidnight);
      // Should show different dates since they're on different days
      const date1 = new Date(beforeMidnight);
      const date2 = new Date(afterMidnight);
      expect(date1.toDateString()).not.toBe(date2.toDateString());
      expect(result).toContain('Jan 15');
      expect(result).toContain('Jan 16');
    });
  });

  describe('getOptimalGranularity', () => {
    it('should return "minute" for ranges under 1 hour', () => {
      const start = Date.now();
      const end = start + 1800000; // 30 minutes
      expect(getOptimalGranularity(start, end)).toBe('minute');
    });

    it('should return "hour" for ranges between 1 hour and 1 day', () => {
      const start = Date.now();
      const end = start + 7200000; // 2 hours
      expect(getOptimalGranularity(start, end)).toBe('hour');
    });

    it('should return "day" for ranges between 1 day and 1 week', () => {
      const start = Date.now();
      const end = start + 172800000; // 2 days
      expect(getOptimalGranularity(start, end)).toBe('day');
    });

    it('should return "day" for ranges between 1 week and 1 month', () => {
      const start = Date.now();
      const end = start + 1209600000; // 2 weeks
      expect(getOptimalGranularity(start, end)).toBe('day');
    });

    it('should return "month" for ranges over 1 month', () => {
      const start = Date.now();
      const end = start + 5184000000; // 2 months
      expect(getOptimalGranularity(start, end)).toBe('month');
    });
  });

  describe('formatEChartsAxisLabel', () => {
    it('should use minute granularity without data range', () => {
      const result = formatEChartsAxisLabel(testTimestamp);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should auto-detect granularity with data range', () => {
      const start = Date.now();
      const end = start + 7200000; // 2 hours
      const result = formatEChartsAxisLabel(testTimestamp, [start, end]);
      expect(result).toBeDefined();
    });
  });

  describe('formatEChartsTooltip', () => {
    it('should format with seconds by default', () => {
      const result = formatEChartsTooltip(testTimestamp);
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
    });

    it('should format without seconds when specified', () => {
      const result = formatEChartsTooltip(testTimestamp, false);
      expect(result).not.toMatch(/:\d{2}:\d{2}\s(AM|PM)/);
    });
  });

  describe('createEChartsFormatter', () => {
    it('should create formatter function with default options', () => {
      const formatter = createEChartsFormatter();
      expect(typeof formatter).toBe('function');
      const result = formatter(testTimestamp);
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should create formatter with custom granularity', () => {
      const formatter = createEChartsFormatter({ granularity: 'hour' });
      const result = formatter(testTimestamp);
      expect(result).toMatch(/\d{1,2}\s(AM|PM)/);
    });

    it('should return consistent results for same input', () => {
      const formatter = createEChartsFormatter({ granularity: 'minute' });
      const result1 = formatter(testTimestamp);
      const result2 = formatter(testTimestamp);
      expect(result1).toBe(result2);
    });
  });

  describe('parseTimestamp', () => {
    it('should return number timestamp as-is', () => {
      expect(parseTimestamp(testTimestamp)).toBe(testTimestamp);
    });

    it('should convert Date object to timestamp', () => {
      const date = new Date(testTimestamp);
      expect(parseTimestamp(date)).toBe(testTimestamp);
    });

    it('should parse ISO string to timestamp', () => {
      const isoString = '2024-01-15T14:30:45.000Z';
      const result = parseTimestamp(isoString);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should handle various date string formats', () => {
      const formats = [
        '2024-01-15',
        '2024-01-15T14:30:45Z',
        '2024-01-15T14:30:45.000Z'
      ];

      formats.forEach(format => {
        const result = parseTimestamp(format);
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);
      });
    });
  });

  describe('isValidTimestamp', () => {
    it('should return true for valid timestamps', () => {
      expect(isValidTimestamp(testTimestamp)).toBe(true);
      expect(isValidTimestamp(Date.now())).toBe(true);
      expect(isValidTimestamp(0)).toBe(false); // Edge case
    });

    it('should return false for invalid timestamps', () => {
      expect(isValidTimestamp(NaN)).toBe(false);
      expect(isValidTimestamp(-1)).toBe(false);
      expect(isValidTimestamp(Infinity)).toBe(false);
    });

    it('should return false for timestamps beyond JavaScript date range', () => {
      expect(isValidTimestamp(8640000000000001)).toBe(false);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format past times', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 3600000)).toContain('ago');
      expect(formatRelativeTime(now - 60000)).toContain('minute');
    });

    it('should format future times', () => {
      const now = Date.now();
      expect(formatRelativeTime(now + 3600000)).toContain('in');
      expect(formatRelativeTime(now + 1800000)).toContain('minute');
    });

    it('should use correct units for different time ranges', () => {
      const now = Date.now();

      expect(formatRelativeTime(now - 30000)).toContain('second');
      expect(formatRelativeTime(now - 120000)).toContain('minute');
      expect(formatRelativeTime(now - 7200000)).toContain('hour');
      expect(formatRelativeTime(now - 172800000)).toContain('day');
      expect(formatRelativeTime(now - 1209600000)).toContain('week');
    });

    it('should handle singular and plural units', () => {
      const now = Date.now();

      expect(formatRelativeTime(now - 60000)).toContain('1 minute');
      expect(formatRelativeTime(now - 120000)).toContain('2 minutes');
      expect(formatRelativeTime(now - 3600000)).toContain('1 hour');
      expect(formatRelativeTime(now - 7200000)).toContain('2 hours');
    });

    it('should use custom base time', () => {
      const baseTime = new Date('2024-01-15T12:00:00Z').getTime();
      const targetTime = new Date('2024-01-15T13:30:00Z').getTime();

      const result = formatRelativeTime(targetTime, baseTime);
      expect(result).toContain('in');
      expect(result).toContain('hour');
    });
  });

  describe('UTC to Local Timezone Conversion', () => {
    it('should convert UTC timestamps to local timezone', () => {
      // Create a UTC timestamp
      const utcDate = new Date('2024-01-15T14:30:00Z');
      const timestamp = utcDate.getTime();

      // Format it
      const result = formatAxisTime(timestamp, 'minute');

      // The result should be in local timezone, not UTC
      // We can't assert exact time due to different timezones in CI,
      // but we can verify format
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('should handle daylight saving time transitions', () => {
      // Test timestamps around DST transitions
      const beforeDST = new Date('2024-03-10T06:00:00Z').getTime();
      const afterDST = new Date('2024-03-11T06:00:00Z').getTime();

      const result1 = formatAxisTime(beforeDST);
      const result2 = formatAxisTime(afterDST);

      expect(result1).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
      expect(result2).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle year transitions', () => {
      // Create local times for year transition
      const newYearsEve = new Date(2023, 11, 31, 23, 59, 59).getTime(); // Dec 31, 2023
      const newYearsDay = new Date(2024, 0, 1, 0, 0, 0).getTime(); // Jan 1, 2024

      const range = formatTimeRange(newYearsEve, newYearsDay);

      // Verify different days
      const date1 = new Date(newYearsEve);
      const date2 = new Date(newYearsDay);
      expect(date1.toDateString()).not.toBe(date2.toDateString());

      // Should contain both dates
      expect(range).toContain('Dec 31');
      expect(range).toContain('Jan 1');
    });

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z').getTime();
      const result = formatTooltipTime(leapDay);
      expect(result).toContain('Feb 29');
    });

    it('should handle very small time differences', () => {
      const start = Date.now();
      const end = start + 1000; // 1 second
      const granularity = getOptimalGranularity(start, end);
      expect(granularity).toBe('minute');
    });

    it('should handle very large time differences', () => {
      const start = Date.now();
      const end = start + 31536000000; // 1 year
      const granularity = getOptimalGranularity(start, end);
      expect(granularity).toBe('month');
    });
  });
});
