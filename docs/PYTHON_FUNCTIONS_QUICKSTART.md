# Python Cloud Functions - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies Locally (Optional - for testing)

```bash
cd functions
python3.11 -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Secrets

```bash
# Set your GCP project
export GCP_PROJECT="building-vitals-prod"

# Create secrets (one-time setup)
echo -n "YOUR_ACE_API_KEY" | gcloud secrets create ACE_API_KEY --data-file=-
echo -n "https://YOUR_PROJECT.supabase.co" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "YOUR_SUPABASE_KEY" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-

# Grant access to Cloud Functions
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in ACE_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Deploy Functions

```bash
cd functions

# Deploy continuous sync (runs every 5 minutes)
gcloud functions deploy continuous-sync \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=continuous_sync \
  --trigger-http \
  --memory=512MB \
  --timeout=300s \
  --set-env-vars=GCP_PROJECT=$GCP_PROJECT \
  --allow-unauthenticated

# Deploy backfill (manual HTTP trigger)
gcloud functions deploy backfill-historical \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=backfill_historical \
  --trigger-http \
  --memory=1GB \
  --timeout=540s \
  --set-env-vars=GCP_PROJECT=$GCP_PROJECT \
  --allow-unauthenticated
```

### 4. Setup Cloud Scheduler

```bash
# Get function URL
FUNCTION_URL=$(gcloud functions describe continuous-sync \
  --gen2 \
  --region=us-central1 \
  --format="value(serviceConfig.uri)")

# Create scheduler job (every 5 minutes)
gcloud scheduler jobs create http continuous-sync-job \
  --location=us-central1 \
  --schedule="*/5 * * * *" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="UTC"

# Test it
gcloud scheduler jobs run continuous-sync-job --location=us-central1
```

### 5. Test Backfill

```bash
# Get backfill function URL
BACKFILL_URL=$(gcloud functions describe backfill-historical \
  --gen2 \
  --region=us-central1 \
  --format="value(serviceConfig.uri)")

# Backfill last 24 hours
curl -X POST "$BACKFILL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "site": "building-vitals-hq",
    "start_date": "2024-12-10T00:00:00Z",
    "end_date": "2024-12-11T00:00:00Z",
    "max_pages": 100
  }'
```

### 6. Monitor

```bash
# View logs
gcloud functions logs read continuous-sync \
  --gen2 \
  --region=us-central1 \
  --limit=50

# Check Supabase for data
# Navigate to your Supabase dashboard → Table Editor → timeseries
```

## Architecture Diagram

```
┌─────────────────────┐
│  Cloud Scheduler    │
│  (Every 5 minutes)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌──────────────────┐
│ continuous_sync()   │─────▶│  ACE IoT API     │
│  Python Function    │      │  (FlightDeck)    │
└──────────┬──────────┘      └──────────────────┘
           │
           │ Transform & Validate
           │
           ▼
┌─────────────────────┐
│   Supabase          │
│   PostgreSQL        │
│   (timeseries table)│
└─────────────────────┘

Manual Trigger:
┌─────────────────────┐
│ HTTP POST Request   │
└──────────┬──────────┘
           ▼
┌─────────────────────┐      ┌──────────────────┐
│backfill_historical()│─────▶│  ACE IoT API     │
│  Python Function    │      │  (Date range)    │
└──────────┬──────────┘      └──────────────────┘
           │
           ▼
┌─────────────────────┐
│   Supabase          │
└─────────────────────┘
```

## Data Flow

1. **continuous_sync** (Scheduled):
   - Triggered every 5 minutes by Cloud Scheduler
   - Fetches last 10 minutes of data (with 5-minute overlap)
   - Processes ALL sites from Supabase `points` table
   - Transforms ACE API format → Supabase format
   - Upserts to `timeseries` table (on conflict do update)

2. **backfill_historical** (Manual):
   - HTTP POST with date range parameters
   - Fetches historical data for specified range
   - Same transformation and upsert logic
   - Returns sync statistics

## Key Features

✅ **Secrets Management**: All API keys stored in Google Secret Manager
✅ **Retry Logic**: Exponential backoff for API failures
✅ **Batch Processing**: Configurable page sizes and batch upserts
✅ **Multi-Site Support**: Auto-discovers sites from database
✅ **Deduplication**: Removes duplicate samples before insertion
✅ **Error Handling**: Comprehensive logging and error reporting
✅ **Production-Ready**: Timeout, memory, and instance limits configured

## Configuration

Environment variables (set during deployment):

```bash
GCP_PROJECT=building-vitals-prod       # Required
DEFAULT_SITE=building-vitals-hq        # Optional
PAGE_SIZE=5000                         # Optional (ACE API page size)
UPSERT_BATCH_SIZE=250                  # Optional (Supabase batch size)
SYNC_WINDOW_MINUTES=10                 # Optional (continuous sync window)
```

Secrets (Google Secret Manager):

```bash
ACE_API_KEY                  # ACE IoT API Bearer token
SUPABASE_URL                 # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY    # Supabase service role key
```

## Cost Estimates

**Monthly costs** (assuming 288 syncs/day):

| Resource | Usage | Cost |
|----------|-------|------|
| Function invocations | ~8,640/month | Free (within 2M free tier) |
| Compute (GB-seconds) | ~130,000/month | Free (within 400K free tier) |
| Networking (egress) | ~8.6GB/month | ~$0.43 (after 5GB free tier) |
| Cloud Scheduler | 1 job | $0.10/month |
| **Total** | | **~$0.53/month** |

## Troubleshooting

### Function not deploying?
```bash
# Check Python version
python3.11 --version

# Verify dependencies
pip install -r requirements.txt
python -c "import supabase; print('OK')"

# Check GCP permissions
gcloud auth list
gcloud projects list
```

### Secrets not accessible?
```bash
# Test secret access
gcloud secrets versions access latest --secret="ACE_API_KEY"

# Check IAM permissions
gcloud secrets get-iam-policy ACE_API_KEY
```

### Function timing out?
```bash
# Increase timeout (max 540s)
gcloud functions update continuous-sync \
  --timeout=540s

# Increase memory
gcloud functions update continuous-sync \
  --memory=1GB
```

### Not seeing data in Supabase?
```bash
# Check function logs
gcloud functions logs read continuous-sync --limit=50

# Test function manually
curl -X POST "$(gcloud functions describe continuous-sync --format='value(serviceConfig.uri)')"

# Verify Supabase connection
# Run a test query in Supabase SQL editor:
SELECT COUNT(*) FROM timeseries WHERE ts > NOW() - INTERVAL '1 hour';
```

## Next Steps

1. ✅ Deploy functions
2. ✅ Setup Cloud Scheduler
3. ✅ Test continuous sync
4. ✅ Run backfill for historical data
5. 📊 Monitor logs and metrics
6. 🔔 Setup alerting (optional)
7. 📈 Scale for additional sites (optional)

## Support & Documentation

- **Full deployment guide**: `docs/FIREBASE_PYTHON_DEPLOYMENT.md`
- **Architecture docs**: See existing docs for ACE API integration
- **Supabase schema**: `supabase/migrations/`
- **GCP Console**: https://console.cloud.google.com/functions
