# Cloudflare Worker Architecture Diagrams
**Date:** 2025-10-13
**Purpose:** Visual representation of current vs. recommended worker architecture

---

## Current Architecture (BROKEN)

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React App)                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  cachedSitePointService.ts                               │   │
│  │  - Expects points with display_name field               │   │
│  │  - Maps display_name → displayName                      │   │
│  │  - Enhances with KV tag parsing                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ fetchPoints()                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  cloudflareWorkerClient.ts                               │   │
│  │  - GET /api/sites/{siteId}/configured_points            │   │
│  │  - Expects: { items: [{ Name, display_name, ... }] }   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS Request
                             │ X-ACE-Token: xyz...
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│          CLOUDFLARE WORKER (ace-iot-ai-proxy)                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  point-filter-worker.js                                  │   │
│  │  - Simple proxy (NO enhancement logic)                  │   │
│  │  - Adds per_page=10000 parameter                        │   │
│  │  - NO KV namespace bindings                             │   │
│  │  - NO display_name generation                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ Proxy request                       │
│                    (just passes through)                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS Request
                             │ Authorization: Bearer xyz...
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│               ACE IoT API (flightdeck.aceiot.cloud)              │
│                                                                  │
│  Returns RAW points:                                            │
│  {                                                               │
│    "id": 12345,                                                 │
│    "Name": "SURGERYCHILLER-Capacity",                          │
│    "point_type": "Analog",                                      │
│    "collect_enabled": true                                      │
│    // NO display_name field!                                    │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓ Response flows back unchanged
                             │
                    ┌────────┴────────┐
                    │                 │
              WORKER passes      FRONTEND receives
              through unchanged  RAW points
                    │                 │
                    └────────┬────────┘
                             ↓
                    ❌ PROBLEM: NO display_name
                    ❌ UI shows: "SURGERYCHILLER-Capacity"
                    ❌ Only 10 points visible (???)
```

---

## Recommended Architecture (FIXED)

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React App)                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  cachedSitePointService.ts                               │   │
│  │  - Receives points with display_name ✓                  │   │
│  │  - Maps display_name → displayName                      │   │
│  │  - Enhances with KV tag parsing                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ fetchPoints()                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  cloudflareWorkerClient.ts                               │   │
│  │  - GET /api/sites/{siteId}/configured_points            │   │
│  │  - Receives: { items: [{ Name, display_name, ... }] }  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS Request
                             │ X-ACE-Token: xyz...
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│          CLOUDFLARE WORKER (ace-iot-ai-proxy)                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  point-enhanced-proxy.js (NEW!)                          │   │
│  │                                                          │   │
│  │  1. Check KV Cache First                                │   │
│  │     ↓                                                    │   │
│  │  ┌──────────────────────────────────────────┐          │   │
│  │  │ KV Namespace: POINTS_KV                   │          │   │
│  │  │ Key: "site:{siteId}:points"              │          │   │
│  │  │ TTL: 1 hour                               │          │   │
│  │  └──────────────────────────────────────────┘          │   │
│  │     ├─ Cache HIT  → Return cached enhanced points       │   │
│  │     └─ Cache MISS → Continue to Step 2                  │   │
│  │                                                          │   │
│  │  2. Fetch from ACE API                                  │   │
│  │     - Add per_page=10000                                │   │
│  │     - Transform headers (x-ace-token → authorization)   │   │
│  │                                                          │   │
│  │  3. Enhance Points                                      │   │
│  │     for each point {                                    │   │
│  │       display_name = formatDisplayName(point.Name)     │   │
│  │     }                                                    │   │
│  │                                                          │   │
│  │  4. Store in KV Cache                                   │   │
│  │     POINTS_KV.put("site:{siteId}:points", {            │   │
│  │       cached_at: now,                                   │   │
│  │       points: enhancedPoints                            │   │
│  │     }, { expirationTtl: 3600 })                         │   │
│  │                                                          │   │
│  │  5. Return Enhanced Points                              │   │
│  │     with display_name field                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ On Cache Miss:
                             │ HTTPS Request to ACE API
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│               ACE IoT API (flightdeck.aceiot.cloud)              │
│                                                                  │
│  Returns RAW points:                                            │
│  {                                                               │
│    "id": 12345,                                                 │
│    "Name": "SURGERYCHILLER-Capacity",                          │
│    "point_type": "Analog",                                      │
│    "collect_enabled": true                                      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓ Worker enhances and caches
                             │
                    ┌────────┴────────┐
                    │                 │
              WORKER adds        FRONTEND receives
              display_name       ENHANCED points
                    │                 │
                    └────────┬────────┘
                             ↓
                    ✅ SUCCESS: display_name present
                    ✅ UI shows: "SURGERYCHILLER Capacity"
                    ✅ ALL points visible (not just 10)
```

---

## Data Flow Comparison

### Current Flow (BROKEN)
```
1. Frontend requests points
   ↓
2. Worker proxies to ACE API (no processing)
   ↓
3. ACE API returns RAW points
   ↓
4. Worker passes through unchanged
   ↓
5. Frontend receives RAW points without display_name
   ↓
6. ❌ UI shows ugly names: "SURGERYCHILLER-Capacity"
```

### Recommended Flow (FIXED)
```
1. Frontend requests points
   ↓
2. Worker checks KV cache
   ├─ Cache HIT (90% of requests)
   │  ↓
   │  Return cached enhanced points (fast!)
   │  ↓
   │  ✅ Response time: <100ms
   │
   └─ Cache MISS (10% of requests)
      ↓
      3. Fetch from ACE API
      ↓
      4. Enhance points with display_name
      ↓
      5. Store in KV cache (1 hour TTL)
      ↓
      6. Return enhanced points
      ↓
      ✅ Response time: <2s
      ✅ Future requests cached

7. Frontend receives ENHANCED points with display_name
   ↓
8. ✅ UI shows human-readable names: "SURGERYCHILLER Capacity"
```

---

## Point Enhancement Logic

### formatDisplayName() Function
```
Input:  "SURGERYCHILLER-Capacity"
        ↓
Step 1: Replace dashes with spaces
        "SURGERYCHILLER Capacity"
        ↓
Step 2: Preserve HVAC abbreviations
        - AHU, VAV, CHW, CW, SP stay uppercase
        - "SURGERYCHILLER Capacity" (no abbreviations)
        ↓
Output: "SURGERYCHILLER Capacity"

Examples:
"AHU-01-ZoneTemp"           → "AHU-01 Zone Temp"
"VAV-Box-01-DamperPosition" → "VAV-Box-01 Damper Position"
"BOILER-01-SupplyTemp-SP"   → "BOILER-01 Supply Temp-SP"
"CHW-Loop-01-FlowRate"      → "CHW-Loop-01 Flow Rate"
```

---

## KV Storage Structure

### POINTS_KV Namespace

**Key Format:**
```
site:{siteId}:points
```

**Value Format:**
```json
{
  "cached_at": "2025-10-13T12:00:00.000Z",
  "ttl": 3600,
  "site_id": "309",
  "site_name": "ses_falls_city",
  "point_count": 50000,
  "points": [
    {
      "id": 12345,
      "Name": "SURGERYCHILLER-Capacity",
      "display_name": "SURGERYCHILLER Capacity",
      "point_type": "Analog",
      "unit": "Tons",
      "collect_enabled": true,
      "description": "Surgery Chiller Capacity",
      // ... other ACE API fields
    },
    {
      "id": 12346,
      "Name": "AHU-01-ZoneTemp",
      "display_name": "AHU-01 Zone Temp",
      "point_type": "Analog",
      "unit": "°F",
      "collect_enabled": true,
      // ... other ACE API fields
    }
    // ... 49,998 more points
  ]
}
```

**Storage Characteristics:**
- **Key Size:** ~30 bytes
- **Value Size:** ~5-10 MB (50K points × ~100-200 bytes each)
- **TTL:** 3600 seconds (1 hour)
- **Expiration:** Automatic by Cloudflare
- **Max Size:** 25 MB per key (plenty of headroom)

---

## Cache Strategy

### Cache Levels
```
┌─────────────────────────────────────────────────────────┐
│  Level 1: Browser Cache (Not Implemented)               │
│  - ServiceWorker caching                                │
│  - IndexedDB storage                                    │
│  - TTL: 5 minutes                                       │
└─────────────────────────────────────────────────────────┘
                        ↓ Cache Miss
┌─────────────────────────────────────────────────────────┐
│  Level 2: Cloudflare Worker KV (RECOMMENDED)           │
│  - Edge-based caching                                  │
│  - Global distribution                                 │
│  - TTL: 1 hour                                         │
│  - Hit Rate: 90%+                                      │
└─────────────────────────────────────────────────────────┘
                        ↓ Cache Miss
┌─────────────────────────────────────────────────────────┐
│  Level 3: ACE IoT API (Origin)                         │
│  - Direct database query                              │
│  - No caching                                          │
│  - Response time: 1-2s                                 │
└─────────────────────────────────────────────────────────┘
```

### Cache Invalidation Strategies

**Strategy 1: Time-based (CURRENT RECOMMENDATION)**
```
- TTL: 1 hour
- Automatic expiration by Cloudflare
- Simple and reliable
- Good for most use cases
```

**Strategy 2: Manual Invalidation (FUTURE)**
```
- Add ?bypass_cache=true parameter
- User can force refresh
- Useful for debugging
- Already supported by frontend
```

**Strategy 3: Webhook Invalidation (FUTURE)**
```
- ACE API sends webhook when points change
- Worker invalidates cache immediately
- Requires ACE API integration
- Best user experience
```

---

## Configuration Files Comparison

### Current (wrangler-simple.toml)
```toml
name = "ace-iot-ai-proxy"
main = "point-filter-worker.js"
compatibility_date = "2024-10-01"

[vars]
ACE_API_URL = "https://flightdeck.aceiot.cloud"
```

**Issues:**
- ❌ NO KV namespace bindings
- ❌ Simple proxy only
- ❌ No point enhancement

### Recommended (wrangler.toml)
```toml
name = "ace-iot-ai-proxy"
main = "point-enhanced-proxy.js"
compatibility_date = "2024-10-01"

# KV Namespaces for caching and storage
[[kv_namespaces]]
binding = "POINTS_KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "3da8101694114af99d288124d2b8fcf2"

[vars]
ACE_API_URL = "https://flightdeck.aceiot.cloud"
CACHE_TTL = "3600"  # 1 hour
MAX_POINTS = "100000"  # Max points to process
```

**Benefits:**
- ✅ KV namespace bindings
- ✅ Point enhancement enabled
- ✅ Caching configured
- ✅ Simple and maintainable

---

## Performance Comparison

### Current Architecture
| Metric | Value | Notes |
|--------|-------|-------|
| Cache Hit Rate | 0% | No caching |
| Response Time (first) | 2-3s | Direct ACE API call |
| Response Time (cached) | N/A | No cache |
| Data Transfer | 5-10 MB | Full JSON payload |
| Point Enhancement | No | Raw ACE API names |
| User Experience | Poor | Slow, ugly names |

### Recommended Architecture
| Metric | Value | Notes |
|--------|-------|-------|
| Cache Hit Rate | 90%+ | KV caching |
| Response Time (first) | 1-2s | ACE API + enhancement |
| Response Time (cached) | <100ms | KV read only |
| Data Transfer | 5-10 MB | Same as current |
| Point Enhancement | Yes | Clean display names |
| User Experience | Excellent | Fast, readable names |

**Performance Improvement:**
- **90% of requests:** 20-30x faster (2-3s → <100ms)
- **10% of requests:** Similar speed (2-3s → 1-2s)
- **Overall:** 18-27x average improvement

---

## Deployment Strategy

### Phase 1: Preparation
```
1. Create point-enhanced-proxy.js
   - Copy proxy logic from point-filter-worker.js
   - Add formatDisplayName() from points.js
   - Add KV caching logic
   - Add error handling

2. Update wrangler.toml
   - Add KV namespace bindings
   - Update main entry point
   - Set cache TTL variables

3. Test locally
   - npx wrangler dev
   - Test KV cache hit/miss
   - Verify display_name generation
```

### Phase 2: Deployment
```
1. Deploy to Cloudflare
   - cd workers
   - npx wrangler deploy
   - Monitor deployment logs

2. Verify worker endpoints
   - curl test points endpoint
   - Check response format
   - Verify display_name field

3. Test cache behavior
   - First request (cache miss)
   - Second request (cache hit)
   - Check X-Cache header
```

### Phase 3: Frontend Integration
```
1. Test frontend integration
   - Load dashboard
   - Select site
   - Verify ALL points load
   - Check point selector UI

2. Verify display names
   - UI shows human-readable names
   - Charts use display_name for labels
   - API calls use Name field

3. Monitor performance
   - Check cache hit rate
   - Monitor response times
   - Verify error handling
```

---

## Rollback Plan

### If Issues Occur
```
1. Immediate rollback
   - cd workers
   - git checkout HEAD~1 wrangler.toml
   - npx wrangler deploy
   - Reverts to previous worker

2. Debug issues
   - Check Worker logs
   - Verify KV namespace IDs
   - Test locally with wrangler dev

3. Staged rollout
   - Deploy to staging first
   - Test thoroughly
   - Deploy to production
```

---

## Success Criteria

### Functional Requirements
- ✅ ALL points load (not just 10)
- ✅ Every point has display_name field
- ✅ Display names are human-readable
- ✅ Chart selectors show clean names
- ✅ API calls use Name field
- ✅ Cache hit rate > 90%

### Performance Requirements
- ✅ Cache hit response time < 100ms
- ✅ Cache miss response time < 2s
- ✅ No increase in error rate
- ✅ KV storage within limits

### Quality Requirements
- ✅ All integration tests passing
- ✅ Zero console errors
- ✅ Proper error handling
- ✅ Comprehensive logging

---

## Next Steps

1. **Review this architectural design** with development team
2. **Create point-enhanced-proxy.js** worker implementation
3. **Update wrangler.toml** with KV bindings
4. **Test locally** with wrangler dev
5. **Deploy to production** and verify
6. **Monitor cache performance** and user experience

---

## Questions for Discussion

1. **KV Namespace IDs:** Are the IDs in wrangler-full-capacity.toml correct?
2. **Cache TTL:** Is 1 hour appropriate, or should we use longer/shorter?
3. **Display Name Logic:** Are there other HVAC abbreviations to preserve?
4. **Error Handling:** What should happen if KV is unavailable?
5. **Monitoring:** Do we need cache analytics dashboard?

---

## Conclusion

The recommended architecture provides:
- ✅ **Simplicity:** Single worker, clear logic, easy to maintain
- ✅ **Performance:** 90%+ cache hit rate, <100ms response time
- ✅ **User Experience:** All points visible, human-readable names
- ✅ **Scalability:** KV storage handles 100K+ points per site
- ✅ **Reliability:** Automatic cache expiration, error handling

**Implementation Complexity:** Medium
**Implementation Time:** 4-6 hours
**Business Impact:** HIGH - Resolves critical UX blocker
