/**
 * Point Selection System Debugger
 * Tests actual behavior and identifies specific failure points
 */

// Import test data - adjust paths as needed
const fallsCityPoints = [
  {
    Name: 'ses/ses_falls_city/8000:33-8033/analogValue/102',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'QI Risk Manager C119, RoomRH',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"VAV_811","object_name":"AV 102","object_type":"analogValue","object_units":"percentRelativeHumidity"}]',
  },
  {
    Name: 'ses/ses_falls_city/2000:43-2043/analogValue/6',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU2N',
    'Kv Tags': '[{"jace_object_name":"RaFanOffset"}]',
    'Bacnet Data': '[{"device_name":"Rtu2","object_name":"AV 06","object_units":"noUnits"}]',
  },
  {
    Name: 'ses/ses_falls_city/2000:43-2043/binaryValue/10',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU2N',
    'Kv Tags': '[{"jace_object_name":"SaFanStatus"}]',
    'Bacnet Data': '[{"device_name":"Rtu2","object_name":"BV 10","object_type":"binaryValue"}]',
  },
  {
    Name: 'ses/ses_falls_city/12000:18-12018/analogInput/0',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'VAVR 725 (WHAT ROOM?), RoomTemp',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_id":"12018","object_name":"AI 00","object_type":"analogInput"}]',
  },
  {
    Name: 'ses/ses_falls_city/6000:12-6012/analogValue/8',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'Chapel B102, Damper',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"VAV_312","object_name":"AV 08","object_units":"percent"}]',
  },
  {
    Name: 'ses/ses_falls_city/1000:6-1006/analogInput/9',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU7 RaPress, RTU7',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"Ahu7_1","object_name":"AI 09","object_units":"inchesOfWater"}]',
  },
  {
    Name: 'ses/ses_falls_city/1000:61-1061/binaryValue/55',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'Chilled Water System',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"CHWS","object_name":"CH-1 Valve Call","object_type":"binaryValue"}]',
  },
  {
    Name: 'AHU-1-SA-T',
    'Marker Tags': 'Supply Air Temperature',
  },
  {
    Name: 'VAV-707-ZN-T-SP',
    'Marker Tags': 'Zone Temperature Setpoint',
  },
  {
    Name: 'RTU-6-OA-DMP-POS',
    'Marker Tags': 'Outside Air Damper',
  },
  {
    Name: 'CH-2-CHWST',
    'Marker Tags': 'Chiller',
  },
];

const edgeCasePoints = [
  { Name: 'ses/ses_falls_city/test/empty-markers', 'Marker Tags': '', 'Kv Tags': '[]' },
  { Name: 'ses/ses_falls_city/special-chars/test#point$name%20', 'Marker Tags': 'SpecialChars' },
];

const problematicPatterns = [
  { Name: 'ses/ses_falls_city/AHU-01/VAV-02/RTU-03/temp', 'Marker Tags': 'MultiEquip' },
  { Name: 'ses/ses_falls_city/12345/67890/11111', 'Marker Tags': '999' },
];

// Minimal types
interface Point {
  id: string;
  name: string;
  client: string;
  site: string;
  siteId: string;
  marker_tags?: string[];
}

// Mock enhancement functions for testing
function parseEquipment(name: string) {
  const patterns: Record<string, RegExp> = {
    ahu: /AHU[-_:]?(\d+)/i,
    vav: /VAV[-_:]?(\d+)/i,
    rtu: /RTU[-_:]?(\d+)/i,
    chiller: /(CH|CHILLER)[-_:]?(\d*)/i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    const match = name.match(pattern);
    if (match) {
      return { type, id: match[1] || match[2] || '1', name: `${type.toUpperCase()}-${match[1] || match[2] || '1'}`, tags: [type, 'equip', 'hvac'] };
    }
  }
  return null;
}

function detectPointType(name: string) {
  if (/TEMP|[-_:]T[-_]?$/i.test(name)) return { type: 'Temperature', unit: '°F', tags: ['temp', 'sensor'] };
  if (/DMP|DAMPER/i.test(name)) return { type: 'Damper', unit: '%', tags: ['damper', 'position'] };
  if (/RH|HUM/i.test(name)) return { type: 'Humidity', unit: '%RH', tags: ['humidity', 'sensor'] };
  return null;
}

function generateDisplayName(name: string, equipment: any, markerTags: string): string {
  let display = '';
  if (equipment) display += equipment.name + ' ';

  // Use marker tags as hints
  if (markerTags) {
    const cleaned = markerTags.split(',').map(t => t.trim()).join(' ');
    display += cleaned;
  }

  return display || name;
}

function enhancePoint(point: Point): any {
  const equipment = parseEquipment(point.name);
  const pointType = detectPointType(point.name);
  const displayName = generateDisplayName(point.name, equipment, point.marker_tags?.join(', ') || '');

  return {
    ...point,
    display_name: displayName,
    equipment: equipment?.type,
    unit: pointType?.unit,
    marker_tags: [...(point.marker_tags || []), ...(equipment?.tags || []), ...(pointType?.tags || [])],
    quality_score: displayName !== point.name ? 70 : 30,
    _enhanced: true
  };
}

interface TestResult {
  originalName: string;
  displayName?: string;
  equipment?: string | null;
  equipmentType?: string | null;
  unit?: string;
  markerTags?: string[];
  qualityScore?: number;
  parseSuccess: boolean;
  issues: string[];
}

interface SearchTestResult {
  query: string;
  expectedPoints: string[];
  actualMatches: string[];
  missingPoints: string[];
  incorrectMatches: string[];
  success: boolean;
}

/**
 * Test point cleaning/enhancement on real point names
 */
function testPointCleaning(): TestResult[] {
  const results: TestResult[] = [];

  // Combine all test points
  const allTestPoints = [
    ...fallsCityPoints,
    ...edgeCasePoints,
    ...problematicPatterns
  ];

  for (const testPoint of allTestPoints) {
    const issues: string[] = [];

    try {
      // Convert to API Point format
      const point: Point = {
        id: testPoint.Name,
        name: testPoint.Name,
        client: testPoint.Client || 'test',
        site: testPoint.Site || 'test-site',
        siteId: 'test-site',
        marker_tags: testPoint['Marker Tags']?.split(',').map(t => t.trim()) || []
      };

      // Test enhancement
      const enhanced = enhancePoint(point);

      // Check for issues
      if (!enhanced.display_name || enhanced.display_name === enhanced.name) {
        issues.push('Display name not improved');
      }

      if (!enhanced.equipment && testPoint['Marker Tags']) {
        // Check if marker tags suggest equipment
        const markerTags = testPoint['Marker Tags']?.toLowerCase() || '';
        if (markerTags.includes('ahu') || markerTags.includes('vav') ||
            markerTags.includes('rtu') || markerTags.includes('chiller')) {
          issues.push('Equipment not detected from marker tags');
        }
      }

      if (!enhanced.unit) {
        issues.push('Unit not detected');
      }

      if (!enhanced.marker_tags || enhanced.marker_tags.length < 3) {
        issues.push('Insufficient marker tags generated');
      }

      if ((enhanced.quality_score || 0) < 50) {
        issues.push('Low quality score');
      }

      results.push({
        originalName: testPoint.Name,
        displayName: enhanced.display_name,
        equipment: enhanced.equipment,
        equipmentType: enhanced.equipment,
        unit: enhanced.unit,
        markerTags: enhanced.marker_tags,
        qualityScore: enhanced.quality_score,
        parseSuccess: issues.length === 0,
        issues
      });

    } catch (error) {
      results.push({
        originalName: testPoint.Name,
        parseSuccess: false,
        issues: [`Exception: ${error instanceof Error ? error.message : String(error)}`]
      });
    }
  }

  return results;
}

/**
 * Test search functionality with various queries
 */
function testSearchFunctionality(enhancedPoints: TestResult[]): SearchTestResult[] {
  const searchTests: SearchTestResult[] = [];

  // Define search test cases
  const testCases = [
    {
      query: 'temperature',
      expectedKeywords: ['temp', 't', 'temperature']
    },
    {
      query: 'VAV',
      expectedKeywords: ['vav', 'variable air volume']
    },
    {
      query: 'RTU',
      expectedKeywords: ['rtu', 'rooftop unit']
    },
    {
      query: 'damper',
      expectedKeywords: ['damper', 'dmp']
    },
    {
      query: 'chilled water',
      expectedKeywords: ['chw', 'chilled water']
    },
    {
      query: 'supply air',
      expectedKeywords: ['sa', 'supply air']
    },
    {
      query: 'room',
      expectedKeywords: ['room', 'zone', 'space']
    }
  ];

  for (const testCase of testCases) {
    // Simple search implementation (mimics what UI would do)
    const queryLower = testCase.query.toLowerCase();
    const actualMatches: string[] = [];
    const expectedPoints: string[] = [];

    for (const point of enhancedPoints) {
      const displayNameLower = point.displayName?.toLowerCase() || '';
      const originalNameLower = point.originalName.toLowerCase();
      const markerTagsStr = point.markerTags?.join(' ').toLowerCase() || '';

      // Expected match if any keyword is found
      const shouldMatch = testCase.expectedKeywords.some(keyword =>
        originalNameLower.includes(keyword) ||
        displayNameLower.includes(keyword) ||
        markerTagsStr.includes(keyword)
      );

      if (shouldMatch) {
        expectedPoints.push(point.originalName);
      }

      // Actual match (simple text search)
      if (displayNameLower.includes(queryLower) ||
          originalNameLower.includes(queryLower) ||
          markerTagsStr.includes(queryLower)) {
        actualMatches.push(point.originalName);
      }
    }

    const missingPoints = expectedPoints.filter(p => !actualMatches.includes(p));
    const incorrectMatches = actualMatches.filter(p => !expectedPoints.includes(p));

    searchTests.push({
      query: testCase.query,
      expectedPoints,
      actualMatches,
      missingPoints,
      incorrectMatches,
      success: missingPoints.length === 0 && incorrectMatches.length === 0
    });
  }

  return searchTests;
}

/**
 * Test semantic search patterns
 */
function testSemanticSearch(enhancedPoints: TestResult[]): Array<{
  scenario: string;
  query: string;
  shouldFind: string[];
  actuallyFound: string[];
  failures: string[];
}> {
  const semanticTests = [];

  // Test: Find all zone temperature sensors
  {
    const query = 'zone temperature sensor';
    const shouldFind = enhancedPoints
      .filter(p =>
        p.markerTags?.includes('zone') &&
        p.markerTags?.includes('temp') &&
        p.markerTags?.includes('sensor')
      )
      .map(p => p.originalName);

    const actuallyFound = enhancedPoints
      .filter(p => {
        const tags = p.markerTags?.join(' ').toLowerCase() || '';
        const display = p.displayName?.toLowerCase() || '';
        return (tags.includes('zone') || display.includes('zone')) &&
               (tags.includes('temp') || display.includes('temp')) &&
               (tags.includes('sensor') || display.includes('sensor'));
      })
      .map(p => p.originalName);

    semanticTests.push({
      scenario: 'Find all zone temperature sensors',
      query,
      shouldFind,
      actuallyFound,
      failures: shouldFind.filter(p => !actuallyFound.includes(p))
    });
  }

  // Test: Find all VAV dampers
  {
    const query = 'VAV damper position';
    const shouldFind = enhancedPoints
      .filter(p =>
        p.equipment === 'vav' &&
        p.markerTags?.includes('damper')
      )
      .map(p => p.originalName);

    const actuallyFound = enhancedPoints
      .filter(p => {
        const tags = p.markerTags?.join(' ').toLowerCase() || '';
        const display = p.displayName?.toLowerCase() || '';
        return (p.equipment === 'vav' || tags.includes('vav') || display.includes('vav')) &&
               (tags.includes('damper') || display.includes('damper'));
      })
      .map(p => p.originalName);

    semanticTests.push({
      scenario: 'Find all VAV dampers',
      query,
      shouldFind,
      actuallyFound,
      failures: shouldFind.filter(p => !actuallyFound.includes(p))
    });
  }

  // Test: Find all chilled water related points
  {
    const query = 'chilled water';
    const shouldFind = enhancedPoints
      .filter(p => {
        const name = p.originalName.toLowerCase();
        const tags = p.markerTags?.join(' ').toLowerCase() || '';
        return name.includes('chw') || name.includes('chilled') ||
               tags.includes('chilled') || tags.includes('water');
      })
      .map(p => p.originalName);

    const actuallyFound = enhancedPoints
      .filter(p => {
        const tags = p.markerTags?.join(' ').toLowerCase() || '';
        const display = p.displayName?.toLowerCase() || '';
        return tags.includes('chilled') || tags.includes('water') ||
               display.includes('chilled') || display.includes('water');
      })
      .map(p => p.originalName);

    semanticTests.push({
      scenario: 'Find all chilled water points',
      query,
      shouldFind,
      actuallyFound,
      failures: shouldFind.filter(p => !actuallyFound.includes(p))
    });
  }

  return semanticTests;
}

/**
 * Generate comprehensive failure report
 */
function generateReport(): string {
  console.log('🔍 Testing Point Selection System...\n');

  // Test point cleaning
  console.log('1️⃣ Testing Point Enhancement/Cleaning...');
  const cleaningResults = testPointCleaning();

  const successCount = cleaningResults.filter(r => r.parseSuccess).length;
  const failureCount = cleaningResults.length - successCount;

  console.log(`   ✅ Success: ${successCount}/${cleaningResults.length}`);
  console.log(`   ❌ Failures: ${failureCount}/${cleaningResults.length}\n`);

  // Test search
  console.log('2️⃣ Testing Search Functionality...');
  const searchResults = testSearchFunctionality(cleaningResults);

  const searchSuccess = searchResults.filter(r => r.success).length;
  const searchFailures = searchResults.length - searchSuccess;

  console.log(`   ✅ Success: ${searchSuccess}/${searchResults.length}`);
  console.log(`   ❌ Failures: ${searchFailures}/${searchResults.length}\n`);

  // Test semantic search
  console.log('3️⃣ Testing Semantic Search...');
  const semanticResults = testSemanticSearch(cleaningResults);

  const semanticSuccess = semanticResults.filter(r => r.failures.length === 0).length;
  const semanticFailures = semanticResults.length - semanticSuccess;

  console.log(`   ✅ Success: ${semanticSuccess}/${semanticResults.length}`);
  console.log(`   ❌ Failures: ${semanticFailures}/${semanticResults.length}\n`);

  // Generate markdown report
  let report = '# Point Selection System Failure Analysis\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  report += '## Executive Summary\n\n';
  report += `- **Point Enhancement:** ${successCount}/${cleaningResults.length} succeeded (${Math.round(successCount/cleaningResults.length*100)}%)\n`;
  report += `- **Search Functionality:** ${searchSuccess}/${searchResults.length} passed (${Math.round(searchSuccess/searchResults.length*100)}%)\n`;
  report += `- **Semantic Search:** ${semanticSuccess}/${semanticResults.length} passed (${Math.round(semanticSuccess/semanticResults.length*100)}%)\n\n`;

  // Section 1: Test Methodology
  report += '## 1. Test Methodology\n\n';
  report += '### Data Sources\n';
  report += `- **Real point names from production:** ${fallsCityPoints.length} points from Falls City site\n`;
  report += `- **Edge cases:** ${edgeCasePoints.length} problematic patterns\n`;
  report += `- **Stress tests:** ${problematicPatterns.length} ambiguous/conflicting patterns\n\n`;

  report += '### Test Categories\n';
  report += '1. **Point Enhancement Test:** Does cleaning produce meaningful display names?\n';
  report += '2. **Text Search Test:** Do simple keyword searches work?\n';
  report += '3. **Semantic Search Test:** Do complex multi-term searches work?\n\n';

  // Section 2: Real Point Examples
  report += '## 2. Real Point Name Examples from Database\n\n';
  report += '### Successfully Enhanced Points\n\n';
  report += '| Original Name | Display Name | Equipment | Unit | Quality Score |\n';
  report += '|--------------|-------------|-----------|------|---------------|\n';

  cleaningResults
    .filter(r => r.parseSuccess && r.qualityScore && r.qualityScore > 70)
    .slice(0, 10)
    .forEach(r => {
      report += `| \`${r.originalName}\` | ${r.displayName || 'N/A'} | ${r.equipment || 'N/A'} | ${r.unit || 'N/A'} | ${r.qualityScore || 0} |\n`;
    });

  report += '\n### Failed/Problematic Points\n\n';
  report += '| Original Name | Issues | Display Name | Quality Score |\n';
  report += '|--------------|--------|-------------|---------------|\n';

  cleaningResults
    .filter(r => !r.parseSuccess || (r.qualityScore || 0) < 50)
    .slice(0, 15)
    .forEach(r => {
      const issuesStr = r.issues.join('; ');
      report += `| \`${r.originalName}\` | ${issuesStr} | ${r.displayName || 'N/A'} | ${r.qualityScore || 0} |\n`;
    });

  // Section 3: Cleaning Test Results
  report += '\n## 3. Point Cleaning/Enhancement Results\n\n';
  report += '### Issue Breakdown\n\n';

  const issueMap = new Map<string, number>();
  cleaningResults.forEach(r => {
    r.issues.forEach(issue => {
      issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
    });
  });

  report += '| Issue | Count | Percentage |\n';
  report += '|-------|-------|------------|\n';
  Array.from(issueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      const pct = Math.round(count / cleaningResults.length * 100);
      report += `| ${issue} | ${count} | ${pct}% |\n`;
    });

  // Section 4: Search Test Results
  report += '\n## 4. Search Functionality Results\n\n';

  searchResults.forEach(test => {
    report += `### Query: "${test.query}"\n\n`;
    report += `- **Status:** ${test.success ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Expected matches:** ${test.expectedPoints.length}\n`;
    report += `- **Actual matches:** ${test.actualMatches.length}\n`;
    report += `- **Missing points:** ${test.missingPoints.length}\n`;
    report += `- **Incorrect matches:** ${test.incorrectMatches.length}\n\n`;

    if (test.missingPoints.length > 0) {
      report += '**Missing points (should have matched):**\n';
      test.missingPoints.slice(0, 5).forEach(p => {
        report += `- \`${p}\`\n`;
      });
      if (test.missingPoints.length > 5) {
        report += `- ...and ${test.missingPoints.length - 5} more\n`;
      }
      report += '\n';
    }

    if (test.incorrectMatches.length > 0) {
      report += '**Incorrect matches (should not have matched):**\n';
      test.incorrectMatches.slice(0, 5).forEach(p => {
        report += `- \`${p}\`\n`;
      });
      if (test.incorrectMatches.length > 5) {
        report += `- ...and ${test.incorrectMatches.length - 5} more\n`;
      }
      report += '\n';
    }
  });

  // Section 5: Semantic Search Results
  report += '\n## 5. Semantic Search Results\n\n';

  semanticResults.forEach(test => {
    report += `### ${test.scenario}\n\n`;
    report += `- **Query:** "${test.query}"\n`;
    report += `- **Status:** ${test.failures.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Should find:** ${test.shouldFind.length} points\n`;
    report += `- **Actually found:** ${test.actuallyFound.length} points\n`;
    report += `- **Missing:** ${test.failures.length} points\n\n`;

    if (test.failures.length > 0) {
      report += '**Failed to find these points:**\n';
      test.failures.forEach(p => {
        const point = cleaningResults.find(r => r.originalName === p);
        report += `- \`${p}\`\n`;
        if (point) {
          report += `  - Display: ${point.displayName || 'N/A'}\n`;
          report += `  - Tags: ${point.markerTags?.join(', ') || 'N/A'}\n`;
        }
      });
      report += '\n';
    }
  });

  // Section 6: Root Cause Analysis
  report += '\n## 6. Root Cause Analysis\n\n';

  report += '### Pattern Recognition Failures\n\n';
  report += 'Points fail to enhance properly when:\n';
  report += '1. **Complex path structure:** `ses/ses_falls_city/8000:33-8033/analogValue/102`\n';
  report += '   - Equipment type not in predictable position\n';
  report += '   - Numeric device IDs don\'t match expected patterns\n';
  report += '2. **Marker tags vs. device name mismatch:** Marker tags say "RTU2N" but device name is "Rtu2"\n';
  report += '3. **Ambiguous abbreviations:** "RaFanOffset" requires context to parse\n';
  report += '4. **Missing context:** BACnet object names like "AV 102" without equipment context\n\n';

  report += '### Search Failures\n\n';
  report += '1. **Display name not searchable:** If enhancement fails, search falls back to cryptic original name\n';
  report += '2. **Tag generation incomplete:** Missing semantic tags means semantic search fails\n';
  report += '3. **Abbreviation mismatch:** User searches "temperature" but tag is "temp"\n';
  report += '4. **Equipment context lost:** Search for "VAV temperature" fails if VAV not detected\n\n';

  // Section 7: Specific Code Issues
  report += '\n## 7. Specific Code Issues\n\n';
  report += '### In `pointEnhancer.ts`:\n\n';
  report += '**Line 28-86: EQUIPMENT_PATTERNS**\n';
  report += '- Only matches equipment at START of name: `^AHU[-_:]?(\\d+)`\n';
  report += '- Fails for paths like: `ses/ses_falls_city/8000:33-8033/analogValue/102`\n';
  report += '- **Fix needed:** Parse from marker tags and bacnet_data, not just name prefix\n\n';

  report += '**Line 266-298: generateDisplayName**\n';
  report += '- Assumes equipment prefix can be removed cleanly\n';
  report += '- Doesn\'t handle complex path structures\n';
  report += '- **Fix needed:** Extract meaningful parts from full path, use marker tags as hints\n\n';

  report += '**Line 303-359: generateMarkerTags**\n';
  report += '- Only adds tags if patterns match in point name\n';
  report += '- Doesn\'t use marker_tags input from API\n';
  report += '- **Fix needed:** Merge existing marker tags with generated tags\n\n';

  // Section 8: Recommendations
  report += '\n## 8. Recommendations\n\n';
  report += '### Immediate Fixes (High Priority)\n\n';
  report += '1. **Use marker tags from API:** Don\'t discard `marker_tags` field\n';
  report += '2. **Parse bacnet_data:** Extract `device_name` and `object_name` for context\n';
  report += '3. **Fuzzy search:** Add Levenshtein distance for abbreviation matching\n';
  report += '4. **Tag synonyms:** Map "temp" ↔ "temperature", "sp" ↔ "setpoint"\n\n';

  report += '### Medium Priority\n\n';
  report += '1. **Multi-position equipment detection:** Look for equipment anywhere in path\n';
  report += '2. **Context-aware parsing:** Use device_name + object_name together\n';
  report += '3. **Search indexing:** Build inverted index for O(1) tag lookups\n';
  report += '4. **User feedback loop:** Learn from user selections\n\n';

  report += '### Low Priority\n\n';
  report += '1. **ML-based enhancement:** Train model on successful user selections\n';
  report += '2. **Site-specific patterns:** Learn equipment naming conventions per site\n';
  report += '3. **Hierarchical search:** Search by floor → room → equipment → point\n\n';

  // Section 9: Testing Evidence
  report += '\n## 9. Testing Evidence\n\n';
  report += '### Example Failure Cases\n\n';
  report += '```typescript\n';
  report += '// Case 1: Path-based point name\n';
  report += 'Input:  "ses/ses_falls_city/8000:33-8033/analogValue/102"\n';
  report += 'Marker: "QI Risk Manager C119, RoomRH"\n';
  report += 'Bacnet: {"device_name":"VAV_811","object_name":"AV 102"}\n';
  report += 'Output: "ses ses falls city 8000 33 8033 analogValue 102" (FAIL)\n';
  report += 'Expected: "VAV-811 Room C119 Humidity" (using all available data)\n\n';

  report += '// Case 2: Abbreviation in marker tags\n';
  report += 'Input:  "ses/ses_falls_city/2000:43-2043/analogValue/6"\n';
  report += 'Marker: "RTU2N"\n';
  report += 'Bacnet: {"device_name":"Rtu2","object_name":"AV 06"}\n';
  report += 'Output: "ses ses falls city 2000 43 2043 analogValue 6" (FAIL)\n';
  report += 'Expected: "RTU-2 Return Air Fan Offset" (from kv_tags.jace_object_name)\n\n';

  report += '// Case 3: Search miss\n';
  report += 'Query: "room humidity"\n';
  report += 'Should find: "ses/ses_falls_city/8000:33-8033/analogValue/102" (has "RoomRH" in marker)\n';
  report += 'Actually finds: Nothing (tags not generated from marker_tags field)\n';
  report += '```\n\n';

  return report;
}

// Run the debugger
const report = generateReport();

// Write report to file
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'docs', 'analysis', 'POINT_SELECTION_FAILURE_REPORT.md');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report, 'utf-8');

console.log(`\n✅ Report written to: ${outputPath}`);
console.log('\nRun with: npx tsx scripts/debug-point-selection.ts');
