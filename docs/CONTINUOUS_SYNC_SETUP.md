# Continuous Sync - Automated ACE API → Supabase Integration

## Overview

The continuous sync system automatically fetches data from the ACE FlightDeck API every 5 minutes and stores it in Supabase. This eliminates the need for manual backfill scripts for ongoing data collection.

## Architecture

```
┌─────────────────┐     Every 5 min      ┌──────────────────────┐
│                 │ ────────────────────> │                      │
│    pg_cron      │                       │ Edge Function        │
│  (Scheduler)    │                       │ continuous-sync      │
│                 │                       │                      │
└─────────────────┘                       └──────────┬───────────┘
                                                     │
                                                     │ Fetch last 10 min
                                                     ↓
                                          ┌──────────────────────┐
                                          │   ACE FlightDeck     │
                                          │   /timeseries/       │
                                          │   paginated          │
                                          └──────────┬───────────┘
                                                     │
                                                     │ Write samples
                                                     ↓
                                          ┌──────────────────────┐
                                          │   Supabase           │
                                          │   - points table     │
                                          │   - timeseries table │
                                          └──────────────────────┘
```

## Components

### 1. Edge Function: `continuous-sync`
**Location:** `supabase/functions/continuous-sync/index.ts`

**What it does:**
- Fetches last 10 minutes of data from ACE API
- Uses pagination (page_size=10000)
- Auto-discovers and upserts new points
- Deduplicates by (point_id, ts)
- Two-tier insert strategy (INSERT → UPSERT fallback)

**Execution time:** ~10-30 seconds per run

### 2. pg_cron Schedule
**Location:** `supabase/migrations/20251031000000_schedule_continuous_sync.sql`

**What it does:**
- Triggers Edge Function every 5 minutes: `*/5 * * * *`
- Uses PostgreSQL's native cron extension
- Runs within Supabase infrastructure
- No external server required

### 3. Deployment Script
**Location:** `scripts/deploy-continuous-sync.bat`

**What it does:**
- Deploys Edge Function to Supabase
- Sets ACE_API_KEY secret
- Provides instructions for pg_cron setup

## Setup Instructions

### Prerequisites

1. **Supabase CLI installed:**
   ```cmd
   npm install -g supabase
   ```

2. **Linked to your project:**
   ```cmd
   npx supabase link --project-ref jywxcqcjsvlyehuvsoar
   ```

### Deployment Steps

#### Step 1: Deploy Edge Function

```cmd
scripts\deploy-continuous-sync.bat
```

This will:
- Deploy the `continuous-sync` function
- Set the `ACE_API_KEY` secret
- Show next steps

#### Step 2: Enable pg_cron and Set Schedule

1. Go to Supabase SQL Editor:
   https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/sql/new

2. Copy the entire contents of:
   `supabase/migrations/20251031000000_schedule_continuous_sync.sql`

3. **IMPORTANT:** Update this line with your actual service role key:
   ```sql
   ALTER DATABASE postgres SET app.settings.supabase_service_role_key TO 'eyJhbGci...';
   ```

4. Execute the SQL

5. Verify the schedule:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'continuous-sync-ace-data';
   ```

#### Step 3: Test Manually (Optional)

```bash
curl -X POST https://jywxcqcjsvlyehuvsoar.supabase.co/functions/v1/continuous-sync \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
```

Expected response:
```json
{
  "success": true,
  "samples": 15234,
  "inserted": 15234,
  "timeWindow": "2025-10-31T12:00:00Z -> 2025-10-31T12:10:00Z",
  "uniquePoints": 2174
}
```

## Monitoring

### Check Recent Runs

```sql
SELECT
  jobid,
  runid,
  job_name,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'continuous-sync-ace-data'
)
ORDER BY start_time DESC
LIMIT 10;
```

### View Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/logs/edge-functions
2. Filter by function: `continuous-sync`
3. View real-time execution logs

### Check Data Freshness

```sql
SELECT
  MAX(ts) as latest_sample,
  COUNT(*) as total_samples,
  COUNT(DISTINCT point_id) as unique_points
FROM timeseries
WHERE ts >= NOW() - INTERVAL '1 hour';
```

## Configuration

### Adjust Sync Frequency

Edit the cron schedule in the migration SQL:

```sql
'*/5 * * * *'   -- Every 5 minutes (current)
'*/10 * * * *'  -- Every 10 minutes
'*/1 * * * *'   -- Every 1 minute (aggressive)
```

### Adjust Time Window

Edit `SYNC_WINDOW_MINUTES` in `index.ts`:

```typescript
const SYNC_WINDOW_MINUTES = 10  // Current
const SYNC_WINDOW_MINUTES = 15  // Fetch last 15 minutes (safer overlap)
const SYNC_WINDOW_MINUTES = 5   // Fetch last 5 minutes (minimal overlap)
```

## Troubleshooting

### Function Not Running

1. Check pg_cron is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check job exists:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'continuous-sync-ace-data';
   ```

3. Check for errors:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE status = 'failed'
   ORDER BY start_time DESC
   LIMIT 5;
   ```

### ACE API Errors

If you see `ACE 400` errors:
- Check `ACE_API_KEY` is set correctly
- Verify key hasn't expired
- Check ACE API is accessible

Update secret:
```cmd
npx supabase secrets set ACE_API_KEY=new-key --project-ref jywxcqcjsvlyehuvsoar
```

### Supabase Timeout

If functions timeout (>150s):
- Reduce `SYNC_WINDOW_MINUTES` from 10 to 5
- Reduce `PAGE_SIZE` from 10000 to 5000
- Consider upgrading Supabase compute tier

## Cost Considerations

### Supabase Edge Functions
- **Free tier:** 500K invocations/month
- **Our usage:** ~8,640 invocations/month (every 5 min)
- **Well within free tier** ✅

### pg_cron
- **Included** in all Supabase plans ✅
- No additional cost

### Compute/IOPS
- Small incremental load every 5 minutes
- Much lower than continuous polling
- Current tier should handle this fine

## Benefits Over Manual Backfill

| Aspect | Manual Script | Continuous Sync |
|--------|---------------|-----------------|
| **Automation** | Manual execution | Fully automated |
| **Infrastructure** | Local machine | Supabase serverless |
| **Reliability** | Depends on machine uptime | 99.9% uptime |
| **Monitoring** | Console output | Supabase dashboard |
| **Cost** | Free (your machine) | Free (under limits) |
| **Maintenance** | Manual updates | Deploy once |

## Next Steps

1. **Deploy now** - Follow setup instructions above
2. **Monitor for 24 hours** - Check logs and data freshness
3. **Adjust frequency** - Fine-tune based on requirements
4. **Disable manual scripts** - Once verified working

---

**Date Created:** 2025-10-31
**Status:** Ready for deployment
**Estimated Setup Time:** 10 minutes
