/**
 * Point Cleaning Type Definitions
 *
 * Core types for intelligent BACnet point name parsing and enhancement
 */

// ============================================================================
// Core Enhanced Point Types
// ============================================================================

/**
 * Complete enhanced point with parsed equipment and point information
 */
export interface EnhancedPoint {
  // Original identifiers
  name: string;
  objectIdentifier: string;

  // Parsed equipment information
  equipment: EquipmentInfo;

  // Parsed point information
  point: PointInfo;

  // Display and UI
  displayName: string;
  shortName: string;
  category: PointCategory;
  subcategory?: string;

  // Search optimization
  searchTerms: string[];
  tags: string[];

  // Hierarchy and relationships
  hierarchy: string[];
  relatedPoints?: string[];

  // Metadata
  confidence: number;
  parsingNotes?: string;
}

/**
 * Equipment information extracted from point name
 */
export interface EquipmentInfo {
  // Core identification
  type: EquipmentType;
  id: string;
  fullName: string;

  // Hierarchy
  system?: string;
  subsystem?: string;
  component?: string;

  // Location
  location?: LocationInfo;

  // Additional context
  purpose?: string;
  zone?: string;
}

/**
 * Point information extracted from point name
 */
export interface PointInfo {
  // Core identification
  type: PointType;
  purpose?: PointPurpose;

  // Measurement
  unit?: string;
  dataType: DataType;

  // Context
  modifier?: string;
  location?: PointLocation;

  // BACnet specifics
  objectType: string;
}

/**
 * Location information
 */
export interface LocationInfo {
  building?: string;
  floor?: string;
  zone?: string;
  room?: string;
  area?: string;
}

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Display categories for UI grouping
 */
export enum PointCategory {
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
export enum EquipmentType {
  AHU = "AHU",
  VAV = "VAV",
  FCU = "FCU",
  RTU = "RTU",
  MAU = "MAU",
  Chiller = "Chiller",
  Boiler = "Boiler",
  CoolingTower = "Cooling Tower",
  Pump = "Pump",
  Fan = "Fan",
  Damper = "Damper",
  Valve = "Valve",
  VFD = "VFD",
  Thermostat = "Thermostat",
  Sensor = "Sensor",
  Unknown = "Unknown"
}

/**
 * Point types
 */
export enum PointType {
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
export enum PointPurpose {
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
export enum PointLocation {
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
export enum DataType {
  Analog = "analog",
  Binary = "binary",
  Multistate = "multistate"
}

// ============================================================================
// Parsing Configuration Types
// ============================================================================

/**
 * Pattern matching configuration
 */
export interface ParsingConfig {
  equipmentPatterns: EquipmentPattern[];
  pointPatterns: PointPattern[];
  unitPatterns: UnitPattern[];
  locationPatterns: LocationPattern[];
  stopWords: string[];
}

/**
 * Equipment pattern for regex matching
 */
export interface EquipmentPattern {
  type: EquipmentType;
  patterns: RegExp[];
  priority: number;
  aliases: string[];
  context?: string[];
}

/**
 * Point type pattern
 */
export interface PointPattern {
  type: PointType;
  patterns: RegExp[];
  priority: number;
  aliases: string[];
  units?: string[];
  purposePatterns?: {
    [key in PointPurpose]?: RegExp[];
  };
}

/**
 * Unit pattern for measurement detection
 */
export interface UnitPattern {
  unit: string;
  standardUnit: string;
  patterns: RegExp[];
  pointTypes: PointType[];
}

/**
 * Location pattern
 */
export interface LocationPattern {
  type: keyof LocationInfo;
  patterns: RegExp[];
  examples: string[];
}

// ============================================================================
// Tokenization Types
// ============================================================================

/**
 * Token from point name parsing
 */
export interface Token {
  value: string;
  type: TokenType;
  position: number;
  confidence: number;
}

/**
 * Token types for classification
 */
export enum TokenType {
  EQUIPMENT = "EQUIPMENT",
  EQUIPMENT_ID = "EQUIPMENT_ID",
  POINT_TYPE = "POINT_TYPE",
  POINT_PURPOSE = "POINT_PURPOSE",
  UNIT = "UNIT",
  LOCATION = "LOCATION",
  MODIFIER = "MODIFIER",
  NUMBER = "NUMBER",
  UNKNOWN = "UNKNOWN"
}

// ============================================================================
// UI Integration Types
// ============================================================================

/**
 * Point selector component props
 */
export interface PointSelectorProps {
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
export interface GroupedPoints {
  category: PointCategory;
  subcategory?: string;
  points: EnhancedPoint[];
  expanded: boolean;
}

/**
 * Chart point display format
 */
export interface ChartPoint {
  displayName: string;
  shortName: string;
  originalName: string;
  value: number;
  unit: string;
  timestamp: Date;
}

// ============================================================================
// Plugin System Types
// ============================================================================

/**
 * Plugin interface for extensibility
 */
export interface PointCleaningPlugin {
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

// ============================================================================
// BACnet Input Types
// ============================================================================

/**
 * BACnet point input (from discovery)
 */
export interface BACnetPoint {
  name: string;
  objectIdentifier: string;
  objectType: string;
  deviceId: string;
  presentValue?: any;
  units?: string;
}

// ============================================================================
// Search and Indexing Types
// ============================================================================

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  point: EnhancedPoint;
  score: number;
  matchedTerms: string[];
}

/**
 * Point index for efficient searching
 */
export interface PointIndex {
  nameToEnhanced: Map<string, EnhancedPoint>;
  searchIndex: Map<string, Set<string>>;
  categoryIndex: Map<PointCategory, string[]>;
}

// ============================================================================
// Parsing Result Types
// ============================================================================

/**
 * Parsing result with confidence and notes
 */
export interface ParsingResult {
  success: boolean;
  enhanced?: EnhancedPoint;
  error?: string;
  confidence: number;
  warnings?: string[];
}

// ============================================================================
// Performance Tracking Types
// ============================================================================

/**
 * Performance metrics for parsing
 */
export interface PerformanceMetrics {
  totalPoints: number;
  parseTime: number;
  averageTimePerPoint: number;
  successRate: number;
  confidenceDistribution: {
    high: number;    // >0.8
    medium: number;  // 0.5-0.8
    low: number;     // <0.5
  };
}

// ============================================================================
// Display Template Types
// ============================================================================

/**
 * Display name templates
 */
export interface DisplayTemplates {
  standard: string;
  withPurpose: string;
  withUnit: string;
  short: string;
  compact: string;
}

/**
 * Template variables for rendering
 */
export interface TemplateVariables {
  equipment: {
    type: string;
    id: string;
    fullName: string;
    location?: string;
  };
  point: {
    type: string;
    purpose?: string;
    location?: string;
    unit?: string;
    abbrev?: string;
  };
}
