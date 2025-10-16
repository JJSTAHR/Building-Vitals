/**
 * Rule-Based Point Enhancer
 * Version: 1.0.0
 *
 * Fast, deterministic enhancement using pattern matching and heuristics
 * Returns confidence score to determine if AI enhancement is needed
 */

import { cleanPointName } from './pointNameFilters.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const EQUIPMENT_PATTERNS = {
  // Air Handling Units
  ahu: {
    keywords: ['ahu', 'air handler', 'air handling', 'rooftop', 'rtu', 'air handler unit'],
    type: 'ahu',
    category: 'hvac',
    system: 'air-handling',
    confidence: 95
  },

  // Variable Air Volume
  vav: {
    keywords: ['vav', 'variable air volume', 'terminal unit', 'vav box'],
    type: 'vav',
    category: 'hvac',
    system: 'air-distribution',
    confidence: 95
  },

  // Chillers
  chiller: {
    keywords: ['chiller', 'chw', 'chill', 'cooling plant'],
    type: 'chiller',
    category: 'plant',
    system: 'cooling',
    confidence: 90
  },

  // Boilers
  boiler: {
    keywords: ['boiler', 'hhw', 'hot water', 'heating plant'],
    type: 'boiler',
    category: 'plant',
    system: 'heating',
    confidence: 90
  },

  // Pumps
  pump: {
    keywords: ['pump', 'chwp', 'hhwp', 'chilled water pump', 'hot water pump'],
    type: 'pump',
    category: 'plant',
    system: 'distribution',
    confidence: 85
  },

  // Fans
  fan: {
    keywords: ['fan', 'supply fan', 'return fan', 'exhaust fan', 'sf', 'rf', 'ef'],
    type: 'fan',
    category: 'hvac',
    system: 'air-handling',
    confidence: 85
  },

  // Fan Coil Units
  fcu: {
    keywords: ['fcu', 'fan coil', 'fan coil unit'],
    type: 'fcu',
    category: 'hvac',
    system: 'zone-control',
    confidence: 90
  },

  // Cooling Towers
  coolingTower: {
    keywords: ['cooling tower', 'ct', 'condenser water'],
    type: 'cooling-tower',
    category: 'plant',
    system: 'cooling',
    confidence: 90
  }
};

const POINT_TYPE_PATTERNS = {
  temperature: {
    keywords: ['temp', 'temperature', 'dat', 'sat', 'rat', 'oat', 'mat'],
    type: 'temp',
    unit: '°F',
    confidence: 90
  },

  pressure: {
    keywords: ['pressure', 'pres', 'dp', 'static pressure', 'sp'],
    type: 'pressure',
    unit: 'PSI',
    confidence: 85
  },

  flow: {
    keywords: ['flow', 'cfm', 'gpm', 'airflow', 'water flow'],
    type: 'flow',
    unit: 'CFM',
    confidence: 85
  },

  status: {
    keywords: ['status', 'sts', 'state', 'run', 'occupied', 'enable'],
    type: 'status',
    unit: null,
    confidence: 80
  },

  setpoint: {
    keywords: ['setpoint', 'sp', 'set point', 'setpt'],
    type: 'setpoint',
    unit: null,
    confidence: 85
  },

  command: {
    keywords: ['command', 'cmd', 'control', 'output'],
    type: 'command',
    unit: null,
    confidence: 80
  },

  damper: {
    keywords: ['damper', 'dmp', 'damper position'],
    type: 'damper',
    unit: '%',
    confidence: 90
  },

  valve: {
    keywords: ['valve', 'vlv', 'valve position'],
    type: 'valve',
    unit: '%',
    confidence: 90
  },

  speed: {
    keywords: ['speed', 'rpm', 'vfd', 'frequency'],
    type: 'speed',
    unit: 'Hz',
    confidence: 85
  },

  power: {
    keywords: ['power', 'kw', 'kilowatt', 'watt'],
    type: 'power',
    unit: 'kW',
    confidence: 90
  },

  energy: {
    keywords: ['energy', 'kwh', 'kilowatt hour'],
    type: 'energy',
    unit: 'kWh',
    confidence: 90
  }
};

// ============================================================================
// MAIN ENHANCEMENT FUNCTION
// ============================================================================

/**
 * Enhance point using rule-based patterns
 * @param {Object} point - Raw point object
 * @returns {Promise<Object>} Enhanced point with confidence score
 */
export async function enhancePointRuleBased(point) {
  const startTime = Date.now();
  const name = point.Name || point.name || '';
  const nameLower = name.toLowerCase();

  try {
    // Step 1: Clean the point name
    const cleanedName = cleanPointName(name);
    const displayName = point['Kv Tags']?.[0]?.dis || cleanedName || name;

    // Step 2: Extract equipment info
    const equipment = detectEquipment(nameLower);

    // Step 3: Extract point type
    const pointType = detectPointType(nameLower);

    // Step 4: Extract location info
    const location = extractLocation(name);

    // Step 5: Generate marker tags
    const markerTags = generateMarkerTags(equipment, pointType, nameLower);

    // Step 6: Calculate confidence score
    const confidence = calculateConfidence(equipment, pointType, location, displayName !== name);

    // Step 7: Build enhanced point
    const enhanced = {
      // Core identification
      name,
      display_name: displayName,
      original_name: name,

      // Equipment classification
      equipment: equipment.type,
      equipmentType: equipment.category,
      system: equipment.system,

      // Point classification
      pointType: pointType.type,
      unit: point['Kv Tags']?.[0]?.unit || pointType.unit || null,

      // Location
      location: location.building || null,
      floor: location.floor || null,
      zone: location.zone || null,

      // Metadata
      marker_tags: markerTags,
      kv_tags: point['Kv Tags'] || [],
      collect_enabled: point['Collect Enabled'] !== false,

      // Enhancement metadata
      confidence,
      source: 'rule-based',
      enhancementMethod: 'pattern-matching',
      processingTime: Date.now() - startTime,
      _enhancedAt: new Date().toISOString()
    };

    // Add all original fields
    Object.keys(point).forEach(key => {
      if (!enhanced[key] && !key.includes(' ')) {
        enhanced[key] = point[key];
      }
    });

    return enhanced;
  } catch (error) {
    console.error('[RULE-BASED] Error enhancing point:', error);

    // Return minimal enhancement on error
    return {
      name,
      display_name: point['Kv Tags']?.[0]?.dis || name,
      original_name: name,
      confidence: 20,
      source: 'rule-based-error',
      error: error.message,
      _enhancedAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect equipment type from point name
 * @param {string} nameLower - Lowercase point name
 * @returns {Object} Equipment info
 */
function detectEquipment(nameLower) {
  // Try each equipment pattern
  for (const [key, pattern] of Object.entries(EQUIPMENT_PATTERNS)) {
    const matched = pattern.keywords.some(keyword => nameLower.includes(keyword));

    if (matched) {
      return {
        type: pattern.type,
        category: pattern.category,
        system: pattern.system,
        confidence: pattern.confidence,
        matched: true
      };
    }
  }

  // No match found
  return {
    type: 'unknown',
    category: 'unknown',
    system: 'unknown',
    confidence: 0,
    matched: false
  };
}

/**
 * Detect point type from point name
 * @param {string} nameLower - Lowercase point name
 * @returns {Object} Point type info
 */
function detectPointType(nameLower) {
  // Try each point type pattern
  for (const [key, pattern] of Object.entries(POINT_TYPE_PATTERNS)) {
    const matched = pattern.keywords.some(keyword => nameLower.includes(keyword));

    if (matched) {
      return {
        type: pattern.type,
        unit: pattern.unit,
        confidence: pattern.confidence,
        matched: true
      };
    }
  }

  // No match found
  return {
    type: 'unknown',
    unit: null,
    confidence: 0,
    matched: false
  };
}

/**
 * Extract location information from point name
 * @param {string} name - Point name
 * @returns {Object} Location info
 */
function extractLocation(name) {
  const location = {
    building: null,
    floor: null,
    zone: null
  };

  // Building detection (e.g., B1, BLDG-A, Building-1)
  const buildingMatch = name.match(/\b(?:B|BLDG|Building)[-_]?(\d+|[A-Z])\b/i);
  if (buildingMatch) {
    location.building = buildingMatch[0];
  }

  // Floor detection (e.g., FL1, Floor-2, 3F, 1st)
  const floorMatch = name.match(/\b(?:FL|Floor|F|Level|L)[-_]?(\d+)(?:st|nd|rd|th)?\b/i);
  if (floorMatch) {
    location.floor = floorMatch[0];
  }

  // Zone detection (e.g., Zone-A, Z1, Room-101)
  const zoneMatch = name.match(/\b(?:Zone|Z|Room|Rm)[-_]?(\d+|[A-Z])\b/i);
  if (zoneMatch) {
    location.zone = zoneMatch[0];
  }

  return location;
}

/**
 * Generate Haystack-style marker tags
 * @param {Object} equipment - Equipment info
 * @param {Object} pointType - Point type info
 * @param {string} nameLower - Lowercase name
 * @returns {Array} Array of marker tags
 */
function generateMarkerTags(equipment, pointType, nameLower) {
  const tags = ['point', 'sensor'];

  // Equipment tags
  if (equipment.matched) {
    tags.push(equipment.type, 'equip');
    if (equipment.category) tags.push(equipment.category);
  }

  // Point type tags
  if (pointType.matched) {
    tags.push(pointType.type);
  }

  // Air stream tags
  if (nameLower.includes('oa') || nameLower.includes('outside air')) {
    tags.push('air', 'outside');
  }
  if (nameLower.includes('ra') || nameLower.includes('return air')) {
    tags.push('air', 'return');
  }
  if (nameLower.includes('sa') || nameLower.includes('supply air') || nameLower.includes('da') || nameLower.includes('discharge air')) {
    tags.push('air', 'supply');
  }
  if (nameLower.includes('ea') || nameLower.includes('exhaust air')) {
    tags.push('air', 'exhaust');
  }
  if (nameLower.includes('ma') || nameLower.includes('mixed air')) {
    tags.push('air', 'mixed');
  }

  // Remove duplicates and return
  return [...new Set(tags)];
}

/**
 * Calculate overall confidence score
 * @param {Object} equipment - Equipment info
 * @param {Object} pointType - Point type info
 * @param {Object} location - Location info
 * @param {boolean} hasDisplayName - Whether point has clean display name
 * @returns {number} Confidence score (0-100)
 */
function calculateConfidence(equipment, pointType, location, hasDisplayName) {
  let confidence = 0;
  let factors = 0;

  // Equipment match (40% weight)
  if (equipment.matched) {
    confidence += equipment.confidence * 0.4;
    factors += 0.4;
  }

  // Point type match (30% weight)
  if (pointType.matched) {
    confidence += pointType.confidence * 0.3;
    factors += 0.3;
  }

  // Location info (15% weight)
  const locationScore = [location.building, location.floor, location.zone].filter(Boolean).length * 33.33;
  confidence += locationScore * 0.15;
  factors += 0.15;

  // Display name (15% weight)
  if (hasDisplayName) {
    confidence += 90 * 0.15;
    factors += 0.15;
  }

  // Normalize to 0-100 scale
  const finalConfidence = factors > 0 ? confidence / factors : 0;

  return Math.round(Math.max(0, Math.min(100, finalConfidence)));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  enhancePointRuleBased,
  detectEquipment,
  detectPointType,
  extractLocation,
  calculateConfidence,
  EQUIPMENT_PATTERNS,
  POINT_TYPE_PATTERNS
};
