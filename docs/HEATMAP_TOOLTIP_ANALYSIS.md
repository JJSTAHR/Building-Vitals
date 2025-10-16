# DeviceDeviationHeatmap Tooltip Data Accuracy Analysis

**Date:** 2025-10-16
**Component:** `EChartsDeviceDeviationHeatmap.tsx`
**Issue:** Tooltip displaying inaccurate or mismatched data

---

## Executive Summary

The tooltip in the DeviceDeviationHeatmap is **displaying CORRECT data**, but there are **critical mismatches** between:
1. What the tooltip claims to show (actual values, target values, deviation percentages)
2. What data is actually available in the aggregated cells
3. How the heatmap cell colors are calculated

**Root Cause:** The tooltip attempts to calculate actual values from normalized deviation multipliers without access to the original raw values, leading to inaccurate reconstructions.

---

## Current Tooltip Implementation

### Location
**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\components\charts\EChartsDeviceDeviationHeatmap.tsx`
**Lines:** 645-727

### Tooltip Formatter Code

```typescript
// Line 645-727
const tooltipFormatter = useCallback((params: any) => {
  if (!params || !params.data) return '';

  const [xIndex, yIndex, deviationValue] = params.value || [];
  const timestamp = chartData.xAxis[xIndex];
  const device = chartData.yAxis[yIndex];

  // Find the aggregated cell
  const cell = aggregatedData.find(
    c => c.device === device &&
         chartData.xAxis[chartData.xAxis.findIndex(t => t === timestamp)] === timestamp
  );

  // Find device config for target values
  const config = deviceConfigs.find(c => c.deviceName === device);

  if (!cell) {
    return `
      <div style="padding: 8px;">
        <strong>${device}</strong><br/>
        ${timestamp}<br/>
        Deviation: ${(deviationValue * 100).toFixed(1)}%
      </div>
    `;
  }

  // ⚠️ PROBLEM: Attempting to reconstruct actual value from normalized deviation
  let actualValueStr = '';
  if (config && config.targetValue !== undefined && cell.diagnostics) {
    const actualValue = config.targetValue + (cell.diagnostics.mean * (config.tolerance || config.targetValue * 0.1));
    actualValueStr = `Actual Value: ${actualValue.toFixed(2)}<br/>
                     Target: ${config.targetValue.toFixed(2)}<br/>`;
  }

  // Status determination
  let statusText = 'Normal';
  let statusEmoji = '✅';
  if (Math.abs(cell.maxDeviation) > 1) {
    statusText = 'Critical';
    statusEmoji = '🔴';
  } else if (Math.abs(cell.maxDeviation) > 0.5) {
    statusText = 'Warning';
    statusEmoji = '⚠️';
  } else if (Math.abs(cell.maxDeviation) > 0.2) {
    statusText = 'Minor';
    statusEmoji = '🟡';
  }

  return `
    <div style="padding: 10px; font-size: 12px; line-height: 1.5;">
      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">
        ${statusEmoji} ${device}
      </div>
      <div style="color: #888; font-size: 11px; margin-bottom: 8px;">
        ${formatTooltipTime(timestamp)}
      </div>
      <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px;">
        ${actualValueStr}
        <div style="margin-top: 4px;">
          <strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span><br/>
          <strong>Deviation:</strong> <span style="color: ${statusColor}; font-weight: bold;">
            ${cell.maxDeviation > 0 ? '+' : ''}${(cell.maxDeviation * 100).toFixed(1)}%
          </span>
        </div>
        ${cell.diagnostics.sustainedDeviation ?
          `<div style="color: ${error}; margin-top: 4px;">⚠️ Sustained deviation detected</div>` : ''}
        ${cell.diagnostics.anomalyCount > 0 ?
          `<div style="color: ${warning}; margin-top: 4px;">🔍 ${cell.diagnostics.anomalyCount} anomalies in this period</div>` : ''}
      </div>
      <div style="color: ${disabled}; font-size: 10px; margin-top: 6px; padding-top: 6px; border-top: 1px solid ${divider};">
        <strong>Aggregation:</strong> ${cell.diagnostics.count} readings<br/>
        <strong>Range:</strong> ${cell.diagnostics.min.toFixed(1)}% to ${cell.diagnostics.max.toFixed(1)}%
      </div>
    </div>
  `;
}, [aggregatedData, chartData, deviceConfigs]);
```

---

## Data Flow Analysis

### 1. Input Data Structure (params from ECharts)

```typescript
params = {
  componentType: 'series',
  seriesType: 'heatmap',
  seriesIndex: 0,
  seriesName: 'Deviation',
  name: '10:30 AM',  // x-axis label
  dataIndex: 45,      // Index in data array
  data: [45, 2, 0.73], // [xIndex, yIndex, deviationValue]
  value: [45, 2, 0.73], // Same as data
  // ... other fields
}
```

**Key fields:**
- `params.value[0]` = xIndex (timestamp index in xAxis array)
- `params.value[1]` = yIndex (device index in yAxis array)
- `params.value[2]` = deviationValue (normalized deviation as tolerance multiplier)

### 2. Chart Data Structure (from optimizeHeatmapForECharts)

**Source:** `adaptiveHeatmapRendering.ts` lines 330-439

```typescript
chartData = {
  data: Array<[number, number, number]>, // [xIndex, yIndex, maxDeviation]
  xAxis: string[],  // ["10:30 AM", "10:45 AM", "11:00 AM", ...]
  yAxis: string[],  // ["Device A", "Device B", "Device C", ...]
  visualMap: { min: -4, max: 4, ... }
}

// Example data point:
// [45, 2, 0.73] means:
//   - Time: chartData.xAxis[45] = "10:30 AM"
//   - Device: chartData.yAxis[2] = "AHU-001"
//   - Deviation: 0.73 (tolerance multiplier, NOT percentage)
```

### 3. Aggregated Cell Structure

**Source:** `adaptiveHeatmapRendering.ts` lines 15-32

```typescript
interface AggregatedHeatmapCell {
  device: string;           // "AHU-001"
  timestamp: number;        // Unix timestamp in milliseconds
  maxDeviation: number;     // Normalized deviation (tolerance multiplier)
  diagnostics: {
    count: number;          // Number of raw readings aggregated
    mean: number;           // Mean of deviation multipliers
    min: number;            // Min deviation multiplier
    max: number;            // Max deviation multiplier
    percentile95: number;   // 95th percentile
    stdDev: number;         // Standard deviation
    anomalyCount: number;   // Count > threshold
    sustainedDeviation: boolean;
    peakTimestamp: number;  // When max occurred
  };
}
```

**⚠️ CRITICAL ISSUE:** The aggregated cell contains:
- `maxDeviation`: Normalized tolerance multiplier (-4 to +4)
- `diagnostics.mean/min/max`: Also normalized tolerance multipliers

**What's MISSING:**
- Original raw sensor values (e.g., 72.5°F, 85.3%, 1250 CFM)
- Actual units of measurement
- Expected/baseline values
- Absolute deviation amounts

### 4. Heatmap Cell Structure (Original Data)

**Source:** Lines 582-588 in EChartsDeviceDeviationHeatmap.tsx

```typescript
interface HeatmapCell {
  device: string;
  timestamp: number;
  value: number;        // ✅ THIS IS THE RAW VALUE WE NEED!
  deviation: number;    // Normalized deviation multiplier
}
```

**The original `heatmapCells` array DOES contain raw values** (line 586):
```typescript
cells.push({
  device: deviceName,
  timestamp: timestamp,
  value: aggregatedValue,  // ✅ Raw sensor reading
  deviation: clampedDeviation,
});
```

---

## The Core Problem: Data Loss During Aggregation

### Step-by-Step Data Transformation

```
1. Raw Series Data (Input)
   series: [{ name: "AHU-001", data: [[timestamp1, 72.5], [timestamp2, 73.1], ...] }]
   ↓

2. HeatmapCells (Line 500-592)
   cells: [
     { device: "AHU-001", timestamp: ts1, value: 72.5, deviation: 0.625 },
     { device: "AHU-001", timestamp: ts2, value: 73.1, deviation: 0.775 },
     ...
   ]
   ✅ Raw values PRESERVED
   ↓

3. AggregatedHeatmapCell (Line 595-637)
   aggregatedData: [
     {
       device: "AHU-001",
       timestamp: ts_bucket,
       maxDeviation: 0.775,  // ❌ Raw value LOST
       diagnostics: {
         count: 12,
         mean: 0.7,
         min: 0.5,
         max: 0.775,
         // ❌ No raw values stored
       }
     }
   ]
   ❌ Raw values DISCARDED
   ↓

4. Chart Data (Line 640-642)
   chartData: {
     data: [[xIndex, yIndex, 0.775]],  // ❌ Only deviation
     xAxis: ["10:30 AM", ...],
     yAxis: ["AHU-001", ...]
   }
   ↓

5. Tooltip (Line 645-727)
   // Tries to reconstruct raw value:
   actualValue = targetValue + (mean * tolerance)
   // ❌ This is WRONG because mean is already normalized
```

---

## What The Tooltip SHOULD Display

For a deviation heatmap tooltip to be accurate and useful, it should show:

### Essential Information
1. **Point/Device Name** ✅ Currently showing
2. **Timestamp** ✅ Currently showing (formatted correctly)
3. **Actual Value** ❌ Currently INCORRECT (reconstructed from normalized data)
4. **Expected/Baseline Value** ⚠️ Shows target if configured, but may not match actual baseline used
5. **Deviation Amount** ❌ Shows normalized multiplier as percentage (misleading)
6. **Deviation Percentage** ❌ Showing tolerance multiplier * 100, not actual percentage
7. **Units** ❌ NOT showing (unavailable in aggregated data)
8. **Status/Threshold Info** ✅ Currently showing

### Current vs. Desired Output

**Current Output:**
```
🔴 AHU-001
Jan 15, 2024, 10:30:15 AM

Actual Value: 74.00      ← ❌ WRONG (reconstructed)
Target: 70.00            ← ⚠️ May not be actual baseline

Status: Warning
Deviation: +73.0%        ← ❌ MISLEADING (tolerance multiplier, not percentage)

⚠️ Sustained deviation detected
🔍 3 anomalies in this period

Aggregation: 12 readings
Range: 50.0% to 77.5%    ← ❌ WRONG units (should be absolute values or real %)
```

**Desired Output:**
```
🔴 AHU-001 Supply Air Temperature
Jan 15, 2024, 10:30:15 AM

Actual: 74.0°F           ← ✅ Real sensor value
Expected: 70.0°F         ← ✅ Actual baseline used
Deviation: +4.0°F        ← ✅ Absolute deviation
(+5.7%)                  ← ✅ Real percentage: (74-70)/70 * 100

Tolerance: ±2.0°F (±2.9%)
Zone: Warning (2.0x tolerance)

⚠️ Sustained for 12 readings over 1 hour
🔍 3 anomaly spikes detected

Range: 72.5°F to 74.8°F
Peak: 74.8°F at 10:45 AM
```

---

## Root Causes

### 1. Data Loss in Aggregation (Lines 595-637)
**Problem:** Original `HeatmapCell.value` (raw sensor reading) is discarded when creating `AggregatedHeatmapCell`.

**Code:**
```typescript
// Line 621-636
return heatmapCells.map(cell => ({
  device: cell.device,
  timestamp: cell.timestamp,
  maxDeviation: cell.deviation,  // ❌ Only stores normalized deviation
  diagnostics: {
    count: 1,
    mean: cell.deviation,         // ❌ Normalized, not raw value
    min: cell.deviation,
    max: cell.deviation,
    // ... cell.value is LOST
  },
}));
```

### 2. Incorrect Value Reconstruction (Lines 678-684)
**Problem:** Attempts to reverse-calculate raw value from normalized deviation multiplier.

**Code:**
```typescript
let actualValueStr = '';
if (config && config.targetValue !== undefined && cell.diagnostics) {
  // ❌ WRONG: mean is tolerance multiplier, not deviation amount
  const actualValue = config.targetValue + (cell.diagnostics.mean * (config.tolerance || config.targetValue * 0.1));
  actualValueStr = `Actual Value: ${actualValue.toFixed(2)}<br/>
                   Target: ${config.targetValue.toFixed(2)}<br/>`;
}
```

**Why this is wrong:**
- `cell.diagnostics.mean` is a tolerance multiplier (e.g., 0.73)
- Formula treats it as if it's a raw deviation amount
- Tolerance is auto-calculated if not provided, making reconstruction even more inaccurate

### 3. Misleading Percentage Display (Lines 712-714)
**Problem:** Displays tolerance multiplier as percentage.

**Code:**
```typescript
<strong>Deviation:</strong> <span>
  ${cell.maxDeviation > 0 ? '+' : ''}${(cell.maxDeviation * 100).toFixed(1)}%
</span>
```

**Example:**
- If `maxDeviation = 0.73` (0.73x tolerance)
- Displays as "+73.0%"
- User thinks it's 73% above target
- Actual meaning: 0.73 times the tolerance threshold

### 4. Missing Units (Throughout)
**Problem:** No unit information stored or displayed.

**Missing from data structures:**
- `AggregatedHeatmapCell` - no unit field
- `HeatmapCell` - no unit field (should be added)
- Series data includes `unit` (line 68) but it's never passed through

### 5. Timestamp Mismatch Risk (Lines 653-656)
**Problem:** Complex and fragile timestamp matching logic.

**Code:**
```typescript
const cell = aggregatedData.find(
  c => c.device === device &&
       chartData.xAxis[chartData.xAxis.findIndex(t => t === timestamp)] === timestamp
);
```

**Issues:**
- Compares formatted time string with timestamp
- Double lookup is inefficient
- May fail if time formatting changes
- No tolerance for rounding errors

---

## Recommended Fixes

### Fix 1: Preserve Raw Values in AggregatedHeatmapCell

**File:** `src/utils/adaptiveHeatmapRendering.ts`
**Lines:** 15-32

```typescript
export interface AggregatedHeatmapCell {
  device: string;
  timestamp: number;
  maxDeviation: number;

  // ✅ ADD: Preserve raw values
  rawValue: number;        // Actual sensor reading
  expectedValue: number;   // Baseline/target used for deviation calculation
  unit?: string;           // Unit of measurement

  diagnostics: {
    count: number;
    mean: number;
    min: number;
    max: number;
    percentile95: number;
    stdDev: number;
    anomalyCount: number;
    sustainedDeviation: boolean;
    peakTimestamp: number;

    // ✅ ADD: Raw value statistics
    rawValueMean: number;
    rawValueMin: number;
    rawValueMax: number;
    rawValueAtPeak: number;
  };
}
```

### Fix 2: Store Raw Values During Aggregation

**File:** `src/components/charts/EChartsDeviceDeviationHeatmap.tsx`
**Lines:** 595-637

```typescript
const aggregatedData = useMemo(() => {
  console.log('[HeatmapV2] Using pre-aggregated cells:', {
    strategy: strategy.cellResolution,
    inputCells: heatmapCells.length,
    preserveAnomalies: strategy.preserveAnomalies,
  });

  return heatmapCells.map(cell => {
    // Find the config to get expected value and unit
    const config = deviceConfigs.find(c => c.deviceName === cell.device);
    const seriesData = series.find(s => s.name === cell.device);

    // Calculate expected value based on deviation method
    let expectedValue = cell.value - (cell.deviation * (config?.tolerance || Math.abs(cell.value) * 0.1));
    if (config?.targetValue !== undefined) {
      expectedValue = config.targetValue;
    }

    return {
      device: cell.device,
      timestamp: cell.timestamp,
      maxDeviation: cell.deviation,

      // ✅ STORE RAW VALUES
      rawValue: cell.value,
      expectedValue: expectedValue,
      unit: seriesData?.unit || config?.unit,

      diagnostics: {
        count: 1,
        mean: cell.deviation,
        min: cell.deviation,
        max: cell.deviation,
        percentile95: cell.deviation,
        stdDev: 0,
        anomalyCount: Math.abs(cell.deviation) > strategy.anomalyThreshold ? 1 : 0,
        sustainedDeviation: Math.abs(cell.deviation) > 1,
        peakTimestamp: cell.timestamp,

        // ✅ RAW VALUE STATS
        rawValueMean: cell.value,
        rawValueMin: cell.value,
        rawValueMax: cell.value,
        rawValueAtPeak: cell.value,
      },
    };
  });
}, [heatmapCells, strategy, deviceConfigs, series]);
```

### Fix 3: Correct Tooltip Formatter

**File:** `src/components/charts/EChartsDeviceDeviationHeatmap.tsx`
**Lines:** 645-727

```typescript
const tooltipFormatter = useCallback((params: any) => {
  if (!params || !params.data) return '';

  const [xIndex, yIndex, deviationValue] = params.value || [];
  const timestamp = chartData.xAxis[xIndex];
  const device = chartData.yAxis[yIndex];

  // ✅ FIX: Use Map for efficient lookup instead of complex find
  const cellKey = `${device}_${timestamp}`;
  const cell = aggregatedDataMap.get(cellKey);

  const config = deviceConfigs.find(c => c.deviceName === device);

  if (!cell) {
    return `
      <div style="padding: 8px;">
        <strong>${device}</strong><br/>
        ${timestamp}<br/>
        No data available
      </div>
    `;
  }

  // ✅ CORRECT: Use actual stored values
  const actualValue = cell.rawValue;
  const expectedValue = cell.expectedValue;
  const absoluteDeviation = actualValue - expectedValue;
  const percentageDeviation = expectedValue !== 0
    ? (absoluteDeviation / Math.abs(expectedValue)) * 100
    : 0;

  const unit = cell.unit || '';
  const tolerance = config?.tolerance;
  const toleranceMultiplier = cell.maxDeviation;

  // Format values with appropriate precision
  const formatValue = (val: number) => {
    if (Math.abs(val) >= 100) return val.toFixed(1);
    if (Math.abs(val) >= 10) return val.toFixed(2);
    return val.toFixed(3);
  };

  // Determine status
  const absMultiplier = Math.abs(toleranceMultiplier);
  let statusText = 'Normal';
  let statusEmoji = '✅';
  let statusColor = CHART_DESIGN_TOKENS.colors.semantic.success;

  if (absMultiplier > 3) {
    statusText = 'Critical';
    statusEmoji = '🔴';
    statusColor = CHART_DESIGN_TOKENS.colors.semantic.error;
  } else if (absMultiplier > 2) {
    statusText = 'Alert';
    statusEmoji = '⚠️';
    statusColor = CHART_DESIGN_TOKENS.colors.semantic.warning;
  } else if (absMultiplier > 1) {
    statusText = 'Warning';
    statusEmoji = '🟡';
    statusColor = CHART_DESIGN_TOKENS.colors.semantic.warning;
  }

  // Build tooltip HTML
  return `
    <div style="padding: 10px; font-size: 12px; line-height: 1.6;">
      <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">
        ${statusEmoji} ${device}
      </div>
      <div style="color: #888; font-size: 11px; margin-bottom: 8px;">
        ${formatTooltipTime(cell.timestamp)}
      </div>

      <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
        <div style="margin-bottom: 4px;">
          <strong>Actual:</strong> ${formatValue(actualValue)}${unit}
        </div>
        <div style="margin-bottom: 4px;">
          <strong>Expected:</strong> ${formatValue(expectedValue)}${unit}
        </div>
        <div style="margin-bottom: 4px;">
          <strong>Deviation:</strong>
          <span style="color: ${statusColor}; font-weight: bold;">
            ${absoluteDeviation > 0 ? '+' : ''}${formatValue(absoluteDeviation)}${unit}
            (${percentageDeviation > 0 ? '+' : ''}${percentageDeviation.toFixed(1)}%)
          </span>
        </div>
        ${tolerance ? `
        <div style="margin-bottom: 4px; font-size: 11px;">
          <strong>Tolerance:</strong> ±${formatValue(tolerance)}${unit}
          <span style="color: ${statusColor};">
            (${absMultiplier.toFixed(2)}x)
          </span>
        </div>
        ` : ''}
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1);">
          <strong>Status:</strong>
          <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
        </div>
      </div>

      ${cell.diagnostics.sustainedDeviation ? `
        <div style="color: ${CHART_DESIGN_TOKENS.colors.semantic.error}; margin-bottom: 4px; font-size: 11px;">
          ⚠️ Sustained deviation for ${cell.diagnostics.count} readings
        </div>
      ` : ''}

      ${cell.diagnostics.anomalyCount > 0 ? `
        <div style="color: ${CHART_DESIGN_TOKENS.colors.semantic.warning}; margin-bottom: 4px; font-size: 11px;">
          🔍 ${cell.diagnostics.anomalyCount} anomaly spikes detected
        </div>
      ` : ''}

      ${cell.diagnostics.count > 1 ? `
        <div style="color: ${theme.palette.text.disabled}; font-size: 10px; padding-top: 6px; border-top: 1px solid ${theme.palette.divider};">
          <div><strong>Aggregation:</strong> ${cell.diagnostics.count} readings over ${strategy.cellResolution}</div>
          <div><strong>Value Range:</strong> ${formatValue(cell.diagnostics.rawValueMin)}${unit} to ${formatValue(cell.diagnostics.rawValueMax)}${unit}</div>
          <div><strong>Peak:</strong> ${formatValue(cell.diagnostics.rawValueAtPeak)}${unit} at ${formatTooltipTime(cell.diagnostics.peakTimestamp)}</div>
        </div>
      ` : ''}
    </div>
  `;
}, [aggregatedDataMap, chartData, deviceConfigs, strategy, theme]);
```

### Fix 4: Create Efficient Lookup Map

**File:** `src/components/charts/EChartsDeviceDeviationHeatmap.tsx`
**Add before tooltipFormatter (around line 642)**

```typescript
// Create efficient lookup map for tooltip
const aggregatedDataMap = useMemo(() => {
  const map = new Map<string, typeof aggregatedData[0]>();

  aggregatedData.forEach(cell => {
    // Format timestamp same way as chartData.xAxis
    const formattedTime = formatTimeLabel(cell.timestamp, strategy.cellResolution);
    const key = `${cell.device}_${formattedTime}`;
    map.set(key, cell);
  });

  return map;
}, [aggregatedData, strategy]);

// Helper function to format time labels consistently
const formatTimeLabel = (timestamp: number, resolution: string): string => {
  const date = new Date(timestamp);
  switch (resolution) {
    case '5min':
    case '15min':
    case '30min':
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    case '1hour':
    case '2hour':
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    case '4hour':
    case '8hour':
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    case '1day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
};
```

### Fix 5: Pass Unit Through Series

**File:** `src/components/charts/EChartsDeviceDeviationHeatmap.tsx`
**Lines:** 62-94 (interface already has unit, just ensure it's used)

```typescript
interface DeviceDeviationHeatmapProps {
  series: Array<{
    name: string;
    data: Array<[number, number]>;
    unit?: string;              // ✅ Already present
    markerTags?: string[];
  }>;

  deviceConfigs?: Array<{
    deviceName: string;
    targetValue?: number;
    minValue?: number;
    maxValue?: number;
    tolerance?: number;
    unit?: string;              // ✅ ADD THIS
  }>;
  // ...
}
```

---

## Testing Checklist

### Unit Tests

```typescript
describe('DeviceDeviationHeatmap Tooltip', () => {
  it('should display actual raw sensor value', () => {
    const cell = {
      rawValue: 74.5,
      expectedValue: 70.0,
      unit: '°F',
      maxDeviation: 0.75,
      // ...
    };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).toContain('Actual: 74.5°F');
  });

  it('should display correct absolute deviation', () => {
    const cell = {
      rawValue: 74.5,
      expectedValue: 70.0,
      unit: '°F',
      // ...
    };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).toContain('Deviation: +4.5°F');
  });

  it('should display correct percentage deviation', () => {
    const cell = {
      rawValue: 74.5,
      expectedValue: 70.0,
      // 4.5 / 70 * 100 = 6.4%
      // ...
    };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).toContain('(+6.4%)');
  });

  it('should handle zero expected value', () => {
    const cell = {
      rawValue: 5.0,
      expectedValue: 0.0,
      unit: 'units',
      // ...
    };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('should format timestamp in user timezone', () => {
    const timestamp = Date.UTC(2024, 0, 15, 14, 30, 0);
    const cell = { timestamp, /* ... */ };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).toMatch(/Jan 15, 2024.*PM/);
  });

  it('should show tolerance multiplier when available', () => {
    const cell = {
      rawValue: 76.0,
      expectedValue: 70.0,
      maxDeviation: 2.0,
      // ...
    };
    const config = { tolerance: 3.0, unit: '°F' };
    const html = tooltipFormatter(createMockParams(cell, config));
    expect(html).toContain('Tolerance: ±3.0°F');
    expect(html).toContain('(2.00x)');
  });

  it('should show aggregation stats for multi-reading cells', () => {
    const cell = {
      diagnostics: {
        count: 12,
        rawValueMin: 72.5,
        rawValueMax: 76.8,
        rawValueAtPeak: 76.8,
        peakTimestamp: Date.now(),
      },
      // ...
    };
    const html = tooltipFormatter(createMockParams(cell));
    expect(html).toContain('12 readings');
    expect(html).toContain('Value Range: 72.5°F to 76.8°F');
    expect(html).toContain('Peak: 76.8°F');
  });
});
```

### Integration Tests

1. **Load heatmap with real data**
   - Verify tooltip shows on hover
   - Check actual values match source data
   - Confirm units are displayed

2. **Test different deviation methods**
   - Target-based
   - Mean-based
   - Median-based
   - Verify expected value changes accordingly

3. **Test aggregation levels**
   - 5min resolution (no aggregation)
   - 1hour resolution
   - 1day resolution
   - Verify raw values preserved at all levels

4. **Test edge cases**
   - Zero expected value
   - Negative values
   - Very large values (>1000)
   - Very small values (<0.01)
   - Missing tolerance config

5. **Test timezone handling**
   - User in UTC
   - User in EST (UTC-5)
   - User in PST (UTC-8)
   - Across DST boundary

### Manual Testing

1. Hover over green cell (normal) → Verify low deviation
2. Hover over yellow cell (warning) → Verify 1-2x tolerance
3. Hover over red cell (critical) → Verify >3x tolerance
4. Compare tooltip actual value with raw data CSV
5. Verify units match point configuration
6. Check timestamp matches x-axis label
7. Verify sustained deviation flag appears when appropriate

---

## Summary

### Current Issues
1. ❌ Raw sensor values lost during aggregation
2. ❌ Tooltip attempts to reconstruct values (inaccurate)
3. ❌ Deviation displayed as misleading percentage
4. ❌ Units not shown
5. ❌ Inefficient timestamp matching

### Fixes Provided
1. ✅ Preserve raw values in AggregatedHeatmapCell
2. ✅ Store expected values and units
3. ✅ Correct tooltip formatter with real values
4. ✅ Show both absolute and percentage deviation
5. ✅ Efficient Map-based cell lookup
6. ✅ Comprehensive test suite

### Implementation Priority
1. **High:** Fix data structures (AggregatedHeatmapCell)
2. **High:** Update aggregation logic
3. **High:** Rewrite tooltip formatter
4. **Medium:** Add efficient lookup map
5. **Low:** Add comprehensive tests

---

**End of Report**
