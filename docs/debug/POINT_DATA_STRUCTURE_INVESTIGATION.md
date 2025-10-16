# Point Data Structure Investigation Report

**Date**: 2025-10-13
**Objective**: Understand current point data structure and determine if API names are preserved for timeseries calls

## Executive Summary

**FINDINGS**: The system has **TWO separate name fields**:
1. **`point.name`** - The original ACE IoT API point name (e.g., `Building1:AHU1:SA-T`)
2. **`point.display_name`** - Client-side generated cleaned name (e.g., `Air Handler 1 Supply Air Temperature`)

**CRITICAL ISSUE**: The `name` field is being used for BOTH API calls AND UI display, causing confusion.

---

## 1. API Response Structure (from ACE IoT)

### Source: `functions/src/types/aceiot-api.types.ts`

```typescript
export interface AceIoTPoint {
  id: number;
  name: string;                    // ✅ ORIGINAL API NAME
  site?: string;
  site_id?: string;
  site_name?: string;
  gateway?: string;
  gateway_id?: string;
  gateway_name?: string;
  description?: string;
  unit?: string;
  point_type?: 'analog' | 'binary' | 'multistate' | string;
  tags?: string[];
  marker_tags?: string[];
  collect_enabled?: boolean;
  kv_tags?: Record<string, string>;
  bacnet_data?: {
    object_type?: string;
    object_instance?: number;
    device_id?: number;
    object_name?: string;           // 📍 THIS IS THE "CLEANED" NAME
    device_name?: string;
    [key: string]: any;
  };
  metadata?: AceIoTMetadata;
  created_at?: string;
  updated_at?: string;
}
```

**Key Observations**:
- ✅ ACE IoT API returns `point.name` as the **raw API identifier**
- ✅ `bacnet_data.object_name` contains a **more readable** version
- ❌ No dedicated `display_name` field from API

---

## 2. Frontend Point Type Definition

### Source: `src/types/api.ts`

```typescript
export interface Point {
  id: string;
  name: string;                    // ⚠️ USED FOR BOTH API & DISPLAY
  client: string;
  site: string;
  kv_tags?: Record<string, string> | string | any[];
  bacnet_data?: BacnetData;
  marker_tags?: string[];
  collect_config?: Record<string, string | number | boolean>;
  point_type?: string;
  collect_enabled?: boolean;
  collect_interval?: number;
  siteId: string;
  deviceId?: string;
  description?: string;
  metadata?: Record<string, string | number | boolean>;
  unit?: string;
  displayName?: string;            // 📍 OPTIONAL DISPLAY NAME

  // Enhanced fields from intelligent endpoints
  display_name?: string;           // 📍 CLEANED NAME (client-side)
  equipment?: string | null;
  equipment_type?: string | null;

  // Preserve original name for timeseries API calls
  original_name?: string;          // ❓ NEVER USED IN CODEBASE
}
```

**Key Observations**:
- ✅ Has `display_name` field (optional)
- ✅ Has `original_name` field (but **NEVER populated**)
- ⚠️ `name` field is overloaded for both API and display

---

## 3. Point Loading Service

### Source: `src/services/pointService.ts`

```typescript
// Line 98-109: Points loaded from cachedSitePointService
const allPoints: ConfiguredPoint[] = pythonPoints.map(
  (point) =>
    ({
      ...point,
      id: point.id || point.name,        // ✅ ID preserved
      name: point.name,                  // ✅ API name preserved
      collect_enabled: point.collect_enabled ?? true,
      collect_interval: point.collect_interval ?? 60,
      marker_tags: point.marker_tags || [],
      bacnet_data: point.bacnet_data,    // ✅ BACnet data preserved
    }) as ConfiguredPoint
);
```

**Key Observations**:
- ✅ **`point.name` is preserved** from API
- ✅ **`bacnet_data` is preserved** (including `object_name`)
- ❌ **NO `display_name` generation** at load time
- ❌ **NO cleaning** happens in the service

---

## 4. Client-Side Point Enhancement

### Source: `src/utils/pointEnhancer.ts`

```typescript
// Line 460-499: Enhancement function
export function enhancePoint(point: Point): EnhancedPoint {
  if ((point as EnhancedPoint)._enhanced) {
    return point as EnhancedPoint;
  }

  const enhanced: EnhancedPoint = { ...point };

  // Generate display name
  enhanced.display_name = generateDisplayName(point.name);  // 📍 CREATES CLEANED NAME

  // Detect equipment
  const equipment = parseEquipment(point.name);
  if (equipment) {
    enhanced.equipment = equipment.type;
    enhanced.equipmentId = equipment.id;
    enhanced.equipmentName = equipment.name;
  }

  // Detect point type and unit
  const pointType = detectPointType(point.name);
  if (pointType && !enhanced.unit) {
    enhanced.unit = pointType.unit;
  }

  // Generate marker tags
  enhanced.marker_tags = generateMarkerTags(point.name);

  // Mark as enhanced
  enhanced._enhanced = true;
  enhanced._enhancedAt = new Date().toISOString();

  return enhanced;
}
```

**Key Observations**:
- ✅ Enhancement is **opt-in** (only when called)
- ✅ Creates `display_name` **without modifying** `name`
- ✅ Preserves original `name` field
- ❌ **NOT automatically called** when points are loaded

---

## 5. SelectedPoint Type (Used in Dashboard)

### Source: `src/types/dashboard.ts`

```typescript
export interface SelectedPoint {
  id: string;
  name: string;                    // ⚠️ USED FOR API CALLS
  displayName?: string;            // 📍 OPTIONAL DISPLAY NAME
  unit?: string;
  color: string;
  marker_tags?: string[];
}
```

**Key Observations**:
- ✅ Has **both** `name` and `displayName`
- ⚠️ `name` is **required**, `displayName` is **optional**
- 📌 **`name` is used for API calls**, `displayName` for UI

---

## 6. UI Display Logic

### Source: `src/components/dashboard/SelectedPointsList.tsx` (Line 58)

```typescript
<ListItemText
  primary={point.displayName || point.name}  // ⚠️ FALLS BACK TO NAME
  secondary={...}
/>
```

**Key Observations**:
- ✅ Tries to use `displayName` first
- ⚠️ **Falls back to `name`** if no `displayName`
- 📌 This means **raw API names are shown** if `displayName` is missing

---

## 7. Point Metadata Tooltip

### Source: `src/components/common/PointMetadataTooltip.tsx`

```typescript
// Line 67-68: Shows raw name
<Typography sx={{ fontWeight: 'bold', mb: 0.5 }} variant="h6">
  {point.name}                      // ⚠️ ALWAYS SHOWS RAW NAME
</Typography>

// Line 230-236: Shows BACnet object_name
{point.bacnet_data.object_name && (
  <TableRow>
    <TableCell>Object Name:</TableCell>
    <TableCell>
      {point.bacnet_data.object_name}  // 📍 SHOWS CLEANED NAME
    </TableCell>
  </TableRow>
)}
```

**Key Observations**:
- ✅ Tooltip shows **both** `name` (raw) and `bacnet_data.object_name` (cleaned)
- 📌 This is the **only place** where both names are visible

---

## 8. Where "Cleaning" Happens

### Analysis Results:

1. **ACE IoT API** (Backend):
   - Stores `name` (raw) and `bacnet_data.object_name` (cleaned)
   - No transformation applied by API

2. **Firebase Functions** (Proxy):
   - No cleaning detected
   - Passes through API response unchanged

3. **Frontend pointService** (Data Loading):
   - No cleaning detected
   - Preserves `name` as-is

4. **Frontend pointEnhancer** (Optional Enhancement):
   - Generates `display_name` from `name`
   - **NOT automatically called**
   - Must be manually invoked

5. **UI Components**:
   - Use `displayName || name` pattern
   - If `displayName` missing, shows raw `name`

---

## 9. Critical Gaps Identified

### Gap 1: No Automatic Display Name Population

**Problem**: `display_name` is never automatically populated when points are loaded.

**Evidence**:
- `pointService.loadAllPoints()` doesn't call `enhancePoint()`
- `SelectedPoint` type has optional `displayName`
- UI components fall back to `name` when `displayName` is missing

**Impact**: Users see **raw API names** like `Building1:AHU1:SA-T` instead of friendly names.

---

### Gap 2: BACnet object_name Not Used

**Problem**: The **already-cleaned** `bacnet_data.object_name` from API is ignored.

**Evidence**:
- `object_name` exists in API response
- No code extracts `object_name` into `displayName`
- Only visible in metadata tooltip

**Impact**: Wasted opportunity - API already provides cleaned names!

---

### Gap 3: No Preservation of API Name

**Problem**: No clear separation between "API name" and "display name".

**Evidence**:
- `original_name` field exists but is **never populated**
- Both API calls and UI display use `name` field
- Risk of breaking API calls if `name` is modified

**Impact**: Confusion about which field to use for what purpose.

---

## 10. Recommended Solution

### Option A: Use BACnet object_name (Simplest)

**Implementation**:
```typescript
// In pointService.ts loadAllPoints()
const allPoints: ConfiguredPoint[] = pythonPoints.map((point) => ({
  ...point,
  id: point.id || point.name,
  name: point.name,                           // ✅ Keep for API calls
  displayName: point.bacnet_data?.object_name || point.name,  // 📍 ADD THIS
  collect_enabled: point.collect_enabled ?? true,
  collect_interval: point.collect_interval ?? 60,
  marker_tags: point.marker_tags || [],
  bacnet_data: point.bacnet_data,
}));
```

**Pros**:
- ✅ Uses **already-cleaned** data from API
- ✅ No client-side parsing needed
- ✅ Minimal code change (1 line)
- ✅ Preserves API name in `name` field

**Cons**:
- ⚠️ Depends on BACnet data being present
- ⚠️ Fallback to `name` if no `object_name`

---

### Option B: Enhance Points on Load (More Robust)

**Implementation**:
```typescript
// In pointService.ts loadAllPoints()
import { enhancePoint } from '../utils/pointEnhancer';

const allPoints: ConfiguredPoint[] = pythonPoints.map((point) => {
  const configured = {
    ...point,
    id: point.id || point.name,
    name: point.name,
    collect_enabled: point.collect_enabled ?? true,
    collect_interval: point.collect_interval ?? 60,
    marker_tags: point.marker_tags || [],
    bacnet_data: point.bacnet_data,
  };

  return enhancePoint(configured);  // 📍 AUTO-ENHANCE
});
```

**Pros**:
- ✅ Generates **smart display names**
- ✅ Works **without BACnet data**
- ✅ Adds equipment context, AI insights, etc.
- ✅ Consistent enhancement across all points

**Cons**:
- ⚠️ Slightly more CPU intensive
- ⚠️ May generate different names than BACnet

---

### Option C: Hybrid Approach (Best of Both)

**Implementation**:
```typescript
// In pointService.ts loadAllPoints()
const allPoints: ConfiguredPoint[] = pythonPoints.map((point) => {
  const configured = {
    ...point,
    id: point.id || point.name,
    name: point.name,                           // ✅ API name
    displayName: point.bacnet_data?.object_name || generateDisplayName(point.name),  // 📍 HYBRID
    collect_enabled: point.collect_enabled ?? true,
    collect_interval: point.collect_interval ?? 60,
    marker_tags: point.marker_tags || [],
    bacnet_data: point.bacnet_data,
  };

  return configured;
});
```

**Pros**:
- ✅ Uses **BACnet name** if available (most accurate)
- ✅ Falls back to **generated name** (works everywhere)
- ✅ Fast (no full enhancement needed)
- ✅ Best user experience

**Cons**:
- ⚠️ Requires importing `generateDisplayName` from enhancer

---

## 11. Answers to Original Questions

### Q1: When points are fetched from API, what fields does each point have?

**Answer**:
- ✅ `name` - Raw API identifier (e.g., `Building1:AHU1:SA-T`)
- ✅ `bacnet_data.object_name` - Cleaned name (e.g., `AHU1 Supply Air Temp`)
- ✅ `bacnet_data.device_name` - Device name
- ✅ `marker_tags` - Array of tags
- ✅ `kv_tags` - Key-value tags
- ✅ `unit` - Unit of measurement
- ❌ NO `display_name` field from API

---

### Q2: Is the full BACnet path stored anywhere?

**Answer**:
- ✅ Yes, in `bacnet_data` object:
  - `device_name` - Device name
  - `object_name` - Object name (cleaned)
  - `object_type` - BACnet object type
  - `device_id` - BACnet device ID
- ⚠️ Full hierarchical path not stored (just device + object)

---

### Q3: Where does the "cleaning" happen (API or frontend)?

**Answer**:
1. **ACE IoT API**: Provides `bacnet_data.object_name` (already cleaned)
2. **Frontend pointEnhancer**: Generates `display_name` (not automatically called)
3. **Actual Practice**: **NO cleaning happens** - raw names are shown

---

### Q4: Do we already have the API name but just not using it?

**Answer**:
- ✅ **YES!** The API provides `bacnet_data.object_name` which is a cleaned version
- ❌ **We're NOT using it** for display
- ✅ The `name` field is preserved correctly for API calls
- ⚠️ The problem is we're not **populating `displayName`** from `object_name`

---

## 12. Next Steps

### Immediate Action (Recommended):
1. Modify `pointService.ts` to populate `displayName` from `bacnet_data.object_name`
2. Add fallback to client-side `generateDisplayName()` if no BACnet data
3. Test that API calls still work correctly with `name` field
4. Verify UI shows friendly names everywhere

### File to Modify:
- `src/services/pointService.ts` (line 98-109)

### Verification Points:
1. ✅ API calls use `point.name` (unchanged)
2. ✅ UI displays `point.displayName` (newly populated)
3. ✅ Point selection works correctly
4. ✅ Charts render with friendly labels

---

## 13. Appendix: Example Point Structure

### Before (Current State):
```json
{
  "id": "12345",
  "name": "Building1:AHU1:SA-T",
  "displayName": null,  // ❌ NOT POPULATED
  "bacnet_data": {
    "device_name": "AHU1",
    "object_name": "Supply Air Temperature",  // ✅ IGNORED
    "object_type": "analog-input"
  }
}
```

### After (Proposed Fix):
```json
{
  "id": "12345",
  "name": "Building1:AHU1:SA-T",  // ✅ FOR API CALLS
  "displayName": "Supply Air Temperature",  // ✅ FROM BACNET OR ENHANCED
  "bacnet_data": {
    "device_name": "AHU1",
    "object_name": "Supply Air Temperature",
    "object_type": "analog-input"
  }
}
```

---

**End of Report**
