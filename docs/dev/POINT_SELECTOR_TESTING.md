# Point Selector Testing Guide

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Running Tests](#running-tests)
3. [Test Coverage Requirements](#test-coverage-requirements)
4. [Unit Tests](#unit-tests)
5. [Integration Tests](#integration-tests)
6. [Performance Tests](#performance-tests)
7. [Adding New Test Cases](#adding-new-test-cases)
8. [Test Data](#test-data)
9. [Debugging Tests](#debugging-tests)
10. [CI/CD Integration](#cicd-integration)

## Testing Overview

The Point Selector testing suite ensures reliability and performance of all enhancement, search, and display features. Tests are organized into three main categories:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test interactions between components
3. **Performance Tests**: Ensure system meets performance requirements

### Testing Stack
- **Test Runner**: Jest
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright/Cypress
- **Performance**: Jest Performance, Lighthouse
- **Coverage**: Istanbul/nyc

## Running Tests

### All Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Specific Test Suites
```bash
# Unit tests only
npm test -- --testPathPattern=unit

# Integration tests only
npm test -- --testPathPattern=integration

# Performance tests only
npm test -- --testPathPattern=performance

# Component tests only
npm test -- --testPathPattern=components
```

### Individual Test Files
```bash
# Test specific file
npm test -- point-name-cleaner.test.js

# Test specific suite
npm test -- --testNamePattern="enhancePoint"
```

### Performance Testing
```bash
# Run performance benchmarks
npm run test:perf

# Run with memory profiling
npm run test:perf:memory

# Generate performance report
npm run test:perf:report
```

## Test Coverage Requirements

### Minimum Coverage Thresholds
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      },
      "src/services/point-name-cleaner.js": {
        "branches": 90,
        "functions": 95,
        "lines": 95,
        "statements": 95
      },
      "src/services/semanticSearch/*.ts": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Coverage Reports
```bash
# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html

# View coverage report
open coverage/index.html

# Generate LCOV report for CI
npm test -- --coverage --coverageReporters=lcov
```

## Unit Tests

### Point Name Cleaner Tests

#### Test File: `point-name-cleaner.test.js`

```javascript
describe('Point Name Cleaner', () => {
  describe('enhancePoint', () => {
    it('should enhance VAV point correctly', () => {
      const raw = { Name: 'Vav115.RoomTemp' };
      const enhanced = enhancePoint(raw);

      expect(enhanced.display_name).toBe('VAV 115 - Room Temperature');
      expect(enhanced.unit).toBe('°F');
      expect(enhanced.equipment).toBe('vav');
      expect(enhanced.equipmentId).toBe('115');
      expect(enhanced.confidence).toBeGreaterThan(80);
    });

    it('should handle missing point name gracefully', () => {
      const enhanced = enhancePoint({});

      expect(enhanced.display_name).toBe('Unknown Point');
      expect(enhanced.confidence).toBe(0);
      expect(enhanced._parseError).toBeDefined();
    });

    it('should parse complex BACnet paths', () => {
      const raw = {
        Name: 'ses/ses_falls_city/device.Vav707.points.Damper'
      };
      const enhanced = enhancePoint(raw);

      expect(enhanced.equipment).toBe('vav');
      expect(enhanced.equipmentId).toBe('707');
      expect(enhanced.pointType).toBe('damper');
      expect(enhanced.unit).toBe('%');
    });
  });

  describe('extractEquipment', () => {
    const testCases = [
      ['Vav115', { type: 'vav', id: '115' }],
      ['RTU6_1', { type: 'rtu', id: '6', subId: '1' }],
      ['Ahu2', { type: 'ahu', id: '2' }],
      ['Chiller1', { type: 'chiller', id: '1' }],
      ['CHWP3', { type: 'pump', id: '3', pumpType: 'CHWP' }]
    ];

    test.each(testCases)(
      'should extract %s as %o',
      (input, expected) => {
        const result = extractEquipment(input);
        expect(result).toMatchObject(expected);
      }
    );
  });

  describe('extractPointType', () => {
    it('should detect temperature points', () => {
      const result = extractPointType('Vav115.RoomTemp');

      expect(result.pointType).toBe('temperature');
      expect(result.unit).toBe('°F');
      expect(result.category).toBe('sensor');
      expect(result.purpose).toBe('room');
    });

    it('should detect setpoints', () => {
      const result = extractPointType('Vav115.ClgSp');

      expect(result.pointType).toBe('tempSetpoint');
      expect(result.unit).toBe('°F');
      expect(result.category).toBe('setpoint');
    });

    it('should detect control signals', () => {
      const result = extractPointType('Vav115.HeatSignal');

      expect(result.pointType).toBe('signal');
      expect(result.unit).toBe('%');
      expect(result.category).toBe('control');
    });
  });

  describe('Batch Processing', () => {
    it('should handle large batches efficiently', () => {
      const points = Array(1000).fill(null).map((_, i) => ({
        Name: `Vav${i}.RoomTemp`,
        Value: 70 + Math.random() * 10
      }));

      const start = performance.now();
      const enhanced = enhancePointsBatch(points);
      const duration = performance.now() - start;

      expect(enhanced).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // Should process in < 500ms
      enhanced.forEach(point => {
        expect(point._enhanced).toBe(true);
        expect(point.display_name).toBeDefined();
      });
    });

    it('should handle errors without breaking batch', () => {
      const points = [
        { Name: 'Valid.Point' },
        { Name: null }, // Invalid
        { Name: 'Another.Valid' }
      ];

      const enhanced = enhancePointsBatch(points);

      expect(enhanced).toHaveLength(3);
      expect(enhanced[0]._enhanced).toBe(true);
      expect(enhanced[1]._parseError).toBeDefined();
      expect(enhanced[2]._enhanced).toBe(true);
    });
  });
});
```

### Semantic Search Tests

#### Test File: `semanticSearchService.test.ts`

```typescript
describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeAll(async () => {
    service = SemanticSearchService.getInstance();
    await service.initialize();
  });

  afterAll(() => {
    service.clearMemory();
  });

  describe('Initialization', () => {
    it('should load Universal Sentence Encoder model', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await service.initialize();
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings for points', async () => {
      const points = [
        { object_id: '1', display_name: 'VAV 115 - Room Temperature' },
        { object_id: '2', display_name: 'AHU 2 - Supply Air Fan' }
      ];

      await service.generateEmbeddings(points);

      const stats = service.getMemoryStats();
      expect(stats.numTensors).toBeGreaterThan(0);
    });

    it('should cache embeddings', async () => {
      const points = [
        { object_id: '1', display_name: 'Test Point' }
      ];

      // First generation
      const start1 = performance.now();
      await service.generateEmbeddings(points);
      const duration1 = performance.now() - start1;

      // Second generation (should use cache)
      const start2 = performance.now();
      await service.generateEmbeddings(points);
      const duration2 = performance.now() - start2;

      expect(duration2).toBeLessThan(duration1 * 0.1);
    });
  });

  describe('Search Functionality', () => {
    const testPoints = [
      {
        object_id: '1',
        display_name: 'VAV 115 - Room Temperature',
        unit: '°F'
      },
      {
        object_id: '2',
        display_name: 'VAV 115 - Cooling Setpoint',
        unit: '°F'
      },
      {
        object_id: '3',
        display_name: 'AHU 2 - Supply Air Temperature',
        unit: '°F'
      },
      {
        object_id: '4',
        display_name: 'Chiller 1 - Power Demand',
        unit: 'kW'
      }
    ];

    beforeEach(async () => {
      await service.generateEmbeddings(testPoints);
    });

    it('should find exact matches with high score', async () => {
      const results = await service.search(
        'VAV 115',
        testPoints
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].point.display_name).toContain('VAV 115');
      expect(results[0].keywordScore).toBeGreaterThan(0.8);
    });

    it('should find semantic matches', async () => {
      const results = await service.search(
        'cooling',
        testPoints
      );

      const coolingPoints = results.filter(r =>
        r.point.display_name.toLowerCase().includes('cool') ||
        r.point.display_name.toLowerCase().includes('chill')
      );

      expect(coolingPoints.length).toBeGreaterThan(0);
    });

    it('should respect search options', async () => {
      const results = await service.search(
        'temperature',
        testPoints,
        {
          maxResults: 2,
          threshold: 0.3
        }
      );

      expect(results.length).toBeLessThanOrEqual(2);
      results.forEach(r => {
        expect(r.finalScore).toBeGreaterThan(0.3);
      });
    });

    it('should fallback to keyword search when model unavailable', async () => {
      // Temporarily clear model
      const originalModel = service['model'];
      service['model'] = null;

      const results = await service.search(
        'VAV',
        testPoints
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].semanticScore).toBe(0);

      // Restore model
      service['model'] = originalModel;
    });
  });
});
```

### Component Tests

#### Test File: `EnhancedPointTooltip.test.tsx`

```typescript
describe('EnhancedPointTooltip', () => {
  const mockPoint = {
    Name: 'Vav115.RoomTemp',
    display_name: 'VAV 115 - Room Temperature',
    unit: '°F',
    equipment: 'vav',
    equipmentId: '115',
    category: 'HVAC - VAV Terminals',
    confidence: 90
  };

  it('should render tooltip on hover', async () => {
    render(
      <EnhancedPointTooltip point={mockPoint}>
        <span>Hover me</span>
      </EnhancedPointTooltip>
    );

    const trigger = screen.getByText('Hover me');

    // Hover over element
    await userEvent.hover(trigger);

    // Wait for tooltip to appear
    await waitFor(() => {
      expect(screen.getByText('VAV 115 - Room Temperature')).toBeInTheDocument();
      expect(screen.getByText('Raw: Vav115.RoomTemp')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
    });
  });

  it('should hide tooltip on mouse leave', async () => {
    render(
      <EnhancedPointTooltip point={mockPoint}>
        <span>Hover me</span>
      </EnhancedPointTooltip>
    );

    const trigger = screen.getByText('Hover me');

    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(screen.getByText('VAV 115 - Room Temperature')).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
    await waitFor(() => {
      expect(screen.queryByText('VAV 115 - Room Temperature')).not.toBeInTheDocument();
    });
  });

  it('should position tooltip correctly', () => {
    const { rerender } = render(
      <EnhancedPointTooltip point={mockPoint} position="top">
        <span>Target</span>
      </EnhancedPointTooltip>
    );

    // Test different positions
    ['top', 'bottom', 'left', 'right'].forEach(position => {
      rerender(
        <EnhancedPointTooltip point={mockPoint} position={position}>
          <span>Target</span>
        </EnhancedPointTooltip>
      );

      // Verify position classes are applied
      const tooltip = document.querySelector('.point-tooltip');
      if (tooltip) {
        expect(tooltip).toHaveClass(`tooltip-${position}`);
      }
    });
  });
});
```

## Integration Tests

### End-to-End Point Selection Test

```javascript
describe('Point Selection Integration', () => {
  it('should complete full point selection flow', async () => {
    // 1. Load raw points
    const rawPoints = await fetchRawPoints();

    // 2. Enhance points
    const enhanced = enhancePointsBatch(rawPoints);

    // 3. Initialize search
    await semanticSearchService.initialize();
    await semanticSearchService.generateEmbeddings(enhanced);

    // 4. Search for specific point
    const searchResults = await semanticSearchService.search(
      'VAV temperature',
      enhanced
    );

    // 5. Select point
    const selectedPoint = searchResults[0].point;

    // Verify complete flow
    expect(selectedPoint.display_name).toContain('VAV');
    expect(selectedPoint.display_name).toContain('Temperature');
    expect(selectedPoint.unit).toBe('°F');
    expect(selectedPoint.confidence).toBeGreaterThan(70);
  });
});
```

### API Integration Test

```javascript
describe('API Integration', () => {
  it('should fetch and enhance points from API', async () => {
    // Mock API response
    const mockResponse = {
      items: [
        { Name: 'Vav115.RoomTemp', Value: 72 },
        { Name: 'Rtu6.SaFanStatus', Value: 1 }
      ]
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse)
      })
    );

    // Fetch and enhance
    const response = await fetch('/api/enhanced-points');
    const data = await response.json();
    const enhanced = enhancePointsBatch(data.items);

    // Verify
    expect(enhanced).toHaveLength(2);
    expect(enhanced[0].display_name).toBe('VAV 115 - Room Temperature');
    expect(enhanced[1].display_name).toBe('RTU 6 - Supply Air Fan Status');
  });
});
```

## Performance Tests

### Enhancement Performance

```javascript
describe('Performance Benchmarks', () => {
  describe('Point Enhancement', () => {
    const generatePoints = (count) => {
      return Array(count).fill(null).map((_, i) => ({
        Name: `Vav${i % 999}.${['RoomTemp', 'ClgSp', 'Damper'][i % 3]}`,
        Value: Math.random() * 100
      }));
    };

    it('should process 100 points in < 50ms', () => {
      const points = generatePoints(100);

      const start = performance.now();
      const enhanced = enhancePointsBatch(points);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(enhanced).toHaveLength(100);
    });

    it('should process 1000 points in < 500ms', () => {
      const points = generatePoints(1000);

      const start = performance.now();
      const enhanced = enhancePointsBatch(points);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
      expect(enhanced).toHaveLength(1000);
    });

    it('should process 10000 points in < 5 seconds', () => {
      const points = generatePoints(10000);

      const start = performance.now();
      const enhanced = enhancePointsBatch(points);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000);
      expect(enhanced).toHaveLength(10000);
    });
  });

  describe('Search Performance', () => {
    let points;

    beforeAll(async () => {
      points = generateTestPoints(1000);
      await semanticSearchService.initialize();
      await semanticSearchService.generateEmbeddings(points);
    });

    it('should search 1000 points in < 100ms', async () => {
      const start = performance.now();
      const results = await semanticSearchService.search(
        'temperature',
        points
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle rapid consecutive searches', async () => {
      const queries = ['temperature', 'pressure', 'fan', 'valve', 'setpoint'];

      const start = performance.now();
      for (const query of queries) {
        await semanticSearchService.search(query, points);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
```

### Memory Performance

```javascript
describe('Memory Usage', () => {
  it('should not leak memory during batch processing', () => {
    const initialMemory = process.memoryUsage();

    // Process large batch
    const points = generateTestPoints(10000);
    const enhanced = enhancePointsBatch(points);

    // Force garbage collection
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage();
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

    // Memory growth should be reasonable (< 50MB for 10k points)
    expect(heapGrowth).toBeLessThan(50 * 1024 * 1024);
  });

  it('should clean up TensorFlow tensors', async () => {
    const service = SemanticSearchService.getInstance();

    const initialStats = service.getMemoryStats();

    // Generate embeddings
    const points = generateTestPoints(100);
    await service.generateEmbeddings(points);

    const afterEmbedding = service.getMemoryStats();
    expect(afterEmbedding.numTensors).toBeGreaterThan(initialStats.numTensors);

    // Clear memory
    service.clearMemory();

    const afterClear = service.getMemoryStats();
    expect(afterClear.numTensors).toBe(initialStats.numTensors);
  });
});
```

## Adding New Test Cases

### Template for New Equipment Pattern Tests

```javascript
describe('New Equipment Pattern: DOAS', () => {
  const testCases = [
    {
      input: 'DOAS1.SupplyTemp',
      expected: {
        equipment: 'doas',
        equipmentId: '1',
        display_name: 'DOAS 1 - Supply Temperature'
      }
    },
    {
      input: 'Doas_2.HumidityControl',
      expected: {
        equipment: 'doas',
        equipmentId: '2',
        display_name: 'DOAS 2 - Humidity Control'
      }
    }
  ];

  test.each(testCases)(
    'should parse $input correctly',
    ({ input, expected }) => {
      const result = enhancePoint({ Name: input });

      expect(result.equipment).toBe(expected.equipment);
      expect(result.equipmentId).toBe(expected.equipmentId);
      expect(result.display_name).toBe(expected.display_name);
    }
  );
});
```

### Template for New Abbreviation Tests

```javascript
describe('New Abbreviation: Eco (Economizer)', () => {
  it('should expand Eco to Economizer', () => {
    const result = enhancePoint({ Name: 'Ahu1.EcoMode' });

    expect(result.display_name).toContain('Economizer');
    expect(result.display_name).not.toContain('Eco');
  });

  it('should handle variations', () => {
    const variations = ['EcoMode', 'EcoEnable', 'EcoStatus'];

    variations.forEach(variant => {
      const result = enhancePoint({ Name: `Test.${variant}` });
      expect(result.display_name).toContain('Economizer');
    });
  });
});
```

## Test Data

### Test Data Files

#### `test-data/points.json`
```json
{
  "validPoints": [
    { "Name": "Vav115.RoomTemp", "Value": 72.5 },
    { "Name": "Rtu6_1.SaFanStatus", "Value": 1 },
    { "Name": "Ahu2.ChwVlvPos", "Value": 45 }
  ],
  "edgeCases": [
    { "Name": "UnknownDevice.WeirdPoint", "Value": 42 },
    { "Name": "", "Value": null },
    { "Name": "Very.Long.Nested.Path.Structure.Point", "Value": 1 }
  ],
  "complexPaths": [
    { "Name": "ses/ses_falls_city/device.Vav707.points.Damper" },
    { "Name": "FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.HeatSignal" }
  ]
}
```

### Test Data Generators

```javascript
// Generate test points with various patterns
function generateTestPoints(count, options = {}) {
  const {
    equipmentTypes = ['vav', 'ahu', 'rtu', 'fcu'],
    pointTypes = ['Temp', 'Sp', 'Damper', 'FanStatus'],
    includeErrors = false
  } = options;

  return Array(count).fill(null).map((_, i) => {
    const equipment = equipmentTypes[i % equipmentTypes.length];
    const pointType = pointTypes[i % pointTypes.length];
    const id = Math.floor(i / pointTypes.length) + 1;

    if (includeErrors && i % 10 === 0) {
      return { Name: null, Value: i }; // Invalid point
    }

    return {
      Name: `${equipment}${id}.${pointType}`,
      Value: Math.random() * 100,
      object_id: `point_${i}`
    };
  });
}

// Generate search test queries
function generateSearchQueries() {
  return [
    'temperature',
    'VAV 115',
    'cooling setpoint',
    'supply air fan',
    'chilled water valve',
    'room temp',
    'damper position'
  ];
}
```

## Debugging Tests

### Debug Configuration

```javascript
// jest.config.js
module.exports = {
  // Enable verbose output
  verbose: true,

  // Collect coverage with source maps
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.test.{js,ts,tsx}'
  ],

  // Setup debugging
  testTimeout: 30000, // Increase timeout for debugging

  // Add setup file for debugging utilities
  setupFilesAfterEnv: ['<rootDir>/test-setup.js']
};
```

### Debugging Utilities

```javascript
// test-setup.js
global.debugPoint = (point) => {
  console.log('=== Debug Point ===');
  console.log('Name:', point.Name);
  console.log('Display:', point.display_name);
  console.log('Equipment:', point.equipment, point.equipmentId);
  console.log('Type:', point.pointType);
  console.log('Unit:', point.unit);
  console.log('Confidence:', point.confidence);
  console.log('==================');
};

global.debugSearch = async (query, points) => {
  console.log(`=== Search Debug: "${query}" ===`);
  const results = await semanticSearchService.search(query, points);

  results.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.point.display_name}`);
    console.log(`   Keyword: ${r.keywordScore.toFixed(3)}`);
    console.log(`   Semantic: ${r.semanticScore.toFixed(3)}`);
    console.log(`   Final: ${r.finalScore.toFixed(3)}`);
  });

  console.log('=======================');
  return results;
};
```

### VS Code Debug Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "${file}",
        "--runInBand",
        "--no-coverage"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "windows": {
        "program": "${workspaceFolder}/node_modules/jest/bin/jest"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug Specific Test",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--testNamePattern",
        "should enhance VAV point correctly",
        "--runInBand"
      ],
      "console": "integratedTerminal"
    }
  ]
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Point Selector Tests

on:
  push:
    paths:
      - 'src/**/*point*'
      - 'src/**/*search*'
      - 'tests/**'
  pull_request:
    paths:
      - 'src/**/*point*'
      - 'src/**/*search*'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --testPathPattern=unit --coverage

      - name: Run integration tests
        run: npm test -- --testPathPattern=integration

      - name: Run performance tests
        run: npm run test:perf

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: point-selector

      - name: Check coverage thresholds
        run: npm test -- --coverage --coverageReporters=text-summary

      - name: Performance regression check
        run: |
          npm run test:perf:report
          node scripts/check-perf-regression.js

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: |
            test-results/
            screenshots/
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

# Run tests for changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|tsx)$')

if [ ! -z "$CHANGED_FILES" ]; then
  echo "Running tests for changed files..."

  # Run related tests
  npm test -- --findRelatedTests $CHANGED_FILES --passWithNoTests

  if [ $? -ne 0 ]; then
    echo "Tests failed. Please fix before committing."
    exit 1
  fi

  # Check coverage for changed files
  npm test -- --coverage --collectCoverageFrom="$CHANGED_FILES" --coverageReporters=text-summary
fi
```

## See Also
- [Architecture Guide](./POINT_SELECTOR_ARCHITECTURE.md)
- [API Reference](./POINT_SELECTOR_API.md)
- [User Guide](../POINT_SELECTOR_USER_GUIDE.md)
- [Migration Guide](../POINT_SELECTOR_MIGRATION.md)

---
*Last Updated: December 2024*
*Version: 5.0.0*