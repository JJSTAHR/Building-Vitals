/**
 * Mock Analytics Engine for Testing
 * Simulates Cloudflare Analytics Engine behavior
 */

export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: number[];
  }): void;
}

export interface AnalyticsEngineBinding {
  datasets: {
    [key: string]: AnalyticsEngineDataset;
  };
}

/**
 * In-memory storage for analytics events
 */
class MockAnalyticsDataset implements AnalyticsEngineDataset {
  private dataPoints: Array<{
    timestamp: number;
    blobs?: string[];
    doubles?: number[];
    indexes?: number[];
  }> = [];

  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: number[];
  }): void {
    this.dataPoints.push({
      timestamp: Date.now(),
      ...event,
    });
  }

  getDataPoints() {
    return [...this.dataPoints];
  }

  clear() {
    this.dataPoints = [];
  }

  query(options?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) {
    let filtered = [...this.dataPoints];

    if (options?.startTime) {
      filtered = filtered.filter(dp => dp.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      filtered = filtered.filter(dp => dp.timestamp <= options.endTime!);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }
}

/**
 * Create mock Analytics Engine binding
 */
export function createMockAnalyticsEngine(): AnalyticsEngineBinding & {
  getDataset: (name: string) => MockAnalyticsDataset;
  clearAll: () => void;
} {
  const datasets: Record<string, MockAnalyticsDataset> = {};

  const getOrCreateDataset = (name: string): MockAnalyticsDataset => {
    if (!datasets[name]) {
      datasets[name] = new MockAnalyticsDataset();
    }
    return datasets[name];
  };

  return {
    datasets: new Proxy({}, {
      get: (_target, prop: string) => getOrCreateDataset(prop),
    }),
    getDataset: (name: string) => getOrCreateDataset(name),
    clearAll: () => {
      Object.values(datasets).forEach(ds => ds.clear());
    },
  };
}

/**
 * Mock worker environment with Analytics Engine
 */
export interface MockWorkerEnv {
  ANALYTICS: ReturnType<typeof createMockAnalyticsEngine>;
  API_BASE_URL?: string;
  CACHE_TTL?: number;
}

export function createMockWorkerEnv(): MockWorkerEnv {
  return {
    ANALYTICS: createMockAnalyticsEngine(),
    API_BASE_URL: 'https://api.example.com',
    CACHE_TTL: 300,
  };
}
