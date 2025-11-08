# GitHub Actions Setup for Historical Backfill

## ✅ What's Included

A GitHub Actions workflow that lets you run historical backfills on-demand from the cloud (FREE!).

## 🚀 Setup Steps

### 1. Push to GitHub

If you haven't already:
```bash
git add .
git commit -m "Add historical backfill GitHub Actions workflow"
git push origin main
```

### 2. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these three secrets:

**Secret 1: SUPABASE_URL**
- Name: `SUPABASE_URL`
- Value: `https://jywxcqcjsvlyehuvsoar.supabase.co`

**Secret 2: SUPABASE_SERVICE_ROLE_KEY**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M`

**Secret 3: ACE_API_KEY**
- Name: `ACE_API_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg`

### 3. Run the Workflow

1. Go to the **Actions** tab in your repository
2. Click **Historical Data Backfill** workflow on the left
3. Click **Run workflow** button (top right)
4. Fill in the parameters:
   - **Start date**: e.g., `2025-01-01`
   - **End date**: e.g., `2025-02-01`
   - **Site**: `ses_falls_city`
5. Click **Run workflow**

### 4. Monitor Progress

- The workflow will appear in the list
- Click on it to see live logs
- It can run for up to 6 hours per job
- If it times out, it saves a checkpoint and you can resume

### 5. Resume from Checkpoint (if needed)

If a workflow times out:
1. Download the checkpoint artifact
2. Note the last completed date from logs
3. Run workflow again starting from that date

## 📅 Recommended Backfill Strategy

Process month-by-month for reliability:

### January 2025
- Start: `2025-01-01`
- End: `2025-02-01`

### February 2025
- Start: `2025-02-01`
- End: `2025-03-01`

### March 2025
- Start: `2025-03-01`
- End: `2025-04-01`

... continue for each month through October 2025

## 📊 Expected Runtime

- **Per month**: 2-4 hours
- **Total (Jan-Oct 2025)**: Run 10 separate workflows
- **Cost**: $0 (free tier)

## ⚡ Quick Batch Script

You can manually trigger all months via GitHub CLI:

```bash
# Install gh CLI: https://cli.github.com/

# Login
gh auth login

# Run backfill for each month
gh workflow run historical-backfill.yml -f start_date=2025-01-01 -f end_date=2025-02-01 -f site=ses_falls_city
sleep 14400  # Wait 4 hours
gh workflow run historical-backfill.yml -f start_date=2025-02-01 -f end_date=2025-03-01 -f site=ses_falls_city
sleep 14400
gh workflow run historical-backfill.yml -f start_date=2025-03-01 -f end_date=2025-04-01 -f site=ses_falls_city
# ... etc
```

## 🔍 Troubleshooting

### Workflow Fails

- **Check secrets**: Make sure all three secrets are set correctly
- **Check logs**: Click on the failed workflow to see error details
- **Retry**: Simply run the workflow again (it's idempotent)

### Timeout

- Normal! Each workflow can run 6 hours max
- Resume from the checkpoint
- Or reduce the date range to smaller chunks

### No Data Inserted

- This is actually normal if data already exists (idempotent)
- Check Supabase to verify data is there
- The script uses upsert, so duplicates are ignored

## ✅ Success Indicators

You'll know it's working when:
- Workflow shows green checkmark
- Logs show "samples inserted"
- Supabase row count increases
- Health endpoint shows fresh data

## 🎯 Next Steps

After setting up:
1. Run workflows for each month
2. Verify data in Supabase
3. Cloudflare Worker continues real-time sync (already deployed)
4. Data stays fresh automatically going forward!

---

**You now have a completely cloud-based, zero-cost, hands-off data pipeline!** 🚀