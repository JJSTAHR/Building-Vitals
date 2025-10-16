/**
 * Building Automation Point Name Filters
 * Comprehensive list of BACnet and LonWorks technical abbreviations to remove from display names
 *
 * Purpose: Remove technical jargon and protocol-specific terms that end users don't need to see
 * in building automation system interfaces
 */

export const POINT_NAME_FILTERS = {

  // =============================================================================
  // LONWORKS NETWORK VARIABLE PREFIXES
  // =============================================================================
  lonworksNetworkVariables: [
    {
      pattern: /\bnvo\b/gi,
      explanation: "Network Variable Output - LonWorks output variable prefix",
      example: "nvoSpaceTemp → SpaceTemp"
    },
    {
      pattern: /\bnvi\b/gi,
      explanation: "Network Variable Input - LonWorks input variable prefix",
      example: "nviSetpoint → Setpoint"
    },
    {
      pattern: /\bnci\b/gi,
      explanation: "Network Configuration Input - LonWorks configuration input",
      example: "nciOccupancy → Occupancy"
    },
    {
      pattern: /\bnco\b/gi,
      explanation: "Network Configuration Output - LonWorks configuration output",
      example: "ncoAlarmStatus → AlarmStatus"
    },
    {
      pattern: /\bsnvt\b/gi,
      explanation: "Standard Network Variable Type - LonWorks type definition",
      example: "snvtTempP → Temp"
    },
    {
      pattern: /\bscpt\b/gi,
      explanation: "Standard Configuration Property Type - LonWorks config type",
      example: "scptLocation → Location"
    },
    {
      pattern: /\bunvt\b/gi,
      explanation: "User-defined Network Variable Type - Custom LonWorks type",
      example: "unvtCustomSensor → CustomSensor"
    },
    {
      pattern: /\bucpt\b/gi,
      explanation: "User-defined Configuration Property Type - Custom config type",
      example: "ucptSettings → Settings"
    }
  ],

  // =============================================================================
  // BACNET PROTOCOL PREFIXES AND TERMS
  // =============================================================================
  bacnetTerms: [
    {
      pattern: /\bbacnet\b/gi,
      explanation: "BACnet Protocol - Protocol identifier not needed in display",
      example: "BACnet_Room_Temp → Room_Temp"
    },
    {
      pattern: /\bmstp\b/gi,
      explanation: "Master-Slave/Token-Passing - BACnet network protocol type",
      example: "MSTP_Device_Status → Device_Status"
    },
    {
      pattern: /\bbip\b/gi,
      explanation: "BACnet/IP - BACnet over IP network protocol",
      example: "BIP_Controller → Controller"
    },
    {
      pattern: /\bbbmd\b/gi,
      explanation: "BACnet Broadcast Management Device - Network device type",
      example: "BBMD_Gateway → Gateway"
    },
    {
      pattern: /\bav\b/gi,
      explanation: "Analog Value - BACnet object type for analog values",
      example: "AV_Temperature → Temperature"
    },
    {
      pattern: /\bai\b/gi,
      explanation: "Analog Input - BACnet object type for analog inputs",
      example: "AI_Pressure → Pressure"
    },
    {
      pattern: /\bao\b/gi,
      explanation: "Analog Output - BACnet object type for analog outputs",
      example: "AO_DamperPosition → DamperPosition"
    },
    {
      pattern: /\bbv\b/gi,
      explanation: "Binary Value - BACnet object type for binary values",
      example: "BV_OccupancyStatus → OccupancyStatus"
    },
    {
      pattern: /\bbi\b/gi,
      explanation: "Binary Input - BACnet object type for binary inputs",
      example: "BI_DoorStatus → DoorStatus"
    },
    {
      pattern: /\bbo\b/gi,
      explanation: "Binary Output - BACnet object type for binary outputs",
      example: "BO_FanCommand → FanCommand"
    },
    {
      pattern: /\bmv\b/gi,
      explanation: "Multi-state Value - BACnet object type for multi-state values",
      example: "MV_ModeStatus → ModeStatus"
    },
    {
      pattern: /\bmi\b/gi,
      explanation: "Multi-state Input - BACnet object type for multi-state inputs",
      example: "MI_SystemMode → SystemMode"
    },
    {
      pattern: /\bmo\b/gi,
      explanation: "Multi-state Output - BACnet object type for multi-state outputs",
      example: "MO_ValveControl → ValveControl"
    },
    {
      pattern: /\bcov\b/gi,
      explanation: "Change of Value - BACnet notification service",
      example: "COV_Subscription → Subscription"
    },
    {
      pattern: /\bwho-?is\b/gi,
      explanation: "Who-Is - BACnet device discovery service",
      example: "WhoIs_Request → Request"
    },
    {
      pattern: /\bi-?am\b/gi,
      explanation: "I-Am - BACnet device announcement service",
      example: "IAm_Response → Response"
    }
  ],

  // =============================================================================
  // LOGIC OPERATION TERMS
  // =============================================================================
  logicOperations: [
    {
      pattern: /\band\b/gi,
      explanation: "AND Logic - Boolean AND operation",
      example: "Temp_AND_Humidity → Temp_Humidity"
    },
    {
      pattern: /\bor\b/gi,
      explanation: "OR Logic - Boolean OR operation",
      example: "Alarm_OR_Warning → Alarm_Warning"
    },
    {
      pattern: /\bnot\b/gi,
      explanation: "NOT Logic - Boolean NOT operation",
      example: "NOT_Occupied → Unoccupied"
    },
    {
      pattern: /\bxor\b/gi,
      explanation: "XOR Logic - Boolean exclusive OR operation",
      example: "Mode_XOR_Override → Mode_Override"
    },
    {
      pattern: /\bnand\b/gi,
      explanation: "NAND Logic - Boolean NOT AND operation",
      example: "NAND_Gate → Gate"
    },
    {
      pattern: /\bnor\b/gi,
      explanation: "NOR Logic - Boolean NOT OR operation",
      example: "NOR_Logic → Logic"
    },
    {
      pattern: /\bxnor\b/gi,
      explanation: "XNOR Logic - Boolean exclusive NOR operation",
      example: "XNOR_Output → Output"
    }
  ],

  // =============================================================================
  // COMMUNICATION PROTOCOL TERMS
  // =============================================================================
  communicationProtocols: [
    {
      pattern: /\blon\b/gi,
      explanation: "LonWorks - LonWorks protocol identifier",
      example: "LON_Network_Status → Network_Status"
    },
    {
      pattern: /\blonworks\b/gi,
      explanation: "LonWorks Protocol - Full protocol name",
      example: "LonWorks_Device → Device"
    },
    {
      pattern: /\bmodbus\b/gi,
      explanation: "Modbus Protocol - Serial communication protocol",
      example: "Modbus_Register → Register"
    },
    {
      pattern: /\brtu\b/gi,
      explanation: "Remote Terminal Unit - Modbus RTU protocol variant",
      example: "RTU_Controller → Controller"
    },
    {
      pattern: /\btcp\b/gi,
      explanation: "Transmission Control Protocol - Network protocol",
      example: "TCP_Connection → Connection"
    },
    {
      pattern: /\budp\b/gi,
      explanation: "User Datagram Protocol - Network protocol",
      example: "UDP_Broadcast → Broadcast"
    },
    {
      pattern: /\bip\b/gi,
      explanation: "Internet Protocol - Network layer protocol",
      example: "IP_Address → Address"
    },
    {
      pattern: /\brs485\b/gi,
      explanation: "RS-485 - Serial communication standard",
      example: "RS485_Bus → Bus"
    },
    {
      pattern: /\brs232\b/gi,
      explanation: "RS-232 - Serial communication standard",
      example: "RS232_Port → Port"
    },
    {
      pattern: /\beth\b/gi,
      explanation: "Ethernet - Network communication protocol",
      example: "ETH_Switch → Switch"
    },
    {
      pattern: /\bmqtt\b/gi,
      explanation: "Message Queuing Telemetry Transport - IoT protocol",
      example: "MQTT_Topic → Topic"
    },
    {
      pattern: /\bhttp\b/gi,
      explanation: "Hypertext Transfer Protocol - Web protocol",
      example: "HTTP_Request → Request"
    },
    {
      pattern: /\bsnmp\b/gi,
      explanation: "Simple Network Management Protocol - Network management",
      example: "SNMP_Trap → Trap"
    }
  ],

  // =============================================================================
  // CONTROL SYSTEM PREFIXES
  // =============================================================================
  controlSystemPrefixes: [
    {
      pattern: /\bpid\b/gi,
      explanation: "Proportional-Integral-Derivative - Control algorithm",
      example: "PID_Loop → Loop"
    },
    {
      pattern: /\bsetpt\b/gi,
      explanation: "Setpoint - Control target value abbreviation",
      example: "SetPt_Temp → Temp_Setpoint"
    },
    {
      pattern: /\bsp\b/gi,
      explanation: "Setpoint - Abbreviated setpoint prefix",
      example: "SP_Value → Setpoint_Value"
    },
    {
      pattern: /\bpv\b/gi,
      explanation: "Process Variable - Current measured value",
      example: "PV_Temperature → Temperature"
    },
    {
      pattern: /\bcv\b/gi,
      explanation: "Control Variable - Controller output value",
      example: "CV_Output → Output"
    },
    {
      pattern: /\bfb\b/gi,
      explanation: "Feedback - Feedback signal abbreviation",
      example: "FB_Signal → Feedback_Signal"
    },
    {
      pattern: /\bcmd\b/gi,
      explanation: "Command - Control command abbreviation",
      example: "CMD_Start → Start_Command"
    },
    {
      pattern: /\bsts\b/gi,
      explanation: "Status - Status indicator abbreviation",
      example: "STS_Running → Running_Status"
    },
    {
      pattern: /\balm\b/gi,
      explanation: "Alarm - Alarm indicator abbreviation",
      example: "ALM_High → High_Alarm"
    },
    {
      pattern: /\benb\b/gi,
      explanation: "Enable - Enable signal abbreviation",
      example: "ENB_Control → Control_Enable"
    },
    {
      pattern: /\bocc\b/gi,
      explanation: "Occupancy - Occupancy status abbreviation",
      example: "OCC_Status → Occupancy_Status"
    },
    {
      pattern: /\bunocc\b/gi,
      explanation: "Unoccupied - Unoccupied status abbreviation",
      example: "UNOCC_Mode → Unoccupied_Mode"
    }
  ],

  // =============================================================================
  // HVAC SYSTEM ABBREVIATIONS
  // =============================================================================
  hvacAbbreviations: [
    {
      pattern: /\bahu\b/gi,
      explanation: "Air Handling Unit - HVAC equipment type",
      example: "AHU_Status → Air_Handler_Status"
    },
    {
      pattern: /\bvav\b/gi,
      explanation: "Variable Air Volume - Terminal unit type",
      example: "VAV_Damper → VAV_Box_Damper"
    },
    {
      pattern: /\bfcu\b/gi,
      explanation: "Fan Coil Unit - HVAC equipment type",
      example: "FCU_Speed → Fan_Coil_Speed"
    },
    {
      pattern: /\bvfd\b/gi,
      explanation: "Variable Frequency Drive - Motor control device",
      example: "VFD_Speed → Drive_Speed"
    },
    {
      pattern: /\bchwp\b/gi,
      explanation: "Chilled Water Pump - Pump type abbreviation",
      example: "CHWP_Status → Chilled_Water_Pump_Status"
    },
    {
      pattern: /\bhhwp\b/gi,
      explanation: "Hot Water Pump - Pump type abbreviation",
      example: "HHWP_Command → Hot_Water_Pump_Command"
    },
    {
      pattern: /\bcws\b/gi,
      explanation: "Chilled Water Supply - Water system abbreviation",
      example: "CWS_Temp → Chilled_Water_Supply_Temp"
    },
    {
      pattern: /\bcwr\b/gi,
      explanation: "Chilled Water Return - Water system abbreviation",
      example: "CWR_Temp → Chilled_Water_Return_Temp"
    },
    {
      pattern: /\bhws\b/gi,
      explanation: "Hot Water Supply - Water system abbreviation",
      example: "HWS_Temp → Hot_Water_Supply_Temp"
    },
    {
      pattern: /\bhwr\b/gi,
      explanation: "Hot Water Return - Water system abbreviation",
      example: "HWR_Temp → Hot_Water_Return_Temp"
    },
    {
      pattern: /\bdat\b/gi,
      explanation: "Discharge Air Temperature - Air measurement point",
      example: "DAT_Sensor → Discharge_Air_Temp"
    },
    {
      pattern: /\bsat\b/gi,
      explanation: "Supply Air Temperature - Air measurement point",
      example: "SAT_Value → Supply_Air_Temp"
    },
    {
      pattern: /\brat\b/gi,
      explanation: "Return Air Temperature - Air measurement point",
      example: "RAT_Reading → Return_Air_Temp"
    },
    {
      pattern: /\boat\b/gi,
      explanation: "Outside Air Temperature - Air measurement point",
      example: "OAT_Sensor → Outside_Air_Temp"
    },
    {
      pattern: /\bmat\b/gi,
      explanation: "Mixed Air Temperature - Air measurement point",
      example: "MAT_Value → Mixed_Air_Temp"
    }
  ],

  // =============================================================================
  // MEASUREMENT AND UNIT PREFIXES
  // =============================================================================
  measurementPrefixes: [
    {
      pattern: /\bppm\b/gi,
      explanation: "Parts Per Million - Concentration measurement (keep if needed)",
      example: "CO2_PPM → CO2_Level"
    },
    {
      pattern: /\brpm\b/gi,
      explanation: "Revolutions Per Minute - Speed measurement (keep if needed)",
      example: "Fan_RPM → Fan_Speed"
    },
    {
      pattern: /\bcfm\b/gi,
      explanation: "Cubic Feet per Minute - Flow measurement (keep if needed)",
      example: "Airflow_CFM → Airflow"
    },
    {
      pattern: /\bgpm\b/gi,
      explanation: "Gallons Per Minute - Flow measurement (keep if needed)",
      example: "Water_GPM → Water_Flow"
    },
    {
      pattern: /\bkw\b/gi,
      explanation: "Kilowatts - Power measurement (keep if needed)",
      example: "Power_KW → Power"
    },
    {
      pattern: /\bpsi\b/gi,
      explanation: "Pounds per Square Inch - Pressure measurement (keep if needed)",
      example: "Pressure_PSI → Pressure"
    }
  ],

  // =============================================================================
  // DEVICE AND NODE IDENTIFIERS
  // =============================================================================
  deviceIdentifiers: [
    {
      pattern: /\bdev\b/gi,
      explanation: "Device - Device identifier prefix",
      example: "DEV_001_Temp → 001_Temp"
    },
    {
      pattern: /\bnode\b/gi,
      explanation: "Node - Network node identifier",
      example: "Node_Status → Status"
    },
    {
      pattern: /\bobj\b/gi,
      explanation: "Object - Object identifier prefix",
      example: "OBJ_Temperature → Temperature"
    },
    {
      pattern: /\binst\b/gi,
      explanation: "Instance - Instance identifier",
      example: "INST_001 → 001"
    },
    {
      pattern: /\baddr\b/gi,
      explanation: "Address - Network or device address",
      example: "ADDR_Controller → Controller"
    },
    {
      pattern: /\bid\b/gi,
      explanation: "Identifier - Generic ID prefix",
      example: "ID_Sensor → Sensor"
    },
    {
      pattern: /\buid\b/gi,
      explanation: "Unique Identifier - Unique ID prefix",
      example: "UID_Device → Device"
    },
    {
      pattern: /\bguid\b/gi,
      explanation: "Globally Unique Identifier - Global ID",
      example: "GUID_Point → Point"
    }
  ],

  // =============================================================================
  // PROGRAMMING AND CONFIGURATION TERMS
  // =============================================================================
  programmingTerms: [
    {
      pattern: /\bvar\b/gi,
      explanation: "Variable - Programming variable declaration",
      example: "VAR_Temperature → Temperature"
    },
    {
      pattern: /\bparam\b/gi,
      explanation: "Parameter - Configuration parameter",
      example: "PARAM_Setpoint → Setpoint"
    },
    {
      pattern: /\bprop\b/gi,
      explanation: "Property - Object property",
      example: "PROP_Value → Value"
    },
    {
      pattern: /\battr\b/gi,
      explanation: "Attribute - Object attribute",
      example: "ATTR_Status → Status"
    },
    {
      pattern: /\bval\b/gi,
      explanation: "Value - Value indicator",
      example: "VAL_Temp → Temp"
    },
    {
      pattern: /\breg\b/gi,
      explanation: "Register - Data register",
      example: "REG_Data → Data"
    },
    {
      pattern: /\bbit\b/gi,
      explanation: "Bit - Binary bit indicator",
      example: "BIT_Flag → Flag"
    },
    {
      pattern: /\bflag\b/gi,
      explanation: "Flag - Status flag indicator",
      example: "FLAG_Active → Active"
    },
    {
      pattern: /\bptr\b/gi,
      explanation: "Pointer - Memory pointer",
      example: "PTR_Reference → Reference"
    },
    {
      pattern: /\bref\b/gi,
      explanation: "Reference - Object reference",
      example: "REF_Point → Point"
    }
  ],

  // =============================================================================
  // TIME AND SCHEDULING TERMS
  // =============================================================================
  timeSchedulingTerms: [
    {
      pattern: /\bsch\b/gi,
      explanation: "Schedule - Schedule abbreviation",
      example: "SCH_Occupancy → Occupancy_Schedule"
    },
    {
      pattern: /\btod\b/gi,
      explanation: "Time of Day - Time-based scheduling",
      example: "TOD_Override → Time_Override"
    },
    {
      pattern: /\bcal\b/gi,
      explanation: "Calendar - Calendar event",
      example: "CAL_Holiday → Holiday"
    },
    {
      pattern: /\btmr\b/gi,
      explanation: "Timer - Timer function",
      example: "TMR_Delay → Delay_Timer"
    },
    {
      pattern: /\bdly\b/gi,
      explanation: "Delay - Time delay",
      example: "DLY_Start → Start_Delay"
    }
  ],

  // =============================================================================
  // SYSTEM STATE AND MODE TERMS
  // =============================================================================
  systemStateTerms: [
    {
      pattern: /\bauto\b/gi,
      explanation: "Automatic - Automatic mode (contextual)",
      example: "AUTO_Mode → Automatic_Mode"
    },
    {
      pattern: /\bman\b/gi,
      explanation: "Manual - Manual mode abbreviation",
      example: "MAN_Override → Manual_Override"
    },
    {
      pattern: /\bovr\b/gi,
      explanation: "Override - Override status abbreviation",
      example: "OVR_Active → Override_Active"
    },
    {
      pattern: /\boff\b/gi,
      explanation: "Off - Off state (usually keep)",
      example: "OFF_Status → Off"
    },
    {
      pattern: /\bon\b/gi,
      explanation: "On - On state (usually keep)",
      example: "ON_Status → On"
    },
    {
      pattern: /\brun\b/gi,
      explanation: "Run - Running state",
      example: "RUN_Status → Running"
    },
    {
      pattern: /\bstop\b/gi,
      explanation: "Stop - Stopped state",
      example: "STOP_Command → Stop"
    },
    {
      pattern: /\bfault\b/gi,
      explanation: "Fault - Fault condition (usually keep)",
      example: "FLT_Status → Fault_Status"
    },
    {
      pattern: /\berr\b/gi,
      explanation: "Error - Error condition",
      example: "ERR_Code → Error_Code"
    }
  ]
};

/**
 * Flattened array of all filter patterns for easy iteration
 */
export const ALL_FILTER_PATTERNS = Object.values(POINT_NAME_FILTERS)
  .flat()
  .map(item => ({
    pattern: item.pattern,
    explanation: item.explanation,
    example: item.example
  }));

/**
 * Function to apply all filters to a point name
 * @param {string} pointName - The original point name
 * @param {Object} options - Filter options
 * @returns {string} - Cleaned point name
 */
export function cleanPointName(pointName, options = {}) {
  const {
    preserveUnits = true,  // Keep units like CFM, PSI, RPM
    preserveStates = true,  // Keep ON/OFF, RUN/STOP
    customExclusions = []   // Additional patterns to exclude from filtering
  } = options;

  let cleaned = pointName;

  // Apply each filter category
  Object.entries(POINT_NAME_FILTERS).forEach(([category, filters]) => {
    // Skip certain categories based on options
    if (preserveUnits && category === 'measurementPrefixes') return;
    if (preserveStates && category === 'systemStateTerms') return;

    filters.forEach(({ pattern }) => {
      // Check if pattern is in custom exclusions
      const isExcluded = customExclusions.some(exclusion =>
        pattern.source === exclusion.source
      );

      if (!isExcluded) {
        cleaned = cleaned.replace(pattern, '');
      }
    });
  });

  // Clean up extra spaces and underscores
  cleaned = cleaned
    .replace(/\s+/g, ' ')           // Multiple spaces to single
    .replace(/_+/g, '_')            // Multiple underscores to single
    .replace(/^[_\s]+|[_\s]+$/g, '') // Trim leading/trailing
    .trim();

  return cleaned;
}

/**
 * Batch process multiple point names
 * @param {string[]} pointNames - Array of point names
 * @param {Object} options - Filter options
 * @returns {Object[]} - Array of objects with original and cleaned names
 */
export function batchCleanPointNames(pointNames, options = {}) {
  return pointNames.map(original => ({
    original,
    cleaned: cleanPointName(original, options),
    modified: original !== cleanPointName(original, options)
  }));
}

export default POINT_NAME_FILTERS;
