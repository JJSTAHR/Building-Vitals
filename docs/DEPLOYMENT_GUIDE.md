# Building Vitals - Production Deployment Guide

Complete step-by-step guide for deploying the Building Vitals monitoring system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Deployment Steps](#deployment-steps)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance](#maintenance)

---

## Prerequisites

### Required Accounts

- **Supabase** account (free tier available)
  - Sign up at: https://supabase.com
  - Create a new project

- **Cloudflare** account (free tier available)
  - Sign up at: https://cloudflare.com
  - Workers & Pages access

- **ACE API** credentials
  - Obtain API key from ACE IoT platform
  - Required for building data ingestion

### Required Software

Install the following tools on your local machine:

```powershell
# Node.js (v20 or later)
winget install OpenJS.NodeJS.LTS

# Supabase CLI
npm install -g supabase

# Wrangler CLI (Cloudflare)
npm install -g wrangler

# Git (if not installed)
winget install Git.Git
```

Verify installations:
```powershell
node --version    # Should show v20.x or later
npm --version     # Should show v10.x or later
supabase --version
wrangler --version
```

---

## Quick Start

For experienced users, follow these automated steps:

```batch
# 1. Clone the repository
git clone <repository-url>
cd Building-Vitals

# 2. Install dependencies
npm install

# 3. Configure environment
scripts\setup-environment.bat

# 4. Deploy Supabase (database + functions)
scripts\deploy-supabase.bat

# 5. Deploy Cloudflare Worker
scripts\deploy-cloudflare.bat

# 6. Verify deployment
scripts\verify-deployment.bat

# 7. Start development server
npm run dev
```

---

## Detailed Setup

### Step 1: Environment Configuration

Run the interactive setup wizard:

```batch
scripts\setup-environment.bat
```

This script will guide you through:

1. **Generating Encryption Secret** - Automatically creates a secure random key
2. **Supabase Configuration**
   - Project URL (find in: Supabase Dashboard > Settings > API)
   - Service Role Key (keep this secret!)
   - Anon Key (public key for client access)
3. **ACE API Configuration**
   - API Key (JWT token from ACE platform)
4. **Cloudflare Worker URL**
   - Default: `https://ace-iot-timeseries-prod.jstahr.workers.dev`
5. **Default Site Configuration**
   - Site ID (e.g., `ses_falls_city`)

**Important**: The script creates a `.env` file with your configuration. **NEVER commit this file to version control!**

### Step 2: Supabase Database Setup

The database uses TimescaleDB for efficient time-series storage.

#### Automated Deployment

```batch
scripts\deploy-supabase.bat
```

This script:
1. Links to your Supabase project
2. Applies all database migrations (30+ migration files)
3. Deploys Edge Functions
4. Sets function secrets

#### Manual Deployment (if automated fails)

```powershell
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Deploy functions individually
supabase functions deploy continuous-sync --no-verify-jwt
supabase functions deploy timeseries-proxy --no-verify-jwt
supabase functions deploy weekly-backfill --no-verify-jwt
```

#### Key Database Tables

- `timeseries_raw` - Raw time-series data from ACE API
- `points` - Point metadata and device mappings
- `sites` - Multi-site configuration
- `ingest_state` - Sync state tracking

### Step 3: Cloudflare Worker Deployment

The Cloudflare Worker acts as a proxy between your frontend and Supabase, handling authentication and query routing.

#### Automated Deployment

```batch
scripts\deploy-cloudflare.bat
```

This script:
1. Authenticates with Cloudflare
2. Installs dependencies
3. Deploys worker to production
4. Sets worker secrets

#### Manual Deployment

```powershell
# Login to Cloudflare
wrangler login

# Deploy to production
wrangler deploy --env production

# Set secrets
echo YOUR_SUPABASE_URL | wrangler secret put SUPABASE_URL --env production
echo YOUR_SERVICE_ROLE_KEY | wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
echo YOUR_ACE_API_KEY | wrangler secret put ACE_API_KEY --env production
```

#### Worker Configuration

Edit `wrangler.toml` to customize:
- KV namespace bindings
- Cron triggers for automated backfills
- Environment variables
- Analytics settings

---

## Deployment Steps

### Production Deployment Checklist

- [ ] Prerequisites installed
- [ ] Supabase project created
- [ ] Cloudflare account set up
- [ ] ACE API credentials obtained
- [ ] Environment configured (`setup-environment.bat`)
- [ ] Database deployed (`deploy-supabase.bat`)
- [ ] Worker deployed (`deploy-cloudflare.bat`)
- [ ] Deployment verified (`verify-deployment.bat`)
- [ ] Secrets configured (never in code!)
- [ ] Frontend built (`npm run build`)
- [ ] Application tested locally (`npm run dev`)

### GitHub Actions CI/CD

The repository includes automated deployment workflows:

#### Continuous Deployment

**File**: `.github/workflows/deploy.yml`

Triggers:
- Push to `main` branch → Production deployment
- Push to `develop` branch → Staging deployment
- Pull requests → Build and test only

**Required GitHub Secrets**:
```yaml
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ACE_API_KEY
VITE_ENCRYPTION_SECRET
FIREBASE_SERVICE_ACCOUNT_PROD
FIREBASE_SERVICE_ACCOUNT_STAGING
FIREBASE_TOKEN
SLACK_WEBHOOK  # Optional: deployment notifications
```

#### Automated Backfills

**File**: `.github/workflows/supabase-raw-backfill.yml`

- Scheduled: Daily at 2 AM UTC
- Manual trigger: Via GitHub Actions UI
- Multi-site support
- Paginated data fetching

### Environment-Specific Deployments

#### Staging Environment

```batch
# Deploy to staging
wrangler deploy --env staging

# Different database and bucket
# Configured in wrangler.toml [env.staging]
```

#### Production Environment

```batch
# Deploy to production
wrangler deploy --env production

# Uses production Supabase and KV
```

---

## Verification

### Automated Verification

```batch
scripts\verify-deployment.bat
```

This checks:
1. Supabase connection (HTTP 200)
2. ACE API connection (HTTP 200)
3. Cloudflare Worker health endpoint
4. Database schema (tables exist)
5. Edge Functions deployment

### Manual Verification

#### 1. Test Supabase Connection

```powershell
# Using curl
curl https://YOUR_PROJECT.supabase.co/rest/v1/?apikey=YOUR_ANON_KEY

# Expected: HTTP 200 with OpenAPI schema
```

#### 2. Test ACE API

```powershell
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?page=1&per_page=1" `
  -H "Authorization: Bearer YOUR_ACE_API_KEY"

# Expected: HTTP 200 with point data
```

#### 3. Test Cloudflare Worker

```powershell
# Health check
curl https://ace-iot-timeseries-prod.jstahr.workers.dev/health

# Expected: {"status":"ok","timestamp":"..."}

# Query timeseries data
curl -X POST https://ace-iot-timeseries-prod.jstahr.workers.dev/timeseries/query `
  -H "Content-Type: application/json" `
  -d '{"site":"ses_falls_city","points":[],"start":"2025-01-01T00:00:00Z","end":"2025-01-01T01:00:00Z"}'
```

#### 4. Test Edge Functions

```batch
scripts\test-edge-functions.bat
```

Or manually:

```powershell
# Test continuous-sync
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/continuous-sync `
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" `
  -H "Content-Type: application/json" `
  -d '{"test":true}'
```

#### 5. Verify Database

```sql
-- Connect via Supabase SQL Editor or psql

-- Check tables exist
\dt

-- Check timeseries data
SELECT COUNT(*) FROM timeseries_raw;

-- Check points metadata
SELECT COUNT(*) FROM points;

-- Verify hypertable (TimescaleDB)
SELECT * FROM timescaledb_information.hypertables;
```

---

## Troubleshooting

### Common Issues

#### 1. "Supabase CLI not found"

**Solution**:
```powershell
npm install -g supabase
# Or reinstall if already installed
npm uninstall -g supabase
npm install -g supabase
```

#### 2. "Migration failed: relation already exists"

**Cause**: Migration was partially applied

**Solution**:
```sql
-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations;

-- Manually mark migration as complete
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20251104000000')
ON CONFLICT DO NOTHING;
```

#### 3. "Worker deployment failed: unauthorized"

**Solution**:
```powershell
# Re-authenticate
wrangler logout
wrangler login

# Verify account
wrangler whoami
```

#### 4. "Edge Function returns 401"

**Cause**: Missing or incorrect authentication

**Solution**:
```powershell
# Re-set secrets
supabase secrets set --env-file .env

# Or individually
echo YOUR_VALUE | supabase secrets set SECRET_NAME
```

#### 5. "No data showing in charts"

**Checklist**:
- [ ] Worker URL correct in `.env`?
- [ ] ACE API credentials valid?
- [ ] Database has data? (`SELECT COUNT(*) FROM timeseries_raw`)
- [ ] Continuous sync running? (check cron jobs)
- [ ] Browser console errors? (F12 Developer Tools)

**Solution**:
```powershell
# Trigger manual backfill
curl -X POST https://ace-iot-timeseries-prod.jstahr.workers.dev/api/admin/supa-backfill `
  -H "Authorization: Bearer YOUR_ACE_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"siteName":"ses_falls_city","start_time":"2025-01-01T00:00:00Z","end_time":"2025-01-01T01:00:00Z","chunk_minutes":10}'
```

#### 6. "Rate limit exceeded"

**Cause**: Too many API requests to ACE

**Solution**:
- Reduce `chunk_minutes` in backfill scripts
- Implement exponential backoff (already in Python scripts)
- Contact ACE support to increase rate limits

---

## Maintenance

### Regular Tasks

#### Daily
- Monitor continuous sync logs: `supabase functions logs continuous-sync`
- Check error rates in Cloudflare dashboard

#### Weekly
- Review database size: `SELECT pg_size_pretty(pg_database_size(current_database()));`
- Verify backfills are running (GitHub Actions)
- Check TimescaleDB compression: `SELECT * FROM timescaledb_information.compressed_chunk_stats;`

#### Monthly
- Rotate API credentials
- Update dependencies: `npm update`
- Review and optimize indexes
- Archive old data (automated with pg_cron)

### Database Maintenance

#### View Current Size

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Compression Status (TimescaleDB)

```sql
-- Check compression ratio
SELECT
  format('%I.%I', chunk_schema, chunk_name) as chunk,
  before_compression_total_bytes / 1024 / 1024 as before_mb,
  after_compression_total_bytes / 1024 / 1024 as after_mb,
  ROUND(100 * (1 - after_compression_total_bytes::numeric / before_compression_total_bytes), 2) as compression_ratio_pct
FROM timescaledb_information.compressed_chunk_stats
ORDER BY before_compression_total_bytes DESC
LIMIT 10;
```

#### Retention Policy

The system automatically drops data older than 12 months (configured in migration `20251102160000_automatic_12month_retention.sql`).

To modify:

```sql
-- View current policies
SELECT * FROM timescaledb_information.jobs;

-- Modify retention
SELECT remove_retention_policy('timeseries_raw');
SELECT add_retention_policy('timeseries_raw', INTERVAL '24 months');
```

### Monitoring

#### Cloudflare Analytics

- Dashboard: https://dash.cloudflare.com
- Navigate to: Workers & Pages > ace-iot-timeseries-prod > Metrics
- Monitor:
  - Request rate
  - Error rate
  - CPU time
  - Bandwidth

#### Supabase Metrics

- Dashboard: https://app.supabase.com
- Navigate to: Your Project > Database > Usage
- Monitor:
  - Database size
  - Active connections
  - Query performance
  - API requests

#### Application Logging

```powershell
# View Worker logs
wrangler tail --env production

# View Edge Function logs
supabase functions logs continuous-sync
supabase functions logs timeseries-proxy

# Filter for errors only
supabase functions logs continuous-sync --filter "level=error"
```

### Backup and Recovery

#### Database Backup

```powershell
# Automated backups (Supabase Pro)
# - Daily backups retained for 7 days
# - Point-in-time recovery available

# Manual backup
pg_dump -h db.YOUR_PROJECT.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Restore
psql -h db.YOUR_PROJECT.supabase.co -U postgres -d postgres < backup_20250101.sql
```

#### Configuration Backup

```powershell
# Backup .env (encrypted)
copy .env .env.backup.$(Get-Date -Format "yyyyMMdd")

# Backup wrangler.toml
copy wrangler.toml wrangler.toml.backup
```

### Scaling

#### Horizontal Scaling

- **Supabase**: Upgrade to Pro for more connections and compute
- **Cloudflare**: Workers scale automatically (unlimited requests on paid plan)
- **Multi-site**: Add new sites via `sites` table, no code changes needed

#### Vertical Scaling

```sql
-- Add read replicas (Supabase Pro)
-- Configured via Supabase dashboard

-- Optimize queries with indexes
CREATE INDEX CONCURRENTLY idx_timeseries_raw_site_time
  ON timeseries_raw (site_id, ts);

-- Enable query caching in Worker
-- Set ENABLE_PARQUET_CACHE=true in wrangler.toml
```

---

## Security Best Practices

1. **Never commit secrets** - Use `.env` files and GitHub Secrets
2. **Rotate credentials** - Change API keys quarterly
3. **Use service role only server-side** - Never expose in frontend
4. **Enable Row Level Security** - Supabase RLS policies
5. **Monitor for anomalies** - Set up Cloudflare alerts
6. **Keep dependencies updated** - Run `npm audit` regularly
7. **Use HTTPS only** - Enforce SSL/TLS
8. **Implement rate limiting** - Protect against abuse
9. **Audit logs** - Review access logs monthly
10. **Backup regularly** - Test restore procedures

---

## Support and Resources

### Documentation
- Supabase: https://supabase.com/docs
- Cloudflare Workers: https://developers.cloudflare.com/workers
- TimescaleDB: https://docs.timescale.com

### Project-Specific Docs
- Architecture: `docs/ARCHITECTURE_CLOUDFLARE_VS_SUPABASE.md`
- Backfill System: `docs/AUTOMATIC_BACKFILL_SETUP.md`
- TimescaleDB Migration: `docs/TIMESCALEDB_MIGRATION_GUIDE.md`

### Getting Help
- Check `docs/` folder for detailed guides
- Review `scripts/` folder for automation examples
- Contact your system administrator

---

## Quick Reference

### Essential Commands

```batch
# Setup
scripts\setup-environment.bat          # Configure .env
scripts\deploy-supabase.bat            # Deploy database & functions
scripts\deploy-cloudflare.bat          # Deploy worker
scripts\verify-deployment.bat          # Check everything works

# Development
npm install                            # Install dependencies
npm run dev                            # Start dev server (port 3000)
npm run build                          # Build for production
npm run preview                        # Preview production build

# Testing
npm test                               # Run unit tests
npm run test:e2e                       # Run E2E tests
scripts\test-edge-functions.bat        # Test Supabase functions

# Deployment
git push origin main                   # Triggers CI/CD
wrangler deploy --env production       # Manual worker deploy
supabase db push                       # Apply migrations
```

### Environment Variables Cheat Sheet

| Variable | Required | Example | Where to Find |
|----------|----------|---------|---------------|
| `SUPABASE_URL` | Yes | `https://xxx.supabase.co` | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJhbGc...` | Supabase Dashboard > Settings > API |
| `ACE_API_KEY` | Yes | `eyJhbGc...` | ACE IoT Platform |
| `VITE_WORKER_URL` | Yes | `https://ace-iot-timeseries-prod.jstahr.workers.dev` | Cloudflare Dashboard |
| `VITE_ENCRYPTION_SECRET` | Yes | Auto-generated | `setup-environment.bat` |

---

**Last Updated**: 2025-01-04
**Version**: 1.0.0
