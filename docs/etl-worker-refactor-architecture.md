# ETL Worker Refactor Architecture

## Executive Summary

This document outlines the architectural redesign of the ETL Worker to align with the ACE IoT API's actual capabilities. The refactor addresses critical API mismatches causing 400 BAD REQUEST errors by transitioning from point-specific queries to site-wide bulk data collection with worker-side filtering.

## Problem Statement

### Current Architecture Issues

**API Mismatch:**
- Current implementation attempts to query individual points
- ACE IoT API does NOT support point-specific queries
- Results in 400 BAD REQUEST errors for all data collection attempts

**Missing Weather Data:**
- No weather data collection implemented
- Weather endpoint available but not utilized

**Inefficient Data Model:**
- Separate tables per point type
- Complex schema maintenance
- Limited scalability

## Architectural Changes

### API Approach Comparison

#### Current (Broken) Approach
```
┌─────────────┐
│ ETL Worker  │
└──────┬──────┘
       │
       ├─► Query Point 1 ──► 400 BAD REQUEST
       ├─► Query Point 2 ──► 400 BAD REQUEST
       └─► Query Point N ──► 400 BAD REQUEST
```

**Problems:**
- Assumes point-level API endpoints exist
- Individual point queries not supported
- No pagination strategy
- High API call overhead

#### New (Correct) Approach
```
┌─────────────────────────────────────────────────┐
│              ETL Worker                          │
│                                                  │
│  ┌──────────────┐       ┌──────────────┐       │
│  │  Timeseries  │       │   Weather    │       │
│  │  Collector   │       │  Collector   │       │
│  └──────┬───────┘       └──────┬───────┘       │
│         │                      │                │
│         ├──► Fetch All Data    │                │
│         │    (Paginated)       │                │
│         │                      │                │
│         ├──► Filter Points     │                │
│         │    (Worker-side)     │                │
│         │                      │                │
│         └──► Batch Insert      │                │
│                                │                │
│                         ┌──────▼─────┐          │
│                         │    D1      │          │
│                         │  Database  │          │
│                         └────────────┘          │
└─────────────────────────────────────────────────┘
```

**Benefits:**
- Uses supported bulk endpoints
- Single API call per time window (+ pagination)
- Worker-side filtering for flexibility
- Efficient batch inserts

## Core Architecture

### 1. Data Collection Layer

#### Timeseries Collection

**Endpoint:** `GET /sites/{site_name}/timeseries/paginated`

**Request Parameters:**
```javascript
{
  start_time: "2024-01-01T00:00:00Z",  // ISO 8601 format
  end_time: "2024-01-01T23:59:59Z",    // ISO 8601 format
  page_size: 100000,                    // Maximum efficiency
  cursor: "optional_pagination_token",  // For subsequent pages
  raw_data: true                        // Include raw sensor data
}
```

**Response Structure:**
```javascript
{
  data: [
    {
      point_name: "temp_sensor_1",
      timestamp: "2024-01-01T12:00:00Z",
      value: 72.5,
      quality: "good",
      metadata: { /* additional fields */ }
    },
    // ... up to 100,000 records
  ],
  pagination: {
    next_cursor: "abc123...",  // Token for next page
    has_more: true              // More data available
  },
  total_count: 250000          // Total records in time range
}
```

#### Weather Collection

**Endpoint:** `GET /sites/{site_name}/weather`

**Request Parameters:**
```javascript
{
  start_time: "2024-01-01T00:00:00Z",
  end_time: "2024-01-01T23:59:59Z"
}
```

**Response Structure:**
```javascript
{
  data: [
    {
      timestamp: "2024-01-01T12:00:00Z",
      temperature: 68.5,
      humidity: 45.2,
      precipitation: 0.0,
      wind_speed: 5.3,
      conditions: "clear"
    },
    // ... weather observations
  ]
}
```

### 2. Pagination Strategy

#### Cursor-Based Pagination Flow

```
┌─────────────────────────────────────────────────────┐
│ Pagination Process                                   │
│                                                      │
│  1. Initial Request (no cursor)                     │
│     ├─► Fetch page 1 (100k records)                │
│     ├─► Receive next_cursor: "abc123"              │
│     └─► has_more: true                             │
│                                                      │
│  2. Process & Store Page 1                          │
│     ├─► Filter configured points                    │
│     ├─► Transform data                              │
│     └─► Batch insert to D1                         │
│                                                      │
│  3. Subsequent Request (with cursor)                │
│     ├─► Use cursor: "abc123"                        │
│     ├─► Fetch page 2 (100k records)                │
│     ├─► Receive next_cursor: "def456"              │
│     └─► has_more: true                             │
│                                                      │
│  4. Repeat Until Complete                           │
│     └─► has_more: false (final page)               │
└─────────────────────────────────────────────────────┘
```

**Implementation Pseudocode:**
```javascript
async function collectTimeseriesData(siteName, startTime, endTime, configuredPoints) {
  let cursor = null;
  let totalRecords = 0;

  do {
    // Fetch page from API
    const response = await fetchTimeseriesPage(siteName, startTime, endTime, cursor);

    // Filter for configured points (worker-side)
    const filteredData = response.data.filter(record =>
      configuredPoints.includes(record.point_name)
    );

    // Batch insert to D1
    await batchInsertTimeseries(filteredData);

    totalRecords += filteredData.length;
    cursor = response.pagination.next_cursor;

  } while (response.pagination.has_more);

  return totalRecords;
}
```

### 3. Worker-Side Filtering

#### Configuration-Based Point Selection

**Configuration Structure:**
```javascript
// wrangler.toml or environment variable
const CONFIGURED_POINTS = [
  "hvac_temp_zone1",
  "hvac_temp_zone2",
  "electrical_main_power",
  "electrical_lighting_power",
  "water_main_flow"
];
```

**Filtering Logic:**
```javascript
function filterConfiguredPoints(rawData, configuredPoints) {
  // Set for O(1) lookup performance
  const pointSet = new Set(configuredPoints);

  return rawData.filter(record => {
    // Include if point is configured
    if (pointSet.has(record.point_name)) {
      return true;
    }

    // Log skipped points for monitoring
    console.debug(`Skipped unconfigured point: ${record.point_name}`);
    return false;
  });
}
```

**Benefits:**
- Flexible point configuration without API changes
- Easy to add/remove monitored points
- Reduces storage costs by filtering early
- Maintains full data availability if needed later

### 4. Data Model

#### Unified Timeseries Table

**Schema: `timeseries_raw`**
```sql
CREATE TABLE timeseries_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,        -- ISO 8601 format
  value REAL NOT NULL,
  quality TEXT,                   -- Data quality indicator
  metadata TEXT,                  -- JSON string for additional fields
  collected_at TEXT NOT NULL,     -- ETL collection timestamp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_timeseries_site_point ON timeseries_raw(site_name, point_name);
CREATE INDEX idx_timeseries_timestamp ON timeseries_raw(timestamp);
CREATE INDEX idx_timeseries_site_timestamp ON timeseries_raw(site_name, timestamp);
```

**Weather Data Table**

**Schema: `weather_raw`**
```sql
CREATE TABLE weather_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  temperature REAL,
  humidity REAL,
  precipitation REAL,
  wind_speed REAL,
  conditions TEXT,
  metadata TEXT,                  -- JSON for additional fields
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_weather_site_timestamp ON weather_raw(site_name, timestamp);
```

**Benefits:**
- Single table per data type (simple, scalable)
- Easy to query across all points
- Natural partitioning by site_name
- Supports unlimited point types without schema changes

### 5. Batch Insert Strategy

#### D1 Client Library Integration

**Using Existing `d1-client.js`:**
```javascript
import { batchInsertTimeseries } from './d1-client.js';

async function processBatch(records) {
  // Transform API response to D1 format
  const d1Records = records.map(record => ({
    site_name: SITE_NAME,
    point_name: record.point_name,
    timestamp: record.timestamp,
    value: record.value,
    quality: record.quality || 'unknown',
    metadata: JSON.stringify(record.metadata || {}),
    collected_at: new Date().toISOString()
  }));

  // Use existing batch insert function
  await batchInsertTimeseries(d1Records);
}
```

**Batch Size Optimization:**
```javascript
const BATCH_SIZE = 1000;  // D1 optimal batch size

async function insertInBatches(records) {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await batchInsertTimeseries(batch);

    // Avoid rate limits
    if (i + BATCH_SIZE < records.length) {
      await sleep(100);  // 100ms delay between batches
    }
  }
}
```

## Data Flow Architecture

### Complete ETL Pipeline

```
┌───────────────────────────────────────────────────────────────┐
│                     ETL Worker (Cloudflare Worker)             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 1. SCHEDULED TRIGGER (Cron: 0 0 * * *)                 │  │
│  │    - Calculate time window (last 24 hours)              │  │
│  │    - Load configuration (sites, points)                 │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────▼────────────────────────────────────┐  │
│  │ 2. TIMESERIES COLLECTION                                │  │
│  │    GET /sites/{site}/timeseries/paginated               │  │
│  │    ├─► Initial request (no cursor)                      │  │
│  │    ├─► Receive 100k records + cursor                    │  │
│  │    ├─► Filter configured points                         │  │
│  │    ├─► Batch insert to D1 (1000 records/batch)         │  │
│  │    ├─► Request next page (with cursor)                  │  │
│  │    └─► Repeat until has_more = false                    │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────▼────────────────────────────────────┐  │
│  │ 3. WEATHER COLLECTION                                    │  │
│  │    GET /sites/{site}/weather                            │  │
│  │    ├─► Single request (24-hour window)                  │  │
│  │    ├─► Transform weather data                           │  │
│  │    └─► Batch insert to D1                               │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────▼────────────────────────────────────┐  │
│  │ 4. ERROR HANDLING & LOGGING                             │  │
│  │    ├─► Log success metrics                              │  │
│  │    ├─► Handle API errors (retry logic)                  │  │
│  │    ├─► Handle D1 errors (rollback if needed)            │  │
│  │    └─► Report to monitoring system                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 5. D1 DATABASE                                           │  │
│  │    ├─► timeseries_raw table (point data)                │  │
│  │    └─► weather_raw table (weather data)                 │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEMS                            │
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐      │
│  │   ACE IoT API       │         │   Dashboard/Apps    │      │
│  │   (Data Source)     │         │   (Data Consumer)   │      │
│  └─────────────────────┘         └─────────────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

### 1. API Error Handling

**Retry Strategy:**
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Handle specific error codes
      if (response.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry
        await sleep(1000 * attempt);
        continue;
      }

      // Client error (4xx) - don't retry
      throw new Error(`API error ${response.status}: ${await response.text()}`);

    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}
```

### 2. Database Error Handling

**Transaction-Based Inserts:**
```javascript
async function safeInsertBatch(records) {
  try {
    await env.DB.prepare('BEGIN TRANSACTION').run();

    await batchInsertTimeseries(records);

    await env.DB.prepare('COMMIT').run();

    return { success: true, count: records.length };

  } catch (error) {
    await env.DB.prepare('ROLLBACK').run();

    console.error('Database insert failed:', error);

    return { success: false, error: error.message };
  }
}
```

### 3. Partial Failure Recovery

**Checkpoint System:**
```javascript
// Store progress in KV for recovery
async function saveCheckpoint(siteName, timestamp, cursor) {
  const checkpoint = {
    site: siteName,
    last_timestamp: timestamp,
    cursor: cursor,
    saved_at: new Date().toISOString()
  };

  await env.KV.put(
    `checkpoint:${siteName}`,
    JSON.stringify(checkpoint),
    { expirationTtl: 86400 }  // 24 hour TTL
  );
}

async function recoverFromCheckpoint(siteName) {
  const data = await env.KV.get(`checkpoint:${siteName}`);
  return data ? JSON.parse(data) : null;
}
```

## Performance Considerations

### 1. API Rate Limits

**Considerations:**
- ACE IoT API rate limits (assumed: 100 req/min)
- Page size of 100k reduces API calls
- Cursor pagination maintains efficiency

**Throttling Strategy:**
```javascript
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000  // 1 minute
};

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      await sleep(waitTime);
    }

    this.requests.push(Date.now());
  }
}
```

### 2. Memory Management

**Streaming vs Buffering:**
```javascript
// Avoid loading entire dataset into memory
async function streamingCollection(siteName, startTime, endTime) {
  let cursor = null;
  let totalProcessed = 0;

  do {
    // Fetch page
    const page = await fetchPage(siteName, startTime, endTime, cursor);

    // Process immediately (don't accumulate)
    const filtered = filterPoints(page.data);
    await insertBatch(filtered);

    // Release memory
    page.data = null;
    filtered = null;

    totalProcessed += page.data.length;
    cursor = page.pagination.next_cursor;

  } while (cursor);

  return totalProcessed;
}
```

### 3. Worker Execution Time

**Cloudflare Worker Limits:**
- CPU time: 50ms per request (free), 30s (paid)
- For long-running ETL: use Durable Objects or queue-based processing

**Chunked Processing:**
```javascript
// Break into smaller scheduled jobs if needed
async function scheduledETL(event) {
  const timeWindows = generateTimeWindows(24);  // 24 x 1-hour chunks

  for (const window of timeWindows) {
    await processTimeWindow(window.start, window.end);

    // Check execution time
    if (Date.now() - event.scheduledTime > 25000) {
      // Approaching 30s limit - defer remaining windows
      await scheduleRemainingWindows(timeWindows.slice(timeWindows.indexOf(window) + 1));
      break;
    }
  }
}
```

## Weather Data Integration

### Collection Strategy

**Parallel Collection:**
```javascript
async function collectAllData(siteName, startTime, endTime) {
  // Collect timeseries and weather in parallel
  const [timeseriesResult, weatherResult] = await Promise.all([
    collectTimeseriesData(siteName, startTime, endTime),
    collectWeatherData(siteName, startTime, endTime)
  ]);

  return {
    timeseries: timeseriesResult,
    weather: weatherResult
  };
}
```

**Weather Data Transformation:**
```javascript
function transformWeatherData(weatherRecords, siteName) {
  return weatherRecords.map(record => ({
    site_name: siteName,
    timestamp: record.timestamp,
    temperature: record.temperature,
    humidity: record.humidity,
    precipitation: record.precipitation || 0.0,
    wind_speed: record.wind_speed || 0.0,
    conditions: record.conditions || 'unknown',
    metadata: JSON.stringify({
      raw: record,
      source: 'ace_iot_api'
    }),
    collected_at: new Date().toISOString()
  }));
}
```

## Monitoring & Observability

### Key Metrics

**Collection Metrics:**
- Total records collected per run
- API request count
- Pagination iterations
- Filtered vs total records ratio
- Collection duration

**Error Metrics:**
- API error rate (by status code)
- Database error rate
- Retry attempts
- Failed batches

**Data Quality Metrics:**
- Missing data gaps
- Duplicate records
- Invalid data points

**Implementation:**
```javascript
class ETLMetrics {
  constructor() {
    this.metrics = {
      api_requests: 0,
      records_fetched: 0,
      records_filtered: 0,
      records_inserted: 0,
      errors: [],
      duration_ms: 0
    };
  }

  async report() {
    // Send to monitoring system (e.g., CloudWatch, Datadog)
    await fetch('https://monitoring.example.com/metrics', {
      method: 'POST',
      body: JSON.stringify(this.metrics)
    });
  }
}
```

## Configuration Management

### Environment Variables

**Required Configuration:**
```toml
# wrangler.toml
[vars]
ACE_IOT_API_BASE_URL = "https://api.aceiot.com/v1"
SITE_NAME = "building-vitals-demo"
CONFIGURED_POINTS = '["hvac_temp_zone1","electrical_main_power","water_main_flow"]'
PAGE_SIZE = 100000
BATCH_INSERT_SIZE = 1000

[triggers]
crons = ["0 0 * * *"]  # Daily at midnight UTC

[[d1_databases]]
binding = "DB"
database_name = "building-vitals"
database_id = "your-d1-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

### Secrets Management

**Sensitive Configuration:**
```bash
# Store API credentials as secrets
wrangler secret put ACE_IOT_API_KEY
wrangler secret put ACE_IOT_API_SECRET
```

## Deployment Strategy

### Phased Rollout

**Phase 1: Validation (Week 1)**
- Deploy to staging environment
- Test with single site
- Validate API responses
- Verify data quality

**Phase 2: Limited Production (Week 2)**
- Deploy to production with single site
- Monitor for 48 hours
- Validate data consistency
- Check performance metrics

**Phase 3: Full Rollout (Week 3)**
- Expand to all configured sites
- Implement alerting
- Document operational procedures

### Rollback Plan

**Rollback Triggers:**
- Error rate > 10%
- Data quality issues detected
- Performance degradation

**Rollback Procedure:**
```bash
# Revert to previous version
wrangler rollback --version-id <previous-version-id>

# Disable scheduled trigger if needed
wrangler triggers disable
```

## Success Criteria

### Technical Metrics
- Zero 400 BAD REQUEST errors
- API success rate > 99.5%
- Data collection latency < 5 minutes
- Database insert success rate > 99.9%

### Business Metrics
- Complete 24-hour data coverage
- All configured points collected
- Weather data integration complete
- Historical data gap resolution

## Future Enhancements

### Potential Improvements
1. **Real-time Collection:** WebSocket or SSE for live data
2. **Data Aggregation:** Pre-compute hourly/daily aggregates
3. **Alerting:** Threshold-based alerts on point values
4. **Data Retention:** Automated archival of old data
5. **Multi-Region:** Deploy workers closer to API endpoints
6. **Advanced Filtering:** ML-based anomaly detection

## Appendix

### API Request Examples

**Timeseries Request:**
```bash
curl -X GET "https://api.aceiot.com/v1/sites/building-vitals-demo/timeseries/paginated?start_time=2024-01-01T00:00:00Z&end_time=2024-01-01T23:59:59Z&page_size=100000&raw_data=true" \
  -H "Authorization: Bearer ${API_KEY}"
```

**Weather Request:**
```bash
curl -X GET "https://api.aceiot.com/v1/sites/building-vitals-demo/weather?start_time=2024-01-01T00:00:00Z&end_time=2024-01-01T23:59:59Z" \
  -H "Authorization: Bearer ${API_KEY}"
```

### Database Migration Script

```sql
-- Create tables for new architecture
CREATE TABLE IF NOT EXISTS timeseries_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  value REAL NOT NULL,
  quality TEXT,
  metadata TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeseries_site_point ON timeseries_raw(site_name, point_name);
CREATE INDEX idx_timeseries_timestamp ON timeseries_raw(timestamp);
CREATE INDEX idx_timeseries_site_timestamp ON timeseries_raw(site_name, timestamp);

CREATE TABLE IF NOT EXISTS weather_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  temperature REAL,
  humidity REAL,
  precipitation REAL,
  wind_speed REAL,
  conditions TEXT,
  metadata TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_site_timestamp ON weather_raw(site_name, timestamp);
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Author:** Architecture Agent (SPARC Methodology)
**Status:** Ready for Implementation
