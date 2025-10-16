# ETL Sync Worker - Quick Reference Guide

## 🚀 Quick Start

```bash
# 1. Create infrastructure
wrangler d1 create building-vitals-db
wrangler kv:namespace create ETL_STATE

# 2. Update wrangler-etl.toml with IDs

# 3. Deploy schema
wrangler d1 execute building-vitals-db --file=./workers/schema/d1-schema.sql

# 4. Set secrets
wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml

# 5. Deploy
cd workers && npm run etl:deploy
```

## 📋 Common Commands

### Development

```bash
# Run locally
npm run etl:dev

# Test locally
curl http://localhost:8787/health
curl http://localhost:8787/status
curl -X POST http://localhost:8787/trigger
```

### Deployment

```bash
# Deploy to staging
npm run etl:deploy:staging

# Deploy to production
npm run etl:deploy

# View logs
npm run etl:logs
```

### Database Operations

```bash
# Execute schema
npm run etl:d1:migrate

# Query database
wrangler d1 execute building-vitals-db \
  --command="SELECT COUNT(*) FROM timeseries_agg"

# Recent data
wrangler d1 execute building-vitals-db \
  --command="SELECT * FROM timeseries_agg ORDER BY timestamp DESC LIMIT 10"
```

### KV Operations

```bash
# Get last sync timestamp
wrangler kv:key get "etl:last_sync_timestamp" --binding=ETL_STATE

# List errors
wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:"

# Get specific error
wrangler kv:key get "etl:errors:sync_123_abc" --binding=ETL_STATE

# Delete key
wrangler kv:key delete "etl:errors:old_sync" --binding=ETL_STATE
```

### Monitoring

```bash
# Health check
curl https://etl.building-vitals.workers.dev/health

# Status
curl https://etl.building-vitals.workers.dev/status | jq

# Stats
curl https://etl.building-vitals.workers.dev/stats | jq

# Tail logs
wrangler tail -c workers/wrangler-etl.toml --env production

# Filter errors
wrangler tail -c workers/wrangler-etl.toml | grep ERROR
```

## 🔧 Configuration Snippets

### Change Sync Frequency

Edit `workers/wrangler-etl.toml`:

```toml
# Every 5 minutes (default)
[triggers]
crons = ["*/5 * * * *"]

# Every 10 minutes
[triggers]
crons = ["*/10 * * * *"]

# Every hour
[triggers]
crons = ["0 * * * *"]

# Every day at 2 AM
[triggers]
crons = ["0 2 * * *"]
```

### Update Site Name

```toml
[vars]
SITE_NAME = "building-b"  # Change this
```

### Adjust Batch Size

Edit `src/etl-sync-worker.js`:

```javascript
const CONFIG = {
  BATCH_SIZE: 500,  // Reduce for slower networks
  // or
  BATCH_SIZE: 1000, // Max for D1 (recommended)
};
```

### Increase Lookback Buffer

```javascript
const CONFIG = {
  LOOKBACK_BUFFER_MINUTES: 15, // Catch more late data
};
```

## 🐛 Troubleshooting

### Worker Not Running

```bash
# Check deployment
wrangler deployments list -c workers/wrangler-etl.toml

# Check cron triggers
wrangler triggers -c workers/wrangler-etl.toml
```

### No Data in Database

```bash
# Check last sync
curl https://etl.building-vitals.workers.dev/status | jq .lastSync

# Manually trigger
curl -X POST https://etl.building-vitals.workers.dev/trigger

# Check errors
wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:"
```

### Database Connection Error

```bash
# Test connection
curl https://etl.building-vitals.workers.dev/health

# Verify binding in wrangler-etl.toml
# Check database_id matches your D1 database
```

### Missing API Key

```bash
# Set API key
wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml

# Verify (won't show value, just confirms it exists)
wrangler secret list -c workers/wrangler-etl.toml
```

## 📊 Useful Queries

### Recent Sync History

```sql
-- Get last 10 syncs from KV metrics
-- (Use wrangler kv:key list then get each key)
```

### Data Coverage

```sql
SELECT
  site_name,
  point_name,
  COUNT(*) as sample_count,
  MIN(timestamp) as earliest,
  MAX(timestamp) as latest,
  datetime(MIN(timestamp), 'unixepoch') as earliest_date,
  datetime(MAX(timestamp), 'unixepoch') as latest_date
FROM timeseries_agg
GROUP BY site_name, point_name
ORDER BY site_name, point_name;
```

### Data Quality

```sql
SELECT
  site_name,
  point_name,
  date,
  quality_score,
  missing_samples,
  actual_samples,
  expected_samples
FROM data_quality
WHERE quality_score < 0.9
ORDER BY date DESC, quality_score ASC
LIMIT 20;
```

### Recent Data

```sql
SELECT
  site_name,
  point_name,
  datetime(timestamp, 'unixepoch') as time,
  avg_value,
  sample_count
FROM timeseries_agg
WHERE timestamp >= strftime('%s', 'now', '-1 hour')
ORDER BY timestamp DESC
LIMIT 50;
```

## 🔒 Security Checklist

- [ ] ACE_API_KEY stored as secret (not in code)
- [ ] Database IDs not committed to git
- [ ] KV namespace IDs not committed to git
- [ ] Different credentials for dev/staging/prod
- [ ] Logs don't expose sensitive data
- [ ] API key rotated every 90 days

## 📈 Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Sync Duration | < 20s | > 25s |
| Error Rate | < 1% | > 5% |
| Data Quality | > 95% | < 80% |
| API Calls | < 100/sync | > 200/sync |
| Records/Sync | 10-30k | > 50k |

## 🆘 Emergency Procedures

### Stop Sync Immediately

```bash
# Disable cron trigger (requires wrangler config change)
# Comment out [triggers] section in wrangler-etl.toml
# Then re-deploy
wrangler deploy -c workers/wrangler-etl.toml
```

### Reset Sync State

```bash
# ⚠️ WARNING: This causes full re-sync
wrangler kv:key delete "etl:last_sync_timestamp" --binding=ETL_STATE
```

### Rollback Deployment

```bash
# List recent deployments
wrangler deployments list -c workers/wrangler-etl.toml

# Rollback to previous
wrangler rollback <deployment-id> -c workers/wrangler-etl.toml
```

### Clear All Errors

```bash
# List all error keys
wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:" > errors.json

# Delete each (or use bulk delete script)
for key in $(jq -r '.[].name' errors.json); do
  wrangler kv:key delete "$key" --binding=ETL_STATE
done
```

## 📚 Related Documentation

- [ETL_DEPLOYMENT_GUIDE.md](./ETL_DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [ETL_IMPLEMENTATION.md](./ETL_IMPLEMENTATION.md) - Technical implementation details
- [D1 Schema](../workers/schema/d1-schema.sql) - Database schema
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## 🎯 Quick Wins

### Improve Sync Performance

```javascript
// In src/etl-sync-worker.js
const CONFIG = {
  MAX_RECORDS_PER_SYNC: 20000,    // Increase limit
  LOOKBACK_BUFFER_MINUTES: 5,     // Reduce buffer
  API_RETRY_DELAY_MS: 1000        // Faster retries
};
```

### Reduce API Calls

```javascript
// Fetch multiple points at once (if API supports)
const points = ['point1', 'point2', 'point3'];
const data = await fetchMultiplePoints(env, siteName, points, timeRange);
```

### Enable Debug Logging

```javascript
// Add to worker
console.log('[DEBUG]', JSON.stringify(result, null, 2));

// Or increase log sampling in wrangler-etl.toml
[observability]
head_sampling_rate = 1.0
```

## 💡 Pro Tips

1. **Use staging first** - Always test in staging before production
2. **Monitor for 24h** - Watch logs for first day after deployment
3. **Set up alerts** - Use external monitoring for critical failures
4. **Document changes** - Update CHANGELOG.md for all deployments
5. **Backup regularly** - Export D1 data periodically to R2
6. **Test manually** - Use `/trigger` endpoint to test without waiting
7. **Check quality** - Review data_quality table daily
8. **Optimize queries** - Use EXPLAIN QUERY PLAN in D1
9. **Archive old data** - Move data > 90 days to R2
10. **Rotate secrets** - Update API keys quarterly

## 📞 Support Contacts

- **Cloudflare Support**: support.cloudflare.com
- **ACE IoT Support**: support@ace-iot.com
- **Internal Team**: #building-vitals channel

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**Maintainer:** Building Vitals Team
