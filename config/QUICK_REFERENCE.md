# Building Vitals Configuration - Quick Reference Card

**Last Updated:** October 16, 2025

---

## Production Resource IDs

### Copy These Values ✅

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

---

## DON'T Use These ❌

```toml
# ❌ INCORRECT - From different deployment
database_id = "b3901317-c387-4631-8654-750535cc18de"

# ❌ INCORRECT - Outdated bucket name
bucket_name = "building-vitals-timeseries"

# ❌ INCORRECT - Wrong KV namespace
kv_id = "3a8ae7ad1bd346fd9646f3f30a88676e"
```

---

## Validation Command

```bash
# Run before deploying
./scripts/validate-configuration.sh
```

**Expected Output:**
```
✓ All validation checks passed!
✅ Safe to deploy workers
```

---

## Worker Configuration Files

| Worker | Config File | Status |
|--------|------------|--------|
| ETL Sync | `workers/wrangler-etl.toml` | ✅ |
| Query | `workers/wrangler-query.toml` | ✅ |
| Backfill | `workers/wrangler-backfill.toml` | ✅ |
| Archival | `wrangler-archival.toml` | ✅ |

---

## Deployment Commands

```bash
# Validate configuration first
./scripts/validate-configuration.sh

# Deploy ETL Worker
wrangler deploy -c workers/wrangler-etl.toml --env production

# Deploy Query Worker
wrangler deploy -c workers/wrangler-query.toml --env production

# Deploy Backfill Worker
wrangler deploy -c workers/wrangler-backfill.toml --env production

# Deploy Archival Worker
wrangler deploy -c wrangler-archival.toml --env production
```

---

## R2 Path Structure

```
Bucket: ace-timeseries

Path Format:
/timeseries/YYYY/MM/DD/site_name.parquet

Example:
ace-timeseries/timeseries/2024/10/16/ses_falls_city.parquet
```

---

## Common Issues

### Issue: Wrangler complains about missing database_id

**Solution:** Add this to your wrangler.toml:
```toml
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
```

### Issue: R2 bucket not found

**Solution:** Ensure bucket name is:
```toml
bucket_name = "ace-timeseries"
```

**NOT:** `building-vitals-timeseries`

### Issue: KV namespace error

**Solution:** Use correct KV ID:
```toml
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
```

---

## Full Documentation

- **Unified Config:** `config/cloudflare-unified-config.toml`
- **Cleanup Report:** `docs/CONFIGURATION_CLEANUP.md`
- **Summary Guide:** `docs/CONFIGURATION_SUMMARY.md`
- **Main Summary:** `CONFIGURATION_CLEANUP_SUMMARY.md`

---

## Emergency Reference

**If in doubt, use these values:**

```bash
DB_ID="1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
BUCKET="ace-timeseries"
KV_ID="fa5e24f3f2ed4e3489a299e28f1bffaa"
```

---

**Print this card and keep it handy!** 📌
