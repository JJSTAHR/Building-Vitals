# KV Namespace Setup Commands

## Overview

This worker requires a Cloudflare KV namespace to cache:
- Configured points for each site
- Timeseries data with intelligent TTL

## KV Storage Structure

### Key Formats

1. **Configured Points**
   ```
   Key: site:{siteName}:configured_points
   Value: {
     points: [...],        // Array of cleaned point objects
     timestamp: 1234567890, // Unix timestamp in ms
     siteName: "ses_falls_city",
     source: "ace-api",
     version: "1.0.0"
   }
   TTL: 3600 seconds (1 hour)
   ```

2. **Timeseries Data**
   ```
   Key: timeseries:{siteName}:{startTime}:{endTime}:{pointNames}:{cursor}:{rawData}:{pageSize}
   Value: {
     point_samples: [...], // ACE API timeseries response
     has_more: false,
     next_cursor: null,
     ...
   }
   TTL: Variable (2 min to 24 hours based on data recency)
   ```

### Cleaned Point Structure

Each point in the cache has the following structure:

```json
{
  "name": "AHU1_SA_T",
  "display_name": "Air Handler 1 Supply Air Temperature (°F)",
  "collect_enabled": true,
  "unit": "°F",
  "marker_tags": ["point", "sensor", "ahu", "equip", "hvac", "temp", "air", "supply"],
  "kv_tags": [...],
  "original_name": "S./Drivers/BacnetNetwork/AHU1_SA_T",
  "_cleaned": true,
  "_cleanedAt": "2025-10-13T10:30:00.000Z"
}
```

## Create KV Namespaces

### 1. Production Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create "POINTS_KV"

# Output will look like:
# 🌀 Creating namespace with title "ace-iot-consolidated-proxy-POINTS_KV"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "POINTS_KV", id = "abc123def456..." }

# Save the namespace ID for wrangler.toml
```

### 2. Preview Namespace (for wrangler dev)

```bash
# Create preview KV namespace for local development
wrangler kv:namespace create "POINTS_KV" --preview

# Output will include preview_id
# Add this to wrangler.toml as preview_id
```

### 3. Development Namespace (optional)

```bash
# Create separate namespace for development environment
wrangler kv:namespace create "POINTS_KV_DEV"

# Use this ID in env.development section
```

### 4. Staging Namespace (optional)

```bash
# Create separate namespace for staging environment
wrangler kv:namespace create "POINTS_KV_STAGING"

# Use this ID in env.staging section
```

## Update wrangler.toml

After creating the namespaces, update `wrangler-consolidated.toml`:

```toml
# Production
[[kv_namespaces]]
binding = "POINTS_KV"
id = "YOUR_NAMESPACE_ID_FROM_STEP_1"
preview_id = "YOUR_PREVIEW_ID_FROM_STEP_2"

# Development
[[env.development.kv_namespaces]]
binding = "POINTS_KV"
id = "YOUR_DEV_NAMESPACE_ID_FROM_STEP_3"
preview_id = "YOUR_PREVIEW_ID_FROM_STEP_2"

# Staging
[[env.staging.kv_namespaces]]
binding = "POINTS_KV"
id = "YOUR_STAGING_NAMESPACE_ID_FROM_STEP_4"
preview_id = "YOUR_PREVIEW_ID_FROM_STEP_2"
```

## KV Management Commands

### List All Namespaces

```bash
wrangler kv:namespace list
```

### View Keys in Namespace

```bash
# List all keys
wrangler kv:key list --binding POINTS_KV

# List keys with prefix
wrangler kv:key list --binding POINTS_KV --prefix "site:"
wrangler kv:key list --binding POINTS_KV --prefix "timeseries:"
```

### Get Value

```bash
# Get a specific point cache
wrangler kv:key get "site:ses_falls_city:configured_points" --binding POINTS_KV

# Get timeseries cache
wrangler kv:key get "timeseries:ses_falls_city:2025-10-01T00:00:00Z:2025-10-02T00:00:00Z:all:first:true:1000" --binding POINTS_KV
```

### Manually Set Value (for testing)

```bash
# Put a test value
wrangler kv:key put "test:key" "test value" --binding POINTS_KV

# Put with TTL
wrangler kv:key put "test:key" "test value" --binding POINTS_KV --ttl 3600
```

### Delete Value

```bash
# Delete a specific key
wrangler kv:key delete "site:ses_falls_city:configured_points" --binding POINTS_KV

# Bulk delete (requires iteration)
wrangler kv:key list --binding POINTS_KV --prefix "site:" | jq -r '.[].name' | xargs -I {} wrangler kv:key delete {} --binding POINTS_KV
```

## Cache Invalidation

### Clear Specific Site Cache

```bash
# Clear configured points cache for a site
wrangler kv:key delete "site:ses_falls_city:configured_points" --binding POINTS_KV

# Or use bypass_cache parameter
curl "https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points?bypass_cache=true" \
  -H "X-ACE-Token: YOUR_TOKEN"
```

### Clear All Timeseries Cache

```bash
# List and delete all timeseries keys
wrangler kv:key list --binding POINTS_KV --prefix "timeseries:" | \
  jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete {} --binding POINTS_KV
```

### Clear All Cache

```bash
# WARNING: This clears EVERYTHING
wrangler kv:key list --binding POINTS_KV | \
  jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete {} --binding POINTS_KV
```

## Monitoring KV Usage

### Check Storage Usage

```bash
# KV usage is shown in Cloudflare Dashboard:
# Workers & Pages > KV > Select Namespace > View Usage

# Free tier limits:
# - 100,000 reads/day
# - 1,000 writes/day
# - 1,000 deletes/day
# - 1 GB stored data

# Paid tier ($0.50/month):
# - 10M reads/month
# - 1M writes/month
# - 1M deletes/month
# - 1 GB included storage
```

### View Cache Hit Rate

```bash
# Monitor cache performance in worker logs
wrangler tail ace-iot-consolidated-proxy

# Look for:
# [POINTS] Cache HIT: {...}
# [POINTS] Cache MISS - fetching from ACE API
# [TIMESERIES] Cache HIT: {...}
```

## Troubleshooting

### Issue: Namespace Not Found

```bash
# Error: No namespace with binding "POINTS_KV" found
# Solution: Ensure namespace ID is correctly set in wrangler.toml
wrangler kv:namespace list
```

### Issue: Cache Not Working

```bash
# Check if KV binding is accessible
wrangler tail ace-iot-consolidated-proxy

# Look for:
# [POINTS] Cache read error: ...
# [TIMESERIES] Cache read error: ...

# Test with health check
curl "https://your-worker.workers.dev/api/health"
# Should show: "kv": "connected"
```

### Issue: Stale Data

```bash
# Force cache refresh with bypass_cache parameter
curl "https://your-worker.workers.dev/api/sites/ses_falls_city/configured_points?bypass_cache=true" \
  -H "X-ACE-Token: YOUR_TOKEN"

# Or delete the cache key
wrangler kv:key delete "site:ses_falls_city:configured_points" --binding POINTS_KV
```

## Best Practices

1. **Use Separate Namespaces for Each Environment**
   - Production: Critical data, 24-hour retention
   - Staging: Testing data, can be cleared frequently
   - Development: Experimental data, lowest priority

2. **Monitor Cache Hit Rates**
   - Target: >80% hit rate for configured points
   - Target: >60% hit rate for timeseries (varies by query patterns)

3. **Set Appropriate TTLs**
   - Recent data (< 24h): 2-5 minutes
   - Historical data: 1-24 hours
   - Static metadata: 24 hours

4. **Implement Cache Warming**
   - Pre-populate cache for frequently accessed sites
   - Use Cloudflare Cron Triggers to refresh cache periodically

5. **Clean Up Old Keys**
   - KV automatically expires keys based on TTL
   - Manually delete test keys to avoid clutter
   - Monitor storage usage to stay within limits

## Example: Complete Setup

```bash
# 1. Create namespaces
wrangler kv:namespace create "POINTS_KV"
# Save id: abc123...

wrangler kv:namespace create "POINTS_KV" --preview
# Save preview_id: def456...

# 2. Update wrangler.toml
# (manually edit file with IDs)

# 3. Test locally
wrangler dev

# 4. Deploy
wrangler deploy

# 5. Verify health
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/health"

# 6. Test caching
curl "https://ace-iot-consolidated-proxy.your-subdomain.workers.dev/api/sites/ses_falls_city/configured_points" \
  -H "X-ACE-Token: YOUR_TOKEN"

# First request: X-Cache-Status: MISS
# Second request: X-Cache-Status: HIT

# 7. Monitor logs
wrangler tail ace-iot-consolidated-proxy --format pretty
```

## Resources

- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Wrangler KV Commands](https://developers.cloudflare.com/workers/wrangler/commands/#kv)
- [KV API Reference](https://developers.cloudflare.com/api/operations/workers-kv-namespace-list-namespaces)
