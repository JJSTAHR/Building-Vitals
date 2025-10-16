# ACE API Token Configuration Analysis

**Date:** 2025-10-16
**Analysis Focus:** Understanding how workers access ACE API authentication

---

## Executive Summary

**Root Cause Identified:** Both the ETL worker and backfill worker use the **exact same secret configuration** (`ACE_API_KEY`), but access patterns and error handling differ significantly.

### Key Finding:
- **ETL Worker (Working)**: Successfully uses `env.ACE_API_KEY` with proper authentication
- **Backfill Worker (Failing)**: Uses identical secret name but returns 401 errors
- **Secret Storage**: Both secrets are stored in Cloudflare Workers Secrets (NOT in KV or D1)
- **Configuration Match**: Both workers reference the same secret name and API base URL

---

## 1. Secret Configuration Summary

### Secret Storage Location
```
Storage Type: Cloudflare Workers Secrets
Access Method: env.ACE_API_KEY
Scope: Per-worker (each worker has its own secret storage)
```

### Current Secret Configuration

#### ETL Worker (`wrangler-etl.toml`)
```bash
# Secret list output:
[
  {
    "name": "ACE_API_KEY",
    "type": "secret_text"
  }
]

# Configuration:
name = "building-vitals-etl-sync"
main = "../src/etl-sync-worker.js"

[vars]
SITE_NAME = "ses_falls_city"
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"

# Secret set via:
# wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml
```

#### Backfill Worker (`wrangler-backfill.toml`)
```bash
# Secret list output:
[
  {
    "name": "ACE_API_KEY",
    "type": "secret_text"
  },
  {
    "name": "BACKFILL_API_KEY",
    "type": "secret_text"
  }
]

# Configuration:
name = "building-vitals-backfill"
main = "../src/backfill-worker.js"

[vars]
SITE_NAME = "ses_falls_city"
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"
BACKFILL_START_DATE = "2024-12-10"
BACKFILL_END_DATE = "2025-10-12"

# Secret set via:
# wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
```

---

## 2. Token Access Pattern Comparison

### ETL Worker (✅ WORKING)

**File:** `C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js`

**Lines 402, 499, 556:**
```javascript
// Fetch configured points list
const response = await fetchWithRetry(url, {
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,  // ← SUCCESS
    'Content-Type': 'application/json'
  }
});

// Fetch timeseries data
const response = await fetchWithRetry(url.toString(), {
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,  // ← SUCCESS
    'Content-Type': 'application/json'
  },
  signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
});

// Fetch weather data
const response = await fetchWithRetry(url, {
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,  // ← SUCCESS
    'Content-Type': 'application/json'
  },
  signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
});
```

### Backfill Worker (❌ FAILING)

**File:** `C:\Users\jstahr\Desktop\Building Vitals\src\backfill-worker.js`

**Line 470:**
```javascript
const response = await fetch(url.toString(), {
  method: 'GET',
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,  // ← FAILS WITH 401
    'Content-Type': 'application/json'
  },
  signal: AbortSignal.timeout(BACKFILL_CONFIG.API_TIMEOUT_MS)
});
```

---

## 3. Key Differences Between Workers

### Configuration Differences

| Aspect | ETL Worker | Backfill Worker |
|--------|------------|-----------------|
| **Secret Name** | `ACE_API_KEY` | `ACE_API_KEY` (same) |
| **API Base URL** | `https://flightdeck.aceiot.cloud/api` | `https://flightdeck.aceiot.cloud/api` (same) |
| **Binding** | Uses `fetchWithRetry()` wrapper | Uses raw `fetch()` |
| **Error Handling** | Exponential backoff retry | 3 retry attempts |
| **Timeout** | 30s (`CONFIG.ACE_TIMEOUT_MS`) | 30s (`BACKFILL_CONFIG.API_TIMEOUT_MS`) |
| **Endpoint** | `/timeseries/paginated` | `/timeseries/paginated` (same) |
| **Page Size** | 100,000 | 100,000 (same) |
| **Raw Data Mode** | `raw_data=true` | `raw_data=true` (same) |

### Code Pattern Differences

#### ETL Worker - Retry Logic
```javascript
async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_API_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;  // ← Returns on success

    } catch (error) {
      lastError = error;
      console.warn(`[ACE API] Request failed (attempt ${attempt}/${CONFIG.MAX_API_RETRIES}):`, error.message);

      if (attempt < CONFIG.MAX_API_RETRIES) {
        const delay = CONFIG.API_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

#### Backfill Worker - No Wrapper Function
```javascript
// Direct fetch call inside fetchTimeseriesPage()
for (let attempt = 1; attempt <= BACKFILL_CONFIG.API_RETRY_ATTEMPTS; attempt++) {
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${env.ACE_API_KEY}`,  // ← Direct access
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(BACKFILL_CONFIG.API_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ACE API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return { data: result.data || [], next_cursor: result.next_cursor || null, error: null };

  } catch (error) {
    // Retry logic...
  }
}
```

---

## 4. Consolidated Proxy Worker (REFERENCE)

**File:** `C:\Users\jstahr\Desktop\Building Vitals\src\consolidated-ace-proxy-worker.js`

This worker handles frontend API proxy requests and shows a **different authentication pattern**:

**Lines 108, 158, 201, 397:**
```javascript
// Frontend sends token via header
const token = request.headers.get('X-ACE-Token') || request.headers.get('Authorization');
if (!token) {
  return createErrorResponse('Missing authentication token', 401, corsHeaders);
}

const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

// Forward to ACE API
const response = await fetch(`${ACE_API_BASE_URL}/sites`, {
  headers: {
    'authorization': `Bearer ${token}`,  // ← Forwarded from frontend
    'Accept': 'application/json'
  }
});
```

**NOTE:** This worker does NOT use `env.ACE_API_KEY` - it proxies the token from the frontend client.

---

## 5. Diagnostic Checklist

### ✅ Verified Configuration

1. **Secret Exists**: ✅ Both workers have `ACE_API_KEY` secret set
2. **Secret Name Match**: ✅ Both use `env.ACE_API_KEY`
3. **API Base URL**: ✅ Both use `https://flightdeck.aceiot.cloud/api`
4. **Endpoint Format**: ✅ Both use `/sites/{site}/timeseries/paginated`
5. **Query Parameters**: ✅ Both use identical params (start_time, end_time, page_size, raw_data)
6. **Header Format**: ✅ Both use `authorization: Bearer ${token}`

### ❓ Potential Issues to Investigate

1. **Secret Value Mismatch**
   - Question: Are the two `ACE_API_KEY` secrets actually the same value?
   - Verification: `wrangler secret list` shows they exist, but not their values
   - Action: Compare secret values or re-set backfill worker secret

2. **Token Expiration**
   - Question: Does the token expire between successful ETL calls and failing backfill calls?
   - Evidence: ETL runs every 1 minute (successful), backfill runs on-demand (fails)
   - Action: Check if ACE API tokens have time-based validity

3. **Rate Limiting by Token**
   - Question: Does ACE API enforce per-token rate limits?
   - Evidence: ETL worker makes many successful calls; backfill worker immediately fails
   - Action: Check ACE API rate limit headers in failed responses

4. **Environment/Deployment Differences**
   - Question: Are both workers deployed to production?
   - Verification needed: Check `wrangler deployments list` for both workers
   - Action: Ensure backfill worker is using production environment secrets

5. **Secret Propagation Delay**
   - Question: Was the secret recently set/changed on backfill worker?
   - Note: Cloudflare secrets can take 60s to propagate
   - Action: Wait 60s after `wrangler secret put` before testing

---

## 6. Recommended Actions

### Immediate Actions

1. **Verify Secret Values Match**
   ```bash
   # Re-set backfill worker secret to ensure it matches ETL worker
   # Get current working value (from ETL worker logs or secure storage)
   wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
   # Paste the SAME value used in ETL worker
   ```

2. **Wait for Secret Propagation**
   ```bash
   # After setting secret, wait 60 seconds before testing
   sleep 60
   ```

3. **Test Backfill Worker**
   ```bash
   # Trigger backfill
   curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger

   # Check status
   curl https://building-vitals-backfill.jstahr.workers.dev/status
   ```

4. **Monitor Logs for Detailed Error**
   ```bash
   # Tail backfill worker logs
   wrangler tail --config workers/wrangler-backfill.toml

   # Look for:
   # - ACE API error response body
   # - Token format issues
   # - Rate limit headers
   ```

### Diagnostic Actions

1. **Add Debug Logging to Backfill Worker**
   ```javascript
   // In fetchTimeseriesPage() around line 465:
   console.log('[DEBUG] ACE_API_KEY present:', !!env.ACE_API_KEY);
   console.log('[DEBUG] ACE_API_KEY length:', env.ACE_API_KEY ? env.ACE_API_KEY.length : 0);
   console.log('[DEBUG] ACE_API_KEY prefix:', env.ACE_API_KEY ? env.ACE_API_KEY.substring(0, 10) : 'MISSING');
   console.log('[DEBUG] URL:', url.toString());
   console.log('[DEBUG] Headers:', JSON.stringify({
     authorization: env.ACE_API_KEY ? `Bearer ${env.ACE_API_KEY.substring(0, 10)}...` : 'MISSING',
     'Content-Type': 'application/json'
   }));
   ```

2. **Compare ETL vs Backfill Token Format**
   ```javascript
   // Add to both workers:
   console.log('[TOKEN DEBUG]', {
     hasToken: !!env.ACE_API_KEY,
     tokenLength: env.ACE_API_KEY?.length,
     tokenPrefix: env.ACE_API_KEY?.substring(0, 10),
     tokenSuffix: env.ACE_API_KEY?.substring(env.ACE_API_KEY.length - 10)
   });
   ```

3. **Test ACE API Directly**
   ```bash
   # Get ACE_API_KEY value from working ETL worker
   # Test endpoint directly
   curl -v https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -G \
     --data-urlencode "start_time=2024-12-10T00:00:00Z" \
     --data-urlencode "end_time=2024-12-10T23:59:59Z" \
     --data-urlencode "page_size=100000" \
     --data-urlencode "raw_data=true"
   ```

### Long-Term Solutions

1. **Centralize Authentication**
   ```javascript
   // Create shared auth module: src/lib/ace-auth.js
   export function getAuthHeaders(env) {
     if (!env.ACE_API_KEY) {
       throw new Error('ACE_API_KEY not configured');
     }

     return {
       'authorization': `Bearer ${env.ACE_API_KEY}`,
       'Content-Type': 'application/json'
     };
   }
   ```

2. **Add Token Validation**
   ```javascript
   // Validate token format before making requests
   export function validateToken(token) {
     if (!token || token.length < 20) {
       throw new Error('Invalid ACE_API_KEY format');
     }

     // Add any ACE-specific token format validation
     return true;
   }
   ```

3. **Implement Shared Retry Logic**
   ```javascript
   // Use same fetchWithRetry across all workers
   // Import from shared lib/ace-client.js
   ```

---

## 7. Environment Variable Summary

### ETL Worker Variables
```toml
[vars]
SITE_NAME = "ses_falls_city"
ENVIRONMENT = "production"
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"
```

### Backfill Worker Variables
```toml
[vars]
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"
SITE_NAME = "ses_falls_city"
BACKFILL_START_DATE = "2024-12-10"
BACKFILL_END_DATE = "2025-10-12"
PAGES_PER_INVOCATION = "5"
ENVIRONMENT = "production"
```

### No Environment Variables for Token
- ❌ `ACE_API_TOKEN` (not used)
- ❌ `ACE_TOKEN` (not used)
- ❌ `API_KEY` (not used)
- ✅ `ACE_API_KEY` (secret only)

---

## 8. Secret Management Best Practices

### Current Pattern (Per-Worker Secrets)
```
ETL Worker Secrets:       { ACE_API_KEY: "value1" }
Backfill Worker Secrets:  { ACE_API_KEY: "value2", BACKFILL_API_KEY: "value3" }
```

**Issue:** Two separate secrets with same name but potentially different values.

### Recommended Pattern (Shared Secrets via Environment)
```
[env.production]
name = "worker-name"

# Set secrets at environment level:
wrangler secret put ACE_API_KEY -c workers/wrangler.toml --env production
```

This ensures all production workers share the same secret value.

---

## 9. Conclusion

### Configuration Status
- **Secret Storage**: ✅ Both workers use Cloudflare Workers Secrets
- **Secret Name**: ✅ Both use `ACE_API_KEY`
- **Access Pattern**: ✅ Both use `env.ACE_API_KEY`
- **API Configuration**: ✅ Both use identical API base URL and endpoints

### Most Likely Root Cause
**Secret Value Mismatch:** The backfill worker's `ACE_API_KEY` secret likely contains a different value than the ETL worker's secret, or an expired/invalid token.

### Primary Resolution Steps
1. Obtain the working token value from ETL worker (via secure method)
2. Re-set the backfill worker secret: `wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml`
3. Wait 60 seconds for propagation
4. Test backfill worker
5. If still failing, check ACE API logs for specific 401 error details

### Secondary Investigation
If secret values match and issue persists:
- Check ACE API token expiration policy
- Verify rate limiting (per-token or per-IP)
- Confirm both workers deployed to production
- Check for IP-based restrictions on ACE API side

---

## 10. Related Files

### Worker Source Files
- ETL Worker: `C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js`
- Backfill Worker: `C:\Users\jstahr\Desktop\Building Vitals\src\backfill-worker.js`
- Proxy Worker: `C:\Users\jstahr\Desktop\Building Vitals\src\consolidated-ace-proxy-worker.js`

### Configuration Files
- ETL Config: `C:\Users\jstahr\Desktop\Building Vitals\workers\wrangler-etl.toml`
- Backfill Config: `C:\Users\jstahr\Desktop\Building Vitals\workers\wrangler-backfill.toml`
- Main Config: `C:\Users\jstahr\Desktop\Building Vitals\wrangler.toml`

### Documentation
- Token Management: `C:\Users\jstahr\Desktop\Building Vitals\docs\ACE_API_TOKEN_MANAGEMENT.md`
- Backfill Architecture: `C:\Users\jstahr\Desktop\Building Vitals\docs\backfill-worker-architecture.md`

---

**Generated:** 2025-10-16
**Analyst:** Claude Code - Debug Mode
