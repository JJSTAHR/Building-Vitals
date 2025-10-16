# Consolidated ACE Proxy Worker - Testing Checklist

## Pre-Deployment Testing

### ✅ Local Development Testing

#### 1. Health Check Endpoint
```bash
# Start local dev server
wrangler dev --config wrangler-consolidated.toml

# Test health endpoint
curl http://localhost:8787/api/health

# ✅ Expected Response:
{
  "status": "healthy",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "version": "1.0.0",
  "services": {
    "kv": "connected",
    "ace_api": "reachable"
  }
}

# ✅ Verify:
- [ ] Status is "healthy"
- [ ] KV shows "connected"
- [ ] ACE API shows "reachable"
```

#### 2. CORS Preflight Requests
```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost:8787/api/sites \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-ACE-Token" \
  -v

# ✅ Verify Response Headers:
- [ ] HTTP/1.1 204 No Content
- [ ] Access-Control-Allow-Origin: *
- [ ] Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE
- [ ] Access-Control-Allow-Headers: Content-Type, X-ACE-Token, Authorization
```

#### 3. Sites Endpoint
```bash
# Test sites endpoint
curl http://localhost:8787/api/sites \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Returns JSON with "items" array
- [ ] Contains expected site names
- [ ] X-Cache-Status: BYPASS (sites not cached)
- [ ] X-Processing-Time header present
```

#### 4. Configured Points Endpoint - First Request (Cache MISS)
```bash
# First request to configured_points
curl http://localhost:8787/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v | tee /tmp/points_response.json

# ✅ Verify Response:
- [ ] HTTP 200 OK
- [ ] X-Cache-Status: MISS
- [ ] Returns JSON with "items" array
- [ ] Points have "display_name" field
- [ ] Points have "marker_tags" array
- [ ] Points have "_cleaned": true
- [ ] X-Point-Count header matches item count

# ✅ Verify Point Structure:
jq '.items[0]' /tmp/points_response.json

# Should include:
- [ ] name (original name)
- [ ] display_name (cleaned name)
- [ ] collect_enabled (boolean)
- [ ] unit (string or null)
- [ ] marker_tags (array)
- [ ] kv_tags (array)
- [ ] _cleaned (true)
- [ ] _cleanedAt (ISO timestamp)
```

#### 5. Configured Points Endpoint - Second Request (Cache HIT)
```bash
# Immediate second request (should hit cache)
curl http://localhost:8787/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] X-Cache-Status: HIT
- [ ] Response matches first request
- [ ] Processing time < 50ms (cached response)
- [ ] fromCache: true in response body
- [ ] cacheAge present in response
```

#### 6. Configured Points - Cache Bypass
```bash
# Test cache bypass parameter
curl "http://localhost:8787/api/sites/ses_falls_city/configured_points?bypass_cache=true" \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] X-Cache-Status: MISS (even on subsequent requests)
- [ ] Fresh data from ACE API
- [ ] Processing time > 500ms (bypassed cache)
```

#### 7. Paginated Timeseries Endpoint
```bash
# Test timeseries endpoint
curl "http://localhost:8787/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v | tee /tmp/timeseries_response.json

# ✅ Verify Response:
- [ ] HTTP 200 OK
- [ ] X-Cache-Status: MISS (first request)
- [ ] Returns JSON with "point_samples" array
- [ ] has_more field present (boolean)
- [ ] next_cursor field present (string or null)
- [ ] X-Cache-TTL header present
- [ ] X-Cache-Reason header explains TTL choice

# ✅ Verify Data Structure:
jq '.point_samples[0]' /tmp/timeseries_response.json

# Should include:
- [ ] name (point name)
- [ ] value (numeric or string)
- [ ] time (ISO timestamp)
```

#### 8. Timeseries with point_names Filter
```bash
# Test with specific points
POINT_NAMES="AHU1_SA_T,AHU1_RA_T,AHU1_OA_T"

curl "http://localhost:8787/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&point_names=${POINT_NAMES}&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v | tee /tmp/filtered_timeseries.json

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Only requested points in response
- [ ] point_samples array length > 0
- [ ] All point names in response match filter
```

#### 9. Timeseries Caching
```bash
# First request
curl "http://localhost:8787/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v | grep "X-Cache-Status"
# Should show: MISS

# Immediate second request
curl "http://localhost:8787/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v | grep "X-Cache-Status"
# Should show: HIT

# ✅ Verify:
- [ ] First request: X-Cache-Status: MISS
- [ ] Second request: X-Cache-Status: HIT
- [ ] Cache hit response < 100ms
```

#### 10. Error Handling - Missing Token
```bash
# Test without token
curl http://localhost:8787/api/sites -v

# ✅ Verify:
- [ ] HTTP 401 Unauthorized
- [ ] Returns JSON error message
- [ ] CORS headers present
- [ ] Error message: "Missing authentication token"
```

#### 11. Error Handling - Invalid Token
```bash
# Test with invalid token
curl http://localhost:8787/api/sites \
  -H "X-ACE-Token: invalid_token_12345" \
  -v

# ✅ Verify:
- [ ] HTTP 401 Unauthorized (from ACE API)
- [ ] CORS headers present
- [ ] Error message from ACE API passed through
```

#### 12. Error Handling - Invalid Site Name
```bash
# Test with non-existent site
curl http://localhost:8787/api/sites/nonexistent_site_xyz/configured_points \
  -H "X-ACE-Token: YOUR_TEST_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 404 Not Found (or appropriate error from ACE API)
- [ ] CORS headers present
- [ ] Error message explains issue
```

#### 13. Logging Verification
```bash
# View logs while testing
wrangler dev --config wrangler-consolidated.toml

# ✅ Verify logs show:
- [ ] [REQUEST] entries for each request
- [ ] [SITES] entries for sites endpoint
- [ ] [POINTS] Cache HIT/MISS messages
- [ ] [TIMESERIES] Cache HIT/MISS messages
- [ ] Detailed context in each log entry
- [ ] No sensitive data (tokens) in logs
```

## Post-Deployment Testing (Production)

### ✅ Production Environment Validation

Replace `http://localhost:8787` with your production URL:
`https://ace-iot-consolidated-proxy.your-subdomain.workers.dev`

#### 1. Production Health Check
```bash
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/health

# ✅ Verify:
- [ ] Status: "healthy"
- [ ] All services: "connected"
- [ ] Response time < 500ms
```

#### 2. Production CORS
```bash
# Test from your frontend domain
curl -X OPTIONS https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites \
  -H "Origin: https://your-app.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# ✅ Verify:
- [ ] 204 No Content
- [ ] CORS headers present
- [ ] Origin accepted
```

#### 3. Production Sites Endpoint
```bash
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites \
  -H "X-ACE-Token: YOUR_PRODUCTION_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Valid site list
- [ ] Response time < 2s
```

#### 4. Production Points with Real Data
```bash
# Test with real production site
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_PRODUCTION_TOKEN" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Expected number of points (check against known count)
- [ ] Points are properly cleaned
- [ ] X-Point-Count header accurate
```

#### 5. Production Cache Performance
```bash
# Measure cache performance over 10 requests
for i in {1..10}; do
  echo "Request $i:"
  curl -w "\nTime: %{time_total}s\nCache: " \
    https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points \
    -H "X-ACE-Token: YOUR_PRODUCTION_TOKEN" \
    -s -o /dev/null \
    -D - | grep -i "X-Cache-Status\|X-Processing-Time"
  sleep 1
done

# ✅ Verify:
- [ ] Request 1: MISS, time > 1s
- [ ] Requests 2-10: HIT, time < 100ms
- [ ] Cache hit rate ≥ 90%
```

#### 6. Production Timeseries Performance
```bash
# Test large timeseries request
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-01T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=5000" \
  -H "X-ACE-Token: YOUR_PRODUCTION_TOKEN" \
  -w "\nTime: %{time_total}s\n" \
  -v

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Response time < 10s
- [ ] Data points match expected range
- [ ] No CPU limit errors
```

#### 7. Monitor Production Logs
```bash
# Tail production logs
wrangler tail ace-iot-consolidated-proxy --format pretty

# ✅ Verify logs show:
- [ ] No error messages
- [ ] Cache hit rate > 50%
- [ ] Processing times reasonable
- [ ] No authentication failures (with valid tokens)
```

## Integration Testing (Frontend)

### ✅ Frontend Integration

#### 1. Update Frontend Configuration
```javascript
// Update API base URL
const API_BASE_URL = 'https://ace-iot-consolidated-proxy.your-subdomain.workers.dev';

// ✅ Verify:
- [ ] Environment variable set correctly
- [ ] No hardcoded ACE API URLs remaining
- [ ] Build succeeds without errors
```

#### 2. Test Sites Loading
```javascript
// In browser console
localStorage.setItem('aceToken', 'YOUR_TOKEN');
location.reload();

// Navigate to sites list page

// ✅ Verify:
- [ ] Sites load successfully
- [ ] No CORS errors in console
- [ ] Response headers visible in Network tab
- [ ] Sites list matches expected
```

#### 3. Test Points Selection
```javascript
// Navigate to point selection page
// Select a site

// ✅ Verify:
- [ ] Points load successfully
- [ ] display_name shown in UI (not technical names)
- [ ] Points are filterable
- [ ] marker_tags used for categorization
- [ ] Loading spinner shows during fetch
```

#### 4. Test Chart Loading
```javascript
// Select points and create chart
// Choose date range

// ✅ Verify:
- [ ] Timeseries data loads
- [ ] Chart renders correctly
- [ ] Data points match selected range
- [ ] No errors in console
- [ ] Chart updates on range change
```

#### 5. Test Cache Behavior
```javascript
// Load same chart twice
// 1. First load (cache MISS)
// 2. Immediate reload (cache HIT)

// Open Network tab, compare requests:
// ✅ Verify:
- [ ] First request: X-Cache-Status: MISS, ~2s
- [ ] Second request: X-Cache-Status: HIT, <100ms
- [ ] Data identical between requests
```

#### 6. Test Multiple Users
```javascript
// Have 2+ users access same site/points simultaneously

// ✅ Verify:
- [ ] All users see data
- [ ] Cache shared correctly
- [ ] No race conditions
- [ ] No authentication cross-contamination
```

## Load Testing

### ✅ Performance Under Load

#### 1. Concurrent Requests Test
```bash
# Install Apache Bench (if not installed)
# sudo apt-get install apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 \
  -H "X-ACE-Token: YOUR_TOKEN" \
  https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites

# ✅ Verify:
- [ ] 100% success rate
- [ ] Average time < 500ms
- [ ] No failed requests
- [ ] No timeout errors
```

#### 2. Cache Performance Under Load
```bash
# Test cached endpoint
ab -n 1000 -c 50 \
  -H "X-ACE-Token: YOUR_TOKEN" \
  https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points

# ✅ Verify:
- [ ] 99%+ success rate
- [ ] Average time < 100ms (cached)
- [ ] No CPU limit errors
- [ ] KV read limit not exceeded
```

#### 3. Large Timeseries Test
```bash
# Test 365 days of data
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2024-10-13T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=10000" \
  -H "X-ACE-Token: YOUR_TOKEN" \
  -w "\nTime: %{time_total}s\n"

# ✅ Verify:
- [ ] HTTP 200 OK
- [ ] Response time < 30s
- [ ] No CPU limit errors
- [ ] All data points returned
```

## Security Testing

### ✅ Security Validation

#### 1. Token Validation
```bash
# Test without token
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites

# ✅ Verify:
- [ ] HTTP 401 Unauthorized
- [ ] Error message doesn't reveal sensitive info
```

#### 2. SQL Injection (N/A - no SQL)
```bash
# Test with SQL injection attempt
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/'; DROP TABLE users;--/configured_points" \
  -H "X-ACE-Token: YOUR_TOKEN"

# ✅ Verify:
- [ ] HTTP 404 or 400 (malformed URL)
- [ ] No SQL execution
- [ ] Worker doesn't crash
```

#### 3. XSS Protection
```bash
# Test with XSS payload
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/<script>alert('xss')</script>/configured_points" \
  -H "X-ACE-Token: YOUR_TOKEN"

# ✅ Verify:
- [ ] HTTP 404 or 400
- [ ] Payload not executed
- [ ] Response properly escaped
```

#### 4. Rate Limiting
```bash
# Send 1000 rapid requests
for i in {1..1000}; do
  curl -s https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/health > /dev/null &
done
wait

# ✅ Verify:
- [ ] Worker continues responding
- [ ] Cloudflare rate limiting may kick in
- [ ] No worker crashes
```

## Monitoring & Alerting

### ✅ Production Monitoring Setup

#### 1. Cloudflare Dashboard Metrics
```
Navigate to: Workers & Pages > ace-iot-consolidated-proxy > Metrics

# ✅ Verify metrics show:
- [ ] Requests per second
- [ ] Success rate (target >99%)
- [ ] Error rate (target <1%)
- [ ] CPU time (target <5s average)
- [ ] KV operations
```

#### 2. Set Up Alerts
```
Navigate to: Notifications > Add

# ✅ Create alerts for:
- [ ] Error rate >5% for 5 minutes
- [ ] CPU time >20s average for 5 minutes
- [ ] Request success rate <95% for 5 minutes
```

#### 3. External Uptime Monitoring
```
Use service like UptimeRobot or StatusCake

# ✅ Configure:
- [ ] Health endpoint check every 5 minutes
- [ ] Alert on 2+ consecutive failures
- [ ] Email/SMS notifications
```

## Sign-Off Checklist

### ✅ Ready for Production

- [ ] All local tests pass
- [ ] All production tests pass
- [ ] Frontend integration working
- [ ] Cache performance >70% hit rate
- [ ] Load testing successful
- [ ] Security tests pass
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Documentation complete
- [ ] Team trained on new worker
- [ ] Rollback procedure documented
- [ ] Emergency contacts defined

### ✅ Post-Deployment

- [ ] Monitor for 24 hours
- [ ] Check error logs daily
- [ ] Verify cache performance
- [ ] Collect user feedback
- [ ] Document any issues
- [ ] Plan optimization improvements

## Issue Reporting Template

When reporting issues, include:

```
**Issue**: Brief description

**Environment**: Production/Staging/Development

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happened

**Request Details**:
- URL: ...
- Headers: ...
- Response Status: ...
- Response Time: ...

**Logs** (from wrangler tail):
```
[paste relevant logs]
```

**Browser Console** (if frontend issue):
```
[paste console errors]
```
```

## Resources

- Worker Code: `consolidated-ace-proxy-worker.js`
- Config: `wrangler-consolidated.toml`
- Deployment Instructions: `DEPLOYMENT_INSTRUCTIONS.md`
- KV Setup: `KV_SETUP_COMMANDS.md`
