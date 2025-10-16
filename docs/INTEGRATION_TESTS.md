# Integration Test Suite Documentation

## Overview

This document describes the integration test suite for the enhanced point → timeseries → chart workflow. The tests verify that the `display_name` enhancement works correctly end-to-end while preserving API compatibility.

## Test Architecture

### Components Under Test

1. **Point Enhancement Worker** (`workers/points.js`)
   - Adds `display_name` field to points
   - Preserves original `Name` field for API calls
   - Handles various point naming patterns

2. **Chart Rendering Logic**
   - Uses `display_name` for user-facing labels
   - Uses `Name` for API parameter mapping
   - Maintains data integrity

3. **Timeseries API Integration**
   - Fetches data using `Name` field
   - Returns data keyed by `Name`
   - Compatible with enhanced points

4. **Cache System**
   - Cache keys based on `Name` field
   - Enhancement doesn't break cache
   - `display_name` is additive, not destructive

## Test Scenarios

### Test 1: Enhanced Points Loading
**Purpose**: Verify that enhanced points can be loaded and parsed correctly.

**Steps**:
1. Load sample data with enhanced points
2. Parse JSON structure
3. Verify point count matches expected

**Expected Result**:
- 7 enhanced points loaded
- All points have valid structure
- JSON parsing succeeds

**Actual Result**: ✓ PASS

---

### Test 2: Display Name Enhancement
**Purpose**: Verify that individual points are enhanced correctly.

**Steps**:
1. Select point: `SURGERYCHILLER-Capacity`
2. Check `display_name` field
3. Verify human-readable format
4. Verify `Name` field preserved

**Expected Result**:
- `display_name` = "SURGERYCHILLER Capacity"
- `Name` = "SURGERYCHILLER-Capacity"
- Both fields present

**Actual Result**: ✓ PASS

---

### Test 3: Multiple Point Enhancement
**Purpose**: Verify that all points in a collection are enhanced.

**Steps**:
1. Load full point collection
2. Count points with `display_name`
3. Verify matches total count
4. Spot-check specific points

**Expected Result**:
- 100% of points have `display_name`
- AHU-01-ZoneTemp → "AHU-01 Zone Temp"
- BOILER-01-SupplyTemp → "BOILER-01 Supply Temp"

**Actual Result**: ✓ PASS

---

### Test 4: Chart Label Mapping
**Purpose**: Verify correct mapping between UI labels and API parameters.

**Steps**:
1. Load chart configuration
2. Check series labels (what user sees)
3. Check API parameters (what gets called)
4. Verify they use different fields

**Expected Result**:
```json
{
  "label": "SURGERYCHILLER Capacity",      // display_name
  "apiParameter": "SURGERYCHILLER-Capacity" // Name
}
```

**Actual Result**: ✓ PASS

---

### Test 5: Timeseries API Simulation
**Purpose**: Verify that timeseries API uses `Name` field correctly.

**Steps**:
1. Load sample timeseries response
2. Check response keys
3. Verify they match `Name` field (not `display_name`)
4. Verify data structure

**Expected Result**:
- Response keys: `SURGERYCHILLER-Capacity`, `AHU-01-ZoneTemp`
- NOT: `SURGERYCHILLER Capacity` (spaces would break API)
- Data array has 4 points per series

**Actual Result**: ✓ PASS

---

### Test 6: End-to-End Chart Rendering
**Purpose**: Verify complete workflow from point selection to chart display.

**Steps**:
1. User sees enhanced points (UI shows `display_name`)
2. User selects "SURGERYCHILLER Capacity"
3. App uses `Name` field for API call
4. Timeseries data fetched successfully
5. Chart rendered with `display_name` as label

**Expected Result**:
```
UI Display → "SURGERYCHILLER Capacity"
API Call   → GET /timeseries?point=SURGERYCHILLER-Capacity
Chart Label→ "SURGERYCHILLER Capacity"
```

**Actual Result**: ✓ PASS

---

### Test 7: Cache Behavior
**Purpose**: Verify that enhancement doesn't break caching.

**Steps**:
1. Compare `Name` fields before/after enhancement
2. Verify `Name` fields unchanged
3. Verify `display_name` is additive
4. Check cache keys intact

**Expected Result**:
- `Name` fields identical before/after
- `display_name` added without replacing fields
- Cache lookups still work

**Actual Result**: ✓ PASS

---

### Test 8: Worker Integration
**Purpose**: Verify that the actual worker implements enhancement logic.

**Steps**:
1. Check worker file exists
2. Verify contains `display_name` logic
3. Check for enhancement function

**Expected Result**:
- `workers/points.js` exists
- Contains `display_name` references
- Has enhancement function

**Actual Result**: ✓ PASS

## Running the Tests

### Prerequisites

```bash
# Install dependencies
cd workers
npm install

# Ensure jq is installed (for JSON parsing)
# Windows (via chocolatey):
choco install jq

# macOS:
brew install jq

# Linux:
sudo apt-get install jq
```

### Running All Tests

```bash
# From the workers directory
./test-integration.sh

# Or from project root
./workers/test-integration.sh
```

### Running Individual Tests

The test script runs all tests sequentially. To run individual tests:

```bash
# Edit test-integration.sh and comment out unwanted tests in main()
# Or use grep to filter output:
./test-integration.sh | grep "Test 3"
```

### Test Output

```
═══════════════════════════════════════════════════════════════
  Test Setup
═══════════════════════════════════════════════════════════════

  ℹ Sample data loaded from: /path/to/test-data/sample-points.json
  ℹ Worker found at: /path/to/workers/points.js
  ℹ Test output directory: /path/to/workers/test-output
✓ Setup complete

▶ Test 1: Enhanced Points Loading
✓ PASS: Enhanced points array loaded
✓ PASS: Correct number of enhanced points

▶ Test 2: Display Name Enhancement
✓ PASS: Display name is set for SURGERYCHILLER-Capacity
✓ PASS: Display name is properly formatted
✓ PASS: Original Name field preserved for API

...

═══════════════════════════════════════════════════════════════
  Test Summary
═══════════════════════════════════════════════════════════════

Total Tests Run:    8
Tests Passed:       8
Tests Failed:       0

╔═══════════════════════════════════════╗
║                                       ║
║   ✓ ALL TESTS PASSED SUCCESSFULLY!   ║
║                                       ║
╚═══════════════════════════════════════╝
```

## Debugging Failed Tests

### Common Issues

#### 1. Test Data Not Found
```
Error: Sample data not found at /path/to/test-data/sample-points.json
```

**Solution**: Ensure test data file exists:
```bash
ls workers/test-data/sample-points.json
```

#### 2. Worker Not Found
```
Error: Worker not found at /path/to/workers/points.js
```

**Solution**: Verify worker file location:
```bash
ls workers/points.js
```

#### 3. JSON Parsing Errors
```
parse error: Invalid numeric literal at line 1, column 10
```

**Solution**:
- Check JSON file syntax
- Ensure jq is installed correctly
- Validate JSON with `jq '.' file.json`

#### 4. Display Name Mismatch
```
✗ FAIL: Display name is properly formatted
  Expected: SURGERYCHILLER Capacity
  Actual: SURGERYCHILLER-Capacity
```

**Solution**:
- Check worker's `formatDisplayName` function
- Verify transformation logic handles dashes correctly
- Test with: `echo "SURGERYCHILLER-Capacity" | sed 's/-/ /g'`

### Debug Mode

Enable verbose output:

```bash
# Add set -x to top of test-integration.sh
set -x  # Print all commands

# Or run with bash -x
bash -x ./test-integration.sh
```

### Inspecting Test Output

```bash
# View generated test outputs
cat workers/test-output/enhanced-points.json

# Pretty-print JSON
cat workers/test-output/enhanced-points.json | jq '.'

# Search for specific point
cat workers/test-output/enhanced-points.json | jq '.[] | select(.Name == "SURGERYCHILLER-Capacity")'
```

## Test Data Structure

### Sample Points JSON

```json
{
  "description": "Sample test data for integration testing",
  "site": "ses_falls_city",

  "rawPoints": [
    {
      "Name": "SURGERYCHILLER-Capacity",
      "display_name": null,
      "equip_name": "SURGERYCHILLER",
      "point_name": "Capacity"
    }
  ],

  "enhancedPoints": [
    {
      "Name": "SURGERYCHILLER-Capacity",
      "display_name": "SURGERYCHILLER Capacity",
      "equip_name": "SURGERYCHILLER",
      "point_name": "Capacity"
    }
  ],

  "expectedChartConfig": {
    "series": [
      {
        "pointId": "SURGERYCHILLER-Capacity",
        "label": "SURGERYCHILLER Capacity",
        "apiParameter": "SURGERYCHILLER-Capacity"
      }
    ]
  },

  "timeseriesResponse": {
    "SURGERYCHILLER-Capacity": {
      "ts": [
        {"timestamp": "2025-10-10T00:00:00Z", "value": 75.5}
      ]
    }
  }
}
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install jq
      run: sudo apt-get install -y jq

    - name: Install dependencies
      run: cd workers && npm install

    - name: Run integration tests
      run: ./workers/test-integration.sh

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-output
        path: workers/test-output/
```

## Extending the Tests

### Adding New Test Cases

1. **Create test function**:
```bash
test_my_new_feature() {
    ((TESTS_RUN++))
    log_test "My New Feature"

    # Your test logic here
    local result=$(some_command)
    assert_equals "expected" "$result" "Test description"
}
```

2. **Add to main()**:
```bash
main() {
    # ... existing tests ...
    test_my_new_feature
    print_summary
}
```

### Adding New Test Data

1. Edit `workers/test-data/sample-points.json`
2. Add new points to `rawPoints` and `enhancedPoints`
3. Update expected results
4. Re-run tests

## Performance Benchmarks

Expected test execution times:

| Test | Time |
|------|------|
| Test 1: Enhanced Points Loading | <0.1s |
| Test 2: Display Name Enhancement | <0.1s |
| Test 3: Multiple Point Enhancement | <0.1s |
| Test 4: Chart Label Mapping | <0.1s |
| Test 5: Timeseries API Simulation | <0.1s |
| Test 6: End-to-End Chart Rendering | <0.1s |
| Test 7: Cache Behavior | <0.1s |
| Test 8: Worker Integration | <0.1s |
| **Total** | **<1s** |

## Related Documentation

- [Point Enhancement Guide](./POINT_ENHANCEMENT.md)
- [Worker Documentation](../workers/README.md)
- [API Documentation](./API.md)

## Support

For issues or questions:
1. Check test output for detailed error messages
2. Review this documentation
3. Check worker logs
4. Open an issue with test output attached
