# Point Selector Architecture Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Haystack Cleaning Algorithm](#haystack-cleaning-algorithm)
5. [Semantic Search Implementation](#semantic-search-implementation)
6. [Performance Optimizations](#performance-optimizations)
7. [Component Details](#component-details)
8. [Integration Points](#integration-points)
9. [Adding New Equipment Patterns](#adding-new-equipment-patterns)
10. [Extending Abbreviations](#extending-abbreviations)

## Architecture Overview

The enhanced point selector system is built on a multi-layered architecture that processes BACnet point names through several stages of enhancement, search, and display.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              UI Layer                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │        Point Selector Component with KV Tag Display            │     │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐     │     │
│  │  │ Virtual Scrolling│  │ Enhanced Point Tooltip         │     │     │
│  │  │   (50K+ points)  │  │ - API name with copy button    │     │     │
│  │  └──────────────────┘  │ - Display name                 │     │     │
│  │  ┌──────────────────┐  │ - Unit & equipment context     │     │     │
│  │  │ KV Tag Display   │  └────────────────────────────────┘     │     │
│  │  │ - Up to 3 tags   │                                          │     │
│  │  │ - Color-coded    │                                          │     │
│  │  │ - Priority-based │                                          │     │
│  │  └──────────────────┘                                          │     │
│  └────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           Service Layer                                   │
│  ┌────────────────────┐  ┌────────────────────────────────────────┐     │
│  │ KV Tag Parser      │  │ Point Name Cleaner (Fallback)          │     │
│  │ - Equipment detect │  │ - Haystack Algorithm                   │     │
│  │ - Abbreviation     │  │ - 15+ equipment types                  │     │
│  │   expansion (50+)  │  │ - Abbreviation expansion               │     │
│  │ - Marker tag gen   │  └────────────────────────────────────────┘     │
│  │ - AI insights      │                                                  │
│  └────────────────────┘                                                  │
│  ┌────────────────────┐  ┌────────────────────────────────────────┐     │
│  │ Semantic Search    │  │ Embedding Cache                        │     │
│  │ - TensorFlow.js    │  │ - IndexedDB storage                    │     │
│  │ - Hybrid scoring   │  │ - Per-site caching                     │     │
│  │ - Keyword fallback │  │ - LRU eviction                         │     │
│  └────────────────────┘  └────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                      │
│  ┌──────────────────┐  ┌────────────────────────────────────────┐       │
│  │  ACE IoT API     │  │  Enhanced Points with KV Tags          │       │
│  │  - Raw points    │──│  - display_name (from KV tag dis)      │       │
│  │  - KV tags JSON  │  │  - unit (converted to °F, %, etc.)     │       │
│  │  - Marker tags   │  │  - marker_tags (auto-generated)        │       │
│  │                  │  │  - equipment, pointFunction            │       │
│  │                  │  │  - ai_insights, quality_score          │       │
│  └──────────────────┘  └────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Progressive Enhancement**: Raw data is enhanced in stages, preserving original
3. **Performance First**: Batch processing and caching at every level
4. **Graceful Degradation**: System functions even if enhancement fails
5. **Extensibility**: Easy to add new equipment types and patterns

## System Components

### 1. KV Tag Parser (`kvTagParser.ts`)
**Purpose**: Parse ACE IoT KV tags and enrich point data with semantic metadata

**Key Functions**:
- `enhancePointWithKvTags()`: Main enhancement function using KV tag data
- `parseKvTags()`: Extract KV tag JSON from point data
- `extractEquipmentFromName()`: Identify equipment from path (supports 15+ types)
- `generateDisplayName()`: Create clean names with 50+ abbreviation expansions
- `generateMarkerTags()`: Auto-generate contextual tags based on characteristics
- `generateAIInsights()`: Provide recommendations based on point type and equipment

**Design Pattern**: Pipeline processor with KV-first, fallback strategy

**Equipment Support**: VAV, AHU, RTU, FCU, MAU, ERV, HRV, DOAS, VRF, UH, EF, RF, SF, CT, HX, PU, MZ, DP

**Bug Fixes Included**:
- #1: Proper TempSp/TempSetpt expansion order
- #2: Nested .points. path handling (extracts final segment correctly)
- #3: Air stream detection from point name only (not equipment name)
- #4: Abbreviation word boundary matching to avoid partial matches
- #5: Multiple space cleanup after expansion

### 2. Point Name Cleaner (`point-name-cleaner.js` - Fallback)
**Purpose**: Transform raw BACnet paths into human-readable names when KV tags unavailable

**Key Functions**:
- `enhancePoint()`: Main enhancement orchestrator
- `extractEquipment()`: Identify equipment from path
- `extractPointType()`: Determine point purpose and units
- `formatDisplayName()`: Generate clean display names
- `categorizePoint()`: Assign UI categories

**Design Pattern**: Pipeline processor with configurable patterns

### 2. Semantic Search Service (`semanticSearchService.ts`)
**Purpose**: Enable intelligent natural language search

**Key Features**:
- TensorFlow.js Universal Sentence Encoder integration
- Hybrid search (keyword + semantic)
- Embedding cache for performance
- Fallback to keyword search

**Design Pattern**: Singleton service with lazy loading

### 3. Enhanced Point Tooltip Component (`EnhancedPointTooltip.tsx`)
**Purpose**: Display comprehensive point information on hover with API-first design

**Key Features**:
- **API Name First**: Prominently displays full ACE IoT API path in monospace font
- **Copy Functionality**: One-click copy button with visual feedback (checkmark)
- **Display Name**: Shows cleaned, human-readable point name
- **Unit Display**: Shows unit from KV tags as colored chip
- **Equipment Context**: Shows equipment type and location if available
- **Theme-Aware**: Automatically adapts to light/dark mode
- **Smart Positioning**: Right-start placement with 500px max width
- **Accessibility**: Full keyboard navigation and ARIA labels

**Design Pattern**: React component with MUI Tooltip and state management for copy feedback

**Usage**:
```tsx
<EnhancedPointTooltip point={point}>
  <ListItemText primary={point.display_name} />
</EnhancedPointTooltip>
```

### 4. KV Tags Display Component (`KVTagsDisplay.tsx`)
**Purpose**: Render key-value tags inline with point information

**Key Features**:
- **Priority-Based Display**: Shows up to 3 most important tags
- **Color Coding**: Visual distinction by tag category
- **Grouped Display**: Organizes tags by system, device, sensor, etc.
- **Expandable**: Can show all tags with expand/collapse functionality
- **Tooltip Detail**: Hover on tag for full key-value information

**Tag Categories**:
- System (blue) - System-level configuration
- Device (teal) - Device-specific properties
- Sensor (pink) - Sensor measurements
- Unit (green) - Unit of measurement
- Meta (orange) - Metadata information
- Config (purple) - Configuration settings
- Identifier (gray) - IDs and unique identifiers

**Design Pattern**: React component with useMemo for performance

### 4. Embedding Cache (`embeddingCache.ts`)
**Purpose**: Persist computed embeddings for performance

**Storage Strategy**:
- IndexedDB for large datasets
- LRU eviction policy
- Versioned cache invalidation

## Data Flow

### Point Enhancement Pipeline

```
Raw BACnet Point
       │
       ▼
┌──────────────┐
│   Extract    │
│  Equipment   │──► Equipment Type, ID, Location
└──────────────┘
       │
       ▼
┌──────────────┐
│   Extract    │
│ Point Type   │──► Measurement Type, Units, Purpose
└──────────────┘
       │
       ▼
┌──────────────┐
│   Format     │
│Display Name  │──► Human-Readable Name
└──────────────┘
       │
       ▼
┌──────────────┐
│  Categorize  │
│    Point     │──► UI Category Assignment
└──────────────┘
       │
       ▼
Enhanced Point Object
```

### Search Flow

```
User Query
     │
     ├─────────────────┐
     ▼                 ▼
┌──────────┐    ┌──────────┐
│ Keyword  │    │ Semantic │
│  Match   │    │  Encode  │
└──────────┘    └──────────┘
     │                 │
     ▼                 ▼
┌──────────┐    ┌──────────┐
│  Score   │    │Similarity│
│  Calc    │    │  Calc    │
└──────────┘    └──────────┘
     │                 │
     └────────┬────────┘
              ▼
        ┌──────────┐
        │ Combine  │
        │  Scores  │
        └──────────┘
              │
              ▼
        Ranked Results
```

## Haystack Cleaning Algorithm

The Haystack cleaning algorithm is a sophisticated pattern-matching system that transforms technical BACnet point names into human-readable descriptions.

### Algorithm Steps

#### Step 1: Equipment Identification
```javascript
function extractEquipment(bacnetPath) {
  // Priority-based pattern matching
  for (pattern of EQUIPMENT_PATTERNS) {
    if (match = bacnetPath.match(pattern.regex)) {
      return pattern.format(match);
    }
  }
}
```

**Pattern Structure**:
```javascript
{
  regex: /\b(Vav|VAV)[-_\s]?(\d+)(?:[-_\s](\d+))?\b/i,
  type: 'vav',
  priority: 10,
  format: (match) => ({
    type: 'vav',
    id: match[2],
    subId: match[3],
    display: `VAV ${match[2]}${match[3] ? `-${match[3]}` : ''}`
  })
}
```

#### Step 2: Point Type Detection
```javascript
function extractPointType(bacnetPath) {
  // Extract last segment as point name
  const pointName = extractPointSegment(bacnetPath);

  // Match against point type patterns
  for ([type, config] of POINT_TYPES) {
    if (config.patterns.some(p => p.test(pointName))) {
      return {
        pointType: type,
        unit: resolveUnit(config.unit, bacnetPath),
        category: config.category
      };
    }
  }
}
```

#### Step 3: Abbreviation Expansion
```javascript
const ABBREVIATIONS = {
  'Temp': 'Temperature',
  'Sp': 'Setpoint',
  'Sa': 'Supply Air',
  'Chw': 'Chilled Water',
  // ... 100+ mappings
};

function expandAbbreviation(text) {
  return ABBREVIATIONS[text] || expandCamelCase(text);
}
```

#### Step 4: Display Name Generation
```javascript
function formatDisplayName(equipment, point) {
  const parts = [];

  // Add equipment identifier
  if (equipment) {
    parts.push(equipment.display);
  }

  // Add point description
  if (point.airStream) {
    parts.push(expandAbbreviation(point.airStream));
  }
  parts.push(expandPointName(point.pointName));

  return parts.join(' - ');
}
```

### Confidence Scoring

The algorithm assigns confidence scores based on parsing success:

```javascript
function calculateConfidence(equipment, point, displayName) {
  let score = 0;

  // Equipment detection (40 points)
  if (equipment) score += 30;
  if (equipment?.id) score += 10;

  // Point type detection (30 points)
  if (point?.pointType) score += 20;
  if (point?.unit) score += 10;

  // Display name quality (30 points)
  if (displayName?.length > 10) score += 10;
  if (hasMultipleMeaningfulWords(displayName)) score += 10;
  if (!containsRawPath(displayName)) score += 10;

  return Math.min(score, 100);
}
```

### Handling Edge Cases

#### Unrecognized Equipment
```javascript
// Fallback to generic parsing
if (!equipment) {
  equipment = {
    type: 'generic',
    display: extractGenericIdentifier(path)
  };
}
```

#### Complex Paths
```javascript
// Handle nested paths
"ses/ses_falls_city/device.Vav115.points.RoomTemp"
// Extracted: VAV 115, Room Temperature
```

#### Missing Information
```javascript
// Graceful degradation
if (!point.unit) {
  point.unit = inferUnitFromContext(point, equipment);
}
```

## Semantic Search Implementation

### TensorFlow.js Integration

#### Model Loading
```javascript
class SemanticSearchService {
  async initialize() {
    await tf.setBackend('webgl');
    await tf.ready();
    this.model = await use.load();
  }
}
```

#### Embedding Generation
```javascript
async generateEmbeddings(points) {
  // Batch processing for efficiency
  const batchSize = 100;

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    const texts = batch.map(p => this.getPointText(p));

    // Generate embeddings
    const embeddings = await this.model.embed(texts);

    // Store in cache
    await this.cacheEmbeddings(batch, embeddings);

    // Clean up tensors
    embeddings.dispose();
  }
}
```

#### Similarity Calculation
```javascript
cosineSimilarity(a, b) {
  const dotProduct = tf.sum(tf.mul(a, b));
  const normA = tf.sqrt(tf.sum(tf.square(a)));
  const normB = tf.sqrt(tf.sum(tf.square(b)));
  return tf.div(dotProduct, tf.mul(normA, normB));
}
```

### Hybrid Search Algorithm

```javascript
async search(query, points, options = {}) {
  const {
    keywordWeight = 0.7,
    semanticWeight = 0.3,
    threshold = 0
  } = options;

  const results = [];

  // Generate query embedding
  const queryEmbedding = await this.model.embed([query]);

  for (const point of points) {
    // Calculate keyword score
    const keywordScore = this.calculateKeywordScore(query, point);

    // Calculate semantic score
    const semanticScore = this.cosineSimilarity(
      queryEmbedding,
      point.embedding
    );

    // Combine scores
    const finalScore =
      (keywordWeight * keywordScore) +
      (semanticWeight * semanticScore);

    if (finalScore >= threshold) {
      results.push({ point, finalScore });
    }
  }

  return results.sort((a, b) => b.finalScore - a.finalScore);
}
```

### Keyword Scoring

```javascript
calculateKeywordScore(query, point) {
  const queryLower = query.toLowerCase();
  const pointText = this.getPointText(point);

  // Exact match scoring
  if (pointText.includes(queryLower)) {
    return 1.0;
  }

  // Word-level matching
  const queryWords = queryLower.split(/\s+/);
  const matches = queryWords.filter(w => pointText.includes(w));

  // Boost for display_name matches
  const displayBoost =
    point.display_name.toLowerCase().includes(queryLower) ? 1.5 : 1.0;

  return (matches.length / queryWords.length) * displayBoost;
}
```

## Performance Optimizations

### 1. Batch Processing
```javascript
// Process points in chunks to avoid blocking
function enhancePointsBatch(points) {
  const CHUNK_SIZE = 100;
  const enhanced = [];

  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const chunk = points.slice(i, i + CHUNK_SIZE);
    enhanced.push(...chunk.map(enhancePoint));

    // Yield to browser every chunk
    if (i % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return enhanced;
}
```

### 2. Caching Strategy
```javascript
class EmbeddingCache {
  constructor() {
    this.memory = new Map();
    this.storage = new IndexedDBCache();
  }

  async get(key) {
    // L1: Memory cache
    if (this.memory.has(key)) {
      return this.memory.get(key);
    }

    // L2: IndexedDB cache
    const stored = await this.storage.get(key);
    if (stored) {
      this.memory.set(key, stored);
      return stored;
    }

    return null;
  }
}
```

### 3. Lazy Loading
```javascript
// Load semantic search model only when needed
let semanticSearchPromise = null;

async function initializeSearchIfNeeded() {
  if (!semanticSearchPromise) {
    semanticSearchPromise = semanticSearchService.initialize();
  }
  return semanticSearchPromise;
}
```

### 4. Web Worker Processing
```javascript
// Offload heavy processing to worker
class PointSearchWorker {
  constructor() {
    this.worker = new Worker('/workers/pointSearchWorker.js');
  }

  async search(query, points) {
    return new Promise((resolve) => {
      this.worker.postMessage({ query, points });
      this.worker.onmessage = (e) => resolve(e.data);
    });
  }
}
```

### 5. Memory Management
```javascript
// Clean up tensors after use
class SemanticSearchService {
  clearMemory() {
    for (const tensor of this.embeddings.values()) {
      tensor.dispose();
    }
    this.embeddings.clear();

    // Force garbage collection hint
    if (global.gc) global.gc();
  }
}
```

## Component Details

### Enhanced Point Object Structure

```typescript
interface EnhancedPoint {
  // Original fields
  Name: string;
  Value: number;
  object_id: string;

  // Enhancement fields
  display_name: string;
  unit: string | null;
  equipment: string | null;
  equipmentId: string | null;
  equipmentSubId: string | null;
  equipmentDisplay: string | null;
  equipmentFullName: string | null;

  // Classification
  category: string;
  pointType: string | null;
  pointCategory: string | null;
  pointSubcategory: string | null;

  // Context
  purpose: string | null;
  airStream: string | null;
  waterType: string | null;

  // Metadata
  confidence: number;
  _enhanced: boolean;
  _parsedEquipment: EquipmentInfo | null;
  _parsedPoint: PointInfo | null;
}
```

### Equipment Pattern Configuration

```javascript
const EQUIPMENT_PATTERNS = [
  {
    regex: RegExp,           // Pattern to match
    type: string,           // Equipment type identifier
    priority: number,       // Matching priority (higher first)
    format: Function,       // Transform function
    validate?: Function     // Optional validation
  }
];
```

### Point Type Configuration

```javascript
const POINT_TYPES = {
  [typeName]: {
    patterns: RegExp[],     // Patterns to match
    unit: string | Function, // Unit or unit resolver
    category: string,       // Point category
    subcategory: string,    // Point subcategory
    inference?: Function    // Optional inference logic
  }
};
```

## Integration Points

### 1. API Integration
```javascript
// Cloudflare Worker endpoint
export async function handleEnhancedPoints(request, env) {
  const rawPoints = await fetchRawPoints(env);
  const enhanced = enhancePointsBatch(rawPoints);

  // Initialize search if requested
  if (request.headers.get('X-Enable-Search') === 'true') {
    await semanticSearchService.generateEmbeddings(enhanced);
  }

  return new Response(JSON.stringify({
    items: enhanced,
    searchEnabled: semanticSearchService.isReady()
  }));
}
```

### 2. React Component Integration
```jsx
function PointSelector() {
  const [points, setPoints] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load enhanced points
    fetchEnhancedPoints().then(setPoints);

    // Initialize semantic search
    semanticSearchService.initialize().then(() => {
      semanticSearchService.generateEmbeddings(points);
    });
  }, []);

  const filteredPoints = useMemo(() => {
    if (!searchQuery) return points;
    return semanticSearchService.search(searchQuery, points);
  }, [searchQuery, points]);

  return (
    <div>
      <SearchInput onChange={setSearchQuery} />
      <PointList points={filteredPoints} />
    </div>
  );
}
```

### 3. Tooltip Component
```jsx
function EnhancedPointTooltip({ point }) {
  return (
    <Tooltip
      content={
        <div className="point-tooltip">
          <div className="display-name">{point.display_name}</div>
          <div className="raw-name">Raw: {point.Name}</div>
          <div className="equipment">
            Equipment: {point.equipment} (ID: {point.equipmentId})
          </div>
          <div className="type">Type: {point.pointType}</div>
          <div className="unit">Unit: {point.unit}</div>
          <div className="category">Category: {point.category}</div>
          <div className="confidence">
            Confidence: {point.confidence}%
          </div>
        </div>
      }
    >
      {point.display_name}
    </Tooltip>
  );
}
```

## Adding New Equipment Patterns

### Step 1: Define the Pattern
```javascript
const NEW_EQUIPMENT = {
  regex: /\b(DOAS|Doas)[-_\s]?(\d+)\b/i,
  type: 'doas',
  priority: 9,
  format: (match) => ({
    type: 'doas',
    id: match[2],
    raw: match[0],
    display: `DOAS ${match[2]}`,
    fullName: `DOAS-${match[2]}`
  })
};
```

### Step 2: Add to EQUIPMENT_PATTERNS
```javascript
EQUIPMENT_PATTERNS.push(NEW_EQUIPMENT);
```

### Step 3: Define Category Rules
```javascript
CATEGORY_RULES['doas'] = {
  defaultCategory: 'HVAC - Dedicated Outdoor Air Systems',
  subcategories: {
    temperature: 'HVAC - DOAS - Temperature',
    humidity: 'HVAC - DOAS - Humidity',
    fan: 'HVAC - DOAS - Fans'
  }
};
```

### Step 4: Test the Pattern
```javascript
// Test cases
const testPoints = [
  'DOAS1.SupplyTemp',
  'Building.Doas_2.FanStatus',
  'doas-3.points.Humidity'
];

testPoints.forEach(point => {
  const result = enhancePoint({ Name: point });
  console.assert(result.equipment === 'doas');
  console.assert(result.confidence > 70);
});
```

## Extending Abbreviations

### Adding New Abbreviations
```javascript
// In ABBREVIATIONS object
const ABBREVIATIONS = {
  // Existing...

  // Add new abbreviations
  'Eco': 'Economizer',
  'Occ': 'Occupancy',
  'Vfd': 'Variable Frequency Drive',
  'Bms': 'Building Management System',
  'Ddp': 'Differential Pressure',
  'Lps': 'Low Pressure Switch',
  'Hps': 'High Pressure Switch'
};
```

### Creating Context-Aware Expansions
```javascript
function expandWithContext(abbr, context) {
  // Standard expansion
  if (ABBREVIATIONS[abbr]) {
    return ABBREVIATIONS[abbr];
  }

  // Context-aware expansion
  if (abbr === 'P') {
    if (context.includes('water')) return 'Pressure';
    if (context.includes('pump')) return 'Pump';
    if (context.includes('power')) return 'Power';
  }

  return abbr;
}
```

### Validating Abbreviations
```javascript
function validateAbbreviations() {
  const conflicts = new Map();

  for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
    // Check for conflicts
    const key = abbr.toLowerCase();
    if (conflicts.has(key)) {
      console.warn(`Conflict: ${abbr} → ${expansion} vs ${conflicts.get(key)}`);
    }
    conflicts.set(key, expansion);
  }

  return conflicts.size === Object.keys(ABBREVIATIONS).length;
}
```

## See Also
- [User Guide](../POINT_SELECTOR_USER_GUIDE.md)
- [API Reference](./POINT_SELECTOR_API.md)
- [Testing Guide](./POINT_SELECTOR_TESTING.md)
- [Migration Guide](../POINT_SELECTOR_MIGRATION.md)

---
*Last Updated: December 2024*
*Version: 5.0.0*