# Point Data Flow Architecture Analysis

**Date:** 2025-10-16
**Purpose:** Complete data flow tracing from ACE IoT API through cleaning, storage, and search to identify disconnect between raw and cleaned point names.

---

## Executive Summary

### Key Finding: NO DISCONNECT IN PRIMARY FLOW ✅

The system **correctly** handles point name cleaning and search:
- Points are enhanced CLIENT-SIDE with `display_name` field
- Search prioritizes `display_name` before falling back to raw `name`
- UI displays `display_name` throughout

### Potential Issues Identified:
1. **Legacy search utilities** (pointSearchOptimizer, pointSearchWorker) index raw `name` only
2. These utilities are **NOT currently used** by PointSelector but could cause issues if enabled
3. No server-side storage of cleaned names (all client-side enhancement)

---

## 1. Complete Data Flow (Sequence Diagram)

```
┌─────────────┐
│  ACE IoT    │
│   API       │
└──────┬──────┘
       │ GET /api/sites/{siteId}/configured_points
       │ Returns: { Name: "SURGERYCHILLER-Capacity", ... }
       │
       v
┌─────────────────────────────────┐
│  Cloudflare Worker              │
│  (point-filter-worker.js)       │
│  - Adds per_page=10000          │
│  - Transforms headers           │
│  - NO name cleaning             │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  Frontend API Client            │
│  (cloudflareWorkerClient.ts)    │
│  - fetchPoints(siteId)          │
│  - Normalizes response          │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  usePointData Hook              │
│  (hooks/usePointData.ts)        │
│  - Fetches points               │
│  - Calls pointEnhancer          │
│  - Stores in React state        │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  Point Enhancement              │
│  (utils/pointEnhancer.ts)       │
│  CLIENT-SIDE PROCESSING:        │
│  - Generates display_name       │
│  - Parses equipment info        │
│  - Adds marker_tags             │
│  - Calculates quality_score     │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  Enhanced Point Object          │
│  {                              │
│    name: "SURGERYCHILLER-..."   │ ← Raw (API)
│    display_name: "Surgery..."   │ ← Cleaned (Client)
│    equipment: "chiller"         │
│    marker_tags: [...]           │
│  }                              │
└────────────┬────────────────────┘
             │
             ├──────────────┬──────────────┐
             v              v              v
      ┌───────────┐  ┌──────────┐  ┌──────────┐
      │  Search   │  │ Display  │  │  Chart   │
      │  (✅)     │  │  (✅)    │  │  (✅)    │
      └───────────┘  └──────────┘  └──────────┘
```

---

## 2. Component Interaction Diagram

```
┌────────────────────────────────────────────────────────────┐
│                      Building Vitals UI                    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PointSelector.tsx                               │    │
│  │  - Displays: display_name || name                │    │
│  │  - Tooltip: Shows original name                  │    │
│  │  - Line 176, 578                                 │    │
│  └───────────────────┬──────────────────────────────┘    │
│                      │                                     │
│                      v                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  usePointData Hook                               │    │
│  │  Search Priority (line 134-149):                 │    │
│  │  1. display_name  ✅ (Most user-friendly)        │    │
│  │  2. name/Name     ✅ (Raw from API)              │    │
│  │  3. id            ✅                              │    │
│  │  4. marker_tags   ✅                              │    │
│  │  5. unit          ✅                              │    │
│  │  6. equipmentName ✅                              │    │
│  └───────────────────┬──────────────────────────────┘    │
│                      │                                     │
│                      v                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  pointEnhancer.ts                                │    │
│  │  - enhancePoint(point)                           │    │
│  │  - parseEquipment()                              │    │
│  │  - detectPointType()                             │    │
│  │  - generateDisplayName()                         │    │
│  │  - generateMarkerTags()                          │    │
│  └───────────────────┬──────────────────────────────┘    │
└────────────────────┬─┴────────────────────────────────────┘
                     │
                     v
         ┌────────────────────────┐
         │  cachedSitePointService │
         │  (In-Memory Cache)      │
         └────────┬────────────────┘
                  │
                  v
      ┌─────────────────────────┐
      │ cloudflareWorkerClient  │
      │ - fetchPoints()         │
      │ - HTTP GET              │
      └────────┬────────────────┘
               │
               v
   ┌──────────────────────────┐
   │  Cloudflare Worker       │
   │  (Edge Proxy)            │
   └────────┬─────────────────┘
            │
            v
   ┌──────────────────────────┐
   │  ACE IoT API             │
   │  (Source of Truth)       │
   └──────────────────────────┘
```

---

## 3. Data Schema at Each Stage

### Stage 1: ACE IoT API Response
```json
{
  "Name": "SURGERYCHILLER-Capacity",
  "Client": "ses",
  "Site": "ses_falls_city",
  "kv_tags": "{}",
  "marker_tags": [],
  "collect_enabled": true
}
```
**Storage:** ACE IoT Cloud Database
**Format:** Raw point names from BACnet/IoT devices

---

### Stage 2: Cloudflare Worker (Proxy)
```json
{
  "Name": "SURGERYCHILLER-Capacity",
  "Client": "ses",
  "Site": "ses_falls_city",
  "kv_tags": "{}",
  "marker_tags": [],
  "collect_enabled": true
}
```
**Storage:** Edge cache (optional)
**Format:** Unchanged - worker only adds pagination
**File:** `workers/point-filter-worker.js` lines 134-136

---

### Stage 3: Frontend API Response
```json
{
  "items": [
    {
      "name": "SURGERYCHILLER-Capacity",
      "client": "ses",
      "site": "ses_falls_city",
      "kv_tags": {},
      "marker_tags": [],
      "collect_enabled": true
    }
  ]
}
```
**Storage:** React Query cache (5 min TTL)
**Format:** Normalized field names (Name → name)
**File:** `Building-Vitals/src/services/api/cloudflareWorkerClient.ts`

---

### Stage 4: Enhanced Point Object (Client-Side)
```typescript
{
  // Original fields (from API)
  name: "SURGERYCHILLER-Capacity",
  id: "ses/ses_falls_city/SURGERYCHILLER-Capacity",
  client: "ses",
  site: "ses_falls_city",

  // Enhanced fields (generated client-side)
  display_name: "Surgery Chiller Capacity",      // ← USER SEES THIS
  equipment: "chiller",
  equipmentId: "SURGERY",
  equipmentName: "Surgery Chiller",
  unit: "%",
  marker_tags: ["chiller", "equip", "hvac", "plant", "his", "point"],
  ai_insights: {
    recommendations: ["Track for demand response opportunities"],
    patterns: {}
  },
  quality_score: 85,
  _enhanced: true,
  _enhancedAt: "2025-10-16T12:00:00.000Z"
}
```
**Storage:** React component state + cachedSitePointService (in-memory)
**Format:** Fully enhanced with all computed fields
**File:** `Building-Vitals/src/utils/pointEnhancer.ts` lines 460-498

---

## 4. Storage Locations for Raw vs Cleaned Names

| Storage Location | Contains Raw Name | Contains Cleaned Name | Lifecycle |
|-----------------|-------------------|----------------------|-----------|
| **ACE IoT API** | ✅ `Name` field | ❌ No | Permanent |
| **Cloudflare Worker Edge Cache** | ✅ `Name` field | ❌ No | Per request |
| **React Query Cache** | ✅ `name` field | ❌ No | 5 minutes |
| **cachedSitePointService** | ✅ `name` field | ❌ No | Session |
| **usePointData state** | ✅ `name` field | ✅ `display_name` | Component lifecycle |
| **PointSelector state** | ✅ `name` field | ✅ `display_name` | Component lifecycle |

### Critical Observation:
**No server-side or persistent storage of cleaned names exists.**
All cleaning happens CLIENT-SIDE on every page load/refresh.

---

## 5. Search Indexing Analysis

### Primary Search (ACTIVE) ✅
**File:** `Building-Vitals/src/hooks/usePointData.ts`
**Lines:** 122-155
**Implementation:**
```typescript
const filtered = allPoints.filter(point => {
  // Search in display name first (most user-friendly)
  if (point.display_name?.toLowerCase().includes(lowerQuery)) return true;
  // Then original name (handle both cases)
  if (point.name?.toLowerCase().includes(lowerQuery)) return true;
  if (point.Name?.toLowerCase().includes(lowerQuery)) return true;
  // Then ID, tags, unit, equipment, site...
});
```

**Search Fields Priority:**
1. ✅ `display_name` (cleaned)
2. ✅ `name` / `Name` (raw)
3. ✅ `id`
4. ✅ `marker_tags`
5. ✅ `unit`
6. ✅ `equipmentName`
7. ✅ `equipmentType`
8. ✅ `Site`

**Status:** ✅ **CORRECT** - Prioritizes cleaned names

---

### Legacy Search Workers (INACTIVE) ⚠️

#### pointSearchOptimizer.ts
**File:** `Building-Vitals/src/services/pointSearchOptimizer.ts`
**Lines:** 140-148 (indexing), 273-329 (search)
**Implementation:**
```typescript
// Index name (split into tokens)
if (point.name) {
  const tokens = this.tokenize(point.name);  // ← RAW NAME ONLY
  // ...builds index
}
```

**Issues:**
- ❌ Only indexes raw `point.name`
- ❌ Does NOT index `display_name`
- ❌ Users searching for "Surgery Chiller" won't match "SURGERYCHILLER-Capacity"

**Status:** ⚠️ **NOT USED** by current PointSelector (but could be if enabled)

---

#### pointSearchWorker.ts
**File:** `Building-Vitals/src/workers/pointSearchWorker.ts`
**Lines:** 110-117 (search text generation)
**Implementation:**
```typescript
const searchableText = [
  point.name,         // ← RAW NAME
  point.id,
  point.type,
  point.unit,
  ...(point.marker_tags || [])
].filter(Boolean).join(' ').toLowerCase();
```

**Issues:**
- ❌ Does NOT include `display_name` in searchable text
- ❌ Would miss matches if user searches cleaned names

**Status:** ⚠️ **NOT USED** by current PointSelector (Web Worker not instantiated)

---

## 6. Critical Gaps in the Pipeline

### Gap 1: No Server-Side Cleaned Name Storage
**Impact:** Medium
**Description:** Cleaned names regenerated on every page load
**Location:** All enhancement happens in `pointEnhancer.ts` client-side
**Recommendation:** Consider storing `display_name` in D1 database or KV store

### Gap 2: Legacy Search Utilities Out of Sync
**Impact:** Low (currently unused)
**Description:** pointSearchOptimizer and pointSearchWorker don't index `display_name`
**Files:**
- `Building-Vitals/src/services/pointSearchOptimizer.ts` lines 140-148
- `Building-Vitals/src/workers/pointSearchWorker.ts` lines 110-117

**Recommendation:** Update if these utilities are re-enabled:
```typescript
// Add to searchable fields
const searchableText = [
  point.display_name,  // ← ADD THIS
  point.name,
  point.id,
  // ...rest
]
```

### Gap 3: No Mapping Between Raw and Cleaned Names
**Impact:** Low
**Description:** Can't reverse lookup from cleaned → raw
**Use Case:** API calls require raw names
**Current Solution:** Point object preserves both `name` and `display_name`

### Gap 4: Inconsistent Field Naming
**Impact:** Low
**Description:** API uses `Name` (capital), frontend normalizes to `name`
**Files:**
- ACE API: `Name`
- cloudflareWorkerClient: `name`
- Point type: `name` and `Name` fields

---

## 7. Integration Points Between Systems

### Point 1: ACE IoT API → Cloudflare Worker
**File:** `workers/point-filter-worker.js`
**Function:** `proxyToACE()` line 130
**Action:** Pass-through proxy, adds pagination
**Headers:** Transforms `x-ace-token` → `authorization: Bearer`

### Point 2: Cloudflare Worker → Frontend
**File:** `Building-Vitals/src/services/api/cloudflareWorkerClient.ts`
**Function:** `fetchPoints()` line 86
**Action:** HTTP GET with ACE token
**Returns:** Array normalized to `{ items: [...] }`

### Point 3: Frontend API → usePointData Hook
**File:** `Building-Vitals/src/hooks/usePointData.ts`
**Function:** `fetchPoints()` line 70
**Action:** Calls `cachedSitePointService.fetchPointsForSite()`
**Enhancement:** Lines 90-106

### Point 4: usePointData → PointSelector UI
**File:** `Building-Vitals/src/components/common/PointSelector.tsx`
**Props:** `points` from usePointData hook line 222
**Display:** `display_name || name` lines 176, 578

### Point 5: PointEnhancer → Enhanced Points
**File:** `Building-Vitals/src/utils/pointEnhancer.ts`
**Function:** `enhancePoint()` line 460
**Actions:**
- `generateDisplayName()` line 266
- `parseEquipment()` line 218
- `detectPointType()` line 240
- `generateMarkerTags()` line 301
- `generateAIInsights()` line 364

---

## 8. Key Function Reference

### Data Fetching
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `fetchPoints()` | cloudflareWorkerClient.ts | 86-126 | Fetch from Cloudflare Worker |
| `fetchPoints()` | usePointData.ts | 70-120 | Hook wrapper with enhancement |
| `fetchPointsForSite()` | cachedSitePointService.ts | N/A | Cache layer |

### Enhancement
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `enhancePoint()` | pointEnhancer.ts | 460-498 | Main enhancement |
| `generateDisplayName()` | pointEnhancer.ts | 266-298 | Clean name generation |
| `parseEquipment()` | pointEnhancer.ts | 218-236 | Extract equipment info |
| `detectPointType()` | pointEnhancer.ts | 240-261 | Detect type & unit |
| `generateMarkerTags()` | pointEnhancer.ts | 301-359 | Generate tags |

### Search
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `search()` | usePointData.ts | 123-155 | ✅ Active search (correct) |
| `handleSearch()` | pointSearchWorker.ts | 75-155 | ⚠️ Inactive (missing display_name) |
| `search()` | pointSearchOptimizer.ts | 235-338 | ⚠️ Inactive (missing display_name) |

### Display
| Component | File | Lines | Field Displayed |
|-----------|------|-------|----------------|
| VirtualRow | PointSelector.tsx | 176 | `display_name \|\| name` |
| Simple List | PointSelector.tsx | 578 | `display_name \|\| name` |
| Tooltip | PointSelector.tsx | 174, 576 | Original `name` |

---

## 9. Current System Status

### ✅ Working Correctly:
1. Point name cleaning via `pointEnhancer.ts`
2. Search prioritizes `display_name` in `usePointData.ts`
3. UI displays cleaned names consistently
4. Tooltips show original names for reference
5. Both cleaned and raw names searchable

### ⚠️ Potential Issues:
1. Legacy search utilities (optimizer, worker) would fail if enabled
2. No server-side storage of cleaned names (performance cost)
3. Cleaning regenerated on every page load

### ❌ Not Working:
- None identified in primary data flow

---

## 10. Recommendations

### Short-term (If Issues Reported):
1. ✅ Verify `usePointData` hook is used everywhere (it is)
2. ⚠️ Add `display_name` to legacy search utilities if re-enabled
3. ✅ Test search with both cleaned and raw names

### Medium-term (Performance):
1. Consider caching enhanced points in IndexedDB
2. Add service worker to persist cleaned names
3. Implement progressive enhancement (show raw → clean)

### Long-term (Architecture):
1. Store `display_name` server-side (D1 or KV)
2. Generate cleaned names during ETL process
3. Add reverse lookup index (cleaned → raw)
4. Implement smart fuzzy matching for typos

---

## 11. Testing Checklist

- [ ] Search for "Surgery Chiller" finds "SURGERYCHILLER-Capacity"
- [ ] Search for "SURGERYCHILLER" finds "SURGERYCHILLER-Capacity"
- [ ] Display shows "Surgery Chiller Capacity" not raw name
- [ ] Tooltip shows original name on hover
- [ ] Chart timeseries API calls use raw `name` field
- [ ] Selected points preserve both `name` and `display_name`
- [ ] Enhancement happens before search indexing
- [ ] Cache invalidation refreshes enhancement

---

## Conclusion

The **primary data flow is correct and working as expected**. Point names are:
1. Fetched raw from ACE IoT API
2. Enhanced client-side with `display_name`
3. Searched using `display_name` first
4. Displayed as cleaned names with raw name tooltips

The only concerns are:
1. **Legacy search utilities** need updating if re-enabled
2. **No server-side storage** of cleaned names (all client-side)
3. **Performance cost** of regenerating enhancements on every load

**No critical bugs found in the point name cleaning → search pipeline.**
