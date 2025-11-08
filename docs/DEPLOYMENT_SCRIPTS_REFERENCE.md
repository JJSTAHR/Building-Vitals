# Deployment Scripts Reference Guide

Complete reference for all deployment and management scripts in the Building Vitals project.

## Quick Navigation

- [Core Deployment Scripts](#core-deployment-scripts)
- [Testing & Verification](#testing--verification)
- [Backfill Scripts](#backfill-scripts)
- [Database Management](#database-management)
- [Utility Scripts](#utility-scripts)
- [Common Workflows](#common-workflows)

---

## Core Deployment Scripts

### Complete Automated Deployment

**Script**: `scripts\deploy-all.bat`

One-click deployment of the entire Building Vitals system.

```batch
scripts\deploy-all.bat
```

**What it does**:
1. Configures environment variables (`.env`)
2. Installs npm dependencies
3. Deploys Supabase (database + Edge Functions)
4. Deploys Cloudflare Worker
5. Runs verification checks

**Prompts**:
- Whether to proceed with deployment
- Supabase credentials (if not in `.env`)
- ACE API credentials
- Whether to deploy each component

**Time**: 5-10 minutes
**Prerequisites**: Node.js, Supabase CLI, Wrangler CLI installed

---

### Environment Configuration

**Script**: `scripts\setup-environment.bat`

Interactive wizard for creating your `.env` file.

```batch
scripts\setup-environment.bat
```

**What it does**:
1. Copies `.env.example` to `.env`
2. Generates secure 32-byte encryption secret
3. Prompts for required credentials
4. Tests connections to verify configuration
5. Saves configuration to `.env`

**Prompts**:
- Supabase URL (e.g., `https://xxx.supabase.co`)
- Supabase Service Role Key
- Supabase Anon Key
- ACE API Key (JWT token)
- Cloudflare Worker URL
- Default Site ID

**Time**: 2-3 minutes
**Output**: `.env` file (never commit this!)

---

### Supabase Deployment

**Script**: `scripts\deploy-supabase.bat`

Deploys database schema and Edge Functions to Supabase.

```batch
scripts\deploy-supabase.bat
```

**What it does**:
1. Checks Supabase CLI authentication
2. Links to your Supabase project (prompts for project ref)
3. Applies all database migrations (~30 files)
4. Deploys Edge Functions:
   - `continuous-sync` - Real-time data synchronization
   - `timeseries-proxy` - Query routing and optimization
   - `weekly-backfill` - Automated weekly backfills
5. Sets Edge Function secrets (SUPABASE_URL, ACE_API_KEY, etc.)

**Time**: 3-5 minutes
**Prerequisites**: Supabase CLI installed, `.env` configured

**Migrations Applied**:
- TimescaleDB hypertable setup
- Partitioning for time-series data
- Performance indexes
- pg_cron automated jobs
- Multi-site support tables

---

### Cloudflare Worker Deployment

**Script**: `scripts\deploy-cloudflare.bat`

Deploys the ACE proxy worker to Cloudflare.

```batch
scripts\deploy-cloudflare.bat
```

**What it does**:
1. Checks Wrangler authentication
2. Installs npm dependencies
3. Deploys worker to production environment
4. Sets worker secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ACE_API_KEY`

**Time**: 2-3 minutes
**Prerequisites**: Wrangler CLI installed, `.env` configured

**Worker Features**:
- Proxies ACE API requests
- Routes queries to Supabase
- Handles authentication
- Manages KV cache

---

## Testing & Verification

### Deployment Verification (Batch)

**Script**: `scripts\verify-deployment.bat`

Windows batch script for quick deployment checks.

```batch
scripts\verify-deployment.bat
```

**What it checks**:
- ✓ Supabase connection (HTTP 200)
- ✓ ACE API connectivity
- ✓ Cloudflare Worker health endpoint
- ✓ Database tables exist (timeseries_raw, points, sites)
- ✓ Edge Functions deployment

**Exit Codes**:
- 0 = All checks passed
- 1+ = Errors found

**Time**: 1 minute

---

### Deployment Verification (Node.js)

**Script**: `scripts\verify-deployment.cjs`

More detailed verification with better error reporting.

```bash
node scripts\verify-deployment.cjs
```

**Additional Features**:
- Colored console output
- Detailed error messages
- JSON response validation
- Timeout handling
- Connection diagnostics

**Exit Codes**:
- 0 = All checks passed
- 1 = Critical errors
- 2 = Warnings (non-critical)

---

### Edge Function Testing

**Script**: `scripts\test-edge-functions.bat`

Tests all deployed Supabase Edge Functions.

```batch
scripts\test-edge-functions.bat
```

**What it tests**:
1. `continuous-sync` - POST with test payload
2. `timeseries-proxy` - Query endpoint with sample data
3. `weekly-backfill` - Dry-run test

**Useful for**:
- Verifying function deployment
- Testing after updates
- Debugging function issues
- Checking authentication

**Output**: HTTP responses with status codes and bodies

---

## Backfill Scripts

### Python Backfill Suite

All Python scripts located in `scripts\python\`

#### Daily Backfill (Version 2)

**Script**: `scripts\python\daily_backfill_v2.py`

```bash
python scripts\python\daily_backfill_v2.py
```

**What it does**:
- Fetches previous day's data
- Processes all configured sites
- Uses ACE API paginated endpoints
- Stores in Supabase timeseries_raw table

**Schedule**: Daily at 2 AM UTC (via GitHub Actions)

---

#### Paginated RAW Backfill

**Script**: `scripts\python\backfill_paginated_raw.py`

Advanced backfill script for large historical data fetches.

```bash
python scripts\python\backfill_paginated_raw.py \
  --site ses_falls_city \
  --start 2025-01-01T00:00:00Z \
  --end 2025-01-07T00:00:00Z \
  --chunk-minutes 10 \
  --page-size 10000 \
  --max-chunks 100
```

**Parameters**:
- `--site` - Site ID to backfill
- `--start` - Start timestamp (ISO 8601)
- `--end` - End timestamp (optional, defaults to now)
- `--chunk-minutes` - Size of each time chunk (default: 10)
- `--page-size` - ACE API page size (default: 10000)
- `--max-chunks` - Max chunks to process (default: unlimited)

**Features**:
- Handles pagination automatically
- Exponential backoff on rate limits
- Resumes from failures
- Progress tracking
- Batch inserts to Supabase

**Use Cases**:
- Historical data backfills (January 2025 onwards)
- Filling data gaps
- Recovery after outages

---

### Windows Batch Backfill Wrappers

Quick-start wrappers for common backfill scenarios:

```batch
scripts\run-backfill.bat              # General backfill
scripts\run-backfill-stable.bat       # Stable settings
scripts\run-daily-backfill.bat        # Daily sync
scripts\quick-backfill.bat            # Last 24 hours
```

---

## Database Management

### SQL Scripts

All SQL scripts located in `scripts\`

#### Performance Optimization

**Script**: `scripts\fix-performance.sql`

```sql
-- Creates indexes for faster queries
-- Optimizes partition routing
-- Improves join performance
```

**Apply**:
```bash
supabase db execute --file scripts\fix-performance.sql
# Or via API:
node scripts\execute-performance-fix.cjs
```

---

#### Partition Management

**Script**: `scripts\permanent-partition-solution.sql`

```sql
-- Fixes partition routing issues
-- Ensures data goes to correct partitions
-- Sets up automatic partition creation
```

**When to use**:
- After partition errors
- Before large backfills
- Monthly maintenance

---

#### Cleanup and Fix

**Script**: `scripts\FINAL_CLEANUP_AND_FIX.sql`

```sql
-- Removes redundant cron jobs
-- Cleans up duplicate systems
-- Optimizes configuration
```

**Apply**:
```bash
supabase db execute --file scripts\FINAL_CLEANUP_AND_FIX.sql
```

---

### Node.js Database Scripts

#### Execute SQL via API

**Script**: `scripts\execute-sql.cjs`

Executes SQL files via Supabase REST API.

```bash
node scripts\execute-sql.cjs scripts\fix-performance.sql
```

**Useful when**:
- Can't access Supabase CLI
- Automating migrations
- Running scripts from CI/CD

---

#### Check Data Coverage

**Script**: `scripts\check-data-coverage.cjs`

Reports data availability by site and date range.

```bash
node scripts\check-data-coverage.cjs
```

**Output**:
```
Site: ses_falls_city
Date Range: 2025-01-01 to 2025-01-31
Points: 4,378
Samples: 1,234,567
Coverage: 98.5%
Gaps: 2025-01-15 14:00 - 16:00
```

---

## Utility Scripts

### PowerShell Scripts

#### Set All Secrets

**Script**: `scripts\set-all-secrets.ps1`

Bulk secret configuration for Supabase and Cloudflare.

```powershell
.\scripts\set-all-secrets.ps1
```

**What it does**:
1. Reads `.env` file
2. Extracts all secret values
3. Sets Supabase function secrets
4. Sets Cloudflare worker secrets

**Saves time**: No need to set secrets one-by-one

---

#### Automated Sync Task

**Script**: `scripts\Setup-AutoSync-Task.ps1`

Creates Windows scheduled task for continuous sync.

```powershell
.\scripts\Setup-AutoSync-Task.ps1
```

**Creates**:
- Windows Task Scheduler entry
- Runs continuous sync every 5 minutes
- Logs to dedicated file
- Auto-restarts on failure

---

### Node.js Utilities

#### Supabase Connection Test

**Script**: `scripts\test-supabase-connection.cjs`

Quick connectivity test with diagnostics.

```bash
node scripts\test-supabase-connection.cjs
```

**Tests**:
- REST API connectivity
- Authentication
- Database access
- Table permissions

---

#### Haystack Verification

**Script**: `scripts\verify-haystack.cjs`

Tests Haystack pattern matching for point metadata.

```bash
node scripts\verify-haystack.cjs
```

**Verifies**:
- Pattern definitions
- Tag matching
- Device type detection
- Point enrichment

---

## Common Workflows

### First-Time Production Deployment

```batch
# 1. Configure environment
scripts\setup-environment.bat

# 2. Deploy everything
scripts\deploy-all.bat

# 3. Verify deployment
scripts\verify-deployment.bat

# 4. Test Edge Functions
scripts\test-edge-functions.bat

# 5. Start application
npm run dev
```

**Time**: 15-20 minutes

---

### Redeploy After Code Changes

#### Supabase Only

```batch
scripts\deploy-supabase.bat
scripts\test-edge-functions.bat
```

#### Worker Only

```batch
scripts\deploy-cloudflare.bat
curl https://ace-iot-timeseries-prod.jstahr.workers.dev/health
```

#### Both

```batch
scripts\deploy-supabase.bat
scripts\deploy-cloudflare.bat
scripts\verify-deployment.bat
```

---

### Troubleshooting Failed Deployment

```batch
# 1. Check environment
scripts\verify-deployment.bat

# 2. Verbose verification
node scripts\verify-deployment.cjs

# 3. Test connections
node scripts\test-supabase-connection.cjs

# 4. Check function logs
supabase functions logs continuous-sync
wrangler tail --env production

# 5. Verify secrets
supabase secrets list
wrangler secret list --env production
```

---

### Historical Data Backfill

#### Full Year Backfill

```bash
python scripts\python\backfill_paginated_raw.py \
  --site ses_falls_city \
  --start 2025-01-01T00:00:00Z \
  --end 2025-12-31T23:59:59Z \
  --chunk-minutes 60 \
  --page-size 100000
```

**Estimated time**: 2-4 hours per site

#### Fill Data Gaps

```bash
# Identify gaps
node scripts\check-data-coverage.cjs

# Fill specific range
python scripts\python\backfill_paginated_raw.py \
  --site ses_falls_city \
  --start 2025-01-15T14:00:00Z \
  --end 2025-01-15T16:00:00Z
```

---

### Routine Maintenance

#### Weekly

```batch
# Check data coverage
node scripts\check-data-coverage.cjs

# Verify deployment
scripts\verify-deployment.bat

# Review logs
supabase functions logs continuous-sync --filter "level=error"
```

#### Monthly

```sql
-- Run in Supabase SQL Editor
-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Verify compression
SELECT * FROM timescaledb_information.compressed_chunk_stats LIMIT 10;

-- Check retention policy
SELECT * FROM timescaledb_information.jobs;
```

---

## Script Dependencies

### Required CLI Tools

All scripts require these to be installed:

```powershell
# Node.js (v20+)
winget install OpenJS.NodeJS.LTS

# Python (3.11+) - for backfill scripts
winget install Python.Python.3.11

# Supabase CLI
npm install -g supabase

# Wrangler CLI
npm install -g wrangler

# Git
winget install Git.Git
```

Verify:
```bash
node --version      # v20.x.x
python --version    # Python 3.11.x
supabase --version  # 1.x.x
wrangler --version  # 3.x.x
```

### Python Dependencies

```bash
cd scripts\python
pip install -r requirements.txt
```

**Packages**:
- `requests` - HTTP client
- `python-dotenv` - Environment variables
- `supabase-py` - Supabase client
- `psycopg2` - PostgreSQL adapter

---

## Environment Variables

All scripts read from `.env` in project root.

**Critical Variables**:
```bash
# Supabase (required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# ACE API (required)
ACE_API_KEY=eyJhbGc...
ACE_API_BASE=https://flightdeck.aceiot.cloud/api

# Cloudflare (required)
VITE_WORKER_URL=https://ace-iot-timeseries-prod.jstahr.workers.dev

# Security (auto-generated)
VITE_ENCRYPTION_SECRET=<base64-string>

# Default Site (required)
VITE_DEFAULT_SITE_ID=ses_falls_city
```

**See**: `.env.example` for complete list

---

## Error Handling

### Common Errors

| Error | Script | Fix |
|-------|--------|-----|
| "CLI not found" | All | Install missing CLI tool |
| "Authentication failed" | Supabase/Cloudflare | Run login command |
| "Migration failed" | deploy-supabase.bat | Check SQL syntax in migration file |
| "Function 401" | test-edge-functions.bat | Reset function secrets |
| "Worker 404" | verify-deployment | Deploy worker first |
| "No data" | Backfill scripts | Check ACE API credentials |

### Debug Commands

```bash
# Check Supabase authentication
supabase projects list

# Check Cloudflare authentication
wrangler whoami

# View logs
supabase functions logs <function-name>
wrangler tail --env production

# List secrets
supabase secrets list
wrangler secret list --env production
```

---

## Best Practices

1. **Always verify after deployment**
   ```batch
   scripts\verify-deployment.bat
   ```

2. **Test locally before production**
   ```batch
   npm run dev
   npm test
   ```

3. **Keep secrets secure**
   - Never commit `.env`
   - Use GitHub Secrets for CI/CD
   - Rotate credentials quarterly

4. **Monitor deployments**
   - Set up Cloudflare alerts
   - Review Supabase logs weekly
   - Track error rates

5. **Backup before changes**
   ```powershell
   # Backup .env
   copy .env .env.backup.$(Get-Date -Format "yyyyMMdd")

   # Backup database (Supabase Pro)
   # Automated daily backups available
   ```

---

## Support Resources

### Documentation
- [Full Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Quick Start Guide](./QUICK_DEPLOYMENT.md)
- [Architecture Overview](./ARCHITECTURE_CLOUDFLARE_VS_SUPABASE.md)
- [Backfill System](./AUTOMATIC_BACKFILL_SETUP.md)

### External Docs
- [Supabase Docs](https://supabase.com/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [TimescaleDB](https://docs.timescale.com)

---

**Last Updated**: 2025-01-04
**Version**: 1.0.0
