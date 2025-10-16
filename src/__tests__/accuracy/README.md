# Point Name Cleaning Accuracy Tests

Comprehensive test suite for measuring the accuracy of point name cleaning algorithms.

## Overview

This test suite measures accuracy across multiple dimensions:

- **Equipment Type Detection**: Identifies AHU, VAV, Chiller, etc. (Target: 95%+)
- **Unit Normalization**: Correctly assigns units like °F, psi, CFM (Target: 99%+)
- **Abbreviation Expansion**: Expands SAT → Supply Air Temp, etc. (Target: 95%+)
- **Overall Cleaning**: End-to-end accuracy (Target: 95%+)

## Running the Tests

### Run all accuracy tests:
```bash
npm test -- src/__tests__/accuracy/cleaningAccuracy.test.ts
```

### Run with verbose output:
```bash
npm test -- src/__tests__/accuracy/cleaningAccuracy.test.ts --verbose
```

### Run specific test suite:
```bash
npm test -- src/__tests__/accuracy/cleaningAccuracy.test.ts -t "Equipment Type Detection"
```

## Test Coverage

### 1. Ground Truth Dataset (500+ entries)
Tests against manually verified point names covering:
- AHU temperature sensors (50+ entries)
- VAV temperature sensors (50+ entries)
- Chiller systems (50+ entries)
- Boiler systems (50+ entries)
- Pressure sensors (50+ entries)
- Flow sensors (50+ entries)
- Status points (50+ entries)
- Commands (50+ entries)
- Setpoints (50+ entries)
- Positions (50+ entries)
- Power/Energy (50+ entries)
- Other points (50+ entries)

### 2. Equipment Type Detection
- Tests accuracy of equipment identification
- Generates confusion matrix
- Calculates per-equipment-type metrics
- Identifies common misclassifications

### 3. Unit Normalization
- Validates correct unit assignment
- Tests temperature (°F, °C)
- Tests pressure (psi, inH2O)
- Tests flow (CFM, GPM)
- Tests power (kW, kWh)

### 4. Abbreviation Expansion
- SAT → Supply Air Temperature
- RAT → Return Air Temperature
- CHWST → Chilled Water Supply Temperature
- HWRT → Hot Water Return Temperature
- And 100+ more abbreviations

### 5. Edge Cases
- Unusual abbreviations
- Mixed case names
- Missing equipment types
- Malformed units
- Complex multi-part names
- Special characters

### 6. Performance Metrics
- Precision calculation
- Recall calculation
- F1 score calculation
- Processing speed benchmarks

### 7. Before/After Comparison
Compares current implementation with pre-Haystack baseline:

**BEFORE (Pre-Haystack)**:
- 15 equipment types
- 6 units
- 50 abbreviations
- ~75% estimated accuracy

**AFTER (With Haystack)**:
- 90+ equipment types
- 577 units
- 100+ abbreviations
- 95%+ target accuracy

### 8. Real ACE IoT API Tests
Tests with actual point names from ACE IoT API:
- `S.FallsCity_CMC.Vav115.RoomTemp`
- `FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.points.HeatSignal`
- `BacnetNetwork.Rtu6_1.points.SaFanStatus`

## Test Output

The test suite generates detailed reports including:

```
==============================================
POINT NAME CLEANING ACCURACY MEASUREMENT
==============================================

Testing against 500+ verified ground truth entries
Target Metrics:
  - Equipment Detection: 95%+
  - Unit Normalization: 99%+
  - Abbreviation Expansion: 95%+
  - Overall Accuracy: 95%+

--- Ground Truth Test Results ---
Total: 500
Correct: 475 (95.00%)
Incorrect: 25
Precision: 95.00%
Recall: 95.00%
F1 Score: 95.00%

--- Equipment Detection Results ---
Correct: 480/500 (96.00%)

By Equipment Type:
  AHU: 48/50 (96.0%)
  VAV: 49/50 (98.0%)
  Chiller: 47/50 (94.0%)
  Boiler: 48/50 (96.0%)
  ...

--- Unit Normalization Results ---
Correct: 395/400 (98.75%)

By Unit Type:
  °F: 200/200 (100.0%)
  psi: 48/50 (96.0%)
  CFM: 49/50 (98.0%)
  ...

--- Abbreviation Expansion Results ---
Correct: 190/200 (95.00%)

Example Expansions:
  ✓ AHU_1_SAT_SENSOR → AHU-1 Supply Air Temp
  ✓ VAV_202_ZT_SENSOR → VAV-202 Zone Temp
  ✓ CHILLER_1_CHWST_SENSOR → Chiller-1 Chilled Water Supply Temp
  ...

==============================================
FINAL ACCURACY REPORT
==============================================

SUMMARY:
  Overall Accuracy: 95.00%
  Equipment Detection: 96.00%
  Unit Normalization: 98.75%
  Total Tests: 500
  Passed: 475
  Failed: 25

CORRECTLY CLEANED EXAMPLES:
  ✓ AHU-01_Supply_Air_Temp
    → AHU-01 Supply Air Temp
  ✓ VAV_202_ZT_SENSOR
    → VAV-202 Zone Temp
  ...

INCORRECTLY CLEANED EXAMPLES:
  ✗ UNUSUAL_ABBR_XYZ
    Expected: Unusual Abbreviation XYZ
    Got:      UNUSUAL ABBR XYZ
  ...

Final Score: 95.00%
✓ PASSED: Exceeded 95% accuracy target!
```

## Interpreting Results

### Accuracy Levels
- **95-100%**: Excellent - Exceeds target
- **90-95%**: Good - Meets minimum requirements
- **75-90%**: Fair - Needs improvement
- **<75%**: Needs significant work

### Confusion Matrix
Shows which equipment types are commonly confused:

```
Predicted/Actual | AHU | VAV | Chiller | Boiler
-------------------------------------------------
AHU              | 48  | 1   | 0       | 0
VAV              | 1   | 49  | 0       | 0
Chiller          | 0   | 0   | 47      | 1
Boiler           | 0   | 0   | 2       | 48
```

## Extending the Tests

### Adding Ground Truth Entries

Edit `src/__tests__/fixtures/groundTruth.ts`:

```typescript
{
  id: 'gt-custom-001',
  original: 'CUSTOM_POINT_NAME',
  cleaned: 'Custom Point Name',
  equipmentType: 'custom',
  pointType: 'temperature',
  unit: '°F',
  verifiedBy: 'your-name',
  verifiedDate: '2025-01-16',
  confidence: 'high',
  notes: 'Special test case'
}
```

### Adding Test Cases

Add new test cases in the test file:

```typescript
test('should handle custom abbreviations', () => {
  const point = enhancePoint({ Name: 'CUSTOM_ABBR' });
  expect(point.display_name).toMatch(/Custom Abbreviation/i);
});
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Run Accuracy Tests
  run: npm test -- src/__tests__/accuracy/cleaningAccuracy.test.ts --coverage

- name: Check Accuracy Threshold
  run: |
    ACCURACY=$(npm test -- src/__tests__/accuracy/cleaningAccuracy.test.ts --json | jq '.accuracy')
    if [ "$ACCURACY" -lt 95 ]; then
      echo "Accuracy $ACCURACY% is below 95% threshold"
      exit 1
    fi
```

## Troubleshooting

### Tests Failing
1. Check ground truth dataset is up to date
2. Verify point-name-cleaner.js implementation
3. Review failed test output for patterns
4. Check abbreviation mappings

### Low Accuracy
1. Review incorrectly cleaned examples
2. Check confusion matrix for patterns
3. Add missing abbreviations to ABBREVIATIONS constant
4. Update equipment patterns if needed
5. Verify unit mappings

### Performance Issues
1. Reduce ground truth dataset size for faster iteration
2. Use `--maxWorkers=1` for debugging
3. Add `console.time()` markers to identify bottlenecks

## Related Files

- `src/point-name-cleaner.js` - Main cleaning implementation
- `src/__tests__/fixtures/groundTruth.ts` - Verified test data
- `src/__tests__/fixtures/samplePoints.ts` - Additional test samples
- `src/utils/hybrid-point-enhancer.js` - Hybrid enhancement system

## Contact

For questions about the accuracy tests or to report issues with ground truth data, please contact the development team.
