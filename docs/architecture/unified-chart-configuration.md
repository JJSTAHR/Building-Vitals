# Unified Chart Configuration Architecture

## Executive Summary

This architecture provides a comprehensive, extensible system for chart configuration that works consistently across all chart types while allowing for type-specific customization.

## 1. System Overview

### 1.1 Architecture Principles

- **Separation of Concerns**: Configuration, validation, preview, and rendering are distinct layers
- **Composition over Inheritance**: Chart types compose behaviors rather than inherit
- **Progressive Disclosure**: Show simple options first, advanced options as needed
- **Smart Defaults**: Intelligent defaults based on data characteristics
- **Real-time Feedback**: Immediate validation and preview
- **Extensibility**: Easy to add new chart types

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chart Configuration Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Point      │  │  Time Range  │  │   Chart      │          │
│  │  Selector    │  │   Selector   │  │  Settings    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Validation Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Schema     │  │   Business   │  │  Performance │          │
│  │ Validation   │  │    Rules     │  │   Checks     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Defaults Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Data-Driven  │  │  User Prefs  │  │   Context    │          │
│  │  Defaults    │  │  Learning    │  │  Awareness   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Preview Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Aggregation │  │ Data Quality │  │  Performance │          │
│  │   Preview    │  │   Metrics    │  │  Estimation  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Rendering Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Data Fetch  │  │   Transform  │  │    Chart     │          │
│  │   & Cache    │  │  & Aggregate │  │   Renderer   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Core Type Definitions

### 2.1 Universal Configuration Types

```typescript
// Core configuration interface
interface ChartConfiguration {
  id: string;
  name: string;
  chartType: ChartType;
  version: number;

  // Universal settings
  points: SelectedPoint[];
  timeRange: TimeRange;

  // Chart-specific settings
  settings: Record<string, unknown>;

  // Metadata
  metadata: ConfigurationMetadata;
}

interface SelectedPoint {
  id: string;
  name: string;
  unit: string;
  dataType: DataType;

  // Point-specific overrides
  aggregation?: AggregationMethod;
  color?: string;
  visible?: boolean;
}

interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimePreset;
  timezone?: string;

  // Aggregation settings
  aggregation?: {
    method: AggregationMethod;
    interval: AggregationInterval;
    autoCalculated: boolean;
  };
}

interface ConfigurationMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];

  // Data quality
  dataQuality?: DataQualityMetrics;

  // Performance
  estimatedPoints?: number;
  estimatedLoadTime?: number;
}

// Chart types
type ChartType =
  | 'timeseries'
  | 'heatmap'
  | 'deviation-heatmap'
  | 'spc'
  | 'scatter'
  | 'bar'
  | 'histogram';

// Time presets
type TimePreset =
  | 'last-hour'
  | 'last-24h'
  | 'last-7d'
  | 'last-30d'
  | 'last-90d'
  | 'custom';

// Aggregation methods
type AggregationMethod =
  | 'none'
  | 'avg'
  | 'min'
  | 'max'
  | 'sum'
  | 'count'
  | 'first'
  | 'last'
  | 'stddev';

// Aggregation intervals
type AggregationInterval =
  | '1s' | '5s' | '10s' | '30s'
  | '1m' | '5m' | '10m' | '30m'
  | '1h' | '6h' | '12h'
  | '1d' | '7d' | '30d';
```

### 2.2 Validation Types

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  impact: 'low' | 'medium' | 'high';
  code: string;
}

interface ValidationSuggestion {
  field: string;
  message: string;
  suggestedValue?: unknown;
  reason: string;
}
```

### 2.3 Preview Types

```typescript
interface PreviewData {
  // Data characteristics
  dataPoints: number;
  timespan: number;
  pointCount: number;

  // Aggregation impact
  aggregation?: {
    originalPoints: number;
    aggregatedPoints: number;
    reductionRatio: number;
    interval: AggregationInterval;
    method: AggregationMethod;
  };

  // Data quality
  quality: DataQualityMetrics;

  // Performance
  estimatedLoadTime: number;
  estimatedMemory: number;

  // Sample data for mini preview
  sampleData?: ChartDataPoint[];
}

interface DataQualityMetrics {
  completeness: number; // 0-1
  gaps: DataGap[];
  outliers: number;
  anomalies: number;
}

interface DataGap {
  start: Date;
  end: Date;
  duration: number;
  severity: 'minor' | 'moderate' | 'major';
}
```

## 3. Component Architecture

### 3.1 Chart Configuration Registry

```typescript
// Registry for all chart type configurations
interface ChartTypeDefinition {
  type: ChartType;
  name: string;
  description: string;
  icon: string;

  // Configuration components
  configurator: ComponentType<ConfiguratorProps>;
  validator: ChartValidator;

  // Smart defaults
  getDefaultSettings: (context: DefaultsContext) => Record<string, unknown>;

  // Preview
  previewComponent: ComponentType<PreviewProps>;
  calculatePreview: (config: ChartConfiguration) => PreviewData;

  // Constraints
  constraints: ChartConstraints;
}

interface ChartConstraints {
  minPoints: number;
  maxPoints: number;
  minTimeRange: number; // milliseconds
  maxTimeRange: number;
  supportedDataTypes: DataType[];
  requiresNumericData?: boolean;
  supportedAggregations: AggregationMethod[];
}

// Registry implementation
class ChartRegistry {
  private definitions = new Map<ChartType, ChartTypeDefinition>();

  register(definition: ChartTypeDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  get(type: ChartType): ChartTypeDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): ChartTypeDefinition[] {
    return Array.from(this.definitions.values());
  }

  validate(config: ChartConfiguration): ValidationResult {
    const definition = this.get(config.chartType);
    if (!definition) {
      return {
        isValid: false,
        errors: [{
          field: 'chartType',
          message: 'Unknown chart type',
          severity: 'critical',
          code: 'UNKNOWN_CHART_TYPE'
        }],
        warnings: [],
        suggestions: []
      };
    }

    return definition.validator.validate(config);
  }
}

// Global registry instance
export const chartRegistry = new ChartRegistry();
```

### 3.2 Configuration Context & Hook

```typescript
// React Context for configuration state
interface ConfigurationContextValue {
  config: ChartConfiguration;
  updateConfig: (updates: Partial<ChartConfiguration>) => void;
  validation: ValidationResult;
  preview: PreviewData | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  save: () => Promise<void>;
  load: (id: string) => Promise<void>;
  reset: () => void;
  duplicate: () => ChartConfiguration;
}

const ConfigurationContext = createContext<ConfigurationContextValue | null>(null);

// Hook for using configuration
export function useChartConfiguration(
  chartType: ChartType,
  initialConfig?: Partial<ChartConfiguration>
) {
  const [config, setConfig] = useState<ChartConfiguration>(() =>
    createDefaultConfiguration(chartType, initialConfig)
  );

  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: [],
    warnings: [],
    suggestions: []
  });

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Auto-validate on config change
  useEffect(() => {
    const result = chartRegistry.validate(config);
    setValidation(result);

    // Calculate preview if valid
    if (result.isValid) {
      const definition = chartRegistry.get(config.chartType);
      if (definition) {
        try {
          const previewData = definition.calculatePreview(config);
          setPreview(previewData);
        } catch (err) {
          console.error('Preview calculation failed:', err);
        }
      }
    }
  }, [config]);

  // Debounced save
  const debouncedSave = useMemo(
    () => debounce(async (cfg: ChartConfiguration) => {
      try {
        await saveConfiguration(cfg);
      } catch (err) {
        console.error('Save failed:', err);
      }
    }, 1000),
    []
  );

  const updateConfig = useCallback((updates: Partial<ChartConfiguration>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const save = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await saveConfiguration(config);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await loadConfiguration(id);
      setConfig(loaded);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setConfig(createDefaultConfiguration(chartType, initialConfig));
  }, [chartType, initialConfig]);

  const duplicate = useCallback(() => {
    return {
      ...config,
      id: generateId(),
      name: `${config.name} (Copy)`,
      metadata: {
        ...config.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }, [config]);

  return {
    config,
    updateConfig,
    validation,
    preview,
    isLoading,
    error,
    save,
    load,
    reset,
    duplicate
  };
}
```

### 3.3 Universal Configuration Wizard

```typescript
// Wizard step definition
interface WizardStep {
  id: string;
  title: string;
  description?: string;
  component: ComponentType<WizardStepProps>;
  validate?: (config: ChartConfiguration) => ValidationResult;
  canSkip?: boolean;
  showPreview?: boolean;
}

interface WizardStepProps {
  config: ChartConfiguration;
  updateConfig: (updates: Partial<ChartConfiguration>) => void;
  validation: ValidationResult;
  preview: PreviewData | null;
  onNext: () => void;
  onBack: () => void;
}

// Wizard component
interface ConfigurationWizardProps {
  chartType: ChartType;
  initialConfig?: Partial<ChartConfiguration>;
  steps?: WizardStep[];
  onComplete: (config: ChartConfiguration) => void;
  onCancel?: () => void;
}

export function ConfigurationWizard({
  chartType,
  initialConfig,
  steps: customSteps,
  onComplete,
  onCancel
}: ConfigurationWizardProps) {
  const {
    config,
    updateConfig,
    validation,
    preview
  } = useChartConfiguration(chartType, initialConfig);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Get steps from chart definition or use custom
  const steps = useMemo(() => {
    if (customSteps) return customSteps;

    const definition = chartRegistry.get(chartType);
    return definition?.configurator?.defaultSteps ?? getUniversalSteps(chartType);
  }, [chartType, customSteps]);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handleNext = useCallback(() => {
    // Validate current step
    if (currentStep.validate) {
      const result = currentStep.validate(config);
      if (!result.isValid) {
        // Show errors
        return;
      }
    }

    if (isLastStep) {
      onComplete(config);
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStep, config, isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [isFirstStep]);

  const StepComponent = currentStep.component;

  return (
    <div className="configuration-wizard">
      {/* Progress indicator */}
      <WizardProgress
        steps={steps}
        currentStep={currentStepIndex}
      />

      {/* Step content */}
      <div className="wizard-content">
        <div className="wizard-step">
          <h2>{currentStep.title}</h2>
          {currentStep.description && (
            <p className="text-muted">{currentStep.description}</p>
          )}

          <StepComponent
            config={config}
            updateConfig={updateConfig}
            validation={validation}
            preview={preview}
            onNext={handleNext}
            onBack={handleBack}
          />
        </div>

        {/* Live preview sidebar */}
        {currentStep.showPreview && preview && (
          <div className="wizard-preview">
            <PreviewPanel
              config={config}
              preview={preview}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="wizard-footer">
        <Button
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <div className="wizard-nav">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
          >
            Back
          </Button>

          <Button
            variant="primary"
            onClick={handleNext}
            disabled={!validation.isValid && !currentStep.canSkip}
          >
            {isLastStep ? 'Complete' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## 4. Universal Components

### 4.1 Point Selector Component

```typescript
interface PointSelectorProps {
  selectedPoints: SelectedPoint[];
  onChange: (points: SelectedPoint[]) => void;
  constraints: {
    minPoints: number;
    maxPoints: number;
    supportedDataTypes?: DataType[];
  };
  showAdvancedOptions?: boolean;
}

export function PointSelector({
  selectedPoints,
  onChange,
  constraints,
  showAdvancedOptions = false
}: PointSelectorProps) {
  // Point search and selection
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePoints, setAvailablePoints] = useState<Point[]>([]);

  // Fetch available points
  useEffect(() => {
    fetchPoints(searchQuery, constraints.supportedDataTypes)
      .then(setAvailablePoints);
  }, [searchQuery, constraints.supportedDataTypes]);

  const handleAddPoint = (point: Point) => {
    if (selectedPoints.length >= constraints.maxPoints) {
      // Show error
      return;
    }

    const newPoint: SelectedPoint = {
      id: point.id,
      name: point.name,
      unit: point.unit,
      dataType: point.dataType,
      visible: true
    };

    onChange([...selectedPoints, newPoint]);
  };

  const handleRemovePoint = (pointId: string) => {
    onChange(selectedPoints.filter(p => p.id !== pointId));
  };

  const handleUpdatePoint = (pointId: string, updates: Partial<SelectedPoint>) => {
    onChange(
      selectedPoints.map(p =>
        p.id === pointId ? { ...p, ...updates } : p
      )
    );
  };

  return (
    <div className="point-selector">
      {/* Search and add */}
      <div className="point-search">
        <Input
          type="search"
          placeholder="Search points..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <PointSearchResults
          points={availablePoints}
          onSelect={handleAddPoint}
          selectedIds={selectedPoints.map(p => p.id)}
        />
      </div>

      {/* Selected points */}
      <div className="selected-points">
        <h4>Selected Points ({selectedPoints.length}/{constraints.maxPoints})</h4>

        {selectedPoints.map(point => (
          <SelectedPointCard
            key={point.id}
            point={point}
            onRemove={() => handleRemovePoint(point.id)}
            onUpdate={updates => handleUpdatePoint(point.id, updates)}
            showAdvancedOptions={showAdvancedOptions}
          />
        ))}

        {selectedPoints.length < constraints.minPoints && (
          <Alert variant="warning">
            Please select at least {constraints.minPoints} point(s)
          </Alert>
        )}
      </div>
    </div>
  );
}
```

### 4.2 Time Range Selector Component

```typescript
interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  showAggregationPreview?: boolean;
  chartType: ChartType;
  selectedPoints: SelectedPoint[];
}

export function TimeRangeSelector({
  value,
  onChange,
  showAggregationPreview = true,
  chartType,
  selectedPoints
}: TimeRangeSelectorProps) {
  const [preset, setPreset] = useState<TimePreset>(value.preset ?? 'custom');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
    start: value.start,
    end: value.end
  });

  const [aggregationImpact, setAggregationImpact] = useState<AggregationImpact | null>(null);

  // Calculate aggregation impact
  useEffect(() => {
    if (showAggregationPreview && selectedPoints.length > 0) {
      calculateAggregationImpact({
        timeRange: value,
        points: selectedPoints,
        chartType
      }).then(setAggregationImpact);
    }
  }, [value, selectedPoints, chartType, showAggregationPreview]);

  const handlePresetChange = (newPreset: TimePreset) => {
    setPreset(newPreset);

    if (newPreset !== 'custom') {
      const range = getPresetRange(newPreset);
      onChange({
        ...value,
        ...range,
        preset: newPreset
      });
    }
  };

  const handleCustomRangeChange = (start: Date, end: Date) => {
    setCustomRange({ start, end });
    onChange({
      ...value,
      start,
      end,
      preset: 'custom'
    });
  };

  return (
    <div className="time-range-selector">
      {/* Preset selector */}
      <div className="preset-buttons">
        {TIME_PRESETS.map(p => (
          <Button
            key={p}
            variant={preset === p ? 'primary' : 'outline'}
            onClick={() => handlePresetChange(p)}
          >
            {formatPreset(p)}
          </Button>
        ))}
      </div>

      {/* Custom range picker */}
      {preset === 'custom' && (
        <div className="custom-range">
          <DateTimePicker
            value={customRange.start}
            onChange={start => handleCustomRangeChange(start, customRange.end)}
            label="Start"
          />
          <DateTimePicker
            value={customRange.end}
            onChange={end => handleCustomRangeChange(customRange.start, end)}
            label="End"
          />
        </div>
      )}

      {/* Aggregation impact preview */}
      {showAggregationPreview && aggregationImpact && (
        <AggregationImpactCard
          impact={aggregationImpact}
          onAggregationChange={aggregation =>
            onChange({ ...value, aggregation })
          }
        />
      )}

      {/* Time range summary */}
      <div className="range-summary">
        <span>Duration: {formatDuration(value.start, value.end)}</span>
        {value.aggregation && (
          <span>
            Aggregation: {value.aggregation.interval} ({value.aggregation.method})
          </span>
        )}
      </div>
    </div>
  );
}
```

### 4.3 Configuration Review Component

```typescript
interface ConfigReviewProps {
  config: ChartConfiguration;
  validation: ValidationResult;
  preview: PreviewData | null;
  onEdit: (section: string) => void;
}

export function ConfigReview({
  config,
  validation,
  preview,
  onEdit
}: ConfigReviewProps) {
  return (
    <div className="config-review">
      {/* Validation status */}
      <ValidationSummary validation={validation} />

      {/* Configuration sections */}
      <div className="config-sections">
        <ConfigSection
          title="Points"
          icon="target"
          onEdit={() => onEdit('points')}
        >
          <ul>
            {config.points.map(p => (
              <li key={p.id}>
                {p.name} ({p.unit})
                {p.aggregation && ` - ${p.aggregation}`}
              </li>
            ))}
          </ul>
        </ConfigSection>

        <ConfigSection
          title="Time Range"
          icon="calendar"
          onEdit={() => onEdit('timeRange')}
        >
          <div>
            <div>{formatDate(config.timeRange.start)} - {formatDate(config.timeRange.end)}</div>
            <div className="text-muted">
              {formatDuration(config.timeRange.start, config.timeRange.end)}
            </div>
            {config.timeRange.aggregation && (
              <div className="text-muted">
                Aggregated: {config.timeRange.aggregation.interval} ({config.timeRange.aggregation.method})
              </div>
            )}
          </div>
        </ConfigSection>

        <ConfigSection
          title="Chart Settings"
          icon="settings"
          onEdit={() => onEdit('settings')}
        >
          <ChartSettingsSummary
            chartType={config.chartType}
            settings={config.settings}
          />
        </ConfigSection>
      </div>

      {/* Preview and metrics */}
      {preview && (
        <div className="preview-metrics">
          <MetricsCard
            title="Data Preview"
            metrics={[
              { label: 'Data Points', value: preview.dataPoints.toLocaleString() },
              { label: 'Time Span', value: formatDuration(preview.timespan) },
              { label: 'Points', value: preview.pointCount.toString() }
            ]}
          />

          {preview.aggregation && (
            <MetricsCard
              title="Aggregation Impact"
              metrics={[
                { label: 'Original Points', value: preview.aggregation.originalPoints.toLocaleString() },
                { label: 'After Aggregation', value: preview.aggregation.aggregatedPoints.toLocaleString() },
                { label: 'Reduction', value: `${(preview.aggregation.reductionRatio * 100).toFixed(1)}%` }
              ]}
            />
          )}

          <MetricsCard
            title="Performance"
            metrics={[
              { label: 'Est. Load Time', value: `${preview.estimatedLoadTime}ms` },
              { label: 'Est. Memory', value: formatBytes(preview.estimatedMemory) }
            ]}
          />

          <MetricsCard
            title="Data Quality"
            metrics={[
              { label: 'Completeness', value: `${(preview.quality.completeness * 100).toFixed(1)}%` },
              { label: 'Gaps', value: preview.quality.gaps.length.toString() },
              { label: 'Outliers', value: preview.quality.outliers.toString() }
            ]}
          />
        </div>
      )}
    </div>
  );
}
```

## 5. Validation System

### 5.1 Validator Interface

```typescript
interface ChartValidator {
  validate(config: ChartConfiguration): ValidationResult;
  validateField(field: string, value: unknown, config: ChartConfiguration): ValidationResult;
}

// Base validator with common rules
abstract class BaseChartValidator implements ChartValidator {
  protected constraints: ChartConstraints;

  constructor(constraints: ChartConstraints) {
    this.constraints = constraints;
  }

  validate(config: ChartConfiguration): ValidationResult {
    const results: ValidationResult[] = [
      this.validatePoints(config.points),
      this.validateTimeRange(config.timeRange),
      this.validateSettings(config.settings, config),
      this.validatePerformance(config)
    ];

    return mergeValidationResults(results);
  }

  protected validatePoints(points: SelectedPoint[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Check point count
    if (points.length < this.constraints.minPoints) {
      errors.push({
        field: 'points',
        message: `At least ${this.constraints.minPoints} point(s) required`,
        severity: 'error',
        code: 'MIN_POINTS'
      });
    }

    if (points.length > this.constraints.maxPoints) {
      errors.push({
        field: 'points',
        message: `Maximum ${this.constraints.maxPoints} points allowed`,
        severity: 'error',
        code: 'MAX_POINTS'
      });
    }

    // Check data types
    if (this.constraints.supportedDataTypes) {
      const unsupported = points.filter(
        p => !this.constraints.supportedDataTypes!.includes(p.dataType)
      );

      if (unsupported.length > 0) {
        errors.push({
          field: 'points',
          message: `Unsupported data types: ${unsupported.map(p => p.name).join(', ')}`,
          severity: 'error',
          code: 'UNSUPPORTED_DATA_TYPE'
        });
      }
    }

    // Check for mixed units (warning)
    const units = new Set(points.map(p => p.unit));
    if (units.size > 1) {
      warnings.push({
        field: 'points',
        message: 'Points have different units. Consider using separate charts.',
        impact: 'medium',
        code: 'MIXED_UNITS'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  protected validateTimeRange(timeRange: TimeRange): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    const duration = timeRange.end.getTime() - timeRange.start.getTime();

    // Check range constraints
    if (duration < this.constraints.minTimeRange) {
      errors.push({
        field: 'timeRange',
        message: `Time range too short. Minimum: ${formatDuration(this.constraints.minTimeRange)}`,
        severity: 'error',
        code: 'MIN_TIME_RANGE'
      });
    }

    if (duration > this.constraints.maxTimeRange) {
      warnings.push({
        field: 'timeRange',
        message: `Large time range may impact performance. Consider using aggregation.`,
        impact: 'high',
        code: 'LARGE_TIME_RANGE'
      });

      // Suggest aggregation
      if (!timeRange.aggregation) {
        suggestions.push({
          field: 'timeRange.aggregation',
          message: 'Enable aggregation to improve performance',
          suggestedValue: suggestAggregation(duration),
          reason: 'Large time range detected'
        });
      }
    }

    // Check for future dates
    if (timeRange.end > new Date()) {
      warnings.push({
        field: 'timeRange.end',
        message: 'End date is in the future',
        impact: 'low',
        code: 'FUTURE_DATE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  protected abstract validateSettings(
    settings: Record<string, unknown>,
    config: ChartConfiguration
  ): ValidationResult;

  protected validatePerformance(config: ChartConfiguration): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Estimate data points
    const estimatedPoints = estimateDataPoints(config);

    // Warn if too many points
    if (estimatedPoints > 100000) {
      warnings.push({
        field: 'performance',
        message: `Large dataset (~${(estimatedPoints / 1000).toFixed(0)}K points). Consider aggregation.`,
        impact: 'high',
        code: 'LARGE_DATASET'
      });

      if (!config.timeRange.aggregation) {
        suggestions.push({
          field: 'timeRange.aggregation',
          message: 'Enable aggregation to improve performance',
          suggestedValue: suggestAggregation(
            config.timeRange.end.getTime() - config.timeRange.start.getTime()
          ),
          reason: 'Large dataset detected'
        });
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
      suggestions
    };
  }

  validateField(
    field: string,
    value: unknown,
    config: ChartConfiguration
  ): ValidationResult {
    // Implement field-specific validation
    // This allows for real-time validation as user types
    return { isValid: true, errors: [], warnings: [], suggestions: [] };
  }
}
```

### 5.2 Chart-Specific Validators

```typescript
// Deviation Heatmap Validator
class DeviationHeatmapValidator extends BaseChartValidator {
  constructor() {
    super({
      minPoints: 1,
      maxPoints: 50,
      minTimeRange: 60000, // 1 minute
      maxTimeRange: 31536000000, // 1 year
      supportedDataTypes: ['numeric'],
      requiresNumericData: true,
      supportedAggregations: ['avg', 'min', 'max', 'stddev']
    });
  }

  protected validateSettings(
    settings: Record<string, unknown>,
    config: ChartConfiguration
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    const deviationSettings = settings as DeviationHeatmapSettings;

    // Validate baseline
    if (!deviationSettings.baselineMethod) {
      errors.push({
        field: 'settings.baselineMethod',
        message: 'Baseline method is required',
        severity: 'error',
        code: 'MISSING_BASELINE'
      });
    }

    // Validate threshold
    if (deviationSettings.deviationThreshold !== undefined) {
      if (deviationSettings.deviationThreshold <= 0) {
        errors.push({
          field: 'settings.deviationThreshold',
          message: 'Deviation threshold must be positive',
          severity: 'error',
          code: 'INVALID_THRESHOLD'
        });
      }

      if (deviationSettings.deviationThreshold > 100) {
        warnings.push({
          field: 'settings.deviationThreshold',
          message: 'Large deviation threshold may hide important patterns',
          impact: 'medium',
          code: 'LARGE_THRESHOLD'
        });
      }
    }

    // Suggest color scheme
    if (!deviationSettings.colorScheme) {
      suggestions.push({
        field: 'settings.colorScheme',
        message: 'Use diverging color scheme for better visualization',
        suggestedValue: 'RdYlGn',
        reason: 'Diverging schemes work best for deviation data'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
}

// SPC Chart Validator
class SPCValidator extends BaseChartValidator {
  constructor() {
    super({
      minPoints: 1,
      maxPoints: 10,
      minTimeRange: 300000, // 5 minutes
      maxTimeRange: 31536000000, // 1 year
      supportedDataTypes: ['numeric'],
      requiresNumericData: true,
      supportedAggregations: ['avg', 'min', 'max']
    });
  }

  protected validateSettings(
    settings: Record<string, unknown>,
    config: ChartConfiguration
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    const spcSettings = settings as SPCSettings;

    // Validate control limits
    if (spcSettings.controlLimitSigma !== undefined) {
      if (spcSettings.controlLimitSigma < 1 || spcSettings.controlLimitSigma > 6) {
        warnings.push({
          field: 'settings.controlLimitSigma',
          message: 'Control limit sigma should be between 1 and 6',
          impact: 'medium',
          code: 'UNUSUAL_SIGMA'
        });
      }
    }

    // Check minimum data points for statistical validity
    const estimatedPoints = estimateDataPoints(config);
    if (estimatedPoints < 20) {
      warnings.push({
        field: 'timeRange',
        message: 'SPC charts work best with at least 20 data points',
        impact: 'high',
        code: 'INSUFFICIENT_DATA'
      });

      suggestions.push({
        field: 'timeRange',
        message: 'Expand time range to include more data points',
        reason: 'Statistical validity requires adequate sample size'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
}
```

## 6. Smart Defaults System

### 6.1 Defaults Calculator

```typescript
interface DefaultsContext {
  points: SelectedPoint[];
  chartType: ChartType;
  userPreferences?: UserPreferences;
  dataCharacteristics?: DataCharacteristics;
}

interface UserPreferences {
  defaultTimeRange?: TimePreset;
  defaultAggregation?: AggregationMethod;
  colorScheme?: string;
  timezone?: string;
}

interface DataCharacteristics {
  updateFrequency?: number; // milliseconds
  typicalRange?: { min: number; max: number };
  hasSeasonality?: boolean;
  hasTrend?: boolean;
}

class SmartDefaultsEngine {
  // Calculate intelligent defaults based on context
  calculateDefaults(context: DefaultsContext): Partial<ChartConfiguration> {
    return {
      timeRange: this.getDefaultTimeRange(context),
      settings: this.getDefaultSettings(context)
    };
  }

  private getDefaultTimeRange(context: DefaultsContext): TimeRange {
    // Start with user preference
    let preset: TimePreset = context.userPreferences?.defaultTimeRange ?? 'last-24h';

    // Adjust based on data characteristics
    if (context.dataCharacteristics?.updateFrequency) {
      const freq = context.dataCharacteristics.updateFrequency;

      // High frequency data (< 1 minute) -> shorter default range
      if (freq < 60000) {
        preset = 'last-hour';
      }
      // Low frequency data (> 1 hour) -> longer default range
      else if (freq > 3600000) {
        preset = 'last-30d';
      }
    }

    const range = getPresetRange(preset);

    // Calculate optimal aggregation
    const aggregation = this.calculateOptimalAggregation({
      timeRange: range,
      points: context.points,
      chartType: context.chartType
    });

    return {
      ...range,
      preset,
      aggregation
    };
  }

  private calculateOptimalAggregation(params: {
    timeRange: { start: Date; end: Date };
    points: SelectedPoint[];
    chartType: ChartType;
  }): TimeRange['aggregation'] {
    const duration = params.timeRange.end.getTime() - params.timeRange.start.getTime();
    const estimatedPoints = estimateDataPoints({
      timeRange: params.timeRange,
      points: params.points
    } as ChartConfiguration);

    // Target ~1000-5000 points for good performance
    const targetPoints = 2000;

    if (estimatedPoints <= targetPoints) {
      return undefined; // No aggregation needed
    }

    // Calculate optimal interval
    const targetInterval = duration / targetPoints;
    const interval = selectNearestInterval(targetInterval);

    // Select aggregation method based on data type
    const method = this.selectAggregationMethod(params.points);

    return {
      method,
      interval,
      autoCalculated: true
    };
  }

  private selectAggregationMethod(points: SelectedPoint[]): AggregationMethod {
    // If user has set preference on any point, use it
    const userMethod = points.find(p => p.aggregation)?.aggregation;
    if (userMethod) return userMethod;

    // Default to average for numeric data
    return 'avg';
  }

  private getDefaultSettings(context: DefaultsContext): Record<string, unknown> {
    const definition = chartRegistry.get(context.chartType);
    if (!definition) return {};

    // Get chart-specific defaults
    const baseDefaults = definition.getDefaultSettings(context);

    // Apply user preferences
    if (context.userPreferences?.colorScheme) {
      baseDefaults.colorScheme = context.userPreferences.colorScheme;
    }

    return baseDefaults;
  }
}

// Global instance
export const smartDefaults = new SmartDefaultsEngine();
```

### 6.2 Chart-Specific Defaults

```typescript
// Deviation Heatmap Defaults
function getDeviationHeatmapDefaults(context: DefaultsContext): DeviationHeatmapSettings {
  return {
    baselineMethod: 'historical_average',
    baselineWindow: selectBaselineWindow(context),
    deviationThreshold: 10,
    colorScheme: context.userPreferences?.colorScheme ?? 'RdYlGn',
    showBaseline: true,
    highlightExtremes: true,
    cellSize: 'auto'
  };
}

function selectBaselineWindow(context: DefaultsContext): string {
  // Use same duration as time range for baseline
  const duration = context.dataCharacteristics?.updateFrequency;

  if (!duration) return '7d';

  // High frequency -> shorter baseline
  if (duration < 60000) return '24h';

  // Low frequency -> longer baseline
  if (duration > 3600000) return '30d';

  return '7d';
}

// SPC Defaults
function getSPCDefaults(context: DefaultsContext): SPCSettings {
  return {
    controlLimitSigma: 3,
    showCenterLine: true,
    showControlLimits: true,
    highlightOutOfControl: true,
    rulesEnabled: ['western_electric_1', 'western_electric_2'],
    movingRangeChart: context.points.length === 1
  };
}
```

## 7. Preview & Estimation System

### 7.1 Preview Calculator

```typescript
class PreviewCalculator {
  async calculate(config: ChartConfiguration): Promise<PreviewData> {
    // Run calculations in parallel
    const [
      dataPoints,
      aggregationImpact,
      quality,
      performance
    ] = await Promise.all([
      this.estimateDataPoints(config),
      this.calculateAggregationImpact(config),
      this.assessDataQuality(config),
      this.estimatePerformance(config)
    ]);

    // Get sample data for mini preview
    const sampleData = await this.getSampleData(config);

    return {
      dataPoints: dataPoints.total,
      timespan: config.timeRange.end.getTime() - config.timeRange.start.getTime(),
      pointCount: config.points.length,
      aggregation: aggregationImpact,
      quality,
      estimatedLoadTime: performance.loadTime,
      estimatedMemory: performance.memory,
      sampleData
    };
  }

  private async estimateDataPoints(config: ChartConfiguration) {
    // Query database for count
    const counts = await Promise.all(
      config.points.map(point =>
        queryDataPointCount(point.id, config.timeRange)
      )
    );

    return {
      total: counts.reduce((sum, count) => sum + count, 0),
      perPoint: counts
    };
  }

  private async calculateAggregationImpact(config: ChartConfiguration) {
    if (!config.timeRange.aggregation) {
      return undefined;
    }

    const originalPoints = await this.estimateDataPoints(config);

    // Calculate aggregated point count
    const duration = config.timeRange.end.getTime() - config.timeRange.start.getTime();
    const intervalMs = parseInterval(config.timeRange.aggregation.interval);
    const aggregatedPoints = Math.ceil(duration / intervalMs) * config.points.length;

    return {
      originalPoints: originalPoints.total,
      aggregatedPoints,
      reductionRatio: 1 - (aggregatedPoints / originalPoints.total),
      interval: config.timeRange.aggregation.interval,
      method: config.timeRange.aggregation.method
    };
  }

  private async assessDataQuality(config: ChartConfiguration): Promise<DataQualityMetrics> {
    // Query for data gaps and quality metrics
    const qualityMetrics = await Promise.all(
      config.points.map(point =>
        queryDataQuality(point.id, config.timeRange)
      )
    );

    // Aggregate metrics
    const allGaps = qualityMetrics.flatMap(m => m.gaps);
    const totalOutliers = qualityMetrics.reduce((sum, m) => sum + m.outliers, 0);
    const totalAnomalies = qualityMetrics.reduce((sum, m) => sum + m.anomalies, 0);

    // Calculate overall completeness
    const avgCompleteness = qualityMetrics.reduce((sum, m) => sum + m.completeness, 0) / qualityMetrics.length;

    return {
      completeness: avgCompleteness,
      gaps: allGaps,
      outliers: totalOutliers,
      anomalies: totalAnomalies
    };
  }

  private async estimatePerformance(config: ChartConfiguration) {
    const dataPoints = await this.estimateDataPoints(config);

    // Estimate load time based on data points
    // Base: 100ms + 0.01ms per point
    const baseLoadTime = 100;
    const perPointTime = 0.01;
    const loadTime = baseLoadTime + (dataPoints.total * perPointTime);

    // Estimate memory usage
    // ~100 bytes per data point + overhead
    const perPointMemory = 100;
    const overhead = 1024 * 1024; // 1MB overhead
    const memory = overhead + (dataPoints.total * perPointMemory);

    return {
      loadTime: Math.round(loadTime),
      memory
    };
  }

  private async getSampleData(config: ChartConfiguration): Promise<ChartDataPoint[]> {
    // Get small sample for preview (max 100 points)
    const sampleSize = Math.min(100, 100 / config.points.length);

    return await querySampleData(
      config.points.map(p => p.id),
      config.timeRange,
      sampleSize
    );
  }
}

export const previewCalculator = new PreviewCalculator();
```

## 8. Persistence & State Management

### 8.1 Configuration Storage

```typescript
interface ConfigurationStorage {
  save(config: ChartConfiguration): Promise<void>;
  load(id: string): Promise<ChartConfiguration>;
  list(filters?: ConfigurationFilters): Promise<ChartConfiguration[]>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<ChartConfiguration>;
}

interface ConfigurationFilters {
  chartType?: ChartType;
  tags?: string[];
  createdBy?: string;
  createdAfter?: Date;
  search?: string;
}

class LocalStorageConfigurationStorage implements ConfigurationStorage {
  private readonly STORAGE_KEY = 'chart_configurations';

  async save(config: ChartConfiguration): Promise<void> {
    const configs = await this.loadAll();

    const index = configs.findIndex(c => c.id === config.id);
    if (index >= 0) {
      configs[index] = {
        ...config,
        metadata: {
          ...config.metadata,
          updatedAt: new Date()
        }
      };
    } else {
      configs.push(config);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
  }

  async load(id: string): Promise<ChartConfiguration> {
    const configs = await this.loadAll();
    const config = configs.find(c => c.id === id);

    if (!config) {
      throw new Error(`Configuration ${id} not found`);
    }

    return config;
  }

  async list(filters?: ConfigurationFilters): Promise<ChartConfiguration[]> {
    let configs = await this.loadAll();

    if (filters) {
      configs = configs.filter(config => {
        if (filters.chartType && config.chartType !== filters.chartType) {
          return false;
        }

        if (filters.tags && !filters.tags.some(tag => config.metadata.tags.includes(tag))) {
          return false;
        }

        if (filters.createdBy && config.metadata.createdBy !== filters.createdBy) {
          return false;
        }

        if (filters.createdAfter && config.metadata.createdAt < filters.createdAfter) {
          return false;
        }

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          return (
            config.name.toLowerCase().includes(searchLower) ||
            config.points.some(p => p.name.toLowerCase().includes(searchLower))
          );
        }

        return true;
      });
    }

    return configs;
  }

  async delete(id: string): Promise<void> {
    const configs = await this.loadAll();
    const filtered = configs.filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  async duplicate(id: string): Promise<ChartConfiguration> {
    const original = await this.load(id);

    const duplicate: ChartConfiguration = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      metadata: {
        ...original.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    await this.save(duplicate);
    return duplicate;
  }

  private async loadAll(): Promise<ChartConfiguration[]> {
    const json = localStorage.getItem(this.STORAGE_KEY);
    if (!json) return [];

    try {
      return JSON.parse(json);
    } catch (error) {
      console.error('Failed to parse configurations:', error);
      return [];
    }
  }
}

export const configurationStorage = new LocalStorageConfigurationStorage();
```

## 9. Integration Examples

### 9.1 Registering a New Chart Type

```typescript
// Register deviation heatmap chart
chartRegistry.register({
  type: 'deviation-heatmap',
  name: 'Deviation Heatmap',
  description: 'Visualize deviations from baseline over time',
  icon: 'heatmap',

  configurator: DeviationHeatmapConfigurator,
  validator: new DeviationHeatmapValidator(),

  getDefaultSettings: getDeviationHeatmapDefaults,

  previewComponent: DeviationHeatmapPreview,
  calculatePreview: previewCalculator.calculate.bind(previewCalculator),

  constraints: {
    minPoints: 1,
    maxPoints: 50,
    minTimeRange: 60000,
    maxTimeRange: 31536000000,
    supportedDataTypes: ['numeric'],
    requiresNumericData: true,
    supportedAggregations: ['avg', 'min', 'max', 'stddev']
  }
});
```

### 9.2 Using Configuration in a Component

```typescript
function ChartPage() {
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('deviation-heatmap');
  const [showWizard, setShowWizard] = useState(true);
  const [finalConfig, setFinalConfig] = useState<ChartConfiguration | null>(null);

  const handleWizardComplete = useCallback((config: ChartConfiguration) => {
    setFinalConfig(config);
    setShowWizard(false);
  }, []);

  const handleReconfigure = useCallback(() => {
    setShowWizard(true);
  }, []);

  return (
    <div className="chart-page">
      {showWizard ? (
        <ConfigurationWizard
          chartType={selectedChartType}
          initialConfig={finalConfig ?? undefined}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      ) : finalConfig ? (
        <>
          <ChartHeader
            config={finalConfig}
            onReconfigure={handleReconfigure}
          />

          <ChartRenderer config={finalConfig} />
        </>
      ) : null}
    </div>
  );
}
```

## 10. Migration Path

### 10.1 Phase 1: Infrastructure (Week 1-2)

1. Implement core types and interfaces
2. Create chart registry
3. Build configuration context and hooks
4. Set up storage layer

### 10.2 Phase 2: Universal Components (Week 3-4)

1. Build PointSelector component
2. Build TimeRangeSelector component
3. Build ConfigurationWizard framework
4. Create validation system

### 10.3 Phase 3: Chart Migration (Week 5-8)

1. Migrate deviation heatmap to new system
2. Migrate SPC wizard
3. Migrate other existing charts
4. Add chart-specific validators

### 10.4 Phase 4: Smart Features (Week 9-10)

1. Implement smart defaults engine
2. Add preview calculator
3. Build aggregation impact preview
4. Add data quality metrics

### 10.5 Phase 5: Polish & Optimization (Week 11-12)

1. Performance optimization
2. User testing and feedback
3. Documentation
4. Migration of user preferences

## 11. Performance Considerations

### 11.1 Optimization Strategies

- **Debounced validation**: Don't validate on every keystroke
- **Lazy loading**: Load chart definitions on demand
- **Memoization**: Cache validation and preview results
- **Virtual scrolling**: For point selector with many points
- **Progressive rendering**: Show wizard steps incrementally

### 11.2 Caching

```typescript
// Cache validation results
const validationCache = new Map<string, ValidationResult>();

function getCachedValidation(config: ChartConfiguration): ValidationResult | undefined {
  const key = hashConfig(config);
  return validationCache.get(key);
}

// Cache preview data
const previewCache = new Map<string, PreviewData>();

function getCachedPreview(config: ChartConfiguration): PreviewData | undefined {
  const key = hashConfig(config);
  return previewCache.get(key);
}
```

## 12. Testing Strategy

### 12.1 Unit Tests

- Validators
- Smart defaults calculator
- Preview calculator
- Configuration storage

### 12.2 Integration Tests

- Configuration wizard flow
- Chart registration
- Context and hooks
- Storage operations

### 12.3 E2E Tests

- Complete wizard flow for each chart type
- Configuration save/load
- Reconfiguration flow
- Migration from old system

## Summary

This architecture provides:

1. **Unified UX**: Consistent configuration experience across all charts
2. **Extensibility**: Easy to add new chart types
3. **Smart Features**: Intelligent defaults, validation, and previews
4. **Performance**: Optimized for large datasets with aggregation
5. **Maintainability**: Clear separation of concerns and reusable components
6. **Type Safety**: Full TypeScript support
7. **User-Friendly**: Progressive disclosure, real-time feedback, and helpful suggestions

The system is designed to grow with the application while maintaining consistency and performance.
