# Chart Adapter Specification

**Version:** 1.0
**Date:** 2025-10-13
**Purpose:** Technical specification for implementing chart adapters in Building Vitals

---

## Overview

Chart adapters provide a standardized interface for transforming raw timeseries data into chart-specific formats. This document specifies the adapter pattern implementation, interfaces, and best practices.

---

## Adapter Interface

### Base Adapter

```typescript
// src/adapters/chart-adapters/BaseChartAdapter.ts

export interface ChartDataInput {
  // Raw grouped timeseries data from paginatedTimeseriesService
  groupedData: GroupedTimeseriesData;

  // Selected points with metadata
  selectedPoints: Point[];

  // Time range information
  timeRange: {
    startTime: string;
    endTime: string;
  };

  // Chart-specific options
  options?: Record<string, any>;
}

export interface ChartDataOutput {
  // Transformed series data for ECharts
  series: SeriesData[];

  // Optional: Additional series (e.g., control limits, reference lines)
  additionalSeries?: SeriesData[];

  // Metadata about the transformation
  metadata: {
    totalDataPoints: number;
    collectionInterval: number; // in milliseconds
    transformationType: string;
    warnings?: string[];
  };

  // Chart-specific data (e.g., violations, status indicators)
  chartSpecificData?: Record<string, any>;
}

export abstract class BaseChartAdapter {
  /**
   * Transform raw data to chart-specific format
   */
  abstract transform(input: ChartDataInput): ChartDataOutput;

  /**
   * Validate input data before transformation
   */
  protected validate(input: ChartDataInput): ValidationResult {
    // Common validation logic
    const errors: string[] = [];

    if (!input.groupedData || Object.keys(input.groupedData).length === 0) {
      errors.push('Grouped data is empty');
    }

    if (!input.selectedPoints || input.selectedPoints.length === 0) {
      errors.push('No points selected');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect collection interval from timestamps
   */
  protected detectInterval(data: TimeseriesDataPoint[]): number {
    if (data.length < 2) return 0;

    // Calculate median interval between consecutive points
    const intervals = [];
    for (let i = 1; i < Math.min(100, data.length); i++) {
      intervals.push(data[i].timestamp - data[i - 1].timestamp);
    }

    intervals.sort((a, b) => a - b);
    return intervals[Math.floor(intervals.length / 2)];
  }

  /**
   * Count total data points across all series
   */
  protected countPoints(groupedData: GroupedTimeseriesData): number {
    return Object.values(groupedData).reduce(
      (sum, points) => sum + points.length,
      0
    );
  }

  /**
   * Format series for ECharts
   */
  protected formatForECharts(
    pointName: string,
    data: TimeseriesDataPoint[],
    options?: Partial<SeriesOption>
  ): SeriesData {
    return {
      name: pointName,
      type: 'line',
      data: data.map(d => [d.timestamp, d.value]),
      ...options,
    };
  }
}
```

---

## Adapter Implementations

### 1. Time Series Adapter (Default)

```typescript
// src/adapters/chart-adapters/TimeSeriesAdapter.ts

export class TimeSeriesAdapter extends BaseChartAdapter {
  transform(input: ChartDataInput): ChartDataOutput {
    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { groupedData, selectedPoints } = input;

    // Pass-through transformation (no modification)
    const series = Object.entries(groupedData).map(([pointName, data]) => {
      const point = selectedPoints.find(p => p.Name === pointName);

      return this.formatForECharts(pointName, data, {
        smooth: false, // Preserve raw data points
        symbol: data.length > 2000 ? 'none' : 'circle',
        symbolSize: 4,
      });
    });

    return {
      series,
      metadata: {
        totalDataPoints: this.countPoints(groupedData),
        collectionInterval: this.detectInterval(Object.values(groupedData)[0]),
        transformationType: 'pass-through',
      },
    };
  }
}
```

### 2. SPC Chart Adapter

```typescript
// src/adapters/chart-adapters/SPCChartAdapter.ts

export interface SPCOptions {
  // Number of standard deviations for control limits
  sigmaMultiplier?: number; // Default: 3

  // Center line calculation method
  centerLineMethod?: 'mean' | 'median' | 'target';
  targetValue?: number; // Required if centerLineMethod='target'

  // Violation detection rules
  detectViolations?: boolean;
  violationRules?: {
    beyondLimits?: boolean;     // Point beyond UCL/LCL
    zone?: boolean;              // 2 of 3 points in Zone A
    trend?: boolean;             // 6+ points trending up/down
    alternating?: boolean;       // 14+ points alternating
  };
}

export class SPCChartAdapter extends BaseChartAdapter {
  transform(input: ChartDataInput): ChartDataOutput {
    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const options: SPCOptions = {
      sigmaMultiplier: 3,
      centerLineMethod: 'mean',
      detectViolations: true,
      violationRules: {
        beyondLimits: true,
        zone: true,
        trend: true,
        alternating: true,
      },
      ...input.options,
    };

    const { groupedData, selectedPoints } = input;
    const series: SeriesData[] = [];
    const additionalSeries: SeriesData[] = [];
    const violations: Violation[] = [];

    // Process each point
    Object.entries(groupedData).forEach(([pointName, data]) => {
      // Calculate statistics
      const stats = this.calculateStatistics(data);

      // Determine center line
      const centerLine = options.centerLineMethod === 'target'
        ? options.targetValue!
        : options.centerLineMethod === 'median'
        ? stats.median
        : stats.mean;

      // Calculate control limits
      const ucl = centerLine + (options.sigmaMultiplier! * stats.stdDev);
      const lcl = centerLine - (options.sigmaMultiplier! * stats.stdDev);

      // Data series
      series.push(this.formatForECharts(pointName, data, {
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: {
          color: (params: any) => {
            const value = params.value[1];
            return value > ucl || value < lcl ? '#ff4444' : '#4CAF50';
          },
        },
      }));

      // Control limit lines
      const timestamps = data.map(d => d.timestamp);

      additionalSeries.push({
        name: 'UCL',
        type: 'line',
        data: timestamps.map(t => [t, ucl]),
        lineStyle: { color: '#ff4444', type: 'dashed' },
        symbol: 'none',
      });

      additionalSeries.push({
        name: 'Center Line',
        type: 'line',
        data: timestamps.map(t => [t, centerLine]),
        lineStyle: { color: '#2196F3', type: 'solid' },
        symbol: 'none',
      });

      additionalSeries.push({
        name: 'LCL',
        type: 'line',
        data: timestamps.map(t => [t, lcl]),
        lineStyle: { color: '#ff4444', type: 'dashed' },
        symbol: 'none',
      });

      // Detect violations
      if (options.detectViolations) {
        violations.push(...this.detectViolations(data, ucl, lcl, centerLine, options.violationRules!));
      }
    });

    return {
      series,
      additionalSeries,
      metadata: {
        totalDataPoints: this.countPoints(groupedData),
        collectionInterval: this.detectInterval(Object.values(groupedData)[0]),
        transformationType: 'spc-control-chart',
        warnings: violations.length > 0 ? [`${violations.length} violations detected`] : undefined,
      },
      chartSpecificData: {
        violations,
        controlLimits: {
          ucl: additionalSeries[0].data,
          centerLine: additionalSeries[1].data,
          lcl: additionalSeries[2].data,
        },
      },
    };
  }

  private calculateStatistics(data: TimeseriesDataPoint[]): Statistics {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, median, stdDev, variance };
  }

  private detectViolations(
    data: TimeseriesDataPoint[],
    ucl: number,
    lcl: number,
    centerLine: number,
    rules: SPCOptions['violationRules']
  ): Violation[] {
    const violations: Violation[] = [];

    // Rule 1: Point beyond control limits
    if (rules?.beyondLimits) {
      data.forEach((point, i) => {
        if (point.value > ucl) {
          violations.push({
            timestamp: point.timestamp,
            value: point.value,
            rule: 'Point above UCL',
            severity: 'high',
          });
        } else if (point.value < lcl) {
          violations.push({
            timestamp: point.timestamp,
            value: point.value,
            rule: 'Point below LCL',
            severity: 'high',
          });
        }
      });
    }

    // Rule 2: 6+ points trending
    if (rules?.trend) {
      for (let i = 5; i < data.length; i++) {
        const last6 = data.slice(i - 5, i + 1);
        const isAscending = last6.every((p, j) => j === 0 || p.value > last6[j - 1].value);
        const isDescending = last6.every((p, j) => j === 0 || p.value < last6[j - 1].value);

        if (isAscending || isDescending) {
          violations.push({
            timestamp: data[i].timestamp,
            value: data[i].value,
            rule: `6+ points trending ${isAscending ? 'up' : 'down'}`,
            severity: 'medium',
          });
        }
      }
    }

    // Additional rules can be implemented here

    return violations;
  }
}
```

### 3. Perfect Economizer Adapter

```typescript
// src/adapters/chart-adapters/EconomizerAdapter.ts

export interface EconomizerOptions {
  // Point assignments
  oatPointName: string;  // Outdoor Air Temperature
  satPointName: string;  // Supply Air Temperature
  ratPointName: string;  // Return Air Temperature

  // Logic conditions
  minOAT?: number;       // Minimum OAT for economizing (default: 45°F)
  maxOAT?: number;       // Maximum OAT for economizing (default: 65°F)
  satTarget?: number;    // Target SAT (default: 55°F)
  satTolerance?: number; // Acceptable deviation (default: 3°F)
}

export class EconomizerAdapter extends BaseChartAdapter {
  transform(input: ChartDataInput): ChartDataOutput {
    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const options: EconomizerOptions = {
      minOAT: 45,
      maxOAT: 65,
      satTarget: 55,
      satTolerance: 3,
      ...input.options,
    };

    const { groupedData } = input;

    // Extract point data
    const oatData = groupedData[options.oatPointName];
    const satData = groupedData[options.satPointName];
    const ratData = groupedData[options.ratPointName];

    if (!oatData || !satData || !ratData) {
      throw new Error('Missing required points for economizer analysis');
    }

    // Align timestamps (ensure all three points have data at same times)
    const alignedData = this.alignTimestamps([oatData, satData, ratData]);

    // Analyze economizer performance
    const analysis = alignedData.map((timestamp) => {
      const oat = timestamp.values[0];
      const sat = timestamp.values[1];
      const rat = timestamp.values[2];

      // Conditions
      const shouldEconomize = oat >= options.minOAT! && oat <= options.maxOAT! && oat < rat;
      const isEconomizing = Math.abs(sat - options.satTarget!) <= options.satTolerance!;

      // Status determination
      let status: 'optimal' | 'missed-opportunity' | 'incorrect-operation' | 'not-applicable';
      if (!shouldEconomize) {
        status = 'not-applicable';
      } else if (isEconomizing) {
        status = 'optimal';
      } else {
        status = 'missed-opportunity';
      }

      return {
        timestamp: timestamp.timestamp,
        oat,
        sat,
        rat,
        shouldEconomize,
        isEconomizing,
        status,
      };
    });

    // Create series
    const series: SeriesData[] = [
      this.formatForECharts('OAT', oatData, { lineStyle: { color: '#2196F3' } }),
      this.formatForECharts('SAT', satData, { lineStyle: { color: '#4CAF50' } }),
      this.formatForECharts('RAT', ratData, { lineStyle: { color: '#FF9800' } }),
    ];

    // Add status indicators
    const statusSeries: SeriesData = {
      name: 'Economizer Status',
      type: 'scatter',
      data: analysis
        .filter(a => a.status === 'missed-opportunity')
        .map(a => [a.timestamp, a.sat]),
      symbolSize: 12,
      itemStyle: { color: '#ff4444' },
    };

    const additionalSeries = [statusSeries];

    // Calculate efficiency metrics
    const totalOpportunity = analysis.filter(a => a.shouldEconomize).length;
    const actualEconomizing = analysis.filter(a => a.isEconomizing && a.shouldEconomize).length;
    const efficiency = totalOpportunity > 0 ? (actualEconomizing / totalOpportunity) * 100 : 0;

    return {
      series,
      additionalSeries,
      metadata: {
        totalDataPoints: this.countPoints(groupedData),
        collectionInterval: this.detectInterval(oatData),
        transformationType: 'economizer-analysis',
        warnings: efficiency < 50 ? ['Economizer efficiency below 50%'] : undefined,
      },
      chartSpecificData: {
        analysis,
        efficiency,
        missedOpportunities: analysis.filter(a => a.status === 'missed-opportunity').length,
      },
    };
  }

  private alignTimestamps(dataSeries: TimeseriesDataPoint[][]): AlignedTimestamp[] {
    // Find common timestamps across all series
    const timestamps = new Set(dataSeries[0].map(d => d.timestamp));
    dataSeries.slice(1).forEach(series => {
      const seriesTimestamps = new Set(series.map(d => d.timestamp));
      timestamps.forEach(t => {
        if (!seriesTimestamps.has(t)) timestamps.delete(t);
      });
    });

    // Create aligned data structure
    return Array.from(timestamps).map(timestamp => ({
      timestamp,
      values: dataSeries.map(series => {
        const point = series.find(d => d.timestamp === timestamp);
        return point?.value ?? NaN;
      }),
    }));
  }
}
```

---

## Adapter Registry

```typescript
// src/adapters/chart-adapters/index.ts

import { BaseChartAdapter } from './BaseChartAdapter';
import { TimeSeriesAdapter } from './TimeSeriesAdapter';
import { SPCChartAdapter } from './SPCChartAdapter';
import { EconomizerAdapter } from './EconomizerAdapter';
import { DeviationAdapter } from './DeviationAdapter';
import { GaugeAdapter } from './GaugeAdapter';

export const CHART_ADAPTERS: Record<string, typeof BaseChartAdapter> = {
  'timeseries': TimeSeriesAdapter,
  'line': TimeSeriesAdapter,
  'spc': SPCChartAdapter,
  'economizer': EconomizerAdapter,
  'deviation': DeviationAdapter,
  'gauge': GaugeAdapter,
};

/**
 * Get adapter instance for chart type
 */
export function getChartAdapter(chartType: string): BaseChartAdapter {
  const AdapterClass = CHART_ADAPTERS[chartType.toLowerCase()];

  if (!AdapterClass) {
    console.warn(`No adapter found for chart type: ${chartType}, using default`);
    return new TimeSeriesAdapter();
  }

  return new AdapterClass();
}

/**
 * Register custom adapter
 */
export function registerChartAdapter(
  chartType: string,
  adapter: typeof BaseChartAdapter
): void {
  CHART_ADAPTERS[chartType.toLowerCase()] = adapter;
}
```

---

## Testing Guidelines

### Unit Tests

```typescript
// src/adapters/chart-adapters/__tests__/SPCChartAdapter.test.ts

describe('SPCChartAdapter', () => {
  let adapter: SPCChartAdapter;

  beforeEach(() => {
    adapter = new SPCChartAdapter();
  });

  it('should calculate control limits correctly', () => {
    const input: ChartDataInput = {
      groupedData: {
        'test-point': [
          { timestamp: 1000, value: 70 },
          { timestamp: 2000, value: 72 },
          { timestamp: 3000, value: 71 },
          { timestamp: 4000, value: 73 },
          { timestamp: 5000, value: 69 },
        ],
      },
      selectedPoints: [{ Name: 'test-point' }],
      timeRange: { startTime: '...', endTime: '...' },
    };

    const output = adapter.transform(input);

    expect(output.additionalSeries).toHaveLength(3); // UCL, Center, LCL
    expect(output.chartSpecificData?.controlLimits).toBeDefined();
  });

  it('should detect violations beyond control limits', () => {
    // Test implementation
  });

  it('should preserve all raw data points', () => {
    // Ensure no data loss during transformation
  });
});
```

---

## Best Practices

1. **Preserve Raw Data:** Never aggregate or downsample in adapters
2. **Validation:** Always validate input before transformation
3. **Error Handling:** Throw descriptive errors with context
4. **Documentation:** Document adapter-specific options thoroughly
5. **Testing:** Achieve 90%+ test coverage for each adapter
6. **Performance:** Optimize for 100K+ data points

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
