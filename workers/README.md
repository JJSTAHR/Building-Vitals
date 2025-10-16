# Workers Test Suite

This directory contains the integration test suite for point enhancement workers.

## Quick Start

```bash
# Run integration tests
node test-integration.js

# Or using shell script (requires bash)
./test-integration.sh
```

## Files

- **test-integration.js** - Node.js integration test suite (recommended)
- **test-integration.sh** - Bash integration test suite (requires jq)
- **points.js** - Mock worker for testing display_name enhancement
- **test-data/** - Sample test data
  - `sample-points.json` - Test fixtures with raw and enhanced points
- **test-output/** - Generated test outputs (gitignored)

## Test Coverage

The integration test suite covers:

1. **Enhanced Points Loading** - Verify enhanced points can be loaded
2. **Display Name Enhancement** - Verify individual point enhancement
3. **Multiple Point Enhancement** - Verify batch enhancement
4. **Chart Label Mapping** - Verify UI labels vs API parameters
5. **Timeseries API Simulation** - Verify API uses Name field
6. **End-to-End Chart Rendering** - Verify complete workflow
7. **Cache Behavior** - Verify enhancement doesn't break caching
8. **Worker Integration** - Verify worker implementation

## Documentation

See [docs/INTEGRATION_TESTS.md](../docs/INTEGRATION_TESTS.md) for detailed documentation including:
- Test scenarios and expected results
- How to run tests
- How to debug failures
- Extending the test suite

## Test Results

All 8 test scenarios with 25+ assertions are passing:

```
Total Tests Run:    8
Tests Passed:       25
Tests Failed:       0

✓ ALL TESTS PASSED SUCCESSFULLY!
```

## CI/CD Integration

The tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run integration tests
  run: node workers/test-integration.js
```

## Adding New Tests

1. Add test data to `test-data/sample-points.json`
2. Add test function to `test-integration.js`
3. Call from `main()` function
4. Run tests to verify

See [docs/INTEGRATION_TESTS.md](../docs/INTEGRATION_TESTS.md) for detailed instructions.
