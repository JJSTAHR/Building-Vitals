# Enhanced Point Name Parser - Integration Guide

## Overview

The enhanced point name parser provides robust extraction and human-readable display names for BACnet point paths from Falls City and similar BMS systems.

## Features

✅ **Robust Equipment Extraction**: Handles VAV, RTU, AHU, Chiller, Boiler, Pump, FCU, CT patterns
✅ **Intelligent Path Parsing**: Works with nested paths, slashes, dots, underscores
✅ **Abbreviation Expansion**: Converts technical abbreviations to readable names
✅ **Automatic Unit Detection**: Infers units based on point type (°F, %, CFM, etc.)
✅ **Confidence Scoring**: Provides quality metrics for parsed results
✅ **Batch Processing**: Efficiently handles large point lists

## Installation

### For Cloudflare Worker

Copy the `enhanced-point-parser.js` file to your worker project:

```bash
cp workers/enhanced-point-parser.js your-worker/src/
```

### Import in Worker

```javascript
import {
  extractEquipmentFromPath,
  enhancePointsBatch
} from './enhanced-point-parser.js';
```

## Usage Examples

### 1. Single Point Enhancement

```javascript
const result = extractEquipmentFromPath('S.FallsCity_CMC.Vav115.RoomTemp');

console.log(result);
// {
//   equipment: 'vav',
//   equipmentId: '115',
//   equipmentDisplay: 'VAV 115',
//   pointName: 'RoomTemp',
//   displayName: 'VAV 115 Room Temperature',
//   unit: '°F',
//   category: 'sensor',
//   pointType: 'temperature',
//   confidence: 90,
//   hasEquipment: true,
//   hasUnit: true
// }
```

### 2. Complex Nested Path

```javascript
const result = extractEquipmentFromPath(
  'FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.points.HeatSignal'
);

console.log(result.displayName); // "VAV 603 Heating Signal"
console.log(result.unit);        // "%"
console.log(result.category);    // "control"
```

### 3. Batch Processing

```javascript
const points = [
  { Name: 'Vav115.RoomTemp', id: 'p1' },
  { Name: 'Rtu6_1.points.SaFanStatus', id: 'p2' },
  { Name: 'Vav707.points.Damper', id: 'p3' }
];

const enhanced = enhancePointsBatch(points);

// Returns:
// [
//   {
//     Name: 'Vav115.RoomTemp',
//     id: 'p1',
//     display_name: 'VAV 115 Room Temperature',
//     unit: '°F',
//     equipment: 'vav',
//     equipmentId: '115',
//     category: 'sensor',
//     confidence: 90,
//     _enhanced: true
//   },
//   ...
// ]
```

## Integration with Cloudflare Worker

### Replace Existing Function

Update your `improved-ai-worker.js` or `ai-enhanced-worker.js`:

```javascript
import { extractEquipmentFromPath, enhancePointsBatch } from './enhanced-point-parser.js';

export default {
  async fetch(request, env, ctx) {
    // ... existing code ...

    // Replace the old extractEquipmentFromPath with:
    async enhancePoint(env, point) {
      const pointName = point.Name || point.name || '';

      // Check cache
      const cacheKey = `enhanced:${pointName}`;
      if (env.POINTS_KV) {
        const cached = await env.POINTS_KV.get(cacheKey, { type: 'json' });
        if (cached && cached.timestamp > Date.now() - 86400000) {
          return { ...point, ...cached.enhancement, fromCache: true };
        }
      }

      // Use new parser
      const parsed = extractEquipmentFromPath(pointName);

      // Build enhanced point
      const enhanced = {
        ...point,
        display_name: parsed.displayName,
        unit: parsed.unit,
        equipment: parsed.equipment,
        equipmentId: parsed.equipmentId,
        equipmentDisplay: parsed.equipmentDisplay,
        category: parsed.category,
        pointType: parsed.pointType,
        quality_score: parsed.confidence,
        _enhanced: true
      };

      // Cache the result
      if (env.POINTS_KV) {
        await env.POINTS_KV.put(cacheKey, JSON.stringify({
          enhancement: {
            display_name: enhanced.display_name,
            unit: enhanced.unit,
            equipment: enhanced.equipment,
            equipmentId: enhanced.equipmentId,
            category: enhanced.category,
            pointType: enhanced.pointType,
            quality_score: enhanced.quality_score
          },
          timestamp: Date.now()
        }), {
          expirationTtl: 86400 // 24 hours
        });
      }

      return enhanced;
    }
  }
};
```

### Batch Endpoint

```javascript
// Batch enhancement endpoint
if (path === '/api/enhance-batch' && request.method === 'POST') {
  const { points } = await request.json();

  // Use batch processing for efficiency
  const enhanced = enhancePointsBatch(points);

  return new Response(JSON.stringify({ points: enhanced }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Processing-Time': `${Date.now() - startTime}ms`,
      'X-Enhanced-Count': enhanced.length.toString()
    }
  });
}
```

## Real-World Test Cases

### Falls City Examples

```javascript
// Example 1: Simple VAV
extractEquipmentFromPath('S.FallsCity_CMC.Vav115.RoomTemp')
// → "VAV 115 Room Temperature"

// Example 2: Complex path with network info
extractEquipmentFromPath('FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.points.HeatSignal')
// → "VAV 603 Heating Signal"

// Example 3: SES path format
extractEquipmentFromPath('ses/ses_falls_city/Vav707.points.Damper')
// → "VAV 707 Damper Position"

// Example 4: RTU with fan status
extractEquipmentFromPath('BacnetNetwork.Rtu6_1.points.SaFanStatus')
// → "RTU 6 Supply Air Fan Status"

// Example 5: AHU with discharge temp
extractEquipmentFromPath('Ahu3.points.DaTemp')
// → "AHU 3 Discharge Air Temperature"

// Example 6: Chiller with supply temp
extractEquipmentFromPath('CH1.ChwSupplyTemp')
// → "Chiller 1 Chilled Water Supply Temperature"
```

## Equipment Type Support

| Equipment | Pattern | Example Input | Example Output |
|-----------|---------|---------------|----------------|
| VAV | `Vav###` | `Vav115.RoomTemp` | `VAV 115 Room Temperature` |
| RTU | `Rtu#` | `Rtu6_1.SaFanStatus` | `RTU 6 Supply Air Fan Status` |
| AHU | `Ahu#` | `Ahu3.DaTemp` | `AHU 3 Discharge Air Temperature` |
| Chiller | `CH#` or `Chiller#` | `CH1.ChwSupplyTemp` | `Chiller 1 CHW Supply Temperature` |
| Boiler | `BLR#` or `Boiler#` | `Boiler1.HwReturnTemp` | `Boiler 1 HW Return Temperature` |
| Pump | `Pump#` or `CHWP#` | `CHWP1.Status` | `CHW Pump 1 Status` |
| FCU | `FCU###` | `FCU201.Temp` | `FCU 201 Temperature` |
| CT | `CT#` | `CT1.FanStatus` | `CT 1 Fan Status` |

## Abbreviation Mappings

### Temperature
- `Temp` → Temperature
- `RoomTemp` → Room Temperature
- `ZoneTemp` → Zone Temperature

### Air Streams
- `Sa` → Supply Air
- `Ra` → Return Air
- `Oa` → Outside Air
- `Ma` → Mixed Air
- `Da` → Discharge Air
- `Ea` → Exhaust Air

### Control & Status
- `Sp` → Setpoint
- `Signal` → Signal
- `Status` → Status
- `Cmd` → Command

### Water Systems
- `Chw` → Chilled Water
- `Hw` → Hot Water
- `Cw` → Condenser Water

### Components
- `Damper` → Damper Position
- `Valve` → Valve Position
- `Fan` → Fan
- `Spd` → Speed

## Unit Detection

The parser automatically assigns units based on point type:

| Point Type | Unit | Example |
|------------|------|---------|
| Temperature | `°F` | `Vav100.RoomTemp` |
| Temperature Setpoint | `°F` | `Vav100.RoomTempSp` |
| Damper Position | `%` | `Vav100.Damper` |
| Valve Position | `%` | `Vav100.ReheatValve` |
| Control Signal | `%` | `Vav100.HeatSignal` |
| Fan Status | `on/off` | `Rtu1.FanStatus` |
| Fan Speed | `%` | `Rtu1.FanSpd` |
| Airflow | `CFM` | `Ahu1.SaFlow` |
| Water Flow | `GPM` | `CHWP1.Flow` |
| Air Pressure | `in.w.c.` | `Ahu1.DuctPress` |
| Water Pressure | `psi` | `CHWP1.Press` |
| Humidity | `%RH` | `Vav100.RH` |
| CO2 | `ppm` | `Vav100.CO2` |

## Confidence Scoring

The parser provides a confidence score (0-100) based on:

- **Equipment detected** (+40 points)
- **Equipment ID found** (+10 points)
- **Point type identified** (+30 points)
- **Display name quality** (+10 points)
- **Multiple words in name** (+10 points)

**Interpretation:**
- **80-100**: High confidence - Complete information
- **60-79**: Medium confidence - Some missing data
- **0-59**: Low confidence - Minimal information

## Performance

### Benchmarks

- **Single point**: ~0.1ms
- **100 points**: ~10ms
- **1,000 points**: ~100ms
- **10,000 points**: ~1s

### Optimization Tips

1. **Use batch processing** for multiple points
2. **Cache results** in KV storage (24h TTL recommended)
3. **Process in parallel** for large datasets
4. **Enable compression** for API responses

```javascript
// Efficient batch processing
const BATCH_SIZE = 100;
for (let i = 0; i < points.length; i += BATCH_SIZE) {
  const batch = points.slice(i, i + BATCH_SIZE);
  const enhanced = enhancePointsBatch(batch);
  await saveToCacheInParallel(enhanced);
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test tests/point-parser.test.js
```

### Test Coverage

- ✅ Real-world Falls City examples
- ✅ Equipment pattern matching (8 types)
- ✅ Point type detection (12 types)
- ✅ Abbreviation expansion (30+ mappings)
- ✅ Display name generation
- ✅ Confidence scoring
- ✅ Edge cases and error handling
- ✅ Batch processing
- ✅ Complex nested paths

## Troubleshooting

### Issue: Equipment not detected

**Solution**: Check if equipment pattern matches supported types. Add custom pattern if needed:

```javascript
const CUSTOM_PATTERN = {
  regex: /YourEquipment(\d+)/i,
  type: 'custom',
  format: (match) => ({
    type: 'custom',
    id: match[1],
    display: `Custom ${match[1]}`
  })
};
```

### Issue: Wrong unit assigned

**Solution**: Point type detection may need tuning. Check `POINT_TYPES` patterns:

```javascript
myCustomType: {
  patterns: [/YourPattern/i],
  unit: 'your_unit',
  category: 'sensor'
}
```

### Issue: Display name not readable

**Solution**: Add custom abbreviation mapping:

```javascript
ABBREVIATIONS['YourAbbr'] = 'Your Full Name';
```

## Deployment

### Deploy to Cloudflare Worker

```bash
# 1. Copy parser to your worker
cp workers/enhanced-point-parser.js your-worker/src/

# 2. Update imports in your worker
# (see Integration section above)

# 3. Deploy
cd your-worker
npx wrangler deploy

# 4. Test
curl https://your-worker.workers.dev/api/enhance-point \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"Name": "Vav115.RoomTemp"}'
```

### Verify Deployment

```bash
# Test with Falls City example
curl https://your-worker.workers.dev/api/enhance-point \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"Name": "S.FallsCity_CMC.Vav115.RoomTemp"}' | jq

# Expected response:
# {
#   "Name": "S.FallsCity_CMC.Vav115.RoomTemp",
#   "display_name": "VAV 115 Room Temperature",
#   "unit": "°F",
#   "equipment": "vav",
#   "equipmentId": "115",
#   "category": "sensor",
#   "confidence": 90,
#   "_enhanced": true
# }
```

## API Reference

### `extractEquipmentFromPath(fullPath)`

Parses a BACnet point path and extracts structured information.

**Parameters:**
- `fullPath` (string): The complete point path

**Returns:**
```typescript
{
  equipment: string | null;           // Equipment type (vav, rtu, ahu, etc.)
  equipmentId: string | null;         // Equipment ID (115, 6, etc.)
  equipmentDisplay: string | null;    // Formatted equipment (VAV 115, RTU 6)
  pointName: string;                  // Extracted point name
  displayName: string;                // Human-readable full name
  unit: string | null;                // Measurement unit (°F, %, CFM, etc.)
  category: string | null;            // Point category (sensor, actuator, control, status)
  pointType: string | null;           // Specific type (temperature, damper, etc.)
  confidence: number;                 // Confidence score (0-100)
  hasEquipment: boolean;              // Whether equipment was detected
  hasUnit: boolean;                   // Whether unit was assigned
}
```

### `enhancePointsBatch(points)`

Processes multiple points efficiently.

**Parameters:**
- `points` (Array): Array of point objects with `Name` property

**Returns:**
- Array of enhanced point objects with all original properties plus parsed data

## Support

For issues or questions:
1. Check the test suite for examples
2. Review the abbreviation and pattern mappings
3. File an issue with example point names that don't parse correctly

## License

MIT License - Free for commercial and personal use
