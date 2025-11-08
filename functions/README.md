# Building Vitals Firebase Cloud Functions

Production-ready Cloud Functions for automated data synchronization from ACE IoT to Supabase.

## Functions Overview

### 1. `syncRecentData` (Every 5 minutes)
- Syncs last 15 minutes of data for all active sites
- Processes all configured points
- Updates `last_sync_at` timestamp
- Logs execution metrics

### 2. `discoverNewSites` (Daily at 2 AM CST)
- Auto-discovers new sites from points table
- Creates site records automatically
- Generates 12-month backfill jobs
- Prioritizes recent months

### 3. `processBackfillQueue` (Every 30 minutes)
- Processes backfill jobs in priority order
- Fetches historical data in weekly chunks
- Tracks progress percentage
- Handles failures with retry logic

### 4. `cleanupOldData` (Daily at 1 AM CST)
- Maintains 1-year rolling retention
- Calls Supabase RPC for efficient deletion
- Logs cleanup metrics

### 5. `healthCheck` (HTTP Endpoint)
- Real-time sync status
- Stale site detection (>10 min)
- Backfill queue status
- Recent execution logs

## Setup

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Configure Environment Variables

Set secrets using Firebase CLI:

```bash
firebase functions:secrets:set SUPABASE_URL
firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
firebase functions:secrets:set ACE_API_TOKEN
```

Or use `.env` for local development:
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Deploy Functions

Deploy all functions:
```bash
firebase deploy --only functions
```

Deploy specific function:
```bash
firebase deploy --only functions:syncRecentData
```

### 4. Test Locally

Run emulators:
```bash
npm run serve
```

Test health check:
```bash
curl http://localhost:5001/YOUR_PROJECT/us-central1/healthCheck
```

## Monitoring

### View Logs
```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only syncRecentData

# Last 10 entries
firebase functions:log --limit 10

# Real-time streaming
firebase functions:log --stream
```

### Health Check Endpoint
```
GET https://us-central1-YOUR_PROJECT.cloudfunctions.net/healthCheck
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00Z",
  "sites": {
    "total": 5,
    "healthy": 5,
    "stale": 0,
    "details": [...]
  },
  "backfill": {
    "pending": 3,
    "in_progress": 1
  },
  "recent_executions": [...],
  "stale_sites": []
}
```

## Configuration

### Memory & Timeout Settings

| Function | Memory | Timeout | Schedule |
|----------|--------|---------|----------|
| syncRecentData | 2GB | 540s | */5 * * * * |
| discoverNewSites | 1GB | 300s | 0 2 * * * |
| processBackfillQueue | 2GB | 540s | */30 * * * * |
| cleanupOldData | 1GB | 540s | 0 1 * * * |
| healthCheck | 256MB | 60s | HTTP |

### Rate Limiting
- ACE API batch size: 50 points
- Upsert chunk size: 1000 records
- Inter-batch delay: 100-200ms

### Retry Logic
- Max retries: 3
- Backoff: Exponential (1s, 2s, 4s)

## Error Handling

All functions include:
- Try-catch blocks for error isolation
- Execution logging to `sync_execution_log`
- Detailed error messages
- Automatic retry on transient failures

## Database Requirements

Required Supabase tables:
- `sites` - Site registry
- `points` - Point configuration
- `timeseries_raw` - Time-series data
- `backfill_jobs` - Backfill queue
- `sync_execution_log` - Execution metrics

Required RPC function:
- `cleanup_old_timeseries(retention_days)` - Data cleanup

Required view:
- `sync_health` - Real-time health status

## Cost Optimization

- Functions run in us-central1 (lowest cost)
- Batch processing reduces function invocations
- Efficient upserts prevent duplicates
- Automatic cleanup maintains storage limits

## Troubleshooting

### Function timeout
- Reduce batch sizes in code
- Increase timeout limit (max 540s)
- Split large jobs into smaller chunks

### ACE API errors
- Check API token validity
- Verify rate limit compliance
- Review error logs for details

### Supabase connection issues
- Verify service role key
- Check database connection limits
- Review Supabase logs

### Missing data
- Check `sync_execution_log` for errors
- Verify point `is_configured = true`
- Review ACE API response data

## Maintenance

### Update Function Code
1. Edit `index.js`
2. Test locally with emulators
3. Deploy: `firebase deploy --only functions`

### Change Schedule
Edit cron expressions in `index.js`:
- Format: `minute hour day month dayOfWeek`
- Example: `*/15 * * * *` = every 15 minutes

### Scale Resources
Adjust `runWith()` settings:
```javascript
.runWith({
  timeoutSeconds: 540,  // 1-540
  memory: '2GB'         // 256MB, 512MB, 1GB, 2GB, 4GB, 8GB
})
```

## Security

- All secrets stored in Firebase Secret Manager
- Service account has minimum required permissions
- CORS enabled for healthCheck endpoint
- No hardcoded credentials

## Support

For issues or questions:
1. Check Firebase logs
2. Review Supabase logs
3. Verify environment variables
4. Test with local emulators
