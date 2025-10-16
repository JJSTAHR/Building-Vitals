#!/bin/bash

# Deploy and Test Backfill Script
# This script deploys the fixes and starts a fresh backfill

echo "==============================================="
echo "Building Vitals - Backfill Fix Deployment"
echo "==============================================="

# Step 1: Check current worker status
echo ""
echo "Step 1: Checking current worker status..."
wrangler whoami
if [ $? -ne 0 ]; then
    echo "Error: Please login to Cloudflare first using 'wrangler login'"
    exit 1
fi

# Step 2: Deploy the worker with fixes
echo ""
echo "Step 2: Deploying worker with fixes..."
wrangler deploy --env production

if [ $? -ne 0 ]; then
    echo "Error: Deployment failed"
    exit 1
fi

# Step 3: Clear existing backfill state
echo ""
echo "Step 3: Clearing existing backfill state..."
wrangler kv:key delete --binding=BACKFILL_KV "backfill_state" --env production

# Step 4: Verify R2 bucket exists
echo ""
echo "Step 4: Checking R2 bucket..."
wrangler r2 object list ace-timeseries --prefix=timeseries/ --env production | head -5

# Step 5: Start fresh backfill
echo ""
echo "Step 5: Starting fresh backfill..."
echo "Note: Replace YOUR_WORKER_URL with your actual worker URL"
echo ""

WORKER_URL="https://building-vitals-backfill.jstahr.workers.dev"
SITE_NAME="ses_falls_city"
START_DATE="2024-01-01"
END_DATE="2025-10-16"

echo "Starting backfill for:"
echo "  Site: $SITE_NAME"
echo "  Date Range: $START_DATE to $END_DATE"
echo ""

curl -X POST "$WORKER_URL/trigger" \
  -H "Content-Type: application/json" \
  -d "{
    \"site\": \"$SITE_NAME\",
    \"reset\": true
  }"

echo ""
echo ""
echo "Step 6: Check backfill status..."
sleep 5

curl "$WORKER_URL/status"

echo ""
echo ""
echo "==============================================="
echo "Deployment Complete!"
echo "==============================================="
echo ""
echo "Monitor progress with:"
echo "  curl $WORKER_URL/status"
echo ""
echo "View logs with:"
echo "  wrangler tail --env production"
echo ""
echo "Check R2 files with:"
echo "  wrangler r2 object list ace-timeseries --prefix=timeseries/"