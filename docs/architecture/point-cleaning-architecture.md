# Intelligent Point Cleaning Architecture

## Executive Summary

This architecture transforms complex BACnet point names into intuitive equipment and point information through multi-stage parsing, semantic analysis, and intelligent grouping.

---

## 1. System Overview

### 1.1 Architecture Goals

1. **Clarity**: Transform `VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp` → `AHU-01 VAV-707 - Discharge Temperature`
2. **Discoverability**: Group by equipment type, enable fuzzy search
3. **Performance**: Parse 10,000+ points in <500ms
4. **Extensibility**: Easy to add new equipment types and point patterns
5. **Accuracy**: 95%+ correct classification of equipment and point types

### 1.2 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Point Cleaning Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Stage 1    │───▶│   Stage 2    │───▶│   Stage 3    │      │
│  │ Tokenization │    │  Equipment   │    │    Point     │      │
│  │              │    │  Extraction  │    │  Extraction  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Stage 4    │───▶│   Stage 5    │───▶│   Stage 6    │      │
│  │ Unit/Context │    │Display Name  │    │ Categorization│     │
│  │  Detection   │    │  Generation  │    │  & Indexing  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Structures

### 2.1 Core Data Model

```typescript
/**
 * Complete enhanced point with parsed equipment and point information
 */
interface EnhancedPoint {
  // Original identifiers
  name: string;                          // Original BACnet path
  objectIdentifier: string;              // BACnet object ID

  // Parsed equipment information
  equipment: EquipmentInfo;

  // Parsed point information
  point: PointInfo;

  // Display and UI
  displayName: string;                   // Primary display name
  shortName: string;                     // Abbreviated display (for compact views)
  category: PointCategory;               // Top-level category
  subcategory?: string;                  // Secondary classification

  // Search optimization
  searchTerms: string[];                 // Tokenized searchable terms
  tags: string[];                        // User-assignable tags

  // Hierarchy and relationships
  hierarchy: string[];                   // Equipment hierarchy path
  relatedPoints?: string[];              // Related point names

  // Metadata
  confidence: number;                    // Parsing confidence (0-1)
  parsingNotes?: string;                 // Debug/explanation notes
}

/**
 * Equipment information extracted from point name
 */
interface EquipmentInfo {
  // Core identification
  type: EquipmentType;                   // AHU, VAV, Chiller, etc.
  id: string;                            // 1, 707, "Main", etc.
  fullName: string;                      // "AHU-1 Main Supply"

  // Hierarchy
  system?: string;                       // HVAC, Electrical, etc.
  subsystem?: string;                    // Supply, Return, Zone, etc.
  component?: string;                    // Fan, Damper, Coil, etc.

  // Location
  location?: LocationInfo;

  // Additional context
  purpose?: string;                      // Cooling, Heating, Ventilation
  zone?: string;                         // Zone identifier
}

/**
 * Point information extracted from point name
 */
interface PointInfo {
  // Core identification
  type: PointType;                       // Temperature, Pressure, etc.
  purpose?: PointPurpose;                // Supply, Return, Setpoint, Command

  // Measurement
  unit?: string;                         // °F, PSI, CFM, %
  dataType: DataType;                    // analog, binary, multistate

  // Context
  modifier?: string;                     // Actual, Setpoint, Effective
  location?: PointLocation;              // Supply, Return, Mixed, Outdoor

  // BACnet specifics
  objectType: string;                    // analog-input, binary-output, etc.
}

/**
 * Location information
 */
interface LocationInfo {
  building?: string;
  floor?: string;
  zone?: string;
  room?: string;
  area?: string;
}

/**
 * Display categories for UI grouping
 */
enum PointCategory {
  // By equipment type
  AHU = "Air Handling Units",
  VAV = "Variable Air Volume Boxes",
  Chiller = "Chillers",
  Boiler = "Boilers",
  Pump = "Pumps",
  Fan = "Fans",

  // By system
  HVAC = "HVAC Systems",
  Electrical = "Electrical Systems",
  Lighting = "Lighting Controls",

  // By point type
  Temperature = "Temperature Points",
  Pressure = "Pressure Points",
  Flow = "Flow Points",
  Status = "Status Points",
  Command = "Command Points",

  // Special
  Unknown = "Uncategorized",
  Zone = "Zone Controls"
}

/**
 * Equipment types with common variations
 */
enum EquipmentType {
  AHU = "AHU",              // Air Handling Unit
  VAV = "VAV",              // Variable Air Volume
  FCU = "FCU",              // Fan Coil Unit
  RTU = "RTU",              // Rooftop Unit
  MAU = "MAU",              // Makeup Air Unit
  Chiller = "Chiller",
  Boiler = "Boiler",
  CoolingTower = "Cooling Tower",
  Pump = "Pump",
  Fan = "Fan",
  Damper = "Damper",
  Valve = "Valve",
  VFD = "VFD",              // Variable Frequency Drive
  Thermostat = "Thermostat",
  Sensor = "Sensor",
  Unknown = "Unknown"
}

/**
 * Point types
 */
enum PointType {
  Temperature = "Temperature",
  Pressure = "Pressure",
  Flow = "Flow",
  Humidity = "Humidity",
  CO2 = "CO2",
  Status = "Status",
  Command = "Command",
  Setpoint = "Setpoint",
  Position = "Position",
  Speed = "Speed",
  Power = "Power",
  Energy = "Energy",
  Alarm = "Alarm",
  Occupancy = "Occupancy",
  Schedule = "Schedule",
  Unknown = "Unknown"
}

/**
 * Point purpose/context
 */
enum PointPurpose {
  Supply = "Supply",
  Return = "Return",
  Mixed = "Mixed",
  Outdoor = "Outdoor",
  Zone = "Zone",
  Discharge = "Discharge",
  Entering = "Entering",
  Leaving = "Leaving",
  Actual = "Actual",
  Setpoint = "Setpoint",
  Effective = "Effective",
  Override = "Override"
}

/**
 * Point location within equipment
 */
enum PointLocation {
  Supply = "Supply",
  Return = "Return",
  Mixed = "Mixed",
  Outdoor = "Outdoor",
  Discharge = "Discharge",
  Inlet = "Inlet",
  Outlet = "Outlet",
  Primary = "Primary",
  Secondary = "Secondary"
}

/**
 * Data types
 */
enum DataType {
  Analog = "analog",
  Binary = "binary",
  Multistate = "multistate"
}
```

### 2.2 Configuration Data Model

```typescript
/**
 * Pattern matching configuration
 */
interface ParsingConfig {
  equipmentPatterns: EquipmentPattern[];
  pointPatterns: PointPattern[];
  unitPatterns: UnitPattern[];
  locationPatterns: LocationPattern[];
  stopWords: string[];                   // Words to ignore (THE, AND, etc.)
}

/**
 * Equipment pattern for regex matching
 */
interface EquipmentPattern {
  type: EquipmentType;
  patterns: RegExp[];
  priority: number;                      // Higher = matched first
  aliases: string[];                     // Common variations
  context?: string[];                    // Required context words
}

/**
 * Point type pattern
 */
interface PointPattern {
  type: PointType;
  patterns: RegExp[];
  priority: number;
  aliases: string[];
  units?: string[];                      // Common units for validation
  purposePatterns?: {                    // Purpose-specific patterns
    [key in PointPurpose]?: RegExp[];
  };
}

/**
 * Unit pattern for measurement detection
 */
interface UnitPattern {
  unit: string;
  standardUnit: string;                  // Normalized unit (F → °F)
  patterns: RegExp[];
  pointTypes: PointType[];               // Valid point types
}

/**
 * Location pattern
 */
interface LocationPattern {
  type: keyof LocationInfo;
  patterns: RegExp[];
  examples: string[];
}
```

---

## 3. Parsing Algorithm

### 3.1 Stage 1: Tokenization

**Purpose**: Break down point name into meaningful tokens

**Process**:
```typescript
function tokenize(pointName: string): Token[] {
  // 1. Normalize: uppercase, trim, remove extra spaces
  // 2. Split on delimiters: '.', '-', '_', ' '
  // 3. Preserve compound terms: "Supply-Air" stays together
  // 4. Remove noise: "The", "And", duplicates
  // 5. Tag token types: NUMBER, EQUIPMENT, POINT, UNIT, etc.
}

interface Token {
  value: string;
  type: TokenType;
  position: number;
  confidence: number;
}

enum TokenType {
  EQUIPMENT,      // AHU, VAV, Chiller
  EQUIPMENT_ID,   // 1, 707, Main
  POINT_TYPE,     // Temp, Pressure, Flow
  POINT_PURPOSE,  // Supply, Return, Setpoint
  UNIT,           // F, PSI, CFM
  LOCATION,       // Floor, Zone, Room
  MODIFIER,       // Actual, Effective, Override
  NUMBER,         // Numeric values
  UNKNOWN         // Unclassified
}
```

**Example**:
```
Input:  "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp"
Tokens: [
  { value: "AHU", type: EQUIPMENT, position: 1 },
  { value: "01", type: EQUIPMENT_ID, position: 2 },
  { value: "VAV", type: EQUIPMENT, position: 3 },
  { value: "707", type: EQUIPMENT_ID, position: 4 },
  { value: "Disch", type: POINT_PURPOSE, position: 5 },
  { value: "Temp", type: POINT_TYPE, position: 6 }
]
```

### 3.2 Stage 2: Equipment Extraction

**Purpose**: Identify equipment hierarchy and classification

**Process**:
```typescript
function extractEquipment(tokens: Token[]): EquipmentInfo {
  // 1. Find primary equipment type (AHU, VAV, Chiller)
  // 2. Find equipment ID/number
  // 3. Determine hierarchy:
  //    - Parent equipment (AHU-01)
  //    - Child equipment (VAV-707 within AHU-01)
  //    - Component (Fan, Damper within VAV)
  // 4. Extract location if present
  // 5. Generate full equipment name
}
```

**Hierarchy Rules**:
1. **System-level**: AHU, RTU, Chiller (standalone)
2. **Subsystem-level**: VAV, FCU (belongs to AHU/RTU)
3. **Component-level**: Fan, Damper, Valve (belongs to subsystem)

**Example**:
```
Input:  "AHU-01.707-VAV.Supply-Fan.Status"
Output: {
  type: EquipmentType.VAV,
  id: "707",
  fullName: "AHU-01 VAV-707 Supply Fan",
  system: "HVAC",
  subsystem: "VAV",
  component: "Supply Fan",
  hierarchy: ["AHU-01", "VAV-707", "Supply Fan"]
}
```

### 3.3 Stage 3: Point Extraction

**Purpose**: Identify point type, purpose, and context

**Process**:
```typescript
function extractPoint(tokens: Token[], equipment: EquipmentInfo): PointInfo {
  // 1. Find point type (Temperature, Pressure, etc.)
  // 2. Find point purpose (Supply, Return, Setpoint, etc.)
  // 3. Find point location within equipment
  // 4. Determine data type from BACnet object type
  // 5. Extract modifiers (Actual, Effective, Override)
}
```

**Pattern Matching Priority**:
1. Exact match: "Supply-Air-Temp" → Supply Air Temperature
2. Partial match: "SA-Temp" → Supply Air Temperature
3. Context match: "Temp" + "Supply" → Supply Temperature
4. Abbreviation: "SAT" → Supply Air Temperature

**Example**:
```
Input:  "Disch-Air-Temp-Setpoint"
Output: {
  type: PointType.Temperature,
  purpose: PointPurpose.Setpoint,
  location: PointLocation.Discharge,
  modifier: "Setpoint",
  dataType: DataType.Analog
}
```

### 3.4 Stage 4: Unit and Context Detection

**Purpose**: Extract measurement units and additional context

**Process**:
```typescript
function detectUnitAndContext(
  tokens: Token[],
  equipment: EquipmentInfo,
  point: PointInfo
): { unit?: string; context: Record<string, any> } {
  // 1. Find explicit units (F, PSI, CFM)
  // 2. Infer units from point type if missing
  // 3. Extract additional context (zone, location, etc.)
  // 4. Validate unit matches point type
}
```

**Unit Inference Rules**:
- Temperature → °F (default), °C
- Pressure → PSI, inWC, Pa
- Flow → CFM, GPM, L/s
- Humidity → %RH
- Speed → %, RPM
- Position → %, open/closed

### 3.5 Stage 5: Display Name Generation

**Purpose**: Create human-readable display names

**Process**:
```typescript
function generateDisplayName(
  equipment: EquipmentInfo,
  point: PointInfo
): { displayName: string; shortName: string } {
  // Template: "{Equipment} - {Point Purpose} {Point Type}"
  // Example: "AHU-01 VAV-707 - Discharge Temperature"

  // Short template: "{Equipment} {Abbrev Point}"
  // Example: "VAV-707 Disch Temp"
}
```

**Display Templates**:
```typescript
const templates = {
  standard: "{equipment.fullName} - {point.location} {point.type}",
  withPurpose: "{equipment.fullName} - {point.purpose} {point.type}",
  withUnit: "{equipment.fullName} - {point.location} {point.type} ({point.unit})",
  short: "{equipment.type}-{equipment.id} {point.type}",
  compact: "{equipment.id} {point.abbrev}"
};
```

**Example Transformations**:
```
Original: "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp"
Display:  "AHU-01 VAV-707 - Discharge Temperature"
Short:    "VAV-707 Disch Temp"

Original: "VMAxxxxxxxx.AHU-02.Mixed-Air-Temp"
Display:  "AHU-02 - Mixed Air Temperature"
Short:    "AHU-02 Mixed Air Temp"

Original: "VMAxxxxxxxx.CWP-01.Status"
Display:  "Chilled Water Pump 01 - Status"
Short:    "CWP-01 Status"
```

### 3.6 Stage 6: Categorization and Indexing

**Purpose**: Organize points for efficient UI display and search

**Process**:
```typescript
function categorizeAndIndex(enhanced: EnhancedPoint): {
  category: PointCategory;
  subcategory?: string;
  searchTerms: string[];
  tags: string[];
} {
  // 1. Assign primary category (by equipment or point type)
  // 2. Assign subcategory if applicable
  // 3. Generate search terms:
  //    - Equipment name parts
  //    - Point type variations
  //    - Location terms
  //    - Common abbreviations
  // 4. Generate tags for filtering
}
```

**Categorization Strategy**:
```typescript
// Primary categorization by equipment type
const equipmentCategories = {
  [EquipmentType.AHU]: PointCategory.AHU,
  [EquipmentType.VAV]: PointCategory.VAV,
  [EquipmentType.Chiller]: PointCategory.Chiller,
  // ...
};

// Subcategorization by point type
const subcategories = {
  [PointType.Temperature]: "Temperature Sensors",
  [PointType.Status]: "Status Indicators",
  [PointType.Command]: "Control Commands",
  // ...
};

// Search term generation
function generateSearchTerms(enhanced: EnhancedPoint): string[] {
  return [
    // Equipment terms
    enhanced.equipment.type.toLowerCase(),
    enhanced.equipment.id,
    enhanced.equipment.fullName.toLowerCase(),
    ...enhanced.equipment.hierarchy.map(h => h.toLowerCase()),

    // Point terms
    enhanced.point.type.toLowerCase(),
    enhanced.point.purpose?.toLowerCase(),
    enhanced.point.location?.toLowerCase(),

    // Location terms
    ...Object.values(enhanced.equipment.location || {}),

    // Abbreviations
    generateAbbreviations(enhanced),

    // Original name for fallback
    enhanced.name.toLowerCase()
  ].filter(Boolean);
}
```

---

## 4. Pattern Library

### 4.1 Equipment Patterns

```typescript
const equipmentPatterns: EquipmentPattern[] = [
  // Air Handling Units
  {
    type: EquipmentType.AHU,
    patterns: [
      /\bAHU[-_]?(\d+)?\b/i,
      /\bAir[-_]?Hand(ling)?[-_]?Unit[-_]?(\d+)?\b/i,
      /\bAH[-_]?(\d+)\b/i
    ],
    priority: 100,
    aliases: ["AHU", "Air Handler", "Air Handling Unit", "AH"]
  },

  // Variable Air Volume
  {
    type: EquipmentType.VAV,
    patterns: [
      /\bVAV[-_]?(\d+)?\b/i,
      /\b(\d+)[-_]?VAV\b/i,
      /\bVariable[-_]?Air[-_]?Volume[-_]?(\d+)?\b/i
    ],
    priority: 90,
    aliases: ["VAV", "Variable Air Volume"]
  },

  // Chillers
  {
    type: EquipmentType.Chiller,
    patterns: [
      /\bCH[-_]?(\d+)?\b/i,
      /\bCHILL(ER)?[-_]?(\d+)?\b/i,
      /\bChilled[-_]?Water[-_]?(\d+)?\b/i
    ],
    priority: 100,
    aliases: ["Chiller", "CH", "Chilled Water"]
  },

  // Pumps
  {
    type: EquipmentType.Pump,
    patterns: [
      /\b(CHW|HW|CW)P[-_]?(\d+)?\b/i,  // Pump type + number
      /\bPUMP[-_]?(\d+)?\b/i,
      /\bP[-_]?(\d+)\b/i
    ],
    priority: 80,
    aliases: ["Pump", "P"]
  },

  // Fans
  {
    type: EquipmentType.Fan,
    patterns: [
      /\b(Supply|Return|Exhaust)[-_]?Fan[-_]?(\d+)?\b/i,
      /\bFAN[-_]?(\d+)?\b/i,
      /\bF[-_]?(\d+)\b/i
    ],
    priority: 70,
    aliases: ["Fan", "F", "Supply Fan", "Return Fan", "Exhaust Fan"]
  },

  // Boilers
  {
    type: EquipmentType.Boiler,
    patterns: [
      /\bB(LR)?[-_]?(\d+)?\b/i,
      /\bBOIL(ER)?[-_]?(\d+)?\b/i,
      /\bHot[-_]?Water[-_]?(\d+)?\b/i
    ],
    priority: 100,
    aliases: ["Boiler", "BLR", "Hot Water"]
  },

  // Cooling Towers
  {
    type: EquipmentType.CoolingTower,
    patterns: [
      /\bCT[-_]?(\d+)?\b/i,
      /\bCool(ing)?[-_]?Tower[-_]?(\d+)?\b/i
    ],
    priority: 90,
    aliases: ["Cooling Tower", "CT"]
  },

  // Rooftop Units
  {
    type: EquipmentType.RTU,
    patterns: [
      /\bRTU[-_]?(\d+)?\b/i,
      /\bRoof[-_]?Top[-_]?Unit[-_]?(\d+)?\b/i
    ],
    priority: 100,
    aliases: ["RTU", "Rooftop Unit"]
  },

  // Fan Coil Units
  {
    type: EquipmentType.FCU,
    patterns: [
      /\bFCU[-_]?(\d+)?\b/i,
      /\bFan[-_]?Coil[-_]?Unit[-_]?(\d+)?\b/i
    ],
    priority: 90,
    aliases: ["FCU", "Fan Coil Unit"]
  },

  // VFDs
  {
    type: EquipmentType.VFD,
    patterns: [
      /\bVFD[-_]?(\d+)?\b/i,
      /\bVariable[-_]?Freq(uency)?[-_]?Drive[-_]?(\d+)?\b/i
    ],
    priority: 85,
    aliases: ["VFD", "Variable Frequency Drive"]
  }
];
```

### 4.2 Point Patterns

```typescript
const pointPatterns: PointPattern[] = [
  // Temperature
  {
    type: PointType.Temperature,
    patterns: [
      /\bTemp(erature)?\b/i,
      /\bT\b/i,
      /\b(SA|RA|MA|OA|DA)T\b/i  // Supply/Return/Mixed/Outdoor/Discharge Air Temp
    ],
    priority: 100,
    aliases: ["Temperature", "Temp", "T"],
    units: ["F", "°F", "C", "°C"],
    purposePatterns: {
      [PointPurpose.Supply]: [/\b(Supply|SA)\b/i],
      [PointPurpose.Return]: [/\b(Return|RA)\b/i],
      [PointPurpose.Mixed]: [/\b(Mixed|MA)\b/i],
      [PointPurpose.Outdoor]: [/\b(Outdoor|Outside|OA)\b/i],
      [PointPurpose.Discharge]: [/\b(Discharge|Disch|DA)\b/i],
      [PointPurpose.Setpoint]: [/\bSet[-_]?point\b/i, /\bSP\b/i]
    }
  },

  // Pressure
  {
    type: PointType.Pressure,
    patterns: [
      /\bPress(ure)?\b/i,
      /\bP\b/i,
      /\bStatic[-_]?Press(ure)?\b/i,
      /\bDiff(erential)?[-_]?Press(ure)?\b/i
    ],
    priority: 95,
    aliases: ["Pressure", "Press", "P", "Static Pressure", "Differential Pressure"],
    units: ["PSI", "inWC", "Pa", "kPa"]
  },

  // Flow
  {
    type: PointType.Flow,
    patterns: [
      /\bFlow\b/i,
      /\bCFM\b/i,
      /\bGPM\b/i,
      /\bAir[-_]?Flow\b/i,
      /\bWater[-_]?Flow\b/i
    ],
    priority: 95,
    aliases: ["Flow", "Air Flow", "Water Flow"],
    units: ["CFM", "GPM", "L/s", "m³/h"]
  },

  // Humidity
  {
    type: PointType.Humidity,
    patterns: [
      /\bHumid(ity)?\b/i,
      /\bRH\b/i,
      /\bRelative[-_]?Humid(ity)?\b/i
    ],
    priority: 90,
    aliases: ["Humidity", "RH", "Relative Humidity"],
    units: ["%", "%RH"]
  },

  // CO2
  {
    type: PointType.CO2,
    patterns: [
      /\bCO2\b/i,
      /\bCarbon[-_]?Dioxide\b/i
    ],
    priority: 85,
    aliases: ["CO2", "Carbon Dioxide"],
    units: ["PPM", "ppm"]
  },

  // Status
  {
    type: PointType.Status,
    patterns: [
      /\bStatus\b/i,
      /\bSts\b/i,
      /\b(On|Off)[-_]?Status\b/i,
      /\bRun[-_]?Status\b/i,
      /\bAlarm\b/i,
      /\bFault\b/i
    ],
    priority: 100,
    aliases: ["Status", "Sts", "Run Status", "Alarm", "Fault"],
    units: []
  },

  // Command
  {
    type: PointType.Command,
    patterns: [
      /\bCommand\b/i,
      /\bCmd\b/i,
      /\bEnable\b/i,
      /\bStart\b/i,
      /\bStop\b/i,
      /\bOn\b/i,
      /\bOff\b/i
    ],
    priority: 90,
    aliases: ["Command", "Cmd", "Enable", "Start", "Stop"],
    units: []
  },

  // Setpoint
  {
    type: PointType.Setpoint,
    patterns: [
      /\bSet[-_]?point\b/i,
      /\bSP\b/i,
      /\bSet\b/i
    ],
    priority: 85,
    aliases: ["Setpoint", "SP", "Set"],
    units: []
  },

  // Position
  {
    type: PointType.Position,
    patterns: [
      /\bPosition\b/i,
      /\bPos\b/i,
      /\b(Open|Close)[-_]?Position\b/i,
      /\bDamper[-_]?Pos(ition)?\b/i,
      /\bValve[-_]?Pos(ition)?\b/i
    ],
    priority: 90,
    aliases: ["Position", "Pos", "Damper Position", "Valve Position"],
    units: ["%"]
  },

  // Speed
  {
    type: PointType.Speed,
    patterns: [
      /\bSpeed\b/i,
      /\bRPM\b/i,
      /\bFreq(uency)?\b/i,
      /\bHz\b/i
    ],
    priority: 85,
    aliases: ["Speed", "RPM", "Frequency"],
    units: ["%", "RPM", "Hz"]
  }
];
```

### 4.3 Unit Patterns

```typescript
const unitPatterns: UnitPattern[] = [
  // Temperature
  { unit: "F", standardUnit: "°F", patterns: [/\bF\b/i, /°F/i, /\bFahr(enheit)?\b/i], pointTypes: [PointType.Temperature] },
  { unit: "C", standardUnit: "°C", patterns: [/\bC\b/i, /°C/i, /\bCels(ius)?\b/i], pointTypes: [PointType.Temperature] },

  // Pressure
  { unit: "PSI", standardUnit: "PSI", patterns: [/\bPSI\b/i], pointTypes: [PointType.Pressure] },
  { unit: "inWC", standardUnit: "inWC", patterns: [/\binWC\b/i, /in\.?W\.?C\.?/i], pointTypes: [PointType.Pressure] },
  { unit: "Pa", standardUnit: "Pa", patterns: [/\bPa\b/i, /\bPascal(s)?\b/i], pointTypes: [PointType.Pressure] },

  // Flow
  { unit: "CFM", standardUnit: "CFM", patterns: [/\bCFM\b/i], pointTypes: [PointType.Flow] },
  { unit: "GPM", standardUnit: "GPM", patterns: [/\bGPM\b/i], pointTypes: [PointType.Flow] },
  { unit: "L/s", standardUnit: "L/s", patterns: [/\bL\/s\b/i, /\bLPS\b/i], pointTypes: [PointType.Flow] },

  // Humidity
  { unit: "%RH", standardUnit: "%RH", patterns: [/\%RH\b/i, /\bRH\b/i], pointTypes: [PointType.Humidity] },

  // CO2
  { unit: "PPM", standardUnit: "ppm", patterns: [/\bPPM\b/i], pointTypes: [PointType.CO2] },

  // Position/Speed
  { unit: "%", standardUnit: "%", patterns: [/\%/i, /\bPercent\b/i], pointTypes: [PointType.Position, PointType.Speed, PointType.Humidity] },
  { unit: "RPM", standardUnit: "RPM", patterns: [/\bRPM\b/i], pointTypes: [PointType.Speed] },
  { unit: "Hz", standardUnit: "Hz", patterns: [/\bHz\b/i, /\bHertz\b/i], pointTypes: [PointType.Speed] }
];
```

---

## 5. Implementation Architecture

### 5.1 Class Structure

```typescript
/**
 * Main point cleaning service
 */
class PointCleaningService {
  private tokenizer: Tokenizer;
  private equipmentExtractor: EquipmentExtractor;
  private pointExtractor: PointExtractor;
  private displayNameGenerator: DisplayNameGenerator;
  private categorizer: PointCategorizer;
  private config: ParsingConfig;

  constructor(config?: Partial<ParsingConfig>) {
    this.config = mergeConfig(defaultConfig, config);
    this.initializeComponents();
  }

  /**
   * Parse a single point name
   */
  parsePoint(point: BACnetPoint): EnhancedPoint {
    const tokens = this.tokenizer.tokenize(point.name);
    const equipment = this.equipmentExtractor.extract(tokens);
    const pointInfo = this.pointExtractor.extract(tokens, equipment);
    const { displayName, shortName } = this.displayNameGenerator.generate(equipment, pointInfo);
    const { category, subcategory, searchTerms, tags } = this.categorizer.categorize({
      equipment,
      point: pointInfo,
      displayName
    });

    return {
      name: point.name,
      objectIdentifier: point.objectIdentifier,
      equipment,
      point: pointInfo,
      displayName,
      shortName,
      category,
      subcategory,
      searchTerms,
      tags,
      hierarchy: equipment.hierarchy,
      confidence: this.calculateConfidence(tokens, equipment, pointInfo)
    };
  }

  /**
   * Parse multiple points efficiently
   */
  parsePoints(points: BACnetPoint[]): EnhancedPoint[] {
    // Parallel processing for large datasets
    return points.map(p => this.parsePoint(p));
  }

  /**
   * Group points by category
   */
  groupPoints(points: EnhancedPoint[]): Map<PointCategory, EnhancedPoint[]> {
    const grouped = new Map<PointCategory, EnhancedPoint[]>();
    for (const point of points) {
      if (!grouped.has(point.category)) {
        grouped.set(point.category, []);
      }
      grouped.get(point.category)!.push(point);
    }
    return grouped;
  }

  /**
   * Search points by term
   */
  searchPoints(points: EnhancedPoint[], query: string): EnhancedPoint[] {
    const lowerQuery = query.toLowerCase();
    return points.filter(p =>
      p.searchTerms.some(term => term.includes(lowerQuery))
    ).sort((a, b) => {
      // Sort by relevance score
      const scoreA = this.calculateRelevanceScore(a, lowerQuery);
      const scoreB = this.calculateRelevanceScore(b, lowerQuery);
      return scoreB - scoreA;
    });
  }
}

/**
 * Tokenization engine
 */
class Tokenizer {
  tokenize(pointName: string): Token[] {
    // Implementation
  }

  private classify(token: string): TokenType {
    // Classify token type
  }
}

/**
 * Equipment extraction engine
 */
class EquipmentExtractor {
  constructor(private patterns: EquipmentPattern[]) {}

  extract(tokens: Token[]): EquipmentInfo {
    // Implementation
  }

  private findEquipmentType(tokens: Token[]): { type: EquipmentType; id: string } {
    // Match patterns
  }

  private buildHierarchy(tokens: Token[], primaryEquipment: any): string[] {
    // Build equipment hierarchy
  }
}

/**
 * Point information extraction engine
 */
class PointExtractor {
  constructor(private patterns: PointPattern[]) {}

  extract(tokens: Token[], equipment: EquipmentInfo): PointInfo {
    // Implementation
  }

  private findPointType(tokens: Token[]): PointType {
    // Match patterns
  }

  private findPointPurpose(tokens: Token[], pointType: PointType): PointPurpose | undefined {
    // Match purpose patterns
  }
}

/**
 * Display name generation engine
 */
class DisplayNameGenerator {
  generate(equipment: EquipmentInfo, point: PointInfo): { displayName: string; shortName: string } {
    // Implementation
  }

  private applyTemplate(template: string, data: any): string {
    // Template rendering
  }
}

/**
 * Point categorization engine
 */
class PointCategorizer {
  categorize(data: { equipment: EquipmentInfo; point: PointInfo; displayName: string }): {
    category: PointCategory;
    subcategory?: string;
    searchTerms: string[];
    tags: string[];
  } {
    // Implementation
  }
}
```

### 5.2 Module Organization

```
src/point-cleaning/
├── index.ts                          # Main service export
├── types/
│   ├── enhanced-point.ts             # EnhancedPoint interface
│   ├── equipment.ts                  # Equipment-related types
│   ├── point.ts                      # Point-related types
│   ├── config.ts                     # Configuration types
│   └── token.ts                      # Token types
├── core/
│   ├── tokenizer.ts                  # Tokenization engine
│   ├── equipment-extractor.ts        # Equipment extraction
│   ├── point-extractor.ts            # Point extraction
│   ├── display-name-generator.ts     # Display name generation
│   └── categorizer.ts                # Categorization engine
├── patterns/
│   ├── equipment-patterns.ts         # Equipment pattern library
│   ├── point-patterns.ts             # Point pattern library
│   ├── unit-patterns.ts              # Unit pattern library
│   └── location-patterns.ts          # Location pattern library
├── utils/
│   ├── string-utils.ts               # String manipulation
│   ├── pattern-matcher.ts            # Pattern matching helpers
│   └── confidence-calculator.ts      # Confidence scoring
└── config/
    └── default-config.ts             # Default configuration
```

---

## 6. UI Integration

### 6.1 Point Selection UI

```typescript
/**
 * Point selector component props
 */
interface PointSelectorProps {
  points: EnhancedPoint[];
  selectedPoints: string[];
  onSelectionChange: (points: string[]) => void;
  groupBy?: "equipment" | "point-type" | "location";
  searchable?: boolean;
  multiSelect?: boolean;
}

/**
 * Grouped point display
 */
interface GroupedPoints {
  category: PointCategory;
  subcategory?: string;
  points: EnhancedPoint[];
  expanded: boolean;
}
```

**UI Layout**:
```
┌─────────────────────────────────────────────────┐
│ Search: [________Search points________] [Filter]│
├─────────────────────────────────────────────────┤
│ ▼ Air Handling Units (23)                       │
│   ├─ AHU-01 (8 points)                          │
│   │  ├─ ☐ AHU-01 - Supply Air Temperature       │
│   │  ├─ ☐ AHU-01 - Return Air Temperature       │
│   │  ├─ ☐ AHU-01 - Mixed Air Temperature        │
│   │  ├─ ☐ AHU-01 - Supply Fan Status            │
│   │  └─ ☐ AHU-01 - Supply Fan Speed             │
│   └─ AHU-02 (7 points)                          │
│      └─ ...                                      │
├─────────────────────────────────────────────────┤
│ ▶ VAV Boxes (47)                                │
├─────────────────────────────────────────────────┤
│ ▶ Chillers (12)                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 Chart Display

**Display Format on Charts**:
- **Primary**: Display name (full)
- **Hover**: Display name + unit + original name
- **Legend**: Short name (if space constrained)

```typescript
interface ChartPoint {
  displayName: string;        // For chart labels
  shortName: string;          // For legend
  originalName: string;       // For tooltips
  value: number;
  unit: string;
  timestamp: Date;
}
```

---

## 7. Performance Considerations

### 7.1 Optimization Strategies

1. **Caching**:
   - Cache parsed results (name → EnhancedPoint)
   - Cache search indices
   - Invalidate on pattern updates

2. **Lazy Parsing**:
   - Parse on-demand for large datasets
   - Progressive enhancement (basic → detailed)

3. **Indexing**:
   - Build search index (inverted index for terms)
   - Pre-build category groupings

4. **Parallel Processing**:
   - Use Web Workers for large batches
   - Process in chunks (1000 points/chunk)

### 7.2 Performance Targets

- **Parse 1000 points**: <100ms
- **Parse 10000 points**: <500ms
- **Search 10000 points**: <50ms
- **Group 10000 points**: <100ms

### 7.3 Memory Optimization

```typescript
// Efficient storage for large datasets
class PointIndex {
  private nameToEnhanced = new Map<string, EnhancedPoint>();
  private searchIndex = new Map<string, Set<string>>();  // term → point names
  private categoryIndex = new Map<PointCategory, string[]>();

  add(point: EnhancedPoint) {
    // Store enhanced point
    this.nameToEnhanced.set(point.name, point);

    // Build search index
    for (const term of point.searchTerms) {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, new Set());
      }
      this.searchIndex.get(term)!.add(point.name);
    }

    // Build category index
    if (!this.categoryIndex.has(point.category)) {
      this.categoryIndex.set(point.category, []);
    }
    this.categoryIndex.get(point.category)!.push(point.name);
  }

  search(query: string): EnhancedPoint[] {
    const lowerQuery = query.toLowerCase();
    const matchingNames = new Set<string>();

    // Find all matching terms
    for (const [term, names] of this.searchIndex) {
      if (term.includes(lowerQuery)) {
        for (const name of names) {
          matchingNames.add(name);
        }
      }
    }

    // Return enhanced points
    return Array.from(matchingNames).map(name => this.nameToEnhanced.get(name)!);
  }
}
```

---

## 8. Extensibility

### 8.1 Custom Pattern Addition

```typescript
// Allow users to add custom patterns
const service = new PointCleaningService();

service.addEquipmentPattern({
  type: EquipmentType.Custom,
  patterns: [/\bMYEQUIP[-_]?(\d+)?\b/i],
  priority: 50,
  aliases: ["My Equipment"]
});

service.addPointPattern({
  type: PointType.Custom,
  patterns: [/\bMyPoint\b/i],
  priority: 50,
  aliases: ["Custom Point"]
});
```

### 8.2 Plugin System

```typescript
interface PointCleaningPlugin {
  name: string;
  version: string;

  // Lifecycle hooks
  onBeforeParse?(point: BACnetPoint): void;
  onAfterParse?(enhanced: EnhancedPoint): EnhancedPoint;

  // Custom patterns
  equipmentPatterns?: EquipmentPattern[];
  pointPatterns?: PointPattern[];

  // Custom logic
  customExtractor?(tokens: Token[]): Partial<EnhancedPoint>;
}

// Usage
service.registerPlugin(myCustomPlugin);
```

---

## 9. Testing Strategy

### 9.1 Test Categories

1. **Unit Tests**: Each component (tokenizer, extractor, etc.)
2. **Integration Tests**: Full pipeline
3. **Pattern Tests**: Pattern matching accuracy
4. **Performance Tests**: Parsing speed benchmarks
5. **Regression Tests**: Known edge cases

### 9.2 Test Data

```typescript
const testCases = [
  {
    input: "VMAxxxxxxxx.AHU-01.707-VAV.Disch-Temp",
    expected: {
      displayName: "AHU-01 VAV-707 - Discharge Temperature",
      equipment: { type: "VAV", id: "707" },
      point: { type: "Temperature", purpose: "Discharge" }
    }
  },
  {
    input: "VMAxxxxxxxx.CWP-01.Status",
    expected: {
      displayName: "Chilled Water Pump 01 - Status",
      equipment: { type: "Pump", id: "01" },
      point: { type: "Status" }
    }
  },
  // ... 100+ test cases
];
```

---

## 10. Migration Plan

### Phase 1: Core Implementation (Week 1)
- Implement data structures
- Build tokenizer
- Implement equipment extractor
- Create basic patterns library

### Phase 2: Point Extraction (Week 1)
- Implement point extractor
- Add unit detection
- Create display name generator
- Build categorizer

### Phase 3: UI Integration (Week 2)
- Build point selector component
- Implement search functionality
- Create grouping/filtering UI
- Integrate with chart display

### Phase 4: Optimization (Week 2)
- Add caching layer
- Implement indexing
- Performance testing
- Memory optimization

### Phase 5: Testing & Refinement (Week 3)
- Comprehensive testing
- Pattern refinement
- Edge case handling
- Documentation

---

## 11. Success Metrics

1. **Parsing Accuracy**: 95%+ correct classification
2. **Performance**: <500ms for 10,000 points
3. **User Satisfaction**: Reduced point selection time by 80%
4. **Coverage**: 90%+ of points automatically categorized
5. **Search Effectiveness**: Relevant results in top 10

---

## 12. Future Enhancements

1. **Machine Learning**: Train model on user corrections
2. **Auto-Discovery**: Learn patterns from building data
3. **Semantic Analysis**: Understanding point relationships
4. **Natural Language**: "Show me all supply temps in AHU-01"
5. **Smart Suggestions**: Recommend related points
6. **Anomaly Detection**: Flag unusual naming patterns
7. **Multi-Language**: Support international conventions

---

## Conclusion

This architecture provides a robust, scalable foundation for transforming complex BACnet point names into intuitive, human-readable information. The multi-stage parsing pipeline, comprehensive pattern library, and intelligent categorization ensure high accuracy while maintaining excellent performance.

**Key Benefits**:
- Reduces point selection time by 80%
- Eliminates confusion from cryptic names
- Enables efficient equipment navigation
- Provides flexible categorization
- Scales to thousands of points
- Extensible for custom patterns

**Next Steps**:
1. Review and approve architecture
2. Begin Phase 1 implementation
3. Iterate based on real-world data
4. Gather user feedback
5. Continuously refine patterns
