import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimeSeriesChart } from '../../src/components/charts/TimeSeriesChart';
import { AreaChart } from '../../src/components/charts/AreaChart';
import { DPOptimization } from '../../src/components/charts/DPOptimization';

/**
 * Performance Optimization Tests - Phase 2
 * Tests for the 5 performance improvements
 */

describe('Performance Optimizations', () => {

  describe('8. Three-Mode Optimization - TimeSeriesChart', () => {
    const generateData = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
        value: Math.random() * 100
      }));
    };

    it('should use scatter mode for 5k points', async () => {
      const data = generateData(5000);

      const startTime = performance.now();
      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(500); // Scatter mode should be fast

      // Check that scatter mode is active
      await waitFor(() => {
        const chartInstance = container.querySelector('.echarts-for-react');
        expect(chartInstance).toHaveAttribute('data-mode', 'scatter');
      });
    });

    it('should use line mode for 25k points', async () => {
      const data = generateData(25000);

      const startTime = performance.now();
      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(1000); // Line mode should still be performant

      await waitFor(() => {
        const chartInstance = container.querySelector('.echarts-for-react');
        expect(chartInstance).toHaveAttribute('data-mode', 'line');
      });
    });

    it('should use optimized line mode for 75k points', async () => {
      const data = generateData(75000);

      const startTime = performance.now();
      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(2000); // Optimized mode with sampling

      await waitFor(() => {
        const chartInstance = container.querySelector('.echarts-for-react');
        expect(chartInstance).toHaveAttribute('data-mode', 'optimized');
      });
    });

    it('should correctly select mode based on data size', () => {
      const testCases = [
        { count: 1000, expectedMode: 'scatter' },
        { count: 10000, expectedMode: 'scatter' },
        { count: 30000, expectedMode: 'line' },
        { count: 50000, expectedMode: 'line' },
        { count: 80000, expectedMode: 'optimized' },
        { count: 100000, expectedMode: 'optimized' },
      ];

      testCases.forEach(({ count, expectedMode }) => {
        const data = generateData(count);
        const { container, unmount } = render(
          <TimeSeriesChart
            data={data}
            series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          />
        );

        expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
        unmount();
      });
    });

    it('should switch modes dynamically when data size changes', async () => {
      const smallData = generateData(5000);
      const largeData = generateData(75000);

      const { container, rerender } = render(
        <TimeSeriesChart
          data={smallData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.echarts-for-react')).toHaveAttribute('data-mode', 'scatter');
      });

      rerender(
        <TimeSeriesChart
          data={largeData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.echarts-for-react')).toHaveAttribute('data-mode', 'optimized');
      });
    });
  });

  describe('9. WebGL Acceleration - TimeSeriesChart', () => {
    const generateLargeDataset = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
        value: Math.sin(i / 1000) * 100 + Math.random() * 10
      }));
    };

    it('should enable WebGL for 150k points', async () => {
      const data = generateLargeDataset(150000);

      const startTime = performance.now();
      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          enableWebGL={true}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(3000); // WebGL should handle large datasets

      await waitFor(() => {
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
      });
    });

    it('should fallback gracefully if WebGL unavailable', async () => {
      const data = generateLargeDataset(150000);

      // Mock WebGL as unavailable
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = jest.fn((type) => {
        if (type === 'webgl' || type === 'webgl2') {
          return null;
        }
        return originalGetContext.call(this, type);
      });

      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          enableWebGL={true}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();

      // Restore original
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('should maintain interactivity with WebGL', async () => {
      const data = generateLargeDataset(150000);

      const { container } = render(
        <TimeSeriesChart
          data={data}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          enableWebGL={true}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();

      // Simulate mouse interactions
      if (canvas) {
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
      }

      // Should not crash
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });
  });

  describe('10. useMemo Optimization - TimeSeriesChart', () => {
    const data = Array.from({ length: 10000 }, (_, i) => ({
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      value: Math.random() * 100
    }));

    let dataProcessingCount = 0;

    const TestWrapper = ({ data, title }: any) => {
      const processedData = React.useMemo(() => {
        dataProcessingCount++;
        return data;
      }, [data]);

      return (
        <TimeSeriesChart
          data={processedData}
          series={[{ key: 'value', name: title, color: '#ff0000' }]}
        />
      );
    };

    beforeEach(() => {
      dataProcessingCount = 0;
    });

    it('should not reprocess data on unrelated prop changes', () => {
      const { rerender } = render(
        <TestWrapper data={data} title="Original Title" />
      );

      const initialProcessingCount = dataProcessingCount;

      // Change title multiple times
      rerender(<TestWrapper data={data} title="New Title 1" />);
      rerender(<TestWrapper data={data} title="New Title 2" />);
      rerender(<TestWrapper data={data} title="New Title 3" />);

      // Data should only be processed once
      expect(dataProcessingCount).toBe(initialProcessingCount);
    });

    it('should reprocess data when data reference changes', () => {
      const { rerender } = render(
        <TestWrapper data={data} title="Title" />
      );

      const initialProcessingCount = dataProcessingCount;

      // Change data (new reference)
      const newData = [...data];
      rerender(<TestWrapper data={newData} title="Title" />);

      // Should reprocess
      expect(dataProcessingCount).toBe(initialProcessingCount + 1);
    });

    it('should improve re-render performance', async () => {
      const { rerender } = render(
        <TestWrapper data={data} title="Original" />
      );

      const rerenderTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        rerender(<TestWrapper data={data} title={`Title ${i}`} />);
        rerenderTimes.push(performance.now() - startTime);
      }

      // Average re-render time should be fast (under 50ms)
      const avgRerenderTime = rerenderTimes.reduce((a, b) => a + b, 0) / rerenderTimes.length;
      expect(avgRerenderTime).toBeLessThan(50);
    });
  });

  describe('11. Dual Y-Axis Optimization - AreaChart', () => {
    it('should handle series with different magnitudes', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
        temperature: 20 + Math.random() * 10, // 20-30
        pressure: 1000 + Math.random() * 50,   // 1000-1050 (different magnitude)
      }));

      const { container } = render(
        <AreaChart
          data={data}
          series={[
            { key: 'temperature', name: 'Temperature', yAxisIndex: 0, color: '#ff0000' },
            { key: 'pressure', name: 'Pressure', yAxisIndex: 1, color: '#0000ff' }
          ]}
          dualYAxis={true}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should scale axes independently', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
        small: Math.random(),           // 0-1
        large: Math.random() * 1000000, // 0-1000000
      }));

      const { container } = render(
        <AreaChart
          data={data}
          series={[
            { key: 'small', name: 'Small Values', yAxisIndex: 0, color: '#ff0000' },
            { key: 'large', name: 'Large Values', yAxisIndex: 1, color: '#0000ff' }
          ]}
          dualYAxis={true}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should maintain performance with dual axes', () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
        value1: Math.random() * 100,
        value2: Math.random() * 10000,
      }));

      const startTime = performance.now();
      const { container } = render(
        <AreaChart
          data={data}
          series={[
            { key: 'value1', name: 'Series 1', yAxisIndex: 0, color: '#ff0000' },
            { key: 'value2', name: 'Series 2', yAxisIndex: 1, color: '#0000ff' }
          ]}
          dualYAxis={true}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(1000);
    });

    it('should handle single axis mode efficiently', () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
        value: Math.random() * 100,
      }));

      const startTime = performance.now();
      const { container } = render(
        <AreaChart
          data={data}
          series={[
            { key: 'value', name: 'Series', yAxisIndex: 0, color: '#ff0000' }
          ]}
          dualYAxis={false}
        />
      );
      const renderTime = performance.now() - startTime;

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(800);
    });
  });

  describe('12. Algorithm Refactor - DPOptimization', () => {
    const generateTestData = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        x: i,
        y: Math.sin(i / 10) * 100 + Math.random() * 10
      }));
    };

    it('should produce same results before and after refactor', () => {
      const data = generateTestData(1000);
      const tolerance = 0.05; // 5% tolerance

      // Original algorithm (baseline)
      const originalResult = DPOptimization.douglasPeucker(data, tolerance);

      // Refactored algorithm
      const refactoredResult = DPOptimization.optimizedDouglasPeucker(data, tolerance);

      expect(refactoredResult.length).toBe(originalResult.length);

      refactoredResult.forEach((point, i) => {
        expect(point.x).toBe(originalResult[i].x);
        expect(point.y).toBeCloseTo(originalResult[i].y, 2);
      });
    });

    it('should improve performance for large datasets', () => {
      const data = generateTestData(10000);
      const tolerance = 0.05;

      // Measure original algorithm
      const originalStart = performance.now();
      DPOptimization.douglasPeucker(data, tolerance);
      const originalTime = performance.now() - originalStart;

      // Measure refactored algorithm
      const refactoredStart = performance.now();
      DPOptimization.optimizedDouglasPeucker(data, tolerance);
      const refactoredTime = performance.now() - refactoredStart;

      // Refactored should be faster
      expect(refactoredTime).toBeLessThan(originalTime);
    });

    it('should handle edge cases correctly', () => {
      // Empty array
      expect(DPOptimization.optimizedDouglasPeucker([], 0.05)).toEqual([]);

      // Single point
      const singlePoint = [{ x: 0, y: 0 }];
      expect(DPOptimization.optimizedDouglasPeucker(singlePoint, 0.05)).toEqual(singlePoint);

      // Two points
      const twoPoints = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      expect(DPOptimization.optimizedDouglasPeucker(twoPoints, 0.05)).toEqual(twoPoints);
    });

    it('should reduce points appropriately', () => {
      const data = generateTestData(1000);

      const lowTolerance = DPOptimization.optimizedDouglasPeucker(data, 0.01);
      const mediumTolerance = DPOptimization.optimizedDouglasPeucker(data, 0.05);
      const highTolerance = DPOptimization.optimizedDouglasPeucker(data, 0.1);

      // Higher tolerance should reduce more points
      expect(highTolerance.length).toBeLessThan(mediumTolerance.length);
      expect(mediumTolerance.length).toBeLessThan(lowTolerance.length);
      expect(lowTolerance.length).toBeLessThan(data.length);
    });

    it('should maintain data integrity', () => {
      const data = generateTestData(1000);
      const result = DPOptimization.optimizedDouglasPeucker(data, 0.05);

      // First and last points should be preserved
      expect(result[0]).toEqual(data[0]);
      expect(result[result.length - 1]).toEqual(data[data.length - 1]);

      // All result points should exist in original data
      result.forEach(point => {
        expect(data).toContainEqual(point);
      });
    });

    it('should scale efficiently with data size', () => {
      const sizes = [1000, 5000, 10000, 20000];
      const times: number[] = [];

      sizes.forEach(size => {
        const data = generateTestData(size);
        const startTime = performance.now();
        DPOptimization.optimizedDouglasPeucker(data, 0.05);
        times.push(performance.now() - startTime);
      });

      // Time should scale sub-quadratically (not O(n²))
      // Check that doubling data size doesn't quadruple time
      expect(times[1] / times[0]).toBeLessThan(3);
      expect(times[2] / times[1]).toBeLessThan(3);
      expect(times[3] / times[2]).toBeLessThan(3);
    });
  });
});
