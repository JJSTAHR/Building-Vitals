# CRITICAL FIXES REQUIRED - Wave 5A

**Status:** 🔴 **NO-GO FOR DEPLOYMENT**
**Validated:** 2025-10-14
**Blockers:** 2 Critical Issues

---

## ⚠️ DEPLOYMENT BLOCKED - Action Required

Your configuration validation has identified **2 CRITICAL ISSUES** that will prevent successful deployment.

**Quick Summary:**
- ❌ Query Worker: Hardcoded credentials (security violation)
- ❌ Archival Worker: Wrong file path (will fail to deploy)
- ⚠️ Archival Worker: Archive threshold mismatch (30 days vs 20 days spec)

---

## 🔴 CRITICAL FIX #1: Query Worker Security Violation

**File:** `workers/wrangler-query.toml`

**Problem:** Hardcoded `database_id` and KV namespace `id` violate Wave 4A security requirements.

**Fix Required:**

```toml
# BEFORE (Lines 27-31):
[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"  # ❌ DELETE THIS LINE

# AFTER:
[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
# database_id removed - configure via Cloudflare dashboard
```

```toml
# BEFORE (Lines 47-51):
[[kv_namespaces]]
binding = "KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"              # ❌ DELETE THIS LINE
preview_id = "1468fbcbf23548f3acb88a9e574d3485"      # ❌ DELETE THIS LINE

# AFTER:
[[kv_namespaces]]
binding = "KV"
# id removed - configure via Cloudflare dashboard
# preview_id removed - configure via dashboard
```

**Post-Fix Action:**
- Manually configure bindings via Cloudflare Dashboard: Workers & Pages → building-vitals-query → Settings → Variables
- Bind DB to `ace-iot-db`
- Bind KV to same namespace used by ETL worker

---

## 🔴 CRITICAL FIX #2: Archival Worker File Path Error

**File:** `wrangler-archival.toml` (in root directory)

**Problem:** File path `src/archival-worker.js` is incorrect. Since config is in root, path must start with `./`

**Fix Required:**

```toml
# BEFORE (Line 5):
main = "src/archival-worker.js"  # ❌ WRONG - relative to root

# AFTER:
main = "./src/archival-worker.js"  # ✅ CORRECT - relative to config location
```

**Impact:** Without this fix, deployment will fail with "file not found" error.

---

## ⚠️ HIGH PRIORITY FIX #3: Archival Worker Threshold Mismatch

**File:** `wrangler-archival.toml`

**Problem:** Environment variable says 30 days, but specification and code expect 20 days.

**Fix Required:**

```toml
# BEFORE (Line 33):
ARCHIVE_THRESHOLD_DAYS = "30"  # ❌ Mismatched with spec

# AFTER:
ARCHIVE_THRESHOLD_DAYS = "20"  # ✅ Matches 20-day hot storage specification
```

**Impact:** Archives data at wrong boundary (30 days instead of 20 days as specified).

---

## ⚠️ RECOMMENDED FIX #4: Backfill Worker KV ID Consistency

**File:** `workers/wrangler-backfill.toml`

**Problem:** KV namespace ID is hardcoded (inconsistent with other workers).

**Fix Required:**

```toml
# BEFORE (Lines 33-35):
[[kv_namespaces]]
binding = "ETL_STATE"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"  # ⚠️ Should remove for consistency

# AFTER:
[[kv_namespaces]]
binding = "ETL_STATE"
# id removed - configure via Cloudflare dashboard
```

**Impact:** Low risk but improves security consistency across all workers.

---

## 📋 Quick Fix Checklist

```
Priority 1 - MUST FIX (Deployment Blockers):
[ ] Remove database_id from workers/wrangler-query.toml (line 30)
[ ] Remove KV id from workers/wrangler-query.toml (lines 49-50)
[ ] Fix path in wrangler-archival.toml: src/ → ./src/ (line 5)

Priority 2 - SHOULD FIX (Behavior Issues):
[ ] Change ARCHIVE_THRESHOLD_DAYS from "30" to "20" in wrangler-archival.toml (line 33)
[ ] Remove KV id from workers/wrangler-backfill.toml for consistency (line 35)

Priority 3 - NICE TO HAVE:
[ ] Update build command in wrangler-archival.toml: "npm install" (line 41)
[ ] Add BACKFILL_API_KEY to secrets documentation (line 63)
```

---

## 🚀 After Fixes Applied

1. **Re-validate configs:**
   - Review `docs/deployment-config-validation.md`
   - Verify all changes applied correctly

2. **Configure bindings via Cloudflare Dashboard:**
   ```
   Query Worker → Settings → Variables:
   - D1 Binding: DB → ace-iot-db
   - R2 Binding: R2 → ace-timeseries
   - KV Binding: KV → [select same namespace as ETL worker]

   Archival Worker → Settings → Variables:
   - D1 Binding: DB → ace-iot-db
   - R2 Binding: R2 → ace-timeseries
   - KV Binding: KV → [same namespace]

   Backfill Worker → Settings → Variables:
   - R2 Binding: R2 → ace-timeseries
   - KV Binding: ETL_STATE → [same namespace]
   ```

3. **Set required secrets:**
   ```bash
   # Backfill worker only:
   wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
   wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml
   ```

4. **Test deployment:**
   ```bash
   # Deploy to development first:
   wrangler deploy --config workers/wrangler-query.toml --env development
   wrangler deploy --config wrangler-archival.toml --env development
   wrangler deploy --config workers/wrangler-backfill.toml --env development

   # Test endpoints:
   curl https://building-vitals-query-dev.workers.dev/health
   ```

5. **Deploy to production:**
   ```bash
   wrangler deploy --config workers/wrangler-query.toml --env production
   wrangler deploy --config wrangler-archival.toml --env production
   wrangler deploy --config workers/wrangler-backfill.toml --env production
   ```

---

## 📊 Validation Results

**Configuration Summary:**

| Worker | Status | Issues | Deployment Ready |
|--------|--------|--------|------------------|
| Query | ❌ FAIL | 2 critical | NO - Security violation |
| Archival | ⚠️ PARTIAL | 1 critical, 1 high | NO - Path error |
| Backfill | ✅ PASS | 1 minor | YES (after minor fix) |

**Overall Status:** 🔴 **NO-GO**

**Estimated Fix Time:** 15-30 minutes

---

## 📚 Reference Documents

- **Full Validation Report:** `docs/deployment-config-validation.md`
- **Security Requirements:** `docs/security-deployment.md` (Wave 4A)
- **Deployment Commands:** `docs/deployment-commands.md`
- **System Specification:** `docs/timeseries-system-spec.md`

---

## ✅ Success Criteria

Your configuration will be deployment-ready when:

1. ✅ No hardcoded `database_id` values in any wrangler.toml
2. ✅ No hardcoded KV namespace `id` values in any wrangler.toml
3. ✅ All file paths are correct relative to config location
4. ✅ ARCHIVE_THRESHOLD_DAYS matches specification (20 days)
5. ✅ All bindings configured via Cloudflare dashboard
6. ✅ All required secrets set via `wrangler secret put`

---

**Next Step:** Apply fixes listed above, then request re-validation.
