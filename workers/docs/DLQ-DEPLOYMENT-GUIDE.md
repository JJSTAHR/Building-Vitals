# DLQ Deployment Guide

## Prerequisites

1. Cloudflare account with Workers enabled
2. Wrangler CLI installed: `npm install -g wrangler`
3. Authenticated: `wrangler login`
4. D1 database created
5. R2 bucket created

## Deployment Steps

### 1. Update Configuration

Edit `workers/wrangler.toml` with your values:

```toml
[[d1_databases]]
binding = "DB"
database_name = "building-vitals-db"
database_id = "YOUR_DATABASE_ID"  # Replace with your D1 database ID

[[r2_buckets]]
binding = "TIMESERIES_CACHE"
bucket_name = "building-vitals-cache"  # Replace with your R2 bucket name
```

### 2. Create Dead Letter Queue

```bash
# Create the DLQ queue
wrangler queues create chart-processing-dlq

# Verify queue creation
wrangler queues list
```

Expected output:
```
chart-processing-queue
chart-processing-dlq
```

### 3. Apply Database Migration

```bash
# Apply DLQ tables (migration v7)
wrangler d1 execute building-vitals-db \
  --file=workers/schema/d1-migrations.sql

# Verify tables created
wrangler d1 execute building-vitals-db \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables:
- `dlq_recovery_queue`
- `user_notifications`
- `queue_jobs`
- (other existing tables)

### 4. Deploy Worker

```bash
# Deploy worker with DLQ handler
cd workers
wrangler deploy

# Verify deployment
wrangler tail building-vitals-worker --format=pretty
```

### 5. Verify DLQ Configuration

```bash
# Check worker bindings
wrangler deployments list

# Test DLQ stats endpoint
curl https://your-worker.workers.dev/api/queue/dlq/stats
```

Expected response:
```json
{
  "dlq": {
    "total_failed": 0,
    "permanent_failures": 0,
    "last_24h": 0,
    "avg_retries": 0,
    "recovery": {
      "total_in_recovery": 0,
      "pending_recovery": 0,
      "recovered": 0,
      "abandoned": 0
    }
  },
  "timestamp": "2024-10-12T10:30:00Z"
}
```

### 6. Make Recovery Script Executable

```bash
chmod +x workers/scripts/recover-dlq-jobs.sh
```

## Testing DLQ

### Simulate Job Failure

1. Create a test job that will fail:

```bash
# Send a test request that will timeout
curl -X POST https://your-worker.workers.dev/api/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "site": "invalid-site",
    "points": ["nonexistent.point"],
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-12-31T23:59:59Z",
    "user_id": "test_user"
  }'
```

2. Monitor processing:

```bash
# Watch worker logs
wrangler tail building-vitals-worker --format=pretty
```

3. Check for DLQ processing (after max retries):

```bash
# Look for DLQ messages in logs:
# [DLQ] Processing 1 failed jobs
# [DLQ] Job job_xxx failed permanently
```

### Verify DLQ Handling

```bash
# Check DLQ stats
curl https://your-worker.workers.dev/api/queue/dlq/stats

# List recent failures
curl https://your-worker.workers.dev/api/queue/dlq/failures?limit=5

# Check R2 for failure details
wrangler r2 object get building-vitals-cache/dlq/failures/job_xxx.json
```

## Monitoring

### Set Up Continuous Monitoring

1. **Dashboard Widget** (create in Cloudflare Dashboard):
```
Workers Analytics > Add Widget > Custom Query
Metric: dlq_batch_processed
```

2. **Log Alerts**:
```bash
# Set up log tail for critical errors
wrangler tail building-vitals-worker --format=json | grep "CRITICAL"
```

3. **Scheduled Stats Check**:
```bash
# Add to crontab for daily checks
0 9 * * * curl -s https://your-worker.workers.dev/api/queue/dlq/stats | \
  jq '.dlq.last_24h' | \
  xargs -I {} sh -c 'if [ {} -gt 10 ]; then echo "High DLQ rate: {} failures"; fi'
```

### Key Metrics to Monitor

- **last_24h**: Failures in last 24 hours (alert if > 10)
- **avg_retries**: Average retry count (alert if > 2.5)
- **pending_recovery**: Jobs waiting for manual intervention
- **total_failed**: Total permanent failures (trending)

## Recovery Workflow

### Using the Recovery Script

```bash
# Run interactive recovery tool
./workers/scripts/recover-dlq-jobs.sh

# Follow prompts:
# 1. View DLQ stats
# 2. List failed jobs
# 3. Select job to recover
# 4. Re-queue or abandon
```

### Manual Recovery via CLI

```bash
# 1. List failed jobs
wrangler d1 execute building-vitals-db --command \
  "SELECT job_id, site_name, error_message FROM queue_jobs WHERE status = 'failed' LIMIT 10"

# 2. Get job details
JOB_ID="job_xxx"
wrangler d1 execute building-vitals-db --command \
  "SELECT * FROM queue_jobs WHERE job_id = '$JOB_ID'"

# 3. Re-queue job
wrangler d1 execute building-vitals-db --command \
  "UPDATE queue_jobs SET status = 'queued', retry_count = 0, error_message = NULL WHERE job_id = '$JOB_ID'"

# 4. Send to queue (requires custom script or API call)
```

## Troubleshooting

### DLQ Consumer Not Running

**Problem**: Failed jobs not being processed

**Check**:
```bash
# Verify queue consumer configuration
wrangler queues consumer list chart-processing-dlq

# Check worker logs for DLQ messages
wrangler tail building-vitals-worker | grep DLQ
```

**Solution**:
- Ensure `deadLetterQueue` handler is exported in worker
- Verify queue consumer in `wrangler.toml`
- Redeploy worker: `wrangler deploy`

### Jobs Not Moving to DLQ

**Problem**: Jobs retry forever

**Check**:
```bash
# Verify max_retries configuration
grep -A5 "queues.consumers" workers/wrangler.toml

# Check job retry count
wrangler d1 execute building-vitals-db --command \
  "SELECT job_id, status, retry_count FROM queue_jobs WHERE status != 'completed' ORDER BY retry_count DESC LIMIT 10"
```

**Solution**:
- Ensure `max_retries = 3` in queue consumer config
- Ensure `dead_letter_queue = "chart-processing-dlq"` is set
- Redeploy configuration: `wrangler deploy`

### R2 Storage Failing

**Problem**: Failure details not stored in R2

**Check**:
```bash
# Test R2 access
wrangler r2 object list building-vitals-cache --prefix="dlq/failures/"

# Check worker logs for R2 errors
wrangler tail building-vitals-worker | grep "R2 error"
```

**Solution**:
- Verify R2 bucket exists and is accessible
- Check R2 binding in `wrangler.toml`
- Ensure worker has R2 write permissions

### Database Errors

**Problem**: DLQ tables not found

**Check**:
```bash
# Verify tables exist
wrangler d1 execute building-vitals-db --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%dlq%' OR name = 'user_notifications'"

# Check schema version
wrangler d1 execute building-vitals-db --command \
  "SELECT * FROM schema_version ORDER BY version DESC LIMIT 5"
```

**Solution**:
- Apply migration: `wrangler d1 execute building-vitals-db --file=workers/schema/d1-migrations.sql`
- Verify migration v7 is applied

## Rollback Procedure

If you need to rollback DLQ implementation:

```bash
# 1. Remove DLQ consumer from wrangler.toml
# Delete the [[queues.consumers]] block for chart-processing-dlq

# 2. Redeploy worker
wrangler deploy

# 3. Delete DLQ tables (optional)
wrangler d1 execute building-vitals-db --command \
  "DROP TABLE IF EXISTS user_notifications; DROP TABLE IF EXISTS dlq_recovery_queue;"

# 4. Remove DLQ queue (optional)
wrangler queues delete chart-processing-dlq
```

## Production Checklist

- [ ] DLQ queue created
- [ ] Database migration v7 applied
- [ ] Worker deployed with DLQ handler
- [ ] DLQ stats endpoint accessible
- [ ] R2 storage working
- [ ] Recovery script tested
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Team trained on recovery process
- [ ] Documentation updated

## Next Steps

1. Set up automated alerts for high DLQ rates
2. Integrate with PagerDuty/Slack for critical errors
3. Create dashboard for DLQ monitoring
4. Schedule weekly DLQ reviews
5. Document common failure patterns
6. Implement automatic recovery for known issues

## Support

For issues or questions:
- Check worker logs: `wrangler tail building-vitals-worker`
- Review DLQ stats: `curl https://your-worker.workers.dev/api/queue/dlq/stats`
- Check Cloudflare dashboard: Queues > chart-processing-dlq
- Consult documentation: `workers/docs/DLQ-IMPLEMENTATION.md`
