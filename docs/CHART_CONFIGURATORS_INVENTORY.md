# Chart Configuration Components - Comprehensive Inventory

**Research Date:** 2025-10-16
**Analyst:** Research Agent
**Purpose:** Complete inventory of chart configuration wizards and configurators

---

## Executive Summary

**Total Configurators Found:** 8 components
**Fully Integrated:** 3 components (37.5%)
**Partially Integrated:** 2 components (25%)
**Orphaned/Not Integrated:** 3 components (37.5%)

### Critical Findings:
1. **Multiple chart builder systems exist** - causing confusion and inconsistency
2. **Specialized configurators are orphaned** - high-quality components not being used
3. **Wizard fragmentation** - no single source of truth for chart configuration
4. **Missing integration points** - configurators exist but aren't connected to main workflows

---

## 1. Complete Configurator Inventory

### 1.1 Specialized Chart Configurators

#### ✅ **SPCWizardConfig.tsx**
**Location:** `src/components/charts/SPCWizardConfig.tsx`
**Status:** 🟢 INTEGRATED (used in ChartWizard)
**Chart Type:** Statistical Process Control (SPC) Charts

**Features:**
- ✅ Guided wizard with plain-language questions
- ✅ Chart type selection (X-mR, X-bar R, X-bar S)
- ✅ Sample size configuration for grouped data
- ✅ Alert sensitivity selector (2σ, 3σ, 4σ)
- ✅ Automatic vs manual control limit calculation
- ✅ Smart defaults and help text
- ✅ Visual preview of capabilities

**Configuration Options:**
```typescript
{
  spcChartType: 'xmr' | 'xbar-r' | 'xbar-s',
  subgroupSize: number,
  sigmaMultiplier: 2 | 3 | 4,
  autoCalculateLimits: boolean,
  upperControlLimit?: number,
  centerLine?: number,
  lowerControlLimit?: number
}
```

**Integration Status:**
- ✅ Imported by `ChartWizard.tsx` (line 126)
- ✅ Rendered in wizard configuration step
- ✅ Passes config to parent via `setConfig` callback

**User Experience:**
- Excellent plain-language prompts
- Real-time validation
- Example-driven guidance
- Clear visual preview panel

**Gaps:**
- ❌ No real-time chart preview during configuration
- ❌ Not accessible from EnhancedChartBuilder
- ⚠️ Only available through legacy ChartWizard

---

#### ✅ **DeviationConfigurator.tsx**
**Location:** `src/components/charts/DeviationConfigurator.tsx`
**Status:** 🟢 INTEGRATED (used in DeviationHeatmapWizard)
**Chart Type:** Device Deviation Heatmap

**Features:**
- ✅ Visual color gradient preview
- ✅ Two modes: Single target vs Range
- ✅ Interactive help sections (expandable)
- ✅ Step-by-step configuration wizard
- ✅ Smart numeric input validation
- ✅ Unit configuration
- ✅ Real-time visual feedback
- ✅ Configuration completeness indicators

**Configuration Options:**
```typescript
{
  mode: 'single' | 'range',
  setpoint?: number,
  tolerance?: number,
  minSetpoint?: number,
  maxSetpoint?: number,
  unit?: string,
  colorScale: 'gradient'
}
```

**Visual Features:**
- Color zone preview with gradient bar
- Zone labels (Critical Low, Good, Critical High)
- Live calculation of acceptable ranges
- Smart validation feedback

**Integration Status:**
- ✅ Used by `DeviationHeatmapWizard.tsx` (line 275)
- ✅ Full wizard integration with validation
- ✅ Integrated with smart defaults system
- ❌ NOT integrated into EnhancedChartBuilder
- ❌ NOT integrated into main ChartWizard

**User Experience:** ⭐⭐⭐⭐⭐ (5/5)
- Best-in-class configurator
- Outstanding visual feedback
- Clear explanations with examples
- Progressive disclosure of complexity

---

#### 🟡 **MissingDataConfigurator.tsx**
**Location:** `src/components/charts/MissingDataConfigurator.tsx`
**Status:** 🟡 ORPHANED (Dialog component, no imports found)
**Purpose:** Configure how to handle missing/gap data in time series

**Features:**
- ✅ Data quality summary display
- ✅ Multiple interpolation methods
- ✅ Auto-detect best method
- ✅ Configurable max gap threshold
- ✅ Visual gap markers toggle
- ✅ Custom fill value for zero-fill method

**Configuration Options:**
```typescript
interface MissingDataConfig {
  method: 'none' | 'linear' | 'previous' | 'next' | 'average' | 'zero',
  maxGapHours: number,
  showGapMarkers: boolean,
  fillValue: number,
  autoDetect: boolean
}
```

**Data Quality Metrics:**
- Missing points count and percentage
- Longest gap detection
- Average gap calculation
- Real-time quality assessment

**Integration Status:**
- ❌ No imports found in codebase
- ❌ Not integrated into any wizard
- ❌ Dialog component (requires parent to trigger)
- ✅ Complete implementation ready to use

**Recommendation:** 🔴 HIGH PRIORITY
Should be integrated into ALL time-series chart configurations as an advanced option.

---

#### 🟡 **UnitConfigurator.tsx**
**Location:** `src/components/charts/UnitConfigurator.tsx`
**Status:** 🟡 ORPHANED (Dialog component, no imports found)
**Purpose:** Configure display units for multi-point charts

**Features:**
- ✅ Per-point unit override
- ✅ Smart unit suggestions by category
- ✅ Autocomplete with common units
- ✅ Category detection from marker tags
- ✅ Unit normalization display
- ✅ Original vs override tracking

**Unit Categories:**
```typescript
{
  temperature: ['°F', '°C', 'K'],
  humidity: ['%RH', '%'],
  pressure: ['PSI', 'Pa', 'kPa', 'in w.c.', 'in Hg'],
  flow: ['CFM', 'GPM', 'm³/h', 'L/s'],
  power: ['W', 'kW', 'MW', 'HP', 'BTU/hr'],
  electrical: ['V', 'A', 'kW', 'kVA', 'kVAR'],
  // ... more categories
}
```

**Integration Status:**
- ❌ No imports found in codebase
- ❌ Not integrated into any wizard
- ❌ Dialog component (requires parent to trigger)
- ✅ Complete implementation ready to use

**Recommendation:** 🔴 HIGH PRIORITY
Should be integrated into chart configuration as "Configure Units" button.

---

### 1.2 Chart Builder & Wizard Systems

#### ✅ **EnhancedChartBuilder.tsx**
**Location:** `src/components/charts/EnhancedChartBuilder.tsx`
**Status:** 🟢 ACTIVE (Primary chart builder)
**Lines:** 870 lines

**Features:**
- ✅ Comprehensive chart type catalog
- ✅ Detailed chart requirements per type
- ✅ Smart point suggestions
- ✅ Three-step wizard (Type → Points → Config)
- ✅ Chart preview integration
- ✅ Point type detection
- ✅ Validation system
- ✅ Help system with use cases

**Chart Types Supported:** 11 chart types
```typescript
line, bar, deviceDeviationHeatmap, gauge, scatter,
heatmap, psychrometric, sankey, boxplot, radar
```

**Special Integration:**
- ✅ **DeviationHeatmapWizard** - Opens full wizard when heatmap selected (line 495)
- ✅ **ChartPreviewImage** - Shows mini previews
- ❌ Missing: SPCWizardConfig integration
- ❌ Missing: MissingDataConfigurator integration
- ❌ Missing: UnitConfigurator integration

**Configuration Step Rendering:**
Lines 699-776 contain configuration rendering logic:
- ✅ Basic configuration (title, chart-specific options)
- ✅ Chart-specific config fields (setpoint, tolerance, etc.)
- ❌ No advanced options panel
- ❌ No missing data configuration
- ❌ No unit configuration
- ❌ No SPC configuration

**Recommendation:** 🟡 NEEDS ENHANCEMENT
Add integration points for specialized configurators as advanced options.

---

#### ✅ **ChartWizard.tsx** (Legacy)
**Location:** `src/components/monitors/ChartWizard.tsx`
**Status:** 🟢 ACTIVE (Legacy monitor creation)
**Lines:** 2000+ lines (truncated in reading)

**Features:**
- ✅ Full wizard flow with site selection
- ✅ Point selection with UnifiedPointSelector
- ✅ Template presets
- ✅ Smart suggestions
- ✅ Chart-specific configuration
- ✅ **SPCWizardConfig integration** (line 126)
- ✅ Time range configuration
- ✅ Advanced settings accordion

**Chart Types Supported:** 20+ chart types
Includes all standard types plus specialized ones:
- TimeSeries, AreaChart, StackedArea
- Scatter, Heatmap, DeviceDeviationHeatmap
- Psychrometric, PerfectEconomizer, VAVComprehensive
- BoxPlot, Candlestick, ParallelCoordinates, Radar
- TimelineChart, CalendarYearHeatmap, Sankey, Treemap

**SPCWizardConfig Integration:**
```typescript
// Line 126: Import
import SPCWizardConfig from '../charts/SPCWizardConfig';

// Used in configuration rendering for SPC chart types
{chartType === 'SPC' && (
  <SPCWizardConfig config={config} setConfig={setConfig} />
)}
```

**Integration Status:**
- ✅ SPCWizardConfig: INTEGRATED
- ❌ DeviationConfigurator: NOT integrated
- ❌ MissingDataConfigurator: NOT integrated
- ❌ UnitConfigurator: NOT integrated

**Recommendation:** 🟡 LEGACY SYSTEM
Being replaced by EnhancedChartBuilder. Should extract working integrations.

---

#### ✅ **DeviationHeatmapWizard.tsx**
**Location:** `src/components/charts/DeviationHeatmapWizard.tsx`
**Status:** 🟢 INTEGRATED (Called by EnhancedChartBuilder)
**Purpose:** Specialized 4-step wizard for deviation heatmaps

**Wizard Steps:**
1. **Select Points** - PointSelector with smart defaults
2. **Time Range** - TimeRangeSelector with aggregation warnings
3. **Deviation Settings** - DeviationConfigurator (full integration)
4. **Preview** - ConfigPreview with quality metrics

**Features:**
- ✅ Complete integration with DeviationConfigurator
- ✅ Smart defaults from point metadata
- ✅ Aggregation impact analysis
- ✅ Step validation with error messages
- ✅ Configuration preview
- ✅ Custom stepper with icons

**Smart Defaults Application (lines 109-137):**
```typescript
const smartDefaults = calculateSmartDefaults({
  unit: firstPoint.unit,
  pointName: firstPoint.name,
  markerTags: firstPoint.markerTags,
});

// Applies mode, tolerance, setpoint, range automatically
```

**Integration with Parent:**
- ✅ Called by EnhancedChartBuilder (line 799)
- ✅ Returns complete DeviationHeatmapConfig
- ✅ Handles cancel gracefully
- ✅ Full configuration object passed to parent

**User Experience:** ⭐⭐⭐⭐⭐ (5/5)
Best example of wizard integration in the codebase.

---

#### 🟡 **EnhancedChartWizard.tsx**
**Location:** `src/components/charts/wizard/EnhancedChartWizard.tsx`
**Status:** 🔴 SKELETON/INCOMPLETE
**Purpose:** Modern wizard framework (UI only, no content)

**Features:**
- ✅ Beautiful glassmorphic UI
- ✅ Keyboard shortcuts
- ✅ Progress tracking
- ✅ Advanced options panel
- ✅ Mobile-optimized layout
- ✅ Preview panel integration
- ❌ **NO ACTUAL CONFIGURATION LOGIC**
- ❌ Placeholder step rendering only

**Step Content (lines 663-776):**
All steps render placeholder DropZoneIndicators:
```typescript
case 0: // Chart Type
  <DropZoneIndicator message="Click to select chart type" />
case 1: // Site Selection
  <DropZoneIndicator message="Click to select site" />
case 2: // Data Points
  <DropZoneIndicator message="Click to select data points" />
case 3: // Configuration
  <Alert>Your chart is ready to be created!</Alert>
```

**Integration Status:**
- ❌ Not imported by any component
- ❌ No actual functionality implemented
- ✅ UI framework is excellent
- ✅ State management via useChartBuilding hook

**Recommendation:** 🔴 ABANDONED or WIP
Either complete this implementation or remove it. The UI framework is excellent but unusable.

---

### 1.3 Supporting Components

#### ✅ **ConfigPreview.tsx**
**Location:** `src/components/charts/ConfigPreview.tsx`
**Status:** 🟢 INTEGRATED (DeviationHeatmapWizard)
**Purpose:** Visual preview of configuration before creation

**Features:**
- ✅ Summary of selected points
- ✅ Time range display
- ✅ Deviation configuration summary
- ✅ Aggregation impact warnings
- ✅ Data quality indicators
- ✅ Visual status indicators

**Integration:**
- ✅ Used in DeviationHeatmapWizard (line 285)
- ❌ Not used in other wizards
- ✅ Generic enough for reuse

---

#### ✅ **QuickChartConfig.tsx**
**Location:** `src/components/dashboard/QuickChartConfig.tsx`
**Status:** 🟢 ACTIVE (Quick dashboard charts)
**Purpose:** Simplified chart creation for dashboards

**Features:**
- ✅ Minimal configuration interface
- ✅ UnifiedSelector integration
- ✅ Chart type suggestions
- ✅ Max point limits per chart type
- ✅ Advanced options placeholder

**Scope:** Simplified subset for quick charts
- No wizard flow
- No advanced configuration
- Fixed time range (24h)
- Basic validation only

---

## 2. Integration Analysis

### 2.1 Integration Map

```
EnhancedChartBuilder (Main Entry Point)
├── deviceDeviationHeatmap selected
│   └── ✅ DeviationHeatmapWizard
│       ├── ✅ PointSelector
│       ├── ✅ TimeRangeSelector
│       ├── ✅ DeviationConfigurator
│       └── ✅ ConfigPreview
│
├── Other chart types selected
│   ├── ✅ UnifiedPointSelector
│   ├── ✅ ChartPreviewImage
│   └── ❌ Basic config only (NO specialized configurators)
│
└── ❌ Missing Integrations:
    ├── MissingDataConfigurator
    ├── UnitConfigurator
    └── SPCWizardConfig


ChartWizard (Legacy)
├── ✅ SPCWizardConfig (for SPC chart type)
├── ✅ UnifiedPointSelector
├── ✅ Template presets
└── ❌ Missing:
    ├── DeviationConfigurator
    ├── MissingDataConfigurator
    └── UnitConfigurator


QuickChartConfig (Dashboard)
├── ✅ UnifiedSelector
├── ✅ Simple validation
└── ❌ No specialized configurators
```

### 2.2 Feature Completeness Matrix

| Feature | Enhanced Builder | ChartWizard | DeviationWizard | QuickConfig |
|---------|-----------------|-------------|-----------------|-------------|
| **Core Features** |
| Chart type selection | ✅ 11 types | ✅ 20+ types | ❌ Single type | ✅ All types |
| Point selection | ✅ | ✅ | ✅ | ✅ |
| Validation | ✅ | ✅ | ✅ | ✅ Basic |
| Preview | ✅ Static | ⚠️ Limited | ✅ Live | ❌ |
| **Specialized Configs** |
| SPC Configuration | ❌ | ✅ | ❌ | ❌ |
| Deviation Config | ⚠️ Via wizard | ❌ | ✅ | ❌ |
| Missing Data | ❌ | ❌ | ❌ | ❌ |
| Unit Config | ❌ | ❌ | ❌ | ❌ |
| **UX Features** |
| Smart defaults | ✅ | ✅ | ✅✅ Best | ❌ |
| Help text | ✅ | ✅ | ✅✅ Best | ⚠️ Limited |
| Visual preview | ✅ Static | ❌ | ✅✅ Live | ❌ |
| Keyboard shortcuts | ❌ | ❌ | ❌ | ❌ |

---

## 3. Critical Gaps & Issues

### 3.1 Orphaned Components (High Value, Not Used)

#### 🔴 **MissingDataConfigurator** - CRITICAL GAP
**Impact:** Missing from all chart builders
**Value:** HIGH - Essential for time-series data quality
**Complexity:** LOW - Already complete, just needs integration

**Should be integrated into:**
- [ ] EnhancedChartBuilder (Advanced Options)
- [ ] ChartWizard (Advanced Settings)
- [ ] DeviationHeatmapWizard (Time Range step)
- [ ] All time-series chart types

**Integration Effort:** 2-4 hours
- Add to advanced options accordion
- Wire up config to chart rendering
- Update chart adapters to respect config

---

#### 🔴 **UnitConfigurator** - CRITICAL GAP
**Impact:** Missing from all multi-point charts
**Value:** HIGH - Essential for multi-unit charts
**Complexity:** LOW - Already complete, just needs integration

**Should be integrated into:**
- [ ] EnhancedChartBuilder (Point Selection step)
- [ ] ChartWizard (Point Selection step)
- [ ] All multi-point chart types

**Integration Effort:** 2-4 hours
- Add "Configure Units" button after point selection
- Store unit overrides in chart config
- Apply overrides during chart rendering

---

### 3.2 Incomplete Components

#### 🔴 **EnhancedChartWizard** - ABANDONED
**Status:** Beautiful UI shell with no implementation
**Decision Needed:** Complete or remove

**If Complete (40+ hours):**
- Implement chart type selection UI
- Implement site selection UI
- Implement point selection UI
- Integrate all specialized configurators
- Add keyboard shortcut handling
- Connect to useChartBuilding hook

**If Remove (1 hour):**
- Delete EnhancedChartWizard.tsx
- Remove from imports
- Document decision

**Recommendation:** Remove for now, revisit in future refactor

---

### 3.3 Fragmented Configuration Systems

**Problem:** 3 different chart builders exist:
1. EnhancedChartBuilder (Primary, 11 chart types)
2. ChartWizard (Legacy, 20+ chart types)
3. QuickChartConfig (Dashboard, simplified)

**Issues:**
- Duplicate code and logic
- Inconsistent UX
- Different feature sets
- Maintenance burden

**Recommendation:** Consolidate
- Choose EnhancedChartBuilder as primary
- Extract working integrations from ChartWizard (SPCWizardConfig)
- Keep QuickChartConfig for simplified dashboard use
- Deprecate ChartWizard after migration

---

## 4. Recommendations

### 4.1 Immediate Actions (1-2 days)

#### Priority 1: Integrate Orphaned Configurators
```typescript
// EnhancedChartBuilder.tsx - Add to configuration step

<Accordion>
  <AccordionSummary>Advanced Options</AccordionSummary>
  <AccordionDetails>
    <Stack spacing={2}>
      {/* Missing Data Configuration */}
      <Button
        onClick={() => setShowMissingDataConfig(true)}
        startIcon={<Settings />}
      >
        Configure Missing Data Handling
      </Button>

      {/* Unit Configuration */}
      {selectedPoints.length > 1 && (
        <Button
          onClick={() => setShowUnitConfig(true)}
          startIcon={<Settings />}
        >
          Configure Display Units
        </Button>
      )}
    </Stack>
  </AccordionDetails>
</Accordion>

{/* Dialogs */}
<MissingDataConfigurator
  open={showMissingDataConfig}
  onClose={() => setShowMissingDataConfig(false)}
  onApply={(config) => setChartConfig({...chartConfig, missingData: config})}
/>

<UnitConfigurator
  open={showUnitConfig}
  points={selectedPoints}
  onClose={() => setShowUnitConfig(false)}
  onUnitsUpdated={(overrides) => setChartConfig({...chartConfig, unitOverrides: overrides})}
/>
```

#### Priority 2: Extract SPCWizardConfig from ChartWizard
```typescript
// EnhancedChartBuilder.tsx - Chart type configurations

const CHART_CONFIGURATIONS = {
  // ... existing configs ...

  spc: {
    name: 'SPC Chart',
    icon: QueryStats,
    category: 'statistical',
    description: 'Statistical Process Control',
    useCase: 'Monitor process stability and detect anomalies',
    configurator: SPCWizardConfig, // 👈 Add specialized configurator
    // ...
  }
};

// In renderConfiguration():
{currentChartConfig.configurator && (
  <currentChartConfig.configurator
    config={chartConfig}
    setConfig={setChartConfig}
  />
)}
```

### 4.2 Short-term Goals (1 week)

1. **Standardize Configuration Pattern**
   ```typescript
   interface ChartTypeConfig {
     name: string;
     icon: ComponentType;
     category: string;
     configurator?: ComponentType<ConfiguratorProps>; // 👈 Optional configurator
     validation?: (config: any) => ValidationResult;
     preview?: ComponentType<PreviewProps>;
   }
   ```

2. **Create Configurator Registry**
   ```typescript
   const CONFIGURATORS = {
     spc: SPCWizardConfig,
     deviation: DeviationConfigurator,
     missingData: MissingDataConfigurator,
     units: UnitConfigurator,
   };
   ```

3. **Build Configurator Injection System**
   - Allow chart types to declare required configurators
   - Automatically show/hide based on chart type
   - Progressive disclosure for advanced options

### 4.3 Long-term Vision (1 month)

#### Unified Configuration Architecture
```typescript
<EnhancedChartBuilder>
  {/* Step 1: Chart Type */}
  <ChartTypeSelector
    configurations={CHART_CONFIGURATIONS}
  />

  {/* Step 2: Points */}
  <PointSelector
    requirements={currentChart.pointRequirements}
    suggestions={smartSuggestions}
  />

  {/* Step 3: Configuration */}
  <ConfigurationPanel>
    {/* Basic Config */}
    <BasicConfiguration />

    {/* Chart-specific Configurator */}
    {currentChart.configurator && (
      <currentChart.configurator config={config} onChange={setConfig} />
    )}

    {/* Advanced Options (Always Available) */}
    <AdvancedOptions>
      <MissingDataConfigurator />
      <UnitConfigurator />
      <ColorPaletteSelector />
      <AxisConfiguration />
    </AdvancedOptions>

    {/* Preview */}
    <ConfigPreview config={fullConfig} />
  </ConfigurationPanel>
</EnhancedChartBuilder>
```

---

## 5. Implementation Checklist

### Phase 1: Quick Wins (2-4 hours each)

- [ ] **Integrate MissingDataConfigurator**
  - [ ] Add to EnhancedChartBuilder advanced options
  - [ ] Add to ChartWizard advanced settings
  - [ ] Wire up to chart rendering pipeline
  - [ ] Test with time-series charts

- [ ] **Integrate UnitConfigurator**
  - [ ] Add "Configure Units" button to point selection
  - [ ] Store unit overrides in chart config
  - [ ] Apply overrides in chart rendering
  - [ ] Test with multi-point charts

- [ ] **Extract SPCWizardConfig to EnhancedChartBuilder**
  - [ ] Add SPC chart type to CHART_CONFIGURATIONS
  - [ ] Import SPCWizardConfig component
  - [ ] Add conditional rendering in configuration step
  - [ ] Test SPC chart creation flow

### Phase 2: Architecture Improvements (8 hours)

- [ ] **Create Configurator Pattern**
  - [ ] Define ConfiguratorProps interface
  - [ ] Create configurator registry
  - [ ] Build injection system
  - [ ] Document pattern for future configurators

- [ ] **Standardize Advanced Options**
  - [ ] Create AdvancedOptionsPanel component
  - [ ] Move all advanced configs to panel
  - [ ] Add progressive disclosure
  - [ ] Consistent save/cancel behavior

### Phase 3: Migration & Cleanup (16 hours)

- [ ] **Migrate ChartWizard Features**
  - [ ] Audit all ChartWizard functionality
  - [ ] Extract unique features
  - [ ] Migrate to EnhancedChartBuilder
  - [ ] Create migration guide

- [ ] **Deprecate Legacy Code**
  - [ ] Mark ChartWizard as deprecated
  - [ ] Add console warnings
  - [ ] Update documentation
  - [ ] Plan removal timeline

- [ ] **Handle EnhancedChartWizard**
  - [ ] Decision: Complete or Remove
  - [ ] If remove: Delete file and references
  - [ ] If complete: Full implementation plan
  - [ ] Document decision

---

## 6. Key Insights

### What's Working Well ✅

1. **DeviationHeatmapWizard + DeviationConfigurator**
   - Best-in-class user experience
   - Excellent visual feedback
   - Complete integration
   - Should be model for other configurators

2. **SPCWizardConfig**
   - Plain-language prompts
   - Good default values
   - Successfully integrated into ChartWizard
   - Ready to extract

3. **Component Architecture**
   - Configurators are self-contained
   - Clear prop interfaces
   - Reusable across contexts
   - Dialog-based for flexibility

### What Needs Improvement ⚠️

1. **Discoverability**
   - Orphaned components hidden from users
   - No central registry
   - Inconsistent integration

2. **Consistency**
   - Three different chart builders
   - Different feature sets
   - Inconsistent UX patterns

3. **Documentation**
   - No inventory of available configurators
   - No integration guides
   - No decision records

### Architecture Lessons 📚

1. **Specialized configurators work**
   - Domain-specific UI is valuable
   - Users need guidance for complex charts
   - Visual preview is essential

2. **Integration is key**
   - Beautiful components are useless if not integrated
   - Need clear injection points
   - Registry pattern would help

3. **Progressive disclosure**
   - Basic config should be simple
   - Advanced options behind accordion
   - Chart-specific configs conditional

---

## 7. Files Reference

### Active Configurators
```
✅ src/components/charts/SPCWizardConfig.tsx (336 lines)
✅ src/components/charts/DeviationConfigurator.tsx (606 lines)
🟡 src/components/charts/MissingDataConfigurator.tsx (229 lines)
🟡 src/components/charts/UnitConfigurator.tsx (210 lines)
```

### Chart Builders
```
✅ src/components/charts/EnhancedChartBuilder.tsx (870 lines)
✅ src/components/monitors/ChartWizard.tsx (2000+ lines)
✅ src/components/charts/wizard/EnhancedChartWizard.tsx (780 lines)
✅ src/components/dashboard/QuickChartConfig.tsx (272 lines)
```

### Specialized Wizards
```
✅ src/components/charts/DeviationHeatmapWizard.tsx (344 lines)
```

### Supporting Components
```
✅ src/components/charts/ConfigPreview.tsx (280 lines)
✅ src/components/charts/ChartPreview.tsx
✅ src/components/common/UnifiedPointSelector.tsx
```

---

## Conclusion

The Building Vitals codebase has **excellent specialized configurator components** that are largely **orphaned and not integrated into the main workflows**.

**Critical Action Required:**
1. Integrate MissingDataConfigurator and UnitConfigurator (8 hours total)
2. Migrate SPCWizardConfig from legacy ChartWizard (4 hours)
3. Standardize configurator pattern for future additions (8 hours)

**Total Effort for Full Integration:** 20 hours (2.5 days)

**Impact:**
- Users gain access to hidden functionality
- Chart configuration becomes more powerful
- Reduced confusion from multiple systems
- Foundation for future configurators

**Next Steps:**
1. Review this inventory with team
2. Prioritize quick win integrations
3. Create configurator pattern RFC
4. Begin Phase 1 implementation

---

**End of Report**
Generated: 2025-10-16
Analyst: Research Agent (Claude Code)
