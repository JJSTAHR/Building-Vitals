#!/bin/bash
# ============================================================================
# Configuration Validation Script
# ============================================================================
# Validates that all workers use the unified configuration
# Run before deploying any worker to ensure consistency
#
# Usage: ./scripts/validate-configuration.sh
# ============================================================================

set -e

echo "======================================================================"
echo "Building Vitals - Configuration Validation"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected values from unified config
EXPECTED_DB_ID="1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
EXPECTED_BUCKET="ace-timeseries"
EXPECTED_KV_ID="fa5e24f3f2ed4e3489a299e28f1bffaa"

# Incorrect values to detect
INCORRECT_DB_ID="b3901317-c387-4631-8654-750535cc18de"
INCORRECT_BUCKET="building-vitals-timeseries"
INCORRECT_KV_ID="3a8ae7ad1bd346fd9646f3f30a88676e"

ERRORS=0
WARNINGS=0

echo "Checking for CORRECT resource IDs..."
echo "----------------------------------------------------------------------"

# Check database ID in all worker configs
echo "1. Validating Database ID..."
DB_COUNT=$(grep -r "$EXPECTED_DB_ID" workers/*.toml wrangler-archival.toml 2>/dev/null | wc -l)
if [ "$DB_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✓${NC} All 4 workers use correct database ID: $EXPECTED_DB_ID ($DB_COUNT references)"
else
    echo -e "${RED}✗${NC} Expected at least 4 workers with correct DB ID, found: $DB_COUNT"
    ERRORS=$((ERRORS + 1))
fi

# Check bucket name in all worker configs
echo "2. Validating R2 Bucket Name..."
BUCKET_COUNT=$(grep -r "bucket_name = \"$EXPECTED_BUCKET\"" workers/*.toml wrangler-archival.toml 2>/dev/null | wc -l)
if [ "$BUCKET_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✓${NC} All 4 workers use correct bucket: $EXPECTED_BUCKET ($BUCKET_COUNT references)"
else
    echo -e "${RED}✗${NC} Expected at least 4 workers with correct bucket, found: $BUCKET_COUNT"
    ERRORS=$((ERRORS + 1))
fi

# Check KV namespace ID
echo "3. Validating KV Namespace ID..."
KV_COUNT=$(grep -r "$EXPECTED_KV_ID" workers/*.toml wrangler-archival.toml 2>/dev/null | wc -l)
if [ "$KV_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✓${NC} All workers use correct KV namespace: $EXPECTED_KV_ID"
else
    echo -e "${RED}✗${NC} Expected at least 4 references to KV ID, found: $KV_COUNT"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Checking for INCORRECT resource IDs..."
echo "----------------------------------------------------------------------"

# Check for incorrect database ID
echo "4. Checking for incorrect database ID..."
INCORRECT_DB_COUNT=$(grep -r "$INCORRECT_DB_ID" workers/*.toml wrangler-archival.toml 2>/dev/null | wc -l)
if [ "$INCORRECT_DB_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No incorrect database ID found in worker configs"
else
    echo -e "${RED}✗${NC} Found $INCORRECT_DB_COUNT references to incorrect DB ID: $INCORRECT_DB_ID"
    grep -r "$INCORRECT_DB_ID" workers/*.toml wrangler-archival.toml
    ERRORS=$((ERRORS + 1))
fi

# Check for incorrect bucket name
echo "5. Checking for incorrect bucket name..."
INCORRECT_BUCKET_COUNT=$(grep -r "$INCORRECT_BUCKET" workers/*.toml wrangler-archival.toml 2>/dev/null | wc -l)
if [ "$INCORRECT_BUCKET_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No incorrect bucket name found in worker configs"
else
    echo -e "${RED}✗${NC} Found $INCORRECT_BUCKET_COUNT references to incorrect bucket: $INCORRECT_BUCKET"
    grep -r "$INCORRECT_BUCKET" workers/*.toml wrangler-archival.toml
    ERRORS=$((ERRORS + 1))
fi

# Check for incorrect KV ID
echo "6. Checking for incorrect KV namespace ID..."
INCORRECT_KV_COUNT=$(grep -r "$INCORRECT_KV_ID" workers/*.toml wrangler-archival.toml src/wrangler-consolidated.toml 2>/dev/null | wc -l)
if [ "$INCORRECT_KV_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No incorrect KV namespace ID found in configs"
else
    echo -e "${RED}✗${NC} Found $INCORRECT_KV_COUNT references to incorrect KV ID: $INCORRECT_KV_ID"
    grep -r "$INCORRECT_KV_ID" workers/*.toml wrangler-archival.toml src/wrangler-consolidated.toml
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Checking configuration files..."
echo "----------------------------------------------------------------------"

# Check that all worker configs exist
WORKER_CONFIGS=(
    "workers/wrangler-query.toml"
    "workers/wrangler-etl.toml"
    "workers/wrangler-backfill.toml"
    "wrangler-archival.toml"
)

echo "7. Verifying worker configuration files exist..."
for config in "${WORKER_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo -e "${GREEN}✓${NC} Found: $config"
    else
        echo -e "${RED}✗${NC} Missing: $config"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check that unified config exists
echo "8. Verifying unified configuration file..."
if [ -f "config/cloudflare-unified-config.toml" ]; then
    echo -e "${GREEN}✓${NC} Found: config/cloudflare-unified-config.toml"
else
    echo -e "${RED}✗${NC} Missing: config/cloudflare-unified-config.toml"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Checking documentation..."
echo "----------------------------------------------------------------------"

# Check documentation
echo "9. Checking for outdated bucket references in documentation..."
DOC_INCORRECT_BUCKET=$(grep -r "$INCORRECT_BUCKET" docs/*.md 2>/dev/null | wc -l)
if [ "$DOC_INCORRECT_BUCKET" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $DOC_INCORRECT_BUCKET references to old bucket name in docs/"
    echo "    This is acceptable if documented as historical/incorrect"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} No references to old bucket name in documentation"
fi

echo "10. Checking for outdated database ID in documentation..."
DOC_INCORRECT_DB=$(grep -r "$INCORRECT_DB_ID" docs/*.md 2>/dev/null | wc -l)
if [ "$DOC_INCORRECT_DB" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $DOC_INCORRECT_DB references to old database ID in docs/"
    echo "    This is acceptable if documented as historical/incorrect"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} No references to old database ID in documentation"
fi

echo ""
echo "======================================================================"
echo "Validation Summary"
echo "======================================================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All validation checks passed!${NC}"
    echo ""
    echo "Configuration is consistent across all workers:"
    echo "  - Database ID: $EXPECTED_DB_ID"
    echo "  - Bucket Name: $EXPECTED_BUCKET"
    echo "  - KV Namespace: $EXPECTED_KV_ID"
    echo ""
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warnings (documentation only)${NC}"
    fi
    echo ""
    echo "✅ Safe to deploy workers"
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS configuration errors${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warnings${NC}"
    fi
    echo ""
    echo "❌ DO NOT deploy until errors are fixed"
    echo ""
    echo "See config/cloudflare-unified-config.toml for correct values"
    exit 1
fi
