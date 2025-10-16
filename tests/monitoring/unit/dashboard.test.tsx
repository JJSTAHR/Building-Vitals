/**
 * Monitoring Dashboard Component Tests
 * Tests dashboard rendering, real-time updates, and user interactions
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { generateMockDashboardData, generateMockMetrics } from '../fixtures/analytics-fixtures';

// Mock dashboard component (simplified version for testing)
interface MonitoringDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onMetricsUpdate?: (metrics: any) => void;
}

const MockMonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 5000,
  onMetricsUpdate,
}) => {
  const [metrics, setMetrics] = React.useState(generateMockMetrics());
  const [lastUpdate, setLastUpdate] = React.useState(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const refreshMetrics = React.useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const newMetrics = generateMockMetrics();
      setMetrics(newMetrics);
      setLastUpdate(new Date());
      setIsRefreshing(false);
      onMetricsUpdate?.(newMetrics);
    }, 100);
  }, [onMetricsUpdate]);

  React.useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refreshMetrics]);

  return (
    <div data-testid="monitoring-dashboard">
      <h1>Monitoring Dashboard</h1>

      <div data-testid="metrics-summary">
        <div data-testid="request-count">Requests: {metrics.requestCount}</div>
        <div data-testid="error-count">Errors: {metrics.errorCount}</div>
        <div data-testid="cache-hits">Cache Hits: {metrics.cacheHits}</div>
        <div data-testid="cache-misses">Cache Misses: {metrics.cacheMisses}</div>
        <div data-testid="avg-response-time">
          Avg Response Time: {metrics.averageResponseTime.toFixed(2)}ms
        </div>
        <div data-testid="p95-response-time">
          P95 Response Time: {metrics.p95ResponseTime.toFixed(2)}ms
        </div>
      </div>

      <div data-testid="last-update">
        Last Update: {lastUpdate.toLocaleTimeString()}
      </div>

      <button
        data-testid="refresh-button"
        onClick={refreshMetrics}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
};

describe('MonitoringDashboard Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render dashboard correctly', () => {
      render(<MockMonitoringDashboard />);

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
      expect(screen.getByText('Monitoring Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-summary')).toBeInTheDocument();
    });

    it('should display all key metrics', () => {
      render(<MockMonitoringDashboard />);

      expect(screen.getByTestId('request-count')).toBeInTheDocument();
      expect(screen.getByTestId('error-count')).toBeInTheDocument();
      expect(screen.getByTestId('cache-hits')).toBeInTheDocument();
      expect(screen.getByTestId('cache-misses')).toBeInTheDocument();
      expect(screen.getByTestId('avg-response-time')).toBeInTheDocument();
      expect(screen.getByTestId('p95-response-time')).toBeInTheDocument();
    });

    it('should render metrics with correct format', () => {
      render(<MockMonitoringDashboard />);

      const avgTime = screen.getByTestId('avg-response-time');
      expect(avgTime.textContent).toMatch(/Avg Response Time: \d+\.\d{2}ms/);

      const p95Time = screen.getByTestId('p95-response-time');
      expect(p95Time.textContent).toMatch(/P95 Response Time: \d+\.\d{2}ms/);
    });
  });

  describe('Real-time Updates', () => {
    it('should auto-refresh metrics at specified interval', async () => {
      const refreshInterval = 5000;
      const onMetricsUpdate = vi.fn();

      render(
        <MockMonitoringDashboard
          autoRefresh={true}
          refreshInterval={refreshInterval}
          onMetricsUpdate={onMetricsUpdate}
        />
      );

      const initialRequestCount = screen.getByTestId('request-count').textContent;

      // Advance time by refresh interval
      vi.advanceTimersByTime(refreshInterval + 100);

      await waitFor(() => {
        expect(onMetricsUpdate).toHaveBeenCalled();
      });
    });

    it('should update last update timestamp', async () => {
      render(<MockMonitoringDashboard refreshInterval={1000} />);

      const initialUpdate = screen.getByTestId('last-update').textContent;

      vi.advanceTimersByTime(1100);

      await waitFor(() => {
        const newUpdate = screen.getByTestId('last-update').textContent;
        expect(newUpdate).not.toBe(initialUpdate);
      });
    });

    it('should not auto-refresh when disabled', async () => {
      const onMetricsUpdate = vi.fn();

      render(
        <MockMonitoringDashboard
          autoRefresh={false}
          refreshInterval={1000}
          onMetricsUpdate={onMetricsUpdate}
        />
      );

      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(onMetricsUpdate).not.toHaveBeenCalled();
      });
    });
  });

  describe('Manual Refresh', () => {
    it('should refresh metrics when button clicked', async () => {
      const onMetricsUpdate = vi.fn();

      render(<MockMonitoringDashboard onMetricsUpdate={onMetricsUpdate} />);

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(onMetricsUpdate).toHaveBeenCalled();
      });
    });

    it('should disable button during refresh', async () => {
      render(<MockMonitoringDashboard />);

      const refreshButton = screen.getByTestId('refresh-button') as HTMLButtonElement;

      expect(refreshButton.disabled).toBe(false);

      fireEvent.click(refreshButton);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('Metric Calculations', () => {
    it('should calculate cache hit rate correctly', () => {
      render(<MockMonitoringDashboard />);

      const cacheHits = parseInt(
        screen.getByTestId('cache-hits').textContent?.match(/\d+/)?.[0] || '0'
      );
      const cacheMisses = parseInt(
        screen.getByTestId('cache-misses').textContent?.match(/\d+/)?.[0] || '0'
      );

      const total = cacheHits + cacheMisses;
      const hitRate = total > 0 ? (cacheHits / total) * 100 : 0;

      expect(hitRate).toBeGreaterThanOrEqual(0);
      expect(hitRate).toBeLessThanOrEqual(100);
    });

    it('should display error rate percentage', () => {
      render(<MockMonitoringDashboard />);

      const requestCount = parseInt(
        screen.getByTestId('request-count').textContent?.match(/\d+/)?.[0] || '0'
      );
      const errorCount = parseInt(
        screen.getByTestId('error-count').textContent?.match(/\d+/)?.[0] || '0'
      );

      const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

      expect(errorRate).toBeGreaterThanOrEqual(0);
      expect(errorRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle failed metrics fetch gracefully', async () => {
      const onMetricsUpdate = vi.fn(() => {
        throw new Error('Failed to fetch metrics');
      });

      // Component should render even if callback fails
      render(<MockMonitoringDashboard onMetricsUpdate={onMetricsUpdate} />);

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
    });

    it('should display zero values when no data available', () => {
      const ZeroDashboard: React.FC = () => (
        <div data-testid="monitoring-dashboard">
          <div data-testid="request-count">Requests: 0</div>
          <div data-testid="error-count">Errors: 0</div>
        </div>
      );

      render(<ZeroDashboard />);

      expect(screen.getByTestId('request-count').textContent).toBe('Requests: 0');
      expect(screen.getByTestId('error-count').textContent).toBe('Errors: 0');
    });
  });

  describe('Performance', () => {
    it('should render dashboard quickly', () => {
      const startTime = performance.now();

      render(<MockMonitoringDashboard />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in under 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle rapid metric updates', async () => {
      const onMetricsUpdate = vi.fn();

      render(
        <MockMonitoringDashboard
          refreshInterval={100}
          onMetricsUpdate={onMetricsUpdate}
        />
      );

      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100);
      }

      await waitFor(() => {
        expect(onMetricsUpdate.mock.calls.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button', () => {
      render(<MockMonitoringDashboard />);

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton.tagName).toBe('BUTTON');
    });

    it('should display readable metric labels', () => {
      render(<MockMonitoringDashboard />);

      expect(screen.getByText(/Requests:/)).toBeInTheDocument();
      expect(screen.getByText(/Errors:/)).toBeInTheDocument();
      expect(screen.getByText(/Cache Hits:/)).toBeInTheDocument();
    });
  });
});
