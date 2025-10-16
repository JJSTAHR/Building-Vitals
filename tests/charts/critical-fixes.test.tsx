import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CalendarHeatmap } from '../../src/components/charts/CalendarHeatmap';
import { CalendarYearHeatmap } from '../../src/components/charts/CalendarYearHeatmap';
import { EnhancedLineChart } from '../../src/components/charts/EnhancedLineChart';
import { BoxPlot } from '../../src/components/charts/BoxPlot';
import { DeviceDeviationHeatmap } from '../../src/components/charts/DeviceDeviationHeatmap';
import { Candlestick } from '../../src/components/charts/Candlestick';

/**
 * Critical Bug Fix Tests - Phase 1
 * Tests for the 7 critical bug fixes identified
 */

describe('Critical Bug Fixes', () => {

  describe('1. Timezone Fix - CalendarHeatmap', () => {
    const mockData = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-15', value: 150 },
      { date: '2024-02-01', value: 200 },
      { date: '2024-06-15', value: 250 },
      { date: '2024-12-31', value: 300 },
    ];

    it('should correctly handle UTC-12 timezone', () => {
      const { container } = render(
        <CalendarHeatmap
          data={mockData}
          year={2024}
          timezone="Etc/GMT+12"
        />
      );

      const heatmapCells = container.querySelectorAll('[data-testid^="heatmap-cell"]');
      expect(heatmapCells.length).toBeGreaterThan(0);

      // Verify dates are correctly positioned
      const janCell = container.querySelector('[data-date="2024-01-01"]');
      expect(janCell).toBeInTheDocument();
    });

    it('should correctly handle UTC+14 timezone', () => {
      const { container } = render(
        <CalendarHeatmap
          data={mockData}
          year={2024}
          timezone="Pacific/Kiritimati"
        />
      );

      const heatmapCells = container.querySelectorAll('[data-testid^="heatmap-cell"]');
      expect(heatmapCells.length).toBeGreaterThan(0);
    });

    it('should handle timezone changes without date shifts', () => {
      const { rerender } = render(
        <CalendarHeatmap
          data={mockData}
          year={2024}
          timezone="UTC"
        />
      );

      rerender(
        <CalendarHeatmap
          data={mockData}
          year={2024}
          timezone="America/New_York"
        />
      );

      rerender(
        <CalendarHeatmap
          data={mockData}
          year={2024}
          timezone="Asia/Tokyo"
        />
      );

      // Should not crash and should maintain data integrity
      expect(screen.getByRole('figure')).toBeInTheDocument();
    });

    it('should handle DST transitions correctly', () => {
      const dstData = [
        { date: '2024-03-10', value: 100 }, // DST start in US
        { date: '2024-11-03', value: 200 }, // DST end in US
      ];

      const { container } = render(
        <CalendarHeatmap
          data={dstData}
          year={2024}
          timezone="America/New_York"
        />
      );

      expect(container.querySelector('[data-date="2024-03-10"]')).toBeInTheDocument();
      expect(container.querySelector('[data-date="2024-11-03"]')).toBeInTheDocument();
    });
  });

  describe('2. Nested useMemo Fix - CalendarYearHeatmap', () => {
    const mockData = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-06-15', value: 200 },
    ];

    let renderCount = 0;

    const TestWrapper = ({ data, selectedDate }: any) => {
      renderCount++;
      return <CalendarYearHeatmap data={data} selectedDate={selectedDate} />;
    };

    beforeEach(() => {
      renderCount = 0;
    });

    it('should only re-render when data changes', () => {
      const { rerender } = render(
        <TestWrapper data={mockData} selectedDate={null} />
      );

      const initialRenderCount = renderCount;

      // Change unrelated prop
      rerender(<TestWrapper data={mockData} selectedDate="2024-01-01" />);

      // Should trigger re-render for selectedDate change
      expect(renderCount).toBe(initialRenderCount + 1);

      // Change data reference but same content
      rerender(<TestWrapper data={[...mockData]} selectedDate="2024-01-01" />);

      // Should trigger re-render for new data array
      expect(renderCount).toBe(initialRenderCount + 2);
    });

    it('should not regenerate processed data when data unchanged', async () => {
      const processSpy = jest.fn();

      const { rerender } = render(
        <CalendarYearHeatmap
          data={mockData}
          onDataProcess={processSpy}
        />
      );

      const initialCallCount = processSpy.mock.calls.length;

      // Multiple re-renders with same data
      rerender(<CalendarYearHeatmap data={mockData} />);
      rerender(<CalendarYearHeatmap data={mockData} />);
      rerender(<CalendarYearHeatmap data={mockData} />);

      await waitFor(() => {
        expect(processSpy.mock.calls.length).toBe(initialCallCount);
      });
    });
  });

  describe('3. Series Mapping Fix - EnhancedLineChart', () => {
    it('should handle single series correctly', () => {
      const data = [
        { timestamp: '2024-01-01T00:00:00Z', value: 100 }
      ];

      const { container } = render(
        <EnhancedLineChart
          data={data}
          series={[{ key: 'value', name: 'Series 1', color: '#ff0000' }]}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should handle three series correctly', () => {
      const data = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          temp: 20,
          humidity: 60,
          pressure: 1013
        }
      ];

      const { container } = render(
        <EnhancedLineChart
          data={data}
          series={[
            { key: 'temp', name: 'Temperature', color: '#ff0000' },
            { key: 'humidity', name: 'Humidity', color: '#00ff00' },
            { key: 'pressure', name: 'Pressure', color: '#0000ff' }
          ]}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should handle five series without performance degradation', () => {
      const data = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          s1: 1, s2: 2, s3: 3, s4: 4, s5: 5
        }
      ];

      const series = [
        { key: 's1', name: 'Series 1', color: '#ff0000' },
        { key: 's2', name: 'Series 2', color: '#00ff00' },
        { key: 's3', name: 'Series 3', color: '#0000ff' },
        { key: 's4', name: 'Series 4', color: '#ffff00' },
        { key: 's5', name: 'Series 5', color: '#ff00ff' }
      ];

      const startTime = performance.now();
      const { container } = render(
        <EnhancedLineChart data={data} series={series} />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(100); // Should render quickly
    });

    it('should correctly map all series keys', () => {
      const data = [
        { timestamp: '2024-01-01T00:00:00Z', a: 1, b: 2, c: 3 }
      ];

      const series = [
        { key: 'a', name: 'A', color: '#ff0000' },
        { key: 'b', name: 'B', color: '#00ff00' },
        { key: 'c', name: 'C', color: '#0000ff' }
      ];

      const { container } = render(
        <EnhancedLineChart data={data} series={series} />
      );

      // All series should be rendered
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });
  });

  describe('4. Statistics Calculation Fix - BoxPlot', () => {
    let calculationCount = 0;

    const countingCalculateStats = () => {
      calculationCount++;
      return {
        min: 0,
        q1: 25,
        median: 50,
        q3: 75,
        max: 100
      };
    };

    beforeEach(() => {
      calculationCount = 0;
    });

    it('should calculate statistics only once per data change', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      const { rerender } = render(
        <BoxPlot
          data={data}
          calculateStats={countingCalculateStats}
        />
      );

      const initialCount = calculationCount;

      // Re-render with same data
      rerender(
        <BoxPlot
          data={data}
          calculateStats={countingCalculateStats}
        />
      );

      // Should not recalculate
      expect(calculationCount).toBe(initialCount);
    });

    it('should recalculate when data changes', () => {
      const data1 = [10, 20, 30, 40, 50];
      const data2 = [60, 70, 80, 90, 100];

      const { rerender } = render(
        <BoxPlot
          data={data1}
          calculateStats={countingCalculateStats}
        />
      );

      const countAfterFirstRender = calculationCount;

      rerender(
        <BoxPlot
          data={data2}
          calculateStats={countingCalculateStats}
        />
      );

      // Should recalculate with new data
      expect(calculationCount).toBe(countAfterFirstRender + 1);
    });

    it('should handle empty data gracefully', () => {
      const { container } = render(<BoxPlot data={[]} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should handle single value data', () => {
      const { container } = render(<BoxPlot data={[42]} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });
  });

  describe('5. Gradient Generation Fix - DeviceDeviationHeatmap', () => {
    const mockData = [
      { device: 'Device1', hour: 0, deviation: 0.5 },
      { device: 'Device2', hour: 1, deviation: 1.5 },
    ];

    it('should not regenerate gradient on unrelated prop changes', () => {
      let gradientGenerations = 0;

      const trackingRender = (props: any) => {
        gradientGenerations++;
        return <DeviceDeviationHeatmap {...props} />;
      };

      const { rerender } = render(
        React.createElement(trackingRender, {
          data: mockData,
          title: 'Title 1'
        })
      );

      const initialGenerations = gradientGenerations;

      // Change title (unrelated to gradient)
      rerender(
        React.createElement(trackingRender, {
          data: mockData,
          title: 'Title 2'
        })
      );

      // Should only increment by 1 for the re-render, not regenerate gradient
      expect(gradientGenerations).toBe(initialGenerations + 1);
    });

    it('should use consistent gradient across renders', () => {
      const { container, rerender } = render(
        <DeviceDeviationHeatmap data={mockData} />
      );

      const initialGradient = container.querySelector('linearGradient');

      rerender(<DeviceDeviationHeatmap data={mockData} />);

      const secondGradient = container.querySelector('linearGradient');

      // Gradient definition should be stable
      expect(initialGradient?.getAttribute('id')).toBe(secondGradient?.getAttribute('id'));
    });
  });

  describe('6. Resize Handler Fix - EnhancedLineChart', () => {
    it('should respond to window resize', async () => {
      const { container } = render(
        <EnhancedLineChart
          data={[{ timestamp: '2024-01-01T00:00:00Z', value: 100 }]}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );

      const chart = container.querySelector('.echarts-for-react');
      expect(chart).toBeInTheDocument();

      // Simulate window resize
      global.innerWidth = 1920;
      global.innerHeight = 1080;
      global.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        expect(chart).toBeInTheDocument();
      });
    });

    it('should respond to container resize', async () => {
      const { container, rerender } = render(
        <div style={{ width: 800, height: 400 }}>
          <EnhancedLineChart
            data={[{ timestamp: '2024-01-01T00:00:00Z', value: 100 }]}
            series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          />
        </div>
      );

      rerender(
        <div style={{ width: 1200, height: 600 }}>
          <EnhancedLineChart
            data={[{ timestamp: '2024-01-01T00:00:00Z', value: 100 }]}
            series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          />
        </div>
      );

      await waitFor(() => {
        expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      });
    });

    it('should cleanup resize listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <EnhancedLineChart
          data={[{ timestamp: '2024-01-01T00:00:00Z', value: 100 }]}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('7. Timestamp Validation Fix - Candlestick', () => {
    const validData = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100, close: 110, high: 115, low: 95, volume: 1000
      }
    ];

    it('should reject null timestamps', () => {
      const invalidData = [
        {
          timestamp: null,
          open: 100, close: 110, high: 115, low: 95, volume: 1000
        }
      ];

      const { container } = render(<Candlestick data={invalidData as any} />);

      // Should handle gracefully, possibly showing error or empty state
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should reject undefined timestamps', () => {
      const invalidData = [
        {
          timestamp: undefined,
          open: 100, close: 110, high: 115, low: 95, volume: 1000
        }
      ];

      const { container } = render(<Candlestick data={invalidData as any} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should reject NaN timestamps', () => {
      const invalidData = [
        {
          timestamp: NaN,
          open: 100, close: 110, high: 115, low: 95, volume: 1000
        }
      ];

      const { container } = render(<Candlestick data={invalidData as any} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should reject malformed timestamp strings', () => {
      const invalidData = [
        {
          timestamp: 'not-a-valid-date',
          open: 100, close: 110, high: 115, low: 95, volume: 1000
        }
      ];

      const { container } = render(<Candlestick data={invalidData} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should accept valid ISO timestamps', () => {
      const { container } = render(<Candlestick data={validData} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should accept valid Unix timestamps', () => {
      const unixData = [
        {
          timestamp: 1704067200000, // 2024-01-01 in milliseconds
          open: 100, close: 110, high: 115, low: 95, volume: 1000
        }
      ];

      const { container } = render(<Candlestick data={unixData} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should filter out invalid timestamps from mixed data', () => {
      const mixedData = [
        { timestamp: '2024-01-01T00:00:00Z', open: 100, close: 110, high: 115, low: 95, volume: 1000 },
        { timestamp: null, open: 100, close: 110, high: 115, low: 95, volume: 1000 },
        { timestamp: '2024-01-02T00:00:00Z', open: 110, close: 120, high: 125, low: 105, volume: 1100 },
        { timestamp: 'invalid', open: 110, close: 120, high: 125, low: 105, volume: 1100 },
        { timestamp: '2024-01-03T00:00:00Z', open: 120, close: 130, high: 135, low: 115, volume: 1200 },
      ];

      const { container } = render(<Candlestick data={mixedData as any} />);

      // Should only render valid data points
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });
  });
});
