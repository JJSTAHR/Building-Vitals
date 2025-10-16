# Unified Chart System Migration Guide

**Version:** 1.0.0
**Last Updated:** October 13, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Introduction](#introduction)
2. [Before You Start](#before-you-start)
3. [Step-by-Step Migration Process](#step-by-step-migration-process)
4. [Common Migration Patterns](#common-migration-patterns)
5. [Design Token Mapping](#design-token-mapping)
6. [Accessibility Checklist](#accessibility-checklist)
7. [Testing Checklist](#testing-checklist)
8. [Troubleshooting](#troubleshooting)
9. [Before/After Examples](#beforeafter-examples)
10. [Resources](#resources)

---

## Introduction

### Why Migrate to the Unified System?

The Unified Chart System provides a standardized, accessible, and performant foundation for all chart components in the Building Vitals application. Migrating your charts brings immediate benefits:

**Consistency:**
- Uniform visual design across all charts
- Standardized user interactions (export, fullscreen, refresh)
- Consistent spacing, typography, and color schemes
- Predictable component behavior

**Accessibility:**
- WCAG 2.1 Level AA compliant out of the box
- Screen reader support with proper ARIA labels
- Keyboard navigation for all interactive elements
- High contrast mode support
- Semantic HTML structure

**Performance:**
- Optimized rendering with React.memo and useMemo
- Reduced bundle size through shared components
- Efficient theme switching
- Better code splitting opportunities

**Maintainability:**
- Single source of truth for chart styling
- Easier to update design system-wide
- Reduced code duplication
- Clear component hierarchy

**Developer Experience:**
- Type-safe props with comprehensive TypeScript definitions
- Intuitive component composition
- Rich Storybook documentation (coming soon)
- Extensive test coverage examples

### Expected Migration Time

- **Simple chart** (basic header, no custom toolbar): 30-45 minutes
- **Medium complexity** (custom header, standard toolbar): 1-1.5 hours
- **Complex chart** (custom components, advanced features): 2-3 hours

### Migration Support

If you encounter issues during migration:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [Before/After Examples](#beforeafter-examples)
3. Consult the design system specification
4. Reach out to the frontend team

---

## Before You Start

### Prerequisites

Before migrating your chart, ensure you understand:

1. **React Fundamentals**
   - Component composition
   - Props and prop spreading
   - Hooks (useState, useMemo, useCallback)
   - React.memo for optimization

2. **Material-UI (MUI)**
   - sx prop styling
   - Theme system and useTheme hook
   - Common components (Box, Typography, IconButton, etc.)
   - Responsive design with breakpoints

3. **ECharts (Apache ECharts)**
   - Option configuration structure
   - Series types and data formats
   - Event handling
   - Responsive behavior

4. **TypeScript**
   - Interface and type definitions
   - Generic types
   - Type assertions when necessary

### Required Imports

At minimum, you'll need:

```tsx
// Unified chart system components
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar,
  StandardChartFooter,
  chartDesignTokens
} from '@/components/charts/unified';

// Material-UI components
import { Box, IconButton, Tooltip } from '@mui/material';

// Icons (as needed)
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

// React hooks
import { useState, useMemo, useCallback } from 'react';

// ECharts wrapper
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
```

### Design Token Familiarity

Review the design token structure:

```tsx
chartDesignTokens = {
  // Spacing system
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },

  // Typography
  typography: {
    title: { fontSize: '1.25rem', fontWeight: 600 },
    subtitle: { fontSize: '0.875rem', fontWeight: 400 },
    body: { fontSize: '0.875rem', fontWeight: 400 },
    caption: { fontSize: '0.75rem', fontWeight: 400 }
  },

  // Layout dimensions
  layout: {
    headerHeight: '56px',
    toolbarHeight: '48px',
    footerHeight: '40px',
    borderRadius: '8px',
    containerPadding: '16px'
  },

  // Colors
  colors: {
    categorical: ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2'],
    sequential: {
      blue: ['#e3f2fd', '#90caf9', '#42a5f5', '#1976d2', '#0d47a1'],
      green: ['#e8f5e9', '#81c784', '#4caf50', '#388e3c', '#1b5e20'],
      red: ['#ffebee', '#e57373', '#f44336', '#d32f2f', '#b71c1c']
    },
    diverging: {
      redBlue: ['#d32f2f', '#f57c00', '#fdd835', '#7cb342', '#1976d2']
    }
  },

  // Shadows
  shadows: {
    card: '0 2px 4px rgba(0,0,0,0.1)',
    hover: '0 4px 8px rgba(0,0,0,0.15)'
  }
};
```

### Project Structure

Unified chart components are organized as:

```
src/components/charts/unified/
├── BaseChartContainer.tsx      # Main container component
├── StandardChartHeader.tsx     # Header with title and actions
├── StandardChartToolbar.tsx    # Toolbar with export, fullscreen, etc.
├── StandardChartFooter.tsx     # Footer with timestamp, legend, etc.
├── chartDesignTokens.ts        # Design token definitions
├── index.ts                    # Public exports
├── types.ts                    # TypeScript type definitions
└── __tests__/                  # Component tests
    ├── BaseChartContainer.test.tsx
    ├── StandardChartHeader.test.tsx
    ├── StandardChartToolbar.test.tsx
    └── StandardChartFooter.test.tsx
```

---

## Step-by-Step Migration Process

### Step 1: Analyze Current Chart Structure

**Goal:** Understand your chart's current architecture

1. **Identify component parts:**
   - Where is the chart title rendered?
   - Are there any action buttons (refresh, export, etc.)?
   - Is there a toolbar or controls section?
   - Is there a footer with timestamp or legend?
   - What custom styling is applied?

2. **Document data flow:**
   - What props does the component receive?
   - What state is managed internally?
   - Are there any callbacks or event handlers?
   - What data transformations occur?

3. **Note custom features:**
   - Any unique user interactions?
   - Custom tooltips or overlays?
   - Special accessibility considerations?
   - Performance optimizations?

**Example Analysis:**

```tsx
// Current TimeSeriesChart component
const TimeSeriesChart = ({ title, data, onRefresh, showExport }) => {
  // State management
  const [selectedRange, setSelectedRange] = useState('24h');

  // Custom header with title and refresh button
  <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
    <Typography variant="h6">{title}</Typography>
    <IconButton onClick={onRefresh}><RefreshIcon /></IconButton>
  </Box>

  // Chart rendering
  <EChartsWrapper option={chartOption} />

  // Custom footer with time range selector
  <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
    <Button onClick={() => setSelectedRange('1h')}>1H</Button>
    <Button onClick={() => setSelectedRange('24h')}>24H</Button>
    <Button onClick={() => setSelectedRange('7d')}>7D</Button>
  </Box>
}
```

**Analysis Notes:**
- Header: Title on left, refresh button on right
- Toolbar: None (could add export button)
- Footer: Custom time range selector (keep as custom)
- Height: Not explicitly set (needs to be defined)
- Accessibility: Missing ARIA labels

### Step 2: Identify Header, Toolbar, Footer Components

**Goal:** Map existing UI sections to unified components

**Decision Matrix:**

| Current Section | Maps To | Notes |
|----------------|---------|-------|
| Title + icon | StandardChartHeader | Use `title` and `icon` props |
| Title + buttons | StandardChartHeader | Use `title` and `actions` props |
| Export/fullscreen buttons | StandardChartToolbar | Use `showExport`, `showFullscreen` |
| Custom controls | StandardChartToolbar | Pass as `customActions` |
| Timestamp display | StandardChartFooter | Use `timestamp` prop |
| Legend | StandardChartFooter | Use `legendItems` prop |
| Custom footer content | StandardChartFooter | Pass as children or custom prop |

**Example Mapping:**

```tsx
// Current sections → Unified components

// Section 1: Title + Refresh
<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
  <Typography variant="h6">{title}</Typography>
  <IconButton onClick={onRefresh}><RefreshIcon /></IconButton>
</Box>
↓
<StandardChartHeader
  title={title}
  actions={
    <Tooltip title="Refresh data">
      <IconButton onClick={onRefresh} aria-label="Refresh chart data">
        <RefreshIcon />
      </IconButton>
    </Tooltip>
  }
/>

// Section 2: Export button (add new)
(none currently)
↓
<StandardChartToolbar
  showExport={true}
  onExport={handleExport}
  exportFormats={['PNG', 'CSV']}
/>

// Section 3: Time range selector
<Box sx={{ display: 'flex', gap: 1 }}>
  <Button onClick={...}>1H</Button>
  <Button onClick={...}>24H</Button>
</Box>
↓
<StandardChartFooter>
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Button onClick={...}>1H</Button>
    <Button onClick={...}>24H</Button>
  </Box>
</StandardChartFooter>
```

### Step 3: Replace with Unified Components

**Goal:** Implement the unified component structure

**Template Structure:**

```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar,
  StandardChartFooter
} from '@/components/charts/unified';

const MigratedChart = (props) => {
  return (
    <BaseChartContainer
      height={400}
      aria-label="Your chart description"
      header={
        <StandardChartHeader
          title={props.title}
          subtitle={props.subtitle}
          icon={props.icon}
          actions={/* action buttons */}
        />
      }
      toolbar={
        <StandardChartToolbar
          showExport={true}
          showFullscreen={true}
          onExport={handleExport}
          onFullscreen={handleFullscreen}
          customActions={/* additional controls */}
        />
      }
      footer={
        <StandardChartFooter
          timestamp={props.lastUpdated}
          legendItems={props.legendItems}
        >
          {/* custom footer content */}
        </StandardChartFooter>
      }
    >
      {/* Your chart component */}
      <EChartsWrapper option={chartOption} />
    </BaseChartContainer>
  );
};
```

**Implementation Steps:**

1. **Wrap your chart in BaseChartContainer:**
   ```tsx
   <BaseChartContainer height={400}>
     {/* existing chart */}
   </BaseChartContainer>
   ```

2. **Add header prop:**
   ```tsx
   <BaseChartContainer
     height={400}
     header={
       <StandardChartHeader title="My Chart" />
     }
   >
   ```

3. **Add toolbar if needed:**
   ```tsx
   toolbar={
     <StandardChartToolbar
       showExport={true}
       onExport={handleExport}
     />
   }
   ```

4. **Add footer if needed:**
   ```tsx
   footer={
     <StandardChartFooter
       timestamp={new Date().toISOString()}
     />
   }
   ```

5. **Test rendering:**
   - Verify chart displays correctly
   - Check header, toolbar, footer positioning
   - Ensure no visual regressions

### Step 4: Update Styling to Use Design Tokens

**Goal:** Replace hardcoded styles with design tokens

**Common Replacements:**

```tsx
// Font sizes
sx={{ fontSize: '18px' }}
↓
sx={{ fontSize: chartDesignTokens.typography.title.fontSize }}

// Spacing
sx={{ padding: '16px' }}
↓
sx={{ padding: chartDesignTokens.spacing.md }}

// Colors
const colors = ['#1976d2', '#d32f2f', '#388e3c'];
↓
const colors = chartDesignTokens.colors.categorical;

// Border radius
sx={{ borderRadius: '8px' }}
↓
sx={{ borderRadius: chartDesignTokens.layout.borderRadius }}

// Shadows
sx={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
↓
sx={{ boxShadow: chartDesignTokens.shadows.card }}
```

**Chart Option Updates:**

```tsx
// ECharts color configuration
option = {
  color: ['#1976d2', '#d32f2f', '#388e3c'],
  // ... rest of option
}
↓
option = {
  color: chartDesignTokens.colors.categorical,
  // ... rest of option
}

// Text styles
option = {
  title: {
    textStyle: {
      fontSize: 20,
      fontWeight: 600
    }
  }
}
↓
option = {
  title: {
    textStyle: {
      fontSize: chartDesignTokens.typography.title.fontSize,
      fontWeight: chartDesignTokens.typography.title.fontWeight
    }
  }
}
```

**Custom Styling:**

For custom styling not covered by design tokens:

```tsx
// Use theme for additional values
import { useTheme } from '@mui/material/styles';

const MyChart = () => {
  const theme = useTheme();

  return (
    <BaseChartContainer
      height={400}
      sx={{
        // Design tokens for standard values
        padding: chartDesignTokens.spacing.md,
        borderRadius: chartDesignTokens.layout.borderRadius,

        // Theme for dynamic values
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,

        // Custom values when necessary
        minHeight: '300px'
      }}
    >
      {/* chart content */}
    </BaseChartContainer>
  );
};
```

### Step 5: Add Accessibility Attributes

**Goal:** Ensure WCAG 2.1 Level AA compliance

**Required Attributes:**

1. **Chart Container:**
   ```tsx
   <BaseChartContainer
     aria-label="Descriptive chart title and purpose"
     role="region"
   >
   ```

2. **Interactive Elements:**
   ```tsx
   <IconButton
     onClick={handleRefresh}
     aria-label="Refresh chart data"
     title="Refresh chart data"
   >
     <RefreshIcon />
   </IconButton>
   ```

3. **Form Controls:**
   ```tsx
   <Select
     aria-label="Select time range"
     aria-describedby="time-range-help"
   >
     <MenuItem value="1h">1 Hour</MenuItem>
     <MenuItem value="24h">24 Hours</MenuItem>
   </Select>
   <FormHelperText id="time-range-help">
     Choose the time range for chart data
   </FormHelperText>
   ```

4. **Dynamic Content:**
   ```tsx
   <Box aria-live="polite" aria-atomic="true">
     {isLoading ? 'Loading chart data...' : 'Chart updated'}
   </Box>
   ```

**Accessibility Checklist for Step 5:**

- [ ] Chart container has descriptive aria-label
- [ ] All IconButtons have aria-label
- [ ] All buttons have visible labels or aria-label
- [ ] Form controls have associated labels
- [ ] Loading states use aria-live
- [ ] Error messages are announced
- [ ] Keyboard focus is visible
- [ ] Tab order is logical

**Testing Accessibility:**

```bash
# Run accessibility tests
npm test -- ChartComponent.a11y.test.tsx

# Manual testing
# 1. Tab through all interactive elements
# 2. Press Enter/Space on buttons
# 3. Use arrow keys in selects
# 4. Test with screen reader (NVDA/JAWS/VoiceOver)
```

### Step 6: Test Functionality

**Goal:** Verify all features work correctly

**Functional Tests:**

1. **Visual Rendering:**
   ```tsx
   // Test that chart renders without errors
   render(<MigratedChart data={mockData} />);
   expect(screen.getByRole('region')).toBeInTheDocument();
   ```

2. **User Interactions:**
   ```tsx
   // Test refresh button
   const refreshButton = screen.getByLabelText('Refresh chart data');
   fireEvent.click(refreshButton);
   expect(mockOnRefresh).toHaveBeenCalled();

   // Test export functionality
   const exportButton = screen.getByLabelText('Export chart');
   fireEvent.click(exportButton);
   expect(mockOnExport).toHaveBeenCalled();
   ```

3. **State Management:**
   ```tsx
   // Test time range selector
   const rangeSelect = screen.getByLabelText('Select time range');
   fireEvent.change(rangeSelect, { target: { value: '7d' } });
   expect(screen.getByText('7 Days')).toBeInTheDocument();
   ```

4. **Data Updates:**
   ```tsx
   // Test that chart updates when data changes
   const { rerender } = render(<MigratedChart data={initialData} />);
   expect(screen.getByText('100')).toBeInTheDocument();

   rerender(<MigratedChart data={updatedData} />);
   expect(screen.getByText('200')).toBeInTheDocument();
   ```

5. **Theme Switching:**
   ```tsx
   // Test light/dark theme
   const { rerender } = render(
     <ThemeProvider theme={lightTheme}>
       <MigratedChart />
     </ThemeProvider>
   );
   expect(container.firstChild).toHaveStyle('background: #ffffff');

   rerender(
     <ThemeProvider theme={darkTheme}>
       <MigratedChart />
     </ThemeProvider>
   );
   expect(container.firstChild).toHaveStyle('background: #121212');
   ```

**Manual Testing Checklist:**

- [ ] Chart displays correctly in browser
- [ ] Header shows title and actions
- [ ] Toolbar buttons work (export, fullscreen, etc.)
- [ ] Footer displays correctly
- [ ] Data updates reflect in chart
- [ ] Loading states show properly
- [ ] Error states display correctly
- [ ] Responsive behavior works on mobile
- [ ] Theme switching works (light/dark)
- [ ] Tooltips appear on hover
- [ ] Zoom/pan functionality works (if applicable)

### Step 7: Update Tests

**Goal:** Ensure comprehensive test coverage

**Test File Structure:**

```tsx
// MigratedChart.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MigratedChart } from './MigratedChart';

describe('MigratedChart', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<MigratedChart data={mockData} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('renders header with title', () => {
      render(<MigratedChart title="Test Chart" data={mockData} />);
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
    });

    it('renders toolbar when enabled', () => {
      render(<MigratedChart showToolbar={true} data={mockData} />);
      expect(screen.getByLabelText('Export chart')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = jest.fn();
      render(<MigratedChart onRefresh={onRefresh} data={mockData} />);

      fireEvent.click(screen.getByLabelText('Refresh chart data'));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('exports chart when export button clicked', () => {
      const onExport = jest.fn();
      render(<MigratedChart onExport={onExport} data={mockData} />);

      fireEvent.click(screen.getByLabelText('Export chart'));
      expect(onExport).toHaveBeenCalledWith('PNG');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<MigratedChart data={mockData} />);
      expect(screen.getByRole('region')).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', () => {
      render(<MigratedChart data={mockData} />);
      const refreshButton = screen.getByLabelText('Refresh chart data');

      refreshButton.focus();
      expect(refreshButton).toHaveFocus();
    });
  });

  describe('Data Handling', () => {
    it('updates when data changes', () => {
      const { rerender } = render(<MigratedChart data={[1, 2, 3]} />);
      expect(screen.getByText('3')).toBeInTheDocument();

      rerender(<MigratedChart data={[4, 5, 6]} />);
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      render(<MigratedChart data={[]} />);
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });
});
```

**Test Coverage Goals:**

- **Unit tests:** 80%+ coverage
- **Integration tests:** All user flows
- **Accessibility tests:** All interactive elements
- **Snapshot tests:** Visual regression detection

**Running Tests:**

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- MigratedChart.test.tsx

# Watch mode for development
npm test -- --watch
```

---

## Common Migration Patterns

### Pattern 1: Simple Chart with Custom Header

**Before:**
```tsx
const SimpleChart = ({ title, data, onRefresh }) => {
  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton onClick={onRefresh} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>
      <Box sx={{ height: 300 }}>
        <EChartsWrapper option={createChartOption(data)} />
      </Box>
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  chartDesignTokens
} from '@/components/charts/unified';

const SimpleChart = ({ title, data, onRefresh }) => {
  const chartOption = useMemo(() => createChartOption(data), [data]);

  return (
    <BaseChartContainer
      height={300}
      aria-label={`${title} chart`}
      header={
        <StandardChartHeader
          title={title}
          actions={
            <Tooltip title="Refresh data">
              <IconButton
                onClick={onRefresh}
                size="small"
                aria-label="Refresh chart data"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
      }
    >
      <EChartsWrapper option={chartOption} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Replaced custom Box with BaseChartContainer
- Used StandardChartHeader for consistent styling
- Added accessibility attributes
- Memoized chart option for performance
- Removed hardcoded colors and spacing

### Pattern 2: Chart with Custom Colors

**Before:**
```tsx
const ColoredChart = ({ data }) => {
  const colors = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00'];

  const option = {
    color: colors,
    series: [{
      type: 'bar',
      data: data,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#ffffff',
        borderWidth: 1
      }
    }]
  };

  return <EChartsWrapper option={option} />;
};
```

**After:**
```tsx
import { chartDesignTokens } from '@/components/charts/unified';
import { useTheme } from '@mui/material/styles';

const ColoredChart = ({ data }) => {
  const theme = useTheme();

  const option = useMemo(() => ({
    color: chartDesignTokens.colors.categorical,
    series: [{
      type: 'bar',
      data: data,
      itemStyle: {
        borderRadius: parseInt(chartDesignTokens.layout.borderRadius),
        borderColor: theme.palette.background.paper,
        borderWidth: 1
      }
    }]
  }), [data, theme]);

  return (
    <BaseChartContainer height={400} aria-label="Colored bar chart">
      <EChartsWrapper option={option} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used chartDesignTokens.colors.categorical
- Used chartDesignTokens.layout.borderRadius
- Used theme for dynamic colors
- Memoized option to prevent re-renders
- Wrapped in BaseChartContainer

### Pattern 3: Chart with Toolbar

**Before:**
```tsx
const ChartWithToolbar = ({ title, data }) => {
  const handleExport = () => {
    // Export logic
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart-data.json';
    link.click();
  };

  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button onClick={handleExport} startIcon={<DownloadIcon />}>
          Export
        </Button>
        <Button onClick={() => {/* fullscreen */}} startIcon={<FullscreenIcon />}>
          Fullscreen
        </Button>
      </Box>
      <EChartsWrapper option={createOption(data)} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar
} from '@/components/charts/unified';

const ChartWithToolbar = ({ title, data }) => {
  const handleExport = useCallback((format: string) => {
    switch (format) {
      case 'JSON':
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chart-data.json';
        link.click();
        URL.revokeObjectURL(url);
        break;
      case 'PNG':
        // Chart export handled by toolbar
        break;
    }
  }, [data]);

  const handleFullscreen = useCallback(() => {
    // Fullscreen logic handled by toolbar
  }, []);

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} chart with export options`}
      header={<StandardChartHeader title={title} />}
      toolbar={
        <StandardChartToolbar
          showExport={true}
          showFullscreen={true}
          onExport={handleExport}
          onFullscreen={handleFullscreen}
          exportFormats={['PNG', 'CSV', 'JSON']}
        />
      }
    >
      <EChartsWrapper option={createOption(data)} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used StandardChartToolbar for consistent UI
- Export and fullscreen built into toolbar
- Multiple export formats supported
- Proper cleanup of object URLs
- Callbacks memoized for performance

### Pattern 4: Chart with Footer and Legend

**Before:**
```tsx
const ChartWithLegend = ({ title, data, series }) => {
  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <EChartsWrapper option={createOption(data)} />
      <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: s.color, borderRadius: '2px' }} />
            <Typography variant="caption">{s.name}</Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        Last updated: {new Date().toLocaleString()}
      </Typography>
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartFooter
} from '@/components/charts/unified';

const ChartWithLegend = ({ title, data, series }) => {
  const legendItems = useMemo(() =>
    series.map((s) => ({
      label: s.name,
      color: s.color
    })),
    [series]
  );

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} chart with legend`}
      header={<StandardChartHeader title={title} />}
      footer={
        <StandardChartFooter
          timestamp={new Date().toISOString()}
          legendItems={legendItems}
        />
      }
    >
      <EChartsWrapper option={createOption(data)} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used StandardChartFooter for consistent footer
- Legend handled automatically by footer
- Timestamp formatted by footer component
- Memoized legend items
- Removed manual styling

### Pattern 5: Chart with Loading State

**Before:**
```tsx
const LoadingChart = ({ title, data, isLoading }) => {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading chart data...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <EChartsWrapper option={createOption(data)} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader
} from '@/components/charts/unified';
import { CircularProgress, Box, Typography } from '@mui/material';

const LoadingChart = ({ title, data, isLoading }) => {
  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} chart`}
      aria-busy={isLoading}
      header={<StandardChartHeader title={title} />}
    >
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            gap: 2
          }}
          role="status"
          aria-live="polite"
        >
          <CircularProgress aria-label="Loading chart" />
          <Typography>Loading chart data...</Typography>
        </Box>
      ) : (
        <EChartsWrapper option={createOption(data)} />
      )}
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Loading state inside container
- Added aria-busy attribute
- Proper loading announcement with aria-live
- Consistent height maintained
- Better accessibility for loading state

### Pattern 6: Chart with Error Handling

**Before:**
```tsx
const ErrorChart = ({ title, data, error }) => {
  if (error) {
    return (
      <Box sx={{ p: 2, border: '1px solid red', borderRadius: '4px' }}>
        <Typography color="error">Error loading chart: {error.message}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <EChartsWrapper option={createOption(data)} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader
} from '@/components/charts/unified';
import { Alert, Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const ErrorChart = ({ title, data, error }) => {
  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} chart`}
      header={<StandardChartHeader title={title} />}
    >
      {error ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            padding: 2
          }}
          role="alert"
          aria-live="assertive"
        >
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            sx={{ width: '100%', maxWidth: 600 }}
          >
            <strong>Error loading chart data:</strong> {error.message}
          </Alert>
        </Box>
      ) : (
        <EChartsWrapper option={createOption(data)} />
      )}
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used MUI Alert component
- Error displayed inside container
- Proper ARIA roles and live regions
- Consistent height maintained
- Better visual error presentation

### Pattern 7: Responsive Chart with Breakpoints

**Before:**
```tsx
const ResponsiveChart = ({ title, data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const height = isMobile ? 250 : 400;
  const fontSize = isMobile ? 12 : 14;

  const option = {
    textStyle: { fontSize },
    series: [{ type: 'bar', data }]
  };

  return (
    <Box sx={{ height }}>
      <Typography variant="h6" sx={{ fontSize: isMobile ? 16 : 20 }}>
        {title}
      </Typography>
      <EChartsWrapper option={option} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  chartDesignTokens
} from '@/components/charts/unified';
import { useTheme, useMediaQuery } from '@mui/material';

const ResponsiveChart = ({ title, data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const height = isMobile ? 250 : 400;

  const option = useMemo(() => ({
    textStyle: {
      fontSize: isMobile
        ? chartDesignTokens.typography.caption.fontSize
        : chartDesignTokens.typography.body.fontSize
    },
    series: [{
      type: 'bar',
      data,
      itemStyle: {
        color: chartDesignTokens.colors.categorical[0]
      }
    }]
  }), [data, isMobile]);

  return (
    <BaseChartContainer
      height={height}
      aria-label={`${title} responsive chart`}
      header={
        <StandardChartHeader
          title={title}
          sx={{
            '& .MuiTypography-root': {
              fontSize: isMobile
                ? chartDesignTokens.typography.subtitle.fontSize
                : chartDesignTokens.typography.title.fontSize
            }
          }}
        />
      }
    >
      <EChartsWrapper option={option} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used design tokens for font sizes
- Responsive height properly applied
- Memoized option with breakpoint dependency
- Consistent token-based styling
- Better mobile experience

### Pattern 8: Chart with Time Range Selector

**Before:**
```tsx
const TimeRangeChart = ({ title, data }) => {
  const [range, setRange] = useState('24h');

  const filteredData = useMemo(() =>
    filterDataByRange(data, range),
    [data, range]
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={range === '1h' ? 'contained' : 'outlined'}
            onClick={() => setRange('1h')}
            size="small"
          >
            1H
          </Button>
          <Button
            variant={range === '24h' ? 'contained' : 'outlined'}
            onClick={() => setRange('24h')}
            size="small"
          >
            24H
          </Button>
          <Button
            variant={range === '7d' ? 'contained' : 'outlined'}
            onClick={() => setRange('7d')}
            size="small"
          >
            7D
          </Button>
        </Box>
      </Box>
      <EChartsWrapper option={createOption(filteredData)} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartFooter
} from '@/components/charts/unified';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

const TimeRangeChart = ({ title, data }) => {
  const [range, setRange] = useState<string>('24h');

  const filteredData = useMemo(() =>
    filterDataByRange(data, range),
    [data, range]
  );

  const handleRangeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newRange: string | null) => {
      if (newRange !== null) {
        setRange(newRange);
      }
    },
    []
  );

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} time series chart`}
      header={<StandardChartHeader title={title} />}
      footer={
        <StandardChartFooter>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%'
            }}
          >
            <ToggleButtonGroup
              value={range}
              exclusive
              onChange={handleRangeChange}
              aria-label="Select time range"
              size="small"
            >
              <ToggleButton value="1h" aria-label="1 hour">
                1H
              </ToggleButton>
              <ToggleButton value="24h" aria-label="24 hours">
                24H
              </ToggleButton>
              <ToggleButton value="7d" aria-label="7 days">
                7D
              </ToggleButton>
              <ToggleButton value="30d" aria-label="30 days">
                30D
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </StandardChartFooter>
      }
    >
      <EChartsWrapper option={createOption(filteredData)} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used ToggleButtonGroup for better UX
- Placed range selector in footer
- Added proper ARIA labels for each option
- Memoized callback to prevent re-renders
- Better visual indication of selected range

### Pattern 9: Multi-Series Chart with Color Mapping

**Before:**
```tsx
const MultiSeriesChart = ({ title, series }) => {
  const seriesColors = {
    'temperature': '#d32f2f',
    'humidity': '#1976d2',
    'pressure': '#388e3c'
  };

  const option = {
    legend: { data: series.map(s => s.name) },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data,
      color: seriesColors[s.name]
    }))
  };

  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <EChartsWrapper option={option} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartFooter,
  chartDesignTokens
} from '@/components/charts/unified';

const MultiSeriesChart = ({ title, series }) => {
  // Use design token colors or create custom mapping
  const seriesColors = useMemo(() => {
    const colorMap = {
      'temperature': chartDesignTokens.colors.sequential.red[3],
      'humidity': chartDesignTokens.colors.sequential.blue[3],
      'pressure': chartDesignTokens.colors.sequential.green[3]
    };
    return colorMap;
  }, []);

  const option = useMemo(() => ({
    legend: {
      data: series.map(s => s.name),
      textStyle: {
        fontSize: chartDesignTokens.typography.body.fontSize,
        fontWeight: chartDesignTokens.typography.body.fontWeight
      }
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data,
      color: seriesColors[s.name] || chartDesignTokens.colors.categorical[0]
    }))
  }), [series, seriesColors]);

  const legendItems = useMemo(() =>
    series.map(s => ({
      label: s.name,
      color: seriesColors[s.name] || chartDesignTokens.colors.categorical[0]
    })),
    [series, seriesColors]
  );

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} multi-series line chart`}
      header={<StandardChartHeader title={title} />}
      footer={
        <StandardChartFooter legendItems={legendItems} />
      }
    >
      <EChartsWrapper option={option} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used sequential colors from design tokens
- Memoized color mappings
- Added footer legend
- Consistent typography in chart legend
- Fallback color for unmapped series

### Pattern 10: Chart with Custom Tooltip

**Before:**
```tsx
const TooltipChart = ({ title, data }) => {
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const dataPoint = params[0];
        return `
          <div style="padding: 8px;">
            <strong>${dataPoint.name}</strong><br/>
            Value: ${dataPoint.value}<br/>
            <span style="color: #666;">Click for details</span>
          </div>
        `;
      },
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1,
      textStyle: {
        color: '#333333',
        fontSize: 12
      }
    },
    series: [{
      type: 'line',
      data
    }]
  };

  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <EChartsWrapper option={option} />
    </Box>
  );
};
```

**After:**
```tsx
import {
  BaseChartContainer,
  StandardChartHeader,
  chartDesignTokens
} from '@/components/charts/unified';
import { useTheme } from '@mui/material/styles';

const TooltipChart = ({ title, data }) => {
  const theme = useTheme();

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const dataPoint = params[0];
        return `
          <div style="
            padding: ${chartDesignTokens.spacing.sm};
            font-family: ${theme.typography.fontFamily};
          ">
            <strong style="
              font-size: ${chartDesignTokens.typography.body.fontSize};
              font-weight: ${chartDesignTokens.typography.body.fontWeight};
            ">${dataPoint.name}</strong><br/>
            <span style="font-size: ${chartDesignTokens.typography.body.fontSize};">
              Value: ${dataPoint.value}
            </span><br/>
            <span style="
              color: ${theme.palette.text.secondary};
              font-size: ${chartDesignTokens.typography.caption.fontSize};
            ">
              Click for details
            </span>
          </div>
        `;
      },
      backgroundColor: theme.palette.background.paper,
      borderColor: theme.palette.divider,
      borderWidth: 1,
      textStyle: {
        color: theme.palette.text.primary,
        fontSize: chartDesignTokens.typography.body.fontSize
      }
    },
    series: [{
      type: 'line',
      data,
      color: chartDesignTokens.colors.categorical[0]
    }]
  }), [data, theme]);

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} line chart with custom tooltips`}
      header={<StandardChartHeader title={title} />}
    >
      <EChartsWrapper option={option} />
    </BaseChartContainer>
  );
};
```

**Key Changes:**
- Used design tokens for spacing and typography
- Used theme for dynamic colors (light/dark mode)
- Tooltip adapts to theme
- Memoized option to prevent unnecessary re-renders
- Consistent font styling

---

## Design Token Mapping

### Complete Token Reference

| Category | Old Style | New Design Token | Value | Notes |
|----------|-----------|------------------|-------|-------|
| **Typography** |
| Title font size | `fontSize: '20px'` | `chartDesignTokens.typography.title.fontSize` | 1.25rem (20px) | Main chart title |
| Title font weight | `fontWeight: 600` | `chartDesignTokens.typography.title.fontWeight` | 600 | Main chart title |
| Subtitle font size | `fontSize: '14px'` | `chartDesignTokens.typography.subtitle.fontSize` | 0.875rem (14px) | Subtitles, descriptions |
| Subtitle font weight | `fontWeight: 400` | `chartDesignTokens.typography.subtitle.fontWeight` | 400 | Subtitles, descriptions |
| Body font size | `fontSize: '14px'` | `chartDesignTokens.typography.body.fontSize` | 0.875rem (14px) | Labels, axis text |
| Body font weight | `fontWeight: 400` | `chartDesignTokens.typography.body.fontWeight` | 400 | Labels, axis text |
| Caption font size | `fontSize: '12px'` | `chartDesignTokens.typography.caption.fontSize` | 0.75rem (12px) | Footnotes, small text |
| Caption font weight | `fontWeight: 400` | `chartDesignTokens.typography.caption.fontWeight` | 400 | Footnotes, small text |
| **Spacing** |
| Extra small | `padding: '4px'` | `chartDesignTokens.spacing.xs` | 4px | Tight spacing |
| Small | `padding: '8px'` | `chartDesignTokens.spacing.sm` | 8px | Compact spacing |
| Medium | `padding: '16px'` | `chartDesignTokens.spacing.md` | 16px | Standard spacing |
| Large | `padding: '24px'` | `chartDesignTokens.spacing.lg` | 24px | Loose spacing |
| Extra large | `padding: '32px'` | `chartDesignTokens.spacing.xl` | 32px | Very loose spacing |
| **Layout** |
| Header height | `height: '56px'` | `chartDesignTokens.layout.headerHeight` | 56px | Standard header |
| Toolbar height | `height: '48px'` | `chartDesignTokens.layout.toolbarHeight` | 48px | Toolbar/controls |
| Footer height | `height: '40px'` | `chartDesignTokens.layout.footerHeight` | 40px | Footer section |
| Border radius | `borderRadius: '8px'` | `chartDesignTokens.layout.borderRadius` | 8px | Rounded corners |
| Container padding | `padding: '16px'` | `chartDesignTokens.layout.containerPadding` | 16px | Inner padding |
| Min height | `minHeight: '200px'` | `chartDesignTokens.layout.minHeight` | 200px | Minimum chart height |
| **Colors - Categorical** |
| Primary blue | `color: '#1976d2'` | `chartDesignTokens.colors.categorical[0]` | #1976d2 | First series |
| Red | `color: '#d32f2f'` | `chartDesignTokens.colors.categorical[1]` | #d32f2f | Second series |
| Green | `color: '#388e3c'` | `chartDesignTokens.colors.categorical[2]` | #388e3c | Third series |
| Orange | `color: '#f57c00'` | `chartDesignTokens.colors.categorical[3]` | #f57c00 | Fourth series |
| Purple | `color: '#7b1fa2'` | `chartDesignTokens.colors.categorical[4]` | #7b1fa2 | Fifth series |
| **Colors - Sequential Blue** |
| Lightest | `color: '#e3f2fd'` | `chartDesignTokens.colors.sequential.blue[0]` | #e3f2fd | Lowest value |
| Light | `color: '#90caf9'` | `chartDesignTokens.colors.sequential.blue[1]` | #90caf9 | Low value |
| Medium | `color: '#42a5f5'` | `chartDesignTokens.colors.sequential.blue[2]` | #42a5f5 | Medium value |
| Dark | `color: '#1976d2'` | `chartDesignTokens.colors.sequential.blue[3]` | #1976d2 | High value |
| Darkest | `color: '#0d47a1'` | `chartDesignTokens.colors.sequential.blue[4]` | #0d47a1 | Highest value |
| **Colors - Sequential Green** |
| Lightest | `color: '#e8f5e9'` | `chartDesignTokens.colors.sequential.green[0]` | #e8f5e9 | Lowest value |
| Light | `color: '#81c784'` | `chartDesignTokens.colors.sequential.green[1]` | #81c784 | Low value |
| Medium | `color: '#4caf50'` | `chartDesignTokens.colors.sequential.green[2]` | #4caf50 | Medium value |
| Dark | `color: '#388e3c'` | `chartDesignTokens.colors.sequential.green[3]` | #388e3c | High value |
| Darkest | `color: '#1b5e20'` | `chartDesignTokens.colors.sequential.green[4]` | #1b5e20 | Highest value |
| **Colors - Sequential Red** |
| Lightest | `color: '#ffebee'` | `chartDesignTokens.colors.sequential.red[0]` | #ffebee | Lowest value |
| Light | `color: '#e57373'` | `chartDesignTokens.colors.sequential.red[1]` | #e57373 | Low value |
| Medium | `color: '#f44336'` | `chartDesignTokens.colors.sequential.red[2]` | #f44336 | Medium value |
| Dark | `color: '#d32f2f'` | `chartDesignTokens.colors.sequential.red[3]` | #d32f2f | High value |
| Darkest | `color: '#b71c1c'` | `chartDesignTokens.colors.sequential.red[4]` | #b71c1c | Highest value |
| **Colors - Diverging** |
| Negative extreme | `color: '#d32f2f'` | `chartDesignTokens.colors.diverging.redBlue[0]` | #d32f2f | Very negative |
| Negative | `color: '#f57c00'` | `chartDesignTokens.colors.diverging.redBlue[1]` | #f57c00 | Negative |
| Neutral | `color: '#fdd835'` | `chartDesignTokens.colors.diverging.redBlue[2]` | #fdd835 | Neutral/zero |
| Positive | `color: '#7cb342'` | `chartDesignTokens.colors.diverging.redBlue[3]` | #7cb342 | Positive |
| Positive extreme | `color: '#1976d2'` | `chartDesignTokens.colors.diverging.redBlue[4]` | #1976d2 | Very positive |
| **Shadows** |
| Card shadow | `boxShadow: '0 2px 4px rgba(0,0,0,0.1)'` | `chartDesignTokens.shadows.card` | rgba(0,0,0,0.1) | Standard elevation |
| Hover shadow | `boxShadow: '0 4px 8px rgba(0,0,0,0.15)'` | `chartDesignTokens.shadows.hover` | rgba(0,0,0,0.15) | Hover state |

### Usage Examples by Category

**Typography in ECharts:**
```tsx
const option = {
  title: {
    text: 'Chart Title',
    textStyle: {
      fontSize: chartDesignTokens.typography.title.fontSize,
      fontWeight: chartDesignTokens.typography.title.fontWeight
    }
  },
  xAxis: {
    axisLabel: {
      fontSize: chartDesignTokens.typography.body.fontSize
    }
  },
  yAxis: {
    axisLabel: {
      fontSize: chartDesignTokens.typography.body.fontSize
    }
  },
  legend: {
    textStyle: {
      fontSize: chartDesignTokens.typography.caption.fontSize
    }
  }
};
```

**Spacing in Container:**
```tsx
<Box
  sx={{
    padding: chartDesignTokens.spacing.md,
    gap: chartDesignTokens.spacing.sm,
    marginBottom: chartDesignTokens.spacing.lg
  }}
>
  {/* content */}
</Box>
```

**Colors in Series:**
```tsx
// Categorical colors for distinct series
const option = {
  color: chartDesignTokens.colors.categorical,
  series: [
    { name: 'Series A', data: [...] },
    { name: 'Series B', data: [...] },
    { name: 'Series C', data: [...] }
  ]
};

// Sequential colors for heatmap
const option = {
  visualMap: {
    min: 0,
    max: 100,
    inRange: {
      color: chartDesignTokens.colors.sequential.blue
    }
  }
};

// Diverging colors for deviation chart
const option = {
  visualMap: {
    min: -100,
    max: 100,
    inRange: {
      color: chartDesignTokens.colors.diverging.redBlue
    }
  }
};
```

---

## Accessibility Checklist

### Essential Requirements

- [ ] **Container Labeling**
  - [ ] BaseChartContainer has descriptive `aria-label`
  - [ ] `aria-label` describes chart type and purpose
  - [ ] Example: `aria-label="Monthly sales bar chart showing revenue trends"`

- [ ] **Interactive Elements**
  - [ ] All IconButtons have `aria-label`
  - [ ] All buttons have visible text or `aria-label`
  - [ ] Tooltips provide additional context
  - [ ] Example: `<IconButton aria-label="Refresh chart data" title="Refresh">`

- [ ] **Form Controls**
  - [ ] All Select elements have associated labels
  - [ ] Radio/checkbox groups have fieldset and legend
  - [ ] Helper text linked with `aria-describedby`
  - [ ] Example:
    ```tsx
    <Select aria-label="Time range" aria-describedby="range-help">
      <MenuItem value="1h">1 Hour</MenuItem>
    </Select>
    <FormHelperText id="range-help">Select data time range</FormHelperText>
    ```

- [ ] **Dynamic Content**
  - [ ] Loading states use `aria-live="polite"`
  - [ ] Error messages use `aria-live="assertive"`
  - [ ] Status changes announced to screen readers
  - [ ] Example:
    ```tsx
    <Box aria-live="polite" aria-atomic="true">
      {isLoading ? 'Loading...' : 'Data loaded'}
    </Box>
    ```

- [ ] **Keyboard Navigation**
  - [ ] All interactive elements are keyboard accessible
  - [ ] Tab order is logical (top to bottom, left to right)
  - [ ] Focus indicators are visible
  - [ ] Enter/Space activate buttons
  - [ ] Arrow keys navigate selects and radio groups

- [ ] **Screen Reader Support**
  - [ ] Chart data described in text alternative
  - [ ] Complex charts have summary description
  - [ ] Data tables provided as fallback (if applicable)
  - [ ] Example:
    ```tsx
    <BaseChartContainer aria-label="Sales trend chart">
      <EChartsWrapper option={option} />
      <VisuallyHidden>
        <table>
          <caption>Sales data by month</caption>
          {/* data table */}
        </table>
      </VisuallyHidden>
    </BaseChartContainer>
    ```

- [ ] **Color and Contrast**
  - [ ] Color contrast ratio ≥ 4.5:1 for text
  - [ ] Information not conveyed by color alone
  - [ ] Patterns or labels supplement colors
  - [ ] High contrast mode supported

- [ ] **Touch Targets**
  - [ ] Interactive elements ≥ 44x44 pixels
  - [ ] Adequate spacing between touch targets
  - [ ] Mobile-friendly controls

### Testing Procedures

**Automated Testing:**
```bash
# Run accessibility tests
npm test -- --grep "accessibility"

# Run with axe-core
npm run test:a11y
```

**Manual Testing:**

1. **Keyboard Testing:**
   - [ ] Press Tab to move through all interactive elements
   - [ ] Verify focus indicators are visible
   - [ ] Press Enter/Space on buttons to activate
   - [ ] Use arrow keys in select dropdowns
   - [ ] Press Escape to close dialogs/menus

2. **Screen Reader Testing:**
   - [ ] NVDA (Windows): Navigate with arrows and Tab
   - [ ] JAWS (Windows): Use virtual cursor
   - [ ] VoiceOver (Mac): Use VO+arrows
   - [ ] Verify all content is announced
   - [ ] Check announcement order is logical

3. **Zoom Testing:**
   - [ ] Zoom to 200% in browser
   - [ ] Verify content doesn't overlap
   - [ ] Check all text is readable
   - [ ] Ensure interactive elements still accessible

4. **High Contrast Mode:**
   - [ ] Enable Windows High Contrast
   - [ ] Verify all UI elements visible
   - [ ] Check borders and outlines appear
   - [ ] Confirm text is readable

### Accessibility Quick Reference

```tsx
// Good accessibility example
<BaseChartContainer
  height={400}
  aria-label="Monthly temperature trend line chart showing average temperatures from January to December"
  role="region"
>
  <StandardChartHeader
    title="Temperature Trends"
    subtitle="Average monthly temperatures"
    actions={
      <Tooltip title="Refresh data">
        <IconButton
          onClick={handleRefresh}
          aria-label="Refresh temperature data"
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    }
  />

  <StandardChartToolbar
    showExport={true}
    showFullscreen={true}
    onExport={handleExport}
    exportFormats={['PNG', 'CSV']}
    aria-label="Chart tools"
  />

  <EChartsWrapper option={option} />

  <StandardChartFooter
    timestamp={lastUpdated}
    legendItems={[
      { label: 'High', color: '#d32f2f' },
      { label: 'Average', color: '#1976d2' },
      { label: 'Low', color: '#388e3c' }
    ]}
  />

  {/* Text alternative for screen readers */}
  <VisuallyHidden>
    <table>
      <caption>Monthly temperature data</caption>
      <thead>
        <tr>
          <th>Month</th>
          <th>High (°F)</th>
          <th>Average (°F)</th>
          <th>Low (°F)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>January</td>
          <td>45</td>
          <td>35</td>
          <td>25</td>
        </tr>
        {/* more rows */}
      </tbody>
    </table>
  </VisuallyHidden>
</BaseChartContainer>
```

---

## Testing Checklist

### Unit Tests

- [ ] **Component Rendering**
  - [ ] Chart renders without crashing
  - [ ] Header displays correctly
  - [ ] Toolbar displays when enabled
  - [ ] Footer displays when enabled
  - [ ] Empty state renders correctly
  - [ ] Loading state renders correctly
  - [ ] Error state renders correctly

- [ ] **Props Handling**
  - [ ] Title prop displays correctly
  - [ ] Subtitle prop displays correctly
  - [ ] Height prop applied correctly
  - [ ] Custom className applied
  - [ ] sx prop styles applied
  - [ ] All optional props work

- [ ] **User Interactions**
  - [ ] Refresh button triggers callback
  - [ ] Export button triggers callback
  - [ ] Fullscreen button triggers callback
  - [ ] Time range selector updates chart
  - [ ] Custom actions work correctly

- [ ] **Data Updates**
  - [ ] Chart updates when data changes
  - [ ] Chart updates when props change
  - [ ] Memoization prevents unnecessary renders
  - [ ] Loading state shows during updates

- [ ] **Theme Support**
  - [ ] Light theme renders correctly
  - [ ] Dark theme renders correctly
  - [ ] Theme switching works smoothly
  - [ ] Custom theme values respected

### Integration Tests

- [ ] **Complete User Flows**
  - [ ] User can view chart
  - [ ] User can refresh data
  - [ ] User can export chart (PNG, CSV, JSON)
  - [ ] User can enter fullscreen
  - [ ] User can change time range
  - [ ] User can interact with chart (zoom, pan)

- [ ] **Error Scenarios**
  - [ ] Invalid data handled gracefully
  - [ ] Network errors displayed
  - [ ] Export failures shown
  - [ ] Recoverable from error state

- [ ] **Performance**
  - [ ] Large datasets render efficiently
  - [ ] No memory leaks
  - [ ] Smooth animations
  - [ ] Fast data updates

### Accessibility Tests

- [ ] **ARIA Attributes**
  - [ ] aria-label present on container
  - [ ] aria-label present on all buttons
  - [ ] aria-live regions work correctly
  - [ ] role attributes correct

- [ ] **Keyboard Navigation**
  - [ ] Can tab to all interactive elements
  - [ ] Focus indicators visible
  - [ ] Enter/Space activate buttons
  - [ ] Escape closes dialogs

- [ ] **Screen Reader**
  - [ ] Chart announced correctly
  - [ ] Buttons announced with purpose
  - [ ] State changes announced
  - [ ] Errors announced

### Visual Regression Tests

- [ ] **Screenshot Comparisons**
  - [ ] Baseline screenshots captured
  - [ ] Light theme matches baseline
  - [ ] Dark theme matches baseline
  - [ ] Responsive layouts match baseline
  - [ ] No unexpected visual changes

### Test Examples

**Unit Test Example:**
```tsx
describe('MigratedChart', () => {
  it('renders header with title', () => {
    render(<MigratedChart title="Test Chart" data={mockData} />);
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = jest.fn();
    render(<MigratedChart onRefresh={onRefresh} data={mockData} />);

    fireEvent.click(screen.getByLabelText('Refresh chart data'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('updates when data changes', () => {
    const { rerender } = render(<MigratedChart data={[1, 2, 3]} />);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(<MigratedChart data={[4, 5, 6]} />);
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
```

**Integration Test Example:**
```tsx
describe('Chart Export Flow', () => {
  it('exports chart as PNG', async () => {
    const mockExport = jest.fn();
    render(<MigratedChart onExport={mockExport} data={mockData} />);

    // Open export menu
    fireEvent.click(screen.getByLabelText('Export chart'));

    // Select PNG format
    fireEvent.click(screen.getByText('PNG'));

    // Verify export called with correct format
    expect(mockExport).toHaveBeenCalledWith('PNG');
  });
});
```

**Accessibility Test Example:**
```tsx
describe('Chart Accessibility', () => {
  it('has proper ARIA labels', () => {
    render(<MigratedChart title="Test Chart" data={mockData} />);

    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('aria-label');

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toHaveAttribute('aria-label');
  });

  it('supports keyboard navigation', () => {
    render(<MigratedChart data={mockData} />);

    const refreshButton = screen.getByLabelText('Refresh chart data');
    refreshButton.focus();
    expect(refreshButton).toHaveFocus();
  });
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "chartDesignTokens.header is undefined"

**Problem:**
```tsx
// Error: Cannot read property 'height' of undefined
const headerHeight = chartDesignTokens.header.height;
```

**Solution:**
The token is `layout.headerHeight`, not `header.height`:
```tsx
// Correct
const headerHeight = chartDesignTokens.layout.headerHeight;
```

**Reference:**
Check the design token structure in `chartDesignTokens.ts`

---

#### Issue 2: "Chart not rendering"

**Problem:**
Chart area is blank or shows no content.

**Solution:**
Ensure the chart child has `height: 100%`:
```tsx
<BaseChartContainer height={400}>
  <EChartsWrapper
    option={option}
    style={{ height: '100%', width: '100%' }}
  />
</BaseChartContainer>
```

**Additional Checks:**
- Verify chart option is valid
- Check console for ECharts errors
- Ensure data is not empty
- Verify EChartsWrapper is imported correctly

---

#### Issue 3: "Toolbar buttons don't work"

**Problem:**
Export, fullscreen, or other toolbar buttons don't respond to clicks.

**Solution:**
Ensure you're passing callback functions, not calling them:
```tsx
// Wrong
<StandardChartToolbar onExport={handleExport()} />

// Correct
<StandardChartToolbar onExport={handleExport} />
```

**Also check:**
- Callbacks are defined and not undefined
- Callbacks are memoized with useCallback
- No errors in callback implementation

---

#### Issue 4: "Theme not updating"

**Problem:**
Chart doesn't change appearance when switching between light and dark themes.

**Solution:**
Ensure you're using theme values dynamically:
```tsx
const MyChart = () => {
  const theme = useTheme();

  // Wrong: Static colors
  const option = {
    textStyle: { color: '#000000' }
  };

  // Correct: Dynamic colors from theme
  const option = useMemo(() => ({
    textStyle: { color: theme.palette.text.primary }
  }), [theme]);

  return <EChartsWrapper option={option} />;
};
```

**Also check:**
- Component is wrapped in ThemeProvider
- useTheme hook is imported from '@mui/material/styles'
- Chart option is recreated when theme changes

---

#### Issue 5: "Memory leak warning"

**Problem:**
Console shows "Can't perform a React state update on an unmounted component"

**Solution:**
Clean up side effects in useEffect:
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);

  // Cleanup
  return () => clearInterval(interval);
}, [fetchData]);
```

**Also check:**
- Cancel pending promises on unmount
- Remove event listeners
- Clear timers and intervals

---

#### Issue 6: "Export doesn't include data"

**Problem:**
Exported PNG is blank or CSV is empty.

**Solution:**
Ensure chart is fully rendered before export:
```tsx
const handleExport = useCallback(async (format: string) => {
  if (format === 'PNG') {
    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));

    const chartInstance = echartRef.current?.getEchartsInstance();
    const dataUrl = chartInstance?.getDataURL();
    // ... download logic
  }
}, []);
```

**Also check:**
- Chart option contains valid data
- Export format is supported
- Browser has necessary permissions

---

#### Issue 7: "Responsive height not working"

**Problem:**
Chart height doesn't adjust based on screen size.

**Solution:**
Pass dynamic height based on breakpoints:
```tsx
const MyChart = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const height = isMobile ? 250 : 400;

  return (
    <BaseChartContainer height={height}>
      {/* chart */}
    </BaseChartContainer>
  );
};
```

**Also check:**
- useMediaQuery is imported
- Breakpoints are correct
- Component re-renders on breakpoint changes

---

#### Issue 8: "TypeScript errors with chart option"

**Problem:**
TypeScript complains about chart option types.

**Solution:**
Import ECharts types and use them:
```tsx
import { EChartsOption } from 'echarts';

const option: EChartsOption = {
  xAxis: { type: 'category' },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [1, 2, 3] }]
};
```

**Also check:**
- @types/echarts is installed
- tsconfig.json includes proper settings
- Using correct type for series type

---

#### Issue 9: "Footer legend items not displaying"

**Problem:**
Legend items passed to footer don't appear.

**Solution:**
Ensure legendItems prop is correctly formatted:
```tsx
// Wrong: Just strings
<StandardChartFooter legendItems={['Item 1', 'Item 2']} />

// Correct: Array of objects with label and color
<StandardChartFooter
  legendItems={[
    { label: 'Item 1', color: '#1976d2' },
    { label: 'Item 2', color: '#d32f2f' }
  ]}
/>
```

**Also check:**
- Colors are valid CSS color values
- Labels are strings
- Array is not empty

---

#### Issue 10: "Performance degradation with large datasets"

**Problem:**
Chart becomes slow or unresponsive with many data points.

**Solution:**
Implement data downsampling and memoization:
```tsx
const downsampledData = useMemo(() => {
  if (data.length > 1000) {
    // Keep every Nth point
    const step = Math.ceil(data.length / 1000);
    return data.filter((_, index) => index % step === 0);
  }
  return data;
}, [data]);

const option = useMemo(() =>
  createChartOption(downsampledData),
  [downsampledData]
);
```

**Also check:**
- Enable ECharts data sampling: `sampling: 'lttb'`
- Use canvas renderer for large datasets
- Consider virtual scrolling for very large datasets

---

### Getting Help

If you encounter an issue not covered here:

1. **Check Documentation:**
   - Review the design system specification
   - Check the implementation guide
   - Look at example implementations

2. **Search Codebase:**
   - Find similar chart implementations
   - Review test files for examples
   - Check component stories (Storybook)

3. **Debug Systematically:**
   - Add console.logs to trace data flow
   - Use React DevTools to inspect component tree
   - Check browser console for errors
   - Use ECharts debugger

4. **Ask for Help:**
   - Create detailed issue report
   - Include code snippet
   - Provide error messages
   - Share what you've tried
   - Contact frontend team

---

## Before/After Examples

### Example 1: EChartsTimeSeriesChart

**Before (Original Implementation):**
```tsx
import React, { useMemo } from 'react';
import { Box, Typography, IconButton, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';

interface TimeSeriesChartProps {
  title: string;
  data: Array<{ timestamp: string; value: number }>;
  onRefresh?: () => void;
}

export const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  data,
  onRefresh
}) => {
  const option: EChartsOption = useMemo(() => ({
    color: ['#1976d2'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1,
      textStyle: {
        color: '#333333',
        fontSize: 12
      }
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: {
        lineStyle: { color: '#e0e0e0' }
      },
      axisLabel: {
        fontSize: 12,
        color: '#666666'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: '#e0e0e0' }
      },
      axisLabel: {
        fontSize: 12,
        color: '#666666'
      },
      splitLine: {
        lineStyle: { color: '#f0f0f0' }
      }
    },
    series: [{
      type: 'line',
      data: data.map(d => [d.timestamp, d.value]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2
      },
      areaStyle: {
        opacity: 0.3
      }
    }],
    grid: {
      left: 50,
      right: 20,
      top: 20,
      bottom: 40
    }
  }), [data]);

  return (
    <Box
      sx={{
        padding: 2,
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#ffffff'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 2
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#333333'
          }}
        >
          {title}
        </Typography>
        {onRefresh && (
          <IconButton onClick={onRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        )}
      </Box>

      <Box sx={{ height: 350 }}>
        <EChartsWrapper option={option} />
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 1,
          gap: 1
        }}
      >
        <Button size="small" variant="outlined">1H</Button>
        <Button size="small" variant="outlined">24H</Button>
        <Button size="small" variant="contained">7D</Button>
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          marginTop: 1,
          color: '#666666',
          textAlign: 'right'
        }}
      >
        Last updated: {new Date().toLocaleString()}
      </Typography>
    </Box>
  );
};
```

**After (Unified System):**
```tsx
import React, { useMemo, useCallback, useState } from 'react';
import { IconButton, Tooltip, ToggleButtonGroup, ToggleButton, Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar,
  StandardChartFooter,
  chartDesignTokens
} from '@/components/charts/unified';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';
import { useTheme } from '@mui/material/styles';

interface TimeSeriesChartProps {
  title: string;
  subtitle?: string;
  data: Array<{ timestamp: string; value: number }>;
  onRefresh?: () => void;
  showExport?: boolean;
  showFullscreen?: boolean;
}

export const EChartsTimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  subtitle,
  data,
  onRefresh,
  showExport = true,
  showFullscreen = true
}) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<string>('7d');

  const handleTimeRangeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newRange: string | null) => {
      if (newRange !== null) {
        setTimeRange(newRange);
      }
    },
    []
  );

  const handleExport = useCallback((format: string) => {
    console.log(`Exporting chart as ${format}`);
    // Export implementation
  }, []);

  const option: EChartsOption = useMemo(() => ({
    color: chartDesignTokens.colors.categorical,
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.palette.background.paper,
      borderColor: theme.palette.divider,
      borderWidth: 1,
      textStyle: {
        color: theme.palette.text.primary,
        fontSize: chartDesignTokens.typography.body.fontSize
      }
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: {
        lineStyle: { color: theme.palette.divider }
      },
      axisLabel: {
        fontSize: chartDesignTokens.typography.body.fontSize,
        color: theme.palette.text.secondary
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: theme.palette.divider }
      },
      axisLabel: {
        fontSize: chartDesignTokens.typography.body.fontSize,
        color: theme.palette.text.secondary
      },
      splitLine: {
        lineStyle: { color: theme.palette.divider }
      }
    },
    series: [{
      type: 'line',
      data: data.map(d => [d.timestamp, d.value]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: chartDesignTokens.colors.categorical[0]
      },
      areaStyle: {
        opacity: 0.3,
        color: chartDesignTokens.colors.categorical[0]
      }
    }],
    grid: {
      left: chartDesignTokens.spacing.lg,
      right: chartDesignTokens.spacing.md,
      top: chartDesignTokens.spacing.md,
      bottom: chartDesignTokens.spacing.xl
    }
  }), [data, theme]);

  return (
    <BaseChartContainer
      height={400}
      aria-label={`${title} time series chart showing data trends`}
      header={
        <StandardChartHeader
          title={title}
          subtitle={subtitle}
          actions={
            onRefresh && (
              <Tooltip title="Refresh data">
                <IconButton
                  onClick={onRefresh}
                  size="small"
                  aria-label="Refresh chart data"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )
          }
        />
      }
      toolbar={
        <StandardChartToolbar
          showExport={showExport}
          showFullscreen={showFullscreen}
          onExport={handleExport}
          exportFormats={['PNG', 'CSV', 'JSON']}
        />
      }
      footer={
        <StandardChartFooter timestamp={new Date().toISOString()}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%'
            }}
          >
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              aria-label="Select time range"
              size="small"
            >
              <ToggleButton value="1h" aria-label="1 hour">
                1H
              </ToggleButton>
              <ToggleButton value="24h" aria-label="24 hours">
                24H
              </ToggleButton>
              <ToggleButton value="7d" aria-label="7 days">
                7D
              </ToggleButton>
              <ToggleButton value="30d" aria-label="30 days">
                30D
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </StandardChartFooter>
      }
    >
      <EChartsWrapper option={option} style={{ height: '100%', width: '100%' }} />
    </BaseChartContainer>
  );
};
```

**Key Improvements:**
- Consistent component structure with unified system
- All styling uses design tokens
- Theme-aware colors (supports light/dark mode)
- Comprehensive accessibility attributes
- Better toolbar with export functionality
- ToggleButtonGroup for time range (better UX)
- Proper TypeScript types
- Memoized callbacks to prevent re-renders
- Cleaner, more maintainable code

### Example 2: EChartsHeatmap

**Before (Original Implementation):**
```tsx
import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';

interface HeatmapData {
  x: number;
  y: number;
  value: number;
}

interface HeatmapProps {
  title: string;
  data: HeatmapData[];
  xLabels: string[];
  yLabels: string[];
}

export const EChartsHeatmap: React.FC<HeatmapProps> = ({
  title,
  data,
  xLabels,
  yLabels
}) => {
  const option: EChartsOption = useMemo(() => ({
    tooltip: {
      position: 'top'
    },
    grid: {
      height: '70%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      splitArea: {
        show: true
      }
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: {
        show: true
      }
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#e3f2fd', '#90caf9', '#42a5f5', '#1976d2', '#0d47a1']
      }
    },
    series: [{
      name: 'Value',
      type: 'heatmap',
      data: data.map(d => [d.x, d.y, d.value]),
      label: {
        show: true
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }), [data, xLabels, yLabels]);

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" sx={{ marginBottom: 2 }}>
        {title}
      </Typography>
      <Box sx={{ height: 400 }}>
        <EChartsWrapper option={option} />
      </Box>
    </Box>
  );
};
```

**After (Unified System):**
```tsx
import React, { useMemo, useCallback } from 'react';
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar,
  StandardChartFooter,
  chartDesignTokens
} from '@/components/charts/unified';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';
import { useTheme } from '@mui/material/styles';

interface HeatmapData {
  x: number;
  y: number;
  value: number;
}

interface HeatmapProps {
  title: string;
  subtitle?: string;
  data: HeatmapData[];
  xLabels: string[];
  yLabels: string[];
  min?: number;
  max?: number;
  showExport?: boolean;
  lastUpdated?: string;
}

export const EChartsHeatmap: React.FC<HeatmapProps> = ({
  title,
  subtitle,
  data,
  xLabels,
  yLabels,
  min = 0,
  max = 100,
  showExport = true,
  lastUpdated
}) => {
  const theme = useTheme();

  const handleExport = useCallback((format: string) => {
    console.log(`Exporting heatmap as ${format}`);
    // Export implementation
  }, []);

  const option: EChartsOption = useMemo(() => ({
    tooltip: {
      position: 'top',
      backgroundColor: theme.palette.background.paper,
      borderColor: theme.palette.divider,
      borderWidth: 1,
      textStyle: {
        color: theme.palette.text.primary,
        fontSize: chartDesignTokens.typography.body.fontSize
      },
      formatter: (params: any) => {
        return `
          <strong>${xLabels[params.value[0]]} - ${yLabels[params.value[1]]}</strong><br/>
          Value: ${params.value[2]}
        `;
      }
    },
    grid: {
      height: '60%',
      top: chartDesignTokens.spacing.xl,
      left: chartDesignTokens.spacing.lg,
      right: chartDesignTokens.spacing.md,
      bottom: '20%'
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      splitArea: {
        show: true
      },
      axisLabel: {
        fontSize: chartDesignTokens.typography.body.fontSize,
        color: theme.palette.text.secondary
      }
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: {
        show: true
      },
      axisLabel: {
        fontSize: chartDesignTokens.typography.body.fontSize,
        color: theme.palette.text.secondary
      }
    },
    visualMap: {
      min,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: chartDesignTokens.spacing.md,
      inRange: {
        color: chartDesignTokens.colors.sequential.blue
      },
      textStyle: {
        color: theme.palette.text.primary,
        fontSize: chartDesignTokens.typography.caption.fontSize
      }
    },
    series: [{
      name: 'Value',
      type: 'heatmap',
      data: data.map(d => [d.x, d.y, d.value]),
      label: {
        show: true,
        fontSize: chartDesignTokens.typography.caption.fontSize,
        color: theme.palette.getContrastText(theme.palette.primary.main)
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.5)'
            : 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }), [data, xLabels, yLabels, min, max, theme]);

  return (
    <BaseChartContainer
      height={500}
      aria-label={`${title} heatmap showing data distribution across ${xLabels.length} categories`}
      header={
        <StandardChartHeader
          title={title}
          subtitle={subtitle}
        />
      }
      toolbar={
        <StandardChartToolbar
          showExport={showExport}
          showFullscreen={true}
          onExport={handleExport}
          exportFormats={['PNG', 'CSV']}
        />
      }
      footer={
        lastUpdated && (
          <StandardChartFooter timestamp={lastUpdated} />
        )
      }
    >
      <EChartsWrapper option={option} style={{ height: '100%', width: '100%' }} />
    </BaseChartContainer>
  );
};
```

**Key Improvements:**
- Used sequential colors from design tokens
- Theme-aware tooltips and labels
- Better accessibility with descriptive aria-label
- Export and fullscreen functionality
- Configurable min/max values
- Custom tooltip formatter
- Proper contrast for labels
- Theme-aware shadows
- Footer with timestamp

### Example 3: EChartsSPCChart (Statistical Process Control)

**Before (Original Implementation):**
```tsx
import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';

interface SPCData {
  timestamp: string;
  value: number;
}

interface SPCChartProps {
  title: string;
  data: SPCData[];
  ucl: number; // Upper Control Limit
  lcl: number; // Lower Control Limit
  mean: number;
}

export const EChartsSPCChart: React.FC<SPCChartProps> = ({
  title,
  data,
  ucl,
  lcl,
  mean
}) => {
  const option: EChartsOption = useMemo(() => {
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp);

    return {
      color: ['#1976d2', '#d32f2f', '#388e3c', '#f57c00'],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['Value', 'UCL', 'Mean', 'LCL']
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        boundaryGap: false
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Value',
          type: 'line',
          data: values,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 }
        },
        {
          name: 'UCL',
          type: 'line',
          data: Array(values.length).fill(ucl),
          lineStyle: {
            type: 'dashed',
            color: '#d32f2f',
            width: 2
          },
          symbol: 'none'
        },
        {
          name: 'Mean',
          type: 'line',
          data: Array(values.length).fill(mean),
          lineStyle: {
            type: 'solid',
            color: '#388e3c',
            width: 2
          },
          symbol: 'none'
        },
        {
          name: 'LCL',
          type: 'line',
          data: Array(values.length).fill(lcl),
          lineStyle: {
            type: 'dashed',
            color: '#d32f2f',
            width: 2
          },
          symbol: 'none'
        }
      ]
    };
  }, [data, ucl, lcl, mean]);

  // Calculate violations
  const violations = data.filter(d => d.value > ucl || d.value < lcl).length;

  return (
    <Paper sx={{ padding: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Box>
          <Typography variant="body2" color={violations > 0 ? 'error' : 'success'}>
            Violations: {violations}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ height: 400 }}>
        <EChartsWrapper option={option} />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, marginTop: 2 }}>
        <Typography variant="caption">
          UCL: {ucl.toFixed(2)}
        </Typography>
        <Typography variant="caption">
          Mean: {mean.toFixed(2)}
        </Typography>
        <Typography variant="caption">
          LCL: {lcl.toFixed(2)}
        </Typography>
      </Box>
    </Paper>
  );
};
```

**After (Unified System):**
```tsx
import React, { useMemo, useCallback } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  BaseChartContainer,
  StandardChartHeader,
  StandardChartToolbar,
  StandardChartFooter,
  chartDesignTokens
} from '@/components/charts/unified';
import { EChartsWrapper } from '@/components/charts/EChartsWrapper';
import { EChartsOption } from 'echarts';
import { useTheme } from '@mui/material/styles';

interface SPCData {
  timestamp: string;
  value: number;
}

interface SPCChartProps {
  title: string;
  subtitle?: string;
  data: SPCData[];
  ucl: number; // Upper Control Limit
  lcl: number; // Lower Control Limit
  mean: number;
  showExport?: boolean;
  onViolationClick?: (violations: SPCData[]) => void;
}

export const EChartsSPCChart: React.FC<SPCChartProps> = ({
  title,
  subtitle,
  data,
  ucl,
  lcl,
  mean,
  showExport = true,
  onViolationClick
}) => {
  const theme = useTheme();

  // Calculate violations
  const violations = useMemo(() =>
    data.filter(d => d.value > ucl || d.value < lcl),
    [data, ucl, lcl]
  );

  const handleExport = useCallback((format: string) => {
    console.log(`Exporting SPC chart as ${format}`);
    // Export implementation
  }, []);

  const handleViolationClick = useCallback(() => {
    if (onViolationClick && violations.length > 0) {
      onViolationClick(violations);
    }
  }, [violations, onViolationClick]);

  const option: EChartsOption = useMemo(() => {
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp);

    // Identify out-of-control points
    const markPointData = data
      .map((d, index) => ({
        coord: [index, d.value],
        value: d.value,
        itemStyle: {
          color: d.value > ucl || d.value < lcl
            ? chartDesignTokens.colors.categorical[1] // Red
            : 'transparent'
        }
      }))
      .filter(point => point.itemStyle.color !== 'transparent');

    return {
      color: chartDesignTokens.colors.categorical,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        textStyle: {
          color: theme.palette.text.primary,
          fontSize: chartDesignTokens.typography.body.fontSize
        },
        formatter: (params: any) => {
          const dataPoint = params[0];
          const value = dataPoint.value;
          const isViolation = value > ucl || value < lcl;

          return `
            <strong>${dataPoint.axisValue}</strong><br/>
            Value: ${value.toFixed(2)}<br/>
            ${isViolation ? '<span style="color: ' + chartDesignTokens.colors.categorical[1] + '">⚠️ Out of Control</span>' : '✓ In Control'}
          `;
        }
      },
      legend: {
        data: ['Value', 'UCL', 'Mean', 'LCL'],
        textStyle: {
          fontSize: chartDesignTokens.typography.body.fontSize,
          color: theme.palette.text.primary
        }
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        boundaryGap: false,
        axisLabel: {
          fontSize: chartDesignTokens.typography.body.fontSize,
          color: theme.palette.text.secondary
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: chartDesignTokens.typography.body.fontSize,
          color: theme.palette.text.secondary
        },
        splitLine: {
          lineStyle: { color: theme.palette.divider }
        }
      },
      series: [
        {
          name: 'Value',
          type: 'line',
          data: values,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 2,
            color: chartDesignTokens.colors.categorical[0]
          },
          markPoint: {
            data: markPointData,
            symbol: 'circle',
            symbolSize: 10,
            label: {
              show: false
            }
          }
        },
        {
          name: 'UCL',
          type: 'line',
          data: Array(values.length).fill(ucl),
          lineStyle: {
            type: 'dashed',
            color: chartDesignTokens.colors.categorical[1],
            width: 2
          },
          symbol: 'none'
        },
        {
          name: 'Mean',
          type: 'line',
          data: Array(values.length).fill(mean),
          lineStyle: {
            type: 'solid',
            color: chartDesignTokens.colors.categorical[2],
            width: 2
          },
          symbol: 'none'
        },
        {
          name: 'LCL',
          type: 'line',
          data: Array(values.length).fill(lcl),
          lineStyle: {
            type: 'dashed',
            color: chartDesignTokens.colors.categorical[1],
            width: 2
          },
          symbol: 'none'
        }
      ],
      grid: {
        left: chartDesignTokens.spacing.lg,
        right: chartDesignTokens.spacing.md,
        top: chartDesignTokens.spacing.xl,
        bottom: chartDesignTokens.spacing.xl
      }
    };
  }, [data, ucl, lcl, mean, theme]);

  const legendItems = useMemo(() => [
    { label: 'Value', color: chartDesignTokens.colors.categorical[0] },
    { label: 'UCL', color: chartDesignTokens.colors.categorical[1] },
    { label: 'Mean', color: chartDesignTokens.colors.categorical[2] },
    { label: 'LCL', color: chartDesignTokens.colors.categorical[1] }
  ], []);

  return (
    <BaseChartContainer
      height={450}
      aria-label={`${title} Statistical Process Control chart with ${violations.length} violations`}
      header={
        <StandardChartHeader
          title={title}
          subtitle={subtitle}
          actions={
            <Chip
              icon={violations.length > 0 ? <WarningIcon /> : <CheckCircleIcon />}
              label={`${violations.length} Violation${violations.length !== 1 ? 's' : ''}`}
              color={violations.length > 0 ? 'error' : 'success'}
              size="small"
              onClick={handleViolationClick}
              aria-label={`${violations.length} control limit violations`}
              sx={{ cursor: onViolationClick ? 'pointer' : 'default' }}
            />
          }
        />
      }
      toolbar={
        <StandardChartToolbar
          showExport={showExport}
          showFullscreen={true}
          onExport={handleExport}
          exportFormats={['PNG', 'CSV']}
        />
      }
      footer={
        <StandardChartFooter legendItems={legendItems}>
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              justifyContent: 'center',
              width: '100%'
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: chartDesignTokens.typography.caption.fontSize
              }}
            >
              UCL: <strong>{ucl.toFixed(2)}</strong>
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: chartDesignTokens.typography.caption.fontSize
              }}
            >
              Mean: <strong>{mean.toFixed(2)}</strong>
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: chartDesignTokens.typography.caption.fontSize
              }}
            >
              LCL: <strong>{lcl.toFixed(2)}</strong>
            </Typography>
          </Box>
        </StandardChartFooter>
      }
    >
      <EChartsWrapper option={option} style={{ height: '100%', width: '100%' }} />
    </BaseChartContainer>
  );
};
```

**Key Improvements:**
- Used design tokens for all colors and spacing
- Theme-aware styling (light/dark mode support)
- Violation tracking with interactive Chip component
- Visual markers for out-of-control points
- Enhanced tooltip showing control status
- Export and fullscreen functionality
- Legend in footer
- Statistical values displayed in footer
- Callback for violation interaction
- Comprehensive accessibility
- Better TypeScript typing
- Memoized calculations for performance

---

## Resources

### Documentation

- **Design System Specification:** `docs/specs/UNIFIED_CHART_DESIGN_SYSTEM_SPEC.md`
- **Implementation Guide:** `docs/guides/UNIFIED_CHART_IMPLEMENTATION_GUIDE.md`
- **Component API Reference:** `src/components/charts/unified/README.md` (coming soon)

### Code Examples

- **Component Source:** `src/components/charts/unified/`
- **Test Examples:** `src/components/charts/unified/__tests__/`
- **Story Examples:** `.storybook/stories/charts/` (coming soon)

### External Resources

- **Material-UI Documentation:** https://mui.com/material-ui/
- **ECharts Documentation:** https://echarts.apache.org/en/index.html
- **React Documentation:** https://react.dev/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

### Tools

- **React DevTools:** Browser extension for debugging React components
- **ECharts Debugger:** Built-in ECharts debugging tools
- **axe DevTools:** Accessibility testing browser extension
- **Lighthouse:** Automated accessibility and performance audits

### Support

- **Frontend Team:** Contact via Slack #frontend-team
- **Design System Questions:** Contact via Slack #design-system
- **Bug Reports:** Create issue in project repository
- **Feature Requests:** Discuss in team meetings

---

## Conclusion

Migrating to the Unified Chart System brings significant benefits in consistency, accessibility, and maintainability. By following this guide and referring to the provided examples, you can successfully migrate any existing chart component.

**Key Takeaways:**

1. **Plan before you code:** Analyze your current chart structure
2. **Use design tokens:** Replace all hardcoded values
3. **Add accessibility:** WCAG 2.1 Level AA compliance is essential
4. **Test thoroughly:** Unit, integration, and accessibility tests
5. **Ask for help:** The team is here to support you

**Migration Checklist:**

- [ ] Read this entire guide
- [ ] Analyze current chart implementation
- [ ] Identify component mappings
- [ ] Replace with unified components
- [ ] Update styling to use design tokens
- [ ] Add accessibility attributes
- [ ] Write comprehensive tests
- [ ] Update documentation
- [ ] Get code review
- [ ] Deploy with confidence

Happy migrating! 🚀

---

**Document Version:** 1.0.0
**Last Updated:** October 13, 2025
**Maintained By:** Frontend Team
**Questions?** Contact #frontend-team on Slack
