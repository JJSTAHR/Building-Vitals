# Point Name Fix - Quick Reference Guide

**For Developers Implementing the Fix**

---

## 🎯 The 30-Second Summary

**Problem:** Codebase uses both `Name` (capitalized) and `name` (lowercase), causing mapping failures.

**Solution:** Normalize all points to use lowercase `name` consistently.

**Impact:** 7 files, ~150 lines, 2-3 days implementation.

---

## 🚀 Quick Start - Copy/Paste Code

### 1. Normalization Function (Core Utility)

**File:** `src/types/point.types.ts` (NEW)

```typescript
/**
 * Normalizes point field names to lowercase
 * Use this at ALL data entry points
 */
export function normalizePointFields(point: any): Point {
  return {
    ...point,
    name: point.name || point.Name,
    Name: undefined,
    display_name: point.display_name || point.displayName,
    displayName: undefined
  };
}

/**
 * Type guard for API-ready points
 */
export function isValidPointForAPI(point: any): point is { name: string } {
  return typeof point?.name === 'string' && point.name.length > 0;
}

/**
 * Normalized point interface
 */
export interface NormalizedPoint {
  name: string;              // REQUIRED
  display_name?: string;     // OPTIONAL
  id?: number | string;
  unit?: string;
  marker_tags?: string[];
}
```

### 2. Update Data Service

**File:** `src/services/paginatedTimeseriesService.ts`

**Find:** Line 179 - `export function filterAndGroupTimeseries`

**Replace with:**
```typescript
export function filterAndGroupTimeseries(
  allSamples: PointSample[],
  selectedPoints: Point[]
): GroupedTimeseriesData {
  // Normalize all points first
  const normalizedPoints = selectedPoints.map(normalizePointFields);

  // Extract valid point names
  const selectedPointNames = normalizedPoints
    .filter(p => p?.name)
    .map(p => p.name!);

  if (selectedPointNames.length === 0) {
    console.warn('[filterAndGroupTimeseries] No valid point names');
    return {};
  }

  const pointNameSet = new Set(selectedPointNames);
  const grouped: GroupedTimeseriesData = {};

  // Filter samples
  for (const sample of allSamples) {
    if (pointNameSet.has(sample.point_name)) {
      if (!grouped[sample.point_name]) {
        grouped[sample.point_name] = [];
      }
      grouped[sample.point_name].push({
        timestamp: new Date(sample.timestamp).getTime(),
        value: sample.value
      });
    }
  }

  return grouped;
}
```

### 3. Update Enhancement Utilities

**File:** `src/utils/kvTagParser.ts`

**Find:** Line 362 - `export function enhancePointWithKvTags`

**Add at start of function:**
```typescript
export function enhancePointWithKvTags(point: any): EnhancedPointWithKv {
  if (point._enhanced) return point;

  // ADD THIS - Normalize first
  const normalized = normalizePointFields(point);
  const enhanced: EnhancedPointWithKv = { ...normalized };

  // Rest of function stays the same...
}
```

**File:** `src/utils/pointEnhancer.ts`

**Find:** Line 466 - `export function enhancePoint`

**Add at start of function:**
```typescript
export function enhancePoint(point: Point): EnhancedPoint {
  if ((point as EnhancedPoint)._enhanced) {
    return point as EnhancedPoint;
  }

  // ADD THIS - Normalize first
  const normalized = normalizePointFields(point);
  const enhanced: EnhancedPoint = { ...normalized };

  // Rest of function stays the same...
}
```

### 4. Add Validation to useChartData

**File:** `src/hooks/useChartData.ts`

**Find:** Line 166-171 - Point name extraction

**Replace with:**
```typescript
const pointNames = useMemo(() => {
  if (!selectedPoints || !Array.isArray(selectedPoints)) {
    return [];
  }

  // Use type guard for validation
  const validPoints = selectedPoints.filter(isValidPointForAPI);

  if (validPoints.length < selectedPoints.length) {
    console.warn(
      `[useChartData] Filtered out ${selectedPoints.length - validPoints.length} invalid points`
    );
  }

  return validPoints.map(p => p.name);
}, [selectedPoints]);
```

### 5. Update PointSelector

**File:** `src/components/common/PointSelector.tsx`

**Find:** Line 290 - `const handlePointToggle`

**Add at start:**
```typescript
const handlePointToggle = useCallback((point: Point) => {
  // Validate point has name
  if (!point || (!point.name && !(point as any).Name)) {
    console.error('[PointSelector] Point missing name field:', point);
    return;
  }

  // Normalize before adding to selection
  const normalizedPoint = normalizePointFields(point);

  onPointsChange((prev) => {
    const currentSelection = Array.isArray(prev) ? prev : [];
    const isSelected = currentSelection.some(
      p => p?.id === normalizedPoint.id
    );

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

## ✅ Testing Checklist

### Unit Tests
```typescript
// Create: src/services/__tests__/pointNameNormalization.test.ts

import { normalizePointFields, isValidPointForAPI } from '../../types/point.types';

describe('normalizePointFields', () => {
  it('normalizes Name to name', () => {
    const point = { Name: 'test/point', display_name: 'Test' };
    const normalized = normalizePointFields(point);
    expect(normalized.name).toBe('test/point');
    expect(normalized.Name).toBeUndefined();
  });

  it('handles mixed field names', () => {
    const points = [
      { Name: 'point1', display_name: 'P1' },
      { name: 'point2', display_name: 'P2' }
    ];
    const normalized = points.map(normalizePointFields);
    expect(normalized[0].name).toBe('point1');
    expect(normalized[1].name).toBe('point2');
  });
});

describe('isValidPointForAPI', () => {
  it('validates points with name field', () => {
    expect(isValidPointForAPI({ name: 'test' })).toBe(true);
    expect(isValidPointForAPI({ id: 123 })).toBe(false);
    expect(isValidPointForAPI(null)).toBe(false);
  });
});
```

### Manual Testing
```bash
# 1. Start dev server
npm start

# 2. Open browser console
# 3. Navigate to dashboard
# 4. Select points for chart
# 5. Check console for warnings:
#    ✅ "[useChartData] Validated point names"
#    ❌ No errors about undefined names

# 6. Verify chart loads data
# 7. Test with different time ranges (1h, 24h, 7d, 365d)
# 8. Check Network tab - API requests should succeed
```

---

## 🐛 Debugging Guide

### Common Issues

#### Issue 1: Chart shows "No data available"
```typescript
// Check console for:
console.log('[useChartData] Point names:', pointNames);
// Should see: ['site/point1', 'site/point2']
// NOT: [undefined, undefined]

// If undefined, check:
1. Are points normalized in PointSelector?
2. Does filterAndGroupTimeseries normalize points?
3. Are type guards imported correctly?
```

#### Issue 2: API returns 400 Bad Request
```typescript
// Check Network tab - Request Body should be:
{
  "points": ["valid/point/name"],  // ✅ String
  "start_time": "2025-01-10T00:00:00Z",
  "end_time": "2025-01-10T23:59:59Z"
}

// NOT:
{
  "points": [undefined],  // ❌ Undefined
  ...
}
```

#### Issue 3: Points have both 'name' and 'Name' fields
```typescript
// Check normalization is happening:
const point = { Name: 'test', name: undefined };
const normalized = normalizePointFields(point);
console.log(normalized);
// Should output: { name: 'test', Name: undefined, ... }
```

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Day 1)
- [ ] Create `src/types/point.types.ts`
- [ ] Add `normalizePointFields()` function
- [ ] Add `isValidPointForAPI()` type guard
- [ ] Write unit tests
- [ ] Run tests: `npm test point.types`

### Phase 2: Services (Day 2)
- [ ] Update `paginatedTimeseriesService.ts` line 179
- [ ] Update `kvTagParser.ts` line 362
- [ ] Update `pointEnhancer.ts` line 466
- [ ] Run tests: `npm test`
- [ ] Check no regressions

### Phase 3: UI Layer (Day 3)
- [ ] Update `useChartData.ts` line 166
- [ ] Update `PointSelector.tsx` line 290
- [ ] Add validation logging
- [ ] Test point selection flow

### Phase 4: Testing (Day 4)
- [ ] Run full test suite
- [ ] Manual test with real data
- [ ] Test all chart types (34 total)
- [ ] Test time ranges (1h to 365d)

### Phase 5: Deploy (Day 5)
- [ ] Code review
- [ ] Staging deployment
- [ ] Smoke tests
- [ ] Production deployment
- [ ] Monitor logs for 24h

---

## 🚨 Rollback Commands

### Quick Rollback
```bash
# Revert the commit
git revert <commit-hash>

# Rebuild
npm run build

# Deploy
npm run deploy
```

### Emergency Feature Flag
```typescript
// Add to config if needed
const ENABLE_POINT_NAME_NORMALIZATION = false;

if (ENABLE_POINT_NAME_NORMALIZATION) {
  const normalized = normalizePointFields(point);
  // ... new logic
} else {
  // Fallback to defensive checks
  const name = point.name || point.Name;
}
```

---

## 📊 Performance Impact

**Expected:**
- Normalization: <1ms per point
- No memory overhead
- No API performance impact

**Monitor:**
```typescript
// Add to useChartData for performance tracking
console.time('[useChartData] Point normalization');
const normalized = selectedPoints.map(normalizePointFields);
console.timeEnd('[useChartData] Point normalization');
// Should be <5ms for 100 points
```

---

## 📞 Support

### Documentation
- **Full Plan:** `POINT_NAME_MAPPING_IMPLEMENTATION_PLAN.md`
- **Summary:** `IMPLEMENTATION_PLAN_SUMMARY.md`
- **Data Flow:** `POINT_NAME_DATA_FLOW.md`

### Issues?
1. Check console logs for warnings
2. Verify normalization is happening at all entry points
3. Test with simple point first (single point, 1h range)
4. Check Network tab for API request/response
5. Review related documentation above

---

## ✨ Success Indicators

After implementation, you should see:

✅ **Console Logs:**
```
[useChartData] Validated point names: ['site/point1', 'site/point2']
[filterAndGroupTimeseries] Processed 1000 samples, filtered to 500 for 2 points
```

✅ **Network Tab:**
```
POST /api/sites/test_site/timeseries/paginated
Status: 200 OK
Request: { points: ['valid/point'], start_time: '...', end_time: '...' }
Response: { point_samples: [...], has_more: false }
```

✅ **Chart UI:**
```
Chart renders with data
No "Failed to load data" errors
Legend shows display names correctly
```

❌ **What You Should NOT See:**
```
⚠️ [useChartData] INVALID point name: undefined
❌ 400 Bad Request
⚠️ Point has 'Name' (capitalized) field
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Author:** Implementation Planning Agent

**This is your quick reference - bookmark it!**
