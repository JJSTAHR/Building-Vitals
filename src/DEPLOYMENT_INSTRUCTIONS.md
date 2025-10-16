# Consolidated ACE Proxy Worker - Deployment Instructions

## Overview

This document provides complete instructions for deploying the consolidated Cloudflare Worker that handles ALL ACE IoT API requests with proper CORS, authentication, caching, and enhancement.

## Prerequisites

1. **Cloudflare Account**
   - Free or paid Cloudflare account
   - Workers plan (Free tier: 100,000 requests/day)
   - KV plan (Free tier: 100,000 reads/day, 1,000 writes/day)

2. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   # or
   npm install --save-dev wrangler
   ```

3. **Authentication**
   ```bash
   wrangler login
   # Opens browser for authentication
   ```

## Deployment Steps

### Step 1: Create KV Namespaces

```bash
# Production namespace
wrangler kv:namespace create "POINTS_KV"
# Save the id from output: abc123def456...

# Preview namespace (for local dev)
wrangler kv:namespace create "POINTS_KV" --preview
# Save the preview_id from output: xyz789abc123...

# Optional: Development namespace
wrangler kv:namespace create "POINTS_KV_DEV"
# Save the id for env.development

# Optional: Staging namespace
wrangler kv:namespace create "POINTS_KV_STAGING"
# Save the id for env.staging
```

### Step 2: Get Your Cloudflare Account ID

```bash
# Method 1: Via CLI
wrangler whoami

# Method 2: From Dashboard
# Go to: Cloudflare Dashboard > Workers & Pages > Overview
# Your account ID is shown at the top right
```

### Step 3: Configure wrangler.toml

Edit `wrangler-consolidated.toml` and replace:

```toml
# Line 6: Replace with your account ID
account_id = "YOUR_ACCOUNT_ID_HERE"

# Lines 15-17: Replace with KV namespace IDs from Step 1
[[kv_namespaces]]
binding = "POINTS_KV"
id = "abc123def456..."  # From production namespace
preview_id = "xyz789abc123..."  # From preview namespace
```

**Optional**: Configure development and staging environments similarly.

### Step 4: Test Locally

```bash
# Navigate to worker directory
cd /path/to/Building Vitals/src

# Start local dev server
wrangler dev wrangler-consolidated.toml

# Worker will be available at: http://localhost:8787
```

**Test endpoints:**

```bash
# Health check
curl http://localhost:8787/api/health

# Sites (requires token)
curl http://localhost:8787/api/sites \
  -H "X-ACE-Token: YOUR_ACE_TOKEN"

# Configured points (requires token)
curl http://localhost:8787/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_ACE_TOKEN"
```

### Step 5: Deploy to Production

```bash
# Deploy worker
wrangler deploy --config wrangler-consolidated.toml

# Output will show:
# ✨ Success! Uploaded 1 file
# 🌎 Published ace-iot-consolidated-proxy
#    https://ace-iot-consolidated-proxy.your-subdomain.workers.dev
```

**Save the worker URL** - you'll need it for frontend configuration.

### Step 6: Configure Custom Domain (Optional)

```bash
# Add route to wrangler.toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]

# Redeploy
wrangler deploy --config wrangler-consolidated.toml

# Or add route via Dashboard:
# Workers & Pages > ace-iot-consolidated-proxy > Triggers > Routes > Add route
```

### Step 7: Verify Deployment

```bash
# Get your worker URL
wrangler deployments list --name ace-iot-consolidated-proxy

# Test health endpoint
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-13T10:30:00.000Z",
#   "version": "1.0.0",
#   "services": {
#     "kv": "connected",
#     "ace_api": "reachable"
#   }
# }
```

### Step 8: Test with Real Token

```bash
# Get your ACE IoT token from frontend localStorage or Firebase

# Test sites endpoint
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites \
  -H "X-ACE-Token: YOUR_REAL_TOKEN"

# Test configured points (first request - cache MISS)
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_REAL_TOKEN" \
  -v | grep -i "X-Cache-Status"
# Should show: X-Cache-Status: MISS

# Test configured points (second request - cache HIT)
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_REAL_TOKEN" \
  -v | grep -i "X-Cache-Status"
# Should show: X-Cache-Status: HIT

# Test timeseries endpoint
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_REAL_TOKEN"
```

### Step 9: Update Frontend Configuration

Update your frontend to use the new worker URL:

**Option A: Environment Variable**
```javascript
// .env.production
VITE_ACE_API_URL=https://ace-iot-consolidated-proxy.your-subdomain.workers.dev
```

**Option B: API Service Configuration**
```typescript
// src/services/apiConfig.ts
export const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://ace-iot-consolidated-proxy.your-subdomain.workers.dev'
    : 'http://localhost:8787';
```

**No frontend code changes required** - worker accepts `X-ACE-Token` header and handles all transformations.

### Step 10: Monitor Deployment

```bash
# View real-time logs
wrangler tail ace-iot-consolidated-proxy --format pretty

# Check metrics in Cloudflare Dashboard
# Workers & Pages > ace-iot-consolidated-proxy > Metrics

# Key metrics to monitor:
# - Requests per second
# - Error rate (should be <1%)
# - CPU time (should be <30s average)
# - KV reads/writes
```

## Deployment Environments

### Development

```bash
# Deploy to development
wrangler deploy --env development --config wrangler-consolidated.toml

# URL: https://ace-iot-consolidated-proxy-dev.your-subdomain.workers.dev
```

### Staging

```bash
# Deploy to staging
wrangler deploy --env staging --config wrangler-consolidated.toml

# URL: https://ace-iot-consolidated-proxy-staging.your-subdomain.workers.dev
```

### Production

```bash
# Deploy to production
wrangler deploy --config wrangler-consolidated.toml

# URL: https://ace-iot-consolidated-proxy.your-subdomain.workers.dev
```

## Rollback Procedure

```bash
# List previous deployments
wrangler deployments list --name ace-iot-consolidated-proxy

# Rollback to previous version
wrangler rollback --message "Rolling back due to issue"

# Or deploy specific version
wrangler versions deploy [VERSION_ID]
```

## Updating the Worker

```bash
# 1. Make changes to consolidated-ace-proxy-worker.js

# 2. Test locally
wrangler dev --config wrangler-consolidated.toml

# 3. Deploy to staging (if available)
wrangler deploy --env staging --config wrangler-consolidated.toml

# 4. Test staging thoroughly

# 5. Deploy to production
wrangler deploy --config wrangler-consolidated.toml

# 6. Monitor logs for issues
wrangler tail ace-iot-consolidated-proxy
```

## Troubleshooting

### Issue: "No namespace with binding POINTS_KV found"

**Solution:**
1. Verify KV namespace ID in wrangler.toml
2. Check namespace exists: `wrangler kv:namespace list`
3. Ensure account_id is correct

### Issue: CORS Errors in Browser

**Solution:**
1. Check worker logs: `wrangler tail ace-iot-consolidated-proxy`
2. Verify CORS headers in response:
   ```bash
   curl -I https://your-worker.workers.dev/api/health
   ```
3. Ensure preflight (OPTIONS) requests return 204

### Issue: 401 Unauthorized from ACE API

**Solution:**
1. Verify token is being passed correctly
2. Check worker logs for auth header transformation
3. Test direct ACE API call:
   ```bash
   curl "https://flightdeck.aceiot.cloud/api/sites" \
     -H "authorization: Bearer YOUR_TOKEN"
   ```
   Note: MUST be lowercase 'authorization'

### Issue: Cache Not Working

**Solution:**
1. Check health endpoint: `/api/health` should show `"kv": "connected"`
2. View KV keys: `wrangler kv:key list --binding POINTS_KV`
3. Check cache headers in response: `X-Cache-Status: HIT` or `MISS`
4. Test with bypass: `?bypass_cache=true`

### Issue: Slow Response Times

**Solution:**
1. Check CPU usage in dashboard
2. Monitor cache hit rate (target >70%)
3. Increase cache TTLs in worker code
4. Consider pre-warming cache for large sites

### Issue: Worker Exceeds CPU Limit

**Solution:**
1. Reduce batch size in point enhancement
2. Implement pagination for large sites
3. Use cache warming to process data off critical path
4. Consider upgrading to paid Workers plan ($5/month) for higher limits

## Performance Optimization

### Enable Cache Warming (Optional)

Add scheduled task to pre-populate cache:

```toml
# In wrangler-consolidated.toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

```javascript
// In worker code
export default {
  async fetch(...) { /* existing code */ },

  async scheduled(event, env, ctx) {
    // Pre-warm cache for top sites
    const sites = ['ses_falls_city', 'other_site_1', 'other_site_2'];

    for (const site of sites) {
      try {
        // Fetch and cache points
        await fetch(`https://ace-iot-consolidated-proxy.workers.dev/api/sites/${site}/configured_points`, {
          headers: { 'X-ACE-Token': env.SYSTEM_TOKEN }
        });
      } catch (error) {
        console.error(`Failed to warm cache for ${site}:`, error);
      }
    }
  }
};
```

### Monitor Cache Hit Rates

```bash
# View detailed logs with cache statistics
wrangler tail ace-iot-consolidated-proxy --format pretty | grep "Cache"

# Look for patterns:
# [POINTS] Cache HIT: {...}  # Good - serving from cache
# [POINTS] Cache MISS: {...} # Expected on first request
# [TIMESERIES] Cache HIT: {...} # Good - reusing data
```

## Security Considerations

1. **Never Commit Secrets**
   - Don't put real tokens in wrangler.toml
   - Use Cloudflare Secrets for sensitive data:
     ```bash
     wrangler secret put SYSTEM_TOKEN
     ```

2. **Rate Limiting**
   - Cloudflare automatically rate limits Workers
   - Free tier: 100,000 requests/day
   - Paid tier: 10M requests/month

3. **Token Validation**
   - Worker validates token presence
   - ACE API validates token authenticity
   - No token storage in worker (stateless)

4. **CORS Configuration**
   - Currently allows all origins (`*`)
   - For production, consider restricting:
     ```javascript
     const corsHeaders = {
       'Access-Control-Allow-Origin': 'https://your-app.com',
       // ...
     };
     ```

## Monitoring Dashboard

View worker metrics in Cloudflare Dashboard:
- **Workers & Pages** > **ace-iot-consolidated-proxy**
- **Metrics** tab shows:
  - Requests per second
  - Success rate
  - CPU time
  - Error logs
- **KV** tab shows:
  - Read/write operations
  - Storage usage
  - Cache hit rate

## Cost Estimates

### Free Tier
- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day, 1 GB storage
- **Cost:** $0/month
- **Suitable for:** Development, small deployments (<5 sites, <1000 users)

### Paid Workers Plan ($5/month)
- Workers: 10M requests/month
- KV: 10M reads/month, 1M writes/month, 1 GB storage
- **Cost:** $5/month
- **Suitable for:** Production, medium deployments (<50 sites, <10,000 users)

### Enterprise
- Custom limits and SLAs
- Dedicated support
- **Cost:** Contact Cloudflare
- **Suitable for:** Large deployments (>50 sites, >10,000 users)

## Next Steps

After successful deployment:

1. **Update Frontend**
   - Configure API base URL to worker
   - Test all features (sites, points, charts)
   - Monitor browser console for errors

2. **Set Up Monitoring**
   - Configure Cloudflare notifications
   - Set up uptime monitoring (e.g., UptimeRobot)
   - Create dashboard for key metrics

3. **Optimize Performance**
   - Analyze cache hit rates
   - Tune TTL values based on usage
   - Consider cache warming for popular sites

4. **Plan for Scale**
   - Monitor request patterns
   - Upgrade to paid plan if needed
   - Implement additional caching layers

## Support

For issues or questions:
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Community: https://community.cloudflare.com/
- Wrangler GitHub: https://github.com/cloudflare/workers-sdk
