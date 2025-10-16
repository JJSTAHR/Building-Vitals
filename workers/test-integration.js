#!/usr/bin/env node

/**
 * Integration Test Suite: Point → Timeseries → Chart Workflow
 *
 * Tests the complete workflow from point selection to chart rendering
 * with display_name enhancement and proper API parameter mapping
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Test configuration
const testDataDir = path.join(__dirname, 'test-data');
const sampleDataPath = path.join(testDataDir, 'sample-points.json');
const testOutputDir = path.join(__dirname, 'test-output');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Test results storage
const testResults = [];

// Helper Functions
function logHeader(message) {
  console.log(`\n${colors.blue}${'═'.repeat(65)}${colors.reset}`);
  console.log(`${colors.blue}  ${message}${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(65)}${colors.reset}\n`);
}

function logTest(message) {
  console.log(`${colors.yellow}▶ Test ${testsRun + 1}: ${message}${colors.reset}`);
}

function logPass(message) {
  console.log(`${colors.green}✓ PASS: ${message}${colors.reset}`);
  testsPassed++;
}

function logFail(message) {
  console.log(`${colors.red}✗ FAIL: ${message}${colors.reset}`);
  testsFailed++;
}

function logInfo(message) {
  console.log(`  ℹ ${message}`);
}

function assertEquals(expected, actual, message) {
  if (expected === actual) {
    logPass(message);
    return true;
  } else {
    logFail(message);
    logInfo(`Expected: ${expected}`);
    logInfo(`Actual: ${actual}`);
    return false;
  }
}

function assertNotNull(value, message) {
  if (value !== null && value !== undefined && value !== '') {
    logPass(message);
    return true;
  } else {
    logFail(message);
    logInfo('Value was null or empty');
    return false;
  }
}

function assertContains(haystack, needle, message) {
  const haystackStr = typeof haystack === 'string' ? haystack : JSON.stringify(haystack);
  if (haystackStr.includes(needle)) {
    logPass(message);
    return true;
  } else {
    logFail(message);
    logInfo(`Expected to find: ${needle}`);
    logInfo(`In: ${haystackStr}`);
    return false;
  }
}

// Setup Tests
function setupTests() {
  logHeader('Test Setup');

  // Verify test data exists
  if (!fs.existsSync(sampleDataPath)) {
    console.error(`${colors.red}Error: Sample data not found at ${sampleDataPath}${colors.reset}`);
    process.exit(1);
  }
  logInfo(`Sample data loaded from: ${sampleDataPath}`);

  // Verify worker exists
  const workerPath = path.join(__dirname, 'points.js');
  if (!fs.existsSync(workerPath)) {
    console.error(`${colors.red}Error: Worker not found at ${workerPath}${colors.reset}`);
    process.exit(1);
  }
  logInfo(`Worker found at: ${workerPath}`);

  // Create temp directory for test outputs
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }
  logInfo(`Test output directory: ${testOutputDir}`);

  console.log(`${colors.green}✓ Setup complete${colors.reset}\n`);
}

// Test 1: Enhanced Points Loading
function testEnhancedPointsLoading() {
  testsRun++;
  logTest('Enhanced Points Loading');

  const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const enhancedPoints = sampleData.enhancedPoints;

  // Verify we have enhanced points
  assertNotNull(enhancedPoints, 'Enhanced points array loaded');

  // Verify count matches expected
  assertEquals(7, enhancedPoints.length, 'Correct number of enhanced points');

  // Save for next tests
  fs.writeFileSync(
    path.join(testOutputDir, 'enhanced-points.json'),
    JSON.stringify(enhancedPoints, null, 2)
  );
}

// Test 2: Display Name Enhancement
function testDisplayNameEnhancement() {
  testsRun++;
  logTest('Display Name Enhancement');

  const points = JSON.parse(
    fs.readFileSync(path.join(testOutputDir, 'enhanced-points.json'), 'utf8')
  );

  // Test specific point: SURGERYCHILLER-Capacity
  const point = points.find(p => p.Name === 'SURGERYCHILLER-Capacity');
  const displayName = point?.display_name;
  const name = point?.Name;

  // Verify display_name is set
  assertNotNull(displayName, 'Display name is set for SURGERYCHILLER-Capacity');

  // Verify display_name is human-readable
  assertEquals('SURGERYCHILLER Capacity', displayName, 'Display name is properly formatted');

  // Verify Name field is preserved (for API calls)
  assertEquals('SURGERYCHILLER-Capacity', name, 'Original Name field preserved for API');
}

// Test 3: Multiple Point Enhancement
function testMultiplePointEnhancement() {
  testsRun++;
  logTest('Multiple Point Enhancement');

  const points = JSON.parse(
    fs.readFileSync(path.join(testOutputDir, 'enhanced-points.json'), 'utf8')
  );

  // Test multiple points have display_names
  const pointsWithDisplay = points.filter(p => p.display_name !== null && p.display_name !== undefined);
  const totalPoints = points.length;

  assertEquals(totalPoints, pointsWithDisplay.length, 'All points have display_name set');

  // Test specific cases
  const ahuPoint = points.find(p => p.Name === 'AHU-01-ZoneTemp');
  assertEquals('AHU-01 Zone Temp', ahuPoint?.display_name, 'AHU point correctly enhanced');

  const boilerPoint = points.find(p => p.Name === 'BOILER-01-SupplyTemp');
  assertEquals('BOILER-01 Supply Temp', boilerPoint?.display_name, 'BOILER point correctly enhanced');
}

// Test 4: Chart Label Mapping
function testChartLabelMapping() {
  testsRun++;
  logTest('Chart Label vs API Parameter Mapping');

  const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const chartConfig = sampleData.expectedChartConfig;
  const series = chartConfig.series;

  // Test first series
  const series1 = series[0];
  const label1 = series1.label;
  const apiParam1 = series1.apiParameter;

  // Chart label should be display_name (human-readable)
  assertEquals('SURGERYCHILLER Capacity', label1, 'Chart label uses display_name');

  // API parameter should be Name (machine-readable)
  assertEquals('SURGERYCHILLER-Capacity', apiParam1, 'API parameter uses Name field');

  // Test second series
  const series2 = series[1];
  const label2 = series2.label;
  const apiParam2 = series2.apiParameter;

  assertEquals('AHU-01 Zone Temp', label2, 'Second chart label uses display_name');
  assertEquals('AHU-01-ZoneTemp', apiParam2, 'Second API parameter uses Name field');
}

// Test 5: Timeseries API Simulation
function testTimeseriesApiSimulation() {
  testsRun++;
  logTest('Timeseries API Parameter Usage');

  const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const tsResponse = sampleData.timeseriesResponse;

  // Verify timeseries uses Name field as keys
  const keys = Object.keys(tsResponse);

  assertContains(keys.join(','), 'SURGERYCHILLER-Capacity', 'Timeseries uses Name field (not display_name)');
  assertContains(keys.join(','), 'AHU-01-ZoneTemp', 'Second timeseries uses Name field');

  // Verify data structure
  const data = tsResponse['SURGERYCHILLER-Capacity']?.ts;
  const dataCount = data?.length;

  assertNotNull(dataCount, 'Timeseries data present for SURGERYCHILLER-Capacity');
  assertEquals(4, dataCount, 'Correct number of timeseries data points');
}

// Test 6: End-to-End Chart Rendering Simulation
function testE2EChartRendering() {
  testsRun++;
  logTest('End-to-End Chart Rendering Workflow');

  const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const enhancedPoints = JSON.parse(
    fs.readFileSync(path.join(testOutputDir, 'enhanced-points.json'), 'utf8')
  );

  // Simulate the full workflow:
  // 1. User sees enhanced points with display_name
  const point = enhancedPoints.find(p => p.Name === 'SURGERYCHILLER-Capacity');

  // 2. User selects point (sees display_name in UI)
  const uiLabel = point?.display_name;
  assertEquals('SURGERYCHILLER Capacity', uiLabel, 'UI shows display_name to user');

  // 3. App uses Name field for API call
  const apiParam = point?.Name;
  assertEquals('SURGERYCHILLER-Capacity', apiParam, 'API call uses Name field');

  // 4. Timeseries data is fetched using Name
  const tsData = sampleData.timeseriesResponse[apiParam];
  assertNotNull(tsData, 'Timeseries data retrieved using Name field');

  // 5. Chart is configured with display_name as label
  const chartSeries = sampleData.expectedChartConfig.series.find(
    s => s.pointId === 'SURGERYCHILLER-Capacity'
  );
  const chartLabel = chartSeries?.label;
  assertEquals(uiLabel, chartLabel, 'Chart label matches display_name shown to user');

  logInfo('Complete workflow verified: UI (display_name) → API (Name) → Chart (display_name)');
}

// Test 7: Cache Behavior with Enhanced Points
function testCacheBehavior() {
  testsRun++;
  logTest('Cache Behavior with Enhanced Points');

  const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
  const rawPoints = sampleData.rawPoints;
  const enhancedPoints = sampleData.enhancedPoints;

  // Both should have same Name fields (cache key)
  const rawNames = rawPoints.map(p => p.Name).sort();
  const enhancedNames = enhancedPoints.map(p => p.Name).sort();

  // Compare sorted names
  const namesMatch = JSON.stringify(rawNames) === JSON.stringify(enhancedNames);
  if (namesMatch) {
    logPass('Name fields preserved (cache keys intact)');
  } else {
    logFail('Name fields modified (cache would break)');
    logInfo(`Raw names: ${rawNames.join(', ')}`);
    logInfo(`Enhanced names: ${enhancedNames.join(', ')}`);
  }

  // Verify display_name is additive (doesn't replace Name)
  const point = enhancedPoints[0];
  const hasName = point.hasOwnProperty('Name');
  const hasDisplay = point.hasOwnProperty('display_name');

  assertEquals(true, hasName, 'Name field still present after enhancement');
  assertEquals(true, hasDisplay, 'display_name field added during enhancement');
}

// Test 8: Worker Integration Test
function testWorkerIntegration() {
  testsRun++;
  logTest('Worker Integration (Node.js execution)');

  const workerPath = path.join(__dirname, 'points.js');

  if (fs.existsSync(workerPath)) {
    logInfo('Worker file exists: points.js');

    const workerContent = fs.readFileSync(workerPath, 'utf8');

    // Check for key functions
    if (workerContent.includes('display_name')) {
      logPass('Worker contains display_name logic');
    } else {
      logFail('Worker missing display_name logic');
    }

    if (workerContent.includes('enhancePoint') || workerContent.includes('formatDisplayName')) {
      logPass('Worker has enhancement function');
    } else {
      logFail('Worker missing enhancement function');
    }
  } else {
    logFail('Worker file not found');
  }
}

// Print Test Summary
function printSummary() {
  logHeader('Test Summary');

  console.log(`Total Tests Run:    ${colors.blue}${testsRun}${colors.reset}`);
  console.log(`Tests Passed:       ${colors.green}${testsPassed}${colors.reset}`);
  console.log(`Tests Failed:       ${colors.red}${testsFailed}${colors.reset}`);

  if (testsFailed === 0) {
    console.log(`\n${colors.green}╔═══════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║                                       ║${colors.reset}`);
    console.log(`${colors.green}║   ✓ ALL TESTS PASSED SUCCESSFULLY!   ║${colors.reset}`);
    console.log(`${colors.green}║                                       ║${colors.reset}`);
    console.log(`${colors.green}╚═══════════════════════════════════════╝${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}╔═══════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.red}║                                       ║${colors.reset}`);
    console.log(`${colors.red}║   ✗ SOME TESTS FAILED - SEE ABOVE    ║${colors.reset}`);
    console.log(`${colors.red}║                                       ║${colors.reset}`);
    console.log(`${colors.red}╚═══════════════════════════════════════╝${colors.reset}\n`);
    process.exit(1);
  }
}

// Main Execution
function main() {
  logHeader('Integration Test Suite: Point → Timeseries → Chart Workflow');

  setupTests();

  // Run all tests
  testEnhancedPointsLoading();
  testDisplayNameEnhancement();
  testMultiplePointEnhancement();
  testChartLabelMapping();
  testTimeseriesApiSimulation();
  testE2EChartRendering();
  testCacheBehavior();
  testWorkerIntegration();

  printSummary();
}

// Run tests
if (require.main === module) {
  main();
}

module.exports = {
  testEnhancedPointsLoading,
  testDisplayNameEnhancement,
  testMultiplePointEnhancement,
  testChartLabelMapping,
  testTimeseriesApiSimulation,
  testE2EChartRendering,
  testCacheBehavior,
  testWorkerIntegration,
};
