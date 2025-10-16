/**
 * BACnet Point Classification Implementation
 * Based on analysis of 70+ real points from SES Falls City site
 *
 * This module provides functions to extract equipment (FROM) and
 * measurement type (WHAT) from BACnet point data.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface RawBACnetPoint {
  Name: string;
  Site: string;
  Client: string;
  "Point Type": string;
  "Collect Enabled": string;
  "Collect Interval": string;
  "Marker Tags": string;
  "Kv Tags": string;
  "Bacnet Data": string; // JSON string
  "Collect Config": string;
  Updated: string;
  Created: string;
}

export interface BACnetData {
  device_id: string;
  device_name: string;
  object_name: string;
  object_type: string;
  object_index: string;
  object_units: string;
  present_value: string;
  device_address: string;
  priority_array: string;
  scrape_enabled: string;
  scrape_interval: string;
  device_description: string;
  object_description: string;
}

export interface EquipmentClassification {
  type: 'VAV' | 'RTU' | 'RVB' | 'CHWS' | 'OTHER' | 'UNKNOWN';
  id: string | null;
  deviceName: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PointTypeClassification {
  category: string;
  subcategory: string | null;
  objectType: string;
  objectIndex: string;
  units: string;
  markerTag: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface LocationInfo {
  rawLocation: string;
  buildingWing: string | null; // A, B, C
  roomNumber: string | null; // e.g., "102", "1214"
  functionalArea: string | null; // e.g., "Exam", "Office"
}

export interface ClassifiedPoint {
  from: {
    equipment: EquipmentClassification;
    location: LocationInfo;
  };
  what: PointTypeClassification;
  bacnetPath: string;
  presentValue: string;
  metadata: {
    site: string;
    client: string;
    updated: string;
    created: string;
  };
}

// ============================================================================
// Equipment Classification
// ============================================================================

export function classifyEquipment(deviceName: string): EquipmentClassification {
  if (!deviceName || deviceName.trim() === '') {
    return {
      type: 'UNKNOWN',
      id: null,
      deviceName: '',
      confidence: 'low'
    };
  }

  const name = deviceName.trim();

  // VAV Box patterns
  const vavPatterns = [
    /VAV[_-](\d+)/i,
    /Vav(\d+)/i,
    /VAVR\s*(\d+)/i
  ];

  for (const pattern of vavPatterns) {
    const match = name.match(pattern);
    if (match) {
      return {
        type: 'VAV',
        id: match[1],
        deviceName: name,
        confidence: 'high'
      };
    }
  }

  // RTU/AHU patterns
  const rtuPatterns = [
    /RTU(\d+)N?/i,
    /Rtu(\d+)/i,
    /Ahu(\d+)(?:_\d+)?/i
  ];

  for (const pattern of rtuPatterns) {
    const match = name.match(pattern);
    if (match) {
      return {
        type: 'RTU',
        id: match[1],
        deviceName: name,
        confidence: 'high'
      };
    }
  }

  // RVB pattern
  const rvbMatch = name.match(/Rvb(\d+)/i);
  if (rvbMatch) {
    return {
      type: 'RVB',
      id: rvbMatch[1],
      deviceName: name,
      confidence: 'medium' // Medium confidence due to ambiguity
    };
  }

  // Chilled Water System
  if (name === 'CHWS') {
    return {
      type: 'CHWS',
      id: null,
      deviceName: name,
      confidence: 'high'
    };
  }

  // Generic device pattern
  if (/DEV\d+/i.test(name)) {
    const match = name.match(/DEV(\d+)/i);
    return {
      type: 'OTHER',
      id: match ? match[1] : null,
      deviceName: name,
      confidence: 'low'
    };
  }

  // Unknown device
  return {
    type: 'OTHER',
    id: null,
    deviceName: name,
    confidence: 'low'
  };
}

// ============================================================================
// Point Type Classification
// ============================================================================

export function classifyPointType(
  markerTag: string | null,
  objectUnits: string,
  objectType: string,
  objectIndex: string
): PointTypeClassification {
  let category = 'Unknown';
  let subcategory: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Priority 1: Marker tag (most reliable when present)
  if (markerTag) {
    const tag = markerTag.toLowerCase().trim();

    // Temperature
    if (tag.includes('temp')) {
      category = 'Temperature';
      if (tag.includes('room')) subcategory = 'RoomTemp';
      else if (tag.includes('da')) subcategory = 'DaTemp';
      else if (tag.includes('ra')) subcategory = 'RaTemp';
      else if (tag.includes('sa')) subcategory = 'SaTemp';
      else if (tag.includes('cwr')) subcategory = 'CWRTemp';
      confidence = 'high';
    }
    // Humidity
    else if (tag.includes('humidity') || tag.includes('rh')) {
      category = 'Humidity';
      if (tag.includes('room')) subcategory = 'RoomRH';
      else if (tag.includes('ra')) subcategory = 'RaHumidity';
      confidence = 'high';
    }
    // Damper
    else if (tag.includes('damper')) {
      category = 'Control Signal';
      subcategory = 'Damper';
      confidence = 'high';
    }
    // Heat/Cool signals
    else if (tag.includes('heat')) {
      category = 'Control Signal';
      subcategory = 'HeatSignal';
      confidence = 'high';
    }
    else if (tag.includes('cool')) {
      category = 'Control Signal';
      subcategory = 'CoolSignal';
      confidence = 'high';
    }
    // Airflow
    else if (tag.includes('airflow') || tag.includes('cfm') || tag.includes('fpm')) {
      category = 'Airflow';
      confidence = 'high';
    }
    // Pressure
    else if (tag.includes('press')) {
      category = 'Pressure';
      if (tag.includes('ra')) subcategory = 'RaPress';
      else if (tag.includes('sa')) subcategory = 'SaPress';
      confidence = 'high';
    }
    // Status
    else if (tag.includes('status')) {
      category = 'Status';
      if (tag.includes('fan')) subcategory = 'FanStatus';
      confidence = 'high';
    }
    // Setpoint
    else if (tag.includes('setpt') || tag.includes('setpoint') || tag.includes('spt')) {
      category = 'Setpoint';
      confidence = 'high';
    }
    // Tracking/Offset
    else if (tag.includes('track') || tag.includes('offset')) {
      category = 'Control Parameter';
      subcategory = tag.includes('track') ? 'Tracking' : 'Offset';
      confidence = 'high';
    }
    // Alarm
    else if (tag.includes('alarm')) {
      category = 'Alarm';
      confidence = 'high';
    }
  }

  // Priority 2: Units (when marker tag didn't match or is missing)
  if (confidence === 'low' && objectUnits) {
    const units = objectUnits.toLowerCase();

    if (units.includes('fahrenheit') || units.includes('celsius')) {
      category = 'Temperature';
      confidence = 'medium';
    }
    else if (units.includes('humidity')) {
      category = 'Humidity';
      confidence = 'medium';
    }
    else if (units.includes('feet') || units.includes('cubic')) {
      category = 'Airflow';
      confidence = 'medium';
    }
    else if (units.includes('water')) {
      category = 'Pressure';
      confidence = 'medium';
    }
    else if (units === 'percent') {
      category = 'Percentage Control';
      subcategory = 'Generic';
      confidence = 'low'; // Could be many things
    }
  }

  // Priority 3: Object type (lowest confidence)
  if (confidence === 'low') {
    if (objectType.includes('binary')) {
      category = 'Binary Status';
      confidence = 'low';
    }
    else if (objectType.includes('analog')) {
      // Use object index patterns as last resort
      const idx = parseInt(objectIndex);
      if (idx === 102) {
        category = 'Humidity';
        subcategory = 'RoomRH';
        confidence = 'low';
      }
      else if (idx === 8 || idx === 9) {
        category = 'Control Signal';
        subcategory = 'Damper';
        confidence = 'low';
      }
      else if (idx === 0) {
        category = 'Control Signal';
        subcategory = 'HeatSignal';
        confidence = 'low';
      }
      else if (idx === 10) {
        category = 'Airflow';
        confidence = 'low';
      }
    }
  }

  return {
    category,
    subcategory,
    objectType,
    objectIndex,
    units: objectUnits,
    markerTag,
    confidence
  };
}

// ============================================================================
// Location Parsing
// ============================================================================

export function parseLocation(locationString: string): LocationInfo {
  const location = locationString.trim();

  // Extract building wing (A, B, C series)
  const wingMatch = location.match(/\b([ABC])(\d{3})\b/);
  let buildingWing: string | null = null;
  let roomNumber: string | null = null;

  if (wingMatch) {
    buildingWing = wingMatch[1];
    roomNumber = wingMatch[2];
  } else {
    // Check for 1000-series rooms
    const roomMatch = location.match(/\b(1\d{3})\b/);
    if (roomMatch) {
      roomNumber = roomMatch[1];
    }
  }

  // Extract functional area
  let functionalArea: string | null = null;
  const areaPatterns = [
    /\b(Exam|Office|Chapel|Classroom|Equipment Storage|Mixing Room|Laundry)\b/i,
    /\b(Ultrasound|Endoscopy|Decontamination)\b/i,
    /\b(IT|Business Office|Chief [A-Z]+ Officer)\b/i
  ];

  for (const pattern of areaPatterns) {
    const match = location.match(pattern);
    if (match) {
      functionalArea = match[1];
      break;
    }
  }

  return {
    rawLocation: location,
    buildingWing,
    roomNumber,
    functionalArea
  };
}

// ============================================================================
// Master Classification Function
// ============================================================================

export function classifyBACnetPoint(point: RawBACnetPoint): ClassifiedPoint {
  // Parse BACnet Data JSON
  let bacnetData: BACnetData;
  try {
    const parsed = JSON.parse(point['Bacnet Data']);
    bacnetData = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (error) {
    throw new Error(`Failed to parse BACnet Data: ${error}`);
  }

  // Parse marker tags
  const markerParts = point['Marker Tags']
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const locationString = markerParts[0] || '';
  const pointTypeTag = markerParts.length > 1 ? markerParts[1] : null;

  // Classify equipment
  const equipment = classifyEquipment(bacnetData.device_name);

  // Parse location
  const location = parseLocation(locationString);

  // Classify point type
  const pointType = classifyPointType(
    pointTypeTag,
    bacnetData.object_units,
    bacnetData.object_type,
    bacnetData.object_index
  );

  return {
    from: {
      equipment,
      location
    },
    what: pointType,
    bacnetPath: point.Name,
    presentValue: bacnetData.present_value,
    metadata: {
      site: point.Site,
      client: point.Client,
      updated: point.Updated,
      created: point.Created
    }
  };
}

// ============================================================================
// Batch Classification with Confidence Filtering
// ============================================================================

export interface ClassificationStats {
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  byEquipmentType: Record<string, number>;
  byPointCategory: Record<string, number>;
}

export function classifyBatchPoints(
  points: RawBACnetPoint[],
  minConfidence?: 'high' | 'medium' | 'low'
): { classified: ClassifiedPoint[]; stats: ClassificationStats } {
  const classified: ClassifiedPoint[] = [];
  const stats: ClassificationStats = {
    total: points.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    byEquipmentType: {},
    byPointCategory: {}
  };

  for (const point of points) {
    try {
      const result = classifyBACnetPoint(point);

      // Count confidence levels
      if (result.from.equipment.confidence === 'high' && result.what.confidence === 'high') {
        stats.highConfidence++;
      } else if (result.from.equipment.confidence === 'low' || result.what.confidence === 'low') {
        stats.lowConfidence++;
      } else {
        stats.mediumConfidence++;
      }

      // Count by equipment type
      const eqType = result.from.equipment.type;
      stats.byEquipmentType[eqType] = (stats.byEquipmentType[eqType] || 0) + 1;

      // Count by point category
      const ptCat = result.what.category;
      stats.byPointCategory[ptCat] = (stats.byPointCategory[ptCat] || 0) + 1;

      // Filter by minimum confidence if specified
      if (minConfidence) {
        const confidenceLevel = { high: 3, medium: 2, low: 1 };
        const eqConf = confidenceLevel[result.from.equipment.confidence];
        const ptConf = confidenceLevel[result.what.confidence];
        const minConf = confidenceLevel[minConfidence];

        if (eqConf >= minConf && ptConf >= minConf) {
          classified.push(result);
        }
      } else {
        classified.push(result);
      }
    } catch (error) {
      console.error(`Failed to classify point ${point.Name}:`, error);
    }
  }

  return { classified, stats };
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validatePointValue(
  category: string,
  value: string,
  units: string
): { valid: boolean; reason?: string } {
  const numValue = parseFloat(value);

  if (isNaN(numValue)) {
    return { valid: false, reason: 'Value is not a number' };
  }

  switch (category) {
    case 'Temperature':
      if (numValue < 32 || numValue > 120) {
        return { valid: false, reason: 'Temperature out of expected range (32-120°F)' };
      }
      break;

    case 'Humidity':
      if (numValue < 0 || numValue > 100) {
        return { valid: false, reason: 'Humidity out of expected range (0-100%)' };
      }
      break;

    case 'Control Signal':
      if (units.includes('percent') && (numValue < 0 || numValue > 100)) {
        return { valid: false, reason: 'Control signal out of expected range (0-100%)' };
      }
      break;

    case 'Pressure':
      if (numValue < -2 || numValue > 5) {
        return { valid: false, reason: 'Pressure out of expected range (-2 to 5 inches H2O)' };
      }
      break;

    case 'Airflow':
      if (numValue < 0 || numValue > 10000) {
        return { valid: false, reason: 'Airflow out of expected range (0-10000 CFM)' };
      }
      break;
  }

  return { valid: true };
}

// ============================================================================
// Export Helper Functions
// ============================================================================

export function formatClassifiedPoint(point: ClassifiedPoint): string {
  const { from, what } = point;
  const eqDisplay = from.equipment.id
    ? `${from.equipment.type}-${from.equipment.id}`
    : from.equipment.type;

  const ptDisplay = what.subcategory || what.category;
  const location = from.location.functionalArea
    ? `${from.location.functionalArea} ${from.location.roomNumber || ''}`
    : from.location.rawLocation;

  return `${eqDisplay} @ ${location} - ${ptDisplay} (${point.presentValue} ${what.units})`;
}

export function exportToCSV(points: ClassifiedPoint[]): string {
  const headers = [
    'Equipment Type',
    'Equipment ID',
    'Device Name',
    'Location',
    'Building Wing',
    'Room Number',
    'Point Category',
    'Point Subcategory',
    'Present Value',
    'Units',
    'BACnet Path',
    'Equipment Confidence',
    'Point Confidence'
  ].join(',');

  const rows = points.map(p => [
    p.from.equipment.type,
    p.from.equipment.id || '',
    p.from.equipment.deviceName,
    p.from.location.rawLocation,
    p.from.location.buildingWing || '',
    p.from.location.roomNumber || '',
    p.what.category,
    p.what.subcategory || '',
    p.presentValue,
    p.what.units,
    p.bacnetPath,
    p.from.equipment.confidence,
    p.what.confidence
  ].map(v => `"${v}"`).join(','));

  return [headers, ...rows].join('\n');
}

// ============================================================================
// Usage Example
// ============================================================================

/*
import { classifyBACnetPoint, classifyBatchPoints, formatClassifiedPoint } from './parsing_implementation';

// Single point classification
const rawPoint: RawBACnetPoint = {
  Name: "ses/ses_falls_city/8000:33-8033/analogValue/102",
  // ... other fields
};

const classified = classifyBACnetPoint(rawPoint);
console.log(formatClassifiedPoint(classified));
// Output: "VAV-811 @ QI Risk Manager C119 - RoomRH (49.0 percentRelativeHumidity)"

// Batch classification with stats
const { classified: results, stats } = classifyBatchPoints(rawPoints, 'medium');
console.log(`Classified ${results.length} points with medium+ confidence`);
console.log('Stats:', stats);
*/
