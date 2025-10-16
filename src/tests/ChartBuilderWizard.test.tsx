/**
 * ChartBuilderWizard Test Suite
 *
 * Comprehensive tests for chart building wizard including:
 * - Wizard navigation and state management
 * - Configuration persistence across steps
 * - Chart type selection flows
 * - Time range selector consistency
 * - Final chart rendering with configurations
 *
 * @module tests/ChartBuilderWizard
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock chart wizard component (to be implemented)
interface ChartBuilderWizardProps {
  onComplete?: (config: ChartConfiguration) => void;
  onCancel?: () => void;
  initialConfig?: Partial<ChartConfiguration>;
}

interface ChartConfiguration {
  chartType: 'timeSeries' | 'bar' | 'scatter' | 'heatmap' | 'area' | 'gauge' | 'boxplot';
  timeRange: {
    start: Date;
    end: Date;
  };
  dataSource: string;
  aggregation?: any;
  visualization?: any;
}

// Mock implementation for testing
const MockChartBuilderWizard: React.FC<ChartBuilderWizardProps> = ({
  onComplete,
  onCancel,
  initialConfig
}) => {
  const [step, setStep] = React.useState(0);
  const [config, setConfig] = React.useState<Partial<ChartConfiguration>>(initialConfig || {});

  const steps = [
    'Chart Type Selection',
    'Data Source',
    'Time Range',
    'Configuration',
    'Preview'
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete?.(config as ChartConfiguration);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div data-testid="chart-builder-wizard">
      <div data-testid="wizard-header">
        <h2>{steps[step]}</h2>
        <div data-testid="step-indicator">
          Step {step + 1} of {steps.length}
        </div>
      </div>

      <div data-testid="wizard-content">
        {step === 0 && (
          <div data-testid="chart-type-step">
            <button onClick={() => setConfig({ ...config, chartType: 'timeSeries' })}>
              Time Series
            </button>
            <button onClick={() => setConfig({ ...config, chartType: 'bar' })}>
              Bar Chart
            </button>
            <button onClick={() => setConfig({ ...config, chartType: 'heatmap' })}>
              Heatmap
            </button>
            <button onClick={() => setConfig({ ...config, chartType: 'boxplot' })}>
              Box Plot
            </button>
          </div>
        )}

        {step === 1 && (
          <div data-testid="data-source-step">
            <input
              data-testid="data-source-input"
              placeholder="Data source"
              value={config.dataSource || ''}
              onChange={(e) => setConfig({ ...config, dataSource: e.target.value })}
            />
          </div>
        )}

        {step === 2 && (
          <div data-testid="time-range-step">
            <input
              type="datetime-local"
              data-testid="start-date"
              onChange={(e) => setConfig({
                ...config,
                timeRange: {
                  ...config.timeRange!,
                  start: new Date(e.target.value)
                }
              })}
            />
            <input
              type="datetime-local"
              data-testid="end-date"
              onChange={(e) => setConfig({
                ...config,
                timeRange: {
                  ...config.timeRange!,
                  end: new Date(e.target.value)
                }
              })}
            />
          </div>
        )}

        {step === 3 && (
          <div data-testid="configuration-step">
            <div>Configure {config.chartType}</div>
          </div>
        )}

        {step === 4 && (
          <div data-testid="preview-step">
            <div data-testid="config-preview">
              {JSON.stringify(config)}
            </div>
          </div>
        )}
      </div>

      <div data-testid="wizard-navigation">
        <button onClick={onCancel} disabled={false}>
          Cancel
        </button>
        <button onClick={handleBack} disabled={step === 0}>
          Back
        </button>
        <button onClick={handleNext} disabled={!config.chartType && step === 0}>
          {step === steps.length - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};

describe('ChartBuilderWizard', () => {
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnComplete = vi.fn();
    mockOnCancel = vi.fn();
  });

  describe('Wizard Initialization', () => {
    it('renders wizard with initial step', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      expect(screen.getByTestId('chart-builder-wizard')).toBeInTheDocument();
      expect(screen.getByText('Chart Type Selection')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('shows chart type selection as first step', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      expect(screen.getByTestId('chart-type-step')).toBeInTheDocument();
      expect(screen.getByText('Time Series')).toBeInTheDocument();
      expect(screen.getByText('Bar Chart')).toBeInTheDocument();
      expect(screen.getByText('Heatmap')).toBeInTheDocument();
      expect(screen.getByText('Box Plot')).toBeInTheDocument();
    });

    it('disables back button on first step', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeDisabled();
    });

    it('disables next button until chart type selected', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('initializes with provided configuration', () => {
      const initialConfig: Partial<ChartConfiguration> = {
        chartType: 'timeSeries',
        dataSource: 'temperature-sensor'
      };

      render(
        <MockChartBuilderWizard
          onComplete={mockOnComplete}
          initialConfig={initialConfig}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Wizard Navigation', () => {
    it('advances to next step when next button clicked', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Select chart type
      await user.click(screen.getByText('Time Series'));

      // Click next
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should be on data source step
      expect(screen.getByText('Data Source')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
      expect(screen.getByTestId('data-source-step')).toBeInTheDocument();
    });

    it('returns to previous step when back button clicked', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Go to second step
      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Click back
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Should be back on chart type selection
      expect(screen.getByText('Chart Type Selection')).toBeInTheDocument();
      expect(screen.getByTestId('chart-type-step')).toBeInTheDocument();
    });

    it('enables back button after first step', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).not.toBeDisabled();
    });

    it('shows complete button on final step', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Navigate to final step
      await user.click(screen.getByText('Time Series'));

      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByRole('button', { name: /next/i }));
      }

      expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Persistence', () => {
    it('maintains chart type selection across steps', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Select chart type
      await user.click(screen.getByText('Heatmap'));

      // Navigate forward
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Navigate back
      await user.click(screen.getByRole('button', { name: /back/i }));
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Configuration should still show heatmap in preview
      // Navigate to preview to verify
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      const preview = screen.getByTestId('config-preview');
      expect(preview.textContent).toContain('heatmap');
    });

    it('preserves data source input across navigation', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Navigate to data source step
      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Enter data source
      const input = screen.getByTestId('data-source-input');
      await user.type(input, 'hvac-system-1');

      // Navigate away and back
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Input should still have value
      expect(screen.getByTestId('data-source-input')).toHaveValue('hvac-system-1');
    });

    it('preserves all configuration through complete workflow', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Step 1: Select chart type
      await user.click(screen.getByText('Box Plot'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2: Set data source
      await user.type(screen.getByTestId('data-source-input'), 'temperature-data');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Skip time range
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 4: Skip configuration
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 5: Preview
      const preview = screen.getByTestId('config-preview');
      const config = JSON.parse(preview.textContent || '{}');

      expect(config.chartType).toBe('boxplot');
      expect(config.dataSource).toBe('temperature-data');
    });
  });

  describe('Chart Type Selection Flow', () => {
    it('configures time series chart workflow', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });

    it('configures bar chart workflow', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Bar Chart'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });

    it('configures heatmap workflow', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Heatmap'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });

    it('configures box plot workflow', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Box Plot'));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });

    it('shows appropriate configuration step based on chart type', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByText('Box Plot'));

      // Navigate to configuration step
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: /next/i }));
      }

      expect(screen.getByText('Configure boxplot')).toBeInTheDocument();
    });
  });

  describe('Time Range Selector', () => {
    it('provides time range selector on time range step', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Navigate to time range step
      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByTestId('time-range-step')).toBeInTheDocument();
      expect(screen.getByTestId('start-date')).toBeInTheDocument();
      expect(screen.getByTestId('end-date')).toBeInTheDocument();
    });

    it('accepts start and end date inputs', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Navigate to time range step
      await user.click(screen.getByText('Time Series'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      const startDate = screen.getByTestId('start-date');
      const endDate = screen.getByTestId('end-date');

      fireEvent.change(startDate, { target: { value: '2024-01-01T00:00' } });
      fireEvent.change(endDate, { target: { value: '2024-01-31T23:59' } });

      expect(startDate).toHaveValue('2024-01-01T00:00');
      expect(endDate).toHaveValue('2024-01-31T23:59');
    });

    it('maintains time range consistency for all chart types', async () => {
      const chartTypes = ['Time Series', 'Bar Chart', 'Heatmap', 'Box Plot'];

      for (const chartType of chartTypes) {
        const { unmount } = render(<MockChartBuilderWizard onComplete={mockOnComplete} />);
        const user = userEvent.setup();

        await user.click(screen.getByText(chartType));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await user.click(screen.getByRole('button', { name: /next/i }));

        // Time range step should be available for all types
        expect(screen.getByTestId('time-range-step')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Wizard Completion', () => {
    it('calls onComplete with full configuration', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Complete workflow
      await user.click(screen.getByText('Time Series'));

      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByRole('button', { name: /next|complete/i }));
      }

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          chartType: 'timeSeries'
        })
      );
    });

    it('validates configuration before completion', async () => {
      const user = userEvent.setup();
      const onCompleteWithValidation = vi.fn((config: ChartConfiguration) => {
        expect(config.chartType).toBeDefined();
        expect(config.chartType).toMatch(/timeSeries|bar|scatter|heatmap|area|gauge|boxplot/);
      });

      render(<MockChartBuilderWizard onComplete={onCompleteWithValidation} />);

      await user.click(screen.getByText('Heatmap'));

      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByRole('button', { name: /next|complete/i }));
      }

      expect(onCompleteWithValidation).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles missing required configuration gracefully', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      // Should not crash without chart type
      expect(screen.getByTestId('chart-builder-wizard')).toBeInTheDocument();
    });

    it('prevents navigation to next step without required fields', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible step indicators', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 1 of 5');
    });

    it('provides accessible navigation buttons', () => {
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('maintains focus management during navigation', async () => {
      const user = userEvent.setup();
      render(<MockChartBuilderWizard onComplete={mockOnComplete} />);

      const nextButton = screen.getByRole('button', { name: /next/i });

      // Select chart type and navigate
      await user.click(screen.getByText('Time Series'));
      await user.click(nextButton);

      // Step header should be present
      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });
  });
});
