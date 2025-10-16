# Building Vitals - Unified Configuration Summary

**Date:** October 16, 2025
**Status:** ✅ Configuration Standardized

---

## Quick Reference

### Production Resource IDs (Use These)

```toml
# D1 Database
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
database_name = "ace-iot-db"

# R2 Bucket
bucket_name = "ace-timeseries"

# KV Namespace
kv_id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
kv_preview_id = "1468fbcbf23548f3acb88a9e574d3485"
```

### All Workers Use Same Resources ✅

| Worker | Config File | Database | Bucket | KV | Status |
|--------|------------|----------|--------|-----|--------|
| ETL Sync | `workers/wrangler-etl.toml` | ✅ Correct | ✅ Correct | ✅ Correct | Deployed |
| Query | `workers/wrangler-query.toml` | ✅ Correct | ✅ Correct | ✅ Correct | Deployed |
| Backfill | `workers/wrangler-backfill.toml` | ✅ Correct | ✅ Correct | ✅ Correct | Deployed |
| Archival | `wrangler-archival.toml` | ✅ Correct | ✅ Correct | ✅ Correct | Deployed |

---

## Configuration Files

### Primary Configuration Files

1. **`config/cloudflare-unified-config.toml`** ⭐ NEW
   - Single source of truth for all resource IDs
   - Use this when creating new workers
   - Documents which IDs to use and which to ignore

2. **`workers/wrangler-query.toml`**
   - Query Worker configuration
   - ✅ Uses correct IDs

3. **`workers/wrangler-etl.toml`**
   - ETL Sync Worker configuration
   - ✅ Uses correct IDs

4. **`workers/wrangler-backfill.toml`**
   - Backfill Worker configuration
   - ✅ Uses correct IDs

5. **`wrangler-archival.toml`**
   - Archival Worker configuration
   - ✅ Uses correct IDs

### Updated Configuration Files

6. **`wrangler.toml`** (Root)
   - ✅ Updated with correct database_id and KV IDs
   - Now valid for deployment commands

7. **`wrangler-archival-external.toml`**
   - ✅ Marked as template/example
   - ✅ Updated with correct IDs for reference

8. **`src/wrangler-consolidated.toml`**
   - ✅ Fixed incorrect KV namespace ID
   - Changed from `3a8ae7ad...` to `fa5e24f3...`

---

## Incorrect IDs Found and Removed

### ❌ Incorrect Database ID

**Found:** `b3901317-c387-4631-8654-750535cc18de`

**Location:** `docs/CLOUDFLARE_DEPLOYMENT_COMPLETE.md` (line 91)

**Why Wrong:**
- Only appears in one documentation file
- Not used by any worker configuration
- Refers to a different worker deployment
- Should be ignored

**Action Taken:** Documented in CONFIGURATION_CLEANUP.md as incorrect

---

### ❌ Incorrect Bucket Name

**Found:** `building-vitals-timeseries`

**Locations:**
- `docs/CLOUDFLARE_DEPLOYMENT_COMPLETE.md`
- `docs/TIMESERIES_QUERY_FIX_SUMMARY.md`
- `docs/DEPLOYMENT_STEPS.md`
- Setup scripts

**Why Wrong:**
- Not used by any worker configuration
- Only appears in documentation
- Workers use `ace-timeseries`

**Action Recommended:** Update documentation to use `ace-timeseries`

---

### ❌ Incorrect KV Namespace ID

**Found:** `3a8ae7ad1bd346fd9646f3f30a88676e`

**Location:** `src/wrangler-consolidated.toml` (FIXED)

**Why Wrong:**
- Different from all worker configurations
- Would cause data isolation issues
- Workers use `fa5e24f3...`

**Action Taken:** ✅ Updated to correct ID

---

## Deployment Verification

### Pre-Deployment Checklist

Before deploying any worker:

- [ ] Verify database_id = `1afc0a07-85cd-4d5f-a046-b580ffffb8dc`
- [ ] Verify bucket_name = `ace-timeseries`
- [ ] Verify kv_id = `fa5e24f3f2ed4e3489a299e28f1bffaa`
- [ ] No reference to `b3901317-c387-4631-8654-750535cc18de`
- [ ] No reference to `building-vitals-timeseries`
- [ ] No reference to `3a8ae7ad1bd346fd9646f3f30a88676e`

### Validation Commands

```bash
# Check for incorrect database ID (should return empty)
grep -r "b3901317-c387-4631-8654-750535cc18de" workers/*.toml

# Check for incorrect bucket name (should return empty)
grep -r "building-vitals-timeseries" workers/*.toml

# Verify correct database ID (should return 4 results)
grep -r "1afc0a07-85cd-4d5f-a046-b580ffffb8dc" workers/*.toml wrangler-archival.toml

# Verify correct bucket name (should return 4 results)
grep -r 'bucket_name = "ace-timeseries"' workers/*.toml wrangler-archival.toml
```

---

## R2 Storage Path Structure

### ✅ CORRECT Path (All Workers Use This)

```
Bucket: ace-timeseries
Path: /timeseries/YYYY/MM/DD/site_name.parquet

Example:
ace-timeseries/timeseries/2024/10/16/ses_falls_city.parquet
```

### Archival Worker Writes

```javascript
// Correct path construction
const key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
await env.R2.put(key, parquetBuffer);
```

### Query Worker Reads

```javascript
// Correct path construction
const key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
const object = await env.R2.get(key);
```

### Backfill Worker Writes

```javascript
// Correct path construction
const key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
await env.R2.put(key, parquetBuffer);
```

**All workers use IDENTICAL path structure** ✅

---

## Common Configuration Patterns

### D1 Database Binding

```toml
[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
```

### R2 Bucket Binding

```toml
[[r2_buckets]]
binding = "R2"  # or "BUCKET" - varies by worker
bucket_name = "ace-timeseries"
```

### KV Namespace Binding

```toml
[[kv_namespaces]]
binding = "ETL_STATE"  # or "KV", "BACKFILL_STATE" - varies by worker
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
preview_id = "1468fbcbf23548f3acb88a9e574d3485"
```

### Common Environment Variables

```toml
[vars]
ENVIRONMENT = "production"
SITE_NAME = "ses_falls_city"
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"
HOT_STORAGE_DAYS = "20"
ARCHIVE_THRESHOLD_DAYS = "20"
```

---

## Multi-Site Configuration

### Adding New Sites

To add new sites, update the `SITE_NAME` variable in ALL workers:

```toml
# Before
SITE_NAME = "ses_falls_city"

# After (comma-separated)
SITE_NAME = "ses_falls_city,building_north,building_south"
```

**Files to Update:**
1. `workers/wrangler-etl.toml` - ETL worker
2. `workers/wrangler-query.toml` - Query worker (if needed)
3. `workers/wrangler-backfill.toml` - Backfill worker (if needed)
4. `wrangler-archival.toml` - Archival worker (if needed)

**No code changes required** - workers automatically handle multiple sites

---

## Environment-Specific Configurations

### Development

```toml
[env.development]
name = "building-vitals-{worker}-dev"

[[env.development.d1_databases]]
binding = "DB"
database_name = "ace-iot-db-dev"
database_id = "your-dev-database-id"

[[env.development.r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries-dev"

[[env.development.kv_namespaces]]
binding = "KV"
id = "your-dev-kv-id"
```

### Staging

```toml
[env.staging]
name = "building-vitals-{worker}-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "ace-iot-db-staging"
database_id = "your-staging-database-id"

[[env.staging.r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries-staging"

[[env.staging.kv_namespaces]]
binding = "KV"
id = "your-staging-kv-id"
```

### Production

```toml
[env.production]
name = "building-vitals-{worker}"

[[env.production.d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"

[[env.production.r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries"

[[env.production.kv_namespaces]]
binding = "KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
```

---

## Troubleshooting

### Error: "database_id" field but got...

**Problem:** Missing database_id in wrangler.toml

**Solution:** Add the correct database_id:
```toml
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
```

### Error: Bucket not found

**Problem:** Using wrong bucket name

**Solution:** Ensure bucket_name is:
```toml
bucket_name = "ace-timeseries"
```

NOT `building-vitals-timeseries`

### Error: KV namespace not found

**Problem:** Using wrong KV namespace ID

**Solution:** Ensure KV ID is:
```toml
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
```

NOT `3a8ae7ad1bd346fd9646f3f30a88676e`

---

## Documentation Updates Needed

The following documentation files reference incorrect configurations and should be updated:

1. **`docs/CLOUDFLARE_DEPLOYMENT_COMPLETE.md`**
   - Line 91: References incorrect database ID `b3901317...`
   - Line 75: References incorrect bucket `building-vitals-timeseries`
   - **Action:** Add note that these are from a different deployment

2. **`docs/TIMESERIES_QUERY_FIX_SUMMARY.md`**
   - References `building-vitals-timeseries` bucket
   - **Action:** Update to `ace-timeseries`

3. **`docs/DEPLOYMENT_STEPS.md`**
   - References `building-vitals-timeseries` bucket
   - **Action:** Update to `ace-timeseries`

4. **Setup Scripts**
   - `scripts/setup-cloudflare-services.cmd`
   - `scripts/setup-cloudflare-services.sh`
   - **Action:** Update bucket references to `ace-timeseries`

---

## Best Practices

### 1. Always Reference Unified Config

When creating new workers, reference `config/cloudflare-unified-config.toml`

### 2. Never Hardcode Resource IDs in Code

Use environment bindings instead:
```javascript
// ✅ Good
const db = env.DB;
const bucket = env.R2;
const kv = env.KV;

// ❌ Bad
const database_id = "1afc0a07...";
```

### 3. Validate Before Deployment

Run validation commands before deploying:
```bash
# Verify configuration matches unified config
grep database_id workers/wrangler-*.toml
grep bucket_name workers/wrangler-*.toml
```

### 4. Document Configuration Changes

Update `config/cloudflare-unified-config.toml` when making changes

### 5. Use Environment-Specific Configs

Separate dev/staging/production configurations to prevent accidental production deployments

---

## Migration from Old Configuration

If you have existing workers using old configurations:

1. **Check Current Configuration**
   ```bash
   wrangler deployments list
   ```

2. **Update wrangler.toml**
   - Change database_id to `1afc0a07-85cd-4d5f-a046-b580ffffb8dc`
   - Change bucket_name to `ace-timeseries`
   - Change kv_id to `fa5e24f3f2ed4e3489a299e28f1bffaa`

3. **Test in Development**
   ```bash
   wrangler dev -c workers/wrangler-{worker}.toml --env development
   ```

4. **Deploy to Staging**
   ```bash
   wrangler deploy -c workers/wrangler-{worker}.toml --env staging
   ```

5. **Deploy to Production**
   ```bash
   wrangler deploy -c workers/wrangler-{worker}.toml --env production
   ```

---

## Maintenance

### Regular Checks

**Monthly:**
- Verify all workers use same resource IDs
- Check for configuration drift
- Update documentation if needed

**Quarterly:**
- Review and cleanup unused configuration files
- Audit resource usage
- Update unified config if resources change

### Configuration Audit Script

```bash
#!/bin/bash
# audit-config.sh

echo "Checking for configuration consistency..."

# Check database IDs
echo "Database IDs:"
grep -r "database_id" workers/*.toml wrangler-archival.toml | grep -v "your-"

# Check bucket names
echo "Bucket names:"
grep -r "bucket_name" workers/*.toml wrangler-archival.toml

# Check KV IDs
echo "KV namespace IDs:"
grep -r 'id = "' workers/*.toml wrangler-archival.toml | grep kv -A 1
```

---

## Changelog

### October 16, 2025 - Configuration Standardization

- ✅ Created `config/cloudflare-unified-config.toml`
- ✅ Updated root `wrangler.toml` with correct IDs
- ✅ Fixed `src/wrangler-consolidated.toml` KV ID
- ✅ Marked `wrangler-archival-external.toml` as template
- ✅ Verified all 4 production workers use same IDs
- ✅ Documented incorrect IDs to avoid
- ✅ Created comprehensive cleanup documentation

---

## Support

**Reference Documents:**
- `config/cloudflare-unified-config.toml` - Single source of truth
- `docs/CONFIGURATION_CLEANUP.md` - Detailed cleanup report
- `docs/DEPLOYMENT-COMPLETE.md` - Production deployment details
- `docs/system-architecture.md` - System architecture

**For Questions:**
- Check unified config file first
- Review cleanup documentation
- Validate with audit commands
- Update documentation when making changes

---

**Document Version:** 1.0
**Last Updated:** October 16, 2025
**Maintained By:** Building Vitals DevOps Team
