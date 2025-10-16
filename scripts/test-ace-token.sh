#!/bin/bash
# ============================================================================
# ACE API Token Verification Script
# ============================================================================
# This script tests the ACE API token directly to verify it works
# before deploying to Cloudflare Workers.
#
# Usage:
#   1. Set your token: export ACE_API_TOKEN="your-token-here"
#   2. Run: bash scripts/test-ace-token.sh

if [ -z "$ACE_API_TOKEN" ]; then
  echo "Error: ACE_API_TOKEN environment variable not set"
  echo ""
  echo "Usage:"
  echo "  export ACE_API_TOKEN=\"your-token-here\""
  echo "  bash scripts/test-ace-token.sh"
  exit 1
fi

API_BASE="https://flightdeck.aceiot.cloud/api"
SITE="ses_falls_city"

echo "============================================================================"
echo "ACE IoT API Token Verification"
echo "============================================================================"
echo ""
echo "Testing token: ${ACE_API_TOKEN:0:20}..."
echo "API Base: $API_BASE"
echo "Site: $SITE"
echo ""

# Test 1: List sites
echo "✓ Test 1: Fetching sites list..."
SITES_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $ACE_API_TOKEN" \
  -H "Accept: application/json" \
  "${API_BASE}/sites")

HTTP_CODE=$(echo "$SITES_RESPONSE" | tail -n1)
BODY=$(echo "$SITES_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ SUCCESS: Sites endpoint accessible"
  echo "  Sites count: $(echo "$BODY" | jq '. | length')"
else
  echo "  ✗ FAILED: HTTP $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo ""

# Test 2: Fetch configured points
echo "✓ Test 2: Fetching configured points..."
POINTS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $ACE_API_TOKEN" \
  -H "Accept: application/json" \
  "${API_BASE}/sites/${SITE}/configured_points?per_page=100")

HTTP_CODE=$(echo "$POINTS_RESPONSE" | tail -n1)
BODY=$(echo "$POINTS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ SUCCESS: Configured points endpoint accessible"
  POINTS_COUNT=$(echo "$BODY" | jq '.items | length')
  TOTAL=$(echo "$BODY" | jq '.total')
  echo "  Points returned: $POINTS_COUNT"
  echo "  Total points: $TOTAL"
else
  echo "  ✗ FAILED: HTTP $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo ""

# Test 3: Fetch timeseries data (last 24 hours)
echo "✓ Test 3: Fetching timeseries data (last 24 hours)..."
START_TIME=$(date -u -d "24 hours ago" +"%Y-%m-%dT%H:%M:%SZ")
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TIMESERIES_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $ACE_API_TOKEN" \
  -H "Accept: application/json" \
  "${API_BASE}/sites/${SITE}/timeseries/paginated?start_time=${START_TIME}&end_time=${END_TIME}&page_size=1000&raw_data=true")

HTTP_CODE=$(echo "$TIMESERIES_RESPONSE" | tail -n1)
BODY=$(echo "$TIMESERIES_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ SUCCESS: Timeseries endpoint accessible"
  SAMPLES_COUNT=$(echo "$BODY" | jq '.point_samples | length')
  HAS_MORE=$(echo "$BODY" | jq '.has_more')
  echo "  Samples returned: $SAMPLES_COUNT"
  echo "  Has more pages: $HAS_MORE"

  if [ "$SAMPLES_COUNT" = "0" ]; then
    echo "  ⚠ WARNING: No samples returned for last 24 hours"
    echo "  This might indicate no data or filtering issue"
  fi
else
  echo "  ✗ FAILED: HTTP $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo ""

# Test 4: Historical data (December 10, 2024)
echo "✓ Test 4: Fetching historical data (2024-12-10)..."
HIST_START="2024-12-10T00:00:00Z"
HIST_END="2024-12-10T23:59:59Z"

HISTORICAL_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $ACE_API_TOKEN" \
  -H "Accept: application/json" \
  "${API_BASE}/sites/${SITE}/timeseries/paginated?start_time=${HIST_START}&end_time=${HIST_END}&page_size=100000&raw_data=true")

HTTP_CODE=$(echo "$HISTORICAL_RESPONSE" | tail -n1)
BODY=$(echo "$HISTORICAL_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ SUCCESS: Historical timeseries accessible"
  SAMPLES_COUNT=$(echo "$BODY" | jq '.point_samples | length')
  HAS_MORE=$(echo "$BODY" | jq '.has_more')
  echo "  Samples returned: $SAMPLES_COUNT"
  echo "  Has more pages: $HAS_MORE"

  if [ "$SAMPLES_COUNT" = "0" ]; then
    echo "  ⚠ WARNING: No samples for 2024-12-10"
    echo "  This date might have no data in ACE IoT"
  else
    echo "  ✓ Historical data available for backfill"
  fi
else
  echo "  ✗ FAILED: HTTP $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo ""

# Summary
echo "============================================================================"
echo "Token Verification Complete"
echo "============================================================================"
echo ""
echo "Summary:"
echo "  ✓ Token is valid and working"
echo "  ✓ Sites endpoint: OK"
echo "  ✓ Configured points: OK"
echo "  ✓ Timeseries (recent): OK"
echo "  ✓ Timeseries (historical): OK"
echo ""
echo "Next Steps:"
echo "  1. Deploy token to worker:"
echo "     wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production"
echo ""
echo "  2. When prompted, paste this token:"
echo "     $ACE_API_TOKEN"
echo ""
echo "  3. Redeploy worker:"
echo "     wrangler deploy --config workers/wrangler-backfill.toml --env production"
echo ""
echo "  4. Test backfill:"
echo "     curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger"
echo ""
