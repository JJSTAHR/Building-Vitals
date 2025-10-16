# Wave 5A: Secrets Management Guide

## Overview

This guide provides secure setup procedures for all secrets required by the Building Vitals worker deployment.

## Required Secrets Inventory

### 1. ACE_API_KEY (Required by 4 Workers)
- **Purpose**: Authenticate with ACE IoT FlightDeck API
- **Used By**:
  - ETL Worker ✅ (Already configured)
  - Query Worker ⚠️ (Needs setup)
  - Archival Worker ⚠️ (Needs setup)
  - Backfill Worker ⚠️ (Needs setup)
- **Type**: Bearer token
- **Source**: ACE IoT platform credentials

### 2. BACKFILL_API_KEY (Required by 1 Worker)
- **Purpose**: Authenticate POST requests to `/backfill/start` endpoint
- **Used By**: Backfill Worker ⚠️ (Needs setup)
- **Type**: Secret token (generated)
- **Usage**: Frontend/admin tool authentication for triggering backfill operations

---

## Pre-Deployment Setup

### Step 1: Verify Existing Secrets

Check which secrets are already configured:

```bash
# Navigate to project root
cd "C:\Users\jstahr\Desktop\Building Vitals"

# Check ETL Worker (Reference)
wrangler secret list --config workers/wrangler-etl.toml

# Check Query Worker
wrangler secret list --config workers/wrangler-query.toml

# Check Archival Worker
wrangler secret list --config wrangler-archival.toml

# Check Backfill Worker
wrangler secret list --config workers/wrangler-backfill.toml
```

**Expected Output:**
- ETL Worker: Should show `ACE_API_KEY` ✅
- Query Worker: Should show `ACE_API_KEY` (or empty if not set)
- Archival Worker: Should show `ACE_API_KEY` (or empty if not set)
- Backfill Worker: Should show `ACE_API_KEY` and `BACKFILL_API_KEY` (or empty if not set)

---

## Secret Setup Procedures

### Option A: Copy ACE_API_KEY from ETL Worker

If you need to use the same ACE API key across all workers:

**⚠️ Note:** Wrangler doesn't provide a direct copy command. You must re-enter the key.

1. Retrieve the ACE API key from your secure credential store
2. Set it for each worker using the commands below

### Option B: Set ACE_API_KEY for Each Worker

```bash
# Set ACE_API_KEY for Query Worker
wrangler secret put ACE_API_KEY --config workers/wrangler-query.toml
# When prompted, paste: [YOUR_ACE_API_KEY]

# Set ACE_API_KEY for Archival Worker
wrangler secret put ACE_API_KEY --config wrangler-archival.toml
# When prompted, paste: [YOUR_ACE_API_KEY]

# Set ACE_API_KEY for Backfill Worker
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
# When prompted, paste: [YOUR_ACE_API_KEY]
```

**Security Best Practices:**
- Never echo the key value in your terminal
- Use a password manager to store and retrieve the key securely
- Clear your terminal history after setting secrets: `history -c` (Linux/Mac) or `Clear-History` (PowerShell)

---

## Generate and Set BACKFILL_API_KEY

### Step 1: Generate Secure Token

```bash
# Generate a cryptographically secure 32-byte hex string
openssl rand -hex 32
```

**Sample Output:**
```
734173d54ab6102dfcaee4b77528fb0c9bc3028179205cda57dc76054fdee9d5
```

### Step 2: Store Token Securely

**⚠️ CRITICAL:**
1. Copy the generated token immediately
2. Store it in your password manager or secure credential vault
3. Label it as: `Building Vitals - BACKFILL_API_KEY - Production`
4. Do NOT commit this value to git

### Step 3: Set BACKFILL_API_KEY

```bash
# Set BACKFILL_API_KEY for Backfill Worker
wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml
# When prompted, paste the generated token
```

---

## Verification Checklist

After setting all secrets, verify each worker:

```bash
# Query Worker - Should show: ACE_API_KEY
wrangler secret list --config workers/wrangler-query.toml

# Archival Worker - Should show: ACE_API_KEY
wrangler secret list --config wrangler-archival.toml

# Backfill Worker - Should show: ACE_API_KEY, BACKFILL_API_KEY
wrangler secret list --config workers/wrangler-backfill.toml
```

### ✅ Success Criteria

**Query Worker:**
```
[
  {
    "name": "ACE_API_KEY",
    "type": "secret_text"
  }
]
```

**Archival Worker:**
```
[
  {
    "name": "ACE_API_KEY",
    "type": "secret_text"
  }
]
```

**Backfill Worker:**
```
[
  {
    "name": "ACE_API_KEY",
    "type": "secret_text"
  },
  {
    "name": "BACKFILL_API_KEY",
    "type": "secret_text"
  }
]
```

---

## Deployment Readiness Checklist

- [ ] ACE_API_KEY set for Query Worker
- [ ] ACE_API_KEY set for Archival Worker
- [ ] ACE_API_KEY set for Backfill Worker
- [ ] BACKFILL_API_KEY generated and securely stored
- [ ] BACKFILL_API_KEY set for Backfill Worker
- [ ] All secrets verified with `wrangler secret list`
- [ ] BACKFILL_API_KEY shared with frontend/admin team (via secure channel)
- [ ] Terminal history cleared after setup

---

## Secret Rotation Procedures

### When to Rotate Secrets

1. **Scheduled Rotation**: Every 90 days (recommended)
2. **Security Incident**: Immediately if compromise suspected
3. **Team Member Departure**: If person with access leaves
4. **API Provider Update**: If ACE IoT rotates their API keys

### How to Rotate ACE_API_KEY

```bash
# 1. Obtain new API key from ACE IoT platform

# 2. Update each worker (zero-downtime)
wrangler secret put ACE_API_KEY --config workers/wrangler-etl.toml
wrangler secret put ACE_API_KEY --config workers/wrangler-query.toml
wrangler secret put ACE_API_KEY --config wrangler-archival.toml
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml

# 3. Verify all workers still function correctly
# Test each worker's health endpoint

# 4. Revoke old API key from ACE IoT platform
```

### How to Rotate BACKFILL_API_KEY

```bash
# 1. Generate new token
openssl rand -hex 32

# 2. Update Backfill Worker
wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml

# 3. Update frontend/admin tools with new key

# 4. Test backfill trigger with new key
curl -X POST https://building-vitals-backfill.workers.dev/backfill/start \
  -H "Authorization: Bearer NEW_BACKFILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2024-01-01","end_date":"2024-01-02"}'

# 5. Verify old key no longer works
```

---

## Security Best Practices

### Do's ✅

1. **Use Wrangler's Secret Management**: Always use `wrangler secret put` instead of environment variables
2. **Limit Access**: Only grant secret access to team members who need it
3. **Audit Regularly**: Review secret usage logs monthly
4. **Use Strong Tokens**: Minimum 32 bytes (256 bits) for generated secrets
5. **Secure Storage**: Store secrets in enterprise password managers (1Password, LastPass, etc.)
6. **Separate Environments**: Use different secrets for dev/staging/production
7. **Document Ownership**: Maintain a list of who has access to which secrets

### Don'ts ❌

1. **Never Commit Secrets**: Don't add secrets to `.env` files in git
2. **Never Log Secrets**: Don't console.log or print secret values
3. **Never Share Publicly**: Don't post secrets in Slack, email, or tickets
4. **Never Hardcode**: Don't embed secrets in source code
5. **Never Use Weak Tokens**: Don't use dictionary words or predictable patterns
6. **Never Expose in URLs**: Don't pass secrets as query parameters
7. **Never Skip Rotation**: Don't ignore scheduled rotation cycles

---

## Troubleshooting

### Secret Not Working After Setup

```bash
# 1. Verify secret is actually set
wrangler secret list --config workers/wrangler-query.toml

# 2. Check if worker needs redeployment
wrangler deploy --config workers/wrangler-query.toml

# 3. Tail logs to see errors
wrangler tail --config workers/wrangler-query.toml

# 4. Test with curl
curl -v https://building-vitals-query.workers.dev/health
```

### Secret Deleted Accidentally

```bash
# Re-set the secret immediately
wrangler secret put ACE_API_KEY --config workers/wrangler-query.toml

# Workers automatically pick up the new secret (no redeploy needed)
```

### Forgot BACKFILL_API_KEY Value

```bash
# Generate new token (old one cannot be recovered)
openssl rand -hex 32

# Update worker
wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml

# Update all systems using the old key
```

---

## Integration with Frontend/Admin Tools

### Using BACKFILL_API_KEY in Frontend

```javascript
// Example: Trigger backfill from admin panel
async function triggerBackfill(startDate, endDate) {
  const response = await fetch('https://building-vitals-backfill.workers.dev/backfill/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BACKFILL_API_KEY}`, // Store securely
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      start_date: startDate,
      end_date: endDate
    })
  });

  if (!response.ok) {
    throw new Error('Backfill trigger failed');
  }

  return response.json();
}
```

**Frontend Security:**
- Store BACKFILL_API_KEY in environment variables (`.env.local`)
- Use server-side API routes to proxy requests
- Never expose the key in client-side JavaScript
- Implement rate limiting on the backfill endpoint

---

## Deployment Team Handoff

### Information to Provide

1. **ACE_API_KEY Source**: "Retrieve from [Team Lead] or ACE IoT admin panel"
2. **Generated BACKFILL_API_KEY**: "Stored in [Password Manager Name] under 'Building Vitals - Backfill'"
3. **Setup Commands**: "Run commands from sections above in order"
4. **Verification Steps**: "Confirm all checklist items are complete"
5. **Support Contact**: "Reach out to [DevOps Lead] for secret access issues"

### Post-Deployment Actions

- [ ] Document secret rotation schedule in team calendar
- [ ] Add BACKFILL_API_KEY to frontend environment variables
- [ ] Test backfill endpoint with new key
- [ ] Update monitoring alerts to detect authentication failures
- [ ] Schedule 90-day rotation reminder

---

## Appendix: Secret Configuration Reference

### Worker Configuration Files

| Worker | Config File | Required Secrets |
|--------|-------------|------------------|
| ETL Worker | `workers/wrangler-etl.toml` | `ACE_API_KEY` ✅ |
| Query Worker | `workers/wrangler-query.toml` | `ACE_API_KEY` |
| Archival Worker | `wrangler-archival.toml` | `ACE_API_KEY` |
| Backfill Worker | `workers/wrangler-backfill.toml` | `ACE_API_KEY`, `BACKFILL_API_KEY` |

### Environment Variable vs Secret

**Use Secrets For:**
- API keys and tokens
- Database passwords
- Authentication credentials
- Encryption keys

**Use Environment Variables For:**
- Feature flags
- Public configuration
- Non-sensitive settings
- Service URLs

---

## Support and Contact

**Questions about secrets setup?**
- Internal Wiki: [Link to Wiki]
- DevOps Team: devops@company.com
- Emergency Rotation: [On-call phone]

**ACE IoT API Key Issues?**
- ACE Support: support@aceiot.cloud
- Account Dashboard: https://flightdeck.aceiot.cloud

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-14
**Owner**: Wave 5A Deployment Team
**Review Cycle**: Quarterly
