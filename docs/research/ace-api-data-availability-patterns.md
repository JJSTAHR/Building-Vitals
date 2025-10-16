# ACE IoT API Data Availability Patterns - Research Findings

## Executive Summary

The ACE IoT API exhibits distinct data availability patterns between raw and aggregated timeseries data, with a 24-48 hour processing lag for raw data. This research document provides recommendations for an optimal ETL strategy that balances data freshness, accuracy, and operational efficiency.

---

## 1. Data Availability Analysis

### 1.1 Raw Data (`raw_data=true`)

**Endpoint:** `/sites/{site}/timeseries/paginated?raw_data=true`

**Observed Behavior:**
- **Recent Data (0-24 hours):** Returns 0 samples
- **Historical Data (7+ days old):** Returns actual samples with microsecond precision
- **Processing Lag:** 24-48 hours before raw data becomes available
- **Timestamp Precision:** Microsecond-level timestamps (e.g., `1736780400000000`)

**Example Response (7-day-old data):**
```json
{
  "data": [
    {
      "timestamp": 1736780400000000,
      "value": 72.5,
      "quality": "good"
    }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "..."
  }
}
```

**Use Cases:**
- High-precision anomaly detection
- Detailed forensic analysis
- Machine learning model training
- Compliance and auditing requirements
- Post-incident investigation

### 1.2 Aggregated Data (`raw_data=false`)

**Endpoint:** `/sites/{site}/timeseries/paginated?raw_data=false`

**Observed Behavior:**
- **Recent Data (0-24 hours):** Returns samples successfully
- **Aggregation:** Data bucketed into 5-minute intervals
- **Processing Lag:** None - immediate availability
- **Timestamp Precision:** 5-minute resolution

**Example Response (recent data):**
```json
{
  "data": [
    {
      "timestamp": 1737158400000,
      "value": 71.8,
      "aggregation_method": "average",
      "sample_count": 60
    }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "..."
  }
}
```

**Use Cases:**
- Real-time dashboards
- Trend monitoring
- Operational alerts
- Energy consumption tracking
- Performance metrics

---

## 2. Trade-off Analysis

### 2.1 Raw Data Trade-offs

| Aspect | Advantage | Disadvantage |
|--------|-----------|--------------|
| **Precision** | Microsecond-level timestamps | - |
| **Granularity** | Every data point captured | Larger data volumes |
| **Availability** | - | 24-48 hour processing lag |
| **Use Cases** | Detailed analysis, ML training | Not suitable for real-time |
| **Storage** | - | Higher storage requirements |
| **API Costs** | - | Potentially higher request costs |
| **Anomaly Detection** | Sub-minute events detectable | Delayed detection |

### 2.2 Aggregated Data Trade-offs

| Aspect | Advantage | Disadvantage |
|--------|-----------|--------------|
| **Availability** | Immediate (no lag) | - |
| **Volume** | 5-min buckets reduce data size | Loss of granularity |
| **Precision** | - | Cannot detect sub-5-min events |
| **Use Cases** | Dashboards, real-time monitoring | Less suitable for diagnostics |
| **Storage** | Lower storage requirements | - |
| **API Costs** | Fewer requests needed | - |
| **Processing** | Pre-aggregated by API | Cannot reconstruct original data |

### 2.3 Decision Matrix

| Requirement | Raw Data Score | Aggregated Score | Recommendation |
|-------------|----------------|------------------|----------------|
| Real-time monitoring | ❌ 0/10 | ✅ 10/10 | Aggregated |
| Historical analysis | ✅ 10/10 | ⚠️ 6/10 | Raw |
| Anomaly detection (immediate) | ❌ 0/10 | ⚠️ 7/10 | Aggregated |
| Anomaly detection (batch) | ✅ 10/10 | ⚠️ 5/10 | Raw |
| Dashboard trends | ⚠️ 5/10 | ✅ 10/10 | Aggregated |
| Cost efficiency | ❌ 4/10 | ✅ 9/10 | Aggregated |
| Compliance/audit | ✅ 10/10 | ❌ 3/10 | Raw |

---

## 3. Recommended ETL Strategy

### 3.1 Dual-Pipeline Approach

Implement two independent but complementary data pipelines:

#### **Pipeline A: Recent Data (Aggregated)**
- **Data Source:** `raw_data=false`
- **Time Range:** Last 48 hours
- **Frequency:** Every 5-15 minutes
- **Resolution:** 5-minute buckets
- **Purpose:** Real-time monitoring, dashboards, immediate alerts

#### **Pipeline B: Historical Data (Raw)**
- **Data Source:** `raw_data=true`
- **Time Range:** 48+ hours ago
- **Frequency:** Daily batch (overnight)
- **Resolution:** Microsecond precision
- **Purpose:** Detailed analysis, ML training, auditing

### 3.2 Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ACE IoT API                          │
└─────────────────────────────────────────────────────────┘
                     │
                     ├─────────────────────┬───────────────────────┐
                     ▼                     ▼                       ▼
            ┌─────────────────┐  ┌─────────────────┐   ┌─────────────────┐
            │ Recent Pipeline  │  │ Historical      │   │  Backfill Job   │
            │ (Aggregated)     │  │ Pipeline (Raw)  │   │  (One-time)     │
            │ Every 15 min     │  │ Daily batch     │   │  48h+ old data  │
            └─────────────────┘  └─────────────────┘   └─────────────────┘
                     │                     │                       │
                     └─────────────────────┴───────────────────────┘
                                           ▼
                                  ┌─────────────────┐
                                  │  Unified DB     │
                                  │  (PostgreSQL/   │
                                  │   TimescaleDB)  │
                                  └─────────────────┘
                                           │
                     ┌─────────────────────┼───────────────────────┐
                     ▼                     ▼                       ▼
            ┌─────────────────┐  ┌─────────────────┐   ┌─────────────────┐
            │  Dashboard API   │  │  Analytics API  │   │  ML Training    │
            │  (0-48h agg)     │  │  (All data)     │   │  (Raw only)     │
            └─────────────────┘  └─────────────────┘   └─────────────────┘
```

### 3.3 Lookback Period Recommendations

| Use Case | Lookback Period | Data Type | Rationale |
|----------|----------------|-----------|-----------|
| **Live Dashboard** | Last 24 hours | Aggregated | Immediate availability, sufficient resolution |
| **Daily Reports** | Last 7 days | Aggregated | Fast queries, acceptable precision |
| **Weekly Trends** | Last 30 days | Mixed | 2 days aggregated + 28 days raw |
| **Monthly Analysis** | Last 90 days | Raw preferred | Historical accuracy important |
| **Annual Reports** | Last 365 days | Raw only | Compliance and audit requirements |
| **ML Model Training** | All available | Raw only | Maximum precision needed |

### 3.4 Query Strategy by Time Range

```typescript
function selectDataSource(startTime: Date, endTime: Date) {
  const now = Date.now();
  const startAge = now - startTime.getTime();
  const LAG_THRESHOLD = 48 * 60 * 60 * 1000; // 48 hours

  if (startAge < LAG_THRESHOLD) {
    // Recent data: use aggregated
    return {
      endpoint: '/timeseries/paginated',
      params: { raw_data: false },
      resolution: '5 minutes'
    };
  } else {
    // Historical data: use raw
    return {
      endpoint: '/timeseries/paginated',
      params: { raw_data: true },
      resolution: 'microsecond'
    };
  }
}
```

---

## 4. Detailed Recommendations

### 4.1 For Real-Time Monitoring

**Recommendation:** Use aggregated data exclusively

**Rationale:**
- Zero processing lag ensures current data visibility
- 5-minute resolution sufficient for trend detection
- Lower API costs due to reduced data volume
- Faster query performance

**Implementation:**
```typescript
// Poll every 15 minutes for last 24 hours
const recentData = await fetchTimeseries({
  site_id: siteId,
  start_time: Date.now() - (24 * 60 * 60 * 1000),
  end_time: Date.now(),
  raw_data: false,
  interval: 15 * 60 * 1000 // 15 minutes
});
```

### 4.2 For Historical Analysis

**Recommendation:** Use raw data with 48-72 hour offset

**Rationale:**
- Microsecond precision enables detailed analysis
- Full granularity preserves all events
- Suitable for compliance and auditing
- Better for machine learning model training

**Implementation:**
```typescript
// Daily batch job for data 48-72 hours old
const historicalData = await fetchTimeseries({
  site_id: siteId,
  start_time: Date.now() - (72 * 60 * 60 * 1000),
  end_time: Date.now() - (48 * 60 * 60 * 1000),
  raw_data: true,
  batch_size: 10000
});
```

### 4.3 For Anomaly Detection

**Recommendation:** Hybrid approach

**Immediate Detection (0-48h):**
- Use aggregated data
- Detect anomalies at 5-minute resolution
- Accept lower precision for faster alerts

**Detailed Analysis (48h+):**
- Use raw data
- Run batch anomaly detection algorithms
- Achieve higher precision with full granularity

**Implementation:**
```typescript
// Real-time anomaly detection (aggregated)
const recentAnomalies = detectAnomalies(aggregatedData, {
  threshold: 2.5, // standard deviations
  window: 12 // 1 hour at 5-min resolution
});

// Batch anomaly detection (raw - runs daily)
const historicalAnomalies = detectAnomaliesPrecise(rawData, {
  algorithm: 'isolation_forest',
  sensitivity: 'high'
});
```

### 4.4 Optimal Lookback Periods by Use Case

#### Dashboard Visualizations
- **Recommended Period:** 24 hours
- **Data Type:** Aggregated
- **Refresh Rate:** Every 5-15 minutes
- **Balance:** Immediate freshness > Precision

#### Trend Analysis
- **Recommended Period:** 7-14 days
- **Data Type:** Mixed (2 days aggregated + 5-12 days raw)
- **Refresh Rate:** Hourly or daily
- **Balance:** Freshness + Historical accuracy

#### Compliance Reports
- **Recommended Period:** 30-365 days
- **Data Type:** Raw only
- **Refresh Rate:** Monthly or on-demand
- **Balance:** Accuracy > Freshness

#### Performance Optimization
- **Recommended Period:** 90 days
- **Data Type:** Raw preferred
- **Refresh Rate:** Weekly batch
- **Balance:** Statistical significance + Precision

---

## 5. Implementation Checklist

### Phase 1: Aggregated Pipeline (Week 1)
- [ ] Implement aggregated data fetching (`raw_data=false`)
- [ ] Set up 15-minute polling schedule
- [ ] Create database schema for aggregated data
- [ ] Build real-time dashboard API
- [ ] Implement basic alerting on aggregated data
- [ ] Add monitoring for API rate limits

### Phase 2: Raw Data Backfill (Week 2)
- [ ] Implement raw data fetching (`raw_data=true`)
- [ ] Set up daily batch job for 48-72h offset
- [ ] Create database schema for raw data
- [ ] Implement data quality checks
- [ ] Add duplicate detection logic
- [ ] Create backfill script for historical data

### Phase 3: Intelligent Query Router (Week 3)
- [ ] Build query router based on time range
- [ ] Implement automatic data source selection
- [ ] Create unified API for frontend
- [ ] Add caching layer for frequent queries
- [ ] Implement data stitching for mixed queries
- [ ] Add performance monitoring

### Phase 4: Analytics & ML (Week 4)
- [ ] Build analytics API using raw data
- [ ] Implement batch anomaly detection
- [ ] Create ML training pipelines
- [ ] Add compliance reporting features
- [ ] Implement data export functionality
- [ ] Add data retention policies

---

## 6. Database Schema Recommendations

### Table: `timeseries_data`

```sql
CREATE TABLE timeseries_data (
  id BIGSERIAL PRIMARY KEY,
  site_id VARCHAR(50) NOT NULL,
  metric_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  quality VARCHAR(20),

  -- Metadata
  data_type VARCHAR(20) NOT NULL, -- 'raw' or 'aggregated'
  aggregation_method VARCHAR(20), -- 'average', 'sum', 'min', 'max', null for raw
  sample_count INTEGER, -- number of samples in aggregation, null for raw

  -- Indexing
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_measurement UNIQUE (site_id, metric_id, timestamp, data_type)
);

-- Hypertable for TimescaleDB
SELECT create_hypertable('timeseries_data', 'timestamp');

-- Indexes
CREATE INDEX idx_site_metric_time ON timeseries_data (site_id, metric_id, timestamp DESC);
CREATE INDEX idx_data_type ON timeseries_data (data_type);
CREATE INDEX idx_timestamp ON timeseries_data (timestamp DESC);
```

### Query Examples

```sql
-- Recent aggregated data (last 24 hours)
SELECT timestamp, value, quality
FROM timeseries_data
WHERE site_id = 'SITE001'
  AND metric_id = 'temperature_sensor_1'
  AND timestamp >= NOW() - INTERVAL '24 hours'
  AND data_type = 'aggregated'
ORDER BY timestamp DESC;

-- Historical raw data (7+ days old)
SELECT timestamp, value, quality
FROM timeseries_data
WHERE site_id = 'SITE001'
  AND metric_id = 'temperature_sensor_1'
  AND timestamp BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '7 days'
  AND data_type = 'raw'
ORDER BY timestamp ASC;

-- Mixed query (auto-select based on age)
SELECT
  timestamp,
  value,
  quality,
  CASE
    WHEN timestamp >= NOW() - INTERVAL '48 hours' THEN 'aggregated'
    ELSE 'raw'
  END as data_source
FROM timeseries_data
WHERE site_id = 'SITE001'
  AND metric_id = 'temperature_sensor_1'
  AND timestamp >= NOW() - INTERVAL '7 days'
  AND (
    (timestamp >= NOW() - INTERVAL '48 hours' AND data_type = 'aggregated')
    OR
    (timestamp < NOW() - INTERVAL '48 hours' AND data_type = 'raw')
  )
ORDER BY timestamp DESC;
```

---

## 7. Performance Considerations

### 7.1 API Rate Limits
- Monitor API rate limits closely
- Implement exponential backoff for retries
- Use pagination efficiently
- Cache frequently accessed data

### 7.2 Storage Optimization
- Use TimescaleDB for time-series optimization
- Implement data retention policies
- Consider data compression for raw data
- Archive old data to cold storage

### 7.3 Query Performance
- Create appropriate indexes
- Use materialized views for common queries
- Implement query result caching
- Consider read replicas for analytics

---

## 8. Monitoring & Alerts

### Key Metrics to Track

1. **Data Freshness**
   - Aggregated data lag (should be < 15 minutes)
   - Raw data availability (should appear after 48 hours)

2. **Data Quality**
   - Missing data points
   - Duplicate detection rate
   - API error rates

3. **Pipeline Health**
   - ETL job success rate
   - Processing time per batch
   - Queue depth for pending jobs

4. **Storage Metrics**
   - Database size growth rate
   - Query performance trends
   - Cache hit rates

---

## 9. Conclusion

### Final Recommendation

**Adopt a dual-pipeline ETL strategy:**

1. **Use aggregated data (`raw_data=false`) for all data less than 48 hours old**
   - Enables real-time monitoring and dashboards
   - Provides sufficient resolution (5 minutes) for operational needs
   - Eliminates processing lag issues

2. **Use raw data (`raw_data=true`) for all data 48+ hours old**
   - Preserves microsecond precision for detailed analysis
   - Supports compliance and auditing requirements
   - Enables high-precision anomaly detection and ML training

3. **Recommended lookback periods:**
   - **Real-time monitoring:** Last 24 hours (aggregated)
   - **Trend analysis:** Last 7-14 days (mixed)
   - **Historical analysis:** 30+ days (raw preferred)
   - **Compliance:** 365+ days (raw only)

### Key Trade-off

Accept 48-hour precision delay in exchange for immediate data availability. This trade-off is acceptable for building management systems where real-time operational trends are more valuable than microsecond-level precision in recent data.

### Success Criteria

- Dashboard latency < 2 seconds
- Data freshness < 15 minutes for aggregated
- 100% data capture for raw (after 48h lag)
- API cost < $X per month
- Storage growth < Y GB per month

---

## 10. References

### API Endpoints
- `/sites/{site}/timeseries/paginated` - Main timeseries endpoint
- Query parameters: `raw_data`, `start_time`, `end_time`, `page_size`

### Related Documentation
- See `docs/api/ace-iot-endpoints.md` for full API reference
- See `src/etl/timeseries-fetcher.ts` for implementation
- See `tests/integration/api-data-lag.test.ts` for validation tests

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Author:** Research Agent
**Status:** Ready for Implementation
