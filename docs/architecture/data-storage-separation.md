# Architecture Decision Record: Data Storage Separation Strategy

**Status**: PROPOSED
**Date**: 2025-10-15
**Decision Owner**: System Architecture Team
**Review Status**: Pending stakeholder approval

---

## Executive Summary

This ADR proposes a **unified table strategy** for timeseries data storage, consolidating both raw and aggregated data into a single `timeseries_raw` table with interval metadata. This decision deprecates the unused `timeseries_agg` table while maintaining backward compatibility and enabling future multi-resolution storage.

**Key Decision**: Use `timeseries_raw` as the single source of truth for all timeseries data, with an `interval` field to distinguish aggregation levels.

---

## Context and Problem Statement

### Current State Analysis

The existing D1 schema (defined in `workers/schema/d1-schema.sql`) includes two tables:

1. **`timeseries_raw`** (Lines 14-33)
   - **Intended purpose**: Store raw 1-minute samples (hot storage, last 20 days)
   - **Current usage**: Stores 5-minute aggregated data from ACE API
   - **Schema**: `(site_name, point_name, timestamp, value)`
   - **Primary Key**: `(site_name, point_name, timestamp)`

2. **`timeseries_agg`** (Lines 42-59)
   - **Intended purpose**: Store aggregated data with metadata (avg, min, max, sample_count)
   - **Current usage**: UNUSED - never written to by ETL Worker
   - **Schema**: `(site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)`
   - **Primary Key**: `(site_name, point_name, interval, timestamp)`

### Problems Identified

1. **Schema-Reality Mismatch**
   - ETL Worker (`src/etl-sync-worker.js:318`) writes aggregated data to `timeseries_raw` using field name `avg_value`
   - Schema expects `value` field (line 18)
   - Field naming inconsistency causes confusion

2. **Unused Aggregation Table**
   - `timeseries_agg` table exists but is never populated
   - Wasted storage capacity and query optimization potential
   - Misleading schema comments suggest it's used for cold storage metadata (lines 36-40)

3. **Single Data Source Reality**
   - ACE API only provides **aggregated data** (`raw_data=false`, 5-min buckets)
   - No raw 1-minute samples are available from upstream
   - Dual-table design assumes data aggregation happens in ETL, which is false

4. **Query Worker Limitations**
   - Query Worker (`src/query-worker.js:586`) only queries `timeseries_raw`
   - No routing logic to distinguish between raw vs aggregated data
   - Cannot support multiple aggregation levels (1min, 5min, 1hr, 1day)

5. **Storage Tier Confusion**
   - Schema comments (lines 7-12) claim `timeseries_raw` is for raw data <20 days
   - Comments (lines 36-40) claim `timeseries_agg` is for R2 cold storage metadata
   - Reality: Both hot (D1) and cold (R2) storage use same data format

---

## Decision Drivers

### Technical Requirements

1. **Data Source Constraint**: ACE API only provides aggregated data (5-min buckets)
2. **Storage Efficiency**: Minimize duplicate data across tables
3. **Query Performance**: Single-table queries are faster than joins
4. **Future-Proofing**: Support multiple aggregation levels (1min, 5min, 1hr, 1day)
5. **Backward Compatibility**: Existing queries must continue to work

### Business Requirements

1. **Operational Simplicity**: Reduce complexity for developers and operators
2. **Cost Optimization**: Minimize D1 storage and query costs
3. **Scalability**: Handle increasing data volumes and query loads
4. **Data Integrity**: Maintain consistency across hot and cold storage

---

## Decision

**DECISION**: Adopt a **unified table strategy** using `timeseries_raw` as the single timeseries storage table.

### Key Changes

1. **Schema Migration**
   - **Rename field**: `avg_value` → `value` (standardize naming)
   - **Add field**: `interval TEXT NOT NULL DEFAULT '5min'` (aggregation level)
   - **Update primary key**: `(site_name, point_name, interval, timestamp)`
   - **Add index**: `idx_timeseries_interval` on `(site_name, interval, timestamp DESC)`

2. **Table Deprecation**
   - **Mark `timeseries_agg` as DEPRECATED** but do not drop (backward compatibility)
   - Add schema comments indicating deprecated status
   - No new writes to `timeseries_agg`

3. **ETL Worker Changes**
   - Update `batchInsertTimeseries()` to include `interval: '5min'` field
   - Rename `avg_value` to `value` in transformation logic
   - Document ACE API data source characteristics

4. **Query Worker Changes**
   - Update D1 queries to include `interval` in WHERE clause
   - Add interval-based routing logic for future multi-resolution support
   - Maintain backward compatibility for existing queries without interval parameter

---

## Rationale

### Why Single Table?

1. **Data Source Reality**
   - ACE API provides only aggregated data (5-min buckets)
   - No raw 1-minute samples exist to populate separate tables
   - Dual-table design was based on incorrect assumption about data availability

2. **Simplicity**
   - Single table = simpler queries, fewer joins, better performance
   - Easier to maintain consistency across hot and cold storage
   - Reduces operational complexity for developers

3. **Storage Efficiency**
   - Eliminates redundant storage of same data in multiple tables
   - Better compression and index utilization
   - Reduced storage costs on D1 (pay-per-GB model)

4. **Query Performance**
   - Single-table queries are faster than multi-table queries
   - Composite primary key enables efficient point-in-time lookups
   - Interval field allows selective queries by aggregation level

### Why Add Interval Field?

1. **Future-Proofing**
   - Enables storing multiple aggregation levels (1min, 5min, 1hr, 1day)
   - Supports downsampling strategies for long-term storage
   - Allows ACE API to evolve and provide additional resolutions

2. **Query Flexibility**
   - Users can request specific aggregation levels
   - Query Worker can route to optimal resolution
   - Supports hybrid queries (e.g., 5min for recent, 1hr for historical)

3. **Backward Compatibility**
   - Default value `'5min'` maintains current behavior
   - Existing queries continue to work without modification
   - Gradual migration path for consumers

### Why Deprecate timeseries_agg?

1. **No Active Usage**
   - Table is never written to by any worker
   - No queries depend on this table
   - Safe to deprecate without breaking changes

2. **Schema Misleading**
   - Comments suggest it's for R2 cold storage metadata
   - Reality: R2 stores data in Parquet files, not D1 metadata
   - Table design doesn't match actual cold storage architecture

3. **Maintenance Burden**
   - Unused tables require migration scripts, backups, monitoring
   - Confuses new developers learning the system
   - Clean deprecation improves codebase clarity

---

## Migration Plan

### Phase 1: Schema Migration (Non-Breaking)

**Objective**: Add new fields to `timeseries_raw` while maintaining compatibility

```sql
-- Add interval column with default value (backward compatible)
ALTER TABLE timeseries_raw
ADD COLUMN interval TEXT NOT NULL DEFAULT '5min';

-- Add index for interval-based queries
CREATE INDEX IF NOT EXISTS idx_timeseries_interval
  ON timeseries_raw(site_name, interval, timestamp DESC);

-- Mark timeseries_agg as deprecated (comment only, no data change)
-- Add comment to schema file indicating deprecation
```

**Validation**:
- Verify all existing queries continue to work
- Test performance of interval-indexed queries
- Confirm default value applies to existing rows

### Phase 2: ETL Worker Update (Breaking for New Data)

**Objective**: Update ETL Worker to write with new schema

**Changes in `src/etl-sync-worker.js`**:

```javascript
// OLD (lines 313-319)
return {
  site_name: siteName,
  point_name: sample.name,
  timestamp, // milliseconds
  avg_value: value  // ❌ Field name mismatch
};

// NEW
return {
  site_name: siteName,
  point_name: sample.name,
  timestamp, // milliseconds
  value: value,  // ✅ Standardized field name
  interval: '5min'  // ✅ Explicit aggregation level
};
```

**Validation**:
- Run ETL Worker in staging environment
- Verify data writes succeed with new schema
- Check Query Worker can read new data format

### Phase 3: Query Worker Update (Non-Breaking)

**Objective**: Update Query Worker to use interval field

**Changes in `src/query-worker.js`**:

```javascript
// OLD (lines 581-591)
const query = `
  SELECT
    point_name,
    timestamp,
    value
  FROM timeseries_raw
  WHERE site_name = ?
    AND point_name IN (${placeholders})
    AND timestamp BETWEEN ? AND ?
  ORDER BY point_name, timestamp ASC
`;

// NEW
const query = `
  SELECT
    point_name,
    timestamp,
    value,
    interval
  FROM timeseries_raw
  WHERE site_name = ?
    AND interval = ?  -- Default to 5min for now
    AND point_name IN (${placeholders})
    AND timestamp BETWEEN ? AND ?
  ORDER BY point_name, timestamp ASC
`;

// Add interval to bind parameters
const stmt = db.prepare(query).bind(
  siteName,
  queryParams.interval || '5min',  // Default to current behavior
  ...pointNames,
  startTimeSec,
  endTimeSec
);
```

**Validation**:
- Test queries with and without interval parameter
- Verify backward compatibility for existing consumers
- Benchmark query performance vs old schema

### Phase 4: Data Backfill (Optional)

**Objective**: Populate interval field for historical data in R2

**Steps**:
1. Create backfill script to read Parquet files from R2
2. Add `interval: '5min'` metadata to all records
3. Write updated Parquet files back to R2
4. Verify data integrity with spot checks

**Timeline**: Low priority, can be deferred if storage costs acceptable

### Phase 5: Deprecation Notice (Documentation)

**Objective**: Inform stakeholders about timeseries_agg deprecation

**Actions**:
1. Update schema documentation to mark `timeseries_agg` as DEPRECATED
2. Add migration guide for any external consumers (unlikely)
3. Set calendar reminder for Phase 6 (6 months from now)

### Phase 6: Table Removal (Future)

**Objective**: Drop unused `timeseries_agg` table after grace period

**Conditions**:
- At least 6 months have passed since deprecation notice
- No external dependencies discovered
- All stakeholders acknowledged deprecation

**Command**:
```sql
DROP TABLE IF EXISTS timeseries_agg;
DROP VIEW IF EXISTS v_latest_values;  -- Depends on timeseries_agg
```

---

## Query Worker Routing Logic

### Current Behavior (No Interval Support)

```javascript
function determineRoutingStrategy(queryParams) {
  const now = Date.now();
  const hotBoundary = now - (20 * 24 * 60 * 60 * 1000);

  if (queryParams.end_time < hotBoundary) {
    return { type: 'R2_ONLY' };  // All cold data
  } else if (queryParams.start_time >= hotBoundary) {
    return { type: 'D1_ONLY' };  // All hot data
  } else {
    return { type: 'SPLIT' };    // Mixed hot/cold
  }
}
```

### Enhanced Behavior (With Interval Support)

```javascript
function determineRoutingStrategy(queryParams) {
  const now = Date.now();
  const hotBoundary = now - (20 * 24 * 60 * 60 * 1000);

  // NEW: Interval-aware routing
  const requestedInterval = queryParams.interval || '5min';

  // For now, all intervals stored in same tables
  // Future: Could route 1hr/1day aggregations to separate cold storage

  if (queryParams.end_time < hotBoundary) {
    return {
      type: 'R2_ONLY',
      interval: requestedInterval
    };
  } else if (queryParams.start_time >= hotBoundary) {
    return {
      type: 'D1_ONLY',
      interval: requestedInterval
    };
  } else {
    return {
      type: 'SPLIT',
      interval: requestedInterval
    };
  }
}
```

### Future: Multi-Resolution Routing

```javascript
// FUTURE: Optimize by automatically selecting best resolution
function determineRoutingStrategy(queryParams) {
  const rangeMs = queryParams.end_time - queryParams.start_time;
  const rangeDays = rangeMs / (1000 * 60 * 60 * 24);

  // Auto-select optimal interval if not specified
  let interval = queryParams.interval;
  if (!interval) {
    if (rangeDays <= 1) {
      interval = '1min';    // High resolution for short ranges
    } else if (rangeDays <= 7) {
      interval = '5min';    // Medium resolution for week
    } else if (rangeDays <= 30) {
      interval = '1hr';     // Low resolution for month
    } else {
      interval = '1day';    // Daily aggregation for long ranges
    }
  }

  // ... existing routing logic with interval parameter
}
```

---

## Backward Compatibility Approach

### Guarantees

1. **Existing Queries Continue to Work**
   - Default `interval='5min'` maintains current behavior
   - Field rename (`avg_value` → `value`) handled in migration
   - Query Worker maintains same response format

2. **No Breaking API Changes**
   - `/timeseries/query` endpoint signature unchanged
   - Response structure remains compatible
   - Optional `interval` parameter added without requiring changes

3. **Gradual Migration Path**
   - Phase 1-3 can be deployed independently
   - Each phase includes rollback plan
   - No "big bang" deployment required

### Risk Mitigation

1. **Data Loss Prevention**
   - Schema migration is additive only (no DROP/DELETE)
   - Deprecated table kept for 6+ months grace period
   - Backups taken before each migration phase

2. **Performance Regression**
   - Benchmark queries before and after migration
   - Monitor D1 query latency in production
   - Rollback plan: Add `WHERE interval='5min'` to all queries

3. **Consumer Impact**
   - Communicate changes to API consumers
   - Provide 30-day notice before Phase 2 deployment
   - Offer backward-compatible wrapper if needed

---

## Implementation Checklist

### Pre-Migration

- [ ] Review this ADR with stakeholders
- [ ] Get approval from system architect
- [ ] Schedule deployment window (low-traffic period)
- [ ] Create database backup
- [ ] Set up monitoring alerts for errors

### Phase 1: Schema Migration

- [ ] Write and test migration script
- [ ] Run migration in staging environment
- [ ] Validate existing queries work unchanged
- [ ] Deploy migration to production
- [ ] Monitor D1 query performance for 24 hours

### Phase 2: ETL Worker Update

- [ ] Update ETL Worker code
- [ ] Add unit tests for new data format
- [ ] Deploy to staging and run test sync
- [ ] Verify data written with correct schema
- [ ] Deploy to production
- [ ] Monitor sync metrics for 1 week

### Phase 3: Query Worker Update

- [ ] Update Query Worker code
- [ ] Add integration tests for interval parameter
- [ ] Deploy to staging
- [ ] Run load tests to compare performance
- [ ] Deploy to production
- [ ] Monitor query latency for 1 week

### Phase 4: Documentation

- [ ] Update API documentation with interval parameter
- [ ] Add deprecation notice for timeseries_agg
- [ ] Update architecture diagrams
- [ ] Write migration guide for consumers

### Phase 5: Validation

- [ ] Run end-to-end tests across all environments
- [ ] Verify data consistency between D1 and R2
- [ ] Check query response times meet SLAs
- [ ] Confirm no errors in production logs

---

## Alternatives Considered

### Alternative 1: Keep Dual-Table Design

**Description**: Continue using both `timeseries_raw` and `timeseries_agg` tables as originally designed.

**Pros**:
- No migration required
- Preserves original schema design intent
- Separation of concerns (raw vs aggregated)

**Cons**:
- **Doesn't match reality**: ACE API doesn't provide raw data
- Requires implementing aggregation logic (unnecessary complexity)
- Wastes storage with duplicate data
- More complex queries (joins, multi-table lookups)
- Higher D1 costs

**Decision**: **REJECTED** - Adds unnecessary complexity for no benefit.

---

### Alternative 2: Drop timeseries_agg Immediately

**Description**: Remove `timeseries_agg` table in Phase 1 instead of deprecating.

**Pros**:
- Cleaner schema immediately
- No grace period needed
- Reduced migration phases

**Cons**:
- **Higher risk**: No rollback if issues discovered
- Potential breaking changes for unknown dependencies
- Violates best practices (gradual deprecation)

**Decision**: **REJECTED** - Too risky, deprecation-first approach is safer.

---

### Alternative 3: Use timeseries_agg for Aggregated Data

**Description**: Write aggregated data to `timeseries_agg`, use `timeseries_raw` only when raw data becomes available.

**Pros**:
- Uses schema as originally designed
- Clear separation between data types
- Future-ready if raw data becomes available

**Cons**:
- **Complexity**: All queries must check both tables
- Joins required for split queries
- Higher storage costs (separate indexes)
- Confusing: "raw" table would be empty initially

**Decision**: **REJECTED** - Complexity outweighs theoretical benefits.

---

### Alternative 4: Rename Tables to Match Reality

**Description**: Rename `timeseries_raw` to `timeseries_aggregated`, drop `timeseries_agg`.

**Pros**:
- Table name accurately reflects contents
- Clear intent for future developers

**Cons**:
- **Breaking change**: All queries must update table name
- Requires updating all workers simultaneously
- High deployment risk
- Downtime required for coordination

**Decision**: **REJECTED** - Breaking changes unnecessary, comments sufficient.

---

## Success Metrics

### Performance Metrics

- **Query Latency**: Maintain <100ms P95 latency for D1 queries
- **ETL Throughput**: No degradation in sync speed (currently 6.48M samples/day)
- **Storage Efficiency**: Reduce unused storage by deprecating empty table

### Operational Metrics

- **Error Rate**: Zero increase in 5xx errors post-migration
- **Data Integrity**: 100% consistency between old and new schema
- **Deployment Success**: Zero rollbacks required

### Developer Experience

- **Code Clarity**: Reduce schema-related support questions by 50%
- **Onboarding Time**: New developers understand storage design in <1 hour
- **Documentation**: 100% of ADR recommendations implemented

---

## Open Questions

1. **Q**: Should we support 1-minute aggregations if ACE API adds raw data support?
   **A**: Yes, the interval field future-proofs for this. Add `interval='1min'` rows when available.

2. **Q**: How do we handle schema changes in R2 Parquet files?
   **A**: R2 files are immutable. Backfill script (Phase 4) rewrites files with new schema.

3. **Q**: What if external consumers depend on `timeseries_agg`?
   **A**: 6-month grace period allows discovery. No known consumers exist based on code analysis.

4. **Q**: Should we validate data at schema boundaries?
   **A**: Yes, add CHECK constraint: `interval IN ('1min', '5min', '1hr', '1day')`

5. **Q**: How does this affect R2 archival strategy?
   **A**: No impact. Archival Worker reads from `timeseries_raw` and writes Parquet regardless of internal schema.

---

## References

### Code Files

- `C:\Users\jstahr\Desktop\Building Vitals\workers\schema\d1-schema.sql` (lines 14-60)
- `C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js` (lines 313-338, 650-663)
- `C:\Users\jstahr\Desktop\Building Vitals\src\query-worker.js` (lines 395-423, 570-616)

### Related Documentation

- [D1 Schema Design Principles](../schema/README.md) (TODO: Create)
- [ETL Worker Architecture](./etl-worker-design.md) (TODO: Create)
- [Query Worker Routing Logic](./query-routing.md) (TODO: Create)

### External Resources

- [Cloudflare D1 Best Practices](https://developers.cloudflare.com/d1/platform/best-practices/)
- [SQLite WITHOUT ROWID Optimization](https://www.sqlite.org/withoutrowid.html)
- [Timeseries Database Design Patterns](https://www.timescale.com/blog/time-series-database-design/)

---

## Revision History

| Version | Date       | Author              | Changes                          |
|---------|------------|---------------------|----------------------------------|
| 1.0     | 2025-10-15 | System Architect    | Initial ADR creation             |
| 1.1     | TBD        | -                   | Post-stakeholder review updates  |
| 2.0     | TBD        | -                   | Post-implementation learnings    |

---

## Approval

**Status**: PROPOSED
**Next Steps**:
1. Review with development team (scheduled: TBD)
2. Review with operations team (scheduled: TBD)
3. Final approval by CTO (pending)

**Approvers**:
- [ ] System Architect
- [ ] Lead Backend Engineer
- [ ] DevOps Lead
- [ ] CTO

---

*This ADR follows the [MADR](https://adr.github.io/madr/) format with enhancements for enterprise adoption.*
