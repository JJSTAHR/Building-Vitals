# Point Cleaning System - Implementation Guide

## Quick Start

This guide provides practical implementation details for the intelligent point cleaning system.

---

## 1. System Overview

### Input → Output Example

```typescript
// INPUT: Raw BACnet Point
{
  name: "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp",
  objectIdentifier: "analog-input,1",
  objectType: "analog-input"
}

// OUTPUT: Enhanced Point
{
  name: "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp",
  displayName: "AHU-01 VAV-707 - Discharge Temperature",
  shortName: "VAV-707 Disch Temp",
  equipment: {
    type: "VAV",
    id: "707",
    fullName: "AHU-01 VAV-707",
    hierarchy: ["AHU-01", "VAV-707"]
  },
  point: {
    type: "Temperature",
    purpose: "Discharge",
    dataType: "analog",
    objectType: "analog-input"
  },
  category: "Variable Air Volume Boxes",
  searchTerms: ["vav", "707", "discharge", "temperature", "ahu-01"],
  confidence: 0.95
}
```

---

## 2. Implementation Phases

### Phase 1: Core Parsing Engine (Week 1)

**Goal**: Build the foundation for parsing point names

**Deliverables**:
- ✅ Data structures (types.ts)
- ✅ Tokenizer implementation
- ✅ Equipment extractor
- ✅ Basic pattern library (10 equipment types)

**Implementation Order**:
```
Day 1-2: Types and Tokenizer
Day 3-4: Equipment Extractor + Patterns
Day 5:   Testing and Refinement
```

**Key Files**:
```
src/point-cleaning/
├── types.ts                  ✅ Created
├── tokenizer.ts              ← Implement
├── equipment-extractor.ts    ← Implement
└── patterns/
    └── equipment-patterns.ts ← Implement
```

---

### Phase 2: Point Extraction (Week 1)

**Goal**: Extract point types, purposes, and units

**Deliverables**:
- ✅ Point extractor
- ✅ Unit detector
- ✅ Point pattern library (15+ types)
- ✅ Display name generator

**Implementation Order**:
```
Day 1-2: Point Extractor + Patterns
Day 3:   Unit Detection
Day 4:   Display Name Generator
Day 5:   Integration Testing
```

**Key Files**:
```
src/point-cleaning/
├── point-extractor.ts        ← Implement
├── unit-detector.ts          ← Implement
├── display-name-generator.ts ← Implement
└── patterns/
    ├── point-patterns.ts     ← Implement
    └── unit-patterns.ts      ← Implement
```

---

### Phase 3: UI Integration (Week 2)

**Goal**: Create user-facing components

**Deliverables**:
- ✅ Point selector component
- ✅ Search functionality
- ✅ Categorization and grouping
- ✅ Chart integration

**Implementation Order**:
```
Day 1-2: Point Selector Component
Day 3:   Search and Filter
Day 4:   Categorization Views
Day 5:   Chart Integration
```

**Key Files**:
```
src/components/
├── PointSelector.tsx         ← Implement
├── PointSearch.tsx           ← Implement
├── PointCategoryView.tsx     ← Implement
└── PointChartDisplay.tsx     ← Implement
```

---

### Phase 4: Optimization (Week 2)

**Goal**: Performance and scalability

**Deliverables**:
- ✅ Caching layer
- ✅ Search indexing
- ✅ Performance profiling
- ✅ Memory optimization

**Implementation Order**:
```
Day 1-2: Caching and Indexing
Day 3:   Performance Profiling
Day 4:   Optimization
Day 5:   Benchmarking
```

**Key Files**:
```
src/point-cleaning/
├── cache.ts                  ← Implement
├── index-builder.ts          ← Implement
└── performance/
    ├── profiler.ts           ← Implement
    └── benchmarks.ts         ← Implement
```

---

### Phase 5: Testing and Refinement (Week 3)

**Goal**: Comprehensive validation

**Deliverables**:
- ✅ Unit tests (100+ tests)
- ✅ Integration tests
- ✅ Real-world data testing
- ✅ Documentation

**Implementation Order**:
```
Day 1-2: Unit Tests
Day 3:   Integration Tests
Day 4:   Real-world Testing
Day 5:   Documentation
```

---

## 3. Component Implementation Details

### 3.1 Tokenizer

**Purpose**: Break point names into meaningful tokens

**Algorithm**:
```typescript
class Tokenizer {
  tokenize(pointName: string): Token[] {
    // 1. Normalize
    const normalized = this.normalize(pointName);

    // 2. Split on delimiters
    const parts = this.split(normalized);

    // 3. Classify each part
    const tokens = parts.map(part => this.classifyToken(part));

    // 4. Remove noise
    return this.removeNoise(tokens);
  }

  private normalize(name: string): string {
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private split(name: string): string[] {
    // Split on: '.', '-', '_', ' '
    // Keep compound terms together: "Supply-Air" stays as one
    return name.split(/[.\-_ ]+/);
  }

  private classifyToken(token: string): Token {
    // Check against pattern libraries
    if (this.isEquipment(token)) return { type: TokenType.EQUIPMENT, ... };
    if (this.isPointType(token)) return { type: TokenType.POINT_TYPE, ... };
    if (this.isNumber(token)) return { type: TokenType.NUMBER, ... };
    // ... more classifications
  }
}
```

**Test Cases**:
```typescript
describe('Tokenizer', () => {
  it('should tokenize AHU point name', () => {
    const tokens = tokenizer.tokenize('VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp');
    expect(tokens).toEqual([
      { value: 'AHU', type: TokenType.EQUIPMENT },
      { value: '01', type: TokenType.EQUIPMENT_ID },
      { value: 'VAV', type: TokenType.EQUIPMENT },
      { value: '707', type: TokenType.EQUIPMENT_ID },
      { value: 'DISCH', type: TokenType.POINT_PURPOSE },
      { value: 'TEMP', type: TokenType.POINT_TYPE }
    ]);
  });
});
```

---

### 3.2 Equipment Extractor

**Purpose**: Identify equipment hierarchy

**Algorithm**:
```typescript
class EquipmentExtractor {
  extract(tokens: Token[]): EquipmentInfo {
    // 1. Find primary equipment
    const primary = this.findPrimaryEquipment(tokens);

    // 2. Find secondary equipment (subsystems)
    const secondary = this.findSecondaryEquipment(tokens, primary);

    // 3. Find components
    const component = this.findComponent(tokens, secondary);

    // 4. Build hierarchy
    const hierarchy = this.buildHierarchy(primary, secondary, component);

    // 5. Extract location
    const location = this.extractLocation(tokens);

    return {
      type: secondary?.type || primary.type,
      id: secondary?.id || primary.id,
      fullName: this.generateFullName(hierarchy),
      hierarchy: hierarchy.map(h => h.name),
      location
    };
  }

  private findPrimaryEquipment(tokens: Token[]): EquipmentMatch {
    // Match against equipment patterns, prioritize by:
    // 1. Pattern priority (higher first)
    // 2. Token position (earlier first)
    // 3. Confidence score
  }

  private buildHierarchy(primary, secondary, component): HierarchyNode[] {
    // Build tree: AHU-01 → VAV-707 → Supply Fan
    // Each node has: { type, id, name }
  }
}
```

**Test Cases**:
```typescript
describe('EquipmentExtractor', () => {
  it('should extract VAV within AHU', () => {
    const equipment = extractor.extract([
      { value: 'AHU', type: TokenType.EQUIPMENT },
      { value: '01', type: TokenType.EQUIPMENT_ID },
      { value: 'VAV', type: TokenType.EQUIPMENT },
      { value: '707', type: TokenType.EQUIPMENT_ID }
    ]);

    expect(equipment).toEqual({
      type: EquipmentType.VAV,
      id: '707',
      fullName: 'AHU-01 VAV-707',
      hierarchy: ['AHU-01', 'VAV-707']
    });
  });
});
```

---

### 3.3 Point Extractor

**Purpose**: Identify point type and purpose

**Algorithm**:
```typescript
class PointExtractor {
  extract(tokens: Token[], equipment: EquipmentInfo): PointInfo {
    // 1. Find point type (Temperature, Pressure, etc.)
    const type = this.findPointType(tokens);

    // 2. Find point purpose (Supply, Return, Setpoint, etc.)
    const purpose = this.findPointPurpose(tokens, type);

    // 3. Find point location within equipment
    const location = this.findPointLocation(tokens);

    // 4. Extract modifiers (Actual, Effective, Override)
    const modifier = this.findModifier(tokens);

    // 5. Determine data type from BACnet object type
    const dataType = this.determineDataType(equipment.objectType);

    return { type, purpose, location, modifier, dataType };
  }

  private findPointType(tokens: Token[]): PointType {
    // Match against point patterns
    // Priority: Exact match > Partial match > Context match
  }

  private findPointPurpose(tokens: Token[], type: PointType): PointPurpose {
    // Use purpose patterns specific to point type
    // Example: For Temperature, look for Supply, Return, Mixed, etc.
  }
}
```

**Test Cases**:
```typescript
describe('PointExtractor', () => {
  it('should extract discharge temperature', () => {
    const point = extractor.extract([
      { value: 'DISCH', type: TokenType.POINT_PURPOSE },
      { value: 'TEMP', type: TokenType.POINT_TYPE }
    ], equipment);

    expect(point).toEqual({
      type: PointType.Temperature,
      purpose: PointPurpose.Discharge,
      dataType: DataType.Analog
    });
  });
});
```

---

### 3.4 Display Name Generator

**Purpose**: Create human-readable names

**Templates**:
```typescript
const templates = {
  // Standard: "AHU-01 VAV-707 - Discharge Temperature"
  standard: "{equipment.fullName} - {point.location} {point.type}",

  // With purpose: "AHU-01 VAV-707 - Discharge Setpoint"
  withPurpose: "{equipment.fullName} - {point.purpose} {point.type}",

  // With unit: "AHU-01 - Supply Air Temperature (°F)"
  withUnit: "{equipment.fullName} - {point.location} {point.type} ({point.unit})",

  // Short: "VAV-707 Disch Temp"
  short: "{equipment.type}-{equipment.id} {point.abbrev}",

  // Compact: "707 Temp"
  compact: "{equipment.id} {point.abbrev}"
};
```

**Algorithm**:
```typescript
class DisplayNameGenerator {
  generate(equipment: EquipmentInfo, point: PointInfo): {
    displayName: string;
    shortName: string;
  } {
    // 1. Choose template based on available data
    const template = this.selectTemplate(equipment, point);

    // 2. Build template variables
    const variables = this.buildVariables(equipment, point);

    // 3. Render template
    const displayName = this.renderTemplate(template, variables);

    // 4. Generate short name
    const shortName = this.generateShortName(equipment, point);

    return { displayName, shortName };
  }

  private selectTemplate(equipment, point): string {
    if (point.unit) return templates.withUnit;
    if (point.purpose) return templates.withPurpose;
    return templates.standard;
  }

  private renderTemplate(template: string, variables: any): string {
    return template.replace(/\{([^}]+)\}/g, (match, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], variables) || '';
    });
  }
}
```

---

### 3.5 Point Categorizer

**Purpose**: Organize for UI display and search

**Algorithm**:
```typescript
class PointCategorizer {
  categorize(data: {
    equipment: EquipmentInfo;
    point: PointInfo;
    displayName: string;
  }): {
    category: PointCategory;
    subcategory?: string;
    searchTerms: string[];
    tags: string[];
  } {
    // 1. Assign primary category (by equipment type)
    const category = this.getCategoryFromEquipment(data.equipment);

    // 2. Assign subcategory (by point type)
    const subcategory = this.getSubcategory(data.point);

    // 3. Generate search terms
    const searchTerms = this.generateSearchTerms(data);

    // 4. Generate tags
    const tags = this.generateTags(data);

    return { category, subcategory, searchTerms, tags };
  }

  private generateSearchTerms(data): string[] {
    return [
      // Equipment terms
      data.equipment.type.toLowerCase(),
      data.equipment.id,
      data.equipment.fullName.toLowerCase(),
      ...data.equipment.hierarchy.map(h => h.toLowerCase()),

      // Point terms
      data.point.type.toLowerCase(),
      data.point.purpose?.toLowerCase(),

      // Display name terms
      ...data.displayName.toLowerCase().split(/\s+/),

      // Abbreviations
      this.generateAbbreviations(data)
    ].filter(Boolean);
  }
}
```

---

## 4. Pattern Library Structure

### Equipment Patterns

**File**: `src/point-cleaning/patterns/equipment-patterns.ts`

```typescript
export const equipmentPatterns: EquipmentPattern[] = [
  // Priority 100: Standalone systems
  {
    type: EquipmentType.AHU,
    patterns: [
      /\bAHU[-_]?(\d+)?\b/i,
      /\bAir[-_]?Hand(ling)?[-_]?Unit[-_]?(\d+)?\b/i,
      /\bAH[-_]?(\d+)\b/i
    ],
    priority: 100,
    aliases: ["AHU", "Air Handler", "Air Handling Unit", "AH"]
  },

  // Priority 90: Subsystems
  {
    type: EquipmentType.VAV,
    patterns: [
      /\bVAV[-_]?(\d+)?\b/i,
      /\b(\d+)[-_]?VAV\b/i
    ],
    priority: 90,
    aliases: ["VAV", "Variable Air Volume"]
  },

  // Priority 80: Components
  {
    type: EquipmentType.Fan,
    patterns: [
      /\b(Supply|Return|Exhaust)[-_]?Fan[-_]?(\d+)?\b/i,
      /\bFAN[-_]?(\d+)?\b/i
    ],
    priority: 70,
    aliases: ["Fan", "Supply Fan", "Return Fan"]
  }

  // ... 10+ more patterns
];
```

### Point Patterns

**File**: `src/point-cleaning/patterns/point-patterns.ts`

```typescript
export const pointPatterns: PointPattern[] = [
  {
    type: PointType.Temperature,
    patterns: [
      /\bTemp(erature)?\b/i,
      /\b(SA|RA|MA|OA|DA)T\b/i  // Supply/Return/Mixed/Outdoor/Discharge Air Temp
    ],
    priority: 100,
    aliases: ["Temperature", "Temp", "T"],
    units: ["F", "°F", "C", "°C"],
    purposePatterns: {
      [PointPurpose.Supply]: [/\b(Supply|SA)\b/i],
      [PointPurpose.Return]: [/\b(Return|RA)\b/i],
      [PointPurpose.Discharge]: [/\b(Discharge|Disch|DA)\b/i]
    }
  },

  {
    type: PointType.Status,
    patterns: [
      /\bStatus\b/i,
      /\bSts\b/i,
      /\bRun[-_]?Status\b/i
    ],
    priority: 100,
    aliases: ["Status", "Sts", "Run Status"],
    units: []
  }

  // ... 15+ more patterns
];
```

---

## 5. Performance Optimization

### Caching Strategy

```typescript
class PointCleaningCache {
  private cache = new Map<string, EnhancedPoint>();
  private maxSize = 10000;

  get(name: string): EnhancedPoint | undefined {
    return this.cache.get(name);
  }

  set(name: string, enhanced: EnhancedPoint): void {
    if (this.cache.size >= this.maxSize) {
      // LRU eviction
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(name, enhanced);
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### Search Indexing

```typescript
class SearchIndex {
  private termToPoints = new Map<string, Set<string>>();

  add(point: EnhancedPoint): void {
    for (const term of point.searchTerms) {
      if (!this.termToPoints.has(term)) {
        this.termToPoints.set(term, new Set());
      }
      this.termToPoints.get(term)!.add(point.name);
    }
  }

  search(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const matches = new Set<string>();

    for (const [term, pointNames] of this.termToPoints) {
      if (term.includes(lowerQuery)) {
        pointNames.forEach(name => matches.add(name));
      }
    }

    return Array.from(matches);
  }
}
```

---

## 6. Testing Strategy

### Unit Tests

```typescript
// tokenizer.test.ts
describe('Tokenizer', () => {
  it('should split on delimiters');
  it('should classify equipment tokens');
  it('should classify point tokens');
  it('should handle numbers');
  it('should remove noise words');
});

// equipment-extractor.test.ts
describe('EquipmentExtractor', () => {
  it('should extract AHU');
  it('should extract VAV within AHU');
  it('should build hierarchy');
  it('should handle unknown equipment');
});

// point-extractor.test.ts
describe('PointExtractor', () => {
  it('should extract temperature point');
  it('should extract status point');
  it('should extract setpoint');
  it('should handle abbreviations');
});
```

### Integration Tests

```typescript
describe('PointCleaningService', () => {
  it('should parse AHU VAV discharge temp', () => {
    const result = service.parsePoint({
      name: 'VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp',
      objectIdentifier: 'analog-input,1',
      objectType: 'analog-input'
    });

    expect(result.displayName).toBe('AHU-01 VAV-707 - Discharge Temperature');
    expect(result.equipment.type).toBe(EquipmentType.VAV);
    expect(result.point.type).toBe(PointType.Temperature);
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('should parse 10000 points in <500ms', () => {
    const points = generateTestPoints(10000);
    const start = performance.now();
    service.parsePoints(points);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
```

---

## 7. Usage Examples

### Basic Parsing

```typescript
import { PointCleaningService } from './point-cleaning';

const service = new PointCleaningService();

// Parse single point
const enhanced = service.parsePoint({
  name: 'VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp',
  objectIdentifier: 'analog-input,1',
  objectType: 'analog-input'
});

console.log(enhanced.displayName);
// Output: "AHU-01 VAV-707 - Discharge Temperature"
```

### Batch Parsing

```typescript
// Parse multiple points
const points = await bacnetService.discoverPoints();
const enhanced = service.parsePoints(points);

// Group by category
const grouped = service.groupPoints(enhanced);

console.log(grouped.get(PointCategory.AHU));
// Output: [ { displayName: "AHU-01 - ...", ... }, ... ]
```

### Search

```typescript
// Search points
const results = service.searchPoints(enhanced, 'temperature');

console.log(results.map(p => p.displayName));
// Output: ["AHU-01 - Supply Temp", "VAV-707 - Discharge Temp", ...]
```

---

## 8. Deployment Checklist

- [ ] Implement core parsing engine
- [ ] Build comprehensive pattern library
- [ ] Create UI components
- [ ] Add caching and indexing
- [ ] Write 100+ unit tests
- [ ] Run integration tests
- [ ] Performance benchmarks (<500ms for 10k points)
- [ ] Real-world data testing
- [ ] User acceptance testing
- [ ] Documentation complete
- [ ] Deploy to production

---

## 9. Maintenance Plan

### Quarterly Pattern Review
- Review low-confidence parses
- Add new patterns discovered
- Refine existing patterns
- Update abbreviation lists

### User Feedback Loop
- Track misclassifications
- Capture user corrections
- Prioritize pattern improvements
- Release pattern updates

### Performance Monitoring
- Track parsing times
- Monitor cache hit rates
- Optimize slow patterns
- Scale as data grows

---

## Support and Resources

- **Documentation**: See `point-cleaning-architecture.md`
- **ADR**: See `ADR-001-point-cleaning-system.md`
- **Types**: See `src/point-cleaning/types.ts`
- **Tests**: See `src/point-cleaning/__tests__/`

---

## Next Steps

1. Review and approve architecture
2. Begin Phase 1 implementation (tokenizer + equipment extractor)
3. Create test dataset with real BACnet names
4. Iterate and refine patterns based on test data
