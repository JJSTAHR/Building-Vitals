# Semantic Search Guide

## Overview

The Building Vitals Point Selector features advanced semantic search powered by TensorFlow.js, enabling natural language queries to find points even when they don't exactly match search terms. This guide explains how semantic search works and how to use it effectively.

## Table of Contents
1. [What is Semantic Search?](#what-is-semantic-search)
2. [How It Works](#how-it-works)
3. [Search Examples](#search-examples)
4. [Best Practices](#best-practices)
5. [Performance Considerations](#performance-considerations)
6. [Technical Details](#technical-details)
7. [Troubleshooting](#troubleshooting)

## What is Semantic Search?

Traditional keyword search matches exact text:
- Search "temperature" → finds points with "temp", "temperature" in name
- Search "cooling" → misses "chilled water valve" (related but different words)

Semantic search understands meaning and context:
- Search "cooling" → finds temperature setpoints, dampers, valves, and fans
- Search "energy" → finds kW, kWh, demand, and power points
- Search "comfort" → finds temperature, humidity, and occupancy sensors

## How It Works

### Architecture

```
User Query → Semantic Encoder → Vector Embedding
                                      ↓
                                 Similarity Search
                                      ↓
Point Names → Semantic Encoder → Vector Embeddings → Ranked Results
```

### Processing Pipeline

1. **Model Loading** (First use only)
   - Downloads Universal Sentence Encoder model (~50MB)
   - Initializes TensorFlow.js with WebGL backend
   - Caches model locally for instant subsequent use

2. **Point Embedding** (On data load)
   - Converts each point name and description to vector
   - Stores embeddings in IndexedDB for persistence
   - Updates only when new points are added

3. **Query Processing** (On each search)
   - Converts search query to vector embedding
   - Calculates similarity to all point embeddings
   - Combines semantic scores with keyword matches
   - Returns top results ranked by relevance

4. **Hybrid Scoring**
   ```typescript
   finalScore = (keywordScore * 0.7) + (semanticScore * 0.3)
   ```
   - 70% weight on exact keyword matches
   - 30% weight on semantic similarity
   - Balances precision and discovery

## Search Examples

### Example 1: Finding Cooling Equipment
```
Query: "cooling"

Semantic Matches Found:
✓ "VAV-115 Cooling Setpoint" (exact match)
✓ "AHU-2 Chilled Water Valve Position" (semantic: chilled water = cooling)
✓ "VAV-203 Damper Position" (semantic: damper controls cooling/heating)
✓ "RTU-6 Supply Air Temperature" (semantic: supply air related to cooling)
```

### Example 2: Energy Monitoring
```
Query: "energy usage"

Semantic Matches Found:
✓ "Meter-1 Power Demand" (semantic: power = energy)
✓ "AHU-2 kW Consumption" (semantic: kW = energy unit)
✓ "Building Total kWh" (semantic: kWh = energy measurement)
✓ "HVAC System Efficiency" (semantic: efficiency relates to energy)
```

### Example 3: Air Quality
```
Query: "indoor air quality"

Semantic Matches Found:
✓ "VAV-707 CO2 Level" (semantic: CO2 indicates air quality)
✓ "AHU-1 VOC Sensor" (semantic: VOC = air quality metric)
✓ "Zone-A Occupancy Count" (semantic: occupancy affects air quality)
✓ "AHU-1 Outside Air Damper" (semantic: outside air improves quality)
```

### Example 4: Comfort Conditions
```
Query: "occupant comfort"

Semantic Matches Found:
✓ "VAV-115 Room Temperature" (semantic: temp affects comfort)
✓ "Zone-A Relative Humidity" (semantic: humidity = comfort factor)
✓ "VAV-203 Airflow Rate" (semantic: airflow = comfort)
✓ "Space-B Occupancy Status" (semantic: occupancy relates to comfort needs)
```

### Example 5: System Status
```
Query: "equipment running"

Semantic Matches Found:
✓ "AHU-2 Fan Status" (semantic: status indicates if running)
✓ "RTU-6 Compressor Enable" (semantic: enable = running state)
✓ "Pump-1 Feedback Signal" (semantic: feedback = operational status)
✓ "Chiller-1 Running Hours" (semantic: running hours = operation)
```

## Best Practices

### Effective Search Strategies

1. **Use Natural Language**
   ```
   ✓ "cooling setpoints for VAV boxes"
   ✓ "supply air temperature sensors"
   ✓ "energy consumption"
   ✗ "vav_cooling_sp" (too technical)
   ```

2. **Start Broad, Then Narrow**
   ```
   Step 1: "temperature" → See all temperature points
   Step 2: "zone temperature" → Filter to zones
   Step 3: "zone temperature VAV" → Specific to VAV zones
   ```

3. **Combine Equipment and Function**
   ```
   ✓ "AHU fan status"
   ✓ "VAV damper position"
   ✓ "chiller water temperature"
   ```

4. **Use Conceptual Terms**
   ```
   ✓ "energy efficiency" (finds kW, kWh, runtime, etc.)
   ✓ "occupied spaces" (finds occupancy, schedules, modes)
   ✓ "ventilation" (finds dampers, fans, CO2, airflow)
   ```

### Search Tips

- **Don't worry about exact names**: Semantic search finds related terms
- **Use full words**: "temperature" better than "temp" for semantic matching
- **Think functionally**: Describe what the point does, not its technical name
- **Combine contexts**: Equipment type + measurement type works well

### Common Search Patterns

| User Need | Search Query | Points Found |
|-----------|-------------|--------------|
| Review cooling performance | "cooling system" | Setpoints, temperatures, valves, dampers |
| Check ventilation | "outside air" | OA dampers, CO2, airflow rates |
| Monitor energy | "power consumption" | kW, kWh, demand, runtime |
| Verify comfort | "room conditions" | Temperature, humidity, occupancy |
| Check equipment status | "fan operation" | Fan status, speeds, enables |

## Performance Considerations

### Initial Load
- **First Time**: 2-3 seconds to download model
- **Cached**: < 100ms to load from browser
- **Embedding Generation**: ~50-100ms per 100 points

### Search Performance
- **With Model Loaded**: < 100ms for 1000 points
- **Without Model**: Falls back to keyword search instantly
- **Background Loading**: Model loads while user browses

### Optimization Strategies

1. **Model Caching**
   ```typescript
   // Model cached in browser's IndexedDB
   // No re-download on subsequent visits
   ```

2. **Embedding Cache**
   ```typescript
   // Point embeddings cached per site
   // Updated only when points change
   ```

3. **Lazy Loading**
   ```typescript
   // Model loads on first search, not on page load
   // Doesn't block initial page rendering
   ```

4. **Fallback Strategy**
   ```typescript
   // Instant keyword search while model loads
   // Seamlessly upgrades to semantic when ready
   ```

## Technical Details

### TensorFlow.js Integration

```typescript
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';

class SemanticSearchService {
  private model: use.UniversalSentenceEncoder | null = null;

  async initialize() {
    await tf.setBackend('webgl');
    await tf.ready();
    this.model = await use.load();
  }

  async generateEmbedding(text: string): Promise<tf.Tensor> {
    const embeddings = await this.model!.embed([text]);
    return embeddings;
  }

  cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    const dotProduct = tf.sum(tf.mul(a, b));
    const normA = tf.sqrt(tf.sum(tf.square(a)));
    const normB = tf.sqrt(tf.sum(tf.square(b)));
    return tf.div(dotProduct, tf.mul(normA, normB)).dataSync()[0];
  }
}
```

### Embedding Cache Structure

```typescript
interface EmbeddingCache {
  version: string;           // Cache version for invalidation
  siteId: string;           // Site identifier
  embeddings: {
    [pointId: string]: {
      vector: number[];      // 512-dimensional embedding
      text: string;          // Original text that was embedded
      timestamp: number;     // When embedding was created
    };
  };
}
```

### Hybrid Search Algorithm

```typescript
async search(query: string, points: Point[]): Promise<SearchResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await this.generateEmbedding(query);

  // 2. Calculate scores for each point
  const results = points.map(point => {
    // Keyword score (exact and fuzzy matching)
    const keywordScore = this.calculateKeywordScore(query, point);

    // Semantic score (cosine similarity)
    const semanticScore = this.cosineSimilarity(
      queryEmbedding,
      point.embedding
    );

    // Combine scores (70% keyword, 30% semantic)
    const finalScore = (keywordScore * 0.7) + (semanticScore * 0.3);

    return { point, finalScore, keywordScore, semanticScore };
  });

  // 3. Sort by final score
  return results
    .filter(r => r.finalScore >= 0.3)  // Threshold for relevance
    .sort((a, b) => b.finalScore - a.finalScore);
}
```

### Keyword Scoring

```typescript
calculateKeywordScore(query: string, point: Point): number {
  const queryLower = query.toLowerCase();
  const pointText = this.getPointText(point).toLowerCase();

  // Exact match in display name (1.0)
  if (pointText.includes(queryLower)) return 1.0;

  // Word-level matching
  const queryWords = queryLower.split(/\s+/);
  const matches = queryWords.filter(w => pointText.includes(w));

  // Partial score based on match percentage
  const partialScore = matches.length / queryWords.length;

  // Boost if match in display name vs raw name
  const displayBoost = point.display_name?.toLowerCase().includes(queryLower) ? 1.5 : 1.0;

  return Math.min(partialScore * displayBoost, 1.0);
}
```

## Troubleshooting

### Issue: Semantic Search Not Working

**Symptoms**: Only exact keyword matches returned

**Solutions**:
1. Check browser console for model loading errors
2. Verify WebGL is available: `chrome://gpu`
3. Clear browser cache and reload page
4. Check internet connection (first-time model download)

### Issue: Slow Search Performance

**Symptoms**: Search takes > 1 second to return results

**Solutions**:
1. Wait for model to fully load (first use only)
2. Check if embedding cache is enabled
3. Reduce number of points by using filters first
4. Update browser to latest version for better TensorFlow.js performance

### Issue: Unexpected Search Results

**Symptoms**: Irrelevant points appearing in results

**Solutions**:
1. Use more specific search terms
2. Include equipment type in query
3. Try exact keyword search (disable semantic temporarily)
4. Report feedback for model improvement

### Issue: Model Failed to Load

**Symptoms**: "Semantic search unavailable" message

**Solutions**:
1. Check browser DevTools console for error messages
2. Verify TensorFlow.js CDN is accessible
3. Disable browser extensions that block scripts
4. Try in incognito mode to rule out extension conflicts

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 90+ | ✅ Full | Recommended, best performance |
| Firefox 88+ | ✅ Full | Good performance |
| Safari 14+ | ⚠️ Partial | May require WebGL2 polyfill |
| Edge 90+ | ✅ Full | Chromium-based, same as Chrome |

## See Also
- [Point Selector User Guide](../POINT_SELECTOR_USER_GUIDE.md)
- [KV Tag Display Guide](./KV_TAG_DISPLAY_GUIDE.md)
- [Point Selector Architecture](../dev/POINT_SELECTOR_ARCHITECTURE.md)
- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [Universal Sentence Encoder](https://tfhub.dev/google/universal-sentence-encoder/4)

---
*Last Updated: January 2025*
*Version: 6.0.0*
