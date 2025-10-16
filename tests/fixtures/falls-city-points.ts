/**
 * Falls City Test Fixtures
 * Real-world point data from ses_falls_city site for comprehensive testing
 */

export interface TestPoint {
  Name: string;
  Site?: string;
  Client?: string;
  'Point Type'?: string;
  'Collect Enabled'?: string;
  'Collect Interval'?: string;
  'Marker Tags'?: string;
  'Kv Tags'?: string;
  'Bacnet Data'?: string;
  display_name?: string;
  equipment?: string;
  equipmentType?: string;
  haystack?: Record<string, any>;
}

export const fallsCityPoints: TestPoint[] = [
  {
    Name: 'ses/ses_falls_city/8000:33-8033/analogValue/102',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'QI Risk Manager C119, RoomRH',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"VAV_811","object_name":"AV 102","object_type":"analogValue","object_units":"percentRelativeHumidity"}]',
  },
  {
    Name: 'ses/ses_falls_city/2000:43-2043/analogValue/6',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU2N',
    'Kv Tags': '[{"jace_object_name":"RaFanOffset"}]',
    'Bacnet Data': '[{"device_name":"Rtu2","object_name":"AV 06","object_units":"noUnits"}]',
  },
  {
    Name: 'ses/ses_falls_city/2000:43-2043/binaryValue/10',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU2N',
    'Kv Tags': '[{"jace_object_name":"SaFanStatus"}]',
    'Bacnet Data': '[{"device_name":"Rtu2","object_name":"BV 10","object_type":"binaryValue"}]',
  },
  {
    Name: 'ses/ses_falls_city/12000:18-12018/analogInput/0',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'VAVR 725 (WHAT ROOM?), RoomTemp',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_id":"12018","object_name":"AI 00","object_type":"analogInput"}]',
  },
  {
    Name: 'ses/ses_falls_city/6000:12-6012/analogValue/8',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'Chapel B102, Damper',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"VAV_312","object_name":"AV 08","object_units":"percent"}]',
  },
  {
    Name: 'ses/ses_falls_city/1000:6-1006/analogInput/9',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'RTU7 RaPress, RTU7',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"Ahu7_1","object_name":"AI 09","object_units":"inchesOfWater"}]',
  },
  {
    Name: 'ses/ses_falls_city/1000:61-1061/binaryValue/55',
    Site: 'SES Falls City Community Medical Center',
    'Collect Enabled': 'True',
    'Marker Tags': 'Chilled Water System',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"CHWS","object_name":"CH-1 Valve Call","object_type":"binaryValue"}]',
  },
];

export const edgeCasePoints: TestPoint[] = [
  // Empty marker tags
  {
    Name: 'ses/ses_falls_city/test/empty-markers',
    'Marker Tags': '',
    'Kv Tags': '[]',
    'Collect Enabled': 'False',
  },
  // Malformed KV tags
  {
    Name: 'ses/ses_falls_city/test/malformed-kv',
    'Marker Tags': 'TestPoint',
    'Kv Tags': 'invalid json {',
    'Collect Enabled': 'True',
  },
  // Special characters in name
  {
    Name: 'ses/ses_falls_city/special-chars/test#point$name%20',
    'Marker Tags': 'SpecialChars',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Very long point name (>200 chars)
  {
    Name: 'ses/ses_falls_city/' + 'very-long-path/'.repeat(20) + 'endpoint',
    'Marker Tags': 'LongName',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Unicode characters
  {
    Name: 'ses/ses_falls_city/測試/point-日本語',
    'Marker Tags': 'Unicode',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Empty Bacnet data
  {
    Name: 'ses/ses_falls_city/test/empty-bacnet',
    'Marker Tags': 'TestPoint',
    'Kv Tags': '[]',
    'Bacnet Data': '[]',
    'Collect Enabled': 'True',
  },
  // Missing required fields
  {
    Name: 'ses/ses_falls_city/test/minimal',
    'Collect Enabled': 'True',
  },
];

export const problematicPatterns: TestPoint[] = [
  // Ambiguous equipment type
  {
    Name: 'ses/ses_falls_city/ambiguous/device/point',
    'Marker Tags': 'Unknown',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Multiple equipment types in name
  {
    Name: 'ses/ses_falls_city/AHU-01/VAV-02/RTU-03/temp',
    'Marker Tags': 'MultiEquip',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Conflicting marker tags and device name
  {
    Name: 'ses/ses_falls_city/device-vav/point',
    'Marker Tags': 'AHU',
    'Kv Tags': '[]',
    'Bacnet Data': '[{"device_name":"RTU_01"}]',
    'Collect Enabled': 'True',
  },
  // Numeric-only identifiers
  {
    Name: 'ses/ses_falls_city/12345/67890/11111',
    'Marker Tags': '999',
    'Kv Tags': '[]',
    'Collect Enabled': 'True',
  },
  // Duplicate information
  {
    Name: 'ses/ses_falls_city/VAV-101/VAV/101/vav_101',
    'Marker Tags': 'VAV101',
    'Kv Tags': '[{"device":"VAV-101"}]',
    'Collect Enabled': 'True',
  },
];

export const quotaTestScenarios = [
  {
    scenario: 'under_quota',
    pointCount: 50,
    expectedTier: 'ai',
    quotaUsed: 1000,
    dailyLimit: 10000,
  },
  {
    scenario: 'approaching_quota',
    pointCount: 200,
    expectedTier: 'rule-based',
    quotaUsed: 8500,
    dailyLimit: 10000,
  },
  {
    scenario: 'quota_exceeded',
    pointCount: 100,
    expectedTier: 'cache-only',
    quotaUsed: 9800,
    dailyLimit: 10000,
  },
  {
    scenario: 'zero_quota',
    pointCount: 10,
    expectedTier: 'cache-only',
    quotaUsed: 10000,
    dailyLimit: 10000,
  },
];

export const performanceTestData = {
  small: Array.from({ length: 100 }, (_, i) => ({
    Name: `ses/ses_falls_city/vav${i}/temp`,
    'Collect Enabled': 'True',
    'Marker Tags': `VAV${i}`,
  })),
  medium: Array.from({ length: 1000 }, (_, i) => ({
    Name: `ses/ses_falls_city/device${i}/point`,
    'Collect Enabled': 'True',
    'Marker Tags': `Device${i}`,
  })),
  large: Array.from({ length: 4500 }, (_, i) => ({
    Name: `ses/ses_falls_city/equipment${i}/sensor`,
    'Collect Enabled': 'True',
    'Marker Tags': `Equip${i}`,
  })),
};

export const expectedEnhancements = {
  'ses/ses_falls_city/8000:33-8033/analogValue/102': {
    display_name: 'VAV-811 Space Humidity',
    equipment: 'vav',
    equipmentType: 'VAV',
    confidence: 85,
  },
  'ses/ses_falls_city/2000:43-2043/analogValue/6': {
    display_name: 'RTU-2 Return Air Fan Offset',
    equipment: 'rtu',
    equipmentType: 'RTU',
    confidence: 90,
  },
  'ses/ses_falls_city/2000:43-2043/binaryValue/10': {
    display_name: 'RTU-2 Supply Air Fan Status',
    equipment: 'rtu',
    equipmentType: 'RTU',
    confidence: 92,
  },
  'ses/ses_falls_city/6000:12-6012/analogValue/8': {
    display_name: 'VAV-312 Damper Position',
    equipment: 'vav',
    equipmentType: 'VAV',
    confidence: 88,
  },
  'ses/ses_falls_city/1000:6-1006/analogInput/9': {
    display_name: 'AHU-7 Return Air Pressure',
    equipment: 'ahu',
    equipmentType: 'AHU',
    confidence: 87,
  },
};

export const cacheTestData = {
  tier1: { ttl: 604800, description: 'Highly confident enhancements' },
  tier2: { ttl: 86400, description: 'Medium confidence enhancements' },
  tier3: { ttl: 3600, description: 'Low confidence or AI-enhanced' },
  tier4: { ttl: 300, description: 'Fallback or error cases' },
};
