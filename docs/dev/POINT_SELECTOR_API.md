# Point Selector API Reference

## Table of Contents
1. [Core Functions](#core-functions)
2. [React Components](#react-components)
3. [Services](#services)
4. [Hooks](#hooks)
5. [Utilities](#utilities)
6. [Type Definitions](#type-definitions)
7. [Configuration Objects](#configuration-objects)
8. [Events](#events)

## Core Functions

### Point Enhancement Functions

#### `enhancePoint(rawPoint)`
Enhances a single BACnet point with cleaned names and metadata.

**Parameters:**
- `rawPoint` (Object): Raw point object with at minimum a `Name` property

**Returns:**
- `EnhancedPoint`: Enhanced point object with all cleaning applied

**Example:**
```javascript
const enhanced = enhancePoint({
  Name: 'S.FallsCity_CMC.Vav115.RoomTemp',
  Value: 72.5,
  object_id: 'point_123'
});

console.log(enhanced);
// {
//   Name: 'S.FallsCity_CMC.Vav115.RoomTemp',
//   Value: 72.5,
//   object_id: 'point_123',
//   display_name: 'VAV 115 - Room Temperature',
//   unit: '°F',
//   equipment: 'vav',
//   equipmentId: '115',
//   category: 'HVAC - VAV Terminals - Temperature',
//   confidence: 90,
//   ...
// }
```

#### `enhancePointsBatch(points)`
Process multiple points efficiently in batch.

**Parameters:**
- `points` (Array): Array of raw point objects

**Returns:**
- `Array<EnhancedPoint>`: Array of enhanced points

**Example:**
```javascript
const points = [
  { Name: 'Vav115.RoomTemp', Value: 72 },
  { Name: 'Vav115.ClgSp', Value: 74 },
  { Name: 'Vav115.Damper', Value: 45 }
];

const enhanced = enhancePointsBatch(points);
// Returns array of 3 enhanced points
```

#### `extractEquipment(bacnetPath)`
Extract equipment information from a BACnet path.

**Parameters:**
- `bacnetPath` (string): Complete BACnet path/point name

**Returns:**
- `EquipmentInfo | null`: Equipment object or null if not found

**Example:**
```javascript
const equipment = extractEquipment('S.FallsCity_CMC.Vav115.RoomTemp');
// {
//   type: 'vav',
//   id: '115',
//   display: 'VAV 115',
//   fullName: 'VAV-115',
//   raw: 'Vav115',
//   site: 'FallsCity_CMC'
// }
```

#### `extractPointType(bacnetPath)`
Extract point type and measurement information.

**Parameters:**
- `bacnetPath` (string): Complete BACnet path/point name

**Returns:**
- `PointTypeInfo`: Point type information object

**Example:**
```javascript
const pointInfo = extractPointType('Vav115.RoomTemp');
// {
//   pointType: 'temperature',
//   pointName: 'RoomTemp',
//   unit: '°F',
//   category: 'sensor',
//   subcategory: 'temperature',
//   purpose: 'room',
//   airStream: null,
//   waterType: null
// }
```

#### `formatDisplayName(equipment, point)`
Generate human-readable display name.

**Parameters:**
- `equipment` (Object): Equipment object from extractEquipment()
- `point` (Object): Point object from extractPointType()

**Returns:**
- `string`: Formatted display name

**Example:**
```javascript
const displayName = formatDisplayName(
  { display: 'VAV 115' },
  { pointName: 'RoomTemp', purpose: 'room' }
);
// 'VAV 115 - Room Temperature'
```

#### `categorizePoint(point, equipment)`
Assign UI category based on equipment and point type.

**Parameters:**
- `point` (Object): Point object with category/subcategory
- `equipment` (Object): Equipment object with type

**Returns:**
- `string`: Category string for UI grouping

**Example:**
```javascript
const category = categorizePoint(
  { subcategory: 'temperature' },
  { type: 'vav' }
);
// 'HVAC - VAV Terminals - Temperature'
```

## React Components

### `<EnhancedPointTooltip>`
Displays comprehensive point information in a tooltip.

**Props:**
```typescript
interface EnhancedPointTooltipProps {
  point: EnhancedPoint;
  children: React.ReactNode;
  delay?: number;           // Hover delay in ms (default: 500)
  position?: 'top' | 'bottom' | 'left' | 'right'; // (default: 'top')
  showConfidence?: boolean; // Show confidence score (default: true)
  showRawPath?: boolean;    // Show raw BACnet path (default: true)
  className?: string;       // Additional CSS classes
}
```

**Usage:**
```jsx
<EnhancedPointTooltip point={enhancedPoint}>
  <span>{enhancedPoint.display_name}</span>
</EnhancedPointTooltip>
```

### `<PointSelector>`
Main point selection component with search and filtering.

**Props:**
```typescript
interface PointSelectorProps {
  points: EnhancedPoint[];
  onSelect: (point: EnhancedPoint) => void;
  selectedPoints?: EnhancedPoint[];
  multiSelect?: boolean;
  enableSearch?: boolean;
  enableSemanticSearch?: boolean;
  groupByCategory?: boolean;
  showTooltips?: boolean;
  className?: string;
}
```

**Usage:**
```jsx
<PointSelector
  points={enhancedPoints}
  onSelect={handlePointSelect}
  multiSelect={true}
  enableSemanticSearch={true}
  groupByCategory={true}
/>
```

### `<PointSearchInput>`
Search input component with debouncing and suggestions.

**Props:**
```typescript
interface PointSearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;      // Debounce delay (default: 300)
  showSuggestions?: boolean; // Show search suggestions
  suggestionsCount?: number; // Max suggestions (default: 5)
  className?: string;
}
```

**Usage:**
```jsx
<PointSearchInput
  onSearch={handleSearch}
  placeholder="Search points..."
  showSuggestions={true}
/>
```

## Services

### SemanticSearchService

#### `semanticSearchService.initialize()`
Initialize the Universal Sentence Encoder model.

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await semanticSearchService.initialize();
```

#### `semanticSearchService.generateEmbeddings(points)`
Generate semantic embeddings for points.

**Parameters:**
- `points` (Array<Point>): Points to generate embeddings for

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await semanticSearchService.generateEmbeddings(enhancedPoints);
```

#### `semanticSearchService.search(query, points, options)`
Perform semantic search on points.

**Parameters:**
- `query` (string): Search query
- `points` (Array<Point>): Points to search
- `options` (SearchOptions): Search configuration

**Returns:**
- `Promise<SearchResult[]>`: Ranked search results

**Example:**
```javascript
const results = await semanticSearchService.search(
  'temperature sensors',
  enhancedPoints,
  {
    keywordWeight: 0.7,
    semanticWeight: 0.3,
    threshold: 0.2,
    maxResults: 50
  }
);
```

#### `semanticSearchService.clearMemory()`
Clear embeddings from memory.

**Example:**
```javascript
semanticSearchService.clearMemory();
```

#### `semanticSearchService.clearCache()`
Clear all cached embeddings.

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await semanticSearchService.clearCache();
```

### EmbeddingCache

#### `embeddingCache.getEmbedding(pointId)`
Retrieve cached embedding for a point.

**Parameters:**
- `pointId` (string): Point identifier

**Returns:**
- `Promise<Float32Array | null>`: Embedding array or null

**Example:**
```javascript
const embedding = await embeddingCache.getEmbedding('point_123');
```

#### `embeddingCache.setEmbedding(pointId, embedding)`
Store embedding in cache.

**Parameters:**
- `pointId` (string): Point identifier
- `embedding` (Float32Array): Embedding vector

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await embeddingCache.setEmbedding('point_123', embeddingVector);
```

## Hooks

### `useSemanticSearch()`
React hook for semantic search functionality.

**Returns:**
```typescript
{
  isReady: boolean;
  isLoading: boolean;
  search: (query: string, points: Point[]) => Promise<SearchResult[]>;
  clearCache: () => Promise<void>;
  memoryStats: { numTensors: number; numBytes: number };
}
```

**Usage:**
```jsx
function MyComponent() {
  const { isReady, search } = useSemanticSearch();

  const handleSearch = async (query) => {
    if (isReady) {
      const results = await search(query, points);
      setSearchResults(results);
    }
  };
}
```

### `useEnhancedPoints(rawPoints)`
React hook to enhance points with memoization.

**Parameters:**
- `rawPoints` (Array): Raw point objects

**Returns:**
- `Array<EnhancedPoint>`: Enhanced points

**Usage:**
```jsx
function MyComponent({ rawPoints }) {
  const enhancedPoints = useEnhancedPoints(rawPoints);

  return (
    <PointSelector points={enhancedPoints} />
  );
}
```

### `usePointTooltip(point, options)`
React hook for tooltip functionality.

**Parameters:**
- `point` (EnhancedPoint): Point to display
- `options` (Object): Tooltip options

**Returns:**
```typescript
{
  tooltipProps: Object;  // Props to spread on tooltip container
  targetProps: Object;   // Props to spread on target element
  isVisible: boolean;    // Tooltip visibility state
}
```

**Usage:**
```jsx
function PointWithTooltip({ point }) {
  const { tooltipProps, targetProps, isVisible } = usePointTooltip(point);

  return (
    <>
      <span {...targetProps}>{point.display_name}</span>
      {isVisible && (
        <div {...tooltipProps}>
          <PointTooltipContent point={point} />
        </div>
      )}
    </>
  );
}
```

## Utilities

### kvTagParser

#### `parseKvTags(kvString)`
Parse Haystack key-value tags.

**Parameters:**
- `kvString` (string): Key-value tag string

**Returns:**
- `Object`: Parsed tags object

**Example:**
```javascript
const tags = parseKvTags('dis:"Room Temp" unit:"°F" sensor');
// {
//   dis: 'Room Temp',
//   unit: '°F',
//   sensor: true
// }
```

#### `formatKvTags(tagsObject)`
Format tags object to key-value string.

**Parameters:**
- `tagsObject` (Object): Tags object

**Returns:**
- `string`: Formatted key-value string

**Example:**
```javascript
const kvString = formatKvTags({
  dis: 'Room Temp',
  unit: '°F',
  sensor: true
});
// 'dis:"Room Temp" unit:"°F" sensor'
```

### pointValidation

#### `validatePoint(point)`
Validate enhanced point structure.

**Parameters:**
- `point` (Object): Point to validate

**Returns:**
```typescript
{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

**Example:**
```javascript
const validation = validatePoint(enhancedPoint);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

#### `validateBatch(points)`
Validate multiple points and return statistics.

**Parameters:**
- `points` (Array): Points to validate

**Returns:**
```typescript
{
  totalPoints: number;
  validPoints: number;
  invalidPoints: number;
  errors: Map<string, string[]>;
  statistics: Object;
}
```

## Type Definitions

### Core Types

```typescript
interface RawPoint {
  Name: string;
  Value?: any;
  object_id?: string;
  object_type?: string;
  bacnet_prefix?: string;
  marker_tags?: string[];
}

interface EnhancedPoint extends RawPoint {
  display_name: string;
  unit: string | null;
  equipment: string | null;
  equipmentId: string | null;
  equipmentSubId: string | null;
  equipmentDisplay: string | null;
  equipmentFullName: string | null;
  category: string;
  pointType: string | null;
  pointCategory: string | null;
  pointSubcategory: string | null;
  purpose: string | null;
  airStream: string | null;
  waterType: string | null;
  confidence: number;
  _enhanced: boolean;
  _parsedEquipment: EquipmentInfo | null;
  _parsedPoint: PointInfo | null;
}

interface EquipmentInfo {
  type: string;
  id: string;
  subId?: string | null;
  display: string;
  fullName: string;
  raw: string;
  site?: string;
  floor?: string;
  location?: string;
}

interface PointInfo {
  pointType: string | null;
  pointName: string;
  unit: string | null;
  category: string | null;
  subcategory: string | null;
  purpose: string | null;
  airStream: string | null;
  waterType: string | null;
  rawName: string;
}
```

### Search Types

```typescript
interface SearchResult {
  point: EnhancedPoint;
  keywordScore: number;
  semanticScore: number;
  finalScore: number;
}

interface SearchOptions {
  keywordWeight?: number;    // Default: 0.7
  semanticWeight?: number;   // Default: 0.3
  threshold?: number;        // Minimum score threshold
  maxResults?: number;       // Maximum results to return
}
```

### Configuration Types

```typescript
interface EquipmentPattern {
  regex: RegExp;
  type: string;
  priority: number;
  format: (match: RegExpMatchArray) => EquipmentInfo;
  validate?: (equipment: EquipmentInfo) => boolean;
}

interface PointTypeConfig {
  patterns: RegExp[];
  unit: string | ((path: string) => string);
  category: string;
  subcategory: string;
  inference?: (path: string) => any;
}

interface CategoryRule {
  defaultCategory: string;
  subcategories: {
    [key: string]: string;
  };
}
```

## Configuration Objects

### EQUIPMENT_PATTERNS
Array of equipment detection patterns.

```javascript
const EQUIPMENT_PATTERNS = [
  {
    regex: /\b(Vav|VAV)[-_\s]?(\d+)(?:[-_\s](\d+))?\b/i,
    type: 'vav',
    priority: 10,
    format: (match) => ({
      type: 'vav',
      id: match[2],
      subId: match[3] || null,
      raw: match[0],
      display: `VAV ${match[2]}${match[3] ? `-${match[3]}` : ''}`,
      fullName: `VAV-${match[2]}${match[3] ? `-${match[3]}` : ''}`
    })
  },
  // ... more patterns
];
```

### ABBREVIATIONS
Mapping of abbreviations to expansions.

```javascript
const ABBREVIATIONS = {
  'Temp': 'Temperature',
  'Sp': 'Setpoint',
  'Sa': 'Supply Air',
  'Ra': 'Return Air',
  'Chw': 'Chilled Water',
  // ... 100+ more mappings
};
```

### POINT_TYPES
Point type detection configurations.

```javascript
const POINT_TYPES = {
  temperature: {
    patterns: [/Temp(?!Sp)/i, /Temperature/i],
    unit: '°F',
    category: 'sensor',
    subcategory: 'temperature'
  },
  damper: {
    patterns: [/Damper/i, /Dmp\b/i],
    unit: '%',
    category: 'actuator',
    subcategory: 'airflow'
  },
  // ... more types
};
```

### CATEGORY_RULES
UI categorization rules by equipment type.

```javascript
const CATEGORY_RULES = {
  'vav': {
    defaultCategory: 'HVAC - VAV Terminals',
    subcategories: {
      temperature: 'HVAC - VAV Terminals - Temperature',
      setpoint: 'HVAC - VAV Terminals - Setpoints',
      airflow: 'HVAC - VAV Terminals - Airflow',
      control: 'HVAC - VAV Terminals - Control'
    }
  },
  // ... more rules
};
```

## Events

### Point Selection Events

```javascript
// Listen for point selection
document.addEventListener('pointSelected', (event) => {
  const { point, multiSelect } = event.detail;
  console.log('Point selected:', point.display_name);
});

// Listen for point deselection
document.addEventListener('pointDeselected', (event) => {
  const { point } = event.detail;
  console.log('Point deselected:', point.display_name);
});
```

### Search Events

```javascript
// Listen for search start
document.addEventListener('searchStarted', (event) => {
  const { query } = event.detail;
  console.log('Searching for:', query);
});

// Listen for search complete
document.addEventListener('searchCompleted', (event) => {
  const { query, results, duration } = event.detail;
  console.log(`Found ${results.length} results in ${duration}ms`);
});
```

### Enhancement Events

```javascript
// Listen for enhancement start
document.addEventListener('enhancementStarted', (event) => {
  const { pointCount } = event.detail;
  console.log(`Enhancing ${pointCount} points...`);
});

// Listen for enhancement complete
document.addEventListener('enhancementCompleted', (event) => {
  const { pointCount, duration, averageConfidence } = event.detail;
  console.log(`Enhanced ${pointCount} points in ${duration}ms`);
});
```

## Error Handling

### Enhancement Errors

```javascript
try {
  const enhanced = enhancePoint(rawPoint);
} catch (error) {
  if (error.code === 'INVALID_POINT') {
    console.error('Invalid point structure:', error.message);
  } else if (error.code === 'PARSE_ERROR') {
    console.error('Failed to parse point name:', error.message);
  }
}
```

### Search Errors

```javascript
try {
  const results = await semanticSearchService.search(query, points);
} catch (error) {
  if (error.code === 'MODEL_NOT_LOADED') {
    console.error('Search model not initialized');
    // Fallback to keyword search
  } else if (error.code === 'EMBEDDING_ERROR') {
    console.error('Failed to generate embeddings:', error.message);
  }
}
```

## Performance Considerations

### Batch Size Recommendations

```javascript
// Optimal batch sizes for different operations
const BATCH_SIZES = {
  enhancement: 100,      // Points per enhancement batch
  embedding: 50,        // Points per embedding batch
  search: 1000,         // Max points per search operation
  display: 200          // Max points to display at once
};
```

### Memory Management

```javascript
// Clean up after large operations
function cleanupAfterBatchOperation() {
  // Clear TensorFlow memory
  semanticSearchService.clearMemory();

  // Clear DOM references
  document.querySelectorAll('.point-tooltip').forEach(el => el.remove());

  // Suggest garbage collection
  if (window.gc) window.gc();
}
```

## See Also
- [Architecture Guide](./POINT_SELECTOR_ARCHITECTURE.md)
- [Testing Guide](./POINT_SELECTOR_TESTING.md)
- [User Guide](../POINT_SELECTOR_USER_GUIDE.md)
- [Migration Guide](../POINT_SELECTOR_MIGRATION.md)

---
*Last Updated: December 2024*
*Version: 5.0.0*