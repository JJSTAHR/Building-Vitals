# ACE IoT API Authentication - CRITICAL INFORMATION

## ⚠️ CRITICAL: Authentication Header Format

**The ACE IoT API requires LOWERCASE `authorization` header with Bearer prefix.**

### ✅ CORRECT Format

```javascript
headers: {
  'authorization': `Bearer ${token}`,  // LOWERCASE 'authorization'
  'Accept': 'application/json'
}
```

### ❌ WRONG Formats

```javascript
// ❌ Capital 'A' - WILL FAIL with 401 Unauthorized
headers: {
  'Authorization': `Bearer ${token}`  // WRONG!
}

// ❌ X-ACE-Token without Bearer - WILL FAIL
headers: {
  'X-ACE-Token': token  // WRONG!
}

// ❌ authorization without Bearer prefix - WILL FAIL
headers: {
  'authorization': token  // WRONG!
}
```

## Why This Matters

The ACE IoT API Swagger specification (lines 1898-1903 of swagger.json) explicitly defines:

```json
"securityDefinitions": {
  "apiKey": {
    "type": "apiKey",
    "in": "header",
    "name": "authorization"  // ← LOWERCASE!
  }
}
```

**HTTP headers are case-insensitive according to HTTP specs, BUT the ACE IoT API implementation is case-sensitive and requires lowercase.**

## Frontend vs Backend Authentication

### Frontend (React/TypeScript)
The frontend uses `X-ACE-Token` header:
```typescript
config.headers['X-ACE-Token'] = token;  // from tokenInterceptor.ts
```

This works because the frontend goes directly to the ACE IoT API which accepts both formats.

### Backend (Cloudflare Worker)
The worker MUST use lowercase `authorization` with Bearer prefix:
```javascript
headers: {
  'authorization': `Bearer ${token}`
}
```

## All Affected Endpoints

The following worker endpoints were fixed to use lowercase `authorization`:

1. **GET /api/sites** (line 573 in ai-enhanced-worker.js)
2. **GET /api/sites/:site/timeseries/paginated** (line 1616)
3. **GET /api/sites/:site/configured_points** (line 1202)
4. **All other ACE API proxy endpoints** (line 645)

## Testing the Authentication

### Direct API Test
```bash
# ✅ CORRECT - works
curl "https://flightdeck.aceiot.cloud/api/sites/" \
  -H "authorization: Bearer YOUR_TOKEN_HERE"

# ❌ WRONG - returns 401
curl "https://flightdeck.aceiot.cloud/api/sites/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Worker Test
```bash
# Test through worker (worker accepts X-ACE-Token from frontend)
curl "https://ace-iot-ai-proxy.jstahr.workers.dev/api/sites" \
  -H "X-ACE-Token: YOUR_TOKEN_HERE"
```

## Deployment History

### 2025-10-12: CRITICAL FIX - Authentication Header Case Sensitivity
- **Problem**: Worker used `'Authorization'` (capital A) which caused 401 Unauthorized errors
- **Solution**: Changed ALL instances to `'authorization'` (lowercase)
- **Deployed**: Version c315229e-0194-464a-befb-dd08ed5935bf
- **Testing**: Verified with real data from ses_falls_city site
- **Status**: ✅ WORKING

## Developer Checklist

When adding new endpoints to the worker that call ACE IoT API:

- [ ] Use lowercase `'authorization'` header
- [ ] Include `Bearer ` prefix before token
- [ ] Test with curl against direct API
- [ ] Test through worker
- [ ] Verify in wrangler logs

## Error Messages

If you see these errors, check authentication format:

```json
// 401 Unauthorized - wrong header case or format
{"message": "Error"}

// 500 Internal Server Error - check worker logs
// Usually means authentication header is incorrect
```

## References

- Swagger Spec: `C:\Users\jstahr\Desktop\Building Vitals\ace-api-swagger-formatted.json`
- Worker Code: `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\workers\ai-enhanced-worker.js`
- Frontend Token Interceptor: `C:\Users\jstahr\Desktop\Building Vitals\src\services\tokenInterceptor.ts`

---

**REMEMBER: Always use lowercase `authorization` with `Bearer ` prefix when calling ACE IoT API from the worker!**

Last Updated: 2025-10-12
Last Verified Working: 2025-10-12 (Version c315229e-0194-464a-befb-dd08ed5935bf)
