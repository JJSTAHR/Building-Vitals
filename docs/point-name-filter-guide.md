# Building Automation Point Name Filter Guide

## Overview

This guide documents the comprehensive filtering system for removing technical abbreviations and protocol-specific terms from building automation point display names. The goal is to make point names more user-friendly for building operators and facility managers.

## Why Filter Point Names?

Building automation systems (BAS) often expose technical implementation details in point names that are:
- **Confusing** for end users who don't need to know protocol details
- **Cluttered** with network variable prefixes and communication terms
- **Inconsistent** across different equipment vendors and protocols
- **Unhelpful** for operators trying to quickly identify and control building systems

## Filter Categories

### 1. LonWorks Network Variable Prefixes

LonWorks devices use specific prefixes to denote variable types and directions:

| Prefix | Full Name | Purpose | Example |
|--------|-----------|---------|---------|
| `nvo` | Network Variable Output | Output from device | `nvoSpaceTemp` → `SpaceTemp` |
| `nvi` | Network Variable Input | Input to device | `nviSetpoint` → `Setpoint` |
| `nci` | Network Configuration Input | Config input | `nciOccupancy` → `Occupancy` |
| `nco` | Network Configuration Output | Config output | `ncoAlarmStatus` → `AlarmStatus` |
| `snvt` | Standard Network Variable Type | Standard type | `snvtTempP` → `Temp` |
| `scpt` | Standard Config Property Type | Standard config | `scptLocation` → `Location` |
| `unvt` | User Network Variable Type | Custom type | `unvtCustomSensor` → `CustomSensor` |
| `ucpt` | User Config Property Type | Custom config | `ucptSettings` → `Settings` |

**Why Remove**: End users don't need to know the variable direction or type classification. They only need to see what the point represents.

### 2. BACnet Protocol Terms

BACnet uses object types and protocol-specific identifiers:

#### Object Type Prefixes

| Prefix | Full Name | Purpose | Example |
|--------|-----------|---------|---------|
| `AI` | Analog Input | Analog input object | `AI_Pressure` → `Pressure` |
| `AO` | Analog Output | Analog output object | `AO_DamperPosition` → `DamperPosition` |
| `AV` | Analog Value | Analog value object | `AV_Temperature` → `Temperature` |
| `BI` | Binary Input | Binary input object | `BI_DoorStatus` → `DoorStatus` |
| `BO` | Binary Output | Binary output object | `BO_FanCommand` → `FanCommand` |
| `BV` | Binary Value | Binary value object | `BV_OccupancyStatus` → `OccupancyStatus` |
| `MI` | Multi-state Input | Multi-state input | `MI_SystemMode` → `SystemMode` |
| `MO` | Multi-state Output | Multi-state output | `MO_ValveControl` → `ValveControl` |
| `MV` | Multi-state Value | Multi-state value | `MV_ModeStatus` → `ModeStatus` |

#### Network Protocol Terms

| Term | Full Name | Purpose | Example |
|------|-----------|---------|---------|
| `MSTP` | Master-Slave/Token-Passing | Network type | `MSTP_Device_Status` → `Device_Status` |
| `BIP` | BACnet/IP | IP-based BACnet | `BIP_Controller` → `Controller` |
| `BBMD` | BACnet Broadcast Mgmt Device | Network device | `BBMD_Gateway` → `Gateway` |
| `COV` | Change of Value | Notification service | `COV_Subscription` → `Subscription` |

**Why Remove**: The object type and network protocol are implementation details. Users care about what's being measured or controlled, not how it's implemented.

### 3. Logic Operation Terms

Boolean and logic operations embedded in point names:

| Term | Operation | Example |
|------|-----------|---------|
| `AND` | Boolean AND | `Temp_AND_Humidity` → `Temp_Humidity` |
| `OR` | Boolean OR | `Alarm_OR_Warning` → `Alarm_Warning` |
| `NOT` | Boolean NOT | `NOT_Occupied` → `Unoccupied` |
| `XOR` | Exclusive OR | `Mode_XOR_Override` → `Mode_Override` |
| `NAND` | NOT AND | `NAND_Gate` → `Gate` |
| `NOR` | NOT OR | `NOR_Logic` → `Logic` |
| `XNOR` | Exclusive NOR | `XNOR_Output` → `Output` |

**Why Remove**: Logic operations should be transparent to users. They need to see the result, not the computation method.

### 4. Communication Protocol Terms

Various communication protocols and standards:

| Protocol | Full Name | Example |
|----------|-----------|---------|
| `LON`/`LonWorks` | Local Operating Network | `LON_Network_Status` → `Network_Status` |
| `Modbus` | Modbus Protocol | `Modbus_Register` → `Register` |
| `RTU` | Remote Terminal Unit | `RTU_Controller` → `Controller` |
| `TCP`/`UDP` | Network Protocols | `TCP_Connection` → `Connection` |
| `RS485`/`RS232` | Serial Standards | `RS485_Bus` → `Bus` |
| `MQTT` | Message Queue Protocol | `MQTT_Topic` → `Topic` |
| `SNMP` | Network Mgmt Protocol | `SNMP_Trap` → `Trap` |

**Why Remove**: Communication methods are infrastructure details irrelevant to building operation.

### 5. Control System Prefixes

Common control system abbreviations:

| Prefix | Full Name | Purpose | Example |
|--------|-----------|---------|---------|
| `PID` | Proportional-Integral-Derivative | Control algorithm | `PID_Loop` → `Loop` |
| `SP`/`SetPt` | Setpoint | Target value | `SP_Value` → `Setpoint_Value` |
| `PV` | Process Variable | Measured value | `PV_Temperature` → `Temperature` |
| `CV` | Control Variable | Output value | `CV_Output` → `Output` |
| `FB` | Feedback | Feedback signal | `FB_Signal` → `Feedback_Signal` |
| `CMD` | Command | Control command | `CMD_Start` → `Start_Command` |
| `STS` | Status | Status indicator | `STS_Running` → `Running_Status` |
| `ALM` | Alarm | Alarm indicator | `ALM_High` → `High_Alarm` |
| `ENB` | Enable | Enable signal | `ENB_Control` → `Control_Enable` |
| `OCC`/`UNOCC` | Occupancy | Occupancy status | `OCC_Status` → `Occupancy_Status` |

**Why Remove**: These technical control terms should be replaced with clear, descriptive language.

### 6. HVAC System Abbreviations

Industry-standard HVAC abbreviations that may need context:

| Abbreviation | Full Name | Keep/Remove | Notes |
|--------------|-----------|-------------|-------|
| `AHU` | Air Handling Unit | **Keep** | Well-known in industry |
| `VAV` | Variable Air Volume | **Keep** | Common terminology |
| `FCU` | Fan Coil Unit | **Keep** | Standard equipment name |
| `VFD` | Variable Frequency Drive | **Keep** | Important for maintenance |
| `CHWP` | Chilled Water Pump | **Expand** | → `Chilled_Water_Pump` |
| `HHWP` | Hot Water Pump | **Expand** | → `Hot_Water_Pump` |
| `CWS`/`CWR` | Chilled Water Supply/Return | **Expand** | → `Chilled_Water_Supply` |
| `HWS`/`HWR` | Hot Water Supply/Return | **Expand** | → `Hot_Water_Supply` |
| `DAT` | Discharge Air Temperature | **Expand** | → `Discharge_Air_Temp` |
| `SAT` | Supply Air Temperature | **Expand** | → `Supply_Air_Temp` |
| `RAT` | Return Air Temperature | **Expand** | → `Return_Air_Temp` |
| `OAT` | Outside Air Temperature | **Expand** | → `Outside_Air_Temp` |
| `MAT` | Mixed Air Temperature | **Expand** | → `Mixed_Air_Temp` |

**Why Expand**: While HVAC professionals know these terms, they should be spelled out for clarity in user interfaces.

### 7. Device and Node Identifiers

Generic device and network identifiers:

| Prefix | Full Name | Example |
|--------|-----------|---------|
| `DEV` | Device | `DEV_001_Temp` → `001_Temp` |
| `NODE` | Node | `Node_Status` → `Status` |
| `OBJ` | Object | `OBJ_Temperature` → `Temperature` |
| `INST` | Instance | `INST_001` → `001` |
| `ADDR` | Address | `ADDR_Controller` → `Controller` |
| `ID`/`UID`/`GUID` | Identifier | `ID_Sensor` → `Sensor` |

**Why Remove**: Internal system identifiers add no value to user-facing names.

### 8. Programming and Configuration Terms

Software development and configuration terms:

| Term | Full Name | Example |
|------|-----------|---------|
| `VAR` | Variable | `VAR_Temperature` → `Temperature` |
| `PARAM` | Parameter | `PARAM_Setpoint` → `Setpoint` |
| `PROP` | Property | `PROP_Value` → `Value` |
| `ATTR` | Attribute | `ATTR_Status` → `Status` |
| `VAL` | Value | `VAL_Temp` → `Temp` |
| `REG` | Register | `REG_Data` → `Data` |
| `BIT`/`FLAG` | Binary indicators | `BIT_Flag` → `Flag` |
| `PTR`/`REF` | Pointer/Reference | `PTR_Reference` → `Reference` |

**Why Remove**: Programming concepts should not appear in user interfaces.

### 9. Time and Scheduling Terms

Time-related abbreviations:

| Term | Full Name | Example |
|------|-----------|---------|
| `SCH` | Schedule | `SCH_Occupancy` → `Occupancy_Schedule` |
| `TOD` | Time of Day | `TOD_Override` → `Time_Override` |
| `CAL` | Calendar | `CAL_Holiday` → `Holiday` |
| `TMR` | Timer | `TMR_Delay` → `Delay_Timer` |
| `DLY` | Delay | `DLY_Start` → `Start_Delay` |

**Why Expand**: Spell out time-related terms for clarity.

### 10. System State and Mode Terms

System operational states:

| Term | Full Name | Keep/Remove | Notes |
|------|-----------|-------------|-------|
| `AUTO` | Automatic | **Context** | Keep if clear in context |
| `MAN` | Manual | **Expand** | → `Manual` |
| `OVR` | Override | **Expand** | → `Override` |
| `ON`/`OFF` | State | **Keep** | Clear and common |
| `RUN`/`STOP` | State | **Keep** | Clear action states |
| `FAULT`/`FLT` | Fault | **Expand** | → `Fault` |
| `ERR` | Error | **Expand** | → `Error` |

**Context Matters**: Some abbreviated states are acceptable if universally understood.

## Measurement Units

### Units to Preserve (Optional)

These measurement units are often meaningful to users:

| Unit | Full Name | Keep? |
|------|-----------|-------|
| `PPM` | Parts Per Million | **Optional** - Context dependent |
| `RPM` | Revolutions Per Minute | **Optional** - Can replace with "Speed" |
| `CFM` | Cubic Feet per Minute | **Optional** - Users understand airflow units |
| `GPM` | Gallons Per Minute | **Optional** - Users understand flow units |
| `KW` | Kilowatts | **Optional** - Power measurement is clear |
| `PSI` | Pounds per Square Inch | **Optional** - Pressure unit is standard |

**Recommendation**: Configure your filter to optionally preserve measurement units based on your user base's technical sophistication.

## Usage Examples

### JavaScript Implementation

```javascript
import { cleanPointName, batchCleanPointNames } from './pointNameFilters.js';

// Basic usage
const cleaned = cleanPointName('nvoSpaceTemp_AI_001');
console.log(cleaned); // "SpaceTemp 001"

// With options
const cleanedWithUnits = cleanPointName('DAT_CFM_Sensor', {
  preserveUnits: true,  // Keep CFM
  preserveStates: true  // Keep ON/OFF states
});
console.log(cleanedWithUnits); // "Discharge Air Temp CFM Sensor"

// Batch processing
const points = [
  'nvoSpaceTemp_BACnet_AV_001',
  'nviSetpoint_LON_Node_05',
  'BI_MSTP_DoorStatus_Alarm'
];

const results = batchCleanPointNames(points);
console.log(results);
// [
//   { original: 'nvoSpaceTemp_BACnet_AV_001', cleaned: 'SpaceTemp 001', modified: true },
//   { original: 'nviSetpoint_LON_Node_05', cleaned: 'Setpoint 05', modified: true },
//   { original: 'BI_MSTP_DoorStatus_Alarm', cleaned: 'DoorStatus Alarm', modified: true }
// ]
```

### Custom Exclusions

```javascript
const cleaned = cleanPointName('AUTO_Mode_PID_Controller', {
  customExclusions: [/\bpid\b/gi]  // Keep PID in this case
});
console.log(cleaned); // "Mode PID Controller"
```

## Best Practices

### 1. Know Your Audience
- **Technical Users** (Engineers, Technicians): May prefer some abbreviations
- **Operators** (Building Staff): Need clear, spelled-out names
- **Executives** (Management): Need simple, business-oriented names

### 2. Test Before Deploying
- Run filters on sample data
- Verify important context isn't lost
- Check that equipment is still identifiable

### 3. Preserve Critical Information
- Equipment location (Floor, Room, Zone)
- Equipment type (AHU, VAV, Chiller)
- Measurement type (Temperature, Pressure, Status)
- Unit numbers (001, 02, etc.)

### 4. Maintain Consistency
- Apply same rules across entire system
- Document any custom exclusions
- Update filters as new patterns emerge

### 5. Consider Context
- Some abbreviations are industry standard (HVAC, AHU, VAV)
- Measurement units may be helpful (CFM, PSI, °F)
- State indicators are often clear (ON/OFF, RUN/STOP)

## Configuration Guidelines

### Aggressive Filtering
For non-technical users, remove almost everything:
```javascript
{
  preserveUnits: false,
  preserveStates: true,
  customExclusions: []
}
```

### Moderate Filtering
For building operators, keep useful context:
```javascript
{
  preserveUnits: true,
  preserveStates: true,
  customExclusions: [/\bahu\b/gi, /\bvav\b/gi, /\bfcu\b/gi]
}
```

### Conservative Filtering
For technical users, only remove protocol details:
```javascript
{
  preserveUnits: true,
  preserveStates: true,
  customExclusions: [
    /\bpid\b/gi,
    /\bvfd\b/gi,
    /\bahu\b/gi,
    /\bvav\b/gi
  ]
}
```

## Common Patterns to Watch

### Pattern 1: Multiple Prefix Stacking
```
nvo_BACnet_AV_MSTP_Temperature_Sensor_001
→ Temperature Sensor 001
```

### Pattern 2: Protocol + Object Type
```
BACnet_BI_DoorStatus
→ DoorStatus
```

### Pattern 3: Logic + State
```
AND_Gate_OVR_Manual
→ Gate Manual
```

### Pattern 4: HVAC Abbreviation Chains
```
AHU_DAT_PID_SP_SetPt
→ Air Handler Discharge Air Temp Setpoint
```

## Integration Checklist

- [ ] Import filter module into your application
- [ ] Test filters on representative sample data
- [ ] Configure preservation options based on user needs
- [ ] Document any custom exclusions for your system
- [ ] Train users on new naming conventions
- [ ] Monitor for edge cases and refine filters
- [ ] Update filters as new equipment is added
- [ ] Consider multilingual support if needed

## Maintenance

### Regular Review
- Quarterly review of filtered names
- Collect user feedback on clarity
- Add new patterns as discovered
- Remove overly aggressive filters if needed

### Version Control
- Track filter configuration changes
- Document reasons for custom exclusions
- Test impact of filter updates
- Maintain rollback capability

## Support and Updates

This filter system should be treated as a living document:
- Add new protocol terms as they emerge
- Refine patterns based on real-world data
- Adjust preservation rules based on user feedback
- Keep up with industry standard changes

## Summary

Effective point name filtering balances removing technical clutter while preserving meaningful information. The key is understanding your users and configuring the filters appropriately for their needs. Start conservatively, gather feedback, and refine over time.
