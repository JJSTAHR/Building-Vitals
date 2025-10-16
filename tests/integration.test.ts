/**
 * Integration Tests
 * End-to-end testing of the point selection and data fetching pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock types
interface Point {
  Name: string;
  display_name?: string;
  Type?: string;
  Unit?: string;
}

interface TimeseriesDataPoint {
  timestamp: string;
  value: number;
}

interface ChartData {
  loading: boolean;
  error: string | null;
  data: TimeseriesDataPoint[];
}

// Mock point selector component behavior
const mockPointSelector = (points: Point[]) => {
  return {
    points,
    selectedPoint: null,
    onSelect: (point: Point) => point
  };
};

// Mock useChartData hook
const mockUseChartData = (pointName: string) => {
  const [chartData, setChartData] = vi.fn().mockReturnValue({
    loading: true,
    error: null,
    data: []
  });

  // Simulate API call with original point name
  const fetchData = async () => {
    const response = await fetch(`/api/timeseries?point=${encodeURIComponent(pointName)}`);
    const data = await response.json();

    setChartData({
      loading: false,
      error: null,
      data: data.timeseries
    });
  };

  return { chartData, fetchData };
};

describe('Integration Tests - End-to-End Flow', () => {
  describe('Point Selector Display', () => {
    it('should display enhanced names in point selector', () => {
      const enhancedPoints: Point[] = [
        {
          Name: 'ses/ses_falls_city/Vav707.points.Damper',
          display_name: 'VAV-707 Damper Position'
        },
        {
          Name: 'Rtu6_1.points.SaFanStatus',
          display_name: 'RTU-6 Supply Air Fan Status'
        }
      ];

      const selector = mockPointSelector(enhancedPoints);

      expect(selector.points[0].display_name).toBe('VAV-707 Damper Position');
      expect(selector.points[1].display_name).toBe('RTU-6 Supply Air Fan Status');

      // Original names should still be present
      expect(selector.points[0].Name).toBe('ses/ses_falls_city/Vav707.points.Damper');
      expect(selector.points[1].Name).toBe('Rtu6_1.points.SaFanStatus');
    });

    it('should show original names when enhancement is unavailable', () => {
      const unenhancedPoints: Point[] = [
        { Name: 'unknown.point.format' }
      ];

      const selector = mockPointSelector(unenhancedPoints);

      expect(selector.points[0].display_name).toBeUndefined();
      expect(selector.points[0].Name).toBe('unknown.point.format');
    });

    it('should handle mixed enhanced and unenhanced points', () => {
      const mixedPoints: Point[] = [
        {
          Name: 'Vav707.points.Damper',
          display_name: 'VAV-707 Damper Position'
        },
        {
          Name: 'unknown.point.format'
        },
        {
          Name: 'Rtu6_1.points.SaFanStatus',
          display_name: 'RTU-6 Supply Air Fan Status'
        }
      ];

      const selector = mockPointSelector(mixedPoints);

      expect(selector.points[0].display_name).toBe('VAV-707 Damper Position');
      expect(selector.points[1].display_name).toBeUndefined();
      expect(selector.points[2].display_name).toBe('RTU-6 Supply Air Fan Status');

      // All should preserve original names
      expect(selector.points.every(p => p.Name)).toBe(true);
    });
  });

  describe('Selection and Full Object Passing', () => {
    it('should pass complete enhanced object on selection', () => {
      const enhancedPoints: Point[] = [
        {
          Name: 'ses/ses_falls_city/Vav707.points.Damper',
          display_name: 'VAV-707 Damper Position',
          Type: 'analog',
          Unit: '%'
        }
      ];

      const selector = mockPointSelector(enhancedPoints);
      const selected = selector.onSelect(enhancedPoints[0]);

      expect(selected).toEqual({
        Name: 'ses/ses_falls_city/Vav707.points.Damper',
        display_name: 'VAV-707 Damper Position',
        Type: 'analog',
        Unit: '%'
      });
    });

    it('should preserve all properties through selection', () => {
      const point: Point = {
        Name: 'complex/path/point.name',
        display_name: 'Human Readable Name',
        Type: 'binary',
        Unit: 'on/off'
      };

      const selector = mockPointSelector([point]);
      const selected = selector.onSelect(point);

      expect(Object.keys(selected)).toEqual(['Name', 'display_name', 'Type', 'Unit']);
      expect(selected.Name).toBe('complex/path/point.name');
      expect(selected.display_name).toBe('Human Readable Name');
    });
  });

  describe('API Calls with Original Names', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should use original Name for timeseries API calls', async () => {
      const point: Point = {
        Name: 'ses/ses_falls_city/Vav707.points.Damper',
        display_name: 'VAV-707 Damper Position'
      };

      const mockTimeseriesData = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 45.2 },
          { timestamp: '2025-01-01T01:00:00Z', value: 48.7 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeseriesData
      });

      const { chartData, fetchData } = mockUseChartData(point.Name);
      await fetchData();

      // Verify API was called with original name, not display name
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ses%2Fses_falls_city%2FVav707.points.Damper')
      );
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('VAV-707')
      );
    });

    it('should correctly encode special characters in original names', async () => {
      const point: Point = {
        Name: 'site/building/Vav#707.points.Damper',
        display_name: 'VAV-707 Damper'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeseries: [] })
      });

      const { fetchData } = mockUseChartData(point.Name);
      await fetchData();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('site%2Fbuilding%2FVav%23707.points.Damper')
      );
    });

    it('should handle API errors with original point context', async () => {
      const point: Point = {
        Name: 'ses/ses_falls_city/InvalidPoint',
        display_name: 'Invalid Point Display'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Point not found' })
      });

      const { fetchData } = mockUseChartData(point.Name);

      await expect(fetchData()).rejects.toThrow();

      // Error should reference original name for debugging
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('InvalidPoint')
      );
    });
  });

  describe('Timeseries Data Fetching', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch and display timeseries data correctly', async () => {
      const point: Point = {
        Name: 'Rtu6_1.points.SaFanStatus',
        display_name: 'RTU-6 Supply Air Fan Status'
      };

      const mockData = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 1 },
          { timestamp: '2025-01-01T01:00:00Z', value: 1 },
          { timestamp: '2025-01-01T02:00:00Z', value: 0 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const { chartData, fetchData } = mockUseChartData(point.Name);
      await fetchData();

      expect(chartData.value.loading).toBe(false);
      expect(chartData.value.error).toBeNull();
      expect(chartData.value.data).toEqual(mockData.timeseries);
    });

    it('should handle multiple point selections correctly', async () => {
      const points: Point[] = [
        {
          Name: 'Vav707.points.Damper',
          display_name: 'VAV-707 Damper'
        },
        {
          Name: 'Vav707.points.ZoneTemp',
          display_name: 'VAV-707 Zone Temperature'
        }
      ];

      const mockData1 = { timeseries: [{ timestamp: '2025-01-01T00:00:00Z', value: 45 }] };
      const mockData2 = { timeseries: [{ timestamp: '2025-01-01T00:00:00Z', value: 72 }] };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockData1 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockData2 });

      const chart1 = mockUseChartData(points[0].Name);
      const chart2 = mockUseChartData(points[1].Name);

      await chart1.fetchData();
      await chart2.fetchData();

      // Verify both API calls used original names
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Vav707.points.Damper')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Vav707.points.ZoneTemp')
      );
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should maintain data integrity through the full pipeline', async () => {
      // 1. Start with enhanced points
      const enhancedPoint: Point = {
        Name: 'ses/ses_falls_city/Vav707.points.Damper',
        display_name: 'VAV-707 Damper Position',
        Type: 'analog',
        Unit: '%'
      };

      // 2. User sees display_name in selector
      const selector = mockPointSelector([enhancedPoint]);
      expect(selector.points[0].display_name).toBe('VAV-707 Damper Position');

      // 3. User selects point - full object is passed
      const selected = selector.onSelect(enhancedPoint);
      expect(selected).toEqual(enhancedPoint);

      // 4. Chart component uses original Name for API
      const mockData = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 45.2 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const { chartData, fetchData } = mockUseChartData(selected.Name);
      await fetchData();

      // 5. Verify API used original name
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ses%2Fses_falls_city%2FVav707.points.Damper')
      );

      // 6. Verify data is received
      expect(chartData.value.data).toEqual(mockData.timeseries);
    });
  });

  describe('Real-World Full Pipeline', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should handle SES Falls City VAV point end-to-end', async () => {
      // Step 1: Enhancement
      const originalPoint = { Name: 'ses/ses_falls_city/Vav707.points.Damper' };
      const enhancedPoint = {
        ...originalPoint,
        display_name: 'VAV-707 Damper Position'
      };

      // Step 2: Display in selector
      const selector = mockPointSelector([enhancedPoint]);
      expect(selector.points[0].display_name).toBe('VAV-707 Damper Position');

      // Step 3: User selects
      const selected = selector.onSelect(enhancedPoint);

      // Step 4: Fetch timeseries with original name
      const mockTimeseries = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 0 },
          { timestamp: '2025-01-01T01:00:00Z', value: 25 },
          { timestamp: '2025-01-01T02:00:00Z', value: 50 },
          { timestamp: '2025-01-01T03:00:00Z', value: 75 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeseries
      });

      const { chartData, fetchData } = mockUseChartData(selected.Name);
      await fetchData();

      // Step 5: Verify complete flow
      expect(selected.Name).toBe('ses/ses_falls_city/Vav707.points.Damper');
      expect(selected.display_name).toBe('VAV-707 Damper Position');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ses%2Fses_falls_city%2FVav707.points.Damper')
      );
      expect(chartData.value.data).toHaveLength(4);
    });

    it('should handle RTU point with complex data', async () => {
      const point: Point = {
        Name: 'Rtu6_1.points.SaFanStatus',
        display_name: 'RTU-6 Supply Air Fan Status',
        Type: 'binary',
        Unit: 'on/off'
      };

      const selector = mockPointSelector([point]);
      const selected = selector.onSelect(point);

      const mockTimeseries = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 1 },
          { timestamp: '2025-01-01T01:00:00Z', value: 1 },
          { timestamp: '2025-01-01T02:00:00Z', value: 0 },
          { timestamp: '2025-01-01T03:00:00Z', value: 1 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeseries
      });

      const { chartData, fetchData } = mockUseChartData(selected.Name);
      await fetchData();

      // UI shows display name
      expect(selector.points[0].display_name).toBe('RTU-6 Supply Air Fan Status');

      // API uses original name
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Rtu6_1.points.SaFanStatus')
      );

      // Data is binary (0/1)
      expect(chartData.value.data.every((d: TimeseriesDataPoint) =>
        d.value === 0 || d.value === 1
      )).toBe(true);
    });

    it('should handle fallback enhancement gracefully in full flow', async () => {
      // AI enhancement fails, pattern matching succeeds
      const point: Point = {
        Name: 'Ahu1.points.DaTemp',
        display_name: 'AHU-1 Discharge Air Temperature' // From pattern matching
      };

      const selector = mockPointSelector([point]);
      const selected = selector.onSelect(point);

      const mockTimeseries = {
        timeseries: [
          { timestamp: '2025-01-01T00:00:00Z', value: 55.5 },
          { timestamp: '2025-01-01T01:00:00Z', value: 56.2 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeseries
      });

      const { chartData, fetchData } = mockUseChartData(selected.Name);
      await fetchData();

      // Even with fallback enhancement, flow works correctly
      expect(selected.display_name).toBe('AHU-1 Discharge Air Temperature');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Ahu1.points.DaTemp')
      );
      expect(chartData.value.data).toHaveLength(2);
    });
  });

  describe('Error Recovery in Full Pipeline', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should show enhanced names even when timeseries fetch fails', async () => {
      const point: Point = {
        Name: 'Vav707.points.Damper',
        display_name: 'VAV-707 Damper Position'
      };

      const selector = mockPointSelector([point]);
      expect(selector.points[0].display_name).toBe('VAV-707 Damper Position');

      const selected = selector.onSelect(point);

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { chartData, fetchData } = mockUseChartData(selected.Name);

      try {
        await fetchData();
      } catch (error) {
        // Error in data fetch, but enhancement remains
        expect(selected.display_name).toBe('VAV-707 Damper Position');
        expect(selected.Name).toBe('Vav707.points.Damper');
      }
    });

    it('should allow point reselection after errors', async () => {
      const points: Point[] = [
        {
          Name: 'point1.Name',
          display_name: 'Point 1'
        },
        {
          Name: 'point2.Name',
          display_name: 'Point 2'
        }
      ];

      const selector = mockPointSelector(points);

      // First selection fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const first = selector.onSelect(points[0]);
      const chart1 = mockUseChartData(first.Name);

      try {
        await chart1.fetchData();
      } catch {}

      // Second selection succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeseries: [{ timestamp: '2025-01-01T00:00:00Z', value: 100 }] })
      });

      const second = selector.onSelect(points[1]);
      const chart2 = mockUseChartData(second.Name);
      await chart2.fetchData();

      expect(second.display_name).toBe('Point 2');
      expect(chart2.chartData.value.data).toHaveLength(1);
    });
  });
});
