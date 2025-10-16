# ChartBuilderWizard Usage Guide

## Quick Start

### Basic Implementation

```typescript
import { ChartBuilderWizard, WizardResult } from '@/components/charts';

function DashboardPage() {
  const handleComplete = (result: WizardResult) => {
    // Save chart configuration
    console.log('New chart created:', result);
    // result.chartType - The selected chart type
    // result.config - Full chart configuration
    // result.selectedBuildings - Array of building IDs
    // result.title - Chart title
    // result.dataSource - Optional data source
  };

  const handleCancel = () => {
    // User cancelled wizard
    console.log('Wizard cancelled');
  };

  return (
    <ChartBuilderWizard
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );
}
```

### With Custom Data

```typescript
import { ChartBuilderWizard } from '@/components/charts';

function DashboardWithData() {
  const buildings = [
    { id: 'bldg-1', name: 'Main Office', system: 'HVAC' },
    { id: 'bldg-2', name: 'West Wing', system: 'Electrical' },
    { id: 'bldg-3', name: 'Data Center', system: 'Cooling' },
  ];

  const metrics = [
    { value: 'temp', label: 'Temperature', unit: '°F' },
    { value: 'humidity', label: 'Humidity', unit: '%' },
    { value: 'co2', label: 'CO2 Level', unit: 'ppm' },
    { value: 'energy', label: 'Energy Usage', unit: 'kWh' },
  ];

  const systems = [
    { value: 'hvac', label: 'HVAC System' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'lighting', label: 'Lighting' },
  ];

  return (
    <ChartBuilderWizard
      onComplete={saveChart}
      onCancel={closeWizard}
      availableBuildings={buildings}
      availableMetrics={metrics}
      buildingSystems={systems}
    />
  );
}
```

### With Initial Configuration (Edit Mode)

```typescript
import { ChartBuilderWizard } from '@/components/charts';

function EditChartPage({ existingChart }) {
  const initialConfig = {
    chartType: existingChart.type,
    config: existingChart.config,
    selectedBuildings: existingChart.buildings,
    title: existingChart.title,
    dataSource: existingChart.dataSource,
  };

  const handleUpdate = (result: WizardResult) => {
    // Update existing chart
    updateChart(existingChart.id, result);
  };

  return (
    <ChartBuilderWizard
      onComplete={handleUpdate}
      onCancel={goBack}
      initialConfig={initialConfig}
      availableBuildings={buildings}
      availableMetrics={metrics}
      buildingSystems={systems}
    />
  );
}
```

## Step-by-Step Workflow

### Step 1: Select Chart Type

**User Actions**:
1. Review available chart types
2. Use category filters to narrow choices (optional)
3. Click on desired chart type card

**Chart Types Available**:
- **Time Series**: Line, Area
- **Comparison**: Bar, Gauge, Radar
- **Composition**: Pie, Treemap
- **Relationship**: Scatter, Heatmap
- **Statistical**: Box Plot, Deviation Heatmap

**Tips**:
- Read the description and use cases for each chart
- Category badges show the chart's primary purpose
- Selected chart will be highlighted with blue border

### Step 2: Configure Chart

**User Actions**:
1. Fill in chart title
2. Select building system (optional)
3. Configure time range
4. Select metrics/dimensions
5. Adjust chart-specific settings

**Common Settings** (Most Charts):
- Title
- Building System filter
- Time Range (preset or custom)
- Refresh interval
- Data aggregation method

**Chart-Specific Settings**:

**Line/Area Charts**:
- Multiple metrics selection
- Y-axis label and unit
- Smoothing
- Show data points
- Fill area (area chart)

**Bar Charts**:
- Orientation (vertical/horizontal)
- Stacked vs grouped
- Bar width
- Show values on bars

**Heatmap**:
- X and Y dimensions
- Color scale type
- Color scheme
- Show values in cells

**Box Plot**:
- Metric and grouping
- Show outliers
- Whisker calculation method
- Mean/median lines

### Step 3: Select Data

**User Actions**:
1. Enter chart title (required)
2. Specify data source (optional)
3. Select one or more buildings

**Building Selection**:
- Use checkboxes to select individual buildings
- "Select All" button for quick selection
- "Deselect All" to clear selection
- Selected count shows at bottom

**Validation**:
- Title must not be empty
- At least one building must be selected
- Next button disabled until valid

### Step 4: Preview & Save

**Review Sections**:
1. **Chart Summary**: Type, title, category
2. **Selected Buildings**: Grid of chosen buildings
3. **Configuration**: Full JSON preview

**Final Actions**:
- Review all settings
- Click "Complete" to save
- Or click "Back" to make changes

## Working with Results

### WizardResult Structure

```typescript
interface WizardResult {
  chartType: ChartType;           // 'line' | 'bar' | 'heatmap' etc.
  config: ChartConfiguration;     // Chart-specific configuration
  selectedBuildings: string[];    // Array of building IDs
  dataSource: string;             // Optional data source
  title: string;                  // Chart title
}
```

### Saving Results

```typescript
const handleComplete = async (result: WizardResult) => {
  try {
    // Save to backend
    const response = await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: result.chartType,
        title: result.title,
        config: result.config,
        buildings: result.selectedBuildings,
        dataSource: result.dataSource,
        createdAt: new Date().toISOString(),
      }),
    });

    const savedChart = await response.json();

    // Navigate to chart view
    router.push(`/charts/${savedChart.id}`);
  } catch (error) {
    console.error('Failed to save chart:', error);
    showErrorToast('Failed to save chart');
  }
};
```

### Accessing Configuration

```typescript
const handleComplete = (result: WizardResult) => {
  // Access type-specific configuration
  switch (result.chartType) {
    case 'line':
      const lineConfig = result.config as LineChartConfig;
      console.log('Metrics:', lineConfig.metrics);
      console.log('Smooth:', lineConfig.smooth);
      break;

    case 'bar':
      const barConfig = result.config as BarChartConfig;
      console.log('Orientation:', barConfig.orientation);
      console.log('Stacked:', barConfig.stacked);
      break;

    case 'heatmap':
      const heatmapConfig = result.config as HeatmapConfig;
      console.log('X Dimension:', heatmapConfig.xDimension);
      console.log('Y Dimension:', heatmapConfig.yDimension);
      break;
  }
};
```

## Advanced Usage

### Modal Dialog Integration

```typescript
import { Dialog } from '@/components/ui/Dialog';
import { ChartBuilderWizard } from '@/components/charts';

function DashboardWithModal() {
  const [showWizard, setShowWizard] = useState(false);

  const handleComplete = (result: WizardResult) => {
    saveChart(result);
    setShowWizard(false);
  };

  return (
    <>
      <button onClick={() => setShowWizard(true)}>
        Create New Chart
      </button>

      <Dialog open={showWizard} onClose={() => setShowWizard(false)}>
        <ChartBuilderWizard
          onComplete={handleComplete}
          onCancel={() => setShowWizard(false)}
        />
      </Dialog>
    </>
  );
}
```

### Multi-Step Form with Routing

```typescript
import { useRouter } from 'next/router';
import { ChartBuilderWizard } from '@/components/charts';

function CreateChartPage() {
  const router = useRouter();

  const handleComplete = async (result: WizardResult) => {
    const chart = await createChart(result);
    router.push(`/charts/${chart.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Chart</h1>
      <ChartBuilderWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
```

### Conditional Logic Based on Chart Type

```typescript
const handleComplete = (result: WizardResult) => {
  // Different handling based on chart type
  const handlers = {
    line: handleTimeSeriesChart,
    bar: handleComparisonChart,
    heatmap: handleMatrixChart,
    deviationHeatmap: handleDeviationChart,
  };

  const handler = handlers[result.chartType];
  if (handler) {
    handler(result);
  }
};

function handleTimeSeriesChart(result: WizardResult) {
  const config = result.config as LineChartConfig;
  // Set up real-time data streaming
  setupRealtimeUpdates(result.selectedBuildings, config.metrics);
}

function handleDeviationChart(result: WizardResult) {
  const config = result.config as DeviationHeatmapConfig;
  // Calculate baseline for comparison
  calculateBaseline(result.selectedBuildings, config.baselineType);
}
```

### Validation and Error Handling

```typescript
const handleComplete = async (result: WizardResult) => {
  // Validate before saving
  if (!validateChartConfig(result)) {
    showErrorToast('Invalid chart configuration');
    return;
  }

  // Check permissions
  const hasPermission = await checkBuildingAccess(result.selectedBuildings);
  if (!hasPermission) {
    showErrorToast('You do not have access to selected buildings');
    return;
  }

  // Save with error handling
  try {
    await saveChart(result);
    showSuccessToast('Chart created successfully');
  } catch (error) {
    console.error('Save failed:', error);
    showErrorToast('Failed to create chart');
  }
};
```

## Chart Type Specific Examples

### Creating a Line Chart

```typescript
// Result will contain:
{
  chartType: 'line',
  config: {
    title: 'Temperature Trends',
    timeRange: { range: '24h', refreshInterval: 300 },
    buildingSystem: 'hvac',
    metrics: ['temp', 'humidity'],
    yAxis: { label: 'Temperature', unit: '°F' },
    smooth: true,
    showPoints: false,
    lineWidth: 2,
    // ... other line chart options
  },
  selectedBuildings: ['bldg-1', 'bldg-2'],
  title: 'Temperature Trends',
  dataSource: 'InfluxDB'
}
```

### Creating a Deviation Heatmap

```typescript
// Result will contain:
{
  chartType: 'deviationHeatmap',
  config: {
    title: 'Energy Deviation Analysis',
    timeRange: { range: '7d' },
    metric: 'energy',
    xDimension: 'hour',
    yDimension: 'dayOfWeek',
    baselineType: 'average',
    showDeviationScale: true,
    deviationThresholds: [
      { value: -20, color: '#2563eb', label: 'Below Normal' },
      { value: 0, color: '#10b981', label: 'Normal' },
      { value: 20, color: '#ef4444', label: 'Above Normal' }
    ],
    // ... other heatmap options
  },
  selectedBuildings: ['bldg-1', 'bldg-2', 'bldg-3'],
  title: 'Energy Deviation Analysis',
  dataSource: ''
}
```

### Creating a Box Plot

```typescript
// Result will contain:
{
  chartType: 'boxplot',
  config: {
    title: 'Temperature Distribution by Zone',
    timeRange: { range: '30d' },
    metric: 'temp',
    groupBy: 'zone',
    showOutliers: true,
    outlierSymbol: 'circle',
    showMean: true,
    showMedian: true,
    whiskerMultiplier: 1.5,
    // ... other box plot options
  },
  selectedBuildings: ['bldg-1'],
  title: 'Temperature Distribution by Zone',
  dataSource: ''
}
```

## Best Practices

### 1. Provide Complete Data

Always provide buildings, metrics, and systems for better UX:

```typescript
✅ Good
<ChartBuilderWizard
  availableBuildings={fetchedBuildings}
  availableMetrics={fetchedMetrics}
  buildingSystems={fetchedSystems}
  onComplete={handleComplete}
/>

❌ Bad (uses defaults)
<ChartBuilderWizard onComplete={handleComplete} />
```

### 2. Handle Cancellation

Always provide a cancel handler:

```typescript
✅ Good
<ChartBuilderWizard
  onComplete={handleComplete}
  onCancel={() => router.back()}
/>

❌ Bad (no cancel handling)
<ChartBuilderWizard onComplete={handleComplete} />
```

### 3. Validate Results

Check the result before using it:

```typescript
✅ Good
const handleComplete = (result: WizardResult) => {
  if (result.selectedBuildings.length === 0) {
    console.error('No buildings selected');
    return;
  }
  saveChart(result);
};

❌ Bad (no validation)
const handleComplete = (result: WizardResult) => {
  saveChart(result);
};
```

### 4. Provide Feedback

Show loading/success/error states:

```typescript
✅ Good
const handleComplete = async (result: WizardResult) => {
  setLoading(true);
  try {
    await saveChart(result);
    showToast('Chart created!', 'success');
  } catch (error) {
    showToast('Failed to create chart', 'error');
  } finally {
    setLoading(false);
  }
};
```

## Troubleshooting

### Wizard Not Showing

Check that you have imported correctly:

```typescript
import { ChartBuilderWizard } from '@/components/charts';
// NOT from '@/components/charts/ChartBuilderWizard'
```

### TypeScript Errors

Ensure you're using the exported types:

```typescript
import { WizardResult, ChartConfiguration } from '@/components/charts';
```

### Configuration Not Persisting

Make sure you're creating a new object reference:

```typescript
✅ Good
const handleConfigChange = (newConfig) => {
  setState({ ...state, config: { ...state.config, ...newConfig } });
};

❌ Bad (mutating)
const handleConfigChange = (newConfig) => {
  state.config = newConfig;
  setState(state);
};
```

### Next Button Disabled

Check validation requirements for current step:
- Step 0: Chart type must be selected
- Step 1: Configuration must have values
- Step 2: Title and at least one building required
- Step 3: Always valid

## Support

For issues or questions:
- Review test file: `src/tests/ChartBuilderWizard.test.tsx`
- Check implementation: `src/components/charts/ChartBuilderWizard.tsx`
- See configurator docs: `src/components/charts/configurators/README.md`
