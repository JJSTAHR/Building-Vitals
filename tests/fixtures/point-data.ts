/**
 * Test Data Fixtures
 * Real-world point data and expected enhancements
 */

import { Point, TimeseriesDataPoint } from '../test-utils';

/**
 * SES Falls City VAV Points
 */
export const SES_FALLS_CITY_VAV_POINTS: Array<{
  original: Point;
  enhanced: Point;
  timeseries: TimeseriesDataPoint[];
}> = [
  {
    original: {
      Name: 'ses/ses_falls_city/Vav707.points.Damper',
      Type: 'analog',
      Unit: '%'
    },
    enhanced: {
      Name: 'ses/ses_falls_city/Vav707.points.Damper',
      display_name: 'VAV-707 Damper Position',
      Type: 'analog',
      Unit: '%'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 0 },
      { timestamp: '2025-01-01T01:00:00Z', value: 25 },
      { timestamp: '2025-01-01T02:00:00Z', value: 50 },
      { timestamp: '2025-01-01T03:00:00Z', value: 75 },
      { timestamp: '2025-01-01T04:00:00Z', value: 100 },
      { timestamp: '2025-01-01T05:00:00Z', value: 85 },
      { timestamp: '2025-01-01T06:00:00Z', value: 60 },
      { timestamp: '2025-01-01T07:00:00Z', value: 45 },
      { timestamp: '2025-01-01T08:00:00Z', value: 30 },
      { timestamp: '2025-01-01T09:00:00Z', value: 15 }
    ]
  },
  {
    original: {
      Name: 'ses/ses_falls_city/Vav101.points.ZoneTemp',
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'ses/ses_falls_city/Vav101.points.ZoneTemp',
      display_name: 'VAV-101 Zone Temperature',
      Type: 'analog',
      Unit: 'degF'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 68.5 },
      { timestamp: '2025-01-01T01:00:00Z', value: 69.2 },
      { timestamp: '2025-01-01T02:00:00Z', value: 70.1 },
      { timestamp: '2025-01-01T03:00:00Z', value: 71.5 },
      { timestamp: '2025-01-01T04:00:00Z', value: 72.8 },
      { timestamp: '2025-01-01T05:00:00Z', value: 73.2 },
      { timestamp: '2025-01-01T06:00:00Z', value: 72.5 },
      { timestamp: '2025-01-01T07:00:00Z', value: 71.0 },
      { timestamp: '2025-01-01T08:00:00Z', value: 69.8 },
      { timestamp: '2025-01-01T09:00:00Z', value: 68.9 }
    ]
  },
  {
    original: {
      Name: 'ses/ses_falls_city/Vav205.points.Setpoint',
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'ses/ses_falls_city/Vav205.points.Setpoint',
      display_name: 'VAV-205 Temperature Setpoint',
      Type: 'analog',
      Unit: 'degF'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 70.0 },
      { timestamp: '2025-01-01T01:00:00Z', value: 70.0 },
      { timestamp: '2025-01-01T02:00:00Z', value: 70.0 },
      { timestamp: '2025-01-01T03:00:00Z', value: 72.0 },
      { timestamp: '2025-01-01T04:00:00Z', value: 72.0 },
      { timestamp: '2025-01-01T05:00:00Z', value: 72.0 },
      { timestamp: '2025-01-01T06:00:00Z', value: 72.0 },
      { timestamp: '2025-01-01T07:00:00Z', value: 70.0 },
      { timestamp: '2025-01-01T08:00:00Z', value: 70.0 },
      { timestamp: '2025-01-01T09:00:00Z', value: 70.0 }
    ]
  }
];

/**
 * RTU (Rooftop Unit) Points
 */
export const RTU_POINTS: Array<{
  original: Point;
  enhanced: Point;
  timeseries: TimeseriesDataPoint[];
}> = [
  {
    original: {
      Name: 'Rtu6_1.points.SaFanStatus',
      Type: 'binary',
      Unit: 'on/off'
    },
    enhanced: {
      Name: 'Rtu6_1.points.SaFanStatus',
      display_name: 'RTU-6 Supply Air Fan Status',
      Type: 'binary',
      Unit: 'on/off'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 0 },
      { timestamp: '2025-01-01T01:00:00Z', value: 0 },
      { timestamp: '2025-01-01T02:00:00Z', value: 0 },
      { timestamp: '2025-01-01T03:00:00Z', value: 1 },
      { timestamp: '2025-01-01T04:00:00Z', value: 1 },
      { timestamp: '2025-01-01T05:00:00Z', value: 1 },
      { timestamp: '2025-01-01T06:00:00Z', value: 1 },
      { timestamp: '2025-01-01T07:00:00Z', value: 1 },
      { timestamp: '2025-01-01T08:00:00Z', value: 1 },
      { timestamp: '2025-01-01T09:00:00Z', value: 1 }
    ]
  },
  {
    original: {
      Name: 'Rtu3_2.points.RaTemp',
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'Rtu3_2.points.RaTemp',
      display_name: 'RTU-3 Return Air Temperature',
      Type: 'analog',
      Unit: 'degF'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 65.2 },
      { timestamp: '2025-01-01T01:00:00Z', value: 64.8 },
      { timestamp: '2025-01-01T02:00:00Z', value: 64.5 },
      { timestamp: '2025-01-01T03:00:00Z', value: 66.1 },
      { timestamp: '2025-01-01T04:00:00Z', value: 68.5 },
      { timestamp: '2025-01-01T05:00:00Z', value: 70.2 },
      { timestamp: '2025-01-01T06:00:00Z', value: 71.8 },
      { timestamp: '2025-01-01T07:00:00Z', value: 72.5 },
      { timestamp: '2025-01-01T08:00:00Z', value: 71.9 },
      { timestamp: '2025-01-01T09:00:00Z', value: 70.5 }
    ]
  },
  {
    original: {
      Name: 'Rtu12_1.points.OaDamperCmd',
      Type: 'analog',
      Unit: '%'
    },
    enhanced: {
      Name: 'Rtu12_1.points.OaDamperCmd',
      display_name: 'RTU-12 Outside Air Damper Command',
      Type: 'analog',
      Unit: '%'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 10 },
      { timestamp: '2025-01-01T01:00:00Z', value: 10 },
      { timestamp: '2025-01-01T02:00:00Z', value: 15 },
      { timestamp: '2025-01-01T03:00:00Z', value: 20 },
      { timestamp: '2025-01-01T04:00:00Z', value: 35 },
      { timestamp: '2025-01-01T05:00:00Z', value: 50 },
      { timestamp: '2025-01-01T06:00:00Z', value: 65 },
      { timestamp: '2025-01-01T07:00:00Z', value: 80 },
      { timestamp: '2025-01-01T08:00:00Z', value: 75 },
      { timestamp: '2025-01-01T09:00:00Z', value: 60 }
    ]
  },
  {
    original: {
      Name: 'Rtu8_1.points.MaDamperPres',
      Type: 'analog',
      Unit: 'inWC'
    },
    enhanced: {
      Name: 'Rtu8_1.points.MaDamperPres',
      display_name: 'RTU-8 Mixed Air Damper Pressure',
      Type: 'analog',
      Unit: 'inWC'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 0.25 },
      { timestamp: '2025-01-01T01:00:00Z', value: 0.26 },
      { timestamp: '2025-01-01T02:00:00Z', value: 0.28 },
      { timestamp: '2025-01-01T03:00:00Z', value: 0.32 },
      { timestamp: '2025-01-01T04:00:00Z', value: 0.45 },
      { timestamp: '2025-01-01T05:00:00Z', value: 0.58 },
      { timestamp: '2025-01-01T06:00:00Z', value: 0.65 },
      { timestamp: '2025-01-01T07:00:00Z', value: 0.62 },
      { timestamp: '2025-01-01T08:00:00Z', value: 0.55 },
      { timestamp: '2025-01-01T09:00:00Z', value: 0.48 }
    ]
  }
];

/**
 * AHU (Air Handling Unit) Points
 */
export const AHU_POINTS: Array<{
  original: Point;
  enhanced: Point;
  timeseries: TimeseriesDataPoint[];
}> = [
  {
    original: {
      Name: 'Ahu1.points.DaTemp',
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'Ahu1.points.DaTemp',
      display_name: 'AHU-1 Discharge Air Temperature',
      Type: 'analog',
      Unit: 'degF'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 55.5 },
      { timestamp: '2025-01-01T01:00:00Z', value: 55.8 },
      { timestamp: '2025-01-01T02:00:00Z', value: 56.2 },
      { timestamp: '2025-01-01T03:00:00Z', value: 56.8 },
      { timestamp: '2025-01-01T04:00:00Z', value: 57.2 },
      { timestamp: '2025-01-01T05:00:00Z', value: 57.5 },
      { timestamp: '2025-01-01T06:00:00Z', value: 57.8 },
      { timestamp: '2025-01-01T07:00:00Z', value: 57.5 },
      { timestamp: '2025-01-01T08:00:00Z', value: 56.9 },
      { timestamp: '2025-01-01T09:00:00Z', value: 56.2 }
    ]
  },
  {
    original: {
      Name: 'Ahu2.points.MaPres',
      Type: 'analog',
      Unit: 'inWC'
    },
    enhanced: {
      Name: 'Ahu2.points.MaPres',
      display_name: 'AHU-2 Mixed Air Pressure',
      Type: 'analog',
      Unit: 'inWC'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 0.5 },
      { timestamp: '2025-01-01T01:00:00Z', value: 0.52 },
      { timestamp: '2025-01-01T02:00:00Z', value: 0.55 },
      { timestamp: '2025-01-01T03:00:00Z', value: 0.58 },
      { timestamp: '2025-01-01T04:00:00Z', value: 0.62 },
      { timestamp: '2025-01-01T05:00:00Z', value: 0.65 },
      { timestamp: '2025-01-01T06:00:00Z', value: 0.68 },
      { timestamp: '2025-01-01T07:00:00Z', value: 0.66 },
      { timestamp: '2025-01-01T08:00:00Z', value: 0.62 },
      { timestamp: '2025-01-01T09:00:00Z', value: 0.58 }
    ]
  },
  {
    original: {
      Name: 'Ahu5.points.RaHumid',
      Type: 'analog',
      Unit: '%RH'
    },
    enhanced: {
      Name: 'Ahu5.points.RaHumid',
      display_name: 'AHU-5 Return Air Humidity',
      Type: 'analog',
      Unit: '%RH'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 45.2 },
      { timestamp: '2025-01-01T01:00:00Z', value: 46.5 },
      { timestamp: '2025-01-01T02:00:00Z', value: 47.8 },
      { timestamp: '2025-01-01T03:00:00Z', value: 48.5 },
      { timestamp: '2025-01-01T04:00:00Z', value: 49.2 },
      { timestamp: '2025-01-01T05:00:00Z', value: 50.1 },
      { timestamp: '2025-01-01T06:00:00Z', value: 51.5 },
      { timestamp: '2025-01-01T07:00:00Z', value: 52.8 },
      { timestamp: '2025-01-01T08:00:00Z', value: 51.2 },
      { timestamp: '2025-01-01T09:00:00Z', value: 49.5 }
    ]
  },
  {
    original: {
      Name: 'Ahu3.points.OaDamper',
      Type: 'analog',
      Unit: '%'
    },
    enhanced: {
      Name: 'Ahu3.points.OaDamper',
      display_name: 'AHU-3 Outside Air Damper Position',
      Type: 'analog',
      Unit: '%'
    },
    timeseries: [
      { timestamp: '2025-01-01T00:00:00Z', value: 15 },
      { timestamp: '2025-01-01T01:00:00Z', value: 15 },
      { timestamp: '2025-01-01T02:00:00Z', value: 20 },
      { timestamp: '2025-01-01T03:00:00Z', value: 25 },
      { timestamp: '2025-01-01T04:00:00Z', value: 35 },
      { timestamp: '2025-01-01T05:00:00Z', value: 45 },
      { timestamp: '2025-01-01T06:00:00Z', value: 60 },
      { timestamp: '2025-01-01T07:00:00Z', value: 75 },
      { timestamp: '2025-01-01T08:00:00Z', value: 65 },
      { timestamp: '2025-01-01T09:00:00Z', value: 50 }
    ]
  }
];

/**
 * Points with KV Tags
 */
export const POINTS_WITH_KV_TAGS: Array<{
  original: Point;
  enhanced: Point;
}> = [
  {
    original: {
      Name: 'complex/path/point1',
      kv_tags: JSON.stringify({
        display_name: 'Building A Zone 1 Temperature',
        type: 'sensor',
        location: 'Building A',
        zone: '1'
      }),
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'complex/path/point1',
      display_name: 'Building A Zone 1 Temperature',
      kv_tags: JSON.stringify({
        display_name: 'Building A Zone 1 Temperature',
        type: 'sensor',
        location: 'Building A',
        zone: '1'
      }),
      Type: 'analog',
      Unit: 'degF'
    }
  },
  {
    original: {
      Name: 'site/equipment/sensor',
      kv_tags: JSON.stringify({
        display_name: 'Main Chiller Supply Temperature',
        equipment_type: 'chiller',
        priority: 'critical'
      }),
      Type: 'analog',
      Unit: 'degF'
    },
    enhanced: {
      Name: 'site/equipment/sensor',
      display_name: 'Main Chiller Supply Temperature',
      kv_tags: JSON.stringify({
        display_name: 'Main Chiller Supply Temperature',
        equipment_type: 'chiller',
        priority: 'critical'
      }),
      Type: 'analog',
      Unit: 'degF'
    }
  }
];

/**
 * Edge Case Points
 */
export const EDGE_CASE_POINTS: Array<{
  original: Point;
  description: string;
}> = [
  {
    original: { Name: '' },
    description: 'Empty point name'
  },
  {
    original: { Name: '   ' },
    description: 'Whitespace only'
  },
  {
    original: { Name: '\t\n\r' },
    description: 'Special whitespace characters'
  },
  {
    original: { Name: 'a'.repeat(1000) },
    description: 'Very long point name (1000 chars)'
  },
  {
    original: { Name: 'point\x00with\x00nulls' },
    description: 'Point name with null bytes'
  },
  {
    original: { Name: 'Vav-707.points.Damper$Position' },
    description: 'Special characters: dash and dollar sign'
  },
  {
    original: { Name: 'Site/Building/Vav707.points.Damper' },
    description: 'Forward slashes in path'
  },
  {
    original: { Name: 'Vav707.points.Damper[1]' },
    description: 'Square brackets (array notation)'
  },
  {
    original: { Name: 'Rtu6_1.points.Fan*Status' },
    description: 'Asterisk wildcard character'
  },
  {
    original: { Name: 'Vav707.points.Dämpér' },
    description: 'Unicode characters (German umlauts)'
  },
  {
    original: { Name: 'Rtu6_1.points.温度' },
    description: 'Unicode characters (Chinese)'
  },
  {
    original: { Name: 'Ahu1.points.Température' },
    description: 'Unicode characters (French accents)'
  },
  {
    original: { Name: 'Vav707.points.Damper%20Position' },
    description: 'URL-encoded space'
  },
  {
    original: { Name: 'Site%2FBuilding%2FPoint' },
    description: 'Fully URL-encoded path'
  }
];

/**
 * Performance Test Dataset
 * Large dataset for performance testing
 */
export function generateLargeDataset(count: number): Point[] {
  const equipmentTypes = ['Vav', 'Rtu', 'Ahu', 'Boiler', 'Chiller'];
  const pointTypes = ['Temp', 'Damper', 'Status', 'Setpoint', 'Command', 'Pressure'];

  return Array.from({ length: count }, (_, i) => {
    const equipment = equipmentTypes[i % equipmentTypes.length];
    const pointType = pointTypes[i % pointTypes.length];
    const number = Math.floor(i / equipmentTypes.length) + 1;

    return {
      Name: `${equipment}${number}.points.${pointType}`,
      Type: pointType === 'Status' ? 'binary' : 'analog',
      Unit: pointType === 'Temp' ? 'degF' : '%'
    };
  });
}

/**
 * Complete test scenarios combining all data
 */
export const COMPLETE_TEST_SCENARIOS = {
  vav: SES_FALLS_CITY_VAV_POINTS,
  rtu: RTU_POINTS,
  ahu: AHU_POINTS,
  kv: POINTS_WITH_KV_TAGS,
  edge: EDGE_CASE_POINTS
};

/**
 * Export all points as a single array for batch testing
 */
export const ALL_TEST_POINTS = [
  ...SES_FALLS_CITY_VAV_POINTS.map(p => p.original),
  ...RTU_POINTS.map(p => p.original),
  ...AHU_POINTS.map(p => p.original)
];

/**
 * Export all enhanced points
 */
export const ALL_ENHANCED_POINTS = [
  ...SES_FALLS_CITY_VAV_POINTS.map(p => p.enhanced),
  ...RTU_POINTS.map(p => p.enhanced),
  ...AHU_POINTS.map(p => p.enhanced)
];
