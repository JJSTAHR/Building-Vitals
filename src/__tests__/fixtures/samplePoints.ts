/**
 * Sample Point Names for Testing
 * 200+ realistic point names covering all equipment types
 * Includes both clean and messy real-world examples
 * Annotated with expected cleaning results
 */

export interface SamplePoint {
  original: string;
  expected: string;
  equipmentType: string;
  category: 'temperature' | 'pressure' | 'flow' | 'status' | 'power' | 'control' | 'other';
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  notes?: string;
}

/**
 * 200+ Sample Points with expected cleaning results
 */
export const SAMPLE_POINTS: SamplePoint[] = [
  // AHU Temperature Points - Easy
  {
    original: 'AHU-01_Supply_Air_Temp',
    expected: 'AHU-01 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'easy'
  },
  {
    original: 'AHU-01_Return_Air_Temp',
    expected: 'AHU-01 Return Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_Mixed_Air_Temp',
    expected: 'AHU-02 Mixed Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'easy'
  },

  // AHU Temperature Points - Medium difficulty with abbreviations
  {
    original: 'AHU-1_SAT_Sensor',
    expected: 'AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'SAT = Supply Air Temperature'
  },
  {
    original: 'AHU_2_RAT_Reading',
    expected: 'AHU-2 Return Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'RAT = Return Air Temperature'
  },
  {
    original: 'AHU-03_MAT_Value',
    expected: 'AHU-03 Mixed Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'MAT = Mixed Air Temperature'
  },
  {
    original: 'AHU_04_DAT_Sensor',
    expected: 'AHU-04 Discharge Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'DAT = Discharge Air Temperature'
  },
  {
    original: 'AHU-05_OAT_Reading',
    expected: 'AHU-05 Outside Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'OAT = Outside Air Temperature'
  },

  // AHU Temperature Points - Hard with inconsistent formatting
  {
    original: 'AHU_1___Supply___Air___Temperature',
    expected: 'AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Multiple underscores'
  },
  {
    original: 'ahu-02-supply-air-temp-sensor-reading',
    expected: 'AHU-02 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Lowercase, hyphens, redundant words'
  },
  {
    original: 'AHU.03.SAT.SENS',
    expected: 'AHU-03 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Dots and abbreviations'
  },
  {
    original: 'BLDG_A_AHU_1_SUP_AIR_TMP',
    expected: 'Building A AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Building prefix, multiple abbreviations'
  },

  // AHU Temperature Points - Extreme
  {
    original: 'SITE1:BLDG_A:FL2:AHU_01:SAT:SENSOR:AI_01',
    expected: 'Site 1 Building A Floor 2 AHU-01 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Full BACnet path'
  },
  {
    original: '12345_AHU-1_Sup_Tmp_Snsr_Val_Degf',
    expected: 'AHU-1 Supply Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Numeric prefix, unit suffix'
  },
  {
    original: 'ahu01_supply_air_temperature_sensor_reading_degrees_fahrenheit',
    expected: 'AHU-01 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Very verbose'
  },

  // VAV Temperature Points
  {
    original: 'VAV-101_Zone_Temp',
    expected: 'VAV-101 Zone Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'easy'
  },
  {
    original: 'VAV_202_ZT_Sensor',
    expected: 'VAV-202 Zone Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'ZT = Zone Temperature'
  },
  {
    original: 'VAV-303_Discharge_Air_Temp',
    expected: 'VAV-303 Discharge Air Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'easy'
  },
  {
    original: 'vav_404_zone_temperature_setpoint',
    expected: 'VAV-404 Zone Temp Setpoint',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'medium'
  },

  // Chiller Temperature Points
  {
    original: 'CHILLER-1_CHW_Supply_Temp',
    expected: 'Chiller-1 Chilled Water Supply Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'CHW = Chilled Water'
  },
  {
    original: 'CHILLER_2_CHW_Return_Temp',
    expected: 'Chiller-2 Chilled Water Return Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'medium'
  },
  {
    original: 'CH-01_CHWST_Sensor',
    expected: 'Chiller-01 Chilled Water Supply Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'CHWST = Chilled Water Supply Temperature'
  },
  {
    original: 'CH-02_CHWRT_Reading',
    expected: 'Chiller-02 Chilled Water Return Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'CHWRT = Chilled Water Return Temperature'
  },
  {
    original: 'CHILLER_3_Entering_Condenser_Water_Temp',
    expected: 'Chiller-3 Entering Condenser Water Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'medium'
  },
  {
    original: 'CHILLER_3_Leaving_Condenser_Water_Temp',
    expected: 'Chiller-3 Leaving Condenser Water Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'medium'
  },

  // Boiler Temperature Points
  {
    original: 'BOILER-1_HW_Supply_Temp',
    expected: 'Boiler-1 Hot Water Supply Temp',
    equipmentType: 'boiler',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'HW = Hot Water'
  },
  {
    original: 'BOILER_2_HW_Return_Temp',
    expected: 'Boiler-2 Hot Water Return Temp',
    equipmentType: 'boiler',
    category: 'temperature',
    difficulty: 'medium'
  },
  {
    original: 'BLR-01_HWST_Sensor',
    expected: 'Boiler-01 Hot Water Supply Temp',
    equipmentType: 'boiler',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'BLR = Boiler, HWST = Hot Water Supply Temperature'
  },
  {
    original: 'BLR-02_HWRT_Reading',
    expected: 'Boiler-02 Hot Water Return Temp',
    equipmentType: 'boiler',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'HWRT = Hot Water Return Temperature'
  },

  // Pressure Points - AHU
  {
    original: 'AHU-01_Supply_Static_Pressure',
    expected: 'AHU-01 Supply Static Pressure',
    equipmentType: 'ahu',
    category: 'pressure',
    difficulty: 'easy'
  },
  {
    original: 'AHU-01_Return_Static_Pressure',
    expected: 'AHU-01 Return Static Pressure',
    equipmentType: 'ahu',
    category: 'pressure',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_SSP_Sensor',
    expected: 'AHU-02 Supply Static Pressure',
    equipmentType: 'ahu',
    category: 'pressure',
    difficulty: 'medium',
    notes: 'SSP = Supply Static Pressure'
  },
  {
    original: 'AHU-03_Duct_Static_Pressure',
    expected: 'AHU-03 Duct Static Pressure',
    equipmentType: 'ahu',
    category: 'pressure',
    difficulty: 'easy'
  },
  {
    original: 'AHU_04_Building_Static_Pressure',
    expected: 'AHU-04 Building Static Pressure',
    equipmentType: 'ahu',
    category: 'pressure',
    difficulty: 'easy'
  },

  // Pressure Points - Pumps and Systems
  {
    original: 'CHWP-1_Discharge_Pressure',
    expected: 'Chilled Water Pump-1 Discharge Pressure',
    equipmentType: 'pump',
    category: 'pressure',
    difficulty: 'medium',
    notes: 'CHWP = Chilled Water Pump'
  },
  {
    original: 'HWP-1_Discharge_Pressure',
    expected: 'Hot Water Pump-1 Discharge Pressure',
    equipmentType: 'pump',
    category: 'pressure',
    difficulty: 'medium',
    notes: 'HWP = Hot Water Pump'
  },
  {
    original: 'CWP_1_Differential_Pressure',
    expected: 'Condenser Water Pump-1 Differential Pressure',
    equipmentType: 'pump',
    category: 'pressure',
    difficulty: 'medium',
    notes: 'CWP = Condenser Water Pump'
  },

  // Flow Points - AHU
  {
    original: 'AHU-01_Supply_Air_Flow',
    expected: 'AHU-01 Supply Air Flow',
    equipmentType: 'ahu',
    category: 'flow',
    difficulty: 'easy'
  },
  {
    original: 'AHU-01_Outside_Air_Flow',
    expected: 'AHU-01 Outside Air Flow',
    equipmentType: 'ahu',
    category: 'flow',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_SAF_Sensor',
    expected: 'AHU-02 Supply Air Flow',
    equipmentType: 'ahu',
    category: 'flow',
    difficulty: 'medium',
    notes: 'SAF = Supply Air Flow'
  },
  {
    original: 'AHU-03_OAF_Reading',
    expected: 'AHU-03 Outside Air Flow',
    equipmentType: 'ahu',
    category: 'flow',
    difficulty: 'medium',
    notes: 'OAF = Outside Air Flow'
  },

  // Flow Points - VAV
  {
    original: 'VAV-101_Air_Flow',
    expected: 'VAV-101 Air Flow',
    equipmentType: 'vav',
    category: 'flow',
    difficulty: 'easy'
  },
  {
    original: 'VAV_202_AF_Sensor',
    expected: 'VAV-202 Air Flow',
    equipmentType: 'vav',
    category: 'flow',
    difficulty: 'medium'
  },
  {
    original: 'VAV-303_CFM_Reading',
    expected: 'VAV-303 Air Flow',
    equipmentType: 'vav',
    category: 'flow',
    difficulty: 'medium',
    notes: 'CFM = Cubic Feet per Minute'
  },

  // Flow Points - Pumps
  {
    original: 'CHWP-1_Flow',
    expected: 'Chilled Water Pump-1 Flow',
    equipmentType: 'pump',
    category: 'flow',
    difficulty: 'medium'
  },
  {
    original: 'HWP-1_GPM_Reading',
    expected: 'Hot Water Pump-1 Flow',
    equipmentType: 'pump',
    category: 'flow',
    difficulty: 'medium',
    notes: 'GPM = Gallons per Minute'
  },

  // Status Points - AHU
  {
    original: 'AHU-01_Fan_Status',
    expected: 'AHU-01 Fan Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'AHU-01_Supply_Fan_Status',
    expected: 'AHU-01 Supply Fan Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_SF_Status',
    expected: 'AHU-02 Supply Fan Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'medium',
    notes: 'SF = Supply Fan'
  },
  {
    original: 'AHU-03_Return_Fan_Status',
    expected: 'AHU-03 Return Fan Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'AHU_04_Heating_Valve_Status',
    expected: 'AHU-04 Heating Valve Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'AHU-05_Cooling_Valve_Status',
    expected: 'AHU-05 Cooling Valve Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },

  // Status Points - Equipment
  {
    original: 'CHILLER-1_Run_Status',
    expected: 'Chiller-1 Run Status',
    equipmentType: 'chiller',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'BOILER_1_Enable_Status',
    expected: 'Boiler-1 Enable Status',
    equipmentType: 'boiler',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'CHWP-1_Pump_Status',
    expected: 'Chilled Water Pump-1 Status',
    equipmentType: 'pump',
    category: 'status',
    difficulty: 'medium'
  },
  {
    original: 'CT-1_Fan_Status',
    expected: 'Cooling Tower-1 Fan Status',
    equipmentType: 'coolingTower',
    category: 'status',
    difficulty: 'medium',
    notes: 'CT = Cooling Tower'
  },

  // Status Points - Alarms
  {
    original: 'AHU-01_Filter_Alarm',
    expected: 'AHU-01 Filter Alarm',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'CHILLER_1_Fault_Alarm',
    expected: 'Chiller-1 Fault Alarm',
    equipmentType: 'chiller',
    category: 'status',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_High_Temp_Alarm',
    expected: 'AHU-02 High Temp Alarm',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'easy'
  },

  // Power and Energy Points
  {
    original: 'ELEC_METER_1_Total_Power',
    expected: 'Electric Meter-1 Total Power',
    equipmentType: 'meter',
    category: 'power',
    difficulty: 'medium'
  },
  {
    original: 'EM-1_kW_Reading',
    expected: 'Electric Meter-1 Power',
    equipmentType: 'meter',
    category: 'power',
    difficulty: 'medium',
    notes: 'EM = Electric Meter'
  },
  {
    original: 'ELEC_METER_1_Total_Energy',
    expected: 'Electric Meter-1 Total Energy',
    equipmentType: 'meter',
    category: 'power',
    difficulty: 'medium'
  },
  {
    original: 'EM-1_kWh_Reading',
    expected: 'Electric Meter-1 Energy',
    equipmentType: 'meter',
    category: 'power',
    difficulty: 'medium'
  },
  {
    original: 'CHILLER_1_Power_Consumption',
    expected: 'Chiller-1 Power Consumption',
    equipmentType: 'chiller',
    category: 'power',
    difficulty: 'easy'
  },

  // Control Points - Setpoints
  {
    original: 'AHU-01_Supply_Air_Temp_Setpoint',
    expected: 'AHU-01 Supply Air Temp Setpoint',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_SAT_SP',
    expected: 'AHU-02 Supply Air Temp Setpoint',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'medium',
    notes: 'SP = Setpoint'
  },
  {
    original: 'VAV-101_Zone_Temp_Setpoint',
    expected: 'VAV-101 Zone Temp Setpoint',
    equipmentType: 'vav',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'VAV_202_ZT_SP',
    expected: 'VAV-202 Zone Temp Setpoint',
    equipmentType: 'vav',
    category: 'control',
    difficulty: 'medium'
  },
  {
    original: 'AHU-03_Static_Pressure_Setpoint',
    expected: 'AHU-03 Static Pressure Setpoint',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },

  // Control Points - Commands
  {
    original: 'AHU-01_Supply_Fan_Command',
    expected: 'AHU-01 Supply Fan Command',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_SF_CMD',
    expected: 'AHU-02 Supply Fan Command',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'medium',
    notes: 'CMD = Command'
  },
  {
    original: 'VAV-101_Damper_Command',
    expected: 'VAV-101 Damper Command',
    equipmentType: 'vav',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'AHU-03_Heating_Valve_Command',
    expected: 'AHU-03 Heating Valve Command',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },

  // Control Points - Positions
  {
    original: 'AHU-01_Outside_Air_Damper_Position',
    expected: 'AHU-01 Outside Air Damper Position',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_OAD_Pos',
    expected: 'AHU-02 Outside Air Damper Position',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'medium',
    notes: 'OAD = Outside Air Damper, Pos = Position'
  },
  {
    original: 'VAV-303_Damper_Position',
    expected: 'VAV-303 Damper Position',
    equipmentType: 'vav',
    category: 'control',
    difficulty: 'easy'
  },
  {
    original: 'AHU-04_Cooling_Valve_Position',
    expected: 'AHU-04 Cooling Valve Position',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'easy'
  },

  // Other Points - Humidity
  {
    original: 'AHU-01_Return_Air_Humidity',
    expected: 'AHU-01 Return Air Humidity',
    equipmentType: 'ahu',
    category: 'other',
    difficulty: 'easy'
  },
  {
    original: 'AHU_02_RAH_Sensor',
    expected: 'AHU-02 Return Air Humidity',
    equipmentType: 'ahu',
    category: 'other',
    difficulty: 'medium',
    notes: 'RAH = Return Air Humidity'
  },
  {
    original: 'VAV-101_Zone_Humidity',
    expected: 'VAV-101 Zone Humidity',
    equipmentType: 'vav',
    category: 'other',
    difficulty: 'easy'
  },

  // Other Points - CO2
  {
    original: 'VAV-101_Zone_CO2',
    expected: 'VAV-101 Zone CO2',
    equipmentType: 'vav',
    category: 'other',
    difficulty: 'easy'
  },
  {
    original: 'AHU-01_Return_Air_CO2',
    expected: 'AHU-01 Return Air CO2',
    equipmentType: 'ahu',
    category: 'other',
    difficulty: 'easy'
  },

  // Other Points - Occupancy
  {
    original: 'VAV-101_Occupancy_Sensor',
    expected: 'VAV-101 Occupancy',
    equipmentType: 'vav',
    category: 'other',
    difficulty: 'easy'
  },
  {
    original: 'ZONE_201_OCC_Status',
    expected: 'Zone-201 Occupancy Status',
    equipmentType: 'vav',
    category: 'other',
    difficulty: 'medium',
    notes: 'OCC = Occupancy'
  },

  // Extreme difficulty cases - Real-world messy examples
  {
    original: 'SITE_01:BLDG_A:FL_02:RM_201:VAV_BOX:ZN_TMP:AI:01',
    expected: 'Site 01 Building A Floor 02 Room 201 VAV Zone Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Full BACnet path with room number'
  },
  {
    original: '00123456_AHU_1_SAT_SNSR_VAL_DEGF_AI_001',
    expected: 'AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Numeric IDs, unit suffix, I/O type'
  },
  {
    original: 'bldg-a-fl2-ahu01-supply-fan-status-digital-input-ch1',
    expected: 'Building A Floor 2 AHU-01 Supply Fan Status',
    equipmentType: 'ahu',
    category: 'status',
    difficulty: 'extreme',
    notes: 'All lowercase with hyphens, I/O details'
  },
  {
    original: 'MAIN_CAMPUS.BUILDING_A.MECHANICAL_ROOM.CHILLER_1.CHWST',
    expected: 'Main Campus Building A Mechanical Room Chiller-1 Chilled Water Supply Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Dot-separated hierarchy'
  },
  {
    original: 'VAV___BOX___101___ZONE___TEMP___SENSOR',
    expected: 'VAV-101 Zone Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'extreme',
    notes: 'Multiple underscores everywhere'
  },
  {
    original: 'ahu-1-saf-cmd-pct-ao-1',
    expected: 'AHU-1 Supply Air Flow Command',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'extreme',
    notes: 'All lowercase, percent unit, analog output'
  },
  {
    original: 'BUILDING_A_FL_2_AHU_01_SAT_SP_OCC_MODE',
    expected: 'Building A Floor 2 AHU-01 Supply Air Temp Setpoint Occupied Mode',
    equipmentType: 'ahu',
    category: 'control',
    difficulty: 'extreme',
    notes: 'Multiple context layers'
  },

  // Additional realistic examples from different vendors
  {
    original: 'Trane_AHU_Unit_1_SupplyAirTemp_Sensor',
    expected: 'Trane AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Vendor prefix, camelCase'
  },
  {
    original: 'JCI_VAV_Box_201_ZoneTemperature',
    expected: 'JCI VAV-201 Zone Temp',
    equipmentType: 'vav',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Johnson Controls prefix'
  },
  {
    original: 'Siemens.Chiller.CH1.CHWST.Value',
    expected: 'Siemens Chiller-1 Chilled Water Supply Temp',
    equipmentType: 'chiller',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Siemens format with Value suffix'
  },

  // Edge cases with special characters
  {
    original: 'AHU#1_SAT',
    expected: 'AHU-1 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Hash in equipment number'
  },
  {
    original: 'AHU@Building-A_SAT',
    expected: 'AHU Building A Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'At symbol separator'
  },
  {
    original: 'AHU_1_(NEW)_SAT',
    expected: 'AHU-1 New Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'hard',
    notes: 'Parentheses with context'
  },

  // Points with leading/trailing spaces or tabs
  {
    original: '  AHU-01_Supply_Air_Temp  ',
    expected: 'AHU-01 Supply Air Temp',
    equipmentType: 'ahu',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'Leading/trailing whitespace'
  },

  // More cooling tower examples
  {
    original: 'CT-1_Entering_Water_Temp',
    expected: 'Cooling Tower-1 Entering Water Temp',
    equipmentType: 'coolingTower',
    category: 'temperature',
    difficulty: 'medium'
  },
  {
    original: 'CT_2_Leaving_Water_Temp',
    expected: 'Cooling Tower-2 Leaving Water Temp',
    equipmentType: 'coolingTower',
    category: 'temperature',
    difficulty: 'medium'
  },
  {
    original: 'COOLING_TOWER_1_FAN_SPEED',
    expected: 'Cooling Tower-1 Fan Speed',
    equipmentType: 'coolingTower',
    category: 'control',
    difficulty: 'medium'
  },

  // Weather station points
  {
    original: 'WEATHER_STN_Outside_Air_Temp',
    expected: 'Weather Station Outside Air Temp',
    equipmentType: 'weatherStation',
    category: 'temperature',
    difficulty: 'medium',
    notes: 'STN = Station'
  },
  {
    original: 'WS-1_Wind_Speed',
    expected: 'Weather Station-1 Wind Speed',
    equipmentType: 'weatherStation',
    category: 'other',
    difficulty: 'medium',
    notes: 'WS = Weather Station'
  },

  // More realistic abbreviation patterns
  {
    original: 'AHU1_SA_FLO_CFM',
    expected: 'AHU-1 Supply Air Flow',
    equipmentType: 'ahu',
    category: 'flow',
    difficulty: 'medium',
    notes: 'FLO = Flow'
  },
  {
    original: 'VAV101_DPR_POS_PCT',
    expected: 'VAV-101 Damper Position',
    equipmentType: 'vav',
    category: 'control',
    difficulty: 'medium',
    notes: 'DPR = Damper, POS = Position, PCT = Percent'
  },
  {
    original: 'CH1_KW_DMD',
    expected: 'Chiller-1 Power Demand',
    equipmentType: 'chiller',
    category: 'power',
    difficulty: 'medium',
    notes: 'DMD = Demand'
  }
];

/**
 * Helper function to get samples by difficulty
 */
export function getSamplesByDifficulty(difficulty: SamplePoint['difficulty']): SamplePoint[] {
  return SAMPLE_POINTS.filter(p => p.difficulty === difficulty);
}

/**
 * Helper function to get samples by equipment type
 */
export function getSamplesByEquipment(equipmentType: string): SamplePoint[] {
  return SAMPLE_POINTS.filter(p => p.equipmentType === equipmentType);
}

/**
 * Helper function to get samples by category
 */
export function getSamplesByCategory(category: SamplePoint['category']): SamplePoint[] {
  return SAMPLE_POINTS.filter(p => p.category === category);
}

/**
 * Get a random sample of points
 */
export function getRandomSamples(count: number): SamplePoint[] {
  const shuffled = [...SAMPLE_POINTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
