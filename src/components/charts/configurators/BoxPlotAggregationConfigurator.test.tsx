/**
 * BoxPlotAggregationConfigurator Tests
 *
 * Comprehensive test suite for box plot configuration component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoxPlotAggregationConfigurator, BoxPlotConfig } from './BoxPlotAggregationConfigurator';

describe('BoxPlotAggregationConfigurator', () => {
  const mockOnChange = jest.fn();
  const defaultConfig: Partial<BoxPlotConfig> = {
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  };

  const defaultTimeRange = {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Aggregation Period', () => {
    it('renders aggregation period selector with all options', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Aggregation Period')).toBeInTheDocument();

      // Click to open dropdown
      const select = screen.getByRole('combobox');
      fireEvent.mouseDown(select);

      // Check all options are present
      expect(screen.getByText('Hourly')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('calls onChange when aggregation period changes', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.click(select);

      const weeklyOption = screen.getByText('Weekly');
      await user.click(weeklyOption);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregationPeriod: 'weekly'
        })
      );
    });

    it('displays estimated data points when timeRange provided', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
          timeRange={defaultTimeRange}
        />
      );

      // Should show info about data points
      expect(screen.getByText(/approximately/i)).toBeInTheDocument();
      expect(screen.getByText(/data points/i)).toBeInTheDocument();
    });

    it('calculates correct data points for hourly aggregation', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, aggregationPeriod: 'hourly' }}
          onChange={mockOnChange}
          timeRange={defaultTimeRange}
        />
      );

      // 31 days * 24 hours = 744 hours
      expect(screen.getByText(/744/)).toBeInTheDocument();
    });
  });

  describe('Whisker Calculation Method', () => {
    it('renders all whisker method options', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Whisker Calculation Method')).toBeInTheDocument();
      expect(screen.getByText(/Interquartile Range \(IQR\)/)).toBeInTheDocument();
      expect(screen.getByText(/Percentile Range/)).toBeInTheDocument();
      expect(screen.getByText(/Standard Deviation/)).toBeInTheDocument();
    });

    it('marks IQR as recommended', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('calls onChange when whisker method changes', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      const percentileRadio = screen.getByRole('radio', { name: /Percentile Range/i });
      await user.click(percentileRadio);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          whiskerMethod: 'percentile',
          whiskerRange: 95 // Default for percentile
        })
      );
    });

    it('displays correct explanation for IQR method', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'iqr' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Standard statistical method/i)).toBeInTheDocument();
      expect(screen.getByText(/Q1 - 1.5 × IQR/i)).toBeInTheDocument();
    });

    it('displays correct explanation for percentile method', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'percentile' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/specific percentage of data distribution/i)).toBeInTheDocument();
    });

    it('displays correct explanation for stddev method', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'stddev' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/normally distributed data/i)).toBeInTheDocument();
      expect(screen.getByText(/μ - nσ/i)).toBeInTheDocument();
    });
  });

  describe('Whisker Range Input', () => {
    it('renders whisker range input with correct label for IQR', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'iqr' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText(/IQR Multiplier/i)).toBeInTheDocument();
    });

    it('renders whisker range input with correct label for percentile', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'percentile' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText(/Percentile Value/i)).toBeInTheDocument();
    });

    it('renders whisker range input with correct label for stddev', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'stddev' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText(/Standard Deviation Multiplier/i)).toBeInTheDocument();
    });

    it('calls onChange when whisker range value changes', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/IQR Multiplier/i);
      await user.clear(input);
      await user.type(input, '2.0');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          whiskerRange: 2.0
        })
      );
    });

    it('ignores invalid whisker range values', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/IQR Multiplier/i);
      await user.clear(input);
      await user.type(input, 'invalid');

      // Should not call onChange with NaN
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Outlier Display', () => {
    it('renders outlier checkbox', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Outlier Display')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Show outlier points/i })).toBeInTheDocument();
    });

    it('checkbox reflects current outlier setting', () => {
      const { rerender } = render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: true }}
          onChange={mockOnChange}
        />
      );

      let checkbox = screen.getByRole('checkbox', { name: /Show outlier points/i });
      expect(checkbox).toBeChecked();

      rerender(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: false }}
          onChange={mockOnChange}
        />
      );

      checkbox = screen.getByRole('checkbox', { name: /Show outlier points/i });
      expect(checkbox).not.toBeChecked();
    });

    it('calls onChange when outlier checkbox toggled', async () => {
      const user = userEvent.setup();
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: true }}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Show outlier points/i });
      await user.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          showOutliers: false
        })
      );
    });

    it('displays outlier explanation', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/identify anomalies and extreme values/i)).toBeInTheDocument();
    });
  });

  describe('Preview Section', () => {
    it('renders preview section', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('displays box plot visual elements', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      // Check for quartile labels
      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('Q3')).toBeInTheDocument();
      expect(screen.getByText('Median')).toBeInTheDocument();
    });

    it('shows outliers in preview when enabled', () => {
      const { container } = render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: true }}
          onChange={mockOnChange}
        />
      );

      // Outliers are rendered as small circles
      // Check legend includes outliers
      expect(screen.getByText('Outliers')).toBeInTheDocument();
    });

    it('hides outliers in preview when disabled', () => {
      const { container } = render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: false }}
          onChange={mockOnChange}
        />
      );

      // Legend should not include outliers
      expect(screen.queryByText('Outliers')).not.toBeInTheDocument();
    });

    it('displays legend with all components', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Interquartile Range \(Q1-Q3\)/i)).toBeInTheDocument();
      expect(screen.getByText('Median')).toBeInTheDocument();
      expect(screen.getByText('Whiskers')).toBeInTheDocument();
    });

    it('updates preview label based on whisker method', () => {
      const { rerender } = render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'iqr', whiskerRange: 1.5 }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/1.5 × IQR/i)).toBeInTheDocument();

      rerender(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'percentile', whiskerRange: 95 }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/95th percentile/i)).toBeInTheDocument();
    });
  });

  describe('Configuration Summary', () => {
    it('displays configuration summary', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Configuration Summary/i)).toBeInTheDocument();
    });

    it('summary reflects current aggregation period', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, aggregationPeriod: 'weekly' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/aggregated by weekly periods/i)).toBeInTheDocument();
    });

    it('summary reflects current whisker method', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'stddev' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Standard Deviation/i)).toBeInTheDocument();
    });

    it('summary reflects outlier setting', () => {
      const { rerender } = render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: true }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/with outliers displayed/i)).toBeInTheDocument();

      rerender(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, showOutliers: false }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/outliers hidden/i)).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('uses defaults when config is empty', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={{}}
          onChange={mockOnChange}
        />
      );

      // Should use default values
      const select = screen.getByRole('combobox');
      expect(select).toHaveTextContent('Daily');

      const iqrRadio = screen.getByRole('radio', { name: /Interquartile Range/i });
      expect(iqrRadio).toBeChecked();

      const checkbox = screen.getByRole('checkbox', { name: /Show outlier points/i });
      expect(checkbox).toBeChecked();
    });

    it('uses default whisker ranges for each method', () => {
      const { rerender } = render(
        <BoxPlotAggregationConfigurator
          config={{ whiskerMethod: 'iqr' }}
          onChange={mockOnChange}
        />
      );

      let input = screen.getByLabelText(/IQR Multiplier/i);
      expect(input).toHaveValue(1.5);

      rerender(
        <BoxPlotAggregationConfigurator
          config={{ whiskerMethod: 'percentile' }}
          onChange={mockOnChange}
        />
      );

      input = screen.getByLabelText(/Percentile Value/i);
      expect(input).toHaveValue(95);

      rerender(
        <BoxPlotAggregationConfigurator
          config={{ whiskerMethod: 'stddev' }}
          onChange={mockOnChange}
        />
      );

      input = screen.getByLabelText(/Standard Deviation Multiplier/i);
      expect(input).toHaveValue(2);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for form controls', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('labels are associated with inputs', () => {
      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={mockOnChange}
        />
      );

      const whiskerInput = screen.getByLabelText(/IQR Multiplier/i);
      expect(whiskerInput).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('maintains config consistency when changing multiple settings', async () => {
      const user = userEvent.setup();
      const onChangeCallback = jest.fn();

      render(
        <BoxPlotAggregationConfigurator
          config={defaultConfig}
          onChange={onChangeCallback}
        />
      );

      // Change aggregation period
      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Weekly'));

      expect(onChangeCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aggregationPeriod: 'weekly',
          showOutliers: true,
          whiskerMethod: 'iqr',
          whiskerRange: 1.5
        })
      );

      // Toggle outliers
      const checkbox = screen.getByRole('checkbox', { name: /Show outlier points/i });
      await user.click(checkbox);

      expect(onChangeCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aggregationPeriod: 'weekly',
          showOutliers: false,
          whiskerMethod: 'iqr',
          whiskerRange: 1.5
        })
      );
    });

    it('correctly updates whisker range when method changes', async () => {
      const user = userEvent.setup();
      const onChangeCallback = jest.fn();

      render(
        <BoxPlotAggregationConfigurator
          config={{ ...defaultConfig, whiskerMethod: 'iqr', whiskerRange: 1.5 }}
          onChange={onChangeCallback}
        />
      );

      // Change to percentile method
      const percentileRadio = screen.getByRole('radio', { name: /Percentile Range/i });
      await user.click(percentileRadio);

      // Should automatically update whisker range to default for percentile
      expect(onChangeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          whiskerMethod: 'percentile',
          whiskerRange: 95
        })
      );
    });
  });
});
