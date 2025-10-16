# Chart Configuration Consistency Review

**Date:** 2025-10-16
**Reviewer:** Code Review Agent
**Scope:** ALL chart types across the Building Vitals platform

## Executive Summary

This comprehensive review analyzed 8 chart types to assess configuration consistency, user guidance, and feature completeness. While most charts have solid foundational architecture, there are significant inconsistencies in configuration patterns, especially around time range selection and user guidance.

**Key Findings:**
- ✅ **Strengths:** Unified data flow via `useChartData`, consistent error handling, strong specialized features
- ⚠️ **Weaknesses:** Inconsistent time range handling, missing wizards for complex charts, hardcoded parameters
- 🔴 **Critical Gaps:** No global time range consistency, lacking point validation across most charts

---

## 1. Chart Configuration Matrix

### A. Time Range Selection

| Chart Type | Has Time Selector? | Preset Ranges | Custom Range | Aggregation Info | Source |
|------------|-------------------|---------------|--------------|------------------|---------|
| **Time Series** | Inherited from parent | ❌ No | ❌ No | ❌ No | Uses `timeRange` prop only |
| **Heatmap** | ❌ No built-in | ❌ No | ❌ No | ❌ No | Relies on parent context |
| **SPC Chart** | ❌ No built-in | ❌ No | ❌ No | ✅ Yes (via wizard) | Via parent/wizard |
| **Bar Chart** | Inherited from parent | ❌ No | ❌ No | ✅ **Yes** | Aggregation type displayed |
| **Area Chart** | Inherited from parent | ❌ No | ❌ No | ❌ No | Uses `timeRange` prop only |
| **Scatter Plot** | Inherited from parent | ❌ No | ❌ No | ❌ No | Uses `timeRange` prop only |
| **Perfect Economizer** | Inherited from parent | ❌ No | ❌ No | ❌ No | Uses `timeRange` prop only |
| **Psychrometric** | Inherited from parent | ❌ No | ❌ No | ❌ No | Uses `timeRange` prop only |

**Global Time Range System:**
- ✅ Exists: `GlobalTimeRangeContext` with presets (15m, 1h, 3h, 24h, 7d, 30d, 90d, 180d, 365d)
- ✅ `GlobalTimeRangePanel` provides UI for time selection
- ❌ **Issue:** Charts receive `timeRange` as simple string prop without connection to global context
- ❌ **Issue:** No built-in time selector in individual charts
- ❌ **Issue:** Users must use dashboard-level controls only

### B. Point Selection & Validation

| Chart Type | Point Selector | Min Points | Max Points | Unit Validation | Point Type Hints | Point Categories |
|------------|----------------|------------|------------|-----------------|------------------|------------------|
| **Time Series** | ✅ Yes | 1 | 100,000 | ❌ No | ❌ No | ❌ No |
| **Heatmap (Regular)** | ✅ Yes | 1 | 100,000 | ❌ No | ❌ No | ❌ No |
| **SPC Chart** | ✅ Yes | 1 | 100,000 | ❌ No | ❌ No | ❌ No |
| **Bar Chart** | ✅ Yes | 1 | 100,000 | ❌ No | ❌ No | ❌ No |
| **Area Chart** | ✅ Yes | 1 | 100,000 | ❌ No | ❌ No | ❌ No |
| **Scatter Plot** | ✅ **Advanced** | 2 | 100,000 | ❌ No | ✅ **Yes** (via wizard) | ❌ No |
| **Perfect Economizer** | ✅ **Required Points** | 2 | 100,000 | ❌ No | ✅ **Yes** (via wizard) | ✅ **Yes** (OAT, MAT, RAT) |
| **Psychrometric** | ✅ **Paired Points** | 2 | 2 | ❌ No | ✅ **Yes** (via wizard) | ✅ **Yes** (temp/humidity) |
| **Device Deviation** | ✅ Yes | 1 | 100,000 | ❌ No | ✅ **Yes** (via wizard) | ❌ No |

**Observations:**
- ✅ All charts use unified `PointSelector` component
- ✅ Wizard provides hints for specialized charts (Psychrometric, Economizer)
- ❌ **No runtime unit validation** - charts accept mixed units without warning
- ❌ **No automatic point categorization** - users must manually identify point types
- ⚠️ Point limits are consistent (100K API limit) but not enforced in UI

### C. Chart-Specific Configuration

| Chart Type | Configuration Panel | User-Adjustable Params | Sensible Defaults | Validation | Settings Persistence |
|------------|-------------------|----------------------|-------------------|------------|---------------------|
| **Time Series** | ❌ No | ❌ None | ✅ Yes | ❌ No | ❌ No |
| **Heatmap** | ✅ **Advanced** | Radius, blur, opacity, gradient | ✅ Yes | ✅ Yes | ❌ No |
| **SPC Chart** | ✅ **Wizard** | Chart type, sample size, sigma, limits | ✅ Yes | ✅ **Excellent** | ✅ **Yes** (wizard state) |
| **Bar Chart** | ⚠️ Partial | Aggregation method | ✅ Yes | ❌ No | ❌ No |
| **Area Chart** | ❌ No | ❌ None | ✅ Yes | ❌ No | ❌ No |
| **Scatter Plot** | ✅ **Extensive** | Correlation mode, HVAC presets, colors, clustering | ✅ Yes | ✅ Yes | ❌ No |
| **Perfect Economizer** | ✅ **Advanced** | Setpoints, thresholds, control params | ✅ Yes | ✅ Yes | ❌ No |
| **Psychrometric** | ✅ **Interactive** | Units, comfort zones, season, property lines | ✅ Yes | ✅ Yes | ❌ No |

**Configuration Sources:**
1. **ChartWizard.tsx** (Lines 1-300+): Master wizard with chart type selection, point selection, and basic config
2. **SPCWizardConfig.tsx**: Dedicated SPC configuration wizard with excellent UX
3. **HeatmapControls.tsx**: Advanced controls for heatmap visualization (radius, blur, gradient)
4. **Container components**: Individual chart containers handle specialized config

**Key Observations:**
- ✅ **SPC Chart** has exemplary configuration wizard with clear explanations
- ✅ **Psychrometric** has excellent interactive controls with live preview
- ✅ **Scatter Plot** has sophisticated HVAC correlation analysis features
- ❌ **Time Series, Area, Bar** lack configuration UI beyond wizard basics
- ❌ **No settings persistence** except for wizard state (auto-save to localStorage)

### D. User Guidance & Help

| Chart Type | Tooltips | Help Text | Examples/Presets | Configuration Wizard | Inline Validation Messages |
|------------|----------|-----------|------------------|---------------------|---------------------------|
| **Time Series** | ❌ Basic | ❌ No | ❌ No | ✅ Basic | ❌ No |
| **Heatmap** | ✅ Yes | ✅ Yes | ✅ **Gradient presets** | ✅ Basic | ✅ **Excellent** |
| **SPC Chart** | ✅ **Excellent** | ✅ **Detailed** | ✅ **Recommended settings** | ✅ **Advanced** | ✅ **Excellent** |
| **Bar Chart** | ❌ No | ⚠️ Limited | ❌ No | ✅ Basic | ❌ No |
| **Area Chart** | ❌ No | ❌ No | ❌ No | ✅ Basic | ❌ No |
| **Scatter Plot** | ✅ Yes | ✅ Yes | ✅ **HVAC presets** | ✅ Basic | ⚠️ Limited |
| **Perfect Economizer** | ✅ Yes | ✅ Yes | ❌ No | ✅ **Via wizard** | ⚠️ Limited |
| **Psychrometric** | ✅ Yes | ✅ Yes | ✅ **Comfort zone presets** | ✅ **Via wizard** | ✅ Good |

**ChartWizard Point Selection Hints (Lines 221-246):**
```typescript
const getPointTypeHints = (chartType: string, pointType: string): string => {
  switch (chartType) {
    case 'Psychrometric':
      if (pointType === 'temperature')
        return 'Filter by marker tags: air, temp, zone, space, return, supply, discharge';
      if (pointType === 'humidity')
        return 'Filter by marker tags: humidity, rh, wetBulb, dewPoint, moisture';
    case 'PerfectEconomizer':
      if (pointType === 'outdoor_temp')
        return 'Filter by marker tags: outside, outdoor, oat, weather, ambient';
      // ... more hints
  }
};
```

**Best Practice Example - SPC Wizard (SPCWizardConfig.tsx):**
- ✅ Plain-language descriptions: "How do you want to monitor your data?"
- ✅ Use case explanations: "Best for: Single measurements taken over time"
- ✅ Visual hierarchy with icons and structured sections
- ✅ Real-time preview of what chart will show
- ✅ Contextual help tooltips

---

## 2. Consistency Issues

### Critical Inconsistencies

#### 🔴 Time Range Handling
**Problem:** Every chart relies on parent-provided `timeRange` prop but no chart has built-in time selector.

**Evidence:**
```typescript
// TimeSeriesChartContainer.tsx (Line 14)
interface TimeSeriesChartContainerProps {
  timeRange?: string;  // Inherited from parent, no default
}

// BarChartContainer.tsx (Line 13)
interface BarChartContainerProps {
  timeRange?: string;  // Inherited from parent, no default
}

// GlobalTimeRangeContext.tsx provides presets but charts don't access it directly
```

**Impact:**
- Users can't adjust time range without leaving chart view
- Inconsistent experience - some dashboards may not have global controls
- Charts are tightly coupled to parent components

**Recommendation:**
- Add optional time range selector to ChartToolbar component
- Connect charts to GlobalTimeRangeContext directly
- Allow charts to override global time range when needed

---

#### 🔴 Configuration UI Placement
**Problem:** Configuration UI is scattered across different locations

**Current State:**
1. **SPC Chart:** Dedicated wizard page with multi-step flow
2. **Heatmap:** Side panel controls (HeatmapControls.tsx)
3. **Psychrometric:** Inline controls above chart (PsychrometricChartContainer.tsx lines 324-393)
4. **Scatter Plot:** Options passed as props, no UI
5. **Time Series/Bar/Area:** No configuration UI at all

**Impact:**
- Users must learn different patterns for each chart
- Some charts have rich configuration, others have none
- Difficult to discover advanced features

**Recommendation:**
- Standardize on **ChartToolbar** component with gear icon → settings dialog
- Implement collapsible settings panel pattern consistently
- Maintain specialized wizards for complex setup (SPC, Economizer)

---

#### ⚠️ Validation Patterns
**Problem:** Inconsistent validation across charts

**Analysis:**
- ✅ **SPC Chart:** Excellent validation with clear error messages
- ✅ **Psychrometric:** Validates required point pairs
- ✅ **Perfect Economizer:** Validates required temperature points
- ❌ **Time Series/Bar/Area:** No validation beyond "points selected"
- ❌ **Scatter Plot:** No unit compatibility checks
- ❌ **No global validation** for mixed units, incompatible ranges, or data quality

**Evidence - SPC Wizard Validation:**
```typescript
// SPCWizardConfig.tsx shows best practices
<TextField
  label="Samples per Group"
  type="number"
  InputProps={{ inputProps: { min: 2, max: 25 } }}
  helperText="Typically 3-7 samples per group"
/>
```

**Recommendation:**
- Create shared validation utility: `chartValidation.ts`
- Implement unit compatibility checker
- Add data quality warnings (gaps, outliers, sparse data)
- Show validation status in wizard and chart headers

---

### Minor Inconsistencies

#### Error Messaging
- ✅ All charts use consistent error boundary pattern
- ⚠️ Error messages vary in detail and helpfulness
- ❌ No "suggested fixes" or troubleshooting guidance

#### Loading States
- ✅ Consistent skeleton/spinner usage
- ⚠️ Bar chart shows aggregation progress, others don't
- ❌ No indication of data size or load time estimates

#### Empty States
- ⚠️ Some charts show helpful "no data" messages, others just blank
- ❌ No prompts to adjust time range or select different points

---

## 3. Missing Features by Chart Type

### Time Series Chart
**Currently Has:**
- ✅ Basic line rendering
- ✅ Multi-series support
- ✅ Zoom/pan interactions

**Missing:**
- ❌ Aggregation method selection (avg, min, max, sum)
- ❌ Y-axis range configuration
- ❌ Series color customization
- ❌ Downsampling controls for high-resolution data
- ❌ Alert threshold lines

**Priority:** **HIGH** - Most commonly used chart type

---

### Heatmap Charts
**Currently Has:**
- ✅ Advanced visual controls (radius, blur, opacity)
- ✅ Multiple gradient presets
- ✅ Custom gradient builder

**Missing:**
- ❌ Time aggregation controls (hourly, daily buckets)
- ❌ Value normalization options
- ❌ Interpolation method selection
- ❌ Missing data visualization (gaps vs. zeros)
- ❌ Export to image with legend

**Priority:** **MEDIUM** - Good foundation but lacks data handling features

---

### SPC Chart
**Currently Has:**
- ✅ **Exemplary wizard** with guided setup
- ✅ Multiple chart types (X-mR, X-bar R, X-bar S)
- ✅ Auto-calculated control limits
- ✅ Clear violation detection

**Missing:**
- ❌ Historical limit comparison
- ❌ Process capability indices (Cp, Cpk)
- ❌ Western Electric rules configuration
- ❌ Batch editing of limits

**Priority:** **LOW** - Already excellent, minor enhancements only

---

### Bar Chart
**Currently Has:**
- ✅ Multiple aggregation methods (latest, avg, sum, min, max, count)
- ✅ Auto-aggregation from time series data

**Missing:**
- ❌ **No UI to select aggregation method** (hardcoded in container)
- ❌ Stacked bar mode
- ❌ Comparison mode (current vs. previous period)
- ❌ Sort options
- ❌ Target/threshold lines

**Priority:** **HIGH** - Configuration UI is critical

---

### Area Chart
**Currently Has:**
- ✅ Basic area rendering
- ✅ Multi-series support

**Missing:**
- ❌ Stack vs. overlap mode
- ❌ Fill opacity control
- ❌ Area interpolation method (step, smooth, linear)
- ❌ Baseline adjustment (0 vs. data-driven)
- ❌ **Any configuration UI**

**Priority:** **MEDIUM** - Needs settings panel

---

### Scatter Plot
**Currently Has:**
- ✅ **Excellent HVAC correlation features**
- ✅ Auto-detection of HVAC presets
- ✅ Time-based coloring
- ✅ Brush selection
- ✅ Outlier detection

**Missing:**
- ❌ Point size configuration
- ❌ Trend line options (linear, polynomial, LOWESS)
- ❌ Density heatmap overlay
- ❌ Animated timeline playback
- ❌ **Settings UI** - all config via props only

**Priority:** **MEDIUM** - Rich features need UI exposure

---

### Perfect Economizer Chart
**Currently Has:**
- ✅ Comprehensive economizer analysis
- ✅ Multi-tab interface (chart, time series, metrics, correlations)
- ✅ Auto-calculated optimal damper positions
- ✅ Fault detection

**Missing:**
- ❌ Setpoint adjustment UI (currently in wizard only)
- ❌ What-if scenario analysis
- ❌ Efficiency comparison mode
- ❌ Export analysis report

**Priority:** **LOW** - Feature-complete for current use cases

---

### Psychrometric Chart
**Currently Has:**
- ✅ **Excellent interactive controls**
- ✅ Multiple comfort zone standards
- ✅ Unit switching (SI/IP)
- ✅ Property calculations (enthalpy, wet bulb, etc.)
- ✅ Pinned point details

**Missing:**
- ❌ Process line drawing (humidification, cooling, etc.)
- ❌ Historical trajectory animation
- ❌ Multiple condition comparison
- ❌ Save comfort zone presets

**Priority:** **LOW** - Very feature-rich already

---

## 4. Recommendations for Standardization

### Phase 1: Critical Consistency (2-3 weeks)

#### 1.1 Unified Time Range Interface
**Goal:** Every chart can adjust its own time range

**Implementation:**
```typescript
// Add to all chart containers
interface StandardChartProps {
  timeRange?: string;
  showTimeRangeSelector?: boolean;  // NEW
  allowTimeRangeOverride?: boolean; // NEW
}

// Create TimeRangeSelector component
<TimeRangeSelector
  currentRange={timeRange}
  presets={['15m', '1h', '24h', '7d', '30d']}
  onRangeChange={handleRangeChange}
  syncedToGlobal={isGlobalSynced}
/>
```

**Checklist:**
- [ ] Create `TimeRangeSelector.tsx` component
- [ ] Connect to `GlobalTimeRangeContext`
- [ ] Add to `ChartToolbar` as optional element
- [ ] Update all 8 chart containers to accept new props
- [ ] Test global sync vs. individual override behavior

---

#### 1.2 Standard Configuration Panel Pattern
**Goal:** Consistent settings access for all charts

**Implementation:**
```typescript
// Standardize on gear icon → dialog pattern
<ChartToolbar
  title={title}
  onSettings={handleOpenSettings}  // Opens dialog
  onExport={handleExport}
  timeRange={timeRange}
  showTimeRangeSelector={true}
/>

// Settings dialog component
<ChartSettingsDialog
  chartType={chartType}
  config={config}
  onConfigChange={handleConfigChange}
  onClose={handleClose}
>
  {/* Chart-specific settings content */}
</ChartSettingsDialog>
```

**Checklist:**
- [ ] Create `ChartSettingsDialog.tsx` wrapper component
- [ ] Migrate existing controls into dialog format:
  - [ ] HeatmapControls → HeatmapSettings
  - [ ] Psychrometric controls → PsychrometricSettings
  - [ ] Create new: TimeSeriesSettings, BarChartSettings, AreaChartSettings
- [ ] Add settings icon to all chart toolbars
- [ ] Implement settings persistence (localStorage + database)

---

#### 1.3 Validation Framework
**Goal:** Consistent validation with helpful error messages

**Implementation:**
```typescript
// Create chartValidation.ts
export const validateChartConfig = (
  chartType: string,
  selectedPoints: Point[],
  config: ChartConfig
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Point count validation
  const requirements = getChartRequirements(chartType);
  if (selectedPoints.length < requirements.minPoints) {
    errors.push({
      field: 'points',
      message: `${chartType} requires at least ${requirements.minPoints} points`,
      suggestion: 'Add more points from the point selector'
    });
  }

  // Unit compatibility validation
  const units = selectedPoints.map(p => p.unit);
  const uniqueUnits = new Set(units);
  if (uniqueUnits.size > 1 && chartType !== 'scatter') {
    warnings.push({
      field: 'units',
      message: `Mixed units detected: ${Array.from(uniqueUnits).join(', ')}`,
      suggestion: 'Consider selecting points with matching units for accurate comparison'
    });
  }

  // Time range validation
  if (!config.timeRange) {
    warnings.push({
      field: 'timeRange',
      message: 'No time range specified, using default',
      suggestion: 'Select a time range for better performance'
    });
  }

  return { valid: errors.length === 0, errors, warnings };
};
```

**Checklist:**
- [ ] Implement `chartValidation.ts` utility
- [ ] Add validation to ChartWizard (lines 1000+)
- [ ] Show validation status in chart headers
- [ ] Display warnings in chart settings dialogs
- [ ] Add inline validation to wizard forms

---

### Phase 2: Feature Parity (3-4 weeks)

#### 2.1 Add Configuration UI to Basic Charts
**Priority Order:**
1. **Bar Chart Settings** (HIGHEST - missing aggregation UI)
2. **Time Series Settings** (HIGH - most used)
3. **Area Chart Settings** (MEDIUM)

**Bar Chart Settings Required:**
```typescript
interface BarChartSettings {
  aggregationMethod: 'latest' | 'average' | 'sum' | 'min' | 'max' | 'count';
  sortBy: 'name' | 'value' | 'custom';
  sortDirection: 'asc' | 'desc';
  showValues: boolean;
  colorBy: 'default' | 'value' | 'threshold';
  thresholds?: { warning: number; critical: number };
}
```

**Time Series Settings Required:**
```typescript
interface TimeSeriesSettings {
  aggregation: 'none' | '1m' | '5m' | '15m' | '1h' | '1d';
  yAxisRange: 'auto' | 'manual';
  yAxisMin?: number;
  yAxisMax?: number;
  smoothing: 'none' | 'moving-average' | 'exponential';
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}
```

---

#### 2.2 Enhanced Point Selection
**Goal:** Make point selection more intelligent

**Features to Add:**
```typescript
// Intelligent point suggestions
interface PointSuggestion {
  point: Point;
  reason: string;  // "Common HVAC pairing", "Matching units", etc.
  confidence: number;  // 0-1 score
}

// Smart filtering
interface PointFilterOptions {
  units: string[];  // Filter by compatible units
  tags: string[];   // Filter by marker tags
  category: string; // "temperature", "humidity", "pressure", etc.
  hideIncompatible: boolean;  // Hide points that can't be used
}

// Auto-categorization
const categorizePoint = (point: Point): PointCategory => {
  const lowerName = point.name.toLowerCase();
  const tags = point.marker_tags || [];

  if (tags.includes('temp') || lowerName.includes('temp'))
    return { category: 'temperature', icon: 'thermostat' };
  if (tags.includes('humidity') || lowerName.includes('rh'))
    return { category: 'humidity', icon: 'water_drop' };
  // ... more categories

  return { category: 'other', icon: 'sensors' };
};
```

**Checklist:**
- [ ] Add unit filter to PointSelector
- [ ] Implement point categorization utility
- [ ] Create PointSuggestionEngine
- [ ] Add "suggested points" section to wizard
- [ ] Show compatibility warnings for invalid selections

---

#### 2.3 Settings Persistence
**Goal:** Remember user preferences across sessions

**Implementation:**
```typescript
// chartSettingsStorage.ts
interface SavedChartSettings {
  chartId: string;
  chartType: string;
  config: ChartConfig;
  lastModified: Date;
}

export const saveChartSettings = async (
  chartId: string,
  config: ChartConfig
) => {
  // Save to localStorage for immediate access
  localStorage.setItem(`chart_settings_${chartId}`, JSON.stringify(config));

  // Save to Firestore for cross-device sync
  await db.collection('chart_settings').doc(chartId).set({
    config,
    updatedAt: serverTimestamp()
  });
};

export const loadChartSettings = async (
  chartId: string
): Promise<ChartConfig | null> => {
  // Try localStorage first (instant)
  const cached = localStorage.getItem(`chart_settings_${chartId}`);
  if (cached) return JSON.parse(cached);

  // Fallback to Firestore (synced across devices)
  const doc = await db.collection('chart_settings').doc(chartId).get();
  return doc.exists ? doc.data().config : null;
};
```

**Checklist:**
- [ ] Implement settings storage utility
- [ ] Add "Save Settings" button to dialogs
- [ ] Auto-load saved settings on chart mount
- [ ] Add "Reset to Defaults" option
- [ ] Show "Settings modified" indicator

---

### Phase 3: Advanced Features (4-6 weeks)

#### 3.1 Chart Presets & Templates
**Goal:** Quick setup for common use cases

**Implementation:**
```typescript
interface ChartPreset {
  id: string;
  name: string;
  description: string;
  chartType: string;
  icon: ReactNode;
  config: ChartConfig;
  requiredPointTags: string[][];  // Points that must be selected
  optionalPointTags?: string[][];
}

const CHART_PRESETS: ChartPreset[] = [
  {
    id: 'hvac-ahu-monitoring',
    name: 'AHU Performance Dashboard',
    description: 'Monitor air handler supply temp, return temp, and damper position',
    chartType: 'timeseries',
    icon: <Air />,
    config: {
      aggregation: '5m',
      showGrid: true,
      yAxisRange: 'auto'
    },
    requiredPointTags: [
      ['supply', 'temp'],
      ['return', 'temp'],
      ['damper', 'position']
    ]
  },
  {
    id: 'zone-temperature-heatmap',
    name: 'Zone Temperature Heatmap',
    description: 'Visualize temperature distribution across all zones',
    chartType: 'heatmap',
    icon: <Thermostat />,
    config: {
      radius: 30,
      blur: 0.8,
      gradient: PRESET_GRADIENTS.thermal.gradient
    },
    requiredPointTags: [
      ['zone', 'temp']
    ]
  }
  // ... more presets
];
```

**Checklist:**
- [ ] Define preset library
- [ ] Add "Load Preset" option to wizard
- [ ] Auto-suggest presets based on available points
- [ ] Allow users to save custom presets
- [ ] Share presets across organization

---

#### 3.2 Advanced Help System
**Goal:** Contextual guidance throughout the UI

**Features:**
- Interactive tours (first-time user guidance)
- Inline help tooltips for all settings
- "Learn More" links to documentation
- Video tutorials embedded in dialogs
- Troubleshooting wizard for common issues

**Example - SPC Chart Tour:**
```typescript
const spcChartTour = [
  {
    target: '.spc-chart-type-selector',
    content: 'Choose how to monitor your data. X-mR is best for individual measurements over time.',
    position: 'right'
  },
  {
    target: '.spc-control-limits',
    content: 'Control limits show acceptable variation. Points outside these limits indicate special causes.',
    position: 'bottom'
  },
  {
    target: '.spc-violations',
    content: 'Violations are automatically detected and highlighted with recommendations.',
    position: 'left'
  }
];
```

---

#### 3.3 Configuration Import/Export
**Goal:** Share chart configurations between users and dashboards

**Features:**
```typescript
// Export chart configuration as JSON
const exportChartConfig = (chartId: string) => {
  const config = getChartConfig(chartId);
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: 'application/json'
  });
  downloadFile(blob, `${chartId}_config.json`);
};

// Import chart configuration
const importChartConfig = async (file: File) => {
  const text = await file.text();
  const config = JSON.parse(text);

  // Validate config
  const validation = validateChartConfig(config.chartType, config.selectedPoints, config.config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  return config;
};

// Share via URL
const shareChartConfig = (chartId: string) => {
  const config = getChartConfig(chartId);
  const encoded = btoa(JSON.stringify(config));
  const shareUrl = `${window.location.origin}/chart/import?config=${encoded}`;
  copyToClipboard(shareUrl);
};
```

---

## 5. Priority Ranking for Improvements

### Critical (Do Immediately)
1. **Unified Time Range Selection** - All charts need consistent time controls
2. **Bar Chart Aggregation UI** - Currently hardcoded, users can't change
3. **Point Unit Validation** - Prevent mixed-unit confusion
4. **Standard Settings Dialog Pattern** - Implement consistent UI access

**Estimated Effort:** 2-3 weeks
**Impact:** **VERY HIGH** - Affects all users, all charts

---

### High Priority (Next Sprint)
1. **Time Series Settings Panel** - Add aggregation, Y-axis, smoothing controls
2. **Enhanced Point Selector** - Add filtering, categorization, suggestions
3. **Settings Persistence** - Remember user preferences
4. **Global Validation Framework** - Consistent error handling

**Estimated Effort:** 3-4 weeks
**Impact:** **HIGH** - Significantly improves user experience

---

### Medium Priority (Following Sprint)
1. **Area Chart Settings** - Add stack mode, opacity, interpolation
2. **Scatter Plot Settings UI** - Expose advanced features through UI
3. **Heatmap Time Aggregation** - Add hourly/daily bucketing
4. **Chart Presets Library** - Quick setup for common use cases

**Estimated Effort:** 3-4 weeks
**Impact:** **MEDIUM** - Nice to have, improves efficiency

---

### Low Priority (Future Enhancements)
1. **Advanced Help System** - Interactive tours, embedded tutorials
2. **Configuration Import/Export** - Share settings between users
3. **Process Capability for SPC** - Cp, Cpk calculations
4. **Psychrometric Process Lines** - Drawing tools for HVAC processes

**Estimated Effort:** 4-6 weeks
**Impact:** **LOW** - Power user features, not essential

---

## 6. Implementation Guidelines

### Coding Standards

#### Component Structure
```typescript
// Standard chart component pattern
interface StandardChartProps {
  // Data
  selectedPoints: Point[];
  timeRange?: string;

  // Configuration
  config?: ChartSpecificConfig;
  showSettings?: boolean;

  // Behavior
  enabled?: boolean;
  onConfigChange?: (config: ChartSpecificConfig) => void;

  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
}

const StandardChart: React.FC<StandardChartProps> = ({
  selectedPoints,
  timeRange,
  config,
  showSettings = true,
  enabled = true,
  onConfigChange,
  onEdit,
  onDelete
}) => {
  // 1. State management
  const [localConfig, setLocalConfig] = useState(config);

  // 2. Data fetching
  const { data, isLoading, error } = useChartData({
    selectedPoints,
    timeRange,
    enabled
  });

  // 3. Validation
  const validation = useMemo(
    () => validateChartConfig(chartType, selectedPoints, localConfig),
    [selectedPoints, localConfig]
  );

  // 4. Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 5. Render
  return (
    <>
      <ChartToolbar
        title={config.title}
        onSettings={() => setSettingsOpen(true)}
        validation={validation}
      />
      <ChartContent data={data} loading={isLoading} error={error} />
      <ChartSettingsDialog
        open={settingsOpen}
        config={localConfig}
        onChange={handleConfigChange}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
};
```

---

### Testing Requirements

#### Unit Tests
- [ ] Validate config schemas for all chart types
- [ ] Test point validation logic (min/max, units, compatibility)
- [ ] Test time range parsing and conversion
- [ ] Test settings persistence (save/load)

#### Integration Tests
- [ ] Test wizard flow for all chart types
- [ ] Test config changes reflect in chart rendering
- [ ] Test global time range sync behavior
- [ ] Test settings dialog open/close/save

#### E2E Tests
- [ ] Create chart via wizard
- [ ] Modify settings via settings dialog
- [ ] Change time range and verify data refresh
- [ ] Save and reload chart with settings
- [ ] Export/import configuration

---

## 7. Documentation Requirements

### User Documentation
- [ ] "Getting Started" guide for each chart type
- [ ] Settings reference documentation
- [ ] Point selection best practices
- [ ] Time range selection guide
- [ ] Troubleshooting common issues

### Developer Documentation
- [ ] Chart configuration schema documentation
- [ ] Adding new chart types guide
- [ ] Validation framework usage
- [ ] Settings persistence patterns
- [ ] Testing chart components

---

## Appendix A: Chart Configuration Schema Reference

### Base Configuration (All Charts)
```typescript
interface BaseChartConfig {
  title: string;
  chartType: string;
  siteId: string;
  siteName: string;
  selectedPoints: Point[];
  timeRange?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisLabel?: string;
}
```

### Time Series Configuration
```typescript
interface TimeSeriesConfig extends BaseChartConfig {
  aggregation?: 'none' | '1m' | '5m' | '15m' | '1h' | '1d';
  yAxisRange?: 'auto' | 'manual';
  yAxisMin?: number;
  yAxisMax?: number;
  smoothing?: 'none' | 'moving-average' | 'exponential';
}
```

### Heatmap Configuration
```typescript
interface HeatmapConfig extends BaseChartConfig {
  radius?: number;  // 5-100
  blur?: number;    // 0-1
  opacity?: number; // 0-1
  gradient?: Record<number, string>;
}
```

### SPC Configuration
```typescript
interface SPCConfig extends BaseChartConfig {
  spcChartType: 'xmr' | 'xbar-r' | 'xbar-s';
  subgroupSize?: number;  // For xbar charts
  sigmaMultiplier?: number;  // 2, 3, or 4
  autoCalculateLimits?: boolean;
  upperControlLimit?: number;
  centerLine?: number;
  lowerControlLimit?: number;
}
```

### Bar Chart Configuration
```typescript
interface BarChartConfig extends BaseChartConfig {
  aggregationMethod: 'latest' | 'average' | 'sum' | 'min' | 'max' | 'count';
  sortBy?: 'name' | 'value' | 'custom';
  sortDirection?: 'asc' | 'desc';
  showValues?: boolean;
  colorBy?: 'default' | 'value' | 'threshold';
  warningThreshold?: number;
  criticalThreshold?: number;
}
```

### Scatter Plot Configuration
```typescript
interface ScatterPlotConfig extends BaseChartConfig {
  correlationMode: 'time-value' | 'point-correlation';
  xAxisPoint?: string;
  yAxisPoint?: string;
  enableCorrelationAnalysis?: boolean;
  hvacPreset?: string;
  showConfidenceIntervals?: boolean;
  showOutliers?: boolean;
  colorByTime?: 'hour' | 'day' | 'week' | 'month' | 'none';
}
```

### Perfect Economizer Configuration
```typescript
interface PerfectEconomizerConfig extends BaseChartConfig {
  oatPointName: string;
  matPointName: string;
  ratPointName: string;
  economizer: {
    type: 'differential' | 'enthalpy';
    highLimitShutoff: number;
    minimumOADamperPosition: number;
    mixedAirSetpoint: number;
    returnAirTemp: number;
  };
}
```

### Psychrometric Configuration
```typescript
interface PsychrometricConfig extends BaseChartConfig {
  temperatureUnit: 'C' | 'F';
  showComfortZones?: boolean;
  showEnthalpy?: boolean;
  showWetBulb?: boolean;
  showSpecificVolume?: boolean;
  clothingInsulation?: number;  // clo
  metabolicRate?: number;  // met
  airVelocity?: number;  // m/s
  comfortCategory?: 'I' | 'II' | 'III';
  enableAdaptiveComfort?: boolean;
}
```

---

## Appendix B: Validation Error Messages

### Standard Error Messages
```typescript
const ERROR_MESSAGES = {
  // Point selection errors
  INSUFFICIENT_POINTS: (min: number) =>
    `This chart requires at least ${min} point(s). Please select more points.`,
  EXCESSIVE_POINTS: (max: number) =>
    `This chart supports up to ${max} points. Please remove some points.`,
  MIXED_UNITS: (units: string[]) =>
    `Mixed units detected: ${units.join(', ')}. Consider selecting points with matching units.`,
  INCOMPATIBLE_POINTS: (reason: string) =>
    `Selected points are incompatible: ${reason}`,

  // Time range errors
  INVALID_TIME_RANGE: 'Invalid time range specified. Please select a valid range.',
  TIME_RANGE_TOO_LARGE: (max: string) =>
    `Time range exceeds maximum of ${max}. Please select a shorter range.`,

  // Configuration errors
  MISSING_REQUIRED_FIELD: (field: string) =>
    `Required field missing: ${field}`,
  INVALID_VALUE: (field: string, reason: string) =>
    `Invalid value for ${field}: ${reason}`,

  // Data errors
  NO_DATA_AVAILABLE: 'No data available for the selected points and time range.',
  DATA_QUALITY_ISSUE: (issue: string) =>
    `Data quality issue detected: ${issue}`,
};
```

---

## Conclusion

This comprehensive review reveals that while the Building Vitals platform has solid chart infrastructure, there are significant opportunities for improving consistency and user experience:

**Immediate Actions Required:**
1. Implement unified time range selection across all charts
2. Add configuration UI for Bar Chart aggregation (currently missing)
3. Create standard settings dialog pattern
4. Implement validation framework

**Key Strengths to Preserve:**
- Excellent SPC wizard as model for other charts
- Strong specialized features (Psychrometric, Perfect Economizer, Scatter correlation)
- Unified data flow via `useChartData`
- Consistent error boundary pattern

**Success Metrics:**
- Time to configure a chart < 2 minutes
- Settings discoverability > 90%
- Configuration errors < 5%
- User satisfaction with chart controls > 4/5

**Estimated Total Effort:** 8-12 weeks for full standardization
**Recommended Approach:** Phased rollout starting with critical consistency fixes

---

**Next Steps:**
1. Review this document with product team
2. Prioritize recommendations based on user feedback
3. Create implementation tickets for Phase 1
4. Begin with unified time range selector (highest impact)
