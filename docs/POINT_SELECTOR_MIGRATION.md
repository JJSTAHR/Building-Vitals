# Point Selector Migration Guide

## Table of Contents
1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Breaking Changes](#breaking-changes)
4. [Migration Steps](#migration-steps)
5. [Code Updates Required](#code-updates-required)
6. [Data Migration](#data-migration)
7. [Rollback Procedure](#rollback-procedure)
8. [Troubleshooting](#troubleshooting)
9. [Migration Checklist](#migration-checklist)

## Overview

This guide helps you migrate from the previous point selector implementation to the enhanced version 5.0.0. The new version includes significant improvements in point name cleaning, semantic search capabilities, and user experience enhancements.

### Migration Timeline
- **Preparation Phase**: 1-2 days
- **Migration Execution**: 2-4 hours
- **Testing & Validation**: 1-2 days
- **Rollback Window**: 7 days

### Version Compatibility
- **From Version**: 4.x.x or earlier
- **To Version**: 5.0.0+
- **Node.js Required**: 16.0.0 or higher
- **React Required**: 17.0.0 or higher
- **TypeScript Required**: 4.5.0 or higher

## What Changed

### Major Enhancements

#### 1. Point Name Enhancement System
**Before (v4.x):**
```javascript
// Raw BACnet names displayed directly
{
  Name: "S.FallsCity_CMC.Vav115.RoomTemp",
  Value: 72.5
}
// Displayed as: "S.FallsCity_CMC.Vav115.RoomTemp"
```

**After (v5.0):**
```javascript
// Enhanced with human-readable names
{
  Name: "S.FallsCity_CMC.Vav115.RoomTemp",
  Value: 72.5,
  display_name: "VAV 115 - Room Temperature",
  unit: "°F",
  equipment: "vav",
  equipmentId: "115",
  category: "HVAC - VAV Terminals - Temperature",
  confidence: 90
}
// Displayed as: "VAV 115 - Room Temperature [°F]"
```

#### 2. Semantic Search Implementation
**Before:**
- Basic string matching only
- Case-sensitive search
- No understanding of HVAC terminology

**After:**
- TensorFlow.js Universal Sentence Encoder
- Natural language understanding
- Hybrid keyword + semantic search
- HVAC-aware search results

#### 3. Enhanced Tooltips
**Before:**
- Simple text tooltips
- Limited information

**After:**
- Comprehensive information display
- Shows both clean and raw names
- Equipment details
- Confidence scores
- Unit information

### New Features Added
1. **Haystack Cleaning Algorithm** - Intelligent BACnet name parsing
2. **Equipment Pattern Recognition** - Automatic equipment identification
3. **Unit Inference** - Automatic unit detection
4. **Category Assignment** - Automatic UI grouping
5. **Batch Processing** - Optimized for large datasets
6. **Embedding Cache** - Performance optimization
7. **Confidence Scoring** - Parse quality indicators

### Dependencies Added
```json
{
  "@tensorflow/tfjs": "^4.10.0",
  "@tensorflow-models/universal-sentence-encoder": "^1.3.3"
}
```

## Breaking Changes

### 1. API Response Structure

#### Points Endpoint
**Before:**
```json
GET /api/points
{
  "items": [
    {
      "Name": "Vav115.RoomTemp",
      "Value": 72.5
    }
  ]
}
```

**After:**
```json
GET /api/enhanced-points
{
  "items": [
    {
      "Name": "Vav115.RoomTemp",
      "Value": 72.5,
      "display_name": "VAV 115 - Room Temperature",
      "unit": "°F",
      "equipment": "vav",
      "equipmentId": "115",
      "category": "HVAC - VAV Terminals - Temperature",
      "confidence": 90,
      "_enhanced": true
    }
  ],
  "version": "5.0.0"
}
```

### 2. Component Props Changes

#### PointSelector Component
**Before:**
```jsx
<PointSelector
  points={points}
  onSelect={handleSelect}
  displayField="Name"
/>
```

**After:**
```jsx
<PointSelector
  points={enhancedPoints}
  onSelect={handleSelect}
  displayField="display_name"  // Changed default
  enableSemanticSearch={true}  // New prop
  showTooltips={true}          // New prop
/>
```

### 3. Search Function Signature

**Before:**
```javascript
function searchPoints(query, points) {
  return points.filter(p =>
    p.Name.toLowerCase().includes(query.toLowerCase())
  );
}
```

**After:**
```javascript
async function searchPoints(query, points, options = {}) {
  return await semanticSearchService.search(query, points, {
    keywordWeight: 0.7,
    semanticWeight: 0.3,
    threshold: 0,
    maxResults: 50,
    ...options
  });
}
```

### 4. Event Names Changed

| Old Event | New Event | Notes |
|-----------|-----------|-------|
| `point-selected` | `pointSelected` | camelCase convention |
| `search-complete` | `searchCompleted` | Past tense convention |
| `points-loaded` | `enhancementCompleted` | More specific |

## Migration Steps

### Step 1: Update Dependencies

```bash
# Update package.json
npm install @tensorflow/tfjs@^4.10.0
npm install @tensorflow-models/universal-sentence-encoder@^1.3.3

# Update existing packages
npm update react react-dom
npm update typescript @types/react

# Install new development dependencies
npm install --save-dev @types/tensorflow__tfjs
```

### Step 2: Update Import Statements

**Before:**
```javascript
import { fetchPoints } from './services/pointService';
import PointList from './components/PointList';
```

**After:**
```javascript
import { enhancePointsBatch } from './services/point-name-cleaner';
import { semanticSearchService } from './services/semanticSearch/semanticSearchService';
import PointSelector from './components/charts/PointSelector';
import EnhancedPointTooltip from './components/common/EnhancedPointTooltip';
```

### Step 3: Update API Calls

**Before:**
```javascript
const fetchPointData = async () => {
  const response = await fetch('/api/points');
  const data = await response.json();
  setPoints(data.items);
};
```

**After:**
```javascript
const fetchPointData = async () => {
  // Option 1: Use new enhanced endpoint
  const response = await fetch('/api/enhanced-points');
  const data = await response.json();
  setPoints(data.items);

  // Option 2: Enhance on client side
  const response = await fetch('/api/points');
  const data = await response.json();
  const enhanced = enhancePointsBatch(data.items);
  setPoints(enhanced);

  // Initialize semantic search if needed
  if (enableSearch) {
    await semanticSearchService.initialize();
    await semanticSearchService.generateEmbeddings(enhanced);
  }
};
```

### Step 4: Update Component Usage

**Before:**
```jsx
function PointDisplay({ point }) {
  return (
    <div className="point-item">
      <span>{point.Name}</span>
      <span>{point.Value}</span>
    </div>
  );
}
```

**After:**
```jsx
function PointDisplay({ point }) {
  return (
    <EnhancedPointTooltip point={point}>
      <div className="point-item">
        <span className="point-name">{point.display_name}</span>
        <span className="point-value">
          {point.Value} {point.unit}
        </span>
        {point.confidence < 70 && (
          <span className="confidence-warning" title="Low confidence parse">
            ⚠️
          </span>
        )}
      </div>
    </EnhancedPointTooltip>
  );
}
```

### Step 5: Update Search Implementation

**Before:**
```jsx
function SearchablePointList({ points }) {
  const [query, setQuery] = useState('');

  const filtered = points.filter(p =>
    p.Name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <PointList points={filtered} />
    </div>
  );
}
```

**After:**
```jsx
function SearchablePointList({ points }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(points);
  const [isSearchReady, setIsSearchReady] = useState(false);

  useEffect(() => {
    // Initialize semantic search
    semanticSearchService.initialize().then(() => {
      semanticSearchService.generateEmbeddings(points);
      setIsSearchReady(true);
    });
  }, [points]);

  useEffect(() => {
    const performSearch = async () => {
      if (!query) {
        setResults(points);
        return;
      }

      if (isSearchReady) {
        const searchResults = await semanticSearchService.search(
          query,
          points
        );
        setResults(searchResults.map(r => r.point));
      } else {
        // Fallback to keyword search
        const filtered = points.filter(p =>
          p.display_name.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
      }
    };

    performSearch();
  }, [query, points, isSearchReady]);

  return (
    <div>
      <PointSearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search using natural language..."
      />
      <PointSelector points={results} />
    </div>
  );
}
```

## Code Updates Required

### 1. Update Type Definitions

```typescript
// types/point.ts

// Add new enhanced point type
export interface EnhancedPoint extends Point {
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
}
```

### 2. Update Redux Store (if applicable)

```javascript
// store/slices/pointsSlice.js
const pointsSlice = createSlice({
  name: 'points',
  initialState: {
    items: [],
    enhanced: [],
    searchResults: [],
    isSearchReady: false
  },
  reducers: {
    setPoints: (state, action) => {
      state.items = action.payload;
      // Enhance points automatically
      state.enhanced = enhancePointsBatch(action.payload);
    },
    setSearchResults: (state, action) => {
      state.searchResults = action.payload;
    },
    setSearchReady: (state, action) => {
      state.isSearchReady = action.payload;
    }
  }
});
```

### 3. Update Test Files

```javascript
// __tests__/points.test.js

// Update test data
const mockEnhancedPoint = {
  Name: 'Vav115.RoomTemp',
  Value: 72.5,
  display_name: 'VAV 115 - Room Temperature',
  unit: '°F',
  equipment: 'vav',
  equipmentId: '115',
  confidence: 90,
  _enhanced: true
};

// Update assertions
expect(enhancedPoint.display_name).toBe('VAV 115 - Room Temperature');
expect(enhancedPoint.unit).toBe('°F');
expect(enhancedPoint.confidence).toBeGreaterThan(70);
```

## Data Migration

### Migrating Cached Data

```javascript
// migration/migrateCachedPoints.js
async function migrateCachedPoints() {
  // Get old cached data
  const oldCache = localStorage.getItem('cachedPoints');
  if (!oldCache) return;

  const oldPoints = JSON.parse(oldCache);

  // Enhance old points
  const enhancedPoints = enhancePointsBatch(oldPoints);

  // Store in new format
  localStorage.setItem('enhancedPoints_v5', JSON.stringify({
    points: enhancedPoints,
    version: '5.0.0',
    timestamp: Date.now()
  }));

  // Optional: Remove old cache after verification
  // localStorage.removeItem('cachedPoints');
}
```

### Migrating User Preferences

```javascript
// migration/migratePreferences.js
function migrateUserPreferences() {
  const oldPrefs = JSON.parse(localStorage.getItem('pointSelectorPrefs') || '{}');

  const newPrefs = {
    ...oldPrefs,
    displayField: 'display_name', // Changed from 'Name'
    enableSemanticSearch: true,    // New preference
    showTooltips: true,            // New preference
    showConfidenceScores: false,  // New preference
    preferredView: oldPrefs.view || 'enhanced' // New preference
  };

  localStorage.setItem('pointSelectorPrefs_v5', JSON.stringify(newPrefs));
}
```

### Database Migration (if applicable)

```sql
-- Add new columns to points table
ALTER TABLE points
ADD COLUMN display_name VARCHAR(255),
ADD COLUMN unit VARCHAR(50),
ADD COLUMN equipment VARCHAR(50),
ADD COLUMN equipment_id VARCHAR(50),
ADD COLUMN category VARCHAR(100),
ADD COLUMN confidence INTEGER,
ADD COLUMN enhanced_at TIMESTAMP;

-- Create index for search performance
CREATE INDEX idx_points_display_name ON points(display_name);
CREATE INDEX idx_points_equipment ON points(equipment, equipment_id);
CREATE INDEX idx_points_category ON points(category);
```

## Rollback Procedure

### Preparation for Rollback

1. **Backup Current State**
```bash
# Backup current code
git tag pre-v5-migration
git push origin pre-v5-migration

# Backup database (if applicable)
pg_dump -U user -d database > backup_pre_v5.sql

# Backup cached data
cp -r localStorage_backup localStorage_backup_v5
```

2. **Create Rollback Branch**
```bash
git checkout -b rollback-v5
git push origin rollback-v5
```

### Rollback Steps

#### Step 1: Revert Code Changes
```bash
# Option 1: Revert to previous version
git checkout tags/v4.x.x
npm install

# Option 2: Use rollback branch
git checkout rollback-v5
git revert HEAD~n  # n = number of commits to revert
```

#### Step 2: Restore Dependencies
```json
// package.json - Remove new dependencies
{
  "dependencies": {
    // Remove these:
    // "@tensorflow/tfjs": "^4.10.0",
    // "@tensorflow-models/universal-sentence-encoder": "^1.3.3"
  }
}
```

```bash
npm install
npm prune  # Remove unused packages
```

#### Step 3: Restore API Endpoints
```javascript
// Restore old endpoint behavior
app.get('/api/points', (req, res) => {
  // Return non-enhanced points
  const points = getOriginalPoints();
  res.json({ items: points });
});
```

#### Step 4: Clear Enhanced Data
```javascript
// Clear enhanced caches
localStorage.removeItem('enhancedPoints_v5');
localStorage.removeItem('pointSelectorPrefs_v5');
localStorage.removeItem('embeddings_cache');

// Clear IndexedDB
const deleteDB = indexedDB.deleteDatabase('PointEmbeddings');
```

#### Step 5: Restore Database (if applicable)
```sql
-- Remove new columns
ALTER TABLE points
DROP COLUMN display_name,
DROP COLUMN unit,
DROP COLUMN equipment,
DROP COLUMN equipment_id,
DROP COLUMN category,
DROP COLUMN confidence,
DROP COLUMN enhanced_at;

-- Drop new indexes
DROP INDEX idx_points_display_name;
DROP INDEX idx_points_equipment;
DROP INDEX idx_points_category;
```

### Verification After Rollback

```javascript
// verify-rollback.js
function verifyRollback() {
  const checks = {
    apiVersion: checkApiVersion(),
    dependencies: checkDependencies(),
    dataFormat: checkDataFormat(),
    features: checkFeatures()
  };

  console.log('Rollback Verification:');
  Object.entries(checks).forEach(([check, result]) => {
    console.log(`${check}: ${result ? '✅' : '❌'}`);
  });

  return Object.values(checks).every(Boolean);
}

function checkApiVersion() {
  return fetch('/api/version')
    .then(r => r.json())
    .then(d => d.version.startsWith('4.'));
}

function checkDependencies() {
  const pkg = require('./package.json');
  return !pkg.dependencies['@tensorflow/tfjs'];
}

function checkDataFormat() {
  return fetch('/api/points')
    .then(r => r.json())
    .then(d => !d.items[0]._enhanced);
}
```

## Troubleshooting

### Common Migration Issues

#### Issue 1: TensorFlow.js Loading Errors
**Error:** "Failed to load Universal Sentence Encoder"

**Solution:**
```javascript
// Add fallback for TensorFlow loading
async function initializeSearch() {
  try {
    await semanticSearchService.initialize();
  } catch (error) {
    console.warn('Semantic search unavailable, using keyword search only');
    // Fallback to keyword search
    window.searchFallback = true;
  }
}
```

#### Issue 2: Performance Degradation
**Symptom:** Slow page load with many points

**Solution:**
```javascript
// Implement lazy loading
async function loadPointsLazy() {
  // Load and enhance in chunks
  const CHUNK_SIZE = 100;
  const allPoints = await fetchRawPoints();

  for (let i = 0; i < allPoints.length; i += CHUNK_SIZE) {
    const chunk = allPoints.slice(i, i + CHUNK_SIZE);
    const enhanced = enhancePointsBatch(chunk);

    // Add to display progressively
    appendPointsToDisplay(enhanced);

    // Yield to browser
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

#### Issue 3: Memory Issues with Large Datasets
**Symptom:** Browser tab crashes with 10,000+ points

**Solution:**
```javascript
// Implement memory management
class PointManager {
  constructor(maxInMemory = 5000) {
    this.maxInMemory = maxInMemory;
    this.points = new Map();
    this.lru = [];
  }

  addPoints(points) {
    // Only keep most recent points in memory
    if (this.points.size + points.length > this.maxInMemory) {
      this.evictOldest(points.length);
    }

    points.forEach(p => {
      this.points.set(p.object_id, p);
      this.lru.push(p.object_id);
    });
  }

  evictOldest(count) {
    const toEvict = this.lru.splice(0, count);
    toEvict.forEach(id => {
      this.points.delete(id);
      // Clean up embeddings
      semanticSearchService.clearEmbedding(id);
    });
  }
}
```

#### Issue 4: Cache Incompatibility
**Error:** "Invalid cache format"

**Solution:**
```javascript
// Add cache version checking
function loadCache() {
  const cache = localStorage.getItem('enhancedPoints_cache');
  if (!cache) return null;

  try {
    const parsed = JSON.parse(cache);

    // Check version compatibility
    if (parsed.version !== '5.0.0') {
      console.warn('Incompatible cache version, clearing');
      localStorage.removeItem('enhancedPoints_cache');
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Cache corrupted, clearing');
    localStorage.removeItem('enhancedPoints_cache');
    return null;
  }
}
```

## Migration Checklist

### Pre-Migration Checklist
- [ ] Backup current codebase
- [ ] Backup database (if applicable)
- [ ] Document current API endpoints
- [ ] Note custom modifications
- [ ] Review breaking changes
- [ ] Plan migration window
- [ ] Notify stakeholders

### Migration Execution Checklist
- [ ] Update package.json dependencies
- [ ] Install new packages
- [ ] Update import statements
- [ ] Implement point enhancement
- [ ] Update API endpoints
- [ ] Modify React components
- [ ] Update type definitions
- [ ] Implement semantic search
- [ ] Update test files
- [ ] Migrate cached data
- [ ] Update documentation

### Post-Migration Checklist
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Verify performance benchmarks
- [ ] Check memory usage
- [ ] Validate search functionality
- [ ] Verify tooltip displays
- [ ] Test with production data
- [ ] Monitor error logs
- [ ] Gather user feedback
- [ ] Document lessons learned

### Rollback Readiness Checklist
- [ ] Rollback procedure documented
- [ ] Rollback tested in staging
- [ ] Backup verification complete
- [ ] Team trained on rollback
- [ ] Rollback decision criteria defined
- [ ] Communication plan ready
- [ ] Rollback window scheduled

## Support and Resources

### Getting Help
- **Documentation**: [Point Selector Docs](./POINT_SELECTOR_USER_GUIDE.md)
- **API Reference**: [API Documentation](./dev/POINT_SELECTOR_API.md)
- **Architecture Guide**: [Architecture](./dev/POINT_SELECTOR_ARCHITECTURE.md)
- **GitHub Issues**: Report bugs or request features
- **Stack Overflow**: Tag with `building-vitals-points`

### Migration Support Contacts
- **Technical Lead**: technical@buildingvitals.com
- **Support Team**: support@buildingvitals.com
- **Emergency Hotline**: +1-555-MIGRATE

### Additional Resources
- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [Universal Sentence Encoder Guide](https://www.tensorflow.org/hub/tutorials/semantic_similarity_with_tf_hub_universal_encoder)
- [React Migration Best Practices](https://reactjs.org/docs/migration.html)

## See Also
- [User Guide](./POINT_SELECTOR_USER_GUIDE.md)
- [Developer Guide](./dev/POINT_SELECTOR_ARCHITECTURE.md)
- [API Reference](./dev/POINT_SELECTOR_API.md)
- [Testing Guide](./dev/POINT_SELECTOR_TESTING.md)
- [Release Notes](./RELEASE_NOTES_POINT_SELECTOR.md)

---
*Last Updated: December 2024*
*Version: 5.0.0*