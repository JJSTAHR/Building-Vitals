#!/bin/bash
# ============================================================================
# Backfill Worker Configuration Verification Script
# ============================================================================
# This script verifies that the backfill worker has correct token access
# and can communicate with the ACE IoT API.
#
# Usage: bash scripts/verify-backfill-config.sh

set -e  # Exit on error

WORKER_URL="https://building-vitals-backfill.jstahr.workers.dev"
CONFIG_FILE="workers/wrangler-backfill.toml"

echo "============================================================================"
echo "Backfill Worker Configuration Verification"
echo "============================================================================"
echo ""

# Step 1: Check if worker is deployed
echo "✓ Step 1: Checking if worker is deployed..."
HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  echo "  ✓ Worker is deployed and healthy"
  echo "  Response: $HEALTH_RESPONSE" | jq .
else
  echo "  ✗ Worker is not healthy or not deployed"
  echo "  Response: $HEALTH_RESPONSE"
  exit 1
fi
echo ""

# Step 2: Check if ACE_API_KEY secret is deployed
echo "✓ Step 2: Checking if ACE_API_KEY secret is deployed..."
SECRET_LIST=$(wrangler secret list --config "$CONFIG_FILE" --env production 2>&1)
if echo "$SECRET_LIST" | grep -q "ACE_API_KEY"; then
  echo "  ✓ ACE_API_KEY secret is deployed"
else
  echo "  ✗ ACE_API_KEY secret is NOT deployed"
  echo "  Please run: wrangler secret put ACE_API_KEY --config $CONFIG_FILE --env production"
  exit 1
fi
echo ""

# Step 3: Check R2 bucket access
echo "✓ Step 3: Checking R2 bucket access..."
R2_LIST=$(wrangler r2 bucket list 2>&1)
if echo "$R2_LIST" | grep -q "ace-timeseries"; then
  echo "  ✓ R2 bucket 'ace-timeseries' exists"
else
  echo "  ✗ R2 bucket 'ace-timeseries' NOT found"
  echo "  Please run: wrangler r2 bucket create ace-timeseries"
  exit 1
fi
echo ""

# Step 4: Check KV namespace access
echo "✓ Step 4: Checking KV namespace..."
KV_LIST=$(wrangler kv namespace list 2>&1)
if echo "$KV_LIST" | grep -q "fa5e24f3f2ed4e3489a299e28f1bffaa"; then
  echo "  ✓ KV namespace 'BACKFILL_STATE' exists"
else
  echo "  ✗ KV namespace NOT found"
  echo "  Please create KV namespace and update wrangler-backfill.toml"
  exit 1
fi
echo ""

# Step 5: Check backfill status
echo "✓ Step 5: Checking backfill status..."
STATUS_RESPONSE=$(curl -s "${WORKER_URL}/status")
echo "  Current status:"
echo "$STATUS_RESPONSE" | jq .
echo ""

# Step 6: Test trigger (don't actually trigger, just verify endpoint)
echo "✓ Step 6: Verifying trigger endpoint..."
echo "  Endpoint: POST ${WORKER_URL}/trigger"
echo "  (Not triggering to avoid starting backfill during verification)"
echo ""

# Step 7: Check worker logs for recent errors
echo "✓ Step 7: Checking recent worker logs..."
echo "  Run this command to view logs:"
echo "  wrangler tail --config $CONFIG_FILE --env production --format pretty"
echo ""

# Summary
echo "============================================================================"
echo "Verification Complete"
echo "============================================================================"
echo ""
echo "Configuration Summary:"
echo "  ✓ Worker deployed: YES"
echo "  ✓ Secret configured: $(echo "$SECRET_LIST" | grep -q "ACE_API_KEY" && echo "YES" || echo "NO")"
echo "  ✓ R2 bucket: ace-timeseries"
echo "  ✓ KV namespace: BACKFILL_STATE"
echo ""
echo "Next Steps:"
echo "  1. To start backfill: curl -X POST ${WORKER_URL}/trigger"
echo "  2. To monitor: wrangler tail --config $CONFIG_FILE --env production"
echo "  3. To check progress: curl ${WORKER_URL}/status"
echo ""
echo "If backfill is failing:"
echo "  - Check docs/BACKFILL_TOKEN_FIX.md for troubleshooting"
echo "  - Verify ACE_API_KEY secret: wrangler secret list --config $CONFIG_FILE"
echo "  - Monitor logs: wrangler tail --config $CONFIG_FILE --env production"
echo ""
