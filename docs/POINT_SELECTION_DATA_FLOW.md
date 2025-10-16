# Point Selection Data Flow Analysis

## Executive Summary

This document provides a comprehensive analysis of how point data flows through the Building Vitals application, from initial fetching to final API requests. The system intelligently enhances point names for user display while preserving original names for API communication.

**Key Principle**: Enhanced display names are created for user experience, but original point names are always preserved and used for timeseries API calls.

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          1. POINT DATA FETCHING                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  cachedSitePointService.fetchPointsForSite()                                 │
│  ├─ Fetches raw points from Cloudflare Worker                                │
│  ├─ Returns: { all: Point[], grouped: Record<string, Point[]> }             │
│  └─ Raw Point structure:                                                     │
│     {                                                                        │
│       id: string                                                             │
│       name: string                    ← ORIGINAL NAME (preserved forever)   │
│       Name?: string                   ← Alternative original name field     │
│       site: string                                                           │
│       kv_tags?: Record<string, string>                                       │
│       marker_tags?: string[]                                                 │
│       unit?: string                                                          │
│       ... other API fields                                                   │
│     }                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. POINT ENHANCEMENT LAYER                            │
│                         (usePointData.ts)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Enhancement Decision Tree:                                                  │
│                                                                              │
│  Point has KV tags? ────YES───▶ enhancePointWithKvTags()                    │
│        │                        (kvTagParser.ts)                             │
│        │                        • Parses JSON KV tags                        │
│        │                        • Extracts "dis" field for display name      │
│        │                        • Expands abbreviations (Da→Discharge Air)   │
│        │                        • Adds equipment context (RTU-6, VAV-12)     │
│        │                        • Generates marker tags                      │
│        │                        • Creates AI insights                        │
│        NO                                                                    │
│        │                                                                     │
│        ▼                                                                     │
│  Point needs standard enhancement? ──YES──▶ enhancePoint()                  │
│                                             (pointEnhancer.ts)               │
│                                             • Pattern-based equipment detect │
│                                             • Abbreviation expansion         │
│                                             • Unit detection                 │
│                                             • Marker tag generation          │
│                                             • AI recommendations             │
│                                                                              │
│  Enhanced Point Structure:                                                   │
│  {                                                                           │
│    ...originalFields,              ← ALL original fields preserved          │
│    name: "original/point/name",    ← ORIGINAL NAME unchanged               │
│    display_name: "RTU-6 Supply Air Temperature",  ← NEW user-friendly      │
│    unit: "°F",                     ← Enhanced or detected                   │
│    marker_tags: ["rtu", "temp", "sensor", "supply", "air"],                 │
│    equipment: "rtu",                                                         │
│    equipmentName: "RTU 6",                                                   │
│    ai_insights: {                                                            │
│      recommendations: ["Monitor for proper conditioning..."],               │
│      patterns: { comfort_zone: { min: 68, max: 76 } }                       │
│    },                                                                        │
│    quality_score: 85,                                                        │
│    _enhanced: true,                                                          │
│    _enhancedAt: "2025-10-10T..."                                             │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      3. UI DISPLAY LAYER                                     │
│                  (PointSelector.tsx)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User sees in dropdown/selector:                                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ ☑ RTU-6 Supply Air Temperature                             │ ← display_name
│  │   °F • rtu • temp • sensor                                 │ ← unit + tags
│  │   • Monitor for proper conditioning                        │ ← AI insight
│  ├────────────────────────────────────────────────────────────┤             │
│  │ ☑ VAV-12 Discharge Air Temperature                         │             │
│  │   °F • vav • temp • discharge                              │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  Tooltip on hover shows:                                                     │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ Original Name: BacnetNetwork.Rtu6_1.points.SaTemp          │ ← point.name
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  Component Logic (lines 174-178):                                            │
│  ```tsx                                                                      │
│  <Typography variant="body2" noWrap>                                         │
│    {point.display_name || point.displayName || point.name || point.Name}    │
│  </Typography>                                                               │
│  ```                                                                         │
│  Priority: display_name > displayName > name > Name                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4. POINT SELECTION & STORAGE                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User clicks checkbox → handlePointToggle() (line 291-329)                   │
│                                                                              │
│  Selected points stored in component state:                                  │
│  selectedPoints: Point[] = [                                                 │
│    {                                                                         │
│      id: "point-123",                                                        │
│      name: "BacnetNetwork.Rtu6_1.points.SaTemp",  ← ORIGINAL preserved      │
│      display_name: "RTU-6 Supply Air Temperature", ← Enhanced available     │
│      unit: "°F",                                                             │
│      marker_tags: ["rtu", "temp", "sensor", "supply"],                       │
│      equipment: "rtu",                                                       │
│      ai_insights: {...},                                                     │
│      ... ALL fields passed through                                           │
│    },                                                                        │
│    { ... next point ... }                                                    │
│  ]                                                                           │
│                                                                              │
│  CRITICAL: The entire enhanced Point object is stored,                       │
│            maintaining both display_name AND original name                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   5. CHART DATA PREPARATION                                  │
│                    (useChartData.ts)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Extract point names for API (lines 166-171):                                │
│                                                                              │
│  const pointNames = useMemo(() => {                                          │
│    if (!selectedPoints || !Array.isArray(selectedPoints)) {                 │
│      return [];                                                              │
│    }                                                                         │
│    return selectedPoints                                                     │
│      .filter(p => p?.name)          ← Uses ORIGINAL name field              │
│      .map((p) => p.name);           ← Extracts ORIGINAL names only          │
│  }, [selectedPoints]);                                                       │
│                                                                              │
│  Result:                                                                     │
│  pointNames = [                                                              │
│    "BacnetNetwork.Rtu6_1.points.SaTemp",       ← ORIGINAL API name          │
│    "BacnetNetwork.Vav12_1.points.DaTemp"       ← ORIGINAL API name          │
│  ]                                                                           │
│                                                                              │
│  Enhanced data is NOT used for API - only for display!                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    6. TIMESERIES API REQUEST                                 │
│              (cloudflareWorkerClient.ts → batchApiService.ts)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Call Flow:                                                              │
│                                                                              │
│  useChartData queryFn:                                                       │
│  └─▶ cloudflareWorkerClient.getTimeseries(                                   │
│        pointNames,        ← ORIGINAL names array                             │
│        startDate,                                                            │
│        endDate                                                               │
│      )                                                                       │
│      └─▶ batchApiService.getTimeseries({                                     │
│            points: pointNames,  ← ORIGINAL names                             │
│            start_time: "2025-10-09T00:00:00Z",                               │
│            end_time: "2025-10-10T00:00:00Z"                                  │
│          })                                                                  │
│          └─▶ POST /api/batch/timeseries                                      │
│              Headers: { "X-ACE-Token": "..." }                               │
│              Body: {                                                         │
│                points: [                                                     │
│                  "BacnetNetwork.Rtu6_1.points.SaTemp",  ← ORIGINAL          │
│                  "BacnetNetwork.Vav12_1.points.DaTemp"  ← ORIGINAL          │
│                ],                                                            │
│                start_time: "...",                                            │
│                end_time: "..."                                               │
│              }                                                               │
│                                                                              │
│  CRITICAL: Only original point names are sent to the API.                    │
│            Enhanced display names are never sent to backend.                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    7. API RESPONSE PROCESSING                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Response:                                                               │
│  {                                                                           │
│    point_samples: [                                                          │
│      {                                                                       │
│        pointName: "BacnetNetwork.Rtu6_1.points.SaTemp",  ← ORIGINAL         │
│        pointId: "point-123",                                                 │
│        data: [                                                               │
│          [1728518400000, 72.5],   ← [timestamp, value]                      │
│          [1728519000000, 73.1],                                              │
│          ...                                                                 │
│        ],                                                                    │
│        unit: "°F"                                                            │
│      },                                                                      │
│      { ... next point ... }                                                  │
│    ]                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    8. CHART SERIES TRANSFORMATION                            │
│                    (useChartData.ts lines 461-556)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Transform API response to chart series:                                     │
│                                                                              │
│  const series = timeseriesData.map((ts: any) => {                            │
│    const pointName = ts.pointName || ts.pointId;  ← ORIGINAL from API       │
│                                                                              │
│    // Find matching selected point to get enhanced metadata                 │
│    const originalPoint = selectedPoints?.find((p) =>                         │
│      (p?.name && p.name === pointName) ||      ← Match by ORIGINAL name     │
│      (p?.id && p.id === ts.pointId)                                          │
│    );                                                                        │
│                                                                              │
│    // Get enhanced display label                                            │
│    const formattedName = getPointDisplayLabel(                               │
│      {                                                                       │
│        name: pointName,                 ← ORIGINAL name                      │
│        marker_tags: originalPoint?.marker_tags,  ← Enhanced tags            │
│        unit: displayUnit                ← Enhanced unit                      │
│      },                                                                      │
│      { displayMode: 'smart', context: 'legend' }                             │
│    );                                                                        │
│                                                                              │
│    return {                                                                  │
│      name: pointName,                   ← ORIGINAL (for data matching)      │
│      formattedName,                     ← ENHANCED (for legend display)     │
│      data: processedData,               ← Timeseries [[ts, val], ...]       │
│      unit: displayUnit,                 ← Enhanced or API unit              │
│      markerTag: originalPoint?.markerTag,                                    │
│      markerTags: originalPoint?.marker_tags  ← Enhanced tags                │
│    };                                                                        │
│  });                                                                         │
│                                                                              │
│  Final chart series:                                                         │
│  [                                                                           │
│    {                                                                         │
│      name: "BacnetNetwork.Rtu6_1.points.SaTemp",     ← ORIGINAL             │
│      formattedName: "RTU-6 Supply Air Temperature",  ← ENHANCED for UI      │
│      data: [[1728518400000, 72.5], ...],                                     │
│      unit: "°F",                                                             │
│      markerTags: ["rtu", "temp", "sensor", "supply"]                         │
│    },                                                                        │
│    { ... }                                                                   │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       9. CHART RENDERING                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ECharts Configuration:                                                      │
│                                                                              │
│  {                                                                           │
│    series: [                                                                 │
│      {                                                                       │
│        name: "RTU-6 Supply Air Temperature",  ← Uses formattedName in UI    │
│        type: "line",                                                         │
│        data: [[timestamp, value], ...],                                      │
│        ...                                                                   │
│      }                                                                       │
│    ],                                                                        │
│    legend: {                                                                 │
│      data: ["RTU-6 Supply Air Temperature", ...]  ← formattedName shown     │
│    },                                                                        │
│    tooltip: {                                                                │
│      formatter: (params) => {                                                │
│        // Shows: "RTU-6 Supply Air Temperature: 72.5°F"                      │
│        return `${params.seriesName}: ${params.value[1]}°F`;                 │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  User sees in chart:                                                         │
│  • Legend: "RTU-6 Supply Air Temperature" (enhanced)                         │
│  • Tooltip: "RTU-6 Supply Air Temperature: 72.5°F" (enhanced)                │
│  • Y-axis: "Temperature (°F)" (enhanced unit)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Structure Transformations

### Stage 1: Raw Point from API
```typescript
{
  id: "point-123",
  name: "BacnetNetwork.Rtu6_1.points.SaTemp",
  site: "ses_falls_city",
  kv_tags: {
    dis: "SaTemp",
    unit: "degree_Fahrenheit",
    kind: "Number"
  },
  marker_tags: null,
  unit: null
}
```

### Stage 2: Enhanced Point (after usePointData)
```typescript
{
  // Original fields preserved
  id: "point-123",
  name: "BacnetNetwork.Rtu6_1.points.SaTemp",  // UNCHANGED
  site: "ses_falls_city",
  kv_tags: { ... },

  // Enhanced fields added
  display_name: "RTU-6 Supply Air Temperature",
  unit: "°F",
  marker_tags: ["rtu", "temp", "sensor", "supply", "air"],
  equipment: "rtu",
  equipmentId: "6",
  equipmentName: "RTU 6",
  ai_insights: {
    recommendations: ["Typical supply air: 55-60°F cooling..."],
    patterns: {}
  },
  quality_score: 85,
  _enhanced: true
}
```

### Stage 3: Point Names for API (from useChartData)
```typescript
pointNames = [
  "BacnetNetwork.Rtu6_1.points.SaTemp"  // ORIGINAL extracted
]
```

### Stage 4: API Request Body
```json
{
  "points": [
    "BacnetNetwork.Rtu6_1.points.SaTemp"  // ORIGINAL sent to API
  ],
  "start_time": "2025-10-09T00:00:00Z",
  "end_time": "2025-10-10T00:00:00Z"
}
```

### Stage 5: API Response
```json
{
  "point_samples": [
    {
      "pointName": "BacnetNetwork.Rtu6_1.points.SaTemp",  // ORIGINAL returned
      "data": [[1728518400000, 72.5], ...]
    }
  ]
}
```

### Stage 6: Chart Series (final)
```typescript
{
  name: "BacnetNetwork.Rtu6_1.points.SaTemp",      // ORIGINAL (for matching)
  formattedName: "RTU-6 Supply Air Temperature",   // ENHANCED (for display)
  data: [[1728518400000, 72.5], ...],
  unit: "°F",
  markerTags: ["rtu", "temp", "sensor", "supply"]
}
```

---

## Key Architecture Principles

### 1. **Name Preservation**
- **Original point names are NEVER modified** after fetching from API
- `point.name` field remains constant throughout the application
- All API calls use the original `point.name` value

### 2. **Enhancement is Additive**
- Enhancement adds new fields: `display_name`, enhanced `unit`, `marker_tags`, etc.
- Original fields are preserved alongside enhanced fields
- Point objects carry both original and enhanced data everywhere

### 3. **Display vs. API Separation**
- **UI Layer**: Uses `display_name` (or `displayName`) for user-friendly display
- **API Layer**: Uses `name` for backend communication
- Clear separation of concerns prevents confusion

### 4. **Enhancement Happens Once**
- Points are enhanced in `usePointData` hook immediately after fetching
- Enhanced points flow through the rest of the application
- No re-enhancement needed downstream

### 5. **Matching by Original Name**
- API responses return data keyed by original point names
- Chart series transformation matches API data to selected points by `point.name`
- Enhanced metadata is retrieved from the original selected point object

---

## Enhancement Strategies

### KV Tag Enhancement (kvTagParser.ts)
**When**: Point has `kv_tags` field with valid JSON

**Process**:
1. Parse JSON `kv_tags` array
2. Extract `dis` field → clean display name
3. Expand abbreviations (Sa → Supply Air, Temp → Temperature)
4. Add equipment context from point name path
5. Parse unit from `unit` field
6. Generate marker tags from characteristics
7. Create AI insights based on point type

**Example**:
```
Input:  name: "BacnetNetwork.Rtu6_1.points.SaTemp"
        kv_tags: { "dis": "SaTemp", "unit": "degree_Fahrenheit" }
Output: display_name: "RTU-6 Supply Air Temperature"
        unit: "°F"
        marker_tags: ["rtu", "temp", "sensor", "supply", "air"]
```

### Standard Enhancement (pointEnhancer.ts)
**When**: Point lacks KV tags but needs enhancement

**Process**:
1. Pattern matching for equipment (AHU, VAV, RTU, etc.)
2. Point type detection (temperature, pressure, flow, etc.)
3. Abbreviation expansion using dictionary
4. Unit inference from point type
5. Marker tag generation from patterns
6. AI insights based on HVAC best practices

**Example**:
```
Input:  name: "AHU-1:SA-T"
Output: display_name: "Air Handler 1 Supply Air Temperature"
        unit: "°F"
        marker_tags: ["ahu", "temp", "sensor", "supply", "air"]
        equipment: "ahu"
        equipmentName: "Air Handler 1"
```

---

## Search and Filtering

### Search Implementation (usePointData.ts lines 122-154)
Search prioritizes enhanced fields but always preserves original data:

```typescript
const filtered = allPoints.filter(point => {
  const lowerQuery = query.toLowerCase();

  // Search in display name first (most user-friendly)
  if (point.display_name?.toLowerCase().includes(lowerQuery)) return true;

  // Then original name
  if (point.name?.toLowerCase().includes(lowerQuery)) return true;

  // Then tags, unit, equipment
  if (point.marker_tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
  if (point.unit?.toLowerCase().includes(lowerQuery)) return true;

  return false;
});
```

**Benefits**:
- Users can search by friendly names ("Supply Air Temperature")
- Users can also search by original technical names
- Equipment-based search works (type "RTU" to find all RTU points)
- Tag-based filtering for advanced users

---

## Performance Optimizations

### 1. **Single Enhancement Pass**
- Points enhanced once in `usePointData` hook
- Enhanced objects reused throughout application
- No redundant enhancement calculations

### 2. **Memoization**
```typescript
// useChartData.ts
const pointNames = useMemo(() => {
  return selectedPoints.filter(p => p?.name).map(p => p.name);
}, [selectedPoints]);
```
- Point names extracted only when selection changes
- Prevents unnecessary re-renders

### 3. **Virtual Scrolling**
- Large point lists use react-window for virtualization
- Only visible points rendered in DOM
- Smooth scrolling with 50K+ points

### 4. **Caching Layers**
- IndexedDB cache for point metadata
- API response cache (5 minutes TTL)
- Request deduplication in batch service

---

## Error Handling

### Missing Display Names
```typescript
// Fallback chain in PointSelector.tsx
{point.display_name || point.displayName || point.name || point.Name}
```
- If enhancement fails, falls back to original name
- Application remains functional without enhancement

### API Mismatches
```typescript
// Chart series transformation
const originalPoint = selectedPoints?.find((p) =>
  (p?.name && p.name === pointName) ||
  (p?.id && p.id === ts.pointId)
);
```
- Matches API responses to selected points by original name OR id
- Handles both field name variations

### Empty Point Lists
- Graceful handling of empty arrays at all stages
- Clear user feedback when no points available
- Loading states during fetch operations

---

## Testing Recommendations

### Unit Tests
1. **Enhancement Functions**
   - Test `enhancePointWithKvTags()` with various KV tag formats
   - Test `enhancePoint()` with different naming patterns
   - Verify original name preservation

2. **Name Extraction**
   - Test `pointNames` extraction from selectedPoints
   - Verify only `name` field is used, not `display_name`

3. **Search Functionality**
   - Test search across display names and original names
   - Verify tag-based filtering
   - Test case-insensitive matching

### Integration Tests
1. **End-to-End Flow**
   - Fetch points → enhance → select → fetch timeseries → render chart
   - Verify original names used in API calls
   - Verify enhanced names shown in UI

2. **API Compatibility**
   - Mock API responses with original point names
   - Verify chart series match correctly
   - Test with missing/malformed data

---

## Common Pitfalls to Avoid

### ❌ **DON'T: Use display_name for API calls**
```typescript
// WRONG
const pointNames = selectedPoints.map(p => p.display_name);
await api.getTimeseries(pointNames);  // API won't recognize these!
```

### ✅ **DO: Always use original name for API**
```typescript
// CORRECT
const pointNames = selectedPoints.map(p => p.name);
await api.getTimeseries(pointNames);
```

### ❌ **DON'T: Modify point.name during enhancement**
```typescript
// WRONG
function enhancePoint(point) {
  point.name = cleanUpName(point.name);  // Breaks API calls!
  point.display_name = point.name;
}
```

### ✅ **DO: Add display_name without modifying name**
```typescript
// CORRECT
function enhancePoint(point) {
  return {
    ...point,
    name: point.name,  // Preserve original
    display_name: generateDisplayName(point.name)  // Add enhanced
  };
}
```

### ❌ **DON'T: Assume enhancement always succeeds**
```typescript
// WRONG
<div>{point.display_name}</div>  // Could be undefined!
```

### ✅ **DO: Provide fallbacks**
```typescript
// CORRECT
<div>{point.display_name || point.name}</div>
```

---

## Debugging Tips

### 1. **Trace Point Object Through Flow**
Add console logs at each stage:
```typescript
// After fetching
console.log('Raw point:', point);

// After enhancement
console.log('Enhanced point:', enhancedPoint);

// Before API call
console.log('Point names for API:', pointNames);

// After API response
console.log('API returned data for:', Object.keys(apiResponse.data));
```

### 2. **Verify Name Preservation**
```typescript
// In usePointData
console.assert(
  enhanced.name === original.name,
  'Original name was modified during enhancement!'
);
```

### 3. **Check API Request/Response**
```typescript
// In batchApiService
console.log('Sending to API:', request.points);
console.log('API returned:', Object.keys(response.data));
```

---

## Future Enhancements

### Potential Improvements
1. **Server-Side Enhancement**
   - Move enhancement to Cloudflare Worker
   - Reduce client-side processing
   - Cache enhanced points in KV store

2. **User Customization**
   - Allow users to override display names
   - Save custom names per user
   - Sync across devices

3. **AI-Enhanced Labeling**
   - Use LLM to generate context-aware names
   - Learn from user corrections
   - Improve equipment detection

4. **Performance Analytics**
   - Track enhancement quality scores
   - Monitor which points need better enhancement
   - A/B test different naming strategies

---

## Summary

The Building Vitals application implements a sophisticated **dual-name system**:

1. **Original Names**: Used for all API communication, never modified
2. **Display Names**: Generated for user experience, used only in UI

This architecture provides:
- ✅ **User-friendly interface** with readable point names
- ✅ **Reliable API communication** with original technical names
- ✅ **Backward compatibility** with existing API contracts
- ✅ **Rich metadata** for filtering, searching, and insights
- ✅ **Performance optimization** through caching and memoization

The key insight is that enhancement is **additive, not transformative** - we augment point data with new fields rather than replacing existing ones. This ensures the original contract with the API remains intact while providing a superior user experience.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Author**: Research Agent (Claude Code)
**Related Files**:
- `src/hooks/usePointData.ts`
- `src/components/common/PointSelector.tsx`
- `src/hooks/useChartData.ts`
- `src/utils/pointEnhancer.ts`
- `src/utils/kvTagParser.ts`
- `src/services/batchApiService.ts`
- `src/services/api/cloudflareWorkerClient.ts`
