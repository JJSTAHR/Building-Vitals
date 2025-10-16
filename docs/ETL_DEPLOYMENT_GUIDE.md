# ETL Sync Worker - Deployment Guide

## Overview

The Building Vitals ETL Sync Worker is a Cloudflare Worker that synchronizes timeseries data from the ACE IoT API to a D1 database every 5 minutes. It's designed to handle 6.48M samples per day without timeouts.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   ACE IoT API   │ ───> │  ETL Sync Worker │ ───> │  D1 Database    │
│  (Source Data)  │      │  (Cloudflare)    │      │  (Timeseries)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  v
                         ┌──────────────────┐
                         │  KV Namespace    │
                         │  (State/Errors)  │
                         └──────────────────┘
```

## Features

- **Incremental Sync**: Tracks last sync timestamp in KV to avoid reprocessing
- **Batch Processing**: Processes 1000 records per batch for optimal performance
- **Error Handling**: Retry logic with exponential backoff
- **Idempotent**: Safe for worker restarts (INSERT OR REPLACE)
- **Monitoring**: Health checks, status endpoints, and comprehensive logging
- **Data Quality**: Tracks quality metrics for each sync

## Prerequisites

1. **Cloudflare Account** with Workers Paid plan
   - Required for Cron Triggers
   - Required for longer CPU time (30s)

2. **Wrangler CLI** installed
   ```bash
   npm install -g wrangler
   ```

3. **ACE IoT API Key**
   - Contact ACE IoT to obtain API credentials

## Setup Instructions

### 1. Create D1 Database

```bash
# Create production database
wrangler d1 create building-vitals-db

# Save the database_id from output
# Update workers/wrangler-etl.toml with the ID

# Execute schema
wrangler d1 execute building-vitals-db --file=./workers/schema/d1-schema.sql
```

**Expected Output:**
```
✅ Successfully created DB 'building-vitals-db'
Database ID: abcd1234-5678-90ef-ghij-klmnopqrstuv
```

### 2. Create KV Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create ETL_STATE

# Save the ID from output
# Update workers/wrangler-etl.toml with the ID

# Create preview namespace for development
wrangler kv:namespace create ETL_STATE --preview
```

**Expected Output:**
```
🌀 Creating namespace with title "building-vitals-workers-ETL_STATE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "ETL_STATE", id = "1234567890abcdef1234567890abcdef" }
```

### 3. Update Configuration

Edit `workers/wrangler-etl.toml`:

```toml
[[d1_databases]]
binding = "BUILDING_VITALS_DB"
database_name = "building-vitals-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # Replace this

[[kv_namespaces]]
binding = "ETL_STATE"
id = "YOUR_ACTUAL_KV_ID"  # Replace this
```

### 4. Set Secrets

```bash
# Set ACE API key
wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml --env production

# When prompted, paste your ACE API key
```

### 5. Deploy Worker

```bash
# Deploy to production
cd workers
npm run etl:deploy

# Or deploy to staging first
npm run etl:deploy:staging
```

**Expected Output:**
```
Total Upload: 45.67 KiB / gzip: 12.34 KiB
Uploaded building-vitals-etl-sync (3.21 sec)
Published building-vitals-etl-sync (0.45 sec)
  https://etl.building-vitals.workers.dev
Current Deployment ID: abcd1234-5678-90ef
```

## Configuration

### Environment Variables

Set in `wrangler-etl.toml`:

| Variable | Description | Default |
|----------|-------------|---------|
| `SITE_NAME` | ACE IoT site identifier | `building-a` |
| `ENVIRONMENT` | Deployment environment | `production` |

### Secrets

Set via `wrangler secret put`:

| Secret | Description | Required |
|--------|-------------|----------|
| `ACE_API_KEY` | ACE IoT API authentication token | Yes |

### Cron Schedule

Default: Every 5 minutes (`*/5 * * * *`)

To change, edit `wrangler-etl.toml`:

```toml
[triggers]
crons = ["*/10 * * * *"]  # Every 10 minutes
```

## Monitoring

### Health Check

```bash
curl https://etl.building-vitals.workers.dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

### Status Check

```bash
curl https://etl.building-vitals.workers.dev/status
```

**Response:**
```json
{
  "status": "running",
  "lastSync": "2025-10-13T10:25:00.000Z",
  "siteName": "building-a",
  "database": {
    "timeseries_count": 1500000,
    "charts_count": 42,
    "metadata_count": 150,
    "schema_version": 7
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

### Database Statistics

```bash
curl https://etl.building-vitals.workers.dev/stats
```

**Response:**
```json
{
  "timeseries_count": 1500000,
  "charts_count": 42,
  "metadata_count": 150,
  "schema_version": 7
}
```

### Manual Trigger

```bash
curl -X POST https://etl.building-vitals.workers.dev/trigger
```

**Response:**
```json
{
  "status": "triggered",
  "syncId": "sync_1697123456789_abc123def",
  "message": "Sync started in background"
}
```

### View Logs

```bash
# Tail real-time logs
npm run etl:logs

# Or with wrangler directly
wrangler tail -c workers/wrangler-etl.toml --env production

# Filter for errors
wrangler tail -c workers/wrangler-etl.toml --env production | grep ERROR
```

## Performance Tuning

### Batch Size

Default: 1000 records per batch (D1 limit)

To adjust, edit `src/etl-sync-worker.js`:

```javascript
const CONFIG = {
  BATCH_SIZE: 1000, // Keep at 1000 for optimal D1 performance
  // ...
};
```

### Lookback Buffer

Default: 10 minutes

Increase to catch more late-arriving data:

```javascript
const CONFIG = {
  LOOKBACK_BUFFER_MINUTES: 15, // Increase to 15 minutes
  // ...
};
```

### Max Records Per Sync

Default: 10,000 records

Safety limit to prevent timeouts:

```javascript
const CONFIG = {
  MAX_RECORDS_PER_SYNC: 10000,
  // ...
};
```

## Troubleshooting

### Worker Timeouts

**Symptom:** Sync fails with CPU time exceeded

**Solution:**
1. Reduce `MAX_RECORDS_PER_SYNC` in config
2. Increase cron frequency (sync more often with less data)
3. Check D1 database performance

### Missing Data

**Symptom:** Gaps in timeseries data

**Solution:**
1. Check `LOOKBACK_BUFFER_MINUTES` setting
2. Verify ACE API is returning all data
3. Check error logs in KV:
   ```bash
   wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:"
   ```

### API Rate Limiting

**Symptom:** ACE API returns 429 errors

**Solution:**
1. Increase `API_RETRY_DELAY_MS`
2. Reduce sync frequency
3. Contact ACE IoT for rate limit increase

### Database Errors

**Symptom:** D1 insert failures

**Solution:**
1. Check D1 database health: `/health` endpoint
2. Verify database schema is up to date
3. Check D1 storage limits (10 GB free tier)

## KV State Keys

The worker uses KV to track state:

| Key Pattern | Description | TTL |
|-------------|-------------|-----|
| `etl:last_sync_timestamp` | Last successful sync timestamp | None |
| `etl:errors:{syncId}` | Error logs for failed syncs | 30 days |
| `etl:metrics:{syncId}` | Performance metrics | 7 days |
| `etl:state:{syncId}` | Complete sync state snapshot | 7 days |

### Inspecting KV State

```bash
# Get last sync timestamp
wrangler kv:key get "etl:last_sync_timestamp" --binding=ETL_STATE

# List all error logs
wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:"

# Get specific error
wrangler kv:key get "etl:errors:sync_123456789_abc" --binding=ETL_STATE
```

## Development Workflow

### Local Development

```bash
# Run worker locally
npm run etl:dev

# Test in another terminal
curl http://localhost:8787/health
curl http://localhost:8787/status
curl -X POST http://localhost:8787/trigger
```

### Deploy to Staging

```bash
# Deploy to staging environment
npm run etl:deploy:staging

# Test staging
curl https://etl-staging.building-vitals.workers.dev/health
```

### Deploy to Production

```bash
# Deploy to production
npm run etl:deploy

# Verify deployment
curl https://etl.building-vitals.workers.dev/health
```

## Maintenance

### Update Schema

```bash
# Execute new migrations
wrangler d1 execute building-vitals-db --file=./workers/schema/d1-migrations.sql

# Verify version
curl https://etl.building-vitals.workers.dev/stats | jq .schema_version
```

### Clear Error Logs

```bash
# List old error logs
wrangler kv:key list --binding=ETL_STATE --prefix="etl:errors:"

# Delete specific error
wrangler kv:key delete "etl:errors:old_sync_id" --binding=ETL_STATE
```

### Reset Sync State

**⚠️ WARNING: This will cause full re-sync from ACE API**

```bash
# Delete last sync timestamp
wrangler kv:key delete "etl:last_sync_timestamp" --binding=ETL_STATE

# Worker will start syncing from default lookback period
```

## Cost Estimation

### Cloudflare Workers Paid Plan

- **Base Cost:** $5/month
- **Included:** 10M requests
- **Additional:** $0.50 per million requests

### Estimated Monthly Costs

For 5-minute sync interval:

- Cron triggers: 8,640/month (12/hour × 24 × 30)
- Cost: Well within free tier

For 1-minute sync interval:

- Cron triggers: 43,200/month
- Cost: Still within free tier

### D1 Database

- **Storage:** Free up to 10 GB
- **Reads:** 25M rows/day included
- **Writes:** 50M rows/day included

### KV Namespace

- **Storage:** Free up to 1 GB
- **Reads:** 10M/month included
- **Writes:** 1M/month included

**Total Estimated Cost:** $5-10/month (mostly Workers Paid plan)

## Security Best Practices

1. **Never commit secrets** to version control
   - Use `wrangler secret put` for sensitive data
   - Add `.env` to `.gitignore`

2. **Rotate API keys regularly**
   - Update ACE_API_KEY every 90 days
   - Use `wrangler secret put` to update

3. **Monitor access logs**
   - Review worker logs daily
   - Set up alerts for errors

4. **Use environment-specific configs**
   - Separate dev/staging/prod databases
   - Different API keys per environment

## Support

### Documentation

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [KV Storage Docs](https://developers.cloudflare.com/kv/)

### Troubleshooting

1. Check worker logs: `npm run etl:logs`
2. Verify health: `curl https://etl.building-vitals.workers.dev/health`
3. Review KV errors: Check `etl:errors:*` keys
4. Contact Cloudflare support for platform issues

## Next Steps

1. ✅ Deploy ETL worker to production
2. ✅ Monitor sync for 24 hours
3. ⏭️ Set up alerting for failures
4. ⏭️ Configure backup/archival to R2
5. ⏭️ Implement data quality dashboards
