# Security Deployment Guide

## Overview

This guide explains how to securely deploy the Building Vitals Cloudflare Workers with all security fixes from Wave 4A applied.

**Security Enhancements:**
- ✅ No hardcoded credentials in configuration files
- ✅ Bearer token authentication for sensitive endpoints
- ✅ CORS origin whitelisting
- ✅ Comprehensive input validation
- ✅ Sanitized error messages (no internal details leaked)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database & Storage Setup](#database--storage-setup)
3. [Secrets Configuration](#secrets-configuration)
4. [Environment Variables](#environment-variables)
5. [CORS Configuration](#cors-configuration)
6. [Authentication Setup](#authentication-setup)
7. [Deployment](#deployment)
8. [Verification](#verification)
9. [Security Best Practices](#security-best-practices)

---

## Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI installed (`npm install -g wrangler`)
- Authenticated with Cloudflare: `wrangler login`

---

## Database & Storage Setup

### 1. Create D1 Database

```bash
# Create production database
wrangler d1 create ace-iot-db

# Output will show:
# ✅ Successfully created DB 'ace-iot-db'
# database_id = "YOUR_DATABASE_ID_HERE"
```

**IMPORTANT:** Copy the `database_id` from the output. You'll need it for the next step.

### 2. Bind D1 Database via Cloudflare Dashboard

**Option A: Via Dashboard (Recommended for Production)**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **Your Worker**
3. Go to **Settings** > **Variables**
4. Under **D1 Database Bindings**, click **Add binding**
5. Variable name: `DB`
6. D1 Database: Select `ace-iot-db`
7. Click **Save**

**Option B: Via wrangler.toml (Development Only)**

For local development, you can temporarily add:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "YOUR_DATABASE_ID_HERE"  # From step 1
```

⚠️ **Never commit this file with database_id to git!**

### 3. Run Database Migrations

```bash
# Apply schema to production database
wrangler d1 execute ace-iot-db --file=./migrations/001_initial_schema.sql

# Verify schema
wrangler d1 execute ace-iot-db --command=".schema"
```

### 4. Create R2 Bucket

```bash
# Create production R2 bucket
wrangler r2 bucket create ace-timeseries

# Verify
wrangler r2 bucket list
```

### 5. Create KV Namespaces

```bash
# Create production KV namespace
wrangler kv namespace create POINTS_KV

# Output will show:
# ✅ Successfully created KV namespace 'POINTS_KV'
# id = "YOUR_KV_ID_HERE"

# Create preview namespace for development
wrangler kv namespace create POINTS_KV --preview

# Output will show:
# ✅ Successfully created KV namespace 'POINTS_KV_preview'
# preview_id = "YOUR_PREVIEW_KV_ID_HERE"
```

### 6. Bind KV Namespace via Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **Your Worker**
3. Go to **Settings** > **Variables**
4. Under **KV Namespace Bindings**, click **Add binding**
5. Variable name: `POINTS_KV`
6. KV Namespace: Select `POINTS_KV`
7. Click **Save**

---

## Secrets Configuration

Secrets are **never stored in configuration files**. They are set via `wrangler secret put` command.

### 1. ACE API Key (Required)

```bash
wrangler secret put ACE_API_KEY
# Paste your ACE IoT API key when prompted
```

### 2. Backfill API Key (Required for Backfill Worker)

This is the Bearer token required to call the backfill endpoints.

```bash
# Generate a secure random token
# Option 1: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use OpenSSL
openssl rand -hex 32

# Copy the generated token, then:
wrangler secret put BACKFILL_API_KEY
# Paste the generated token when prompted
```

**Save this token securely!** You'll need it to call backfill endpoints:

```bash
# Example backfill request
curl -X POST https://your-worker.workers.dev/backfill/start \
  -H "Authorization: Bearer YOUR_BACKFILL_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'
```

### 3. Optional Secrets

```bash
# Sentry DSN for error tracking (optional)
wrangler secret put SENTRY_DSN

# Grafana API key for metrics (optional)
wrangler secret put GRAFANA_API_KEY
```

### 4. Verify Secrets

```bash
# List all secrets (values are hidden)
wrangler secret list
```

---

## Environment Variables

Environment variables are public configuration values (non-sensitive).

### 1. Set via Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **Your Worker**
3. Go to **Settings** > **Variables**
4. Under **Environment Variables**, add:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `ALLOWED_ORIGINS` | `https://yourdomain.com,https://app.yourdomain.com` | Comma-separated CORS origins |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `MAX_QUERY_RANGE_DAYS` | `90` | Maximum query range in days |
| `ENVIRONMENT` | `production` | Environment (development or production) |

### 2. Set via wrangler.toml (Alternative)

You can also set in `wrangler.toml` for non-sensitive values:

```toml
[vars]
ALLOWED_ORIGINS = "https://yourdomain.com,https://app.yourdomain.com"
LOG_LEVEL = "info"
MAX_QUERY_RANGE_DAYS = "90"
ENVIRONMENT = "production"
```

---

## CORS Configuration

### Allowed Origins Whitelist

The `ALLOWED_ORIGINS` environment variable controls which domains can call your API.

**Format:**
```
ALLOWED_ORIGINS = "https://domain1.com,https://domain2.com,https://subdomain.domain3.com"
```

**Examples:**

```bash
# Single domain
ALLOWED_ORIGINS = "https://app.yourcompany.com"

# Multiple domains
ALLOWED_ORIGINS = "https://app.yourcompany.com,https://dashboard.yourcompany.com,https://mobile.yourcompany.com"

# Development + Production
ALLOWED_ORIGINS = "http://localhost:3000,https://app.yourcompany.com"
```

**Security Notes:**
- ✅ Use HTTPS origins (except localhost for development)
- ✅ Include protocol (`https://`) in each origin
- ✅ No trailing slashes
- ✅ Separate multiple origins with commas (no spaces)
- ❌ Never use wildcard `*` in production
- ❌ Never include sensitive domains you don't control

### Testing CORS

```bash
# Test with valid origin
curl -X OPTIONS https://your-worker.workers.dev/timeseries/query \
  -H "Origin: https://app.yourcompany.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should return CORS headers with matching origin

# Test with invalid origin (should reject)
curl -X OPTIONS https://your-worker.workers.dev/timeseries/query \
  -H "Origin: https://malicious-site.com" \
  -v

# Should NOT return CORS headers
```

---

## Authentication Setup

### Backfill Endpoint Authentication

All `POST` endpoints on the backfill worker require Bearer token authentication.

**Protected Endpoints:**
- `POST /backfill/start` - Start backfill
- `POST /backfill/cancel` - Cancel backfill

**Public Endpoints:**
- `GET /backfill/status` - Get status (no auth required)

**Usage Example:**

```bash
# Start backfill (requires auth)
curl -X POST https://your-backfill-worker.workers.dev/backfill/start \
  -H "Authorization: Bearer YOUR_BACKFILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'

# Get status (no auth required)
curl https://your-backfill-worker.workers.dev/backfill/status
```

**Error Responses:**

```json
// Missing Authorization header
{
  "error": "Unauthorized",
  "message": "Authorization header with Bearer token required"
}

// Invalid token
{
  "error": "Forbidden",
  "message": "Invalid API key"
}
```

---

## Deployment

### 1. Deploy Workers

```bash
# Deploy main worker (proxy + ingestion)
wrangler deploy --config wrangler.toml

# Deploy query worker
wrangler deploy --config wrangler.query.toml

# Deploy backfill worker
wrangler deploy --config wrangler.backfill.toml

# Deploy archival worker (cron)
wrangler deploy --config wrangler-archival.toml
```

### 2. Verify Deployment

```bash
# Check worker status
wrangler deployments list

# View logs
wrangler tail your-worker-name --format=pretty

# Test health endpoint
curl https://your-query-worker.workers.dev/health
```

---

## Verification

### Security Checklist

After deployment, verify all security measures are in place:

#### ✅ Configuration Files
- [ ] No `database_id` in any `wrangler*.toml` file
- [ ] No KV `id` or `preview_id` in any `wrangler*.toml` file
- [ ] All secrets removed from git-tracked files
- [ ] `ALLOWED_ORIGINS` configured with specific domains (no `*`)

#### ✅ Authentication
- [ ] `BACKFILL_API_KEY` secret is set
- [ ] Backfill endpoints reject requests without Bearer token
- [ ] Backfill endpoints reject requests with invalid token

```bash
# Test: Should return 401 Unauthorized
curl -X POST https://your-backfill-worker.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

#### ✅ CORS
- [ ] Requests from allowed origins succeed
- [ ] Requests from disallowed origins are rejected (no CORS headers)

```bash
# Test: Valid origin (should succeed)
curl https://your-query-worker.workers.dev/health \
  -H "Origin: https://app.yourcompany.com" \
  -v | grep "Access-Control-Allow-Origin"

# Test: Invalid origin (should fail)
curl https://your-query-worker.workers.dev/health \
  -H "Origin: https://malicious-site.com" \
  -v | grep "Access-Control-Allow-Origin"
```

#### ✅ Input Validation
- [ ] Invalid parameters return 400 with descriptive errors
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are blocked

```bash
# Test: Invalid date format
curl "https://your-query-worker.workers.dev/timeseries/query?site_name=test&point_names=p1&start_time=invalid&end_time=9999999999999"

# Expected: 400 Bad Request with validation errors
```

#### ✅ Error Handling
- [ ] `ENVIRONMENT=production` is set
- [ ] Error responses don't leak stack traces
- [ ] Error responses include `request_id` for support

```bash
# Test: Trigger an error (e.g., query non-existent point)
curl "https://your-query-worker.workers.dev/timeseries/query?site_name=invalid&point_names=nonexistent&start_time=1704067200000&end_time=1704153600000"

# Expected: Generic error message with request_id, no stack trace
{
  "error": "Internal server error",
  "message": "An unexpected error occurred. Please contact support with this request ID.",
  "request_id": "uuid-here"
}
```

---

## Security Best Practices

### 1. Secrets Management

- ✅ **Never commit secrets to git**
- ✅ Use `wrangler secret put` for all sensitive values
- ✅ Rotate API keys regularly (quarterly)
- ✅ Use different secrets for staging and production
- ✅ Limit secret access to authorized team members only

### 2. CORS Configuration

- ✅ Use specific domain whitelists (no wildcards)
- ✅ Include only domains you control
- ✅ Use HTTPS origins (except localhost for dev)
- ✅ Review and update allowed origins regularly
- ✅ Test CORS configuration after deployment

### 3. Authentication

- ✅ Generate strong random tokens (32+ bytes)
- ✅ Store tokens in password manager or secret store
- ✅ Never log full Bearer tokens
- ✅ Rotate backfill API keys after any security incident
- ✅ Use separate API keys per environment

### 4. Input Validation

- ✅ Validate all user inputs before processing
- ✅ Sanitize inputs to prevent injection attacks
- ✅ Set reasonable limits (date ranges, point counts)
- ✅ Return descriptive validation errors (400 status)
- ✅ Log suspicious input patterns for monitoring

### 5. Error Handling

- ✅ Set `ENVIRONMENT=production` in production
- ✅ Never expose stack traces in production
- ✅ Log detailed errors server-side
- ✅ Return generic messages to clients
- ✅ Include `request_id` for support tracking

### 6. Monitoring & Alerts

- ✅ Monitor authentication failures
- ✅ Alert on unusual CORS rejections
- ✅ Track validation error rates
- ✅ Monitor API usage per client
- ✅ Set up alerts for error rate spikes

### 7. Regular Security Audits

- ✅ Review access logs monthly
- ✅ Audit secrets quarterly
- ✅ Update dependencies regularly
- ✅ Test security measures after changes
- ✅ Document security incidents and responses

---

## Troubleshooting

### "Unauthorized" error on backfill endpoints

**Cause:** Missing or invalid `Authorization` header

**Solution:**
```bash
# Check if BACKFILL_API_KEY is set
wrangler secret list

# If missing, set it:
wrangler secret put BACKFILL_API_KEY

# Include in request:
curl -H "Authorization: Bearer YOUR_KEY_HERE" ...
```

### CORS errors in browser

**Cause:** Origin not in `ALLOWED_ORIGINS` whitelist

**Solution:**
1. Check current `ALLOWED_ORIGINS`:
   ```bash
   wrangler tail --format=pretty | grep ALLOWED_ORIGINS
   ```

2. Update via Dashboard or wrangler.toml

3. Test with curl:
   ```bash
   curl -H "Origin: https://your-domain.com" https://your-worker.workers.dev/health -v
   ```

### "Database binding not found" error

**Cause:** D1 database not bound to worker

**Solution:**
1. Verify database exists: `wrangler d1 list`
2. Bind via Dashboard: Workers & Pages > Settings > Variables > D1 Database Bindings
3. Or temporarily add to `wrangler.toml` for testing (don't commit!)

### Error messages showing stack traces

**Cause:** `ENVIRONMENT` not set to `production`

**Solution:**
```bash
# Set via Dashboard
# Workers & Pages > Settings > Variables > Environment Variables
# Add: ENVIRONMENT = "production"

# Or in wrangler.toml
[vars]
ENVIRONMENT = "production"
```

---

## Support

For security-related issues:
1. Check logs: `wrangler tail --format=pretty`
2. Review this guide
3. Contact security team with `request_id` from error response

**Do not share:**
- Database IDs
- KV namespace IDs
- API keys or secrets
- Bearer tokens

---

## Changelog

### Wave 4A Security Fixes (Applied)

✅ **Issue #1: Hardcoded Credentials**
- Removed all `database_id` values from wrangler files
- Removed all KV `id` and `preview_id` values
- Added documentation for dashboard binding

✅ **Issue #2: No Authentication on Backfill**
- Added Bearer token authentication
- Protected POST /backfill/start
- Protected POST /backfill/cancel
- Added `BACKFILL_API_KEY` secret

✅ **Issue #3: CORS Wildcard**
- Replaced `Access-Control-Allow-Origin: *` with whitelist
- Added `ALLOWED_ORIGINS` environment variable
- Implemented origin validation function

✅ **Issue #4: Input Validation Missing**
- Added comprehensive parameter validation
- Validate types, ranges, formats
- Sanitize inputs to prevent injection
- Return detailed validation errors

✅ **Issue #5: Error Messages Leak Details**
- Added `safeErrorResponse()` function
- Check `ENVIRONMENT` variable
- Return generic messages in production
- Include `request_id` for support tracking
