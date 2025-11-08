# GitHub Actions Quick Start - 5 Minute Setup

## ✅ What You Get

- **Hourly sync** from Flightdeck to Supabase (automatic)
- **One-click backfill** for Oct 15 - Nov 7 data
- **$0/month cost** (within free tier)
- **Visual monitoring** in GitHub Actions tab
- **Email alerts** on failures

## 📋 Prerequisites

1. GitHub repository (you already have this)
2. Flightdeck API token
3. Supabase credentials

## 🚀 Setup (5 Minutes)

### Step 1: Add GitHub Secrets (2 minutes)

1. **Go to your GitHub repository**
   - https://github.com/YOUR_USERNAME/Building-Vitals

2. **Navigate to Settings → Secrets and variables → Actions**

3. **Click "New repository secret"** and add these 3 secrets:

   **Secret 1: FLIGHTDECK_TOKEN**
   ```
   Name: FLIGHTDECK_TOKEN
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
   ```

   **Secret 2: SUPABASE_URL**
   ```
   Name: SUPABASE_URL
   Value: https://jywxcqcjsvlyehuvsoar.supabase.co
   ```

   **Secret 3: SUPABASE_SERVICE_ROLE_KEY**
   ```
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.gJ7JWmJr9tZHXYPqLZqO5Ev76Aql0LWF5hhC4M9GQ0Q
   ```

### Step 2: Install @supabase/supabase-js (1 minute)

```bash
cd "C:\Users\jstahr\Desktop\Building Vitals"
npm install @supabase/supabase-js
```

### Step 3: Commit and Push (1 minute)

```bash
git add .github/workflows/ scripts/sync-to-supabase.js package.json package-lock.json
git commit -m "Add GitHub Actions hourly sync and backfill"
git push
```

### Step 4: Verify Workflows Appear (30 seconds)

1. Go to **Actions** tab in GitHub
2. You should see two workflows:
   - ✅ Hourly Flightdeck Sync
   - ✅ Backfill Historical Data

### Step 5: Run Backfill (1 minute)

1. **Click "Backfill Historical Data"**
2. **Click "Run workflow"** dropdown
3. **Verify dates**:
   - Start date: `2025-10-15`
   - End date: `2025-11-07`
   - Site ID: `ses_falls_city`
4. **Click "Run workflow"** button
5. **Watch it run** - takes ~5-10 minutes

---

## 🎯 How It Works

### Hourly Sync (Automatic)

```
Every hour at :05 past the hour:
1. GitHub Actions runs
2. Fetches last hour of data from Flightdeck API
3. Upserts to Supabase timeseries table
4. Updates sync_state with last sync time
5. Sends email if fails
```

**Next run**: Check Actions tab, shows countdown

### Backfill (Manual)

```
When you click "Run workflow":
1. Loops through each day from start to end
2. Fetches full day of data (24 hours)
3. Inserts to Supabase
4. Sleeps 2 seconds between days (rate limiting)
5. Shows progress in logs
```

**Progress**: Click running workflow to see live logs

---

## 📊 Monitoring

### View Sync Status

**GitHub Actions Tab**:
- Green ✅ = Success
- Red ❌ = Failed
- Yellow 🟡 = Running

**Click any run** to see:
- Detailed logs
- Duration
- Records synced
- Error messages (if failed)

### Check Data in Supabase

```sql
-- Recent syncs
SELECT * FROM sync_state ORDER BY last_sync_at DESC;

-- Data coverage
SELECT
  DATE(ts) as date,
  COUNT(*) as records,
  MIN(ts) as first_record,
  MAX(ts) as last_record
FROM timeseries
WHERE ts >= '2025-10-15'
GROUP BY DATE(ts)
ORDER BY date;

-- Recent data (should be < 1 hour old)
SELECT
  point_id,
  ts,
  value,
  AGE(NOW(), ts) as data_age
FROM timeseries
ORDER BY ts DESC
LIMIT 20;
```

---

## 🔔 Email Notifications

GitHub automatically sends emails when workflows fail.

**To configure**:
1. **Settings → Notifications**
2. **Actions**: Check "Send notifications for failed workflows"

---

## 🐛 Troubleshooting

### Workflow Not Running?

**Check**: Actions tab shows workflow is enabled
**Fix**: Click workflow → "Enable workflow"

### Secrets Not Working?

**Check**: Settings → Secrets shows all 3 secrets
**Fix**: Delete and re-add secrets (copy/paste carefully)

### Backfill Failing?

**Check logs**:
1. Actions → Backfill Historical Data → Click failed run
2. Expand "Backfill data by day" step
3. Look for error message

**Common issues**:
- API token expired → Update FLIGHTDECK_TOKEN secret
- Supabase table doesn't exist → Run migration first
- Network timeout → API is down, retry later

### No Data Appearing?

**Check Supabase**:
```sql
-- Does table exist?
SELECT COUNT(*) FROM timeseries;

-- Does composite primary key exist?
SELECT conname FROM pg_constraint
WHERE conname = 'timeseries_pkey';

-- Any recent inserts?
SELECT COUNT(*) FROM timeseries
WHERE ts > NOW() - INTERVAL '24 hours';
```

**If table missing**: Create it first:
```sql
CREATE TABLE IF NOT EXISTS timeseries (
  point_id INTEGER NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION,
  PRIMARY KEY (point_id, ts)
);
```

---

## 🔧 Customization

### Change Sync Frequency

Edit `.github/workflows/sync-hourly.yml`:

```yaml
schedule:
  - cron: '5 * * * *'  # Every hour at :05
  # Change to:
  - cron: '*/30 * * * *'  # Every 30 minutes
  # Or:
  - cron: '0 */2 * * *'  # Every 2 hours
```

### Add More Sites

**Option 1**: Run workflow manually with different site_id
1. Actions → Hourly Flightdeck Sync
2. Run workflow
3. Site ID: `your_other_site_id`

**Option 2**: Create separate workflow file for each site
```bash
cp .github/workflows/sync-hourly.yml .github/workflows/sync-site2.yml
# Edit sync-site2.yml and change SITE_ID default
```

### Change Batch Size

Edit `scripts/sync-to-supabase.js`:
```javascript
const BATCH_SIZE = 500;  // Change to 1000 for larger batches
```

---

## 💰 Cost Monitoring

### View Current Usage

1. **Settings → Billing**
2. **Click "View usage this month"**
3. See minutes consumed

**Your expected usage**: ~1,800 minutes/month (FREE)

### Set Spending Limit

1. **Settings → Billing → Spending limits**
2. Set Actions limit to **$0** (will stop at 2,000 free minutes)
3. Or set to **$10** as safety buffer

### Cost Alerts

GitHub doesn't email about approaching limits, but you can:
- Check usage weekly in Billing dashboard
- If you hit 1,500 minutes, you're at 75% (still safe)

---

## ✅ Success Checklist

After setup, verify:

- [ ] All 3 secrets added to GitHub
- [ ] Workflows committed and pushed
- [ ] Backfill workflow ran successfully
- [ ] Hourly sync shows in Actions (will run at next :05)
- [ ] Data visible in Supabase `SELECT COUNT(*) FROM timeseries`
- [ ] Email notifications configured

---

## 🎉 You're Done!

Your system is now:
- ✅ Syncing hourly automatically
- ✅ Backfilling Oct 15 - Nov 7
- ✅ Costing $0/month
- ✅ Running in cloud (no firewall issues)
- ✅ Monitored via GitHub Actions
- ✅ Email alerts on failures

**Next hourly sync**: Check Actions tab for countdown

**Backfill status**: Actions → Backfill workflow → View logs
