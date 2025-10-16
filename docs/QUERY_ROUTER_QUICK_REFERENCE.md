# Query Router Quick Reference

**Version:** 3.0
**Quick lookup for developers**

---

## Query Routing Decision Matrix

| Time Range | Strategy | Storage | Response Time | Cache TTL |
|-----------|----------|---------|---------------|-----------|
| Last 24 hours | D1_ONLY | Hot (D1) | <500ms | 5 min |
| Last 7 days | D1_ONLY | Hot (D1) | <500ms | 30 min |
| Last 30 days | D1_ONLY | Hot (D1) | <500ms | 1 hour |
| 30-90 days ago | R2_ONLY | Cold (R2) | <5s | 1 hour |
| >90 days ago | R2_ONLY | Cold (R2) | <5s | 24 hours |
| Spans boundary | SPLIT | Both | <5s | 30 min |

---

## API Usage

### Standard Query (Auto-Routing)
```http
GET /api/sites/{site}/timeseries/paginated?
  start_time=2025-09-01T00:00:00Z&
  end_time=2025-10-13T00:00:00Z&
  point_names=VAV-707-DaTemp,VAV-707-Damper
```

**Response includes routing metadata:**
```
X-Data-Source: D1 | R2 | BOTH | CACHE | ACE_API
X-Query-Strategy: D1_ONLY | R2_ONLY | SPLIT | LEGACY
X-Processing-Time: {ms}ms
X-Cache-Status: HIT | MISS
```

### Disable Routing (Legacy Mode)
```http
GET /api/sites/{site}/timeseries/paginated?
  start_time=...&
  end_time=...&
  use_routing=false
```

### Check System Status
```http
GET /api/health
```

**Response:**
```json
{
  "version": "3.0",
  "features": {
    "queryRouting": "enabled",
    "intelligentCaching": "enabled"
  },
  "routing": {
    "hotStorageDays": 30,
    "d1ResponseTime": "<500ms",
    "r2ResponseTime": "<5s"
  }
}
```

---

## Routing Strategies Explained

### D1_ONLY (Hot Storage)
**When:** All data is recent (<30 days old)

**Advantages:**
- Ultra-fast: <500ms
- Edge-optimized SQLite
- Pre-computed 1-min aggregations

**Best for:**
- Real-time dashboards
- Recent trend analysis
- Live monitoring

**Example:**
```
Today: 2025-10-13
Query: 2025-10-01 to 2025-10-13 (12 days)
→ D1_ONLY (all data is <30 days old)
```

---

### R2_ONLY (Cold Storage)
**When:** All data is historical (>30 days old)

**Advantages:**
- Handles large datasets
- Cost-effective storage
- DuckDB analytical queries
- Parquet columnar format

**Best for:**
- Historical reports
- Year-over-year comparisons
- Data exports

**Example:**
```
Today: 2025-10-13
Query: 2024-01-01 to 2024-12-31 (365 days)
→ R2_ONLY (all data is >30 days old)
```

---

### SPLIT (Hybrid)
**When:** Query spans hot and cold boundary (30 days ago)

**Advantages:**
- Gets best of both worlds
- Seamless data continuity
- Automatic merging

**How it works:**
1. Calculate split point (30 days ago)
2. Query R2 for old data (start → split)
3. Query D1 for recent data (split → end)
4. Merge results, deduplicate, sort
5. Return unified response

**Example:**
```
Today: 2025-10-13
30 days ago: 2025-09-13
Query: 2025-09-01 to 2025-10-13 (42 days)

Split:
  R2: 2025-09-01 to 2025-09-13 (cold)
  D1: 2025-09-13 to 2025-10-13 (hot)
→ SPLIT (merged results)
```

---

## Performance Characteristics

### D1 Query Time Formula
```
Response Time = 50ms + (rows / 1000) * 0.1ms
Max: 500ms
```

**Example:**
- 10,000 rows: 50 + (10 * 0.1) = 51ms
- 100,000 rows: 50 + (100 * 0.1) = 60ms
- 1,000,000 rows: 50 + (1000 * 0.1) = 150ms

### R2 Query Time Formula
```
Response Time = 500ms + (files * 200ms)
Max: 5000ms
```

**Example:**
- 1 month: 500 + (1 * 200) = 700ms
- 6 months: 500 + (6 * 200) = 1700ms
- 12 months: 500 + (12 * 200) = 2900ms

---

## Cache Strategy

### Cache Key Format
```
query:{hash}:{startTime}:{endTime}
```

**Example:**
```
query:a3f8d1:2025-10-01T00:00:00Z:2025-10-13T00:00:00Z
```

### Cache TTL by Data Age

| Data Age | TTL | Rationale |
|----------|-----|-----------|
| <1 day | 5 min | Real-time, changes frequently |
| 1-7 days | 30 min | Recent, moderate changes |
| 7-30 days | 1 hour | Semi-recent, stable |
| >30 days | 24 hours | Historical, rarely changes |

---

## Error Handling

### Automatic Fallback
If routing fails, automatically falls back to legacy ACE API:

```javascript
try {
  // Try intelligent routing
  return routedQuery();
} catch (error) {
  console.error('[ROUTING ERROR]', error);
  // Fallback to direct ACE API fetch
  return legacyQuery();
}
```

### Response Headers on Fallback
```
X-Data-Source: ACE_API
X-Query-Strategy: LEGACY
```

---

## Monitoring

### Key Metrics to Watch

1. **Query Distribution**
   ```
   D1_ONLY:  65% ← Most queries are recent
   R2_ONLY:  20%
   SPLIT:    10%
   LEGACY:    5% ← Fallbacks
   ```

2. **Response Times**
   ```
   D1 p50:   45ms
   D1 p95:  120ms
   D1 p99:  350ms

   R2 p50:  850ms
   R2 p95: 2400ms
   R2 p99: 4200ms
   ```

3. **Cache Hit Rates**
   ```
   Recent (<7d):     85%
   Historical (>30d): 70%
   Split:            45%
   ```

### Log Patterns

**Successful D1 Query:**
```
[QUERY ROUTER] { strategy: 'D1_ONLY', estimatedTime: '150ms' }
[D1 QUERY] Points: 2, Range: 2025-10-01 to 2025-10-13
[D1 RESULT] Rows: 34560
[QUERY COMPLETE] { dataSource: 'D1', processingTime: '142ms' }
```

**Successful Split Query:**
```
[QUERY ROUTER] { strategy: 'SPLIT', splitPoint: '2025-09-13' }
[R2 QUERY] Points: 2, Range: 2025-09-01 to 2025-09-13
[R2 RESULT] Files: 1
[D1 QUERY] Points: 2, Range: 2025-09-13 to 2025-10-13
[D1 RESULT] Rows: 57600
[QUERY COMPLETE] { dataSource: 'BOTH', processingTime: '1156ms' }
```

**Fallback to Legacy:**
```
[ROUTING ERROR] D1 database unavailable
[FALLBACK] Using legacy ACE API direct fetch
[LEGACY MODE] Direct ACE API fetch
```

---

## Configuration

### Required Bindings (wrangler.toml)

```toml
# D1 Database (required for hot storage)
[[d1_databases]]
binding = "DB"
database_name = "timeseries-hot"

# R2 Bucket (required for cold storage)
[[r2_buckets]]
binding = "R2"
bucket_name = "timeseries-cold"

# KV Store (required for caching)
[[kv_namespaces]]
binding = "POINTS_KV"
```

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `use_routing` | `true` | Enable intelligent routing |
| `bypass_cache` | `false` | Skip cache lookup |

---

## Common Scenarios

### Scenario 1: Dashboard Loading (Last 24 Hours)
```
Request: Last 24 hours, 10 points
Strategy: D1_ONLY
Response Time: ~80ms
Cache TTL: 5 minutes
Data Source: D1
```

### Scenario 2: Monthly Report (Last 30 Days)
```
Request: Last 30 days, 50 points
Strategy: D1_ONLY or SPLIT (depends on boundary)
Response Time: ~200ms (D1) or ~1s (SPLIT)
Cache TTL: 1 hour
Data Source: D1 or BOTH
```

### Scenario 3: Annual Analysis (Last 365 Days)
```
Request: Last 365 days, 50 points
Strategy: SPLIT
Response Time: ~3s
Cache TTL: 30 minutes
Data Source: BOTH
```

### Scenario 4: Historical Comparison (2024 vs 2023)
```
Request: All of 2024, 20 points
Strategy: R2_ONLY (all historical)
Response Time: ~2.5s
Cache TTL: 24 hours
Data Source: R2
```

---

## Troubleshooting

### Issue: Slow Queries
**Check:**
1. Which strategy is being used? (X-Query-Strategy header)
2. Is cache being hit? (X-Cache-Status header)
3. How many points are being queried?
4. What's the time range?

**Solutions:**
- Reduce time range for R2 queries
- Use aggregations for large datasets
- Check cache hit rates

### Issue: No Routing (Always LEGACY)
**Check:**
1. Are D1 and R2 bindings configured?
2. Check health endpoint: `/api/health`
3. Look for `queryRouting: enabled`

**Solutions:**
- Verify wrangler.toml bindings
- Check D1 database exists
- Check R2 bucket exists

### Issue: Data Missing
**Check:**
1. Is data populated in D1/R2?
2. Check log for "Rows: 0" or "Files: 0"
3. Verify time range

**Solutions:**
- Run data migration scripts
- Check D1 data freshness
- Verify R2 file organization

---

## Quick Tips

1. Use `X-Data-Source` header to understand where data came from
2. Monitor `X-Processing-Time` to detect performance issues
3. Cache is automatic and transparent
4. Routing is backward compatible - no frontend changes needed
5. Use `?use_routing=false` to test legacy behavior
6. Check `/api/health` to verify system status

---

## Links

- Full Documentation: `/docs/QUERY_OPTIMIZER_IMPLEMENTATION.md`
- Architecture: `/docs/CLOUDFLARE_ARCHITECTURE.md`
- Source Code: `src/lib/query-router.js`
