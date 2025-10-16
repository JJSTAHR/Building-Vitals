# Consolidated ACE Proxy Worker - Quick Start Guide

## 🚀 5-Minute Deployment

### Step 1: Create KV Namespace (2 minutes)

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv:namespace create "POINTS_KV"
# Save the id: abc123...

wrangler kv:namespace create "POINTS_KV" --preview
# Save the preview_id: xyz789...
```

### Step 2: Configure Worker (1 minute)

Edit `wrangler-consolidated.toml`:

```toml
# Line 6: Add your account ID (from: wrangler whoami)
account_id = "YOUR_ACCOUNT_ID"

# Lines 15-17: Add your KV IDs from Step 1
[[kv_namespaces]]
binding = "POINTS_KV"
id = "abc123..."          # From step 1
preview_id = "xyz789..."  # From step 1
```

### Step 3: Deploy (1 minute)

```bash
# Deploy to production
wrangler deploy --config wrangler-consolidated.toml

# Output shows your worker URL:
# https://ace-iot-consolidated-proxy.your-subdomain.workers.dev
```

### Step 4: Test (1 minute)

```bash
# Test health endpoint
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/health

# Test with real token
curl https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites \
  -H "X-ACE-Token: YOUR_ACE_TOKEN"
```

### Step 5: Update Frontend (<1 minute)

```javascript
// Update your API base URL
const API_BASE_URL = 'https://ace-iot-consolidated-proxy.your-subdomain.workers.dev';
```

Done! 🎉

---

## 📋 Common Commands

### Deployment
```bash
# Local development
wrangler dev --config wrangler-consolidated.toml

# Deploy to production
wrangler deploy --config wrangler-consolidated.toml

# Deploy to staging
wrangler deploy --env staging --config wrangler-consolidated.toml
```

### Monitoring
```bash
# View real-time logs
wrangler tail ace-iot-consolidated-proxy

# List deployments
wrangler deployments list --name ace-iot-consolidated-proxy

# Rollback to previous version
wrangler rollback
```

### KV Management
```bash
# List all keys
wrangler kv:key list --binding POINTS_KV

# Get specific key
wrangler kv:key get "site:ses_falls_city:configured_points" --binding POINTS_KV

# Delete specific key (cache invalidation)
wrangler kv:key delete "site:ses_falls_city:configured_points" --binding POINTS_KV
```

---

## 🔍 Testing Endpoints

### Health Check
```bash
curl https://your-worker.workers.dev/api/health
```

### Sites List
```bash
curl https://your-worker.workers.dev/api/sites \
  -H "X-ACE-Token: YOUR_TOKEN"
```

### Configured Points (with caching)
```bash
# First request (cache MISS)
curl https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_TOKEN" \
  -v | grep "X-Cache-Status"

# Second request (cache HIT)
curl https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_TOKEN" \
  -v | grep "X-Cache-Status"
```

### Timeseries Data
```bash
curl "https://your-worker.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00Z&end_time=2025-10-13T00:00:00Z&raw_data=true&page_size=1000" \
  -H "X-ACE-Token: YOUR_TOKEN"
```

### Cache Bypass
```bash
curl "https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points?bypass_cache=true" \
  -H "X-ACE-Token: YOUR_TOKEN"
```

---

## 🐛 Troubleshooting

### Problem: "No namespace with binding POINTS_KV found"
**Solution**: Check wrangler.toml has correct KV namespace ID
```bash
wrangler kv:namespace list
```

### Problem: CORS errors in browser
**Solution**: Verify worker is deployed and returns CORS headers
```bash
curl -I https://your-worker.workers.dev/api/health | grep -i "access-control"
```

### Problem: 401 Unauthorized
**Solution**: Check token is being passed correctly
```bash
# Test direct ACE API call
curl "https://flightdeck.aceiot.cloud/api/sites" \
  -H "authorization: Bearer YOUR_TOKEN"
```

### Problem: Cache not working
**Solution**: Check health endpoint and KV connection
```bash
curl https://your-worker.workers.dev/api/health | jq '.services.kv'
# Should show: "connected"
```

### Problem: Slow responses
**Solution**: Check if cache is being used
```bash
curl -I https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points \
  -H "X-ACE-Token: YOUR_TOKEN" | grep "X-Cache-Status"
# Should show: HIT after first request
```

---

## 📊 Key Metrics

### Response Time Targets
- Cache HIT: <100ms
- Cache MISS: 1-3s (points), 2-10s (timeseries)
- Health Check: <200ms

### Cache Performance Targets
- Points: >80% hit rate
- Timeseries (recent): >60% hit rate
- Timeseries (historical): >90% hit rate

### Reliability Targets
- Success Rate: >99%
- Error Rate: <1%
- Uptime: >99.9%

---

## 📁 Files Reference

1. **consolidated-ace-proxy-worker.js** - Main worker code
2. **wrangler-consolidated.toml** - Configuration
3. **DEPLOYMENT_INSTRUCTIONS.md** - Full deployment guide
4. **KV_SETUP_COMMANDS.md** - KV management commands
5. **TESTING_CHECKLIST.md** - Comprehensive testing
6. **IMPLEMENTATION_SUMMARY.md** - Complete overview

---

## 🔗 Useful Links

- Cloudflare Dashboard: https://dash.cloudflare.com/
- Workers Documentation: https://developers.cloudflare.com/workers/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- KV Storage: https://developers.cloudflare.com/kv/

---

## 💡 Pro Tips

1. **Monitor Your Logs**
   ```bash
   wrangler tail ace-iot-consolidated-proxy --format pretty
   ```

2. **Use Cache Bypass for Testing**
   ```bash
   ?bypass_cache=true
   ```

3. **Check Cache Keys**
   ```bash
   wrangler kv:key list --binding POINTS_KV --prefix "site:"
   ```

4. **View Metrics in Dashboard**
   - Workers & Pages > ace-iot-consolidated-proxy > Metrics

5. **Set Up Alerts**
   - Notifications > Add > Worker error rate >5%

---

## 🆘 Need Help?

1. Check the documentation files
2. View worker logs: `wrangler tail`
3. Test health endpoint: `/api/health`
4. Check KV status: `wrangler kv:key list`
5. Review Cloudflare status: https://www.cloudflarestatus.com/

---

**Version**: 1.0.0 | **Last Updated**: 2025-10-13
