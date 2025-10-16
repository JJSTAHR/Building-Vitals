/**
 * Mock Haystack Data for Testing
 * Contains sample units, definitions, and markers following Project Haystack standards
 */

export interface HaystackUnit {
  symbol: string;
  name: string;
  quantity: string;
  scale?: number;
  offset?: number;
}

export interface HaystackDefinition {
  id: string;
  def: string;
  is: string[];
  doc: string;
  wikipedia?: string;
}

export interface HaystackMarker {
  name: string;
  def: string;
  doc: string;
}

/**
 * 50 Sample Units across different categories
 */
export const HAYSTACK_UNITS: HaystackUnit[] = [
  // Temperature
  { symbol: '°F', name: 'fahrenheit', quantity: 'temperature' },
  { symbol: '°C', name: 'celsius', quantity: 'temperature', scale: 1.8, offset: 32 },
  { symbol: 'K', name: 'kelvin', quantity: 'temperature', scale: 1.8, offset: 459.67 },
  { symbol: '°R', name: 'rankine', quantity: 'temperature' },
  { symbol: 'Δ°F', name: 'fahrenheit_degrees', quantity: 'temperature_difference' },
  { symbol: 'Δ°C', name: 'celsius_degrees', quantity: 'temperature_difference' },

  // Pressure
  { symbol: 'psi', name: 'pounds_per_square_inch', quantity: 'pressure' },
  { symbol: 'inHg', name: 'inches_of_mercury', quantity: 'pressure' },
  { symbol: 'inH₂O', name: 'inches_of_water', quantity: 'pressure' },
  { symbol: 'mmHg', name: 'millimeters_of_mercury', quantity: 'pressure' },
  { symbol: 'Pa', name: 'pascal', quantity: 'pressure' },
  { symbol: 'kPa', name: 'kilopascal', quantity: 'pressure', scale: 1000 },
  { symbol: 'bar', name: 'bar', quantity: 'pressure', scale: 100000 },
  { symbol: 'mbar', name: 'millibar', quantity: 'pressure', scale: 100 },

  // Flow
  { symbol: 'cfm', name: 'cubic_feet_per_minute', quantity: 'volumetric_flow' },
  { symbol: 'gpm', name: 'gallons_per_minute', quantity: 'volumetric_flow' },
  { symbol: 'L/s', name: 'liters_per_second', quantity: 'volumetric_flow' },
  { symbol: 'm³/s', name: 'cubic_meters_per_second', quantity: 'volumetric_flow' },
  { symbol: 'm³/h', name: 'cubic_meters_per_hour', quantity: 'volumetric_flow' },
  { symbol: 'ft³/s', name: 'cubic_feet_per_second', quantity: 'volumetric_flow' },

  // Power
  { symbol: 'kW', name: 'kilowatt', quantity: 'power', scale: 1000 },
  { symbol: 'W', name: 'watt', quantity: 'power' },
  { symbol: 'MW', name: 'megawatt', quantity: 'power', scale: 1000000 },
  { symbol: 'hp', name: 'horsepower', quantity: 'power', scale: 745.7 },
  { symbol: 'tonref', name: 'ton_of_refrigeration', quantity: 'power', scale: 3516.85 },
  { symbol: 'BTU/h', name: 'btu_per_hour', quantity: 'power', scale: 0.293071 },

  // Energy
  { symbol: 'kWh', name: 'kilowatt_hour', quantity: 'energy', scale: 3600000 },
  { symbol: 'Wh', name: 'watt_hour', quantity: 'energy', scale: 3600 },
  { symbol: 'MWh', name: 'megawatt_hour', quantity: 'energy', scale: 3600000000 },
  { symbol: 'BTU', name: 'british_thermal_unit', quantity: 'energy', scale: 1055.06 },
  { symbol: 'kBTU', name: 'kilobtu', quantity: 'energy', scale: 1055060 },
  { symbol: 'therm', name: 'therm', quantity: 'energy', scale: 105506000 },

  // Electrical
  { symbol: 'V', name: 'volt', quantity: 'electric_potential' },
  { symbol: 'kV', name: 'kilovolt', quantity: 'electric_potential', scale: 1000 },
  { symbol: 'A', name: 'ampere', quantity: 'electric_current' },
  { symbol: 'mA', name: 'milliampere', quantity: 'electric_current', scale: 0.001 },
  { symbol: 'Ω', name: 'ohm', quantity: 'electric_resistance' },
  { symbol: 'Hz', name: 'hertz', quantity: 'frequency' },
  { symbol: 'kVA', name: 'kilovolt_ampere', quantity: 'apparent_power', scale: 1000 },
  { symbol: 'kVAR', name: 'kilovar', quantity: 'reactive_power', scale: 1000 },

  // Percentage and Ratio
  { symbol: '%', name: 'percent', quantity: 'dimensionless', scale: 0.01 },
  { symbol: '%RH', name: 'percent_relative_humidity', quantity: 'relative_humidity', scale: 0.01 },
  { symbol: 'ppm', name: 'parts_per_million', quantity: 'concentration', scale: 0.000001 },
  { symbol: 'ppb', name: 'parts_per_billion', quantity: 'concentration', scale: 0.000000001 },

  // Time
  { symbol: 's', name: 'second', quantity: 'time' },
  { symbol: 'min', name: 'minute', quantity: 'time', scale: 60 },
  { symbol: 'h', name: 'hour', quantity: 'time', scale: 3600 },
  { symbol: 'day', name: 'day', quantity: 'time', scale: 86400 },

  // Other Physical
  { symbol: 'lux', name: 'lux', quantity: 'illuminance' },
  { symbol: 'ft-c', name: 'footcandle', quantity: 'illuminance', scale: 10.764 }
];

/**
 * 100 Sample Definitions covering equipment, points, and markers
 */
export const HAYSTACK_DEFINITIONS: HaystackDefinition[] = [
  // Equipment Types
  {
    id: 'ahu',
    def: 'airHandlingEquip',
    is: ['equip'],
    doc: 'Equipment that conditions and distributes air via one or more fans',
    wikipedia: 'https://en.wikipedia.org/wiki/Air_handler'
  },
  {
    id: 'vav',
    def: 'vav',
    is: ['equip'],
    doc: 'Variable air volume terminal unit',
    wikipedia: 'https://en.wikipedia.org/wiki/Variable_air_volume'
  },
  {
    id: 'boiler',
    def: 'boiler',
    is: ['equip'],
    doc: 'Equipment to generate hot water or steam for heating',
    wikipedia: 'https://en.wikipedia.org/wiki/Boiler'
  },
  {
    id: 'chiller',
    def: 'chiller',
    is: ['equip'],
    doc: 'Equipment to remove heat from a liquid via vapor compression',
    wikipedia: 'https://en.wikipedia.org/wiki/Chiller'
  },
  {
    id: 'coolingTower',
    def: 'coolingTower',
    is: ['equip'],
    doc: 'Equipment to cool water by evaporation',
    wikipedia: 'https://en.wikipedia.org/wiki/Cooling_tower'
  },
  {
    id: 'pump',
    def: 'pump',
    is: ['equip'],
    doc: 'Equipment to move fluid',
    wikipedia: 'https://en.wikipedia.org/wiki/Pump'
  },
  {
    id: 'fan',
    def: 'fan',
    is: ['equip'],
    doc: 'Equipment to create air flow',
    wikipedia: 'https://en.wikipedia.org/wiki/Fan_(machine)'
  },
  {
    id: 'meter',
    def: 'meter',
    is: ['equip'],
    doc: 'Equipment to measure quantity',
    wikipedia: 'https://en.wikipedia.org/wiki/Meter'
  },
  {
    id: 'elecMeter',
    def: 'elecMeter',
    is: ['meter'],
    doc: 'Electricity meter'
  },
  {
    id: 'gasMeter',
    def: 'gasMeter',
    is: ['meter'],
    doc: 'Natural gas meter'
  },

  // Point Types - Temperature
  {
    id: 'temp',
    def: 'temp',
    is: ['point'],
    doc: 'Temperature measurement or setpoint'
  },
  {
    id: 'discharge',
    def: 'discharge',
    is: ['point'],
    doc: 'Fluid or air exiting equipment'
  },
  {
    id: 'return',
    def: 'return',
    is: ['point'],
    doc: 'Fluid or air returning to equipment'
  },
  {
    id: 'entering',
    def: 'entering',
    is: ['point'],
    doc: 'Fluid or air entering equipment'
  },
  {
    id: 'leaving',
    def: 'leaving',
    is: ['point'],
    doc: 'Fluid or air leaving equipment'
  },
  {
    id: 'zone',
    def: 'zone',
    is: ['point'],
    doc: 'Conditioned space in a building'
  },
  {
    id: 'outside',
    def: 'outside',
    is: ['point'],
    doc: 'Outside air or outdoor conditions'
  },
  {
    id: 'mixed',
    def: 'mixed',
    is: ['point'],
    doc: 'Mixed air in HVAC system'
  },

  // Point Types - Pressure
  {
    id: 'pressure',
    def: 'pressure',
    is: ['point'],
    doc: 'Pressure measurement'
  },
  {
    id: 'staticPressure',
    def: 'staticPressure',
    is: ['pressure'],
    doc: 'Static pressure in duct or pipe'
  },

  // Point Types - Flow
  {
    id: 'flow',
    def: 'flow',
    is: ['point'],
    doc: 'Flow rate measurement'
  },
  {
    id: 'airFlow',
    def: 'airFlow',
    is: ['flow'],
    doc: 'Air flow rate'
  },
  {
    id: 'waterFlow',
    def: 'waterFlow',
    is: ['flow'],
    doc: 'Water flow rate'
  },

  // Point Types - Status and Command
  {
    id: 'cmd',
    def: 'cmd',
    is: ['point'],
    doc: 'Command output point'
  },
  {
    id: 'sp',
    def: 'sp',
    is: ['point'],
    doc: 'Setpoint - target value'
  },
  {
    id: 'sensor',
    def: 'sensor',
    is: ['point'],
    doc: 'Measured input value'
  },
  {
    id: 'alarm',
    def: 'alarm',
    is: ['point'],
    doc: 'Alarm condition point'
  },
  {
    id: 'enable',
    def: 'enable',
    is: ['point'],
    doc: 'Enable/disable point'
  },
  {
    id: 'run',
    def: 'run',
    is: ['point'],
    doc: 'Run status point'
  },

  // Markers - General
  {
    id: 'air',
    def: 'air',
    is: ['marker'],
    doc: 'Related to air'
  },
  {
    id: 'water',
    def: 'water',
    is: ['marker'],
    doc: 'Related to water'
  },
  {
    id: 'steam',
    def: 'steam',
    is: ['marker'],
    doc: 'Related to steam'
  },
  {
    id: 'elec',
    def: 'elec',
    is: ['marker'],
    doc: 'Related to electricity'
  },
  {
    id: 'gas',
    def: 'gas',
    is: ['marker'],
    doc: 'Related to natural gas'
  },

  // Markers - HVAC Specific
  {
    id: 'hot',
    def: 'hot',
    is: ['marker'],
    doc: 'Hot water or hot conditions'
  },
  {
    id: 'cold',
    def: 'cold',
    is: ['marker'],
    doc: 'Cold water or cold conditions'
  },
  {
    id: 'cool',
    def: 'cool',
    is: ['marker'],
    doc: 'Cooling process'
  },
  {
    id: 'heat',
    def: 'heat',
    is: ['marker'],
    doc: 'Heating process'
  },
  {
    id: 'condenser',
    def: 'condenser',
    is: ['marker'],
    doc: 'Condenser side of refrigeration cycle'
  },
  {
    id: 'evaporator',
    def: 'evaporator',
    is: ['marker'],
    doc: 'Evaporator side of refrigeration cycle'
  },

  // Markers - Direction/Location
  {
    id: 'supply',
    def: 'supply',
    is: ['marker'],
    doc: 'Supply to space or equipment'
  },
  {
    id: 'exhaust',
    def: 'exhaust',
    is: ['marker'],
    doc: 'Exhaust from space or equipment'
  },
  {
    id: 'inlet',
    def: 'inlet',
    is: ['marker'],
    doc: 'Inlet to equipment'
  },
  {
    id: 'outlet',
    def: 'outlet',
    is: ['marker'],
    doc: 'Outlet from equipment'
  },

  // Additional Equipment Types
  {
    id: 'heatExchanger',
    def: 'heatExchanger',
    is: ['equip'],
    doc: 'Equipment to transfer heat between fluids'
  },
  {
    id: 'damper',
    def: 'damper',
    is: ['equip'],
    doc: 'Device to regulate air flow'
  },
  {
    id: 'valve',
    def: 'valve',
    is: ['equip'],
    doc: 'Device to regulate fluid flow'
  },
  {
    id: 'filter',
    def: 'filter',
    is: ['equip'],
    doc: 'Device to remove particles'
  },

  // More Point Types
  {
    id: 'power',
    def: 'power',
    is: ['point'],
    doc: 'Power measurement'
  },
  {
    id: 'energy',
    def: 'energy',
    is: ['point'],
    doc: 'Energy measurement'
  },
  {
    id: 'humidity',
    def: 'humidity',
    is: ['point'],
    doc: 'Humidity measurement'
  },
  {
    id: 'co2',
    def: 'co2',
    is: ['point'],
    doc: 'Carbon dioxide measurement'
  },
  {
    id: 'occupancy',
    def: 'occupancy',
    is: ['point'],
    doc: 'Occupancy status or count'
  },
  {
    id: 'speed',
    def: 'speed',
    is: ['point'],
    doc: 'Speed measurement or setpoint'
  },
  {
    id: 'freq',
    def: 'freq',
    is: ['point'],
    doc: 'Frequency measurement'
  },
  {
    id: 'volt',
    def: 'volt',
    is: ['point'],
    doc: 'Voltage measurement'
  },
  {
    id: 'current',
    def: 'current',
    is: ['point'],
    doc: 'Current measurement'
  },

  // System Types
  {
    id: 'hvac',
    def: 'hvac',
    is: ['marker'],
    doc: 'Heating, ventilation, and air conditioning'
  },
  {
    id: 'lighting',
    def: 'lighting',
    is: ['marker'],
    doc: 'Lighting system'
  },
  {
    id: 'weatherStation',
    def: 'weatherStation',
    is: ['equip'],
    doc: 'Weather monitoring equipment'
  },

  // Additional functional markers
  {
    id: 'primary',
    def: 'primary',
    is: ['marker'],
    doc: 'Primary equipment in system'
  },
  {
    id: 'secondary',
    def: 'secondary',
    is: ['marker'],
    doc: 'Secondary or backup equipment'
  },
  {
    id: 'isolation',
    def: 'isolation',
    is: ['marker'],
    doc: 'Isolation valve or damper'
  },
  {
    id: 'bypass',
    def: 'bypass',
    is: ['marker'],
    doc: 'Bypass valve or damper'
  },
  {
    id: 'min',
    def: 'min',
    is: ['marker'],
    doc: 'Minimum value or position'
  },
  {
    id: 'max',
    def: 'max',
    is: ['marker'],
    doc: 'Maximum value or position'
  },
  {
    id: 'effective',
    def: 'effective',
    is: ['marker'],
    doc: 'Effective setpoint (calculated)'
  },
  {
    id: 'occ',
    def: 'occ',
    is: ['marker'],
    doc: 'Occupied mode'
  },
  {
    id: 'unocc',
    def: 'unocc',
    is: ['marker'],
    doc: 'Unoccupied mode'
  },
  {
    id: 'standby',
    def: 'standby',
    is: ['marker'],
    doc: 'Standby mode'
  },

  // Equipment status
  {
    id: 'fault',
    def: 'fault',
    is: ['point'],
    doc: 'Fault or error condition'
  },
  {
    id: 'maintenance',
    def: 'maintenance',
    is: ['point'],
    doc: 'Maintenance required indicator'
  },

  // VFD related
  {
    id: 'vfd',
    def: 'vfd',
    is: ['equip'],
    doc: 'Variable frequency drive'
  },

  // Scheduling
  {
    id: 'schedule',
    def: 'schedule',
    is: ['point'],
    doc: 'Schedule point'
  },

  // Valve and damper positions
  {
    id: 'position',
    def: 'position',
    is: ['point'],
    doc: 'Position feedback (0-100%)'
  },

  // Weather
  {
    id: 'weatherCond',
    def: 'weatherCond',
    is: ['point'],
    doc: 'Weather conditions'
  },
  {
    id: 'precipitation',
    def: 'precipitation',
    is: ['point'],
    doc: 'Precipitation measurement'
  },
  {
    id: 'wind',
    def: 'wind',
    is: ['point'],
    doc: 'Wind measurement'
  },
  {
    id: 'solar',
    def: 'solar',
    is: ['point'],
    doc: 'Solar radiation'
  },

  // Cooling/heating plant
  {
    id: 'chilledWaterPlant',
    def: 'chilledWaterPlant',
    is: ['equip'],
    doc: 'Chilled water plant system'
  },
  {
    id: 'hotWaterPlant',
    def: 'hotWaterPlant',
    is: ['equip'],
    doc: 'Hot water plant system'
  },
  {
    id: 'steamPlant',
    def: 'steamPlant',
    is: ['equip'],
    doc: 'Steam plant system'
  },

  // Additional sensors
  {
    id: 'dewPoint',
    def: 'dewPoint',
    is: ['point'],
    doc: 'Dew point temperature'
  },
  {
    id: 'enthalpy',
    def: 'enthalpy',
    is: ['point'],
    doc: 'Enthalpy measurement'
  },

  // Control modes
  {
    id: 'auto',
    def: 'auto',
    is: ['marker'],
    doc: 'Automatic mode'
  },
  {
    id: 'manual',
    def: 'manual',
    is: ['marker'],
    doc: 'Manual mode'
  }
];

/**
 * Helper function to get unit by symbol
 */
export function getUnitBySymbol(symbol: string): HaystackUnit | undefined {
  return HAYSTACK_UNITS.find(u => u.symbol === symbol);
}

/**
 * Helper function to get definition by id
 */
export function getDefinitionById(id: string): HaystackDefinition | undefined {
  return HAYSTACK_DEFINITIONS.find(d => d.id === id);
}

/**
 * Helper function to get all definitions of a specific type
 */
export function getDefinitionsByType(type: string): HaystackDefinition[] {
  return HAYSTACK_DEFINITIONS.filter(d => d.is.includes(type));
}

/**
 * Helper function to get all units of a specific quantity
 */
export function getUnitsByQuantity(quantity: string): HaystackUnit[] {
  return HAYSTACK_UNITS.filter(u => u.quantity === quantity);
}
