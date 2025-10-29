# GitHub Actions Historical Backfill Setup Guide

## Overview

This guide explains how to set up and use GitHub Actions for historical data backfilling from ACE IoT API to Supabase. This solution eliminates timeout issues and provides a reliable, serverless way to backfill large date ranges.

## Architecture

```
GitHub Actions Runner (Ubuntu)
    ↓ (Node.js script)
    ↓ Fetches data via HTTPS
ACE IoT API (/timeseries/paginated)
    ↓ Processes in 10-minute chunks
    ↓ Inserts via REST API
Supabase (PostgreSQL + Partitions)
```

## Prerequisites

- GitHub repository with Actions enabled (free for public repos)
- Supabase project with partitioned timeseries table
- ACE IoT API access credentials

## Setup Instructions

### Step 1: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each of the following:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://jywxcqcjsvlyehuvsoar.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `ACE_API_KEY` | ACE IoT API token | Your ACE API authentication token |
| `ACE_API_BASE` | ACE API base URL (optional) | `https://flightdeck.aceiot.cloud/api` |

### Step 2: Verify Files

Ensure these files exist in your repository:

```
.github/workflows/backfill.yml          # GitHub Actions workflow
scripts/github-actions-backfill.cjs     # Node.js backfill script
```

### Step 3: Enable GitHub Actions

1. Go to **Actions** tab in your GitHub repository
2. If prompted, click **I understand my workflows, go ahead and enable them**
3. You should see the "Historical Data Backfill" workflow listed

## Usage

### Option 1: GitHub Web UI (Easiest)

1. Go to **Actions** tab
2. Click **Historical Data Backfill** in the left sidebar
3. Click **Run workflow** dropdown (top right)
4. Fill in the parameters:
   - **Site name**: `ses_falls_city` (or your site name)
   - **Start date**: `2025-10-01T00:00:00Z`
   - **End date**: `2025-10-31T23:59:59Z`
   - **Chunk minutes**: `10` (recommended)
5. Click **Run workflow**
6. Watch progress in real-time by clicking on the workflow run

### Option 2: GitHub CLI

```bash
# Install GitHub CLI if needed
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: https://github.com/cli/cli#installation

# Authenticate
gh auth login

# Run backfill workflow
gh workflow run backfill.yml \
  -f site=ses_falls_city \
  -f start_date=2025-10-01T00:00:00Z \
  -f end_date=2025-10-31T23:59:59Z \
  -f chunk_minutes=10

# List recent workflow runs
gh run list --workflow=backfill.yml

# View logs for a specific run
gh run view <run-id> --log
```

### Option 3: REST API

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/backfill.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "site": "ses_falls_city",
      "start_date": "2025-10-01T00:00:00Z",
      "end_date": "2025-10-31T23:59:59Z",
      "chunk_minutes": "10"
    }
  }'
```

## Parameters

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `site` | Site name from ACE IoT | `ses_falls_city` | `ses_falls_city` |
| `start_date` | Start timestamp (ISO 8601) | `2025-10-01T00:00:00Z` | `2025-10-01T00:00:00Z` |
| `end_date` | End timestamp (ISO 8601) | `2025-10-31T23:59:59Z` | `2025-10-31T23:59:59Z` |
| `chunk_minutes` | Time window per chunk | `10` | `10`, `15`, `30` |

### Choosing Chunk Size

- **10 minutes**: Recommended for most backfills, balances speed and reliability
- **15 minutes**: Faster but may hit API rate limits
- **30 minutes**: Use only for sites with low point counts
- **5 minutes**: Use if experiencing API timeouts

## Monitoring Progress

### Real-time Logs

1. Go to **Actions** tab
2. Click on the running workflow
3. Click on the **Backfill** job
4. Expand **Run backfill script** step
5. Watch live progress:
   ```
   [1/4464] 0.0% - 2025-10-01T00:00:00.000Z to 2025-10-01T00:10:00.000Z
     📄 Page 1: 8234 samples ✅
     ✅ Success: 8234 fetched, 8234 inserted
     📊 Progress: 1 ✅ / 0 ❌ | Elapsed: 12s | ETA: 14928s
   ```

### Artifacts

Logs are automatically saved and can be downloaded for 30 days:
1. Go to the completed workflow run
2. Scroll to **Artifacts** section
3. Download `backfill-logs-*` ZIP file

## Performance Expectations

### October 2025 (31 days):
- **Total chunks**: ~4,464 (31 days × 24 hours × 6 chunks/hour)
- **Estimated time**: 2-4 hours
- **Average time per chunk**: 3-5 seconds
- **Data volume**: Varies by site (typically 5-10M samples)

### Costs:
- **GitHub Actions**: Free for public repos, $0.008/minute for private repos
- **Supabase**: Included in free tier (500GB transfer/month)
- **Total cost for October backfill**: $0 (public repo) or ~$1-2 (private repo)

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"

**Solution**: Add the missing secret to GitHub repository settings.

### Error: "no partition of relation timeseries found for row"

**Solution**: Ensure partitions exist for the date range. Run migration:
```sql
-- In Supabase SQL Editor
SELECT public.ensure_timeseries_partition('2025-10-01'::date);
SELECT public.ensure_timeseries_partition('2025-11-01'::date);
```

### Error: "ACE API error: 429 Too Many Requests"

**Solution**: Reduce chunk size or add delays:
```bash
# Use smaller chunks
-f chunk_minutes=5

# Or modify script to add delays between chunks
```

### Workflow times out after 6 hours

**Solution**:
1. Reduce date range and run multiple workflows
2. Increase chunk size if API supports it
3. Split into multiple months

### Script fails mid-way

**Solution**:
1. Check the last successful timestamp in logs
2. Re-run with adjusted start_date
3. The script is idempotent (safe to re-run)

## Local Testing

Test the script locally before running on GitHub Actions:

```bash
# Set environment variables
export SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_key_here
export ACE_API_KEY=your_key_here

# Test with small date range
node scripts/github-actions-backfill.cjs \
  --site ses_falls_city \
  --start 2025-10-29T12:00:00Z \
  --end 2025-10-29T12:30:00Z \
  --chunk-minutes 10

# Expected output:
# 🚀 Starting backfill for ses_falls_city
# ...
# 🎉 Backfill completed successfully!
```

## Advanced Usage

### Parallel Backfills (Multiple Sites)

Run multiple workflow instances for different sites:

```bash
# Site 1
gh workflow run backfill.yml -f site=site1 -f start_date=2025-10-01T00:00:00Z -f end_date=2025-10-31T23:59:59Z

# Site 2 (runs in parallel)
gh workflow run backfill.yml -f site=site2 -f start_date=2025-10-01T00:00:00Z -f end_date=2025-10-31T23:59:59Z
```

### Scheduled Backfills

Add a schedule trigger to the workflow:

```yaml
# .github/workflows/backfill.yml
on:
  workflow_dispatch: { ... }

  schedule:
    # Run daily at 2 AM UTC to backfill previous day
    - cron: '0 2 * * *'
```

### Custom Notification

Add Slack/Discord notifications on completion:

```yaml
- name: Notify completion
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Backfill ${{ job.status }}: ${{ inputs.site }}"
      }
```

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use service role key** (not anon key) for Supabase
3. **Restrict GitHub Actions** to specific branches if needed
4. **Rotate keys regularly** and update GitHub secrets
5. **Monitor workflow runs** for suspicious activity

## FAQ

**Q: Can I run this on a private repository?**
A: Yes, but you'll be charged for GitHub Actions minutes. Public repos are free.

**Q: How do I cancel a running backfill?**
A: Go to Actions tab, click the workflow run, and click "Cancel workflow".

**Q: Can I backfill multiple months at once?**
A: Yes, but consider splitting very large ranges (6+ months) into separate runs to avoid timeout.

**Q: Is the backfill idempotent?**
A: Yes, the script uses upsert logic. Safe to re-run if it fails mid-way.

**Q: How much will this cost?**
A: Free for public repos. ~$0.40-0.80 for private repos per month of backfilled data.

## Support

- **Issues**: https://github.com/yourusername/building-vitals/issues
- **Supabase Status**: https://status.supabase.com
- **GitHub Actions Status**: https://www.githubstatus.com

---

**Last Updated**: 2025-10-29
**Version**: 1.0.0
