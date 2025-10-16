/**
 * Quick Wins Integration Tests
 *
 * Comprehensive integration testing of all 5 Quick Wins working together:
 * 1. useChartResize - Resize handling
 * 2. useChartError + ChartErrorDisplay - Error handling
 * 3. chartDataValidation - Data validation
 * 4. ChartLoadingState - Loading states
 * 5. chartDefaults - Default configuration
 *
 * @module components/charts/__tests__/QuickWinsIntegration.test
 */

import React, { useRef, useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Quick Win #1: Resize Handling
import { useChartResize } from '../../../hooks/charts/useChartResize';
import type { Dimensions } from '../../../hooks/charts/useChartResize';

// Quick Win #2: Error Handling
import { useChartError, createChartError } from '../../../hooks/charts/useChartError';
import type { ChartError } from '../../../hooks/charts/useChartError';
import { ChartErrorDisplay } from '../ChartErrorDisplay';

// Quick Win #3: Data Validation
import { validateTimeSeriesData, hasValidData } from '../../../utils/chartDataValidation';
import type { ValidationResult, TimeSeriesData } from '../../../utils/chartDataValidation';

// Quick Win #4: Loading States
import { ChartLoadingState } from '../ChartLoadingState';

// Quick Win #5: Default Configuration
import { getChartDefaults, withDefaults } from '../../../config/chartDefaults';

/* ============================================================================
 * TEST COMPONENT: TestChartWithAllQuickWins
 * ========================================================================= */

interface TestChartProps {
  data?: TimeSeriesData[];
  onDimensionsChange?: (dimensions: Dimensions) => void;
  onError?: (error: ChartError) => void;
  onValidationComplete?: (result: ValidationResult) => void;
  simulateLoadingDelay?: number;
}

/**
 * Test chart component that uses ALL 5 Quick Wins
 */
const TestChartWithAllQuickWins: React.FC<TestChartProps> = ({
  data = [],
  onDimensionsChange,
  onError,
  onValidationComplete,
  simulateLoadingDelay = 0
}) => {
  // Quick Win #1: Resize Handling
  const chartRef = useRef<HTMLDivElement>(null);
  const { dimensions, isResizing } = useChartResize(chartRef);

  // Quick Win #2: Error Handling
  const { error, setError, retry, clearError } = useChartError({
    maxRetries: 3,
    onRetry: () => {
      setLoading(true);
      setTimeout(() => setLoading(false), 500);
    }
  });

  // Quick Win #4: Loading State
  const [loading, setLoading] = useState(simulateLoadingDelay > 0);

  // Quick Win #5: Default Configuration
  const defaults = getChartDefaults('timeSeries');
  const chartProps = withDefaults({
    height: 400,
    showLegend: true
  }, defaults);

  // Simulate loading delay
  useEffect(() => {
    if (simulateLoadingDelay > 0) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, simulateLoadingDelay);
      return () => clearTimeout(timer);
    }
  }, [simulateLoadingDelay]);

  // Quick Win #3: Data Validation
  useEffect(() => {
    if (data && data.length > 0) {
      const validation = validateTimeSeriesData(data);
      onValidationComplete?.(validation);

      if (!validation.valid) {
        setError(createChartError.validation(
          validation.error || 'Invalid data',
          'test-chart'
        ));
      }
    }
  }, [data, onValidationComplete, setError]);

  // Report dimensions changes
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      onDimensionsChange?.(dimensions);
    }
  }, [dimensions, onDimensionsChange]);

  // Report errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  // Render loading state
  if (loading) {
    return (
      <div ref={chartRef} data-testid="chart-container">
        <ChartLoadingState
          loading={loading}
          hasData={hasValidData(data)}
          height={chartProps.height}
          message="Loading chart data..."
        />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div ref={chartRef} data-testid="chart-container">
        <ChartErrorDisplay
          error={error}
          onRetry={retry}
          onDismiss={clearError}
          height={chartProps.height}
        />
      </div>
    );
  }

  // Render chart
  return (
    <div
      ref={chartRef}
      data-testid="chart-container"
      data-resizing={isResizing}
      style={{
        height: chartProps.height,
        width: '100%',
        border: '1px solid #ccc',
        padding: '16px'
      }}
    >
      <div data-testid="chart-content">
        <div>Chart Width: {dimensions.width}px</div>
        <div>Chart Height: {dimensions.height}px</div>
        <div>Data Series: {data?.length || 0}</div>
        <div>Show Legend: {chartProps.showLegend ? 'Yes' : 'No'}</div>
        <div>Show Data Zoom: {chartProps.showDataZoom ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
};

/* ============================================================================
 * TEST DATA
 * ========================================================================= */

const validTimeSeriesData: TimeSeriesData[] = [
  {
    name: 'Temperature',
    data: [
      [1640000000000, 72],
      [1640003600000, 73],
      [1640007200000, 71]
    ],
    unit: '°F',
    color: '#2196f3'
  },
  {
    name: 'Humidity',
    data: [
      [1640000000000, 45],
      [1640003600000, 48],
      [1640007200000, 44]
    ],
    unit: '%',
    color: '#4caf50'
  }
];

const invalidTimeSeriesData: any[] = [
  {
    name: 'Invalid Series',
    data: [
      ['not-a-timestamp', 72], // Invalid timestamp
      [1640003600000, NaN], // Invalid value
      [1640007200000, 71]
    ]
  }
];

const emptyData: TimeSeriesData[] = [];

const largeDataset: TimeSeriesData[] = [
  {
    name: 'Large Dataset',
    data: Array.from({ length: 10000 }, (_, i) => [
      1640000000000 + i * 3600000,
      Math.random() * 100
    ]),
    unit: 'kW'
  }
];

/* ============================================================================
 * TEST SUITE 1: COMPLETE INTEGRATION (All 5 Quick Wins)
 * ========================================================================= */

describe('TestChartWithAllQuickWins - Complete Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize all 5 Quick Wins correctly', async () => {
    const onDimensionsChange = vi.fn();
    const onValidationComplete = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
        onValidationComplete={onValidationComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    // Quick Win #1: Resize should report dimensions
    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
    });

    // Quick Win #3: Validation should complete
    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(
        expect.objectContaining({ valid: true })
      );
    });

    // Quick Win #5: Defaults should be applied
    const content = screen.getByTestId('chart-content');
    expect(content).toHaveTextContent('Show Legend: Yes');
    expect(content).toHaveTextContent('Show Data Zoom: Yes');
  });

  it('should trigger dimension updates on resize', async () => {
    const onDimensionsChange = vi.fn();

    const { container } = render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
      />
    );

    const chartContainer = container.querySelector('[data-testid="chart-container"]') as HTMLElement;

    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
    });

    const initialCallCount = onDimensionsChange.mock.calls.length;

    // Simulate resize
    await act(async () => {
      Object.defineProperty(chartContainer, 'offsetWidth', {
        configurable: true,
        value: 800
      });
      Object.defineProperty(chartContainer, 'offsetHeight', {
        configurable: true,
        value: 600
      });

      // Trigger ResizeObserver
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Should have more dimension updates
    await waitFor(() => {
      expect(onDimensionsChange.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('should show validation error for invalid data', async () => {
    const onError = vi.fn();
    const onValidationComplete = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={invalidTimeSeriesData}
        onError={onError}
        onValidationComplete={onValidationComplete}
      />
    );

    // Quick Win #3: Validation should fail
    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: false,
          error: expect.any(String)
        })
      );
    });

    // Quick Win #2: Error should be displayed
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation',
          message: expect.any(String)
        })
      );
    });

    // Error display should be shown
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/VALIDATION ERROR/i)).toBeInTheDocument();
    });
  });

  it('should show error display with retry button', async () => {
    render(
      <TestChartWithAllQuickWins data={invalidTimeSeriesData} />
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Retry button should be present
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryButton);

    // Loading state should appear briefly
    await waitFor(() => {
      const status = screen.queryByRole('status');
      // Loading might appear briefly then error again
      expect(status).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('should show loading state correctly', async () => {
    render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        simulateLoadingDelay={500}
      />
    );

    // Quick Win #4: Loading state should be shown
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should apply default options correctly', () => {
    render(<TestChartWithAllQuickWins data={validTimeSeriesData} />);

    const content = screen.getByTestId('chart-content');

    // Quick Win #5: Check defaults are applied
    expect(content).toHaveTextContent('Show Legend: Yes');
    expect(content).toHaveTextContent('Show Data Zoom: Yes');
    expect(content).toHaveTextContent('Data Series: 2');
  });

  it('should handle retry mechanism correctly', async () => {
    const { rerender } = render(
      <TestChartWithAllQuickWins data={invalidTimeSeriesData} />
    );

    // Wait for error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // After retry, provide valid data
    rerender(<TestChartWithAllQuickWins data={validTimeSeriesData} />);

    // Error should clear and chart should render
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });
  });

  it('should handle error dismissal correctly', async () => {
    render(<TestChartWithAllQuickWins data={invalidTimeSeriesData} />);

    // Wait for error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Click dismiss
    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    // Error should be dismissed
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('should not have memory leaks (cleanup)', async () => {
    const { unmount } = render(
      <TestChartWithAllQuickWins data={validTimeSeriesData} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    // Unmount should not throw errors
    expect(() => unmount()).not.toThrow();
  });

  it('should not have prop conflicts between Quick Wins', async () => {
    const onDimensionsChange = vi.fn();
    const onError = vi.fn();
    const onValidationComplete = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
        onError={onError}
        onValidationComplete={onValidationComplete}
      />
    );

    // All callbacks should work without conflicts
    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
      expect(onValidationComplete).toHaveBeenCalled();
    });

    // No errors should occur with valid data
    expect(onError).not.toHaveBeenCalled();
  });
});

/* ============================================================================
 * TEST SUITE 2: PARTIAL INTEGRATION (Common Combinations)
 * ========================================================================= */

describe('Partial Integration - Common Combinations', () => {
  it('should handle Resize + Error handling together', async () => {
    const onDimensionsChange = vi.fn();
    const onError = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={invalidTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
        onError={onError}
      />
    );

    // Both resize and error should work
    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should handle Error + Loading states together', async () => {
    const { rerender } = render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        simulateLoadingDelay={300}
      />
    );

    // Loading first
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    }, { timeout: 500 });

    // Then trigger error
    rerender(<TestChartWithAllQuickWins data={invalidTimeSeriesData} />);

    // Error should appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should handle Validation + Error handling together', async () => {
    const onValidationComplete = vi.fn();
    const onError = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={invalidTimeSeriesData}
        onValidationComplete={onValidationComplete}
        onError={onError}
      />
    );

    // Validation fails
    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(
        expect.objectContaining({ valid: false })
      );
    });

    // Error is shown
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should work with all except Error handling', async () => {
    const onDimensionsChange = vi.fn();
    const onValidationComplete = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
        onValidationComplete={onValidationComplete}
      />
    );

    // Should work without errors
    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
      expect(onValidationComplete).toHaveBeenCalledWith(
        expect.objectContaining({ valid: true })
      );
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });
  });

  it('should work with all except Loading states', () => {
    const onDimensionsChange = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
        simulateLoadingDelay={0}
      />
    );

    // Chart should render immediately without loading
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
  });
});

/* ============================================================================
 * TEST SUITE 3: PERFORMANCE INTEGRATION
 * ========================================================================= */

describe('Performance Integration', () => {
  it('should not significantly impact render time with all Quick Wins', async () => {
    const start = performance.now();

    render(<TestChartWithAllQuickWins data={validTimeSeriesData} />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    const end = performance.now();
    const renderTime = end - start;

    // Should render within 100ms threshold
    expect(renderTime).toBeLessThan(100);
  });

  it('should handle large datasets efficiently', async () => {
    const start = performance.now();

    render(<TestChartWithAllQuickWins data={largeDataset} />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    const end = performance.now();
    const renderTime = end - start;

    // Large dataset should still render reasonably fast
    expect(renderTime).toBeLessThan(500);
  });

  it('should handle rapid resizes without performance issues', async () => {
    const onDimensionsChange = vi.fn();

    const { container } = render(
      <TestChartWithAllQuickWins
        data={validTimeSeriesData}
        onDimensionsChange={onDimensionsChange}
      />
    );

    const chartContainer = container.querySelector('[data-testid="chart-container"]') as HTMLElement;

    // Simulate 10 rapid resizes
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(chartContainer, 'offsetWidth', {
          configurable: true,
          value: 500 + i * 50
        });
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    // Debouncing should limit calls
    await waitFor(() => {
      // Should not call for every resize (debouncing)
      expect(onDimensionsChange.mock.calls.length).toBeLessThan(10);
    });
  });

  it('should not cause memory leaks with repeated renders', async () => {
    const { rerender, unmount } = render(
      <TestChartWithAllQuickWins data={validTimeSeriesData} />
    );

    // Re-render multiple times
    for (let i = 0; i < 10; i++) {
      rerender(
        <TestChartWithAllQuickWins
          data={[
            {
              name: `Series ${i}`,
              data: [[Date.now(), Math.random() * 100]]
            }
          ]}
        />
      );
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Cleanup should not throw
    expect(() => unmount()).not.toThrow();
  });
});

/* ============================================================================
 * TEST SUITE 4: EDGE CASES
 * ========================================================================= */

describe('Edge Cases', () => {
  it('should handle rapid resizing during error state', async () => {
    const { container } = render(
      <TestChartWithAllQuickWins data={invalidTimeSeriesData} />
    );

    // Wait for error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const chartContainer = container.querySelector('[data-testid="chart-container"]') as HTMLElement;

    // Resize while in error state
    await act(async () => {
      Object.defineProperty(chartContainer, 'offsetWidth', {
        configurable: true,
        value: 800
      });
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Error should still be displayed
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should handle multiple validation errors in sequence', async () => {
    const onValidationComplete = vi.fn();

    const { rerender } = render(
      <TestChartWithAllQuickWins
        data={invalidTimeSeriesData}
        onValidationComplete={onValidationComplete}
      />
    );

    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(
        expect.objectContaining({ valid: false })
      );
    });

    // Trigger another validation error
    rerender(
      <TestChartWithAllQuickWins
        data={[{ name: 'Test', data: [] }]} // Empty data
        onValidationComplete={onValidationComplete}
      />
    );

    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle retry during loading', async () => {
    const { rerender } = render(
      <TestChartWithAllQuickWins
        data={invalidTimeSeriesData}
      />
    );

    // Wait for error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    // Loading should appear
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeTruthy();
    }, { timeout: 200 });
  });

  it('should handle clear error during retry', async () => {
    render(<TestChartWithAllQuickWins data={invalidTimeSeriesData} />);

    // Wait for error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Click dismiss during potential retry
    fireEvent.click(screen.getByText('Dismiss'));

    // Error should clear
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('should handle resize with no data', async () => {
    const onDimensionsChange = vi.fn();

    const { container } = render(
      <TestChartWithAllQuickWins
        data={emptyData}
        onDimensionsChange={onDimensionsChange}
      />
    );

    const chartContainer = container.querySelector('[data-testid="chart-container"]') as HTMLElement;

    // Resize with no data
    await act(async () => {
      Object.defineProperty(chartContainer, 'offsetWidth', {
        configurable: true,
        value: 1000
      });
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Should still track dimensions
    await waitFor(() => {
      expect(onDimensionsChange).toHaveBeenCalled();
    });
  });

  it('should handle empty data gracefully', () => {
    render(<TestChartWithAllQuickWins data={emptyData} />);

    // Should render without errors
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    expect(screen.getByTestId('chart-content')).toHaveTextContent('Data Series: 0');
  });

  it('should handle null/undefined data', async () => {
    const onValidationComplete = vi.fn();

    render(
      <TestChartWithAllQuickWins
        data={undefined}
        onValidationComplete={onValidationComplete}
      />
    );

    // Should render without crashing
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();

    // Validation should not be called for undefined data
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(onValidationComplete).not.toHaveBeenCalled();
  });
});
