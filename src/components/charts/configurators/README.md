# Chart Configurators

Production-ready configuration components for chart customization and statistical analysis settings.

## Overview

This directory contains interactive configuration interfaces for various chart types. Each configurator provides:

- User-friendly controls for all chart parameters
- Real-time preview with visual explanations
- Validation and helpful error messages
- Accessibility support (WCAG 2.1 AA)
- Comprehensive TypeScript types
- Extensive test coverage

## Available Configurators

### BoxPlotAggregationConfigurator

Configures box plot statistical analysis settings.

**File**: `BoxPlotAggregationConfigurator.tsx`

**Features**:
- Aggregation period selection (hourly, daily, weekly, monthly)
- Three whisker calculation methods:
  - IQR (Interquartile Range) - Recommended
  - Percentile Range
  - Standard Deviation
- Outlier display toggle
- Live preview with statistical visualization
- Automatic data point estimation

**Usage**:
```typescript
import { BoxPlotAggregationConfigurator } from '@/components/charts/configurators';

<BoxPlotAggregationConfigurator
  config={config}
  onChange={handleConfigChange}
  timeRange={{ start: new Date('2024-01-01'), end: new Date('2024-12-31') }}
/>
```

**Props**:
- `config: Partial<BoxPlotConfig>` - Current configuration
- `onChange: (config: Partial<BoxPlotConfig>) => void` - Change handler
- `timeRange?: { start: Date; end: Date }` - Optional time range

## Installation

No additional installation required if Material-UI is already set up:

```bash
npm install @mui/material @emotion/react @emotion/styled
npm install @mui/icons-material
```

## Quick Start

### Basic Implementation

```typescript
import React, { useState } from 'react';
import { BoxPlotAggregationConfigurator, BoxPlotConfig } from '@/components/charts/configurators';

function MyComponent() {
  const [config, setConfig] = useState<Partial<BoxPlotConfig>>({
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  });

  return (
    <BoxPlotAggregationConfigurator
      config={config}
      onChange={setConfig}
    />
  );
}
```

### With Chart Integration

```typescript
import React, { useState, useEffect } from 'react';
import { BoxPlotAggregationConfigurator } from '@/components/charts/configurators';
import { BoxPlotChart } from '@/components/charts';

function ChartWithConfigurator() {
  const [config, setConfig] = useState<BoxPlotConfig>({
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  });

  const [data, setData] = useState([]);

  useEffect(() => {
    // Fetch data based on config
    fetchChartData(config).then(setData);
  }, [config]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
      <BoxPlotAggregationConfigurator
        config={config}
        onChange={setConfig}
        timeRange={{ start: new Date('2024-01-01'), end: new Date('2024-12-31') }}
      />
      <BoxPlotChart data={data} config={config} />
    </div>
  );
}
```

## Component Architecture

### File Structure

```
configurators/
├── BoxPlotAggregationConfigurator.tsx       # Main component
├── BoxPlotAggregationConfigurator.test.tsx  # Unit tests
├── BoxPlotAggregationConfigurator.stories.tsx # Storybook stories
├── index.ts                                  # Barrel exports
└── README.md                                 # This file
```

### Design Patterns

All configurators follow these patterns:

1. **Controlled Components**: State managed by parent
2. **Single Responsibility**: Each configurator handles one chart type
3. **Composition**: Built from smaller, reusable components
4. **TypeScript First**: Full type safety
5. **Accessibility**: WCAG 2.1 AA compliant

### Common Props Interface

```typescript
interface ConfigStepProps {
  config: Partial<TConfig>;
  onChange: (config: Partial<TConfig>) => void;
  timeRange?: { start: Date; end: Date };
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific configurator
npm test BoxPlotAggregationConfigurator

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

### Test Structure

Each configurator has comprehensive tests covering:

- ✅ Rendering all UI elements
- ✅ User interactions (clicks, typing, selections)
- ✅ Configuration changes and callbacks
- ✅ Default values and initialization
- ✅ Edge cases and validation
- ✅ Accessibility features
- ✅ Preview updates
- ✅ Integration scenarios

### Example Test

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoxPlotAggregationConfigurator } from './BoxPlotAggregationConfigurator';

test('calls onChange when aggregation period changes', async () => {
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

## Storybook

### Viewing Stories

```bash
npm run storybook
```

Navigate to: `http://localhost:6006/?path=/story/charts-configurators-boxplotaggregation`

### Available Stories

Each configurator includes stories for:

- Default configuration
- All variations (hourly, daily, weekly, monthly)
- Each statistical method (IQR, percentile, stddev)
- With/without outliers
- Use case demonstrations
- Edge cases
- Responsive layouts

## Styling and Theming

### Using Material-UI Theme

```typescript
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

<ThemeProvider theme={theme}>
  <BoxPlotAggregationConfigurator {...props} />
</ThemeProvider>
```

### Custom Styling

Use MUI's `sx` prop for inline styles:

```typescript
<Box sx={{ maxWidth: 800, mx: 'auto' }}>
  <BoxPlotAggregationConfigurator {...props} />
</Box>
```

## Accessibility

All configurators meet WCAG 2.1 AA standards:

- ✅ Keyboard navigation support
- ✅ Screen reader compatibility
- ✅ ARIA labels and attributes
- ✅ Color contrast compliance
- ✅ Focus management
- ✅ Semantic HTML structure

### Testing Accessibility

```bash
# Run accessibility tests
npm run test:a11y

# Or use axe-core in tests
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('has no accessibility violations', async () => {
  const { container } = render(<BoxPlotAggregationConfigurator {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Performance

### Optimization Techniques

- **useMemo**: Expensive calculations are memoized
- **useCallback**: Event handlers are memoized
- **Controlled Re-renders**: Only update when config changes
- **Code Splitting**: Components can be lazy-loaded

### Performance Monitoring

```typescript
import { Profiler } from 'react';

<Profiler id="BoxPlotConfigurator" onRender={onRenderCallback}>
  <BoxPlotAggregationConfigurator {...props} />
</Profiler>
```

## Best Practices

### 1. Always Provide Type Safety

```typescript
// ✅ Good
const config: BoxPlotConfig = { ... };

// ❌ Bad
const config = { ... };
```

### 2. Validate Configuration

```typescript
const isValidConfig = (config: Partial<BoxPlotConfig>): boolean => {
  if (config.whiskerMethod === 'percentile') {
    return config.whiskerRange >= 50 && config.whiskerRange <= 100;
  }
  return true;
};
```

### 3. Persist User Preferences

```typescript
useEffect(() => {
  localStorage.setItem('chartConfig', JSON.stringify(config));
}, [config]);
```

### 4. Provide Default Values

```typescript
const defaultConfig: BoxPlotConfig = {
  aggregationPeriod: 'daily',
  showOutliers: true,
  whiskerMethod: 'iqr',
  whiskerRange: 1.5
};
```

### 5. Handle Errors Gracefully

```typescript
const handleConfigChange = (newConfig: Partial<BoxPlotConfig>) => {
  try {
    validateConfig(newConfig);
    setConfig(newConfig);
  } catch (error) {
    showError('Invalid configuration');
  }
};
```

## Common Issues and Solutions

### Issue: Config Not Updating

**Problem**: Parent component not re-rendering when config changes.

**Solution**: Ensure onChange creates new object reference:

```typescript
const handleChange = (newConfig: Partial<BoxPlotConfig>) => {
  setConfig({ ...config, ...newConfig }); // Create new object
};
```

### Issue: Preview Not Showing

**Problem**: timeRange prop not provided.

**Solution**: Always provide timeRange when available:

```typescript
<BoxPlotAggregationConfigurator
  config={config}
  onChange={onChange}
  timeRange={{ start, end }} // Add this
/>
```

### Issue: Type Errors

**Problem**: Config types don't match expected structure.

**Solution**: Use provided TypeScript interfaces:

```typescript
import { BoxPlotConfig } from '@/components/charts/configurators';

const config: BoxPlotConfig = {
  aggregationPeriod: 'daily',
  showOutliers: true,
  whiskerMethod: 'iqr',
  whiskerRange: 1.5
};
```

## API Reference

### BoxPlotConfig

```typescript
interface BoxPlotConfig {
  aggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  showOutliers: boolean;
  whiskerMethod: 'iqr' | 'percentile' | 'stddev';
  whiskerRange: number;
}
```

### Whisker Range Guidelines

| Method | Typical Values | Description |
|--------|---------------|-------------|
| IQR | 1.5, 3.0 | Multiplier for IQR |
| Percentile | 90, 95, 99 | Percentile value (0-100) |
| StdDev | 1, 2, 3 | Number of standard deviations |

## Contributing

### Adding New Configurators

1. Create component file: `NewConfigurator.tsx`
2. Add TypeScript interfaces
3. Implement component with Material-UI
4. Create test file: `NewConfigurator.test.tsx`
5. Create Storybook stories: `NewConfigurator.stories.tsx`
6. Update barrel export in `index.ts`
7. Update this README

### Code Style

Follow existing patterns:
- Use functional components with hooks
- Implement TypeScript strictly
- Add JSDoc comments
- Follow Material-UI design system
- Write comprehensive tests

### Commit Guidelines

```bash
git commit -m "feat(configurators): add NewConfigurator component"
git commit -m "fix(configurators): resolve BoxPlot preview issue"
git commit -m "test(configurators): add edge case tests"
```

## Resources

### Documentation
- [BoxPlotAggregationConfigurator Usage Guide](../../../docs/BoxPlotAggregationConfigurator-usage.md)
- [Material-UI Documentation](https://mui.com/material-ui/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

### Examples
- Storybook: `npm run storybook`
- Tests: Check `*.test.tsx` files
- Integration examples in `/docs`

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues or questions:
- GitHub Issues: [project-repo]/issues
- Documentation: [project-docs]/charts/configurators
- Storybook: Run `npm run storybook`
