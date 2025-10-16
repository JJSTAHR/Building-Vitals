# Integration Testing Quick Reference

## Run Tests

```bash
# From project root
cd workers
node test-integration.js

# Expected: 8 tests, 25 assertions, 0 failures
```

## What's Being Tested

| Test | Validates |
|------|-----------|
| **Enhanced Points Loading** | Points can be loaded and parsed |
| **Display Name Enhancement** | Individual points enhanced correctly |
| **Multiple Point Enhancement** | Batch enhancement works |
| **Chart Label Mapping** | UI labels ≠ API parameters |
| **Timeseries API Simulation** | API uses `Name` field |
| **End-to-End Chart Rendering** | Complete workflow verified |
| **Cache Behavior** | Enhancement doesn't break cache |
| **Worker Integration** | Worker implements logic |

## Key Concepts

### Dual-Field Architecture

```javascript
// Enhanced Point Structure
{
  "Name": "SURGERYCHILLER-Capacity",        // For API calls
  "display_name": "SURGERYCHILLER Capacity", // For UI display
  "equip_name": "SURGERYCHILLER",
  "point_name": "Capacity"
}
```

### Workflow

```
1. User sees: "SURGERYCHILLER Capacity" (display_name)
2. User selects point
3. App calls API: /timeseries?point=SURGERYCHILLER-Capacity (Name)
4. Data fetched and cached using Name as key
5. Chart rendered with label: "SURGERYCHILLER Capacity" (display_name)
```

## Test Data Location

```
workers/
├── test-data/
│   └── sample-points.json    # Test fixtures
├── test-output/              # Generated (gitignored)
│   └── enhanced-points.json
└── test-integration.js       # Test runner
```

## Sample Test Data

```json
{
  "rawPoints": [
    {
      "Name": "SURGERYCHILLER-Capacity",
      "display_name": null
    }
  ],
  "enhancedPoints": [
    {
      "Name": "SURGERYCHILLER-Capacity",
      "display_name": "SURGERYCHILLER Capacity"
    }
  ]
}
```

## Common Assertions

```javascript
// Point has display_name
assertNotNull(point.display_name, "Display name is set");

// Display name is formatted
assertEquals("SURGERYCHILLER Capacity", displayName, "Formatted correctly");

// Name preserved for API
assertEquals("SURGERYCHILLER-Capacity", point.Name, "Name preserved");

// Both fields exist
assertEquals(true, point.hasOwnProperty('Name'), "Has Name field");
assertEquals(true, point.hasOwnProperty('display_name'), "Has display_name field");
```

## Adding New Tests

1. **Create test function**:
```javascript
function testNewFeature() {
  testsRun++;
  logTest('New Feature Description');

  // Your test logic
  assertEquals(expected, actual, "Description");
}
```

2. **Add to main()**:
```javascript
function main() {
  testNewFeature();  // Add here
  printSummary();
}
```

3. **Run**: `node test-integration.js`

## Debugging Failed Tests

### Display Name Not Set

```
✗ FAIL: Display name is set for SURGERYCHILLER-Capacity
  Value was null or empty
```

**Fix**: Check `enhancePoint()` in `workers/points.js`

### Display Name Format Wrong

```
✗ FAIL: Display name is properly formatted
  Expected: SURGERYCHILLER Capacity
  Actual: SURGERYCHILLER-Capacity
```

**Fix**: Check `formatDisplayName()` - should replace dashes with spaces

### Name Field Missing

```
✗ FAIL: Original Name field preserved for API
  Expected: SURGERYCHILLER-Capacity
  Actual: undefined
```

**Fix**: Ensure enhancement doesn't delete `Name` field

### Cache Keys Changed

```
✗ FAIL: Name fields preserved (cache keys intact)
  Raw names: [...]
  Enhanced names: [...]
```

**Fix**: Enhancement must preserve `Name` field exactly

## Performance Benchmarks

| Metric | Expected |
|--------|----------|
| Total test time | <1 second |
| Tests run | 8 |
| Assertions | 25+ |
| Failure rate | 0% |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Integration Tests
  run: node workers/test-integration.js
```

## Files Reference

| File | Purpose |
|------|---------|
| `test-integration.js` | Main test runner |
| `test-integration.sh` | Bash alternative (needs jq) |
| `points.js` | Mock worker for testing |
| `test-data/sample-points.json` | Test fixtures |
| `test-output/` | Generated outputs |

## Documentation

- **Full Guide**: [docs/INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md)
- **Summary**: [docs/TEST_SUITE_SUMMARY.md](./TEST_SUITE_SUMMARY.md)
- **This Card**: [docs/TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md)

## Exit Codes

- `0` - All tests passed
- `1` - Some tests failed

## Tips

1. **Run often** - Tests are fast (<1s)
2. **Add tests first** - TDD approach
3. **Keep data realistic** - Use actual point names
4. **Verify manually** - Spot-check test data against production
5. **Update docs** - When adding tests, update this card

---

**Quick Help**: Run `node test-integration.js` to verify all tests pass
