# KV Tag Display Guide

## Overview

The Building Vitals Point Selector now displays Key-Value (KV) tags directly in the interface, providing rich contextual information about each point without requiring hover or expansion. This feature extracts metadata from ACE IoT API KV tags and presents it in an intuitive, color-coded format.

## Table of Contents
1. [What are KV Tags?](#what-are-kv-tags)
2. [Display Features](#display-features)
3. [Tag Categories and Colors](#tag-categories-and-colors)
4. [Tag Priority System](#tag-priority-system)
5. [User Interface](#user-interface)
6. [Examples](#examples)
7. [Technical Implementation](#technical-implementation)
8. [Benefits](#benefits)

## What are KV Tags?

KV Tags are structured metadata provided by the ACE IoT API that describe point characteristics:

```json
{
  "dis": "RoomTemp",
  "unit": "degree_Fahrenheit",
  "kind": "Number",
  "curVal": "72.5 degree_Fahrenheit",
  "navName": "VAV-707",
  "axStatus": "ok"
}
```

The Point Selector extracts these tags and generates additional tags based on:
- Point type (temperature, damper, fan, etc.)
- Equipment context (VAV, AHU, RTU, etc.)
- Air streams (supply, return, outside, etc.)
- Control function (setpoint, sensor, status, etc.)

## Display Features

### Inline Tag Display
Tags are displayed directly below the point name as colored chips:

```
VAV-707 Room Temperature
[°F] [temp: sensor] [zone: occupied]
```

### Maximum Tags Shown
- **Default**: 3 most important tags per point
- **Configurable**: Can be adjusted via component props
- **Priority-Based**: Most relevant tags shown first

### Tag Structure
Each tag chip displays:
- **Key**: Short descriptor (e.g., "temp", "equipment", "zone")
- **Value**: Specific information (e.g., "sensor", "vav", "occupied")
- **Color**: Visual categorization based on tag type

## Tag Categories and Colors

### Temperature Tags (Red)
- `temp: sensor` - Temperature measurement point
- `temp: setpoint` - Temperature control setpoint
- **Color**: Error/Red for high visibility

### Setpoint Tags (Blue)
- `sp: cooling` - Cooling setpoint
- `sp: heating` - Heating setpoint
- `sp: occupied` - Occupied mode setpoint
- **Color**: Info/Blue for control points

### Sensor Tags (Green)
- `sensor: temperature` - General sensor
- `sensor: humidity` - Humidity measurement
- `sensor: pressure` - Pressure measurement
- **Color**: Success/Green for sensor points

### Equipment Tags (Primary Blue)
- `equipment: vav` - VAV terminal unit
- `equipment: ahu` - Air handling unit
- `equipment: rtu` - Rooftop unit
- **Color**: Primary/Blue for equipment context

### Zone Tags (Secondary Gray)
- `zone: occupied` - Occupancy-related point
- `zone: space` - Space/room identification
- **Color**: Secondary/Gray for location context

### Specialty Tags
- `humidity: %RH` (Warning/Orange)
- `pressure: psi` (Info/Blue)
- `flow: CFM` (Primary/Blue)
- `damper: position` (Info/Blue)
- `fan: status` (Success/Green)
- `valve: position` (Warning/Orange)

## Tag Priority System

Tags are displayed in order of importance to help users quickly understand point purpose:

### Priority Order:
1. **Temperature** - Critical for comfort and system operation
2. **Setpoint** - Control configuration information
3. **Sensor** - Data collection points
4. **Equipment** - System context
5. **Zone** - Location information
6. **Specialty** (humidity, pressure, flow, etc.)

### Example Priority Application:
```
Point: "VAV-707 Room Temperature Setpoint"
Available tags: [temp, setpoint, equipment:vav, zone:occupied, sensor, writable]

Display (top 3): [temp: setpoint] [equipment: vav] [zone: occupied]
Not shown: sensor, writable (lower priority)
```

## User Interface

### Point List Item Structure
```
┌─────────────────────────────────────────────┐
│ □ VAV-707 Room Temperature                  │
│   [°F] [temp: sensor] [zone: occupied]      │
└─────────────────────────────────────────────┘
```

### Compact Display
- Chips are small (20px height) to minimize space
- Text is readable but condensed (0.7rem font size)
- Horizontal scroll if needed (rare with 3-tag limit)

### Visual Feedback
- **Outlined chips**: Clear boundaries without overwhelming color
- **Color coding**: Quick visual categorization
- **Consistent sizing**: Uniform appearance across all tags
- **Flex layout**: Responsive to container width

## Examples

### Example 1: VAV Temperature Point
```
Input: "ses/ses_falls_city/Vav707.points.RoomTemp"
KV Tags: { "dis": "RoomTemp", "unit": "degree_Fahrenheit", "kind": "Number" }

Display:
  VAV-707 Room Temperature
  [°F] [temp: sensor] [equipment: vav]
```

### Example 2: AHU Fan Status
```
Input: "ses/site/Ahu1.points.SaFanStatus"
KV Tags: { "dis": "SaFanStatus", "unit": "on/off", "kind": "Bool" }

Display:
  AHU-1 Supply Air Fan Status
  [on/off] [fan: status] [supply: air]
```

### Example 3: Damper Position
```
Input: "ses/site/Vav115.points.Damper"
KV Tags: { "dis": "Damper", "unit": "percent", "kind": "Number" }

Display:
  VAV-115 Damper Position
  [%] [damper: position] [equipment: vav]
```

### Example 4: Setpoint
```
Input: "ses/site/Vav203.points.ClgSp"
KV Tags: { "dis": "ClgSp", "unit": "degree_Fahrenheit", "kind": "Number" }

Display:
  VAV-203 Cooling Setpoint
  [°F] [temp: setpoint] [sp: cooling]
```

### Example 5: Humidity Sensor
```
Input: "ses/site/Ahu2.points.RaHumid"
KV Tags: { "dis": "RaHumid", "unit": "percent_relative_humidity", "kind": "Number" }

Display:
  AHU-2 Return Air Humidity
  [%RH] [humidity: sensor] [return: air]
```

## Technical Implementation

### Tag Extraction Process

1. **KV Tag Parsing**: Extract KV tags from point data
   ```typescript
   const kvTag = parseKvTags(point['Kv Tags']);
   ```

2. **Equipment Detection**: Identify equipment from point path
   ```typescript
   const equipment = extractEquipmentFromName(point.Name);
   ```

3. **Tag Generation**: Create marker tags based on characteristics
   ```typescript
   const markerTags = generateMarkerTags(kvTag, equipment, pointName);
   ```

4. **Priority Sorting**: Order tags by importance
   ```typescript
   const sortedTags = tagEntries.sort((a, b) => {
     return TAG_PRIORITY.indexOf(a.key) - TAG_PRIORITY.indexOf(b.key);
   });
   ```

5. **Display**: Render top 3 tags with appropriate colors
   ```typescript
   extractDisplayTags(point, 3).map(({ key, value, color }) => (
     <Chip label={`${key}: ${value}`} color={color} />
   ))
   ```

### Component Integration

The tag display is integrated into the Point Selector's virtual scrolling system:

```tsx
<ListItemText
  primary={point.display_name}
  secondary={
    <Stack direction="row" spacing={0.5}>
      {point.unit && <Chip label={point.unit} />}
      {extractDisplayTags(point, 3).map(tag => (
        <Chip key={tag.key} label={`${tag.key}: ${tag.value}`} color={tag.color} />
      ))}
    </Stack>
  }
/>
```

### Performance Considerations

- **Memoization**: Tag extraction is memoized to prevent recalculation
- **Virtual Scrolling**: Only visible items render tags
- **Efficient Parsing**: KV tags parsed once at data load time
- **Minimal Re-renders**: Tag display updates only when point data changes

## Benefits

### For Building Operators
- **Quick Identification**: See point type at a glance
- **Visual Categorization**: Color coding speeds recognition
- **Reduced Clicks**: No need to hover or expand for basic info
- **Equipment Context**: Equipment type immediately visible

### For System Integrators
- **Comprehensive View**: Multiple metadata fields in one view
- **Standardized Display**: Consistent presentation across all points
- **Debugging Aid**: Quickly spot point characteristics
- **Configuration Validation**: Verify setpoints and sensors easily

### For System Performance
- **Reduced API Calls**: All info from single point query
- **Faster Navigation**: Visual scanning vs. reading long names
- **Improved UX**: Less cognitive load to understand points
- **Scalability**: Efficient with thousands of points

## Future Enhancements

### Planned Features
1. **Custom Tag Definitions**: User-defined tag categories and colors
2. **Tag Filtering**: Filter points by specific tag combinations
3. **Tag Statistics**: Show tag distribution across site
4. **Batch Tag Editor**: Modify tags for multiple points
5. **Tag Export**: Export tag metadata for documentation
6. **Advanced Tooltips**: Detailed tag information on hover
7. **Tag Templates**: Save common tag patterns for reuse

## See Also
- [Point Selector User Guide](../POINT_SELECTOR_USER_GUIDE.md)
- [Semantic Search Guide](./SEMANTIC_SEARCH_GUIDE.md)
- [Point Selector Architecture](../dev/POINT_SELECTOR_ARCHITECTURE.md)
- [kvTagParser Documentation](../../src/utils/kvTagParser.ts)

---
*Last Updated: January 2025*
*Version: 6.0.0*
