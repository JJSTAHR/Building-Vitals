# BACnet Point Naming Pattern Analysis
## SES Falls City Community Medical Center

**Research Date:** 2025-10-13
**Data Source:** ACE IoT API - ses_falls_city site
**Sample Size:** 70+ real point configurations analyzed

---

## Executive Summary

This analysis examines real BACnet point naming conventions from the SES Falls City site to extract:
1. Equipment identification patterns
2. Point type taxonomies
3. Hierarchical structure mapping
4. Parsing strategies for automated classification

**Key Finding:** Point information is distributed across multiple fields, NOT just the name. The combination of:
- `Name` field (BACnet path)
- `Marker Tags` field (human-readable location + point type)
- `Bacnet Data` field (device name, object name, units)

Must be used together to accurately extract BOTH equipment (FROM) and measurement type (WHAT).

---

## Data Structure Overview

### Complete Point Schema
```json
{
  "Name": "ses/ses_falls_city/8000:33-8033/analogValue/102",
  "Site": "SES Falls City Community Medical Center",
  "Client": "Specialized Engineering Solutions",
  "Point Type": "",  // Often empty
  "Collect Enabled": "True",
  "Collect Interval": "600",
  "Marker Tags": "QI Risk Manager C119, RoomRH",  // CRITICAL
  "Kv Tags": "[]",
  "Bacnet Data": "[{...}]",  // CRITICAL - contains device_name, object_name, units
  "Collect Config": "[]",
  "Updated": "2025-07-24 22:03:10.719286",
  "Created": "2025-01-15 23:07:47.998186"
}
```

### BACnet Data Structure (Parsed from JSON string)
```json
{
  "device_id": "8033",
  "device_name": "VAV_811",  // EQUIPMENT IDENTIFIER
  "object_name": "AV 102",   // Technical name
  "object_type": "analogValue",  // BACnet type
  "object_index": "102",
  "object_units": "percentRelativeHumidity",  // MEASUREMENT TYPE
  "present_value": "49.0",
  "device_address": "8000:33",
  "priority_array": "",
  "scrape_enabled": "False",
  "scrape_interval": "0",
  "device_description": "",
  "object_description": ""
}
```

---

## BACnet Path Structure (Name Field)

### Pattern: `{client}/{site}/{network}/{object_type}/{index}`

**Examples:**
```
ses/ses_falls_city/8000:33-8033/analogValue/102
ses/ses_falls_city/2000:43-2043/binaryValue/10
ses/ses_falls_city/12000:18-12018/analogInput/0
```

### Breakdown:
1. **Client:** `ses` (Specialized Engineering Solutions)
2. **Site:** `ses_falls_city`
3. **Network Address:** `8000:33-8033` (format: `{network}:{device}-{device_id}`)
4. **Object Type:** `analogValue`, `binaryValue`, `analogInput`, `binaryInput`, etc.
5. **Object Index:** Numeric identifier within device

**Equipment NOT directly in path** - must parse from `device_name` in Bacnet Data!

---

## Equipment Type Taxonomy

### Identified Equipment Types (from device_name)

#### HVAC Equipment
1. **VAV Boxes** (Variable Air Volume)
   - Pattern: `VAV_###`, `VAV-###`, `Vav##`, `VAVR ###`
   - Examples: `VAV_811`, `VAV-708`, `Vav20`, `VAVR 725`
   - Count: 40+ instances

2. **RTU** (Roof Top Units / Air Handling Units)
   - Pattern: `Rtu#`, `Ahu#_#`, `RTU#`, `RTU#N`
   - Examples: `Rtu2`, `Ahu7_1`, `Ahu6_1`, `RTU2N`, `RTU4`
   - Count: 15+ instances

3. **RVB** (Return Volume Box / Reheat Box)
   - Pattern: `Rvb##`
   - Examples: `Rvb02`, `Rvb03`
   - Note: Markers say "WHAT IS THIS?" - indicating unclear equipment

4. **Central Plant Equipment**
   - **Chilled Water System**: `CHWS`
   - Count: Multiple control points

5. **Generic/Unknown Devices**
   - Pattern: `DEV####` (e.g., `DEV1001`)
   - Empty device names (12+ instances with `device_name: ""`)

### Equipment Numbering Patterns

**VAV Numbering:**
- 100-199 series: Various locations
- 200-299 series: B-wing areas
- 300-399 series: B-wing IT/Admin areas
- 400-499 series: A-wing patient areas
- 500-599 series: A-wing specialty areas
- 600-699 series: Various areas
- 700-799 series: Patient room areas
- 800-899 series: C-wing business/admin areas

**RTU/AHU Numbering:**
- RTU 1-7: Different building zones
- Each RTU can have multiple devices (e.g., Ahu6_1, Ahu6_2)

---

## Point Type Taxonomy

### Measurement Categories (from Marker Tags + object_units)

#### Temperature Points
- **RoomTemp** - Space temperature
- **DaTemp** - Discharge air temperature
- **RaTemp** / **RaHumidity** - Return air temperature
- **SaTemp** - Supply air temperature
- **CWRTemp** - Chilled water return temperature
- **Units:** `degreesFahrenheit`, `noUnits`

#### Humidity Points
- **RoomRH** / **Humidity** - Space relative humidity
- **RaHumidity** - Return air humidity
- **Units:** `percentRelativeHumidity`

#### Airflow Points
- **Airflow** - CFM measurements
- **SaFpm** - Supply air feet per minute
- **VavAirFlSpt** - VAV airflow setpoint
- **Units:** `cubicFeetPerMinute`, `feetPerMinute`

#### Pressure Points
- **RaPress** - Return air pressure
- **SaPress** / **SaPressSpt** - Supply air pressure/setpoint
- **Units:** `inchesOfWater`

#### Control Signals
- **HeatSignal** - Heating valve/coil signal
- **CoolSignal** - Cooling valve/coil signal
- **Damper** - Damper position
- **Units:** `percent`

#### Status Points
- **SaFanStatus** - Supply fan status
- **RaFanStatus** - Return fan status
- **FanStatus** - Generic fan status
- **Units:** (none - binary: active/inactive)

#### Setpoints
- **SaTempSetpt** / **SaTempWuSetpt** - Supply air temperature setpoints
- **SaTempLoLim** / **SaTempHiLim** - Temperature limits
- **BypassEnaSetpt** - Bypass enable setpoint
- **RaFanTrack** / **RaFanOffset** - Fan tracking/offset values

---

## Marker Tags Analysis

### Location Information
Marker Tags contain human-readable room/location information:
- Room names: "Exam 1214", "Office 1222", "Ultrasound A246"
- Functional areas: "Male Lockers B1416", "Chapel B102", "Mixing Room"
- Equipment location: "RTU7", "Chilled Water System"
- Building codes: "A###", "B###", "C###" (appears to be building/floor codes)

### Point Type Indicators
Second part of Marker Tags (after comma) indicates measurement:
- "RoomTemp", "RoomRH", "Damper", "HeatSignal", "Airflow", etc.

### Pattern: `{Location}, {PointType}`
```
"QI Risk Manager C119, RoomRH"
"RTU7 RaPress, RTU7"
"Male Lockers B1416, HeatSignal"
```

**Special Cases:**
- Single tag: "Chilled Water System" (system-level point)
- Multiple comma-separated: "Cardiac Rehab B165, RoomRH"
- Equipment identifiers: "RTU2N", "RTU4", "RTU5"

---

## BACnet Object Type Patterns

### Object Types (from Name path)

1. **analogValue (AV)** - Writable analog points
   - Control signals (damper positions, valve signals)
   - Setpoints
   - Calculated values

2. **analogInput (AI)** - Read-only analog sensors
   - Temperature sensors
   - Pressure sensors
   - Humidity sensors
   - Airflow measurements

3. **binaryValue (BV)** - Writable binary points
   - Enable/disable commands
   - Mode selections

4. **binaryInput (BI)** - Read-only binary sensors
   - Fan status
   - Alarm conditions
   - Switch positions

### Object Index Significance

**Common Indices:**
- **0**: Often heat signal or primary control
- **2**: Often discharge air temperature
- **3**: Often return air humidity/temperature
- **6**: Often supply air fan status
- **8**: Often damper position
- **9**: Often damper position (alternate)
- **10**: Often airflow measurement
- **102**: Often space/room humidity

**Pattern Recognition:**
The object index appears standardized within device types:
- VAV boxes use similar indices for similar functions
- RTU/AHU units have consistent index patterns

---

## Hierarchical Extraction Strategy

### Recommended Parsing Approach

#### 1. Parse Name Field
```javascript
const nameParts = name.split('/');
// [client, site, deviceAddress, objectType, objectIndex]

const deviceAddress = nameParts[2]; // "8000:33-8033"
const [network, deviceInfo] = deviceAddress.split(':');
const [device, deviceId] = deviceInfo.split('-');
```

#### 2. Parse BACnet Data (JSON)
```javascript
const bacnetData = JSON.parse(point['Bacnet Data'])[0];
const equipmentName = bacnetData.device_name; // "VAV_811"
const objectUnits = bacnetData.object_units; // "percentRelativeHumidity"
```

#### 3. Parse Marker Tags
```javascript
const markerParts = point['Marker Tags'].split(',').map(s => s.trim());
const location = markerParts[0]; // "QI Risk Manager C119"
const pointType = markerParts.length > 1 ? markerParts[1] : null; // "RoomRH"
```

#### 4. Classify Equipment Type (FROM)
```javascript
function classifyEquipment(deviceName) {
  if (!deviceName) return { type: 'UNKNOWN', id: null };

  // VAV patterns
  if (/VAV[_-]?\d+/i.test(deviceName)) {
    const match = deviceName.match(/(\d+)/);
    return { type: 'VAV', id: match ? match[1] : null };
  }

  // RTU/AHU patterns
  if (/(?:RTU|Ahu|Rtu)\d+/i.test(deviceName)) {
    const match = deviceName.match(/(\d+)/);
    return { type: 'RTU', id: match ? match[1] : null };
  }

  // RVB pattern
  if (/Rvb\d+/i.test(deviceName)) {
    const match = deviceName.match(/(\d+)/);
    return { type: 'RVB', id: match ? match[1] : null };
  }

  // Chilled Water System
  if (deviceName === 'CHWS') {
    return { type: 'CHWS', id: null };
  }

  return { type: 'OTHER', id: null, raw: deviceName };
}
```

#### 5. Classify Point Type (WHAT)
```javascript
function classifyPointType(markerTag, objectUnits, objectType) {
  // Priority 1: Marker tag (most reliable)
  if (markerTag) {
    const tag = markerTag.toLowerCase();
    if (tag.includes('temp')) return 'Temperature';
    if (tag.includes('humidity') || tag.includes('rh')) return 'Humidity';
    if (tag.includes('damper')) return 'Damper Position';
    if (tag.includes('heat')) return 'Heating Signal';
    if (tag.includes('cool')) return 'Cooling Signal';
    if (tag.includes('airflow') || tag.includes('cfm')) return 'Airflow';
    if (tag.includes('press')) return 'Pressure';
    if (tag.includes('status')) return 'Status';
    if (tag.includes('setpt') || tag.includes('setpoint')) return 'Setpoint';
  }

  // Priority 2: Units
  if (objectUnits) {
    if (objectUnits.includes('Fahrenheit') || objectUnits.includes('Celsius')) return 'Temperature';
    if (objectUnits.includes('Humidity')) return 'Humidity';
    if (objectUnits.includes('Feet') || objectUnits.includes('cubicFeet')) return 'Airflow';
    if (objectUnits.includes('Water')) return 'Pressure';
    if (objectUnits === 'percent') return 'Percentage Control';
  }

  // Priority 3: Object type
  if (objectType.includes('binary')) return 'Binary Status';

  return 'Unknown';
}
```

---

## Edge Cases and Special Considerations

### 1. Empty Device Names (12+ instances)
- Device name is empty string
- Must rely on marker tags and object index patterns
- Examples: devices at 12000:18, 12000:23, 12000:20, etc.
- Pattern: Often VAVR units with "(WHAT ROOM?)" in marker tags

### 2. Ambiguous Marker Tags
- "VAVR 725 (WHAT ROOM?)" - Unknown location
- "RVB02 - WHAT IS THIS?" - Unknown equipment type
- Indicates incomplete commissioning data

### 3. Multi-Purpose Indices
- Same object index can mean different things on different equipment
- Must combine index + device type for accurate classification

### 4. Kv Tags vs Marker Tags
- **Marker Tags**: Human-readable, location + function
- **Kv Tags**: JACE object names (often empty: "[]")
- When present, Kv Tags like `jace_object_name: "RaFanOffset"` provide technical names

### 5. Point Type Field Usually Empty
- The "Point Type" field in the API response is empty for 100% of sampled points
- Cannot rely on this field for classification

---

## Sample Data Patterns (First 20 Points)

| # | Equipment | Type | Location | Point Type | Units |
|---|-----------|------|----------|------------|-------|
| 1 | VAV_811 | VAV | QI Risk Manager C119 | RoomRH | %RH |
| 2 | Rtu2 | RTU | RTU2N | RaFanOffset | noUnits |
| 3 | Rtu2 | RTU | RTU2N | SaFanStatus | binary |
| 4 | (empty) | VAV | VAVR 725 | RoomTemp | noUnits |
| 5 | (empty) | VAV | VAVR 730 | Damper | noUnits |
| 6 | VAV_401 | VAV | Male Lockers B1416 | HeatSignal | percent |
| 7 | (empty) | VAV | VAVR 727 | Damper | noUnits |
| 8 | Vav20 | VAV | Exam 1214 | HeatSignal | percent |
| 9 | VAV_106 | VAV | Sub Wait 1315 | Damper | percent |
| 10 | VAV_813 | VAV | Laundry C108 | HeatSignal | percent |
| 11 | Vav17 | VAV | Office 1222 | DaTemp | degF |
| 12 | VAV_312 | VAV | Chapel B102 | Damper | percent |
| 13 | VAV-708 | VAV | Equipment Storage | Damper | percent |
| 14 | Vav40 | VAV | Endoscopy | Damper | percent |
| 15 | VAV_110 | VAV | Waiting 1202 | Damper | percent |
| 16 | Ahu7_1 | RTU | RTU7 | RaPress | inH2O |
| 17 | Vav03 | VAV | Decontamination 1413 | Humidity | %RH |
| 18 | CHWS | Central | Chilled Water System | CH-1 Valve Call | binary |
| 19 | (empty) | RTU | RTU5 | RaHumidity | %RH |
| 20 | VAV_312 | VAV | Chapel B102 | VavAirFlSpt | noUnits |

---

## Recommended Classification Algorithm

### Step-by-Step Process

```javascript
function classifyBacnetPoint(point) {
  // 1. Parse all data sources
  const bacnetData = JSON.parse(point['Bacnet Data'])[0];
  const markerTags = point['Marker Tags'].split(',').map(s => s.trim());
  const nameParts = point.Name.split('/');

  // 2. Extract equipment (FROM)
  const equipment = classifyEquipment(bacnetData.device_name);

  // 3. Extract location
  const location = markerTags[0];

  // 4. Extract point type (WHAT)
  const pointType = classifyPointType(
    markerTags[1] || markerTags[0],
    bacnetData.object_units,
    bacnetData.object_type
  );

  // 5. Build classification
  return {
    from: {
      equipmentType: equipment.type,
      equipmentId: equipment.id,
      deviceName: bacnetData.device_name,
      location: location
    },
    what: {
      category: pointType,
      objectType: bacnetData.object_type,
      objectIndex: bacnetData.object_index,
      units: bacnetData.object_units,
      markerTag: markerTags[1] || null
    },
    bacnetPath: point.Name,
    presentValue: bacnetData.present_value
  };
}
```

### Example Output
```json
{
  "from": {
    "equipmentType": "VAV",
    "equipmentId": "811",
    "deviceName": "VAV_811",
    "location": "QI Risk Manager C119"
  },
  "what": {
    "category": "Humidity",
    "objectType": "analogValue",
    "objectIndex": "102",
    "units": "percentRelativeHumidity",
    "markerTag": "RoomRH"
  },
  "bacnetPath": "ses/ses_falls_city/8000:33-8033/analogValue/102",
  "presentValue": "49.0"
}
```

---

## Key Insights for Implementation

1. **Multi-Field Parsing Required**: Name field alone is insufficient. Must parse Bacnet Data JSON and Marker Tags.

2. **Device Name is Primary Equipment Identifier**: The `device_name` in Bacnet Data is the most reliable source for equipment type.

3. **Marker Tags for Human Context**: Location and functional descriptions are in Marker Tags, not in the BACnet path.

4. **Units are Critical for Classification**: Object units provide definitive measurement type when marker tags are ambiguous.

5. **Object Index Patterns**: Within a device type (e.g., VAV), object indices are somewhat standardized:
   - Index 8/9: Usually damper position
   - Index 102: Usually space humidity
   - Index 0: Usually heat signal
   - Index 10: Usually airflow

6. **Empty Device Names**: Approximately 15-20% of points have empty device names, requiring fallback to marker tags and index patterns.

7. **Building Code System**: Location markers use A###, B###, C### codes which appear to indicate building wings or floors.

8. **Equipment Numbering**: VAV boxes are numbered in series (100s, 200s, etc.) likely corresponding to building zones or floors.

---

## Validation and Testing Recommendations

1. **Create Unit Tests**: Use the 70 analyzed points as test cases for classification algorithm

2. **Handle Null/Empty Cases**: Test with empty device_name, empty marker tags, missing units

3. **Cross-Validate**: Compare classification results against:
   - Object units
   - Marker tags
   - Object indices
   - Present value ranges (e.g., temp should be 32-120°F)

4. **Build Confidence Scores**: Assign confidence levels based on:
   - High: All three sources (name, bacnet data, markers) agree
   - Medium: Two sources agree
   - Low: Single source or conflicting data

5. **Unknown Categories**: Always include "Unknown" category for edge cases

---

## Next Steps

1. Expand analysis to full dataset (1000+ points)
2. Build regex/pattern library for all equipment types
3. Create lookup tables for object index meanings by device type
4. Implement fuzzy matching for marker tag variations
5. Build validation rules based on expected value ranges
6. Create equipment hierarchy tree (Building > Floor > Zone > Equipment)

---

## Files Generated
- `/research/first_20_points.json` - Sample data (20 points)
- `/research/points_20_70.json` - Extended sample (50 points)
- `/research/bacnet_naming_pattern_analysis.md` - This document

**Total Points Analyzed:** 70+
**Equipment Types Identified:** 5 primary (VAV, RTU, RVB, CHWS, OTHER)
**Point Types Identified:** 15+ categories
**Pattern Confidence:** High (based on consistent patterns across 70+ samples)
