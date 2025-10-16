# BoxPlotAggregationConfigurator Usage Guide

## Overview

The `BoxPlotAggregationConfigurator` component provides a comprehensive interface for configuring box plot statistical analysis settings. It allows users to customize aggregation periods, whisker calculation methods, and outlier display options.

## Basic Usage

```typescript
import React, { useState } from 'react';
import { BoxPlotAggregationConfigurator, BoxPlotConfig } from '@/components/charts/configurators';

function MyChartWizard() {
  const [config, setConfig] = useState<Partial<BoxPlotConfig>>({
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  });

  const handleConfigChange = (newConfig: Partial<BoxPlotConfig>) => {
    setConfig(newConfig);
    // Optionally trigger chart update
  };

  return (
    <BoxPlotAggregationConfigurator
      config={config}
      onChange={handleConfigChange}
      timeRange={{
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      }}
    />
  );
}
```

## Configuration Options

### BoxPlotConfig Interface

```typescript
interface BoxPlotConfig {
  aggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  showOutliers: boolean;
  whiskerMethod: 'iqr' | 'percentile' | 'stddev';
  whiskerRange: number;
}
```

### Aggregation Period

Determines how data points are grouped:

- **hourly**: Groups by hour (best for short time ranges)
- **daily**: Groups by day (recommended for most use cases)
- **weekly**: Groups by week (good for longer trends)
- **monthly**: Groups by month (best for yearly analysis)

```typescript
// Example: Configure for weekly aggregation
const config = {
  aggregationPeriod: 'weekly',
  // ... other config
};
```

### Whisker Calculation Methods

#### 1. Interquartile Range (IQR) - Recommended

```typescript
const config = {
  whiskerMethod: 'iqr',
  whiskerRange: 1.5 // Standard multiplier
};
```

- **Formula**: Q1 - 1.5×IQR to Q3 + 1.5×IQR
- **Best for**: General-purpose analysis, robust to outliers
- **Range values**: Typically 1.5 (standard) or 3.0 (conservative)

#### 2. Percentile Range

```typescript
const config = {
  whiskerMethod: 'percentile',
  whiskerRange: 95 // Show 5th to 95th percentile
};
```

- **Formula**: Pₙ to P₁₀₀₋ₙ
- **Best for**: Showing specific data distribution percentage
- **Range values**: 90, 95, 99 (common percentiles)

#### 3. Standard Deviation

```typescript
const config = {
  whiskerMethod: 'stddev',
  whiskerRange: 2 // ±2 standard deviations
};
```

- **Formula**: μ - nσ to μ + nσ
- **Best for**: Normally distributed data
- **Range values**: 1, 2, or 3 standard deviations

### Outlier Display

```typescript
const config = {
  showOutliers: true // Display points beyond whiskers
};
```

Controls whether data points beyond whisker range are shown as individual dots.

## Advanced Integration

### With Chart Configuration Wizard

```typescript
import React, { useState } from 'react';
import {
  BoxPlotAggregationConfigurator,
  BoxPlotConfig
} from '@/components/charts/configurators';
import { Stepper, Step, StepLabel, Button } from '@mui/material';

function ChartConfigurationWizard() {
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<Partial<BoxPlotConfig>>({});

  const steps = [
    'Select Metrics',
    'Configure Aggregation',
    'Preview Chart'
  ];

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  return (
    <div>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 1 && (
        <BoxPlotAggregationConfigurator
          config={config}
          onChange={setConfig}
          timeRange={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          }}
        />
      )}

      <div>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={activeStep === steps.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

### With Real-Time Chart Updates

```typescript
import React, { useState, useEffect } from 'react';
import { BoxPlotAggregationConfigurator } from '@/components/charts/configurators';
import { BoxPlotChart } from '@/components/charts/BoxPlotChart';

function LiveBoxPlotDemo() {
  const [config, setConfig] = useState<BoxPlotConfig>({
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  });

  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Fetch and process data based on config
    fetchChartData(config).then(setChartData);
  }, [config]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
      <div>
        <h3>Configuration</h3>
        <BoxPlotAggregationConfigurator
          config={config}
          onChange={setConfig}
          timeRange={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          }}
        />
      </div>
      <div>
        <h3>Chart Preview</h3>
        <BoxPlotChart data={chartData} config={config} />
      </div>
    </div>
  );
}
```

### Validation Example

```typescript
import React, { useState } from 'react';
import { BoxPlotAggregationConfigurator, BoxPlotConfig } from '@/components/charts/configurators';
import { Alert } from '@mui/material';

function ValidatedConfigurator() {
  const [config, setConfig] = useState<Partial<BoxPlotConfig>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const validateConfig = (newConfig: Partial<BoxPlotConfig>): string[] => {
    const errors: string[] = [];

    if (newConfig.whiskerMethod === 'percentile') {
      if (newConfig.whiskerRange && (newConfig.whiskerRange < 50 || newConfig.whiskerRange > 99)) {
        errors.push('Percentile value should be between 50 and 99');
      }
    }

    if (newConfig.whiskerMethod === 'iqr') {
      if (newConfig.whiskerRange && newConfig.whiskerRange < 0.5) {
        errors.push('IQR multiplier should be at least 0.5');
      }
    }

    return errors;
  };

  const handleConfigChange = (newConfig: Partial<BoxPlotConfig>) => {
    const validationErrors = validateConfig(newConfig);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      setConfig(newConfig);
    }
  };

  return (
    <div>
      {errors.length > 0 && (
        <Alert severity="error">
          {errors.map((error, idx) => (
            <div key={idx}>{error}</div>
          ))}
        </Alert>
      )}

      <BoxPlotAggregationConfigurator
        config={config}
        onChange={handleConfigChange}
      />
    </div>
  );
}
```

## Use Cases

### 1. Performance Metrics Analysis

```typescript
// Analyze page load times with outlier detection
const performanceConfig: BoxPlotConfig = {
  aggregationPeriod: 'hourly',
  showOutliers: true, // Show slow loads
  whiskerMethod: 'iqr',
  whiskerRange: 1.5
};
```

### 2. Web Vitals Monitoring

```typescript
// Monitor Core Web Vitals distribution
const webVitalsConfig: BoxPlotConfig = {
  aggregationPeriod: 'daily',
  showOutliers: true,
  whiskerMethod: 'percentile',
  whiskerRange: 95 // Show 95th percentile
};
```

### 3. Long-term Trend Analysis

```typescript
// Analyze monthly performance trends
const trendConfig: BoxPlotConfig = {
  aggregationPeriod: 'monthly',
  showOutliers: false, // Hide outliers for cleaner view
  whiskerMethod: 'stddev',
  whiskerRange: 2
};
```

### 4. Comparative Analysis

```typescript
// Compare different time periods
const compareConfig: BoxPlotConfig = {
  aggregationPeriod: 'weekly',
  showOutliers: true,
  whiskerMethod: 'iqr',
  whiskerRange: 1.5
};
```

## Props Reference

### BoxPlotAggregationConfigurator Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `Partial<BoxPlotConfig>` | Yes | Current configuration state |
| `onChange` | `(config: Partial<BoxPlotConfig>) => void` | Yes | Callback when config changes |
| `timeRange` | `{ start: Date; end: Date }` | No | Time range for estimating data points |

### BoxPlotConfig Properties

| Property | Type | Options | Default | Description |
|----------|------|---------|---------|-------------|
| `aggregationPeriod` | `string` | 'hourly', 'daily', 'weekly', 'monthly' | 'daily' | Data grouping period |
| `showOutliers` | `boolean` | true, false | true | Display outlier points |
| `whiskerMethod` | `string` | 'iqr', 'percentile', 'stddev' | 'iqr' | Whisker calculation method |
| `whiskerRange` | `number` | Depends on method | 1.5 (IQR) | Range parameter |

## Styling Customization

The component uses Material-UI's theming system. Customize via theme:

```typescript
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          // Customize paper background
          backgroundColor: '#f5f5f5',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          // Customize alert styling
          borderRadius: 8,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BoxPlotAggregationConfigurator {...props} />
    </ThemeProvider>
  );
}
```

## Accessibility

The component follows WCAG 2.1 AA guidelines:

- All form controls have proper labels
- Radio groups and checkboxes are keyboard navigable
- Color contrast meets accessibility standards
- ARIA attributes for screen readers

## Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoxPlotAggregationConfigurator } from './BoxPlotAggregationConfigurator';

test('updates config when aggregation period changes', async () => {
  const onChange = jest.fn();
  const user = userEvent.setup();

  render(
    <BoxPlotAggregationConfigurator
      config={{ aggregationPeriod: 'daily' }}
      onChange={onChange}
    />
  );

  const select = screen.getByRole('combobox');
  await user.click(select);
  await user.click(screen.getByText('Weekly'));

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ aggregationPeriod: 'weekly' })
  );
});
```

## Performance Considerations

- Component uses `useMemo` for expensive calculations
- Preview updates are optimized to prevent unnecessary re-renders
- Configuration changes are debounced for real-time chart updates

## Best Practices

1. **Always provide timeRange** when available for better UX
2. **Use IQR method** as default for most analyses
3. **Show outliers** by default to identify anomalies
4. **Daily aggregation** is recommended for most web metrics
5. **Validate whiskerRange** based on selected method
6. **Persist configuration** for consistent user experience

## Related Components

- `BoxPlotChart` - Renders the actual box plot visualization
- `ChartConfigurationWizard` - Multi-step chart configuration
- `MetricSelector` - Selects which metrics to visualize
- `TimeRangeSelector` - Configures time range for analysis

## Support

For issues or questions:
- GitHub Issues: [project-repo]/issues
- Documentation: [project-docs]/charts
- Examples: [project-examples]/box-plots
