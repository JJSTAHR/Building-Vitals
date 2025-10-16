# DLQ Quick Reference Card

## Common Commands

### Check DLQ Status
```bash
# Get statistics
curl https://your-worker.workers.dev/api/queue/dlq/stats

# List recent failures
curl https://your-worker.workers.dev/api/queue/dlq/failures?limit=10
```

### Monitor DLQ
```bash
# Watch worker logs
wrangler tail building-vitals-worker --format=pretty

# Filter DLQ messages
wrangler tail building-vitals-worker | grep DLQ
```

### Recovery Operations
```bash
# Interactive recovery
./workers/scripts/recover-dlq-jobs.sh

# Manual re-queue
wrangler d1 execute building-vitals-db --command \
  "UPDATE queue_jobs SET status = 'queued', retry_count = 0 WHERE job_id = 'JOB_ID'"
```

### Database Queries
```bash
# List failed jobs
wrangler d1 execute building-vitals-db --command \
  "SELECT job_id, site_name, error_message, retry_count FROM queue_jobs WHERE status = 'failed' ORDER BY completed_at DESC LIMIT 20"

# Get recovery queue
wrangler d1 execute building-vitals-db --command \
  "SELECT job_id, status, datetime(created_at, 'unixepoch') FROM dlq_recovery_queue ORDER BY created_at DESC"

# Get user notifications
wrangler d1 execute building-vitals-db --command \
  "SELECT user_id, type, title, message FROM user_notifications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 20"
```

### R2 Operations
```bash
# List failure logs
wrangler r2 object list building-vitals-cache --prefix="dlq/failures/"

# Get failure details
wrangler r2 object get building-vitals-cache/dlq/failures/JOB_ID.json

# Download all failures
wrangler r2 object get building-vitals-cache/dlq/failures/ --recursive
```

## Error Classification

| Error Type | Examples | Action |
|------------|----------|--------|
| **RECOVERABLE** | Timeout, Rate limit, 503, 504 | Added to recovery queue |
| **USER_ERROR** | Invalid input, Not found, 400, 404 | User notified |
| **SYSTEM_ERROR** | Internal error, 500, 502 | Ops alerted |
| **UNKNOWN** | Unclassified errors | Logged for investigation |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/queue/dlq/stats` | GET | DLQ statistics |
| `/api/queue/dlq/failures` | GET | Recent failures list |
| `/api/queue/dlq/failures?limit=N` | GET | Limited failures list |

## Response Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 404 | Job not found |
| 500 | Server error |

## Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `total_failed` | Total permanent failures | Trending up |
| `last_24h` | Failures in last 24h | > 10 |
| `avg_retries` | Average retry count | > 2.5 |
| `pending_recovery` | Jobs awaiting recovery | > 5 |

## File Locations

```
workers/
├── services/
│   ├── dlq-handler.js          # DLQ service
│   └── ai-enhanced-worker-example.js  # Worker with DLQ consumer
├── schema/
│   └── d1-migrations.sql       # Migration v7 (DLQ tables)
├── scripts/
│   └── recover-dlq-jobs.sh     # Recovery tool
├── tests/
│   └── dlq-handler.test.js     # DLQ tests
├── docs/
│   ├── DLQ-IMPLEMENTATION.md   # Implementation guide
│   ├── DLQ-DEPLOYMENT-GUIDE.md # Deployment guide
│   └── DLQ-QUICK-REFERENCE.md  # This file
└── wrangler.toml               # Queue configuration
```

## Recovery Script Options

```
1. List failed jobs
2. View DLQ statistics
3. View recovery queue
4. Get job details
5. Re-queue a job
6. Abandon a job
7. Export all failed jobs
8. Exit
```

## Troubleshooting Quick Fixes

### Jobs not moving to DLQ
```bash
# Check max_retries setting
grep -A3 "queues.consumers" workers/wrangler.toml
# Should have: max_retries = 3
```

### DLQ consumer not running
```bash
# Verify handler exported
grep "deadLetterQueue" workers/services/ai-enhanced-worker-example.js
# Redeploy: wrangler deploy
```

### R2 storage failing
```bash
# Test R2 access
wrangler r2 object list building-vitals-cache
# Check binding in wrangler.toml
```

### Database errors
```bash
# Verify tables exist
wrangler d1 execute building-vitals-db --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%dlq%' OR name = 'user_notifications')"
# Apply migration if missing
```

## Daily Checklist

- [ ] Check DLQ stats for high failure rate
- [ ] Review recent failures
- [ ] Check recovery queue size
- [ ] Review critical errors in logs
- [ ] Process pending recoveries
- [ ] Export failures for analysis

## Weekly Checklist

- [ ] Analyze failure patterns
- [ ] Review R2 storage for old failures
- [ ] Update recovery procedures
- [ ] Train team on new failure types
- [ ] Clean up recovered/abandoned jobs
- [ ] Review and optimize error classification

## Emergency Contacts

- **Worker Issues**: Check Cloudflare Dashboard > Workers
- **Queue Issues**: Check Cloudflare Dashboard > Queues
- **Database Issues**: Check Cloudflare Dashboard > D1
- **R2 Issues**: Check Cloudflare Dashboard > R2

## Useful Aliases

Add to `.bashrc` or `.zshrc`:

```bash
# DLQ aliases
alias dlq-stats='curl -s https://your-worker.workers.dev/api/queue/dlq/stats | jq'
alias dlq-failures='curl -s https://your-worker.workers.dev/api/queue/dlq/failures | jq'
alias dlq-logs='wrangler tail building-vitals-worker | grep DLQ'
alias dlq-recover='./workers/scripts/recover-dlq-jobs.sh'
alias dlq-db='wrangler d1 execute building-vitals-db --command'
```

## Testing Commands

```bash
# Simulate timeout error
curl -X POST https://your-worker.workers.dev/api/timeseries \
  -d '{"site":"invalid","points":["test"],"start_time":"2024-01-01T00:00:00Z","end_time":"2024-12-31T23:59:59Z"}'

# Watch for DLQ processing
wrangler tail building-vitals-worker --format=pretty | grep -E "(DLQ|failed)"

# Verify R2 storage
wrangler r2 object list building-vitals-cache --prefix="dlq/failures/" | tail -1
```

## Best Practices

1. **Monitor daily**: Check stats every morning
2. **Process quickly**: Handle recoveries within 24 hours
3. **Document patterns**: Track common failure causes
4. **Update classification**: Improve error categorization
5. **Clean regularly**: Archive old failures monthly
6. **Test recovery**: Practice recovery procedures quarterly

## Version Info

- **Migration Version**: v7
- **DLQ Handler**: workers/services/dlq-handler.js
- **Worker Version**: Check `wrangler deployments list`
- **Last Updated**: 2024-10-12
