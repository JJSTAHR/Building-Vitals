#!/bin/bash
# Monitor Real-Time Data Freshness and Point Coverage
# Usage: ./scripts/monitor-data-freshness.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-https://jywxcqcjsvlyehuvsoar.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY not set"
  exit 1
fi

echo "============================================================================"
echo "REAL-TIME DATA FRESHNESS MONITOR"
echo "============================================================================"
echo ""

# Get latest timestamp
echo "[1/3] Checking data freshness..."
RESPONSE=$(curl -sS "$SUPABASE_URL/rest/v1/timeseries?select=ts&order=ts.desc&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

LATEST=$(echo "$RESPONSE" | jq -r '.[0].ts')
echo "  Latest timestamp: $LATEST"

# Calculate age in seconds and minutes
NOW_SEC=$(date -u +%s)
LATEST_SEC=$(date -u -d "$LATEST" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$(echo $LATEST | cut -d'+' -f1 | tr 'T' ' ')" +%s)
AGE_SEC=$((NOW_SEC - LATEST_SEC))
AGE_MIN=$((AGE_SEC / 60))

echo "  Data age: $AGE_MIN minutes ($AGE_SEC seconds)"
echo ""

# Status check
if [ $AGE_MIN -le 5 ]; then
  echo "  ✅ EXCELLENT: Data is within 5-minute target"
elif [ $AGE_MIN -le 10 ]; then
  echo "  ⚠️  WARNING: Data is ${AGE_MIN}min old (target: <5min)"
else
  echo "  ❌ CRITICAL: Data is ${AGE_MIN}min old - sync may be failing"
fi
echo ""

# Check point coverage in last 15 minutes
echo "[2/3] Checking point coverage (last 15 minutes)..."
FIFTEEN_MIN_AGO=$(date -u -d "15 minutes ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-15M +"%Y-%m-%dT%H:%M:%SZ")

COVERAGE=$(curl -sS "$SUPABASE_URL/rest/v1/timeseries?select=point_id&ts=gte.$FIFTEEN_MIN_AGO&limit=50000" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | \
  jq '[.[].point_id] | unique | length')

echo "  Unique points with data (last 15min): $COVERAGE out of 7,327"
COVERAGE_PCT=$(echo "scale=1; $COVERAGE * 100 / 7327" | bc)
echo "  Coverage: ${COVERAGE_PCT}%"
echo ""

# Check continuous sync status
echo "[3/3] Checking continuous sync workflow status..."
if command -v gh &> /dev/null; then
  WORKFLOW_STATUS=$(gh run list --workflow=continuous-sync.yml --limit 1 --json status,conclusion,createdAt --jq '.[0] | "\(.status) - \(.conclusion // "running") - \(.createdAt)"')
  echo "  Last run: $WORKFLOW_STATUS"
else
  echo "  (gh CLI not installed - skipping workflow check)"
fi
echo ""

echo "============================================================================"
echo "RECOMMENDATIONS:"
echo "============================================================================"
if [ $AGE_MIN -gt 10 ]; then
  echo "  1. Check GitHub Actions: gh run list --workflow=continuous-sync.yml"
  echo "  2. View failed run logs: gh run view [run-id] --log"
  echo "  3. Manually trigger sync: gh workflow run continuous-sync.yml --ref main"
elif [ $AGE_MIN -gt 5 ]; then
  echo "  • Data is acceptable but monitor next sync cycle"
  echo "  • Should be <5min after next successful sync"
else
  echo "  • System is healthy and collecting real-time data"
  echo "  • Run this script periodically to monitor"
fi
echo ""
