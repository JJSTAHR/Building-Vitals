#!/bin/bash
# Deploy Python Cloud Functions to Firebase
# Usage: ./scripts/deploy-python-functions.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT:-building-vitals-prod}"
REGION="us-central1"
RUNTIME="python311"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Python Cloud Functions${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Runtime: $RUNTIME"
echo ""

# Validate GCP project
echo -e "${YELLOW}Validating GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo -e "${GREEN}✓ Using project: $PROJECT_ID${NC}"
echo ""

# Check if secrets exist
echo -e "${YELLOW}Checking secrets...${NC}"
REQUIRED_SECRETS=("ACE_API_KEY" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")

for secret in "${REQUIRED_SECRETS[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
        echo -e "${GREEN}✓ Secret exists: $secret${NC}"
    else
        echo -e "${RED}✗ Missing secret: $secret${NC}"
        echo "Please create the secret first:"
        echo "  echo -n 'YOUR_VALUE' | gcloud secrets create $secret --data-file=-"
        exit 1
    fi
done

echo ""

# Grant Secret Manager access to service account
echo -e "${YELLOW}Configuring IAM permissions...${NC}"
for secret in "${REQUIRED_SECRETS[@]}"; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || true
    echo -e "${GREEN}✓ Granted access to: $secret${NC}"
done

echo ""

# Deploy continuous_sync function
echo -e "${YELLOW}Deploying continuous_sync function...${NC}"
gcloud functions deploy continuous-sync \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=./functions \
    --entry-point=continuous_sync \
    --trigger-http \
    --memory=512MB \
    --timeout=300s \
    --max-instances=10 \
    --min-instances=0 \
    --set-env-vars="GCP_PROJECT=$PROJECT_ID,DEFAULT_SITE=building-vitals-hq" \
    --allow-unauthenticated \
    --project="$PROJECT_ID"

CONTINUOUS_SYNC_URL=$(gcloud functions describe continuous-sync \
    --gen2 \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(serviceConfig.uri)")

echo -e "${GREEN}✓ continuous_sync deployed${NC}"
echo "   URL: $CONTINUOUS_SYNC_URL"
echo ""

# Deploy backfill_historical function
echo -e "${YELLOW}Deploying backfill_historical function...${NC}"
gcloud functions deploy backfill-historical \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=./functions \
    --entry-point=backfill_historical \
    --trigger-http \
    --memory=1GB \
    --timeout=540s \
    --max-instances=5 \
    --min-instances=0 \
    --set-env-vars="GCP_PROJECT=$PROJECT_ID,DEFAULT_SITE=building-vitals-hq" \
    --allow-unauthenticated \
    --project="$PROJECT_ID"

BACKFILL_URL=$(gcloud functions describe backfill-historical \
    --gen2 \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(serviceConfig.uri)")

echo -e "${GREEN}✓ backfill_historical deployed${NC}"
echo "   URL: $BACKFILL_URL"
echo ""

# Setup or update Cloud Scheduler
echo -e "${YELLOW}Configuring Cloud Scheduler...${NC}"

if gcloud scheduler jobs describe continuous-sync-job \
    --location="$REGION" \
    --project="$PROJECT_ID" &>/dev/null; then

    echo "Updating existing scheduler job..."
    gcloud scheduler jobs update http continuous-sync-job \
        --location="$REGION" \
        --schedule="*/5 * * * *" \
        --uri="$CONTINUOUS_SYNC_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{}' \
        --time-zone="UTC" \
        --attempt-deadline=300s \
        --project="$PROJECT_ID"

    echo -e "${GREEN}✓ Scheduler job updated${NC}"
else
    echo "Creating new scheduler job..."
    gcloud scheduler jobs create http continuous-sync-job \
        --location="$REGION" \
        --schedule="*/5 * * * *" \
        --uri="$CONTINUOUS_SYNC_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{}' \
        --time-zone="UTC" \
        --attempt-deadline=300s \
        --project="$PROJECT_ID"

    echo -e "${GREEN}✓ Scheduler job created${NC}"
fi

echo ""

# Test deployment
echo -e "${YELLOW}Testing deployment...${NC}"
echo "Testing continuous_sync..."

RESPONSE=$(curl -s -X POST "$CONTINUOUS_SYNC_URL" \
    -H "Content-Type: application/json" \
    -d '{}')

if echo "$RESPONSE" | grep -q '"success"'; then
    echo -e "${GREEN}✓ continuous_sync is responding${NC}"
else
    echo -e "${RED}✗ continuous_sync test failed${NC}"
    echo "Response: $RESPONSE"
fi

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Functions deployed:"
echo "  1. continuous-sync"
echo "     URL: $CONTINUOUS_SYNC_URL"
echo "     Schedule: Every 5 minutes"
echo ""
echo "  2. backfill-historical"
echo "     URL: $BACKFILL_URL"
echo "     Trigger: Manual HTTP POST"
echo ""
echo "Cloud Scheduler:"
echo "  Job: continuous-sync-job"
echo "  Schedule: */5 * * * * (every 5 minutes)"
echo ""
echo "Next steps:"
echo "  1. Test manual sync:"
echo "     curl -X POST $CONTINUOUS_SYNC_URL"
echo ""
echo "  2. Run backfill (example):"
echo "     curl -X POST $BACKFILL_URL \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"site\":\"building-vitals-hq\",\"start_date\":\"2024-12-01T00:00:00Z\",\"end_date\":\"2024-12-01T23:59:59Z\"}'"
echo ""
echo "  3. View logs:"
echo "     gcloud functions logs read continuous-sync --gen2 --region=$REGION --limit=50"
echo ""
echo "  4. Monitor in console:"
echo "     https://console.cloud.google.com/functions?project=$PROJECT_ID"
echo ""
