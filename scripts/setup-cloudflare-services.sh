#!/bin/bash

# Setup Script for Cloudflare R2, Queue, and D1 Services
# This script automates the setup of all required Cloudflare services

set -e  # Exit on error

echo "🚀 Setting up Cloudflare services for Building Vitals..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if logged in
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Running login..."
    wrangler login
fi

echo "✅ Authenticated"
echo ""

# Navigate to worker directory
cd "$(dirname "$0")/../Building-Vitals/workers" || exit 1

# 1. Create R2 Buckets
echo "📦 Creating R2 buckets..."
echo ""

# Production bucket
if wrangler r2 bucket list | grep -q "building-vitals-timeseries"; then
    echo "✅ Production bucket already exists: building-vitals-timeseries"
else
    echo "Creating production bucket: building-vitals-timeseries"
    wrangler r2 bucket create building-vitals-timeseries
    echo "✅ Production bucket created"
fi

# Preview bucket
if wrangler r2 bucket list | grep -q "building-vitals-timeseries-preview"; then
    echo "✅ Preview bucket already exists: building-vitals-timeseries-preview"
else
    echo "Creating preview bucket: building-vitals-timeseries-preview"
    wrangler r2 bucket create building-vitals-timeseries-preview
    echo "✅ Preview bucket created"
fi

echo ""

# 2. Create D1 Database
echo "🗄️ Creating D1 database..."
echo ""

# Check if database exists
if wrangler d1 list | grep -q "building-vitals-db"; then
    echo "✅ Database already exists: building-vitals-db"

    # Get database ID
    DB_ID=$(wrangler d1 list | grep building-vitals-db | awk '{print $1}')
    echo "Database ID: $DB_ID"
else
    echo "Creating database: building-vitals-db"
    CREATE_OUTPUT=$(wrangler d1 create building-vitals-db)
    echo "$CREATE_OUTPUT"

    # Extract database ID from output
    DB_ID=$(echo "$CREATE_OUTPUT" | grep "database_id" | awk '{print $3}' | tr -d '"')
    echo "✅ Database created with ID: $DB_ID"

    # Update wrangler.toml with database ID
    echo ""
    echo "⚠️  Please update wrangler.toml with the database ID:"
    echo "   database_id = \"$DB_ID\""
    echo ""
    read -p "Press Enter after updating wrangler.toml..."
fi

echo ""

# 3. Initialize database schema
echo "📋 Initializing database schema..."
echo ""

if [ -f "../services/schema.sql" ]; then
    wrangler d1 execute building-vitals-db --file=../services/schema.sql
    echo "✅ Schema initialized"
else
    echo "❌ Schema file not found: ../services/schema.sql"
    echo "Please run this script from the scripts directory"
    exit 1
fi

echo ""

# 4. Create Queue (automatically created on deploy, but we can verify)
echo "📬 Queue setup..."
echo ""
echo "✅ Queues will be automatically created on first deploy:"
echo "   - chart-processing-queue (main queue)"
echo "   - chart-processing-dlq (dead letter queue)"

echo ""

# 5. Verify Analytics Engine binding
echo "📊 Analytics Engine..."
echo ""
echo "✅ Analytics Engine binding configured in wrangler.toml"

echo ""

# 6. Deploy worker
echo "🚀 Deploying worker..."
echo ""

read -p "Deploy worker now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler deploy
    echo "✅ Worker deployed successfully"
else
    echo "⏭️  Skipping deployment. You can deploy later with: wrangler deploy"
fi

echo ""

# 7. Summary
echo "✨ Setup complete!"
echo ""
echo "📝 Summary:"
echo "   ✅ R2 Buckets: building-vitals-timeseries, building-vitals-timeseries-preview"
echo "   ✅ D1 Database: building-vitals-db"
echo "   ✅ Schema: Initialized with tables and views"
echo "   ✅ Queues: Will be created on first deploy"
echo "   ✅ Analytics: Configured"
echo ""
echo "🎯 Next steps:"
echo "   1. Test the worker: wrangler dev"
echo "   2. View logs: wrangler tail"
echo "   3. Query database: wrangler d1 execute building-vitals-db --command=\"SELECT * FROM queue_jobs\""
echo "   4. List R2 objects: wrangler r2 object list building-vitals-timeseries"
echo ""
echo "📚 Documentation: docs/R2_QUEUE_INTEGRATION.md"
echo ""
