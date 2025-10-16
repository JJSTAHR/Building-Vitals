# Point Selector User Guide

## Table of Contents
1. [Overview](#overview)
2. [Enhanced Features](#enhanced-features)
3. [Using the Tooltip System](#using-the-tooltip-system)
4. [Search Functionality](#search-functionality)
5. [Search Tips and Tricks](#search-tips-and-tricks)
6. [Example Search Queries](#example-search-queries)
7. [Troubleshooting](#troubleshooting)
8. [FAQs](#faqs)

## Overview

The Building Vitals Point Selector has been significantly enhanced to provide you with a more intuitive and powerful way to find and select BACnet points for your HVAC monitoring and control needs. The improvements focus on three main areas:

1. **Enhanced Tooltips** - See both cleaned and raw point names
2. **Intelligent Search** - Find points using natural language
3. **Better Organization** - Points grouped by equipment and type

These enhancements make it easier to:
- Quickly identify the exact point you need
- Understand what each point measures or controls
- Search using familiar HVAC terminology
- View the technical BACnet path when needed

## Enhanced Features

### 1. KV Tag Display and Point Enrichment
Every point now leverages KV (Key-Value) tags from the ACE IoT API to provide rich contextual information:
- **Enhanced Display Names**: Clean, human-readable names derived from KV tag metadata
- **Unit Display**: Units are extracted from KV tags and displayed as chips (°F, %, CFM, etc.)
- **Contextual Tags**: Up to 3 prioritized tags showing equipment type, function, and characteristics
- **Semantic Metadata**: Equipment context, air streams, setpoint types automatically extracted

**KV Tag Features:**
- **Automatic Parsing**: The system automatically parses KV tag JSON from API responses
- **Priority-Based Display**: Most important tags (temperature, setpoint, sensor) shown first
- **Color-Coded Tags**: Visual distinction by tag category (temperature=red, sensor=green, etc.)
- **Equipment Recognition**: Supports 15+ equipment types (VAV, AHU, RTU, FCU, MAU, ERV, etc.)

**Example KV Tag Enhancement:**
```
Raw Point: "ses/ses_falls_city/Vav707.points.RoomTemp"
KV Tags: { "dis": "RoomTemp", "unit": "degree_Fahrenheit", "navName": "VAV-707" }

Enhanced Display:
- Display Name: "VAV-707 Room Temperature"
- Unit Chip: "°F"
- Tag Chips: "temp: sensor", "zone: occupied"
```

### 2. Intelligent Point Name Cleaning (Fallback)
For points without KV tags, the system uses intelligent name parsing:
- **Equipment Type** (VAV, AHU, RTU, Chiller, etc.)
- **Equipment ID** (unit number or designation)
- **Point Purpose** (temperature, setpoint, damper position, etc.)
- **Measurement Unit** (°F, %, CFM, on/off, etc.)

**Example Transformations:**
- `S.FallsCity_CMC.Vav115.RoomTemp` → **"VAV 115 - Room Temperature [°F]"**
- `BacnetNetwork.Rtu6_1.SaFanStatus` → **"RTU 6-1 - Supply Air Fan Status [on/off]"**
- `Ahu2.ChwVlvPos` → **"AHU 2 - Chilled Water Valve Position [%]"**

### 2. Semantic Search Capability
The search system now understands HVAC terminology and concepts:
- Search for "cooling" to find all cooling-related points
- Search for "temperature" to see all temperature sensors
- Search for "VAV" to filter all Variable Air Volume terminal points
- Combine terms like "VAV temperature" for specific results

### 3. Enhanced Tooltips with API Point Name
Hover over any point to see detailed information:
- **API Point Name** (MOST PROMINENT): Full ACE IoT API path displayed in monospace font
- **Copy Button**: One-click copy of API name to clipboard for API queries
- **Display Name**: Clean, human-readable point name
- **Unit**: Measurement unit from KV tags (°F, %, CFM, etc.)
- **Equipment Context**: Equipment type, location, and ID

**Tooltip Features:**
- **API-First Design**: API point name is the primary information for developers
- **Quick Copy**: Click the copy icon to copy the API name instantly
- **Rich Context**: Equipment and unit information readily available
- **Theme-Aware**: Automatically adapts to light/dark mode
- **Smart Positioning**: Right-start placement for better visibility
- **Wide Display**: 500px max width to accommodate long API paths

## Using the Tooltip System

### How to Access Tooltips
1. **Hover Method**: Simply move your mouse cursor over any point name in the selector
2. **Touch/Mobile**: Tap and hold on a point name to reveal the tooltip
3. **Keyboard Navigation**: Use Tab to focus on a point, tooltip appears automatically

### Understanding Tooltip Information

#### Display Elements:
```
┌──────────────────────────────────────┐
│ VAV 115 - Room Temperature           │  ← Cleaned Name
│ ─────────────────────────────        │
│ Raw: S.FallsCity_CMC.Vav115.RoomTemp │  ← Original Path
│ Equipment: VAV (ID: 115)             │  ← Equipment Details
│ Type: Temperature Sensor              │  ← Point Classification
│ Unit: °F                             │  ← Measurement Unit
│ Category: HVAC - VAV Terminals       │  ← System Grouping
│ Confidence: 90%                      │  ← Parsing Confidence
└──────────────────────────────────────┘
```

#### Confidence Scores Explained:
- **90-100%**: Excellent parsing - all components identified
- **70-89%**: Good parsing - most components recognized
- **50-69%**: Fair parsing - some manual verification recommended
- **Below 50%**: Limited parsing - review raw name for accuracy

## Search Functionality

### Basic Search
Type any term in the search box to instantly filter points:
- Equipment names: `VAV`, `AHU`, `RTU`, `Chiller`
- Measurements: `temperature`, `pressure`, `flow`, `humidity`
- Locations: `room`, `supply`, `return`, `outside`
- Control types: `setpoint`, `damper`, `valve`, `status`

### Advanced Search Features

#### 1. Multi-Term Search
Combine multiple terms for precise filtering:
- `VAV temperature` - All VAV temperature points
- `AHU fan status` - Air handler fan status points
- `room cooling setpoint` - Room cooling setpoints

#### 2. Equipment ID Search
Find specific equipment by including numbers:
- `VAV 115` - Points for VAV box 115
- `RTU 6` - All RTU 6 points
- `Chiller 1` - Chiller 1 points

#### 3. Abbreviation Support
Use common HVAC abbreviations:
- `SP` or `setpoint`
- `temp` or `temperature`
- `CHW` for chilled water
- `HW` for hot water
- `SA` for supply air
- `RA` for return air

## Search Tips and Tricks

### Pro Tips for Efficient Searching

#### 1. Start Broad, Then Narrow
```
Step 1: "temperature"     → Shows all temperature points
Step 2: "VAV temperature"  → Filters to just VAV temperatures
Step 3: "VAV 115 temp"     → Specific VAV unit
```

#### 2. Use Equipment Patterns
Common equipment search patterns:
- **VAVs by floor**: `VAV 1` (finds VAV 100-199)
- **All chillers**: `chiller` or `CHLR`
- **Pump systems**: `pump` or specific types like `CHWP`

#### 3. Leverage Semantic Understanding
The search understands related concepts:
- Searching `cooling` finds: cooling setpoints, chilled water valves, cooling signals
- Searching `airflow` finds: dampers, fan speeds, CFM measurements
- Searching `energy` finds: kW, kWh, demand points

#### 4. Quick Filters by Category
Use category keywords:
- `sensor` - All sensor points
- `actuator` - Dampers and valves
- `setpoint` - All setpoints
- `status` - Equipment status points
- `alarm` - Alarm and fault points

### Search Shortcuts

| Shortcut | Finds |
|----------|-------|
| `*temp` | All temperature-related points |
| `VAV*` | All VAV-related points |
| `*SP` | All setpoints |
| `fan*` | All fan-related points |
| `*water*` | All water system points |

## Example Search Queries

### Common Use Cases

#### Finding All Temperature Sensors in a Building
```
Search: "temperature sensor"
Results: All points measuring temperature
```

#### Locating Specific VAV Box Controls
```
Search: "VAV 115"
Results: All points for VAV box 115 including:
- Room Temperature
- Cooling/Heating Setpoints
- Damper Position
- Reheat Valve
```

#### Identifying Energy Monitoring Points
```
Search: "kW" or "energy"
Results: Power meters, energy consumption points
```

#### Finding All Supply Air Points
```
Search: "supply air" or "SA"
Results: Supply air temperatures, pressures, fan status
```

#### Checking Chilled Water System
```
Search: "chilled water" or "CHW"
Results: CHW temperatures, valve positions, flow rates
```

### Complex Scenarios

#### Scenario 1: Troubleshooting Zone Temperature
```
Search Sequence:
1. "VAV 115 temp" - Check zone temperature
2. "VAV 115 setpoint" - Verify setpoints
3. "VAV 115 damper" - Check damper position
4. "VAV 115 reheat" - Check heating valve
```

#### Scenario 2: Reviewing Air Handler Performance
```
Search Sequence:
1. "AHU 2" - See all AHU 2 points
2. "AHU 2 fan" - Check fan status
3. "AHU 2 temperature" - Review temperatures
4. "AHU 2 damper" - Check damper positions
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Can't Find a Specific Point
**Solutions:**
1. Try searching with just the equipment ID (e.g., "115")
2. Use the raw BACnet path from the tooltip
3. Try alternative terminology (e.g., "room" vs "zone")
4. Check the confidence score - low confidence may indicate unusual naming

#### Issue: Too Many Search Results
**Solutions:**
1. Add more specific terms to narrow results
2. Include equipment type and ID
3. Use category filters
4. Sort by confidence score to see best matches first

#### Issue: Tooltip Not Appearing
**Solutions:**
1. Ensure JavaScript is enabled in your browser
2. Try clicking on the point instead of hovering
3. Check for browser console errors (F12)
4. Refresh the page and try again

#### Issue: Search Not Finding Expected Points
**Solutions:**
1. Check spelling of search terms
2. Try using abbreviations or full words
3. Use semantic search with related terms
4. Look at tooltip to see how point is categorized

#### Issue: Slow Search Performance
**Solutions:**
1. Allow semantic search model to fully load (first use)
2. Reduce number of points displayed at once
3. Clear browser cache if performance degrades
4. Use more specific search terms

## FAQs

### Q: What does the confidence score mean?
**A:** The confidence score (0-100%) indicates how well the system could parse and understand the BACnet point name. Higher scores mean better recognition of equipment and point type.

### Q: Can I search using the raw BACnet path?
**A:** Yes! The search works with both cleaned names and raw BACnet paths. You can paste a path directly into the search.

### Q: Why do some points show "HVAC - General" category?
**A:** This is the fallback category for points that couldn't be definitively categorized. Check the raw name in the tooltip for more context.

### Q: How do I export the search results?
**A:** Click the "Export" button after searching to download results as CSV or JSON. The export includes both cleaned and raw names.

### Q: Can I save frequently used searches?
**A:** Yes, use the "Save Search" feature to create quick access buttons for common searches.

### Q: What equipment types are recognized?
**A:** The system recognizes:
- VAV (Variable Air Volume boxes)
- AHU (Air Handling Units)
- RTU (Rooftop Units)
- FCU (Fan Coil Units)
- Chillers
- Boilers
- Pumps (CHWP, HWP, CWP)
- Cooling Towers
- VFDs (Variable Frequency Drives)
- MAU (Makeup Air Units)
- ERV (Energy Recovery Ventilators)
- Exhaust Fans
- Heat Exchangers

### Q: How often is the point list updated?
**A:** Points are refreshed:
- Automatically every hour
- Manually via the "Refresh" button
- When switching between sites
- After configuration changes

### Q: Can I customize the display format?
**A:** Yes, in Settings you can:
- Toggle between cleaned and raw names as primary display
- Adjust tooltip delay
- Change sort order
- Filter by confidence level

## See Also
- [Developer Guide](./dev/POINT_SELECTOR_ARCHITECTURE.md)
- [API Reference](./dev/POINT_SELECTOR_API.md)
- [Migration Guide](./POINT_SELECTOR_MIGRATION.md)
- [Release Notes](./RELEASE_NOTES_POINT_SELECTOR.md)

---
*Last Updated: December 2024*
*Version: 5.0.0*