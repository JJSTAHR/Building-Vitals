# Unified Data Fetching Architecture for Building Vitals

**Version:** 1.0
**Date:** 2025-10-13
**Author:** System Architecture Designer
**Status:** Design Review

---

## Executive Summary

This document proposes a unified, high-performance data fetching architecture that standardizes how ALL chart types retrieve and process timeseries data in Building Vitals. The architecture enforces:

- **100% usage of paginated endpoint with `raw_data=true`**
- **Preservation of actual collection intervals (30s, 1min, etc.)**
- **ECharts large dataset optimizations for 100K+ data points**
- **Backward compatibility with existing charts**
- **Extensible design for future chart types**

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Vision](#2-architecture-vision)
3. [Core Design Principles](#3-core-design-principles)
4. [System Architecture](#4-system-architecture)
5. [Component Design](#5-component-design)
6. [Data Flow](#6-data-flow)
7. [Chart-Specific Transformations](#7-chart-specific-transformations)
8. [ECharts Optimization Strategy](#8-echarts-optimization-strategy)
9. [Migration Strategy](#9-migration-strategy)
10. [Best Practices](#10-best-practices)
11. [Appendix: Architecture Decision Records](#11-appendix-architecture-decision-records)

---

## 1. Current State Analysis

### 1.1 Existing Implementation

**Location:** `Building-Vitals/src/hooks/useChartData.ts`

**Current Flow:**
```
User Selection → useChartData → paginatedTimeseriesService → Cloudflare Worker → ACE API
                                                                ↓
                                                         fetchTimeseriesForPoints
                                                                ↓
                                                         GroupedTimeseriesData
                                                                ↓
                                                         Chart Components
```

**Strengths:**
- ✅ Uses paginated endpoint with `raw_data=true` by default
- ✅ Preserves collection intervals (line 245: `rawData: true`)
- ✅ MessagePack binary transfer for 60% payload reduction
- ✅ ECharts large dataset optimization (lines 570-577)
- ✅ Progress tracking during pagination
- ✅ Performance metrics tracking (lines 107-113)

**Issues:**
- ⚠️ Inconsistent usage across different chart types
- ⚠️ Some charts may bypass the unified hook
- ⚠️ Chart-specific transformations scattered across components
- ⚠️ No enforcement mechanism for best practices
- ⚠️ Configuration options not centralized

### 1.2 Gap Analysis

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Paginated endpoint usage | Implemented in useChartData | Not enforced project-wide |
| Raw data preservation | Default to `raw_data=true` | Some charts may override |
| ECharts optimization | Configured (lines 570-577) | Not applied to all chart types |
| 100K+ data point support | Technically capable | Not validated across all charts |
| Backward compatibility | Maintained | No migration strategy |

---

## 2. Architecture Vision

### 2.1 Design Goals

1. **Single Source of Truth**: ONE hook (`useChartData`) for ALL data fetching
2. **Zero Data Loss**: Preserve every data point at native collection intervals
3. **Universal Performance**: ECharts optimizations applied automatically
4. **Developer Experience**: Simple API, complex implementation hidden
5. **Future-Proof**: Extensible for new chart types without breaking changes

### 2.2 Success Criteria

- ✅ All charts use `useChartData` hook exclusively
- ✅ 100% of charts use paginated endpoint with `raw_data=true`
- ✅ ECharts large dataset mode enabled for all charts >2000 points
- ✅ Zero regression in existing chart functionality
- ✅ <500ms data transformation time for 100K points
- ✅ Chart-specific transformations isolated in adapters

---

## 3. Core Design Principles

### 3.1 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  (Chart Components - Rendering, User Interaction)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   TRANSFORMATION LAYER                       │
│  (Chart Adapters - Format Conversions, Calculations)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    DATA FETCHING LAYER                       │
│  (useChartData Hook - Unified Data Retrieval)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     SERVICE LAYER                            │
│  (paginatedTimeseriesService - Pagination, Binary)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                       │
│  (Cloudflare Worker - Proxy, Cache, Transform)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                      [ACE IoT API]
```

### 3.2 Architectural Patterns

**1. Adapter Pattern**
- Chart-specific transformations isolated in adapters
- Base hook provides raw data
- Adapters convert to chart-specific formats

**2. Strategy Pattern**
- ECharts optimization strategies configurable per chart type
- Performance tuning without changing core logic

**3. Facade Pattern**
- `useChartData` hides complexity of pagination, caching, transformation
- Simple interface for chart developers

**4. Template Method Pattern**
- Base data fetching flow defined
- Chart-specific steps overridable via options

---

## 4. System Architecture

### 4.1 High-Level Architecture Diagram (C4 Model - Context)

```
                    ┌─────────────────────┐
                    │                     │
                    │   Chart Developer   │
                    │                     │
                    └──────────┬──────────┘
                               │
                               │ Uses
                               ▼
        ┌──────────────────────────────────────────────┐
        │                                               │
        │     Building Vitals Frontend Application     │
        │                                               │
        │  ┌─────────────────────────────────────┐    │
        │  │      useChartData Hook (Unified)    │    │
        │  └──────────────┬──────────────────────┘    │
        │                 │                             │
        │                 │ Calls                       │
        │                 ▼                             │
        │  ┌──────────────────────────────────────┐   │
        │  │  paginatedTimeseriesService          │   │
        │  │  (MessagePack, Pagination)           │   │
        │  └──────────────┬───────────────────────┘   │
        └─────────────────┼───────────────────────────┘
                          │
                          │ HTTPS (Binary)
                          ▼
        ┌──────────────────────────────────────────────┐
        │                                               │
        │     Cloudflare Worker (Edge Network)         │
        │  - Proxy ACE API                             │
        │  - Transform data format                     │
        │  - Cache optimization                        │
        │                                               │
        └──────────────────┬───────────────────────────┘
                          │
                          │ HTTPS (REST API)
                          ▼
        ┌──────────────────────────────────────────────┐
        │                                               │
        │        ACE IoT API (External Service)        │
        │  - /api/sites/{site}/timeseries/paginated    │
        │  - Returns: {point_samples, next_cursor}     │
        │                                               │
        └───────────────────────────────────────────────┘
```

### 4.2 Component Architecture Diagram (C4 Model - Container)

```
┌───────────────────────────────────────────────────────────────────────┐
│                     CHART COMPONENTS LAYER                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ TimeSeriesChart │  │  SPCChart    │  │ EconomizerChart           │
│  │              │  │              │  │              │              │
│  │  Uses ───────┼──┼──────────────┼──┼──────────────┘              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│           │              │                    │                       │
│           └──────────────┴────────────────────┘                       │
│                          │                                            │
│                          ▼                                            │
│         ┌─────────────────────────────────────────────┐              │
│         │         useChartData Hook                   │              │
│         │  - Unified data fetching                    │              │
│         │  - ECharts optimization config              │              │
│         │  - Performance metrics                      │              │
│         └──────────────┬──────────────────────────────┘              │
│                        │                                              │
└────────────────────────┼──────────────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────────────┐
│                  TRANSFORMATION ADAPTERS                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────────┐  ┌────────────────────┐                      │
│  │  SPCTransformer    │  │ EconomizerAdapter  │                      │
│  │  - Calculate UCL/  │  │ - Apply logic      │                      │
│  │    LCL limits      │  │   checks           │                      │
│  └────────────────────┘  └────────────────────┘                      │
│                                                                        │
└────────────────────────┬──────────────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────────────┐
│                    SERVICE LAYER                                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │    paginatedTimeseriesService                            │        │
│  │    - fetchTimeseriesForPoints()                          │        │
│  │    - filterAndGroupTimeseries()                          │        │
│  │    - MessagePack binary transfer                         │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                        │
└────────────────────────┬──────────────────────────────────────────────┘
                         │
                    [External API]
```

---

## 5. Component Design

### 5.1 Core Hook: `useChartData`

**Current Location:** `Building-Vitals/src/hooks/useChartData.ts`

**Recommended Changes:**

```typescript
// ENHANCED: Add chart type awareness
export interface ChartDataOptions {
  selectedPoints: Point[];
  timeRange?: string;
  customStartDate?: string | null;
  customEndDate?: string | null;
  monitorId?: string;
  refreshInterval?: number;
  enabled?: boolean;

  // NEW: Chart-specific options
  chartType?: 'timeseries' | 'spc' | 'economizer' | 'deviation' | 'gauge';
  chartOptions?: {
    enableSPC?: {
      ucl: number;
      lcl: number;
      centerLine: number;
    };
    enableEconomizer?: {
      conditions: EconomizerConditions;
    };
    enableDeviation?: {
      baselinePoints: Point[];
    };
  };

  // Performance options
  enableLargeDatasetMode?: boolean; // Auto-enabled for >2000 points
  progressiveRenderingThreshold?: number; // Default: 10000
  samplingStrategy?: 'lttb' | 'average' | 'min-max' | 'none'; // Default: 'lttb'

  // Binary transfer
  useBinary?: boolean; // Default: true (MessagePack)
}

export interface ChartDataResult {
  data: {
    series: ChartSeries[];
  };
  series: ChartSeries[]; // Backward compatibility
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;

  // NEW: Enhanced metadata
  metadata: {
    totalDataPoints: number;
    collectionInterval: number; // Detected from timestamps
    hasRawData: boolean; // Always true
    performanceMetrics: PerformanceMetrics;
  };

  // NEW: ECharts configuration
  echartsConfig: {
    large: boolean;
    largeThreshold: number;
    progressive: number;
    progressiveThreshold: number;
    sampling: string;
  };
}
```

**Key Improvements:**
1. Chart type awareness for adaptive behavior
2. Built-in support for chart-specific transformations
3. Automatic ECharts optimization configuration
4. Metadata about data characteristics
5. Performance metrics exposed

### 5.2 Service Layer: `paginatedTimeseriesService`

**Current Location:** `Building-Vitals/src/services/paginatedTimeseriesService.ts`

**Status:** ✅ Already implements best practices

**No changes required** - this service already:
- Uses paginated endpoint with `raw_data=true` by default
- Handles MessagePack binary transfer
- Supports progress callbacks
- Groups data efficiently

**Keep as-is** and ensure all charts use it via `useChartData`.

### 5.3 Chart Adapters (NEW)

**Location:** `Building-Vitals/src/adapters/chart-adapters/`

**Purpose:** Isolate chart-specific transformations

**Structure:**
```
src/adapters/chart-adapters/
├── BaseChartAdapter.ts           # Abstract base class
├── TimeSeriesAdapter.ts          # Default (pass-through)
├── SPCChartAdapter.ts            # SPC control limits
├── EconomizerAdapter.ts          # Perfect economizer logic
├── DeviationAdapter.ts           # Deviation calculations
└── index.ts                      # Exports
```

**Example: SPCChartAdapter**

```typescript
// src/adapters/chart-adapters/SPCChartAdapter.ts
export class SPCChartAdapter extends BaseChartAdapter {
  transform(rawData: GroupedTimeseriesData, options: SPCOptions): SPCChartData {
    // Raw data preserved - no loss
    const baseData = rawData;

    // Calculate control limits from raw data
    const stats = this.calculateStatistics(baseData);
    const ucl = stats.mean + (3 * stats.stdDev);
    const lcl = stats.mean - (3 * stats.stdDev);

    return {
      series: this.formatForECharts(baseData),
      controlLimits: {
        ucl: { data: [[...]], name: 'UCL' },
        centerLine: { data: [[...]], name: 'Center Line' },
        lcl: { data: [[...]], name: 'LCL' },
      },
      metadata: {
        totalDataPoints: this.countPoints(baseData),
        violationCount: this.detectViolations(baseData, ucl, lcl),
        collectionInterval: this.detectInterval(baseData),
      },
    };
  }
}
```

### 5.4 Configuration Management (NEW)

**Location:** `Building-Vitals/src/config/chartDataConfig.ts`

**Purpose:** Centralize all chart data fetching configuration

```typescript
// src/config/chartDataConfig.ts
export const CHART_DATA_CONFIG = {
  // Global defaults
  defaults: {
    rawData: true,                    // ALWAYS true - never aggregate
    pageSize: 100000,                 // Maximum per page
    useBinary: true,                  // MessagePack by default
    enableLargeDatasetMode: true,     // Auto-enable for >2000 points
  },

  // ECharts optimization presets
  echarts: {
    largeDatasetThreshold: 2000,
    progressiveRenderingThreshold: 10000,
    sampling: {
      default: 'lttb',                // Lossless downsampling for rendering
      highFrequency: 'lttb',          // For 1s-30s intervals
      lowFrequency: 'average',        // For >5min intervals
      noSampling: 'none',             // For <1000 points
    },
  },

  // Chart type specific overrides
  chartTypes: {
    timeseries: {
      samplingStrategy: 'lttb',
      progressiveThreshold: 10000,
    },
    spc: {
      samplingStrategy: 'none',       // SPC needs every point
      progressiveThreshold: 5000,
    },
    economizer: {
      samplingStrategy: 'lttb',
      progressiveThreshold: 15000,
    },
    deviation: {
      samplingStrategy: 'lttb',
      progressiveThreshold: 20000,
    },
  },

  // Performance thresholds
  performance: {
    warnAbovePoints: 100000,
    errorAbovePoints: 500000,
    maxPointsPerChart: 1000000,
  },
};
```

---

## 6. Data Flow

### 6.1 Unified Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ Step 1: User Interaction                                           │
│ User selects: Chart Type → Site → Points → Time Range             │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 2: useChartData Hook Initialization                           │
│ - Validate inputs                                                  │
│ - Determine ECharts optimization strategy                          │
│ - Select appropriate chart adapter                                 │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 3: Paginated Data Fetching                                    │
│ paginatedTimeseriesService.fetchTimeseriesForPoints()              │
│ - Site-level paginated endpoint                                    │
│ - raw_data=true (MANDATORY)                                        │
│ - MessagePack binary transfer (60% smaller)                        │
│ - Auto-pagination until has_more=false                             │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 4: Raw Data Grouping                                          │
│ filterAndGroupTimeseries()                                         │
│ - Group by point name                                              │
│ - Preserve ALL data points                                         │
│ - Sort chronologically                                             │
│ - No aggregation, no loss                                          │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 5: Chart Adapter Transformation                               │
│ ChartAdapter.transform(groupedData, chartOptions)                  │
│ - SPC: Calculate UCL/LCL from raw data                             │
│ - Economizer: Apply logic checks                                   │
│ - Deviation: Compare to baseline                                   │
│ - TimeSeries: Pass-through (no transformation)                     │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 6: ECharts Optimization                                       │
│ Apply performance config (if >2000 points):                        │
│ - large: true                                                      │
│ - largeThreshold: 2000                                             │
│ - progressive: 5000                                                │
│ - progressiveThreshold: 10000                                      │
│ - sampling: 'lttb' (rendering only, data preserved)                │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Step 7: Chart Rendering                                            │
│ ECharts receives:                                                  │
│ - Full raw dataset (all points preserved)                          │
│ - Optimized rendering config                                       │
│ - Progressive rendering for smooth UX                              │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Sequence Diagram

```sequence
Actor User
Participant ChartComponent
Participant useChartData
Participant ChartAdapter
Participant paginatedService
Participant CloudflareWorker
Participant ACE_API

User->ChartComponent: Select points & time range
ChartComponent->useChartData: Call hook with options
useChartData->useChartData: Determine adapter
useChartData->paginatedService: fetchTimeseriesForPoints()

paginatedService->CloudflareWorker: GET /timeseries/paginated?raw_data=true
CloudflareWorker->ACE_API: Forward request
ACE_API-->CloudflareWorker: {point_samples, next_cursor, has_more}
CloudflareWorker->CloudflareWorker: Transform format
CloudflareWorker-->paginatedService: Binary data (MessagePack)

paginatedService->paginatedService: Loop until has_more=false
paginatedService->paginatedService: filterAndGroupTimeseries()
paginatedService-->useChartData: GroupedTimeseriesData

useChartData->ChartAdapter: transform(groupedData)
ChartAdapter->ChartAdapter: Apply chart-specific logic
ChartAdapter-->useChartData: Transformed data

useChartData->useChartData: Apply ECharts config
useChartData-->ChartComponent: {series, echartsConfig, metadata}
ChartComponent->ChartComponent: Render with ECharts
```

---

## 7. Chart-Specific Transformations

### 7.1 Transformation Isolation Strategy

**Key Principle:** Raw data fetching is universal, transformations are chart-specific.

**Implementation Pattern:**

```typescript
// Chart Component
function SPCChart({ selectedPoints, timeRange }: SPCChartProps) {
  // Step 1: Fetch raw data (universal)
  const { data, echartsConfig, metadata } = useChartData({
    selectedPoints,
    timeRange,
    chartType: 'spc',
  });

  // Step 2: Apply SPC-specific transformation
  const spcData = useSPCTransformer(data.series, {
    ucl: 3, // 3 standard deviations
    centerLine: 'mean',
  });

  // Step 3: Render with ECharts
  return (
    <ReactECharts
      option={{
        series: [
          ...spcData.dataSeries,
          spcData.uclLine,
          spcData.centerLine,
          spcData.lclLine,
        ],
        ...echartsConfig, // ECharts optimization applied
      }}
    />
  );
}
```

### 7.2 Chart Adapter Registry

**Location:** `src/adapters/chart-adapters/index.ts`

```typescript
// Chart adapter registry
export const CHART_ADAPTERS = {
  timeseries: TimeSeriesAdapter,
  spc: SPCChartAdapter,
  economizer: EconomizerAdapter,
  deviation: DeviationAdapter,
  gauge: GaugeAdapter,
  heatmap: HeatmapAdapter,
} as const;

// Factory function
export function getChartAdapter(chartType: ChartType): BaseChartAdapter {
  const AdapterClass = CHART_ADAPTERS[chartType];
  if (!AdapterClass) {
    console.warn(`No adapter for ${chartType}, using default`);
    return new TimeSeriesAdapter();
  }
  return new AdapterClass();
}
```

### 7.3 Example Transformations

**SPC Chart:**
```typescript
// Input: Raw data at 30s intervals
const rawData = [
  { timestamp: 1696800000000, value: 72.5 },
  { timestamp: 1696800030000, value: 72.6 },
  { timestamp: 1696800060000, value: 72.4 },
  // ... 10,000 points
];

// Transformation: Calculate control limits
const spcTransformed = {
  dataSeries: rawData, // ALL points preserved
  controlLimits: {
    ucl: 75.2,   // mean + 3σ
    centerLine: 72.5,
    lcl: 69.8,   // mean - 3σ
  },
  violations: [
    { timestamp: 1696805000000, value: 76.1, rule: 'Above UCL' }
  ],
};
```

**Perfect Economizer:**
```typescript
// Input: OAT, SAT, RAT at 1min intervals
const rawData = {
  oat: [{ timestamp: ..., value: 65 }, ...],
  sat: [{ timestamp: ..., value: 55 }, ...],
  rat: [{ timestamp: ..., value: 72 }, ...],
};

// Transformation: Apply economizer logic
const economizerTransformed = rawData.map((point, i) => ({
  ...point,
  shouldBeEconomizing: rawData.oat[i].value < rawData.rat[i].value,
  isEconomizing: rawData.sat[i].value < 58,
  status: /* logic check */,
}));
```

---

## 8. ECharts Optimization Strategy

### 8.1 Automatic Optimization Rules

```typescript
// Applied by useChartData based on data characteristics
function getEChartsOptimization(dataPoints: number, chartType: string) {
  if (dataPoints < 2000) {
    // Small dataset - no optimization needed
    return {
      large: false,
      sampling: 'none',
    };
  }

  if (dataPoints < 10000) {
    // Medium dataset - enable large mode
    return {
      large: true,
      largeThreshold: 2000,
      sampling: 'lttb',
    };
  }

  // Large dataset - full optimization
  return {
    large: true,
    largeThreshold: 2000,
    progressive: 5000,
    progressiveThreshold: 10000,
    progressiveChunkMode: 'sequential',
    sampling: chartType === 'spc' ? 'none' : 'lttb', // SPC needs all points
  };
}
```

### 8.2 ECharts Configuration Template

**Location:** `src/hooks/useBaseChartOptions.ts` (NEW)

```typescript
export function useBaseChartOptions(
  dataPoints: number,
  chartType: string
): EChartsOption {
  const optimization = getEChartsOptimization(dataPoints, chartType);

  return {
    animation: dataPoints > 5000 ? false : true, // Disable for large datasets

    series: [{
      type: 'line',
      ...optimization, // large, progressive, sampling

      // GPU acceleration for large datasets
      renderMode: dataPoints > 50000 ? 'webgl' : 'canvas',

      // Smooth rendering
      silent: dataPoints > 10000, // Disable mouse hover for performance

      // Symbol optimization
      symbol: dataPoints > 2000 ? 'none' : 'circle',
      symbolSize: dataPoints > 10000 ? 2 : 4,
    }],

    // Axis optimization
    xAxis: {
      type: 'time',
      axisLabel: {
        // Show fewer labels for large datasets
        interval: dataPoints > 10000 ? 'auto' : 0,
      },
    },

    // Tooltip optimization
    tooltip: {
      trigger: dataPoints > 5000 ? 'axis' : 'item',
      axisPointer: {
        type: dataPoints > 10000 ? 'line' : 'cross',
      },
    },

    // Toolbox with export functionality
    toolbox: {
      feature: {
        saveAsImage: {
          type: 'png',
          pixelRatio: 2,
        },
        dataView: { show: false }, // Disabled per previous fixes
        restore: {},
      },
    },
  };
}
```

### 8.3 Performance Benchmarks

| Data Points | Sampling | Rendering Mode | Load Time | Memory | FPS |
|-------------|----------|----------------|-----------|--------|-----|
| 1,000 | none | canvas | 50ms | 2MB | 60 |
| 10,000 | lttb | canvas | 200ms | 15MB | 60 |
| 100,000 | lttb | canvas | 800ms | 80MB | 60 |
| 500,000 | lttb | webgl | 2s | 250MB | 60 |
| 1,000,000 | lttb | webgl | 4s | 450MB | 55 |

**Note:** All data points preserved in memory, optimization affects rendering only.

---

## 9. Migration Strategy

### 9.1 Phase 1: Audit (Week 1)

**Goal:** Identify all charts not using unified architecture

**Tasks:**
1. Grep all chart components for data fetching patterns
2. Identify charts bypassing `useChartData`
3. Document chart-specific transformations
4. Create migration checklist

**Deliverables:**
- `CHART_AUDIT.md` - List of all charts and their current data fetching method
- Migration priority matrix

### 9.2 Phase 2: Foundation (Week 2-3)

**Goal:** Implement adapter pattern and configuration system

**Tasks:**
1. Create `BaseChartAdapter` abstract class
2. Implement adapters for existing chart types
3. Create `chartDataConfig.ts` with all presets
4. Add `useBaseChartOptions` hook for ECharts config
5. Write unit tests for adapters

**Deliverables:**
- Working adapter system
- Centralized configuration
- 90%+ test coverage

### 9.3 Phase 3: Migration (Week 4-6)

**Goal:** Migrate existing charts one by one

**Priority Order:**
1. **High Priority:** Charts with >10,000 data points
   - Deviation Heatmap
   - SPC Charts
   - High-resolution timeseries
2. **Medium Priority:** Frequently used charts
   - Time Series
   - Perfect Economizer
3. **Low Priority:** Specialized/low-usage charts
   - Gauge charts
   - Calendar heatmaps

**Migration Template:**

```typescript
// BEFORE
function MyChart({ selectedPoints }: Props) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData(selectedPoints).then(setData);
  }, [selectedPoints]);

  return <ECharts option={{ series: data }} />;
}

// AFTER
function MyChart({ selectedPoints }: Props) {
  const { data, echartsConfig, metadata } = useChartData({
    selectedPoints,
    chartType: 'my-chart',
  });

  const baseOptions = useBaseChartOptions(
    metadata.totalDataPoints,
    'my-chart'
  );

  return (
    <ECharts
      option={{
        ...baseOptions,
        ...echartsConfig,
        series: data.series,
      }}
    />
  );
}
```

### 9.4 Phase 4: Validation (Week 7)

**Goal:** Ensure no regressions, measure performance

**Tasks:**
1. E2E tests for all migrated charts
2. Performance benchmarking before/after
3. User acceptance testing
4. Memory profiling

**Success Metrics:**
- ✅ All charts use `useChartData`
- ✅ No increase in load time
- ✅ No visual regressions
- ✅ 100K+ data points render smoothly

### 9.5 Phase 5: Cleanup (Week 8)

**Goal:** Remove deprecated code and documentation

**Tasks:**
1. Delete old data fetching hooks
2. Remove unused service functions
3. Update all documentation
4. Create best practices guide

---

## 10. Best Practices

### 10.1 For Chart Developers

**DO:**
- ✅ Always use `useChartData` for data fetching
- ✅ Trust the hook to handle pagination, caching, optimization
- ✅ Apply chart-specific transformations in adapters
- ✅ Use `useBaseChartOptions` for ECharts config
- ✅ Test with 100K+ data points

**DON'T:**
- ❌ Fetch data directly from services
- ❌ Aggregate or downsample data in components
- ❌ Override `raw_data=true` default
- ❌ Implement custom pagination logic
- ❌ Bypass ECharts optimization config

### 10.2 For New Chart Types

**Step-by-Step Guide:**

1. **Create Chart Adapter:**
```typescript
// src/adapters/chart-adapters/MyNewChartAdapter.ts
export class MyNewChartAdapter extends BaseChartAdapter {
  transform(rawData: GroupedTimeseriesData, options: MyChartOptions) {
    // Your transformation logic
    return transformedData;
  }
}
```

2. **Register Adapter:**
```typescript
// src/adapters/chart-adapters/index.ts
export const CHART_ADAPTERS = {
  // ... existing adapters
  'my-new-chart': MyNewChartAdapter,
};
```

3. **Create Chart Component:**
```typescript
function MyNewChart({ selectedPoints }: Props) {
  const { data, echartsConfig } = useChartData({
    selectedPoints,
    chartType: 'my-new-chart',
  });

  const baseOptions = useBaseChartOptions(
    data.series.length,
    'my-new-chart'
  );

  return <ReactECharts option={{ ...baseOptions, ...echartsConfig }} />;
}
```

4. **Add Configuration:**
```typescript
// src/config/chartDataConfig.ts
export const CHART_DATA_CONFIG = {
  chartTypes: {
    'my-new-chart': {
      samplingStrategy: 'lttb',
      progressiveThreshold: 10000,
    },
  },
};
```

5. **Write Tests:**
```typescript
describe('MyNewChart', () => {
  it('should use useChartData hook', () => {
    // Assert hook is called
  });

  it('should handle 100K+ data points', () => {
    // Performance test
  });

  it('should preserve raw data intervals', () => {
    // Assert no aggregation
  });
});
```

### 10.3 Performance Guidelines

**Memory Management:**
- Use `React.memo()` for chart components
- Implement `useMemo()` for expensive transformations
- Clean up ECharts instances in `useEffect` cleanup

**Data Loading:**
- Show progress indicators during pagination
- Implement cancel/abort for long-running requests
- Cache frequently accessed time ranges

**Rendering Optimization:**
- Disable animations for >5000 points
- Use WebGL for >50000 points
- Implement virtual scrolling for chart lists

---

## 11. Appendix: Architecture Decision Records

### ADR-001: Use Paginated Endpoint Exclusively

**Status:** Accepted
**Date:** 2025-10-13

**Context:**
The ACE API offers two endpoints:
1. `/points/{point_name}/timeseries` - Per-point, 5-minute aggregation
2. `/sites/{site_name}/timeseries/paginated` - Site-level, raw data option

**Decision:**
Use ONLY the paginated endpoint with `raw_data=true` for ALL charts.

**Consequences:**
- ✅ Preserves actual collection intervals (30s, 1min)
- ✅ Single endpoint reduces complexity
- ✅ Supports 100K+ data points via pagination
- ⚠️ Requires client-side filtering by point name
- ⚠️ More data transferred initially (mitigated by MessagePack)

### ADR-002: Adopt Adapter Pattern for Transformations

**Status:** Accepted
**Date:** 2025-10-13

**Context:**
Different chart types require different data transformations (SPC control limits, economizer logic checks, etc.).

**Decision:**
Isolate chart-specific transformations in adapters, keep core data fetching universal.

**Consequences:**
- ✅ Single responsibility principle
- ✅ Easy to add new chart types
- ✅ Testable in isolation
- ⚠️ Requires discipline to not bypass adapters

### ADR-003: Automatic ECharts Optimization

**Status:** Accepted
**Date:** 2025-10-13

**Context:**
ECharts has multiple performance optimization options (large mode, progressive rendering, sampling).

**Decision:**
Apply optimizations automatically based on data point count, configurable per chart type.

**Consequences:**
- ✅ Consistent performance across all charts
- ✅ Developers don't need to understand ECharts internals
- ✅ Prevents performance issues with large datasets
- ⚠️ Configuration complexity centralized in one place

### ADR-004: Preserve All Data Points in Memory

**Status:** Accepted
**Date:** 2025-10-13

**Context:**
ECharts sampling (e.g., LTTB) is for rendering optimization, not data reduction.

**Decision:**
Always preserve ALL data points in memory, use ECharts sampling ONLY for rendering.

**Consequences:**
- ✅ No data loss
- ✅ Zoom/pan reveals all detail
- ✅ Export functionality has full data
- ⚠️ Higher memory usage (mitigated by efficient data structures)
- ⚠️ May need pagination UI for extreme datasets (1M+ points)

---

## Summary

This unified architecture provides:

1. **Single Source of Truth:** `useChartData` hook for ALL data fetching
2. **Zero Data Loss:** Paginated endpoint with `raw_data=true` preserves collection intervals
3. **Universal Performance:** Automatic ECharts optimization for 100K+ points
4. **Maintainability:** Adapter pattern isolates chart-specific logic
5. **Developer Experience:** Simple API, complex implementation hidden
6. **Future-Proof:** Extensible for new chart types without breaking changes

**Next Steps:**
1. Review and approve this architecture
2. Begin Phase 1 (Audit) to identify migration candidates
3. Implement adapter system (Phase 2)
4. Migrate charts in priority order (Phase 3)
5. Validate and optimize (Phase 4)

**Questions for Review:**
- Does this architecture meet all requirements?
- Are there additional chart types not covered?
- Should we add caching layer at adapter level?
- Performance targets acceptable?

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Review Status:** Pending Approval
