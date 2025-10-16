# ACE IoT API Token Management Guide

## Overview

The Building Vitals ETL Worker uses a JWT token from the ACE IoT API to authenticate and fetch timeseries data. This token is stored as a **Cloudflare Worker Secret** and needs to be managed properly when it expires or changes.

## Current Token Details

- **Storage Location**: Cloudflare Worker Secret named `ACE_API_KEY`
- **Used By**: ETL Sync Worker (`building-vitals-etl-sync`)
- **Current Token** (as of Oct 15, 2025):
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NzYxMTE4NiwianRpIjoiNjY1ZDM2NjMtZjFhZC00YWYxLTliZmEtNGMwMzRmMTllYjA4IiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5Ijoic2VzXzAwMDFfZmFsbHNfY2l0eSIsIm5iZiI6MTc1NzYxMTE4NiwiZXhwIjoxNzg5MTQ3MTg2fQ.5g9JVBO_18x42srsJ4ZUNIqMbK6XeQDyrqqS-WEFc0g
  ```
- **Expiration**: January 13, 2027 (31,536,000 seconds = 365 days from issue date)
- **Identity**: `ses_0001_falls_city`

## How to Detect Token Expiration

### 1. Monitor ETL Worker Logs

The ETL worker will show **401 Unauthorized** errors when the token expires:

```bash
npx wrangler tail -c workers/wrangler-etl.toml --format json
```

Look for errors like:
```json
{
  "message": "[ACE API] Request failed: 401 Unauthorized",
  "level": "error"
}
```

### 2. Check D1 Sample Count

If the D1 database stops growing, the token may have expired:

```bash
npx wrangler d1 execute ace-iot-db --remote \
  --command "SELECT COUNT(*) as total, MAX(timestamp) as newest FROM timeseries_raw" \
  --config workers/wrangler-query.toml
```

If `newest` timestamp is more than 5-10 minutes old, investigate immediately.

### 3. Manual API Test

Test the token directly against the ACE API:

```bash
curl -s "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?per_page=10" \
  -H "authorization: Bearer YOUR_TOKEN_HERE" \
  -w "\nHTTP Status: %{http_code}\n"
```

- **200**: Token is valid ✅
- **401**: Token expired or invalid ❌

## How to Rotate the Token

### Step 1: Get a New Token from ACE IoT API

Contact ACE IoT support or use their authentication endpoint to obtain a new JWT token for the `ses_0001_falls_city` identity.

**Important**: The token MUST have the same identity (`ses_0001_falls_city`) and permissions as the old token.

### Step 2: Update Cloudflare Worker Secret

Use `wrangler secret put` to update the token:

```bash
# For production environment
npx wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml

# You will be prompted to paste the new token
# Paste the full JWT token and press Enter
```

**Important Notes**:
- The secret update takes effect **immediately** (no deployment needed)
- The next scheduled ETL run (within 5 minutes) will use the new token
- There is **no downtime** during token rotation

### Step 3: Verify Token Rotation

After updating the secret, verify it's working:

1. **Check Worker Logs** (wait for next cron run):
   ```bash
   npx wrangler tail -c workers/wrangler-etl.toml --format json
   ```

   Look for successful API calls:
   ```json
   {
     "message": "[ACE API] Page 1: 100 collect-enabled points",
     "level": "log"
   }
   ```

2. **Trigger Manual Sync** (optional, for immediate verification):
   ```bash
   curl -X POST https://building-vitals-etl-sync.jstahr.workers.dev/trigger
   ```

3. **Verify D1 Growth**:
   ```bash
   npx wrangler d1 execute ace-iot-db --remote \
     --command "SELECT COUNT(*) FROM timeseries_raw" \
     --config workers/wrangler-query.toml
   ```

   Run this twice, 5 minutes apart. The count should increase.

## Token Storage Locations

The token is used in **two places**:

### 1. ETL Sync Worker (Backend - Cloudflare Secret)

- **Worker Name**: `building-vitals-etl-sync`
- **Secret Name**: `ACE_API_KEY`
- **Update Command**: `npx wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml`
- **Accessed By**: `src/etl-sync-worker.js` (line 448+)

### 2. Frontend Authentication (User Session - Firestore)

- **Storage**: Firestore `users/{userId}/tokens` collection
- **Redux Store**: `auth.aceToken` state slice
- **Update Method**:
  1. User logs in via Building Vitals UI
  2. Token stored in Firestore and Redux
  3. Included in API calls via `X-ACE-Token` header
- **Frontend Usage**:
  - `src/services/queryWorkerService.ts` (line 95)
  - `src/hooks/useChartData.ts`
  - All chart components

**Note**: Frontend and backend tokens can be different (different identities/permissions).

## How to Update Frontend Token (User Token)

If a **user's token** expires (not the ETL worker token):

### Option 1: Re-login via Building Vitals UI

1. User logs out from Building Vitals
2. User logs back in
3. UI prompts for ACE IoT credentials
4. New token automatically stored in Firestore and Redux

### Option 2: Direct Firestore Update (Admin Only)

```javascript
// Firebase Admin SDK or Console
const userId = 'user-id-here';
const newToken = 'eyJhbGci...new-token-here';

await admin.firestore()
  .collection('users')
  .doc(userId)
  .collection('tokens')
  .doc('aceToken')
  .set({
    token: newToken,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date('2027-01-13') // Adjust based on token expiration
  });
```

## Troubleshooting

### Problem: "401 Unauthorized" errors in ETL logs

**Solution**:
1. Verify token expiration: Decode JWT at https://jwt.io
2. Get new token from ACE IoT
3. Update secret: `npx wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml`
4. Wait 5 minutes for next cron run or trigger manually

### Problem: D1 database stopped growing

**Solution**:
1. Check ETL worker logs for errors
2. Verify token validity with manual curl test
3. Check Cloudflare Worker status: https://dash.cloudflare.com/workers
4. Review recent deployments for breaking changes

### Problem: "Secret not found" error

**Solution**:
```bash
# List existing secrets
npx wrangler secret list -c workers/wrangler-etl.toml

# If ACE_API_KEY is missing, create it
npx wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml
```

### Problem: Frontend charts show "401 Unauthorized"

**Solution**:
- This is a **user token** issue, not ETL worker
- User needs to re-login via Building Vitals UI
- Check Redux DevTools: `state.auth.aceToken` should be populated
- Verify Firestore has token document: `users/{userId}/tokens/aceToken`

## Security Best Practices

1. **Never commit tokens to Git**
   - Always use `wrangler secret put`
   - Never hardcode in `wrangler.toml` vars section

2. **Rotate tokens regularly**
   - Set calendar reminder for 30 days before expiration
   - Test new token before rotation

3. **Monitor token usage**
   - Set up Cloudflare Worker alerts for 401 errors
   - Track D1 sample count daily

4. **Use separate tokens for dev/staging/prod**
   - Dev environment: `wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml --env development`
   - Production: `wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml --env production`

## Token Expiration Timeline

Based on current token (issued January 13, 2024):

| Date | Event | Action Required |
|------|-------|----------------|
| Jan 13, 2024 | Token issued | None |
| Oct 15, 2025 | Current date | Verify token working |
| Dec 13, 2026 | 30 days before expiration | Obtain new token from ACE IoT |
| Jan 1, 2027 | 2 weeks before expiration | Rotate to new token |
| Jan 13, 2027 | **Token expires** | Service will break if not rotated |

## Quick Reference Commands

```bash
# Check current secret exists
npx wrangler secret list -c workers/wrangler-etl.toml

# Update token
npx wrangler secret put ACE_API_KEY -c workers/wrangler-etl.toml

# Test token manually
curl -H "authorization: Bearer YOUR_TOKEN" \
  https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?per_page=10

# Monitor logs
npx wrangler tail -c workers/wrangler-etl.toml

# Check D1 data freshness
npx wrangler d1 execute ace-iot-db --remote \
  --command "SELECT MAX(timestamp) as newest FROM timeseries_raw" \
  --config workers/wrangler-query.toml

# Trigger manual sync (for testing)
curl -X POST https://building-vitals-etl-sync.jstahr.workers.dev/trigger
```

## Related Documentation

- ACE IoT API Authentication: `docs/ACE_IOT_API_AUTHENTICATION.md`
- ETL Architecture: `docs/ETL_AND_QUERY_ARCHITECTURE.md`
- Cloudflare Secrets: https://developers.cloudflare.com/workers/configuration/secrets/

---

**Last Updated**: October 15, 2025
**Maintainer**: Building Vitals Team
