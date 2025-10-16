#!/bin/bash

###############################################################################
# Building Vitals Infrastructure Setup Script
#
# This script sets up the Cloudflare infrastructure required for the
# Building Vitals application:
# - D1 database for metadata and recent timeseries
# - R2 bucket for historical timeseries storage
# - Runs database migrations
# - Verifies bindings and configuration
#
# Usage:
#   ./scripts/setup-infrastructure.sh [environment]
#
# Arguments:
#   environment - Optional. Defaults to "production". Can be "staging" or "production"
#
# Requirements:
#   - wrangler CLI installed and authenticated
#   - Node.js 18+ for running migrations
#   - Cloudflare account with D1 and R2 enabled
#
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV="${1:-production}"
PROJECT_NAME="building-vitals"
D1_DB_NAME="${PROJECT_NAME}-timeseries"
R2_BUCKET_NAME="${PROJECT_NAME}-storage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}Building Vitals Infrastructure Setup${NC}"
echo -e "${BLUE}Environment: ${ENV}${NC}"
echo -e "${BLUE}=================================${NC}\n"

###############################################################################
# Check Prerequisites
###############################################################################

echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI is not installed${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

# Verify wrangler is authenticated
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}Error: wrangler is not authenticated${NC}"
    echo "Run: wrangler login"
    exit 1
fi

echo -e "${GREEN}Prerequisites OK${NC}\n"

###############################################################################
# Create D1 Database
###############################################################################

echo -e "${YELLOW}[2/7] Creating D1 database...${NC}"

# Check if database already exists
if wrangler d1 list | grep -q "$D1_DB_NAME"; then
    echo -e "${GREEN}D1 database '$D1_DB_NAME' already exists${NC}"
    D1_DATABASE_ID=$(wrangler d1 list | grep "$D1_DB_NAME" | awk '{print $1}')
else
    echo "Creating D1 database: $D1_DB_NAME"
    CREATE_OUTPUT=$(wrangler d1 create "$D1_DB_NAME" 2>&1)
    D1_DATABASE_ID=$(echo "$CREATE_OUTPUT" | grep -oP 'database_id = "\K[^"]+')

    if [ -z "$D1_DATABASE_ID" ]; then
        echo -e "${RED}Failed to create D1 database${NC}"
        echo "$CREATE_OUTPUT"
        exit 1
    fi

    echo -e "${GREEN}Created D1 database: $D1_DATABASE_ID${NC}"
fi

echo ""

###############################################################################
# Create R2 Bucket
###############################################################################

echo -e "${YELLOW}[3/7] Creating R2 bucket...${NC}"

# Check if bucket already exists
if wrangler r2 bucket list | grep -q "$R2_BUCKET_NAME"; then
    echo -e "${GREEN}R2 bucket '$R2_BUCKET_NAME' already exists${NC}"
else
    echo "Creating R2 bucket: $R2_BUCKET_NAME"
    if wrangler r2 bucket create "$R2_BUCKET_NAME"; then
        echo -e "${GREEN}Created R2 bucket: $R2_BUCKET_NAME${NC}"
    else
        echo -e "${RED}Failed to create R2 bucket${NC}"
        exit 1
    fi
fi

echo ""

###############################################################################
# Update wrangler.toml with IDs
###############################################################################

echo -e "${YELLOW}[4/7] Updating wrangler.toml configuration...${NC}"

WRANGLER_TOML="$PROJECT_ROOT/wrangler.toml"

if [ ! -f "$WRANGLER_TOML" ]; then
    echo -e "${RED}Error: wrangler.toml not found at $WRANGLER_TOML${NC}"
    exit 1
fi

# Backup original
cp "$WRANGLER_TOML" "$WRANGLER_TOML.backup"

# Update D1 database_id
if grep -q "database_id.*=.*\"\"" "$WRANGLER_TOML"; then
    sed -i "s/database_id = \"\"/database_id = \"$D1_DATABASE_ID\"/" "$WRANGLER_TOML"
    echo -e "${GREEN}Updated D1 database_id in wrangler.toml${NC}"
else
    echo -e "${YELLOW}D1 database_id already set in wrangler.toml${NC}"
fi

# Update R2 bucket binding
if grep -q "bucket_name.*=.*\"\"" "$WRANGLER_TOML"; then
    sed -i "s/bucket_name = \"\"/bucket_name = \"$R2_BUCKET_NAME\"/" "$WRANGLER_TOML"
    echo -e "${GREEN}Updated R2 bucket_name in wrangler.toml${NC}"
else
    echo -e "${YELLOW}R2 bucket_name already set in wrangler.toml${NC}"
fi

echo ""

###############################################################################
# Run Database Migrations
###############################################################################

echo -e "${YELLOW}[5/7] Running database migrations...${NC}"

MIGRATIONS_DIR="$PROJECT_ROOT/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${YELLOW}No migrations directory found, skipping...${NC}"
else
    # Get list of migration files
    MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

    if [ -z "$MIGRATION_FILES" ]; then
        echo -e "${YELLOW}No migration files found${NC}"
    else
        for migration in $MIGRATION_FILES; do
            echo "Applying migration: $(basename "$migration")"
            if wrangler d1 execute "$D1_DB_NAME" --file="$migration" --${ENV}; then
                echo -e "${GREEN}Applied: $(basename "$migration")${NC}"
            else
                echo -e "${RED}Failed to apply migration: $(basename "$migration")${NC}"
                exit 1
            fi
        done
        echo -e "${GREEN}All migrations applied successfully${NC}"
    fi
fi

echo ""

###############################################################################
# Verify Bindings
###############################################################################

echo -e "${YELLOW}[6/7] Verifying bindings...${NC}"

# Test D1 connection
echo "Testing D1 connection..."
if wrangler d1 execute "$D1_DB_NAME" --command="SELECT 1" --${ENV} &> /dev/null; then
    echo -e "${GREEN}D1 connection OK${NC}"
else
    echo -e "${RED}D1 connection failed${NC}"
    exit 1
fi

# Test R2 bucket access
echo "Testing R2 bucket access..."
if wrangler r2 bucket list | grep -q "$R2_BUCKET_NAME"; then
    echo -e "${GREEN}R2 bucket accessible${NC}"
else
    echo -e "${RED}R2 bucket not accessible${NC}"
    exit 1
fi

echo ""

###############################################################################
# Display Configuration Summary
###############################################################################

echo -e "${YELLOW}[7/7] Setup complete!${NC}\n"

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}Configuration Summary${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "Environment:       ${GREEN}${ENV}${NC}"
echo -e "D1 Database:       ${GREEN}${D1_DB_NAME}${NC}"
echo -e "D1 Database ID:    ${GREEN}${D1_DATABASE_ID}${NC}"
echo -e "R2 Bucket:         ${GREEN}${R2_BUCKET_NAME}${NC}"
echo -e "${BLUE}=================================${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy the worker:"
echo "   ${GREEN}wrangler deploy --env ${ENV}${NC}"
echo ""
echo "2. Run the historical backfill script:"
echo "   ${GREEN}node scripts/backfill-historical.js --env ${ENV}${NC}"
echo ""
echo "3. Test the API:"
echo "   ${GREEN}curl https://your-worker.workers.dev/health${NC}"
echo ""
echo -e "${GREEN}Infrastructure setup complete!${NC}"
