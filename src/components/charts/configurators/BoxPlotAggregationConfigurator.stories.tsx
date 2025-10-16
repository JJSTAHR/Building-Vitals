/**
 * BoxPlotAggregationConfigurator Storybook Stories
 *
 * Interactive documentation and testing for the configurator component
 */

import React, { useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Box, Paper, Typography } from '@mui/material';
import {
  BoxPlotAggregationConfigurator,
  BoxPlotConfig,
  ConfigStepProps
} from './BoxPlotAggregationConfigurator';

const meta: Meta<typeof BoxPlotAggregationConfigurator> = {
  title: 'Charts/Configurators/BoxPlotAggregation',
  component: BoxPlotAggregationConfigurator,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# BoxPlotAggregationConfigurator

A comprehensive configuration interface for box plot statistical analysis settings.

## Features
- Aggregation period selection (hourly, daily, weekly, monthly)
- Three whisker calculation methods (IQR, Percentile, Standard Deviation)
- Outlier display toggle
- Live preview with visual explanation
- Automatic data point estimation

## Use Cases
- Performance metrics analysis
- Web Vitals monitoring
- Trend analysis over time
- Statistical distribution visualization
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    config: {
      description: 'Current configuration state',
      control: 'object',
    },
    onChange: {
      description: 'Callback when configuration changes',
      action: 'onChange',
    },
    timeRange: {
      description: 'Optional time range for data point estimation',
      control: 'object',
    },
  },
};

export default meta;
type Story = StoryObj<typeof BoxPlotAggregationConfigurator>;

/**
 * Interactive wrapper to demonstrate state management
 */
const InteractiveWrapper: React.FC<Partial<ConfigStepProps>> = (props) => {
  const [config, setConfig] = useState<Partial<BoxPlotConfig>>(
    props.config || {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    }
  );

  const handleChange = (newConfig: Partial<BoxPlotConfig>) => {
    setConfig(newConfig);
    action('onChange')(newConfig);
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
      <BoxPlotAggregationConfigurator
        config={config}
        onChange={handleChange}
        timeRange={props.timeRange}
      />

      {/* Display current config for debugging */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.100' }}>
        <Typography variant="h6" gutterBottom>
          Current Configuration (Debug)
        </Typography>
        <pre style={{ overflow: 'auto' }}>
          {JSON.stringify(config, null, 2)}
        </pre>
      </Paper>
    </Box>
  );
};

/**
 * Default story with standard configuration
 */
export const Default: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
};

/**
 * Hourly aggregation for short time periods
 */
export const HourlyAggregation: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'hourly',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01T00:00:00'),
      end: new Date('2024-01-02T00:00:00'),
    },
  },
};

/**
 * Weekly aggregation for medium-term analysis
 */
export const WeeklyAggregation: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'weekly',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-06-30'),
    },
  },
};

/**
 * Monthly aggregation for long-term trends
 */
export const MonthlyAggregation: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'monthly',
      showOutliers: false,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2023-01-01'),
      end: new Date('2024-12-31'),
    },
  },
};

/**
 * Using Percentile method for distribution analysis
 */
export const PercentileMethod: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'percentile',
      whiskerRange: 95,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
};

/**
 * Using Standard Deviation for normal distributions
 */
export const StandardDeviationMethod: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'stddev',
      whiskerRange: 2,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
};

/**
 * Conservative IQR with 3.0 multiplier
 */
export const ConservativeIQR: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 3.0,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
};

/**
 * Configuration with outliers hidden
 */
export const OutliersHidden: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: false,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
};

/**
 * Minimal configuration (uses defaults)
 */
export const MinimalConfig: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {},
  },
};

/**
 * Without time range (no data point estimation)
 */
export const WithoutTimeRange: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
  },
};

/**
 * Performance metrics use case
 */
export const PerformanceMetrics: Story = {
  render: (args) => (
    <Box>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
        <Typography variant="h6" gutterBottom>
          Use Case: Performance Metrics Analysis
        </Typography>
        <Typography variant="body2">
          Analyzing page load times with hourly aggregation to identify slow periods.
          IQR method helps identify outliers that may indicate performance issues.
        </Typography>
      </Paper>
      <InteractiveWrapper {...args} />
    </Box>
  ),
  args: {
    config: {
      aggregationPeriod: 'hourly',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01T00:00:00'),
      end: new Date('2024-01-07T23:59:59'),
    },
  },
};

/**
 * Web Vitals monitoring use case
 */
export const WebVitalsMonitoring: Story = {
  render: (args) => (
    <Box>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.light' }}>
        <Typography variant="h6" gutterBottom>
          Use Case: Core Web Vitals Monitoring
        </Typography>
        <Typography variant="body2">
          Daily aggregation with 95th percentile to monitor Core Web Vitals.
          This matches how Google measures web performance.
        </Typography>
      </Paper>
      <InteractiveWrapper {...args} />
    </Box>
  ),
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'percentile',
      whiskerRange: 95,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-03-31'),
    },
  },
};

/**
 * Long-term trend analysis use case
 */
export const LongTermTrends: Story = {
  render: (args) => (
    <Box>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
        <Typography variant="h6" gutterBottom>
          Use Case: Long-term Trend Analysis
        </Typography>
        <Typography variant="body2">
          Monthly aggregation for analyzing year-over-year trends.
          Outliers hidden for cleaner visualization of overall patterns.
        </Typography>
      </Paper>
      <InteractiveWrapper {...args} />
    </Box>
  ),
  args: {
    config: {
      aggregationPeriod: 'monthly',
      showOutliers: false,
      whiskerMethod: 'stddev',
      whiskerRange: 2,
    },
    timeRange: {
      start: new Date('2022-01-01'),
      end: new Date('2024-12-31'),
    },
  },
};

/**
 * Comparison of all whisker methods
 */
export const MethodComparison: Story = {
  render: () => {
    const [iqrConfig, setIqrConfig] = useState<Partial<BoxPlotConfig>>({
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    });

    const [percentileConfig, setPercentileConfig] = useState<Partial<BoxPlotConfig>>({
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'percentile',
      whiskerRange: 95,
    });

    const [stddevConfig, setStddevConfig] = useState<Partial<BoxPlotConfig>>({
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'stddev',
      whiskerRange: 2,
    });

    const timeRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    };

    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Whisker Method Comparison
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom color="primary">
              IQR Method (Recommended)
            </Typography>
            <BoxPlotAggregationConfigurator
              config={iqrConfig}
              onChange={setIqrConfig}
              timeRange={timeRange}
            />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom color="secondary">
              Percentile Method
            </Typography>
            <BoxPlotAggregationConfigurator
              config={percentileConfig}
              onChange={setPercentileConfig}
              timeRange={timeRange}
            />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom color="info.main">
              Standard Deviation Method
            </Typography>
            <BoxPlotAggregationConfigurator
              config={stddevConfig}
              onChange={setStddevConfig}
              timeRange={timeRange}
            />
          </Paper>
        </Box>
      </Box>
    );
  },
};

/**
 * Responsive layout demonstration
 */
export const ResponsiveLayout: Story = {
  render: (args) => (
    <Box sx={{ maxWidth: { xs: '100%', sm: 600, md: 800, lg: 1000 } }}>
      <InteractiveWrapper {...args} />
    </Box>
  ),
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5,
    },
    timeRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Extreme values testing
 */
export const ExtremeValues: Story = {
  render: (args) => <InteractiveWrapper {...args} />,
  args: {
    config: {
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 0.5, // Very narrow range
    },
    timeRange: {
      start: new Date('2020-01-01'),
      end: new Date('2024-12-31'),
    },
  },
};
