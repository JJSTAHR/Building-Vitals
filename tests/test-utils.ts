/**
 * Test Utilities and Mocks
 * Shared utilities, fixtures, and mock factories for testing
 */

// Types
export interface Point {
  Name: string;
  display_name?: string;
  kv_tags?: string;
  Type?: string;
  Unit?: string;
}

export interface TimeseriesDataPoint {
  timestamp: string;
  value: number;
}

export interface EnhancementResult {
  success: boolean;
  enhancedPoints: Point[];
  method: 'ai' | 'kv' | 'pattern' | 'none';
  error?: string;
  fallbackAttempts?: number;
}

// Mock Factories

/**
 * Creates a mock point with optional enhancements
 */
export function createMockPoint(overrides?: Partial<Point>): Point {
  return {
    Name: 'Vav707.points.Damper',
    display_name: undefined,
    Type: 'analog',
    Unit: '%',
    ...overrides
  };
}

/**
 * Creates a batch of mock points
 */
export function createMockPoints(count: number, prefix: string = 'Vav'): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    Name: `${prefix}${i + 1}.points.Damper`,
    Type: 'analog',
    Unit: '%'
  }));
}

/**
 * Creates an enhanced point with display name
 */
export function createEnhancedPoint(name: string, displayName: string): Point {
  return {
    Name: name,
    display_name: displayName,
    Type: 'analog',
    Unit: '%'
  };
}

/**
 * Creates a point with KV tags
 */
export function createPointWithKV(name: string, kvData: Record<string, any>): Point {
  return {
    Name: name,
    kv_tags: JSON.stringify(kvData),
    Type: 'analog'
  };
}

/**
 * Creates mock timeseries data
 */
export function createMockTimeseries(
  points: number,
  startDate: Date = new Date('2025-01-01T00:00:00Z'),
  intervalMinutes: number = 60
): TimeseriesDataPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const timestamp = new Date(startDate.getTime() + i * intervalMinutes * 60000);
    return {
      timestamp: timestamp.toISOString(),
      value: Math.random() * 100
    };
  });
}

/**
 * Creates binary (on/off) timeseries data
 */
export function createBinaryTimeseries(
  points: number,
  startDate: Date = new Date('2025-01-01T00:00:00Z')
): TimeseriesDataPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const timestamp = new Date(startDate.getTime() + i * 3600000);
    return {
      timestamp: timestamp.toISOString(),
      value: Math.random() > 0.5 ? 1 : 0
    };
  });
}

// Test Fixtures

/**
 * Real-world point examples from SES Falls City
 */
export const REAL_WORLD_POINTS = {
  vav: [
    {
      Name: 'ses/ses_falls_city/Vav707.points.Damper',
      expected_display: 'VAV-707 Damper Position'
    },
    {
      Name: 'ses/ses_falls_city/Vav101.points.ZoneTemp',
      expected_display: 'VAV-101 ZoneTemp Position'
    },
    {
      Name: 'ses/ses_falls_city/Vav205.points.Setpoint',
      expected_display: 'VAV-205 Setpoint Position'
    }
  ],
  rtu: [
    {
      Name: 'Rtu6_1.points.SaFanStatus',
      expected_display: 'RTU-6 Supply Air Fan Status'
    },
    {
      Name: 'Rtu3_2.points.RaTemp',
      expected_display: 'RTU-3 Return Air Temp'
    },
    {
      Name: 'Rtu12_1.points.OaDamperCmd',
      expected_display: 'RTU-12 Outside Air Damper Command'
    }
  ],
  ahu: [
    {
      Name: 'Ahu1.points.DaTemp',
      expected_display: 'AHU-1 Discharge Air Temperature'
    },
    {
      Name: 'Ahu2.points.MaPres',
      expected_display: 'AHU-2 Mixed Air Pressure'
    },
    {
      Name: 'Ahu5.points.RaHumid',
      expected_display: 'AHU-5 Return Air Humidity'
    }
  ]
};

/**
 * Edge case point names
 */
export const EDGE_CASE_POINTS = {
  special_chars: [
    'Vav-707.points.Damper$Position',
    'Site/Building/Vav707.points.Damper',
    'Vav707.points.Damper[1]',
    'Rtu6_1.points.Fan*Status'
  ],
  unicode: [
    'Vav707.points.Dämpér',
    'Rtu6_1.points.温度',
    'Ahu1.points.Température'
  ],
  malformed: [
    '',
    '   ',
    '\t\n',
    'a'.repeat(1000),
    'point\x00name'
  ],
  url_encoded: [
    'Vav707.points.Damper%20Position',
    'Site%2FBuilding%2FPoint'
  ]
};

// Mock API Responses

/**
 * Creates a successful AI enhancement response
 */
export function createAISuccessResponse(points: Point[]): any {
  return {
    ok: true,
    json: async () => ({
      points: points.map(p => ({
        ...p,
        display_name: `AI Enhanced: ${p.Name}`
      }))
    })
  };
}

/**
 * Creates an AI error response
 */
export function createAIErrorResponse(status: number = 500): any {
  return {
    ok: false,
    status,
    json: async () => ({
      error: 'AI service error'
    })
  };
}

/**
 * Creates a timeseries API response
 */
export function createTimeseriesResponse(data: TimeseriesDataPoint[]): any {
  return {
    ok: true,
    json: async () => ({
      timeseries: data
    })
  };
}

/**
 * Creates a timeseries error response
 */
export function createTimeseriesErrorResponse(status: number = 404): any {
  return {
    ok: false,
    status,
    json: async () => ({
      error: 'Point not found'
    })
  };
}

// Assertion Helpers

/**
 * Asserts that a point has been enhanced
 */
export function assertPointEnhanced(point: Point): void {
  if (!point.display_name) {
    throw new Error(`Point ${point.Name} is not enhanced`);
  }
  if (point.display_name === point.Name) {
    throw new Error(`Point ${point.Name} display_name is same as Name`);
  }
}

/**
 * Asserts that a point's original name is preserved
 */
export function assertOriginalNamePreserved(originalName: string, point: Point): void {
  if (point.Name !== originalName) {
    throw new Error(
      `Original name not preserved. Expected: ${originalName}, Got: ${point.Name}`
    );
  }
}

/**
 * Asserts that timeseries data is valid
 */
export function assertValidTimeseries(data: TimeseriesDataPoint[]): void {
  if (!Array.isArray(data)) {
    throw new Error('Timeseries data must be an array');
  }

  data.forEach((point, index) => {
    if (!point.timestamp || !point.value === undefined) {
      throw new Error(`Invalid timeseries point at index ${index}`);
    }

    // Validate timestamp format
    const date = new Date(point.timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp at index ${index}: ${point.timestamp}`);
    }

    // Validate value is a number
    if (typeof point.value !== 'number') {
      throw new Error(`Invalid value at index ${index}: ${point.value}`);
    }
  });
}

// Test Scenarios

/**
 * Complete test scenario with all steps
 */
export interface TestScenario {
  name: string;
  originalPoint: Point;
  enhancedPoint: Point;
  timeseriesData: TimeseriesDataPoint[];
  expectedAPICall: string;
}

/**
 * Creates a complete test scenario
 */
export function createTestScenario(
  name: string,
  pointName: string,
  displayName: string,
  dataPoints: number = 10
): TestScenario {
  const originalPoint = createMockPoint({ Name: pointName });
  const enhancedPoint = createEnhancedPoint(pointName, displayName);
  const timeseriesData = createMockTimeseries(dataPoints);
  const expectedAPICall = `/api/timeseries?point=${encodeURIComponent(pointName)}`;

  return {
    name,
    originalPoint,
    enhancedPoint,
    timeseriesData,
    expectedAPICall
  };
}

/**
 * Pre-built test scenarios for common use cases
 */
export const TEST_SCENARIOS = {
  vav707: createTestScenario(
    'VAV-707 Damper',
    'ses/ses_falls_city/Vav707.points.Damper',
    'VAV-707 Damper Position'
  ),
  rtu6: createTestScenario(
    'RTU-6 Supply Air Fan',
    'Rtu6_1.points.SaFanStatus',
    'RTU-6 Supply Air Fan Status'
  ),
  ahu1: createTestScenario(
    'AHU-1 Discharge Air Temp',
    'Ahu1.points.DaTemp',
    'AHU-1 Discharge Air Temperature'
  )
};

// Performance Helpers

/**
 * Measures execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Creates a delay for testing timeouts
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxAttempts - 1) {
        await delay(delayMs);
      }
    }
  }

  throw lastError!;
}

// Mock Environment Setup

/**
 * Sets up a complete mock environment for testing
 */
export function setupMockEnvironment() {
  const originalFetch = global.fetch;

  return {
    mockAISuccess: (points: Point[]) => {
      global.fetch = vi.fn().mockResolvedValue(createAISuccessResponse(points));
    },
    mockAIError: (status: number = 500) => {
      global.fetch = vi.fn().mockResolvedValue(createAIErrorResponse(status));
    },
    mockTimeseriesSuccess: (data: TimeseriesDataPoint[]) => {
      global.fetch = vi.fn().mockResolvedValue(createTimeseriesResponse(data));
    },
    mockTimeseriesError: (status: number = 404) => {
      global.fetch = vi.fn().mockResolvedValue(createTimeseriesErrorResponse(status));
    },
    restore: () => {
      global.fetch = originalFetch;
    }
  };
}

// Validation Helpers

/**
 * Validates that enhancement preserves data integrity
 */
export function validateEnhancementIntegrity(
  original: Point[],
  enhanced: Point[]
): boolean {
  if (original.length !== enhanced.length) {
    return false;
  }

  return original.every((orig, index) => {
    const enh = enhanced[index];
    return (
      enh.Name === orig.Name &&
      enh.Type === orig.Type &&
      enh.Unit === orig.Unit &&
      enh.kv_tags === orig.kv_tags
    );
  });
}

/**
 * Validates that API call uses correct point name
 */
export function validateAPICall(fetchMock: any, expectedPointName: string): boolean {
  const calls = fetchMock.mock.calls;
  if (calls.length === 0) {
    return false;
  }

  const lastCall = calls[calls.length - 1];
  const url = lastCall[0];
  const encodedName = encodeURIComponent(expectedPointName);

  return url.includes(encodedName);
}
