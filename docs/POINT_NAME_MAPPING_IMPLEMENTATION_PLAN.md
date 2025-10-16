# Point Name Mapping Implementation Plan

**Created:** 2025-10-13
**Status:** Ready for Implementation
**Priority:** HIGH
**Risk Level:** MEDIUM

---

## Executive Summary

This implementation plan addresses the point name field inconsistency issue identified in the analysis. The codebase uses both `name` (lowercase) and `Name` (capitalized) fields interchangeably, which can cause mapping failures between API responses and selected points.

### Problem Statement
- ACE IoT API returns points with `name` (lowercase)
- Enhancement utilities use `Name` (capitalized) from KV tags
- Code defensively checks both variants: `point.Name || point.name`
- This creates potential race conditions and mapping failures
- **Impact:** Charts may fail to display data if point name mapping fails

### Solution Approach
**Normalize field names during initial data fetch** - Use lowercase `name` consistently throughout the system while preserving `display_name` for UI presentation.

---

## Phase 1: Data Normalization at Source (HIGH PRIORITY)

### Task 1.1: Normalize Point Fields in API Service Layer

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\services\paginatedTimeseriesService.ts`

**Location:** Lines 179-224 (filterAndGroupTimeseries function)

**Current Code:**
```typescript
export function filterAndGroupTimeseries(
  allSamples: PointSample[],
  selectedPoints: Point[]
): GroupedTimeseriesData {
  // CRITICAL: Uses point.Name (original identifier), NOT display_name
  const selectedPointNames = selectedPoints.map(p => p.Name);
  // ... filtering logic
}
```

**New Code:**
```typescript
/**
 * Normalizes a point object to use consistent field naming
 * - name: lowercase (original API identifier) - REQUIRED
 * - display_name: human-readable label (UI only) - OPTIONAL
 */
function normalizePointFields(point: any): Point {
  const normalized = {
    ...point,
    // Normalize to lowercase 'name' field
    name: point.name || point.Name,
    // Remove capitalized variant
    Name: undefined,
    // Preserve display_name for UI
    display_name: point.display_name || point.displayName,
    displayName: undefined
  };
  return normalized as Point;
}

export function filterAndGroupTimeseries(
  allSamples: PointSample[],
  selectedPoints: Point[]
): GroupedTimeseriesData {
  // Normalize all selected points first
  const normalizedPoints = selectedPoints.map(normalizePointFields);

  // Use lowercase 'name' field consistently
  const selectedPointNames = normalizedPoints
    .filter(p => p?.name)
    .map(p => p.name!);

  if (selectedPointNames.length === 0) {
    console.warn('[filterAndGroupTimeseries] No valid point names found');
    return {};
  }

  const pointNameSet = new Set(selectedPointNames);

  const grouped: GroupedTimeseriesData = {};
  let samplesProcessed = 0;
  let samplesFiltered = 0;

  // Filter samples matching selected points
  for (const sample of allSamples) {
    samplesProcessed++;
    if (pointNameSet.has(sample.point_name)) {
      if (!grouped[sample.point_name]) {
        grouped[sample.point_name] = [];
      }
      grouped[sample.point_name].push({
        timestamp: new Date(sample.timestamp).getTime(),
        value: sample.value
      });
      samplesFiltered++;
    }
  }

  console.log(`[filterAndGroupTimeseries] Processed ${samplesProcessed} samples, filtered to ${samplesFiltered} for ${selectedPointNames.length} points`);

  return grouped;
}
```

**Testing:**
```typescript
// Unit test
describe('filterAndGroupTimeseries', () => {
  it('should handle points with Name (capitalized)', () => {
    const samples = [
      { point_name: 'test/point1', timestamp: '2025-01-10T00:00:00Z', value: 10 }
    ];
    const selectedPoints = [
      { Name: 'test/point1', display_name: 'Test Point 1' }
    ];
    const result = filterAndGroupTimeseries(samples, selectedPoints);
    expect(result['test/point1']).toBeDefined();
    expect(result['test/point1'].length).toBe(1);
  });

  it('should handle points with name (lowercase)', () => {
    const samples = [
      { point_name: 'test/point2', timestamp: '2025-01-10T00:00:00Z', value: 20 }
    ];
    const selectedPoints = [
      { name: 'test/point2', display_name: 'Test Point 2' }
    ];
    const result = filterAndGroupTimeseries(samples, selectedPoints);
    expect(result['test/point2']).toBeDefined();
  });

  it('should handle mixed field naming', () => {
    const samples = [
      { point_name: 'test/point1', timestamp: '2025-01-10T00:00:00Z', value: 10 },
      { point_name: 'test/point2', timestamp: '2025-01-10T00:00:00Z', value: 20 }
    ];
    const selectedPoints = [
      { Name: 'test/point1', display_name: 'Point 1' },
      { name: 'test/point2', display_name: 'Point 2' }
    ];
    const result = filterAndGroupTimeseries(samples, selectedPoints);
    expect(Object.keys(result).length).toBe(2);
  });
});
```

---

### Task 1.2: Add Type Guards for Point Validation

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\types\point.types.ts`

**New Code:**
```typescript
/**
 * Type guard to ensure point has required name field
 */
export function isValidPointForAPI(point: any): point is { name: string } {
  return typeof point?.name === 'string' && point.name.length > 0;
}

/**
 * Type guard to check if point has display name
 */
export function hasDisplayName(point: any): point is { display_name: string } {
  return typeof point?.display_name === 'string' && point.display_name.length > 0;
}

/**
 * Strict Point interface - enforces lowercase 'name'
 */
export interface NormalizedPoint {
  name: string;                  // REQUIRED: Original point name from ACE IoT API
  display_name?: string;         // OPTIONAL: Human-readable name for UI
  id?: number | string;
  unit?: string;
  point_type?: string;
  marker_tags?: string[];
  equipment?: string;
  _enhanced?: boolean;
  _enhancedAt?: string;
}
```

**Usage in useChartData:**
```typescript
// In useChartData.ts around line 166-171
const pointNames = useMemo(() => {
  if (!selectedPoints || !Array.isArray(selectedPoints)) {
    return [];
  }

  // Use type guard to filter valid points
  const validPoints = selectedPoints.filter(isValidPointForAPI);

  if (validPoints.length < selectedPoints.length) {
    console.warn(`[useChartData] Filtered out ${selectedPoints.length - validPoints.length} invalid points without 'name' field`);
  }

  return validPoints.map(p => p.name);
}, [selectedPoints]);
```

---

### Task 1.3: Normalize Points in Enhancement Utilities

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\utils\kvTagParser.ts`

**Location:** Line 362 (enhancePointWithKvTags function)

**Modification:**
```typescript
export function enhancePointWithKvTags(point: any): EnhancedPointWithKv {
  // Check if already enhanced
  if (point._enhanced) {
    return point;
  }

  // Normalize field names FIRST
  const normalized: any = {
    ...point,
    // Normalize to lowercase 'name'
    name: point.name || point.Name,
    Name: undefined,
    // Preserve display_name
    display_name: point.display_name || point.displayName,
    displayName: undefined
  };

  const enhanced: EnhancedPointWithKv = { ...normalized };

  // Parse KV tags
  const kvTag = parseKvTags(
    normalized['Kv Tags'] || normalized.kv_tags || normalized.kvTags || ''
  );

  // Extract equipment from normalized name
  const equipment = extractEquipmentFromName(normalized.name || '');

  // Generate display name if not already present
  if (!enhanced.display_name) {
    enhanced.display_name = generateDisplayName(
      kvTag,
      equipment.pointName || '',
      equipment
    );
  }

  // ... rest of enhancement logic

  enhanced._enhanced = true;
  enhanced._enhancedAt = new Date().toISOString();

  return enhanced;
}
```

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\utils\pointEnhancer.ts`

**Location:** Line 466 (enhancePoint function)

**Modification:**
```typescript
export function enhancePoint(point: Point): EnhancedPoint {
  // Check if already enhanced
  if ((point as EnhancedPoint)._enhanced) {
    return point as EnhancedPoint;
  }

  // Normalize field names FIRST
  const normalized: any = {
    ...point,
    name: point.name || (point as any).Name,
    Name: undefined,
    display_name: point.display_name || (point as any).displayName,
    displayName: undefined
  };

  const enhanced: EnhancedPoint = { ...normalized };

  // Generate display name from normalized name
  if (!enhanced.display_name) {
    enhanced.display_name = generateDisplayName(normalized.name);
  }

  // Parse equipment from normalized name
  const equipment = parseEquipment(normalized.name);

  if (equipment) {
    enhanced.equipment = equipment.type;
    enhanced.equipmentId = equipment.id;
    enhanced.equipmentName = equipment.name;
  }

  // ... more enhancements

  enhanced._enhanced = true;
  enhanced._enhancedAt = new Date().toISOString();

  return enhanced;
}
```

---

## Phase 2: Add Validation and Logging (MEDIUM PRIORITY)

### Task 2.1: Add Development-Mode Validation

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\useChartData.ts`

**Location:** Before API call (around line 220)

**New Code:**
```typescript
// Add validation logging in development mode
if (process.env.NODE_ENV === 'development') {
  // Validate point names before API call
  pointNames.forEach((name, index) => {
    // Check for display_name accidentally used
    if (name.includes('display_name') || name.includes(' ')) {
      console.error(
        `⚠️ [useChartData] INVALID point name at index ${index}:`,
        name,
        '\nOriginal point:',
        selectedPoints[index]
      );
    }

    // Check for Name (capitalized) field leaking through
    if (selectedPoints[index] && 'Name' in selectedPoints[index]) {
      console.warn(
        `⚠️ [useChartData] Point at index ${index} has 'Name' (capitalized) field:`,
        selectedPoints[index],
        '\nThis should be normalized to lowercase "name"'
      );
    }
  });

  console.log('[useChartData] Validated point names:', pointNames);
}
```

### Task 2.2: Add Error Boundary for Point Name Issues

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\components\common\PointSelector.tsx`

**Location:** Around line 290 (handlePointToggle)

**Modification:**
```typescript
const handlePointToggle = useCallback((point: Point) => {
  // Validate point has required fields
  if (!point || (!point.name && !(point as any).Name)) {
    console.error('[PointSelector] Cannot select point without name field:', point);
    // Show user-friendly error
    return;
  }

  // Normalize point before adding to selection
  const normalizedPoint = {
    ...point,
    name: point.name || (point as any).Name,
    Name: undefined,
    display_name: point.display_name || (point as any).displayName,
    displayName: undefined
  };

  onPointsChange((prev) => {
    const currentSelection = Array.isArray(prev) ? prev : [];
    const isSelected = currentSelection.some(p => p?.id === normalizedPoint.id);

    if (isSelected) {
      return currentSelection.filter(p => p?.id !== normalizedPoint.id);
    } else {
      const newSelection = enableMultiSelect
        ? [...currentSelection, normalizedPoint]
        : [normalizedPoint];
      return newSelection;
    }
  });
}, [onPointsChange, maxPoints, enableMultiSelect]);
```

---

## Phase 3: Update Type Definitions (LOW PRIORITY)

### Task 3.1: Document Field Usage in Type Definitions

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\functions\src\types\aceiot-api.types.ts`

**Location:** Line 38-63 (AceIoTPoint interface)

**Enhancement:**
```typescript
/**
 * ACE IoT API Point Type
 *
 * CRITICAL FIELDS:
 * - name: Original point identifier from ACE IoT API (lowercase)
 *         Used for API queries and data mapping
 *         Example: "ses/ses_falls_city/Vav707.points.Damper"
 *
 * - display_name: Human-readable label (OPTIONAL)
 *                 Used for UI display only
 *                 Example: "VAV-707 Damper Position"
 *
 * IMPORTANT: Never use display_name for API queries or data filtering
 */
export interface AceIoTPoint {
  id: number;
  name: string;              // REQUIRED: Original point name (lowercase)
  display_name?: string;     // OPTIONAL: UI display label
  site?: string;
  gateway?: string;
  description?: string;
  unit?: string;
  point_type?: 'analog' | 'binary' | 'multistate' | string;
  tags?: string[];
  marker_tags?: string[];
  kv_tags?: Record<string, string>;
  enabled?: boolean;
  last_update?: string;
  last_value?: number | string | boolean;
  quality?: 'good' | 'bad' | 'uncertain';
  writable?: boolean;
  priority_array?: any[];
  metadata?: Record<string, any>;
}
```

---

## Testing Strategy

### Unit Tests

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\services\__tests__\pointNameNormalization.test.ts`

```typescript
import { normalizePointFields, filterAndGroupTimeseries } from '../paginatedTimeseriesService';
import { isValidPointForAPI } from '../../types/point.types';

describe('Point Name Normalization', () => {
  describe('normalizePointFields', () => {
    it('should normalize Name to name', () => {
      const point = { Name: 'test/point', display_name: 'Test' };
      const normalized = normalizePointFields(point);
      expect(normalized.name).toBe('test/point');
      expect(normalized.Name).toBeUndefined();
    });

    it('should preserve existing lowercase name', () => {
      const point = { name: 'test/point', display_name: 'Test' };
      const normalized = normalizePointFields(point);
      expect(normalized.name).toBe('test/point');
    });

    it('should prefer name over Name if both exist', () => {
      const point = { name: 'test/lowercase', Name: 'test/uppercase' };
      const normalized = normalizePointFields(point);
      expect(normalized.name).toBe('test/lowercase');
    });

    it('should normalize displayName to display_name', () => {
      const point = { name: 'test/point', displayName: 'Test Display' };
      const normalized = normalizePointFields(point);
      expect(normalized.display_name).toBe('Test Display');
      expect(normalized.displayName).toBeUndefined();
    });
  });

  describe('isValidPointForAPI', () => {
    it('should validate point with name field', () => {
      expect(isValidPointForAPI({ name: 'test/point' })).toBe(true);
    });

    it('should reject point without name', () => {
      expect(isValidPointForAPI({ id: 123 })).toBe(false);
    });

    it('should reject point with empty name', () => {
      expect(isValidPointForAPI({ name: '' })).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(isValidPointForAPI(null)).toBe(false);
      expect(isValidPointForAPI(undefined)).toBe(false);
    });
  });

  describe('filterAndGroupTimeseries integration', () => {
    it('should handle mixed field naming in real scenario', () => {
      const samples = [
        { point_name: 'site1/ahu1/temp', timestamp: '2025-01-10T00:00:00Z', value: 72 },
        { point_name: 'site1/ahu1/pressure', timestamp: '2025-01-10T00:00:00Z', value: 0.5 },
        { point_name: 'site1/vav1/damper', timestamp: '2025-01-10T00:00:00Z', value: 45 }
      ];

      const selectedPoints = [
        { Name: 'site1/ahu1/temp', display_name: 'AHU-1 Temperature' },
        { name: 'site1/ahu1/pressure', display_name: 'AHU-1 Pressure' },
        { name: 'site1/vav1/damper', displayName: 'VAV-1 Damper' }
      ];

      const result = filterAndGroupTimeseries(samples, selectedPoints);

      expect(Object.keys(result).length).toBe(3);
      expect(result['site1/ahu1/temp']).toBeDefined();
      expect(result['site1/ahu1/pressure']).toBeDefined();
      expect(result['site1/vav1/damper']).toBeDefined();
    });
  });
});
```

### Integration Tests

**File:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\src\hooks\__tests__\useChartData.integration.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useChartData } from '../useChartData';

describe('useChartData with Point Name Normalization', () => {
  it('should handle points with Name (capitalized) field', async () => {
    const selectedPoints = [
      { Name: 'test/point1', display_name: 'Test Point 1', id: 1 }
    ];

    const { result } = renderHook(() =>
      useChartData({
        selectedPoints,
        timeRange: { start: new Date(), end: new Date() },
        enabled: true
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should successfully fetch data despite capitalized Name field
    expect(result.current.data).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should handle mixed field naming', async () => {
    const selectedPoints = [
      { Name: 'test/point1', display_name: 'Point 1', id: 1 },
      { name: 'test/point2', display_name: 'Point 2', id: 2 }
    ];

    const { result } = renderHook(() =>
      useChartData({
        selectedPoints,
        timeRange: { start: new Date(), end: new Date() },
        enabled: true
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.point_samples?.length).toBe(2);
  });
});
```

---

## Rollback Plan

### If Implementation Causes Issues

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   npm run build
   npm run deploy
   ```

2. **Partial Rollback (Keep Type Guards, Remove Normalization):**
   - Revert changes to `paginatedTimeseriesService.ts`
   - Keep changes to type definitions and validation
   - Re-enable defensive `point.Name || point.name` checks

3. **Emergency Hotfix:**
   - Add feature flag to toggle normalization:
   ```typescript
   const ENABLE_POINT_NAME_NORMALIZATION = false; // Set to false for emergency rollback

   if (ENABLE_POINT_NAME_NORMALIZATION) {
     // Normalization logic
   } else {
     // Fallback to defensive checks
   }
   ```

---

## Risk Assessment

### High Risk Areas

1. **API Request Construction** (useChartData.ts line 166-171)
   - **Risk:** If normalization fails, API requests will use undefined names
   - **Mitigation:** Add validation before API call + fallback logic
   - **Testing:** Unit tests for point name extraction

2. **Data Mapping Back from API** (useChartData.ts line 478-481)
   - **Risk:** Response data may not match selected points if names don't align
   - **Mitigation:** Log mismatches in development mode
   - **Testing:** Integration tests with real API responses

3. **Enhancement Utilities** (kvTagParser.ts, pointEnhancer.ts)
   - **Risk:** Breaking existing enhancement logic
   - **Mitigation:** Preserve all original enhancement behavior
   - **Testing:** Regression tests for all enhancement scenarios

### Medium Risk Areas

1. **PointSelector Component** (line 290-329)
   - **Risk:** Point selection may fail if normalization breaks
   - **Mitigation:** Add error boundary + user feedback
   - **Testing:** UI tests for point selection

2. **HVAC Specialized Charts** (3 charts with name-based filtering)
   - **Risk:** Fallback logic may stop working
   - **Mitigation:** Update fallback to use normalized fields
   - **Testing:** Chart-specific tests

### Low Risk Areas

1. **Type Definitions** - Documentation only
2. **Development Logging** - No production impact
3. **Unit Tests** - Improves safety

---

## Implementation Order (Recommended)

### Day 1: Foundation (2-4 hours)
1. Add type guards and NormalizedPoint interface ✅
2. Write unit tests for normalization function ✅
3. Implement normalizePointFields utility ✅
4. Test in isolation ✅

### Day 2: Integration (4-6 hours)
1. Update paginatedTimeseriesService.ts with normalization ✅
2. Update enhancement utilities (kvTagParser, pointEnhancer) ✅
3. Add validation logging to useChartData ✅
4. Run integration tests ✅

### Day 3: UI Layer (2-3 hours)
1. Update PointSelector with normalization ✅
2. Add error boundaries ✅
3. Test point selection flow ✅
4. Verify chart rendering ✅

### Day 4: Testing & Validation (3-4 hours)
1. Run full test suite ✅
2. Manual testing with real data ✅
3. Check all chart types ✅
4. Verify 365-day time range ✅

### Day 5: Deployment (1-2 hours)
1. Code review ✅
2. Staging deployment ✅
3. Smoke tests ✅
4. Production deployment ✅
5. Monitor for issues ✅

**Total Estimated Time:** 12-19 hours (2-3 days)

---

## Success Criteria

### Functional Requirements
- ✅ All points use lowercase `name` field consistently
- ✅ No more defensive `point.Name || point.name` checks needed
- ✅ API requests use correct point names 100% of the time
- ✅ Data mapping back from API succeeds for all points
- ✅ Charts render correctly with all time ranges (1h to 365d)

### Performance Requirements
- ✅ No degradation in data fetching speed
- ✅ No additional memory overhead
- ✅ Normalization adds <1ms per point

### Quality Requirements
- ✅ Unit test coverage >90% for normalization code
- ✅ Integration tests pass for all chart types
- ✅ Zero console errors in production
- ✅ Validation warnings only in development mode

---

## Monitoring & Validation

### Post-Deployment Checks

1. **Monitor Console Logs** (Development)
   ```javascript
   // Look for these patterns:
   "✅ [useChartData] Validated point names"
   "⚠️ [useChartData] INVALID point name"
   "⚠️ [PointSelector] Point has 'Name' (capitalized) field"
   ```

2. **Check Chart Rendering** (Production)
   - Verify charts load data correctly
   - Test with various time ranges (1h, 24h, 7d, 30d, 365d)
   - Check all chart types (34 total)

3. **API Request Validation**
   - Monitor network tab for `/api/sites/{site}/timeseries/paginated` calls
   - Verify `points` parameter contains valid names
   - Check for 400 Bad Request errors (should be 0)

4. **User Feedback**
   - Monitor error logs for point selection issues
   - Check support tickets for chart rendering problems
   - Track user session recordings for point selector usage

---

## File-by-File Change Summary

| File | Lines Changed | Risk Level | Dependencies |
|------|--------------|-----------|--------------|
| `src/services/paginatedTimeseriesService.ts` | ~50 | HIGH | useChartData, all charts |
| `src/types/point.types.ts` | ~30 (new) | LOW | All point-related code |
| `src/utils/kvTagParser.ts` | ~15 | MEDIUM | Enhancement system |
| `src/utils/pointEnhancer.ts` | ~10 | MEDIUM | Enhancement system |
| `src/hooks/useChartData.ts` | ~20 | MEDIUM | All charts |
| `src/components/common/PointSelector.tsx` | ~10 | MEDIUM | Point selection |
| `functions/src/types/aceiot-api.types.ts` | ~15 (docs) | LOW | Backend types |

**Total Lines Changed:** ~150 lines
**Files Modified:** 7 files
**New Files:** 2 test files

---

## Code Snippets for Quick Reference

### Normalization Function
```typescript
function normalizePointFields(point: any): Point {
  return {
    ...point,
    name: point.name || point.Name,
    Name: undefined,
    display_name: point.display_name || point.displayName,
    displayName: undefined
  };
}
```

### Type Guard
```typescript
function isValidPointForAPI(point: any): point is { name: string } {
  return typeof point?.name === 'string' && point.name.length > 0;
}
```

### Safe Point Name Extraction
```typescript
const pointNames = selectedPoints
  .filter(isValidPointForAPI)
  .map(p => p.name);
```

### Enhanced Point Selection
```typescript
const normalizedPoint = {
  ...point,
  name: point.name || point.Name,
  display_name: point.display_name || point.displayName
};
```

---

## Related Documentation

- **Analysis Report:** `docs/POINT_NAME_PRESERVATION_ANALYSIS.md`
- **Data Fetching:** `docs/DATA_FETCHING_ANALYSIS.md`
- **Action Plan:** `docs/POINT_ENHANCEMENT_ACTION_PLAN.md`
- **API Types:** `functions/src/types/aceiot-api.types.ts`
- **Type Definitions:** `src/types/point.types.ts`

---

## Conclusion

This implementation plan provides a **systematic, low-risk approach** to normalizing point name fields across the Building Vitals codebase. By implementing changes in phases with comprehensive testing, we can ensure zero downtime and maintain data integrity.

**Key Benefits:**
- 🎯 Eliminates field name ambiguity
- 🐛 Prevents mapping failures
- 🚀 Improves code maintainability
- ✅ Maintains backward compatibility
- 🔍 Adds validation and safety checks

**Next Steps:**
1. Review this plan with the team
2. Get approval for implementation
3. Begin Day 1 tasks (type guards + tests)
4. Follow the 5-day implementation schedule

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Author:** Implementation Planning Agent
**Status:** ✅ Ready for Review and Implementation
