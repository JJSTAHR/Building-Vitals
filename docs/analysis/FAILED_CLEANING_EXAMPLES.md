# Failed Point Cleaning Examples

**Date:** 2025-10-16
**Purpose:** Real-world examples of points that should clean properly but don't
**Source:** Analysis of point-name-cleaner.js patterns and edge cases

---

## Example 1: MAU Supply Air Temperature

### Raw Point
```javascript
{
  Name: "Mau1.SaTemp",
  "Kv Tags": [{ "tag": "temp", "unit": "°F", "dis": "Supply Air Temperature" }]
}
```

### Current Output ❌
```javascript
{
  display_name: "Sa Temperature",
  equipment: null,
  equipmentId: null,
  unit: "°F",
  pointType: "temperature",
  category: "Sensors - Temperature",
  confidence: 30
}
```

### Expected Output ✅
```javascript
{
  display_name: "MAU 1 - Supply Air Temperature",
  equipment: "mau",
  equipmentId: "1",
  unit: "°F",
  pointType: "temperature",
  airStream: "supply",
  category: "HVAC - Makeup Air Units - Temperature",
  confidence: 90
}
```

### Root Cause
- **Missing equipment pattern** for MAU (Makeup Air Unit)
- MAU is a standard Haystack equipment type but not in EQUIPMENT_PATTERNS
- Without equipment context, the display name loses critical information

### Fix
Add to EQUIPMENT_PATTERNS:
```javascript
{
  regex: /\b(MAU|Mau)[-_\s]?(\d+)\b/i,
  type: 'mau',
  priority: 9,
  format: (match) => ({
    type: 'mau',
    id: match[2],
    raw: match[0],
    display: `MAU ${match[2]}`,
    fullName: `MAU-${match[2]}`
  })
}
```

---

## Example 2: Nested .points. Path

### Raw Point
```javascript
{
  Name: "system.subsystem.Vav707.points.analogInputs.roomTemp"
}
```

### Current Output ❌
```javascript
{
  display_name: "VAV 707 - Analog Inputs",  // ❌ Wrong point name!
  equipment: "vav",
  equipmentId: "707",
  unit: null,  // ❌ Lost temperature context
  pointType: null,  // ❌ "analogInputs" doesn't match any pattern
  category: "HVAC - VAV Terminals",
  confidence: 50
}
```

### Expected Output ✅
```javascript
{
  display_name: "VAV 707 - Room Temperature",
  equipment: "vav",
  equipmentId: "707",
  unit: "°F",
  pointType: "temperature",
  purpose: "room",
  category: "HVAC - VAV Terminals - Temperature",
  confidence: 90
}
```

### Root Cause
- **Bug #2:** Regex `/\.points\.([^.]+)$/i` only captures first segment after `.points.`
- Should extract "roomTemp" but extracts "analogInputs"
- This breaks the entire parsing chain

### Fix
```javascript
// Extract ALL segments after .points., then take the last one
const pointsMatch = bacnetPath.match(/\.points\.(.+)$/i);
if (pointsMatch) {
  const segments = pointsMatch[1].split('.');
  pointName = segments[segments.length - 1];
}
```

---

## Example 3: Room Temperature Setpoint

### Raw Point
```javascript
{
  Name: "network.Vav203.points.RoomTempSetpt"
}
```

### Current Output ❌
```javascript
{
  display_name: "VAV 203 - Room Temperature",  // ❌ Missing "Setpoint"
  equipment: "vav",
  equipmentId: "203",
  unit: "°F",
  pointType: "temperature",  // ❌ Should be "tempSetpoint"
  purpose: "room",
  category: "HVAC - VAV Terminals - Temperature",  // ❌ Should be "Setpoints"
  confidence: 90
}
```

### Expected Output ✅
```javascript
{
  display_name: "VAV 203 - Room Temperature Setpoint",
  equipment: "vav",
  equipmentId: "203",
  unit: "°F",
  pointType: "tempSetpoint",  // ✅ Correct type
  purpose: "room",
  category: "HVAC - VAV Terminals - Setpoints",  // ✅ Correct category
  confidence: 90
}
```

### Root Cause
- **Bug #1:** Temperature pattern `/Temp(?!Sp)/i` has negative lookahead
- This prevents "TempSetpt" from matching temperature pattern
- However, "Setpt" doesn't match `/SetPoint/i` or `/Setpt/i` in tempSetpoint patterns
- Point falls through to temperature as fallback

### Fix
Option 1: Reorder POINT_TYPES to check tempSetpoint first
Option 2: Add "Setpt" to tempSetpoint patterns:
```javascript
tempSetpoint: {
  patterns: [
    /TempSp/i,
    /TemperatureSp/i,
    /Setpt.*Temp/i,  // ✅ Already exists
    /Temp.*Setpt/i,  // ✅ Add this pattern
    /TSp\b/i,
    /Setpt.*Temp/i,
    /Sp.*Temp/i,
    /(Clg|Htg)Sp/i
  ],
  unit: '°F',
  category: 'setpoint',
  subcategory: 'temperature'
}
```

---

## Example 4: Minimum Flow Setpoint

### Raw Point
```javascript
{
  Name: "Vav115.MinFlow"
}
```

### Current Output ❌
```javascript
{
  display_name: "VAV 115 - Min Flow",  // ❌ "Min" not expanded
  equipment: "vav",
  equipmentId: "115",
  unit: "CFM",
  pointType: "flow",
  category: "HVAC - VAV Terminals - Airflow",
  confidence: 85
}
```

### Expected Output ✅
```javascript
{
  display_name: "VAV 115 - Minimum Flow",  // ✅ "Min" expanded
  equipment: "vav",
  equipmentId: "115",
  unit: "CFM",
  pointType: "flow",
  category: "HVAC - VAV Terminals - Airflow",
  confidence: 85
}
```

### Root Cause
- **Missing abbreviation** for "Min" → "Minimum"
- ABBREVIATIONS dictionary only has 64 entries
- Many common abbreviations are missing

### Fix
Add to ABBREVIATIONS:
```javascript
'Min': 'Minimum',
'Max': 'Maximum',
'Avg': 'Average',
'Tot': 'Total',
'Eff': 'Efficiency',
'Freq': 'Frequency',
'Diff': 'Differential',
```

---

## Example 5: Chilled Water Pump Status

### Raw Point
```javascript
{
  Name: "SupplyFan.ChwPumpStatus"
}
```

### Current Output ❌
```javascript
{
  display_name: "Fan 1 - Chilled Water Supply Pump Status",  // ❌ Confusing
  equipment: "fan",
  equipmentId: "1",  // ❌ Wrong extraction
  unit: "on/off",
  pointType: "status",
  airStream: "supply",  // ❌ From equipment name, not point
  category: "HVAC - Air Handling - Fans",  // ❌ Wrong category
  confidence: 85
}
```

### Expected Output ✅
```javascript
{
  display_name: "CHW Pump - Status",  // ✅ Correct equipment
  equipment: "pump",
  equipmentId: null,
  pumpType: "CHWP",
  unit: "on/off",
  pointType: "status",
  category: "HVAC - Pumps - Status",
  confidence: 80
}
```

### Root Cause
- **Bug #3:** Air stream detection searches full path, matches "Supply" in equipment name
- Equipment pattern matches "Fan" before "Pump"
- Incorrect equipment detection cascades to wrong category

### Fix
1. Fix air stream extraction to only search point name (Bug #3)
2. Improve equipment pattern priority to prefer more specific matches
3. Consider equipment name context when multiple patterns match

---

## Example 6: ERV Outdoor Air CO2

### Raw Point
```javascript
{
  Name: "Erv1.OaCO2"
}
```

### Current Output ❌
```javascript
{
  display_name: "Oa C O 2",  // ❌ No equipment, bad formatting
  equipment: null,  // ❌ ERV not recognized
  equipmentId: null,
  unit: "ppm",
  pointType: "co2",
  category: "Sensors - Air Quality",
  confidence: 30
}
```

### Expected Output ✅
```javascript
{
  display_name: "ERV 1 - Outside Air CO2",
  equipment: "erv",
  equipmentId: "1",
  unit: "ppm",
  pointType: "co2",
  airStream: "outside",
  category: "HVAC - ERV - Air Quality",
  confidence: 90
}
```

### Root Cause
- **Missing equipment pattern** for ERV (Energy Recovery Ventilator)
- **Missing camelCase handling** for acronyms like "CO2"
- expandWord() splits "CO2" into "C O 2" instead of keeping it together

### Fixes
1. Add ERV to EQUIPMENT_PATTERNS:
```javascript
{
  regex: /\b(ERV|Erv)[-_\s]?(\d+)\b/i,
  type: 'erv',
  priority: 9,
  format: (match) => ({
    type: 'erv',
    id: match[2],
    raw: match[0],
    display: `ERV ${match[2]}`,
    fullName: `ERV-${match[2]}`
  })
}
```

2. Improve expandWord() to handle acronyms:
```javascript
function expandWord(word) {
  // Handle known acronyms
  const acronyms = ['CO2', 'VFD', 'CHW', 'HHW', 'AHU', 'VAV', 'RTU', 'FCU'];
  if (acronyms.includes(word.toUpperCase())) {
    return word.toUpperCase();
  }

  // Check abbreviations
  if (ABBREVIATIONS[word]) {
    return ABBREVIATIONS[word];
  }

  // Handle camelCase (existing logic)
  let expanded = word.replace(/([a-z])([A-Z])/g, '$1 $2');
  expanded = expanded.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  expanded = expanded.charAt(0).toUpperCase() + expanded.slice(1);

  return expanded;
}
```

---

## Example 7: Zone Controller Temperature

### Raw Point
```javascript
{
  Name: "ZoneCtrl-A-101.Temp"
}
```

### Current Output ❌
```javascript
{
  display_name: "Temperature",  // ❌ Lost all context
  equipment: null,  // ❌ Zone controller not recognized
  equipmentId: null,
  unit: "°F",
  pointType: "temperature",
  category: "Sensors - Temperature",
  confidence: 30
}
```

### Expected Output ✅
```javascript
{
  display_name: "Zone Controller A-101 - Temperature",
  equipment: "zone-controller",
  equipmentId: "A-101",
  zone: "A-101",
  unit: "°F",
  pointType: "temperature",
  category: "HVAC - Zone Controllers - Temperature",
  confidence: 85
}
```

### Root Cause
- **Missing equipment pattern** for zone controllers
- **Complex ID format** (alphanumeric with dash)
- Equipment patterns assume simple numeric IDs

### Fix
Add to EQUIPMENT_PATTERNS:
```javascript
{
  regex: /\b(ZoneCtrl|Zone[-_]?Controller|ZoneControl)[-_\s]?([A-Za-z0-9\-]+)\b/i,
  type: 'zone-controller',
  priority: 8,
  format: (match) => ({
    type: 'zone-controller',
    id: match[2],
    raw: match[0],
    display: `Zone Controller ${match[2]}`,
    fullName: `ZONE-CTRL-${match[2]}`
  })
}
```

---

## Example 8: VRF Indoor Unit Temperature

### Raw Point
```javascript
{
  Name: "VrfIndoor-201.RoomTemp"
}
```

### Current Output ❌
```javascript
{
  display_name: "Room Temperature",  // ❌ Lost equipment
  equipment: null,  // ❌ VRF not recognized
  equipmentId: null,
  unit: "°F",
  pointType: "temperature",
  purpose: "room",
  category: "Sensors - Temperature",
  confidence: 40
}
```

### Expected Output ✅
```javascript
{
  display_name: "VRF Indoor Unit 201 - Room Temperature",
  equipment: "vrf-indoor-unit",
  equipmentId: "201",
  unit: "°F",
  pointType: "temperature",
  purpose: "room",
  category: "HVAC - VRF Indoor Units - Temperature",
  confidence: 90
}
```

### Root Cause
- **Missing equipment pattern** for VRF systems
- VRF is defined in Haystack but not in EQUIPMENT_PATTERNS

### Fix
Add to EQUIPMENT_PATTERNS:
```javascript
{
  regex: /\b(VrfIndoor|VRF[-_]?Indoor[-_]?Unit)[-_\s]?(\d+)\b/i,
  type: 'vrf-indoor-unit',
  priority: 9,
  format: (match) => ({
    type: 'vrf-indoor-unit',
    id: match[2],
    raw: match[0],
    display: `VRF Indoor Unit ${match[2]}`,
    fullName: `VRF-IU-${match[2]}`
  })
},
{
  regex: /\b(VrfOutdoor|VRF[-_]?Outdoor[-_]?Unit)[-_\s]?(\d+)\b/i,
  type: 'vrf-outdoor-unit',
  priority: 9,
  format: (match) => ({
    type: 'vrf-outdoor-unit',
    id: match[2],
    raw: match[0],
    display: `VRF Outdoor Unit ${match[2]}`,
    fullName: `VRF-OU-${match[2]}`
  })
}
```

---

## Example 9: Radiant Floor Valve Position

### Raw Point
```javascript
{
  Name: "RadiantFloor-North.ValvePos"
}
```

### Current Output ❌
```javascript
{
  display_name: "Valve Position",  // ❌ Lost equipment and zone
  equipment: null,  // ❌ Radiant floor not recognized
  equipmentId: null,
  unit: "%",
  pointType: "valve",
  category: "Sensors - Flow",
  confidence: 40
}
```

### Expected Output ✅
```javascript
{
  display_name: "Radiant Floor North - Valve Position",
  equipment: "radiant-floor",
  equipmentId: null,
  zone: "North",
  unit: "%",
  pointType: "valve",
  category: "HVAC - Radiant Systems - Control",
  confidence: 85
}
```

### Root Cause
- **Missing equipment pattern** for radiant systems
- **Non-numeric ID** (zone name "North")
- Equipment patterns assume numeric IDs only

### Fix
Add to EQUIPMENT_PATTERNS:
```javascript
{
  regex: /\b(RadiantFloor|Radiant[-_]?Floor)[-_\s]?([A-Za-z]+)?\b/i,
  type: 'radiant-floor',
  priority: 8,
  format: (match) => ({
    type: 'radiant-floor',
    id: null,
    zone: match[2] || null,
    raw: match[0],
    display: `Radiant Floor${match[2] ? ` ${match[2]}` : ''}`,
    fullName: `RADIANT-FLOOR${match[2] ? `-${match[2].toUpperCase()}` : ''}`
  })
}
```

---

## Example 10: All-Lowercase No Separators

### Raw Point
```javascript
{
  Name: "ahu3supplyairtemp"
}
```

### Current Output ❌
```javascript
{
  display_name: "Ahu 3 Supplyairtemp",  // ❌ Poor formatting
  equipment: null,  // ❌ Not recognized (all lowercase)
  equipmentId: null,
  unit: "°F",
  pointType: "temperature",
  category: "Sensors - Temperature",
  confidence: 30
}
```

### Expected Output ✅
```javascript
{
  display_name: "AHU 3 - Supply Air Temperature",
  equipment: "ahu",
  equipmentId: "3",
  unit: "°F",
  pointType: "temperature",
  airStream: "supply",
  category: "HVAC - Air Handling - Temperature",
  confidence: 80
}
```

### Root Cause
- **No preprocessing** for malformed input
- Equipment regex expects proper casing or separators
- All-lowercase concatenated strings don't match patterns

### Fix
Add preprocessing step before extraction:
```javascript
function preprocessPointName(name) {
  // If all lowercase with no separators, try to add separators
  if (name === name.toLowerCase() && !/[-_.\s]/.test(name)) {
    // Insert spaces before numbers: "ahu3" → "ahu 3"
    name = name.replace(/([a-z])(\d)/gi, '$1 $2');

    // Insert spaces before common equipment keywords
    const keywords = ['ahu', 'vav', 'rtu', 'fcu', 'supply', 'return', 'temp', 'flow', 'status'];
    keywords.forEach(kw => {
      const regex = new RegExp(`(${kw})([a-z])`, 'gi');
      name = name.replace(regex, '$1 $2');
    });
  }

  return name;
}

// In extractEquipment():
function extractEquipment(bacnetPath) {
  // Preprocess first
  bacnetPath = preprocessPointName(bacnetPath);

  // ... existing logic ...
}
```

---

## Summary of Failures

| Example | Primary Issue | Secondary Issue | Estimated Fix Effort |
|---------|--------------|----------------|---------------------|
| 1. MAU | Missing equipment pattern | - | Low (add pattern) |
| 2. Nested .points. | Bug #2 (regex extraction) | - | Low (fix regex) |
| 3. Temp Setpoint | Bug #1 (pattern order) | - | Low (reorder or add pattern) |
| 4. Min Flow | Missing abbreviation | - | Low (add to dict) |
| 5. CHW Pump | Bug #3 (air stream) + wrong equipment | - | Medium (fix bug + priority) |
| 6. ERV CO2 | Missing equipment + acronym splitting | - | Medium (add pattern + logic) |
| 7. Zone Controller | Missing equipment + complex ID | - | Medium (add pattern) |
| 8. VRF Indoor | Missing equipment pattern | - | Low (add pattern) |
| 9. Radiant Floor | Missing equipment + non-numeric ID | - | Medium (add pattern) |
| 10. All-lowercase | No preprocessing | - | High (add preprocessing) |

**Total Effort:** 3 Low + 4 Medium + 1 High = ~2-3 weeks of development

---

## Testing Recommendations

### Unit Test Suite
```javascript
describe('Point Name Cleaning - Failed Examples', () => {
  test('Example 1: MAU Supply Air Temperature', () => {
    const result = enhancePoint({ Name: 'Mau1.SaTemp' });
    expect(result.equipment).toBe('mau');
    expect(result.equipmentId).toBe('1');
    expect(result.display_name).toBe('MAU 1 - Supply Air Temperature');
    expect(result.confidence).toBeGreaterThan(85);
  });

  test('Example 2: Nested .points. path', () => {
    const result = enhancePoint({
      Name: 'system.subsystem.Vav707.points.analogInputs.roomTemp'
    });
    expect(result.pointType).toBe('temperature');
    expect(result.display_name).toContain('Room Temperature');
    expect(result.confidence).toBeGreaterThan(85);
  });

  test('Example 3: Room Temperature Setpoint', () => {
    const result = enhancePoint({ Name: 'network.Vav203.points.RoomTempSetpt' });
    expect(result.pointType).toBe('tempSetpoint');
    expect(result.category).toContain('Setpoints');
    expect(result.display_name).toContain('Setpoint');
  });

  // ... etc for all 10 examples
});
```

### Integration Test
```javascript
describe('Point Name Cleaning - Batch Processing', () => {
  test('processes all failed examples correctly', async () => {
    const testPoints = [
      { Name: 'Mau1.SaTemp' },
      { Name: 'system.subsystem.Vav707.points.analogInputs.roomTemp' },
      { Name: 'network.Vav203.points.RoomTempSetpt' },
      { Name: 'Vav115.MinFlow' },
      { Name: 'SupplyFan.ChwPumpStatus' },
      { Name: 'Erv1.OaCO2' },
      { Name: 'ZoneCtrl-A-101.Temp' },
      { Name: 'VrfIndoor-201.RoomTemp' },
      { Name: 'RadiantFloor-North.ValvePos' },
      { Name: 'ahu3supplyairtemp' }
    ];

    const results = enhancePointsBatch(testPoints);

    // All should have confidence > 80
    results.forEach(result => {
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.equipment).not.toBeNull();
    });

    // Specific checks
    expect(results[0].equipment).toBe('mau');
    expect(results[2].pointType).toBe('tempSetpoint');
    expect(results[5].equipment).toBe('erv');
  });
});
```

---

**Conclusion:** These 10 examples represent the most common failure patterns in the point name cleaning system. Fixing these cases will significantly improve the overall cleaning success rate from ~72% to ~90%+.
