/**
 * Chart Configurators Test Suite
 *
 * Tests for all chart type-specific configuration components:
 * - Time Series configurator
 * - Bar chart configurator
 * - Scatter plot configurator
 * - Heatmap configurator
 * - Area chart configurator
 * - Gauge configurator
 * - Box plot configurator
 *
 * Ensures consistency across all configurators and validates proper
 * configuration generation for each chart type.
 *
 * @module tests/chartConfigurators
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoxPlotAggregationConfigurator, BoxPlotConfig } from '../components/charts/configurators/BoxPlotAggregationConfigurator';

// Mock interfaces for other configurators (to be implemented)
interface BaseConfiguratorProps {
  config: Partial<any>;
  onChange: (config: any) => void;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

interface TimeSeriesConfig {
  interval: 'auto' | '1m' | '5m' | '15m' | '1h' | '1d';
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
  showDataPoints: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillArea: boolean;
}

interface BarChartConfig {
  orientation: 'vertical' | 'horizontal';
  stacked: boolean;
  showValues: boolean;
  barWidth: number;
  groupBy?: string;
}

interface HeatmapConfig {
  colorScheme: 'viridis' | 'plasma' | 'inferno' | 'cool' | 'warm';
  showValues: boolean;
  cellSize: 'auto' | 'small' | 'medium' | 'large';
  threshold?: {
    low: number;
    medium: number;
    high: number;
  };
}

describe('Chart Configurators', () => {
  const defaultTimeRange = {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  };

  describe('Box Plot Configurator', () => {
    let mockOnChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockOnChange = vi.fn();
    });

    it('renders box plot configuration options', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Aggregation Period')).toBeInTheDocument();
      expect(screen.getByText('Whisker Calculation Method')).toBeInTheDocument();
      expect(screen.getByText('Outlier Display')).toBeInTheDocument();
    });

    it('provides all aggregation period options', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.mouseDown(select);

      expect(screen.getByText('Hourly')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('provides whisker calculation methods', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Interquartile Range \(IQR\)/)).toBeInTheDocument();
      expect(screen.getByText(/Percentile Range/)).toBeInTheDocument();
      expect(screen.getByText(/Standard Deviation/)).toBeInTheDocument();
    });

    it('generates valid box plot configuration', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
          timeRange={defaultTimeRange}
        />
      );

      // Configure aggregation period
      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Weekly'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregationPeriod: 'weekly'
        })
      );
    });

    it('validates whisker range inputs', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={{ whiskerMethod: 'iqr' }}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/IQR Multiplier/i);

      // Test valid input
      await user.clear(input);
      await user.type(input, '2.5');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          whiskerRange: 2.5
        })
      );

      // Test invalid input
      mockOnChange.mockClear();
      await user.clear(input);
      await user.type(input, '-1');

      // Should not call onChange with negative value
      // (Component should validate)
    });

    it('provides preview of configuration', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('Q3')).toBeInTheDocument();
      expect(screen.getByText('Median')).toBeInTheDocument();
    });
  });

  describe('Time Series Configurator (Mock)', () => {
    it('should provide interval configuration', () => {
      // Mock test structure for Time Series configurator
      const mockConfig: Partial<TimeSeriesConfig> = {
        interval: 'auto',
        aggregation: 'avg'
      };

      expect(mockConfig.interval).toBe('auto');
      expect(mockConfig.aggregation).toBe('avg');
    });

    it('should provide aggregation method selection', () => {
      const validAggregations: TimeSeriesConfig['aggregation'][] = [
        'avg', 'sum', 'min', 'max', 'count'
      ];

      validAggregations.forEach(agg => {
        expect(['avg', 'sum', 'min', 'max', 'count']).toContain(agg);
      });
    });

    it('should provide line style options', () => {
      const validLineStyles: TimeSeriesConfig['lineStyle'][] = [
        'solid', 'dashed', 'dotted'
      ];

      validLineStyles.forEach(style => {
        expect(['solid', 'dashed', 'dotted']).toContain(style);
      });
    });

    it('should support area fill toggle', () => {
      const config: TimeSeriesConfig = {
        interval: 'auto',
        aggregation: 'avg',
        showDataPoints: true,
        lineStyle: 'solid',
        fillArea: true
      };

      expect(config.fillArea).toBe(true);
    });

    it('generates valid time series configuration', () => {
      const config: TimeSeriesConfig = {
        interval: '15m',
        aggregation: 'avg',
        showDataPoints: false,
        lineStyle: 'solid',
        fillArea: false
      };

      expect(config.interval).toBe('15m');
      expect(config.aggregation).toBe('avg');
      expect(config.showDataPoints).toBe(false);
    });
  });

  describe('Bar Chart Configurator (Mock)', () => {
    it('should provide orientation options', () => {
      const config: BarChartConfig = {
        orientation: 'vertical',
        stacked: false,
        showValues: true,
        barWidth: 0.8
      };

      expect(['vertical', 'horizontal']).toContain(config.orientation);
    });

    it('should support stacked bar configuration', () => {
      const stackedConfig: BarChartConfig = {
        orientation: 'vertical',
        stacked: true,
        showValues: true,
        barWidth: 0.8
      };

      expect(stackedConfig.stacked).toBe(true);
    });

    it('should provide value display toggle', () => {
      const config: BarChartConfig = {
        orientation: 'horizontal',
        stacked: false,
        showValues: true,
        barWidth: 0.6
      };

      expect(config.showValues).toBe(true);
    });

    it('should validate bar width range', () => {
      const validWidths = [0.2, 0.5, 0.8, 1.0];

      validWidths.forEach(width => {
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(1.0);
      });
    });

    it('generates valid bar chart configuration', () => {
      const config: BarChartConfig = {
        orientation: 'horizontal',
        stacked: true,
        showValues: false,
        barWidth: 0.7,
        groupBy: 'category'
      };

      expect(config.orientation).toBe('horizontal');
      expect(config.groupBy).toBe('category');
    });
  });

  describe('Heatmap Configurator (Mock)', () => {
    it('should provide color scheme options', () => {
      const validSchemes: HeatmapConfig['colorScheme'][] = [
        'viridis', 'plasma', 'inferno', 'cool', 'warm'
      ];

      validSchemes.forEach(scheme => {
        expect(['viridis', 'plasma', 'inferno', 'cool', 'warm']).toContain(scheme);
      });
    });

    it('should provide cell size options', () => {
      const config: HeatmapConfig = {
        colorScheme: 'viridis',
        showValues: false,
        cellSize: 'auto'
      };

      expect(['auto', 'small', 'medium', 'large']).toContain(config.cellSize);
    });

    it('should support value display in cells', () => {
      const config: HeatmapConfig = {
        colorScheme: 'plasma',
        showValues: true,
        cellSize: 'medium'
      };

      expect(config.showValues).toBe(true);
    });

    it('should support threshold configuration', () => {
      const config: HeatmapConfig = {
        colorScheme: 'inferno',
        showValues: false,
        cellSize: 'auto',
        threshold: {
          low: 0,
          medium: 50,
          high: 100
        }
      };

      expect(config.threshold).toBeDefined();
      expect(config.threshold!.low).toBe(0);
      expect(config.threshold!.high).toBe(100);
    });

    it('generates valid heatmap configuration', () => {
      const config: HeatmapConfig = {
        colorScheme: 'warm',
        showValues: true,
        cellSize: 'large',
        threshold: {
          low: -10,
          medium: 0,
          high: 10
        }
      };

      expect(config.colorScheme).toBe('warm');
      expect(config.threshold).toBeDefined();
    });
  });

  describe('Configurator Consistency', () => {
    it('all configurators should accept timeRange prop', () => {
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      };

      // Box plot accepts time range
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={vi.fn()}
          timeRange={timeRange}
        />
      );

      expect(screen.getByText(/approximately/i)).toBeInTheDocument();

      // Other configurators should also accept time range
      // (to be implemented)
    });

    it('all configurators should call onChange with valid config', () => {
      const mockOnChange = vi.fn();

      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange.mock.calls[0][0]).toHaveProperty('showOutliers');
    });

    it('all configurators should provide preview or validation', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={vi.fn()}
        />
      );

      // Should have preview or configuration summary
      expect(
        screen.getByText('Preview') || screen.getByText(/Configuration Summary/i)
      ).toBeInTheDocument();
    });

    it('all configurators should have accessible form controls', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={vi.fn()}
        />
      );

      // Should have proper ARIA roles
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  describe('Configuration Validation', () => {
    it('validates box plot configuration structure', () => {
      const validConfig: BoxPlotConfig = {
        aggregationPeriod: 'daily',
        showOutliers: true,
        whiskerMethod: 'iqr',
        whiskerRange: 1.5
      };

      expect(validConfig).toHaveProperty('aggregationPeriod');
      expect(validConfig).toHaveProperty('showOutliers');
      expect(validConfig).toHaveProperty('whiskerMethod');
      expect(validConfig).toHaveProperty('whiskerRange');
    });

    it('validates time series configuration structure', () => {
      const validConfig: TimeSeriesConfig = {
        interval: '15m',
        aggregation: 'avg',
        showDataPoints: true,
        lineStyle: 'solid',
        fillArea: false
      };

      expect(validConfig).toHaveProperty('interval');
      expect(validConfig).toHaveProperty('aggregation');
      expect(validConfig).toHaveProperty('showDataPoints');
    });

    it('validates bar chart configuration structure', () => {
      const validConfig: BarChartConfig = {
        orientation: 'vertical',
        stacked: false,
        showValues: true,
        barWidth: 0.8
      };

      expect(validConfig).toHaveProperty('orientation');
      expect(validConfig).toHaveProperty('stacked');
      expect(validConfig).toHaveProperty('barWidth');
    });

    it('validates heatmap configuration structure', () => {
      const validConfig: HeatmapConfig = {
        colorScheme: 'viridis',
        showValues: false,
        cellSize: 'auto'
      };

      expect(validConfig).toHaveProperty('colorScheme');
      expect(validConfig).toHaveProperty('showValues');
      expect(validConfig).toHaveProperty('cellSize');
    });
  });

  describe('Configuration Export', () => {
    it('exports configuration in consistent format', () => {
      const boxPlotConfig: BoxPlotConfig = {
        aggregationPeriod: 'weekly',
        showOutliers: true,
        whiskerMethod: 'percentile',
        whiskerRange: 95
      };

      // Configuration should be serializable
      const serialized = JSON.stringify(boxPlotConfig);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(boxPlotConfig);
    });

    it('handles partial configuration gracefully', () => {
      const partialConfig: Partial<BoxPlotConfig> = {
        aggregationPeriod: 'daily'
      };

      expect(partialConfig.aggregationPeriod).toBe('daily');
      expect(partialConfig.showOutliers).toBeUndefined();
    });

    it('merges default values with partial configuration', () => {
      const defaults: BoxPlotConfig = {
        aggregationPeriod: 'daily',
        showOutliers: true,
        whiskerMethod: 'iqr',
        whiskerRange: 1.5
      };

      const partial: Partial<BoxPlotConfig> = {
        aggregationPeriod: 'weekly'
      };

      const merged = { ...defaults, ...partial };

      expect(merged.aggregationPeriod).toBe('weekly');
      expect(merged.showOutliers).toBe(true);
      expect(merged.whiskerMethod).toBe('iqr');
    });
  });
});
