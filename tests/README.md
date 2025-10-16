# AI-Enhanced Point Selection Pipeline Tests

Comprehensive test suite for validating the AI-enhanced point selection pipeline in the Building Vitals application.

## Test Structure

### Test Files

- **enhancement.test.ts** - Tests for enhancement logic (AI, KV, pattern matching)
- **integration.test.ts** - End-to-end integration tests for the full pipeline
- **fallback.test.ts** - Tests for fallback scenarios and edge cases
- **test-utils.ts** - Shared utilities, mocks, and helper functions
- **fixtures/point-data.ts** - Real-world test data and fixtures

### Test Coverage

#### 1. Enhancement Tests (`enhancement.test.ts`)

Tests the three enhancement methods:

- **AI Enhancement**: Cloudflare Worker-based enhancement
- **KV Tag Fallback**: Parsing display names from KV tags
- **Pattern Matching Fallback**: Client-side regex patterns

**Key Scenarios:**
- AI service success and failure
- KV tag parsing with valid/invalid JSON
- Pattern matching for VAV, RTU, and AHU points
- Preservation of original point names
- Error handling and recovery

#### 2. Integration Tests (`integration.test.ts`)

End-to-end tests of the complete pipeline:

1. Point enhancement (any method)
2. Display in point selector
3. User selection with full object passing
4. API calls using original names
5. Timeseries data fetching and display

**Key Scenarios:**
- Enhanced names shown in UI
- Original names used for API calls
- Data integrity through entire pipeline
- Error recovery and retry logic

#### 3. Fallback Tests (`fallback.test.ts`)

Tests for fallback chains and edge cases:

- Points without KV tags
- AI service unavailable
- Network timeouts and errors
- Malformed point names
- Special characters (Unicode, URL-encoded, regex special chars)
- Empty or whitespace-only names
- Very long point names

#### 4. Test Utilities (`test-utils.ts`)

Shared utilities for all tests:

- Mock factories for points and timeseries data
- Assertion helpers
- Performance measurement tools
- Mock environment setup
- Validation helpers

#### 5. Test Fixtures (`fixtures/point-data.ts`)

Real-world test data:

- **SES Falls City VAV Points**: `ses/ses_falls_city/Vav707.points.Damper`
- **RTU Points**: `Rtu6_1.points.SaFanStatus`
- **AHU Points**: `Ahu1.points.DaTemp`
- Points with KV tags
- Edge case point names
- Large datasets for performance testing

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test enhancement.test.ts
npm test integration.test.ts
npm test fallback.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Run in Watch Mode

```bash
npm test -- --watch
```

### Run Specific Test Suite

```bash
npm test -- -t "Enhancement Logic Tests"
npm test -- -t "Integration Tests"
npm test -- -t "Fallback Scenario Tests"
```

## Test Examples

### Real-World Point Examples

#### VAV (Variable Air Volume)
```typescript
{
  Name: 'ses/ses_falls_city/Vav707.points.Damper',
  display_name: 'VAV-707 Damper Position'
}
```

#### RTU (Rooftop Unit)
```typescript
{
  Name: 'Rtu6_1.points.SaFanStatus',
  display_name: 'RTU-6 Supply Air Fan Status'
}
```

#### AHU (Air Handling Unit)
```typescript
{
  Name: 'Ahu1.points.DaTemp',
  display_name: 'AHU-1 Discharge Air Temperature'
}
```

### Key Test Patterns

#### Testing Enhancement Preservation
```typescript
it('should preserve original names in point.Name', async () => {
  const result = await enhancePoints(mockPoints);

  expect(result.enhancedPoints[0].Name).toBe('original/path/Point.Name');
  expect(result.enhancedPoints[0].display_name).toBe('Human Readable Name');
  expect(result.enhancedPoints[0].Name).not.toBe(result.enhancedPoints[0].display_name);
});
```

#### Testing API Calls
```typescript
it('should use original Name for timeseries API calls', async () => {
  const point = {
    Name: 'ses/ses_falls_city/Vav707.points.Damper',
    display_name: 'VAV-707 Damper Position'
  };

  await fetchTimeseries(point.Name);

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('ses%2Fses_falls_city%2FVav707.points.Damper')
  );
});
```

#### Testing Fallback Chain
```typescript
it('should cascade through fallback methods', async () => {
  // AI fails
  (global.fetch as any).mockRejectedValueOnce(new Error('AI service down'));

  const result = await enhancePoints(mockPoints);

  // Falls back to pattern matching
  expect(result.method).toBe('pattern');
  expect(result.enhancedPoints[0].display_name).toBeDefined();
});
```

## Coverage Requirements

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## Test Data

### Real-World Examples

The test fixtures include real point names from the Building Vitals application:

- SES Falls City building points
- Various equipment types (VAV, RTU, AHU)
- Different point types (temperature, damper, status, pressure)
- Points with and without KV tags

### Edge Cases

- Empty strings
- Very long names (1000+ characters)
- Special characters (Unicode, regex special chars)
- URL-encoded characters
- Null bytes
- Whitespace-only names

## Custom Matchers

The test suite includes custom matchers:

```typescript
expect(point).toBeValidPoint();
expect(point).toHaveEnhancement();
expect(point).toPreserveOriginalName('original/name');
```

## Mock Environment

The `setupMockEnvironment()` utility provides easy mocking:

```typescript
const env = setupMockEnvironment();

env.mockAISuccess(points);
env.mockAIError(500);
env.mockTimeseriesSuccess(data);
env.restore();
```

## Performance Testing

Use the performance helpers for timing:

```typescript
const { result, duration } = await measureExecutionTime(async () => {
  return await enhancePoints(largeDataset);
});

expect(duration).toBeLessThan(1000); // Under 1 second
```

## Continuous Integration

Tests are designed to run in CI environments:

- No external dependencies
- All services are mocked
- Deterministic test data
- Fast execution (<30 seconds for full suite)

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "should preserve original names"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/vitest run
```

### Verbose Output
```bash
npm test -- --reporter=verbose
```

## Best Practices

1. **Test Isolation**: Each test is independent and can run in any order
2. **Mock Everything**: No external API calls or file system access
3. **Real Data**: Use fixtures based on actual application data
4. **Clear Naming**: Test names describe what is being tested
5. **Arrange-Act-Assert**: All tests follow AAA pattern
6. **Error Cases**: Test both success and failure paths
7. **Edge Cases**: Include boundary conditions and special cases

## Contributing

When adding new features:

1. Add corresponding tests first (TDD)
2. Update fixtures with real examples
3. Test both success and failure paths
4. Include edge cases
5. Update this README with new test categories

## Related Documentation

- [Main Application README](../README.md)
- [Point Enhancement Pipeline Documentation](../docs/point-enhancement.md)
- [API Documentation](../docs/api.md)
