# Firebase Cloud Functions - Python Deployment Guide

## Overview

This guide covers deploying Python-based Cloud Functions (2nd Gen) for Building Vitals IoT data ingestion.

## Functions

### 1. `continuous_sync`
- **Trigger**: Cloud Scheduler (every 5 minutes)
- **Purpose**: Fetches recent data (last 10 minutes) from ACE IoT API and upserts to Supabase
- **Runtime**: Python 3.11
- **Memory**: 512MB
- **Timeout**: 300s (5 minutes)

### 2. `backfill_historical`
- **Trigger**: HTTP (manual invocation)
- **Purpose**: Backfills historical data for specified date ranges
- **Runtime**: Python 3.11
- **Memory**: 1GB
- **Timeout**: 540s (9 minutes)

## Prerequisites

1. **Firebase CLI** (14.11.2+)
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Google Cloud Project** with billing enabled
   ```bash
   firebase projects:list
   firebase use <project-id>
   ```

3. **Environment Setup**
   ```bash
   # Set your GCP project
   export GCP_PROJECT="building-vitals-prod"

   # Enable required APIs
   gcloud services enable \
     cloudfunctions.googleapis.com \
     cloudbuild.googleapis.com \
     cloudscheduler.googleapis.com \
     secretmanager.googleapis.com
   ```

## Secrets Configuration

### Setup Secrets in Google Secret Manager

```bash
# ACE IoT API Key
echo -n "your-ace-api-key" | gcloud secrets create ACE_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

# Supabase URL
echo -n "https://your-project.supabase.co" | gcloud secrets create SUPABASE_URL \
  --data-file=- \
  --replication-policy="automatic"

# Supabase Service Role Key
echo -n "your-service-role-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to Cloud Functions service account
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding ACE_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SUPABASE_URL \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_ROLE_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### Verify Secrets

```bash
# List all secrets
gcloud secrets list

# Test secret access
gcloud secrets versions access latest --secret="ACE_API_KEY"
```

## Deployment

### Option 1: Deploy Both Functions

```bash
cd functions
gcloud functions deploy continuous-sync \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=continuous_sync \
  --trigger-http \
  --memory=512MB \
  --timeout=300s \
  --max-instances=10 \
  --set-env-vars=GCP_PROJECT=$GCP_PROJECT,DEFAULT_SITE=building-vitals-hq \
  --allow-unauthenticated

gcloud functions deploy backfill-historical \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=backfill_historical \
  --trigger-http \
  --memory=1GB \
  --timeout=540s \
  --max-instances=5 \
  --set-env-vars=GCP_PROJECT=$GCP_PROJECT,DEFAULT_SITE=building-vitals-hq \
  --allow-unauthenticated
```

### Option 2: Deploy via Firebase CLI

1. **Update `firebase.json`** (at project root):
```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "python311",
      "ignore": [
        "venv",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "__pycache__",
        "*.pyc"
      ]
    }
  ]
}
```

2. **Deploy**:
```bash
firebase deploy --only functions
```

## Cloud Scheduler Setup

### Create Scheduler Job for `continuous_sync`

```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http continuous-sync-job \
  --location=us-central1 \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-$GCP_PROJECT.cloudfunctions.net/continuous-sync" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="UTC" \
  --attempt-deadline=300s

# Test the scheduler job manually
gcloud scheduler jobs run continuous-sync-job --location=us-central1
```

### Update Existing Scheduler Job

```bash
# Update schedule to every 2 minutes (if needed)
gcloud scheduler jobs update http continuous-sync-job \
  --location=us-central1 \
  --schedule="*/2 * * * *"

# Pause scheduler
gcloud scheduler jobs pause continuous-sync-job --location=us-central1

# Resume scheduler
gcloud scheduler jobs resume continuous-sync-job --location=us-central1
```

## Testing

### Test `continuous_sync` Function

```bash
# Via gcloud
gcloud functions call continuous-sync \
  --gen2 \
  --region=us-central1 \
  --data='{}'

# Via HTTP (get function URL first)
FUNCTION_URL=$(gcloud functions describe continuous-sync \
  --gen2 \
  --region=us-central1 \
  --format="value(serviceConfig.uri)")

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test `backfill_historical` Function

```bash
# Backfill for specific date range
FUNCTION_URL=$(gcloud functions describe backfill-historical \
  --gen2 \
  --region=us-central1 \
  --format="value(serviceConfig.uri)")

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "site": "building-vitals-hq",
    "start_date": "2024-12-01T00:00:00Z",
    "end_date": "2024-12-01T23:59:59Z",
    "max_pages": 100
  }'
```

## Monitoring

### View Logs

```bash
# Real-time logs for continuous_sync
gcloud functions logs read continuous-sync \
  --gen2 \
  --region=us-central1 \
  --limit=50 \
  --format="table(time_utc, log)"

# Follow logs (tail -f style)
gcloud functions logs read continuous-sync \
  --gen2 \
  --region=us-central1 \
  --tail

# Filter by severity
gcloud functions logs read continuous-sync \
  --gen2 \
  --region=us-central1 \
  --limit=50 \
  --filter="severity>=ERROR"
```

### Cloud Monitoring Metrics

```bash
# Function invocation count
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_count"' \
  --format="table(metric.labels.function_name, metric.labels.status)"

# Function execution times
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_times"'
```

### Cloud Logging Queries

Navigate to **Cloud Console → Logging → Logs Explorer**:

```sql
-- All function logs
resource.type="cloud_function"
resource.labels.function_name="continuous-sync"

-- Errors only
resource.type="cloud_function"
resource.labels.function_name="continuous-sync"
severity>=ERROR

-- Specific time range
resource.type="cloud_function"
resource.labels.function_name="continuous-sync"
timestamp>="2024-01-01T00:00:00Z"
timestamp<="2024-01-31T23:59:59Z"
```

## Environment Variables

Set via deployment:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GCP_PROJECT` | GCP Project ID | - | Yes |
| `DEFAULT_SITE` | Default site name | `building-vitals-hq` | No |
| `PAGE_SIZE` | ACE API page size | `5000` | No |
| `UPSERT_BATCH_SIZE` | Supabase batch size | `250` | No |
| `SYNC_WINDOW_MINUTES` | Continuous sync window | `10` | No |

## Troubleshooting

### Common Issues

#### 1. "Permission denied" errors
```bash
# Ensure service account has Secret Manager access
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $GCP_PROJECT \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

#### 2. Function timeout errors
```bash
# Increase timeout (max 540s for 2nd gen)
gcloud functions update continuous-sync \
  --gen2 \
  --region=us-central1 \
  --timeout=540s
```

#### 3. Memory exceeded errors
```bash
# Increase memory allocation
gcloud functions update continuous-sync \
  --gen2 \
  --region=us-central1 \
  --memory=1GB
```

#### 4. Deployment fails with dependencies
```bash
# Test dependencies locally
cd functions
python3.11 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -c "import supabase; print('OK')"
```

## Cost Optimization

### Estimate Costs

```bash
# Function invocations
# continuous_sync: 12 invocations/hour × 24 hours = 288/day
# Free tier: 2M invocations/month
# Cost: $0.40 per million after free tier

# Compute time (GB-seconds)
# continuous_sync: 512MB × 30s avg × 288/day × 30 days = ~130,000 GB-s/month
# Free tier: 400,000 GB-seconds/month
# Cost: Free (within free tier)

# Networking (egress)
# Supabase ingestion: ~1MB per sync × 288/day × 30 days = ~8.6GB/month
# Free tier: 5GB/month
# Cost: $0.12/GB after free tier = ~$0.43/month
```

### Optimization Tips

1. **Reduce invocation frequency** if real-time data isn't critical:
   ```bash
   # Change from every 5 minutes to every 10 minutes
   gcloud scheduler jobs update http continuous-sync-job \
     --schedule="*/10 * * * *"
   ```

2. **Use regional deployment** (already us-central1):
   - Cheapest region for Cloud Functions
   - Co-locate with Supabase if possible

3. **Optimize batch sizes**:
   - Larger batches = fewer function calls
   - Balance with memory constraints

4. **Set max instances** to control costs:
   ```bash
   gcloud functions update continuous-sync \
     --max-instances=10
   ```

## Security Best Practices

1. ✅ **Secrets in Secret Manager** (not environment variables)
2. ✅ **Service account least privilege** (only Secret Manager access)
3. ✅ **HTTP functions with authentication** (add `--no-allow-unauthenticated` for production)
4. ✅ **VPC connector** (optional, for private Supabase instances)
5. ✅ **HTTPS only** (enforced by default in Cloud Functions)

## Production Checklist

- [ ] Secrets configured in Secret Manager
- [ ] Service account permissions verified
- [ ] Functions deployed with correct memory/timeout
- [ ] Cloud Scheduler job created and tested
- [ ] Monitoring alerts configured
- [ ] Logs verified in Cloud Logging
- [ ] Test backfill completed successfully
- [ ] Continuous sync running every 5 minutes
- [ ] Data appearing in Supabase
- [ ] Error handling tested (invalid API key, network issues)

## Next Steps

1. **Add monitoring alerts**:
   - Function error rate > 5%
   - Function execution time > 4 minutes
   - Supabase connection failures

2. **Implement data validation**:
   - Check for data gaps
   - Alert on missing sites
   - Validate data quality

3. **Add retry logic**:
   - Cloud Tasks for failed syncs
   - Dead letter queue for repeated failures

4. **Scale for multiple sites**:
   - Parallel processing per site
   - Regional deployments for global sites

## Support

- **Firebase Functions Docs**: https://firebase.google.com/docs/functions
- **Cloud Functions 2nd Gen**: https://cloud.google.com/functions/docs/2nd-gen/overview
- **Secret Manager**: https://cloud.google.com/secret-manager/docs
- **Supabase Python Client**: https://github.com/supabase-community/supabase-py
