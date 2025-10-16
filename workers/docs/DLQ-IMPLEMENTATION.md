# Dead Letter Queue Implementation

## Overview

Complete DLQ handling implementation to prevent data loss from failed queue jobs.

## Components

### 1. DLQ Handler Service
**File:** `workers/services/dlq-handler.js`

**Features:**
- Error classification (RECOVERABLE, USER_ERROR, SYSTEM_ERROR, UNKNOWN)
- Automatic failure storage in R2 for debugging
- User notifications for failed jobs
- Ops team alerts for critical errors
- Recovery queue for transient failures
- Statistics and monitoring

**Key Methods:**
- `processBatch(messages)` - Process DLQ batch
- `handleFailedJob(message)` - Handle individual failure
- `classifyError(error)` - Classify error type
- `getStats()` - Get DLQ statistics
- `listRecentFailures(limit)` - List recent failures

### 2. Worker Integration
**File:** `workers/services/ai-enhanced-worker-example.js`

**Added:**
- `deadLetterQueue(batch, env)` - DLQ consumer handler
- `/api/queue/dlq/stats` - DLQ statistics endpoint
- `/api/queue/dlq/failures` - Recent failures endpoint

### 3. Wrangler Configuration
**File:** `workers/wrangler.toml`

**Queue Setup:**
```toml
# Main queue consumer
[[queues.consumers]]
queue = "chart-processing-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "chart-processing-dlq"

# DLQ consumer
[[queues.consumers]]
queue = "chart-processing-dlq"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 0  # No retries for DLQ
```

### 4. Database Schema
**File:** `workers/schema/d1-migrations.sql`

**Tables:**
- `dlq_recovery_queue` - Jobs pending manual recovery
- `user_notifications` - User notifications for failed jobs

### 5. Recovery Script
**File:** `workers/scripts/recover-dlq-jobs.sh`

**Features:**
- List failed jobs
- View DLQ statistics
- Get job details
- Re-queue jobs
- Abandon jobs
- Export failed jobs

## Error Classification

### RECOVERABLE Errors
- Timeouts
- Rate limits
- Temporary unavailability
- HTTP 503/504

**Action:** Added to recovery queue for manual intervention

### USER_ERROR Errors
- Invalid input
- Not found
- Unauthorized
- HTTP 400/401/403/404

**Action:** User notified via notifications table

### SYSTEM_ERROR Errors
- Internal errors
- Unexpected crashes
- HTTP 500/502

**Action:** Ops team alerted, critical error logged

### UNKNOWN Errors
- Unclassified errors

**Action:** Logged for investigation

## API Endpoints

### Get DLQ Statistics
```
GET /api/queue/dlq/stats
```

**Response:**
```json
{
  "dlq": {
    "total_failed": 42,
    "permanent_failures": 38,
    "last_24h": 5,
    "avg_retries": 2.8,
    "recovery": {
      "total_in_recovery": 12,
      "pending_recovery": 8,
      "recovered": 3,
      "abandoned": 1
    }
  },
  "timestamp": "2024-10-12T10:30:00Z"
}
```

### Get Recent Failures
```
GET /api/queue/dlq/failures?limit=20
```

**Response:**
```json
{
  "failures": [
    {
      "job_id": "job_123",
      "site_name": "building-a",
      "error_message": "Timeout fetching data",
      "retry_count": 3,
      "created_at": 1728734400,
      "completed_at": 1728736200
    }
  ],
  "count": 1,
  "timestamp": "2024-10-12T10:30:00Z"
}
```

## Usage

### 1. Deploy Configuration
```bash
# Deploy worker with DLQ configuration
wrangler deploy

# Create DLQ queue
wrangler queues create chart-processing-dlq
```

### 2. Apply Database Migration
```bash
# Apply migration v7 (DLQ tables)
wrangler d1 execute building-vitals-db --file=workers/schema/d1-migrations.sql
```

### 3. Monitor DLQ
```bash
# Check DLQ statistics
curl https://your-worker.workers.dev/api/queue/dlq/stats

# List recent failures
curl https://your-worker.workers.dev/api/queue/dlq/failures?limit=10
```

### 4. Recover Failed Jobs
```bash
# Run recovery script
./workers/scripts/recover-dlq-jobs.sh

# Or manually:
# 1. List failed jobs
# 2. Select job to recover
# 3. Re-queue or abandon
```

## Monitoring

### Key Metrics
- Total failed jobs
- Failures in last 24 hours
- Average retry count
- Recovery queue size
- Pending recoveries

### Alerts
- Critical system errors trigger ops alerts
- User errors create notifications
- Recoverable errors added to recovery queue

## Testing

### Simulate Job Failure
```javascript
// In queue-service.js processJob method, force an error:
throw new Error('Simulated failure for testing');

// Or simulate timeout:
await new Promise(resolve => setTimeout(resolve, 35000));
```

### Verify DLQ Processing
```bash
# Monitor worker logs
wrangler tail building-vitals-worker

# Check DLQ stats
curl https://your-worker.workers.dev/api/queue/dlq/stats
```

### Test Recovery
```bash
# Use recovery script to re-queue a failed job
./workers/scripts/recover-dlq-jobs.sh

# Select option 5 (Re-queue a job)
# Enter job ID
# Monitor worker logs for re-processing
```

## R2 Failure Storage

Failed jobs are stored in R2 for debugging:

**Path:** `dlq/failures/{jobId}.json`

**Structure:**
```json
{
  "jobId": "job_123",
  "timestamp": "2024-10-12T10:30:00Z",
  "message": { ... },
  "error": {
    "message": "Timeout fetching data",
    "stack": "..."
  },
  "retryCount": 3,
  "originalRequest": {
    "site": "building-a",
    "points": ["energy.total"],
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-12-31T23:59:59Z"
  }
}
```

## Best Practices

1. **Monitor DLQ regularly** - Check stats endpoint daily
2. **Review failure patterns** - Analyze error types
3. **Set up alerts** - Integrate with monitoring systems
4. **Clean old failures** - Archive or delete after resolution
5. **Test recovery process** - Verify re-queue functionality
6. **Document incidents** - Track root causes in R2 logs

## Troubleshooting

### DLQ Not Processing
- Verify queue consumer is deployed
- Check wrangler.toml configuration
- Ensure deadLetterQueue handler is exported

### Missing Failure Details
- Verify R2 bucket exists and is writable
- Check R2 binding in wrangler.toml
- Review worker logs for R2 errors

### Recovery Not Working
- Verify database tables exist
- Check recovery script permissions
- Ensure wrangler CLI is authenticated

## Future Enhancements

1. **Automatic Recovery** - Retry recoverable errors after delay
2. **Slack/PagerDuty Integration** - Real-time ops alerts
3. **Email Notifications** - User email for failed jobs
4. **Dashboard UI** - Visual DLQ monitoring
5. **Metrics Export** - Send to Grafana/Datadog
6. **Batch Recovery** - Recover multiple jobs at once
7. **Failure Analysis** - ML-based error pattern detection
