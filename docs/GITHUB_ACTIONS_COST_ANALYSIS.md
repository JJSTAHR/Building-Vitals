# GitHub Actions Cost Analysis: Hourly Sync + Backfill

## Your Requirements

- **Ongoing Sync**: Hourly (24 times/day)
- **Backfill**: Oct 15, 2025 → Nov 7, 2025 (23 days)
- **Sites**: 1 site (ses_falls_city) initially

## GitHub Actions Pricing

### Free Tier (Per Month)
- **Public Repo**: ♾️ UNLIMITED minutes FREE
- **Private Repo**: 2,000 minutes FREE
- **After Free Tier**: $0.008/minute ($0.48/hour)

### Your Repo Status
Based on git status: This appears to be a **private repository**
→ You get **2,000 FREE minutes/month**

---

## Cost Calculation

### Ongoing Hourly Sync

**Assumptions:**
- 1 sync job per hour
- Each job runs ~2-3 minutes (fetch API + insert to Supabase)
- 24 hours/day × 30 days/month = 720 syncs/month

**Monthly Usage:**
```
720 syncs/month × 2.5 minutes/sync = 1,800 minutes/month
```

**Cost:**
```
1,800 minutes < 2,000 free minutes
→ $0.00/month ✅ COMPLETELY FREE
```

### One-Time Backfill (Oct 15 - Nov 7)

**Strategy**: Backfill 1 day at a time to avoid timeouts

**Calculation:**
```
Oct 15 → Nov 7 = 23 days
23 days × 3 minutes/day = 69 minutes (one-time)
```

**Cost:**
```
69 minutes < 2,000 free minutes
→ $0.00 (one-time) ✅ COMPLETELY FREE
```

### Total First Month
```
Ongoing sync:     1,800 minutes
Backfill:            69 minutes
─────────────────────────────
TOTAL:            1,869 minutes

Free Tier:        2,000 minutes
Remaining:          131 minutes
─────────────────────────────
COST:              $0.00 ✅
```

---

## Scaling Scenarios

### What if you add more sites?

| Sites | Monthly Minutes | Cost/Month |
|-------|----------------|------------|
| 1 site | 1,800 min | $0.00 (free) |
| 2 sites | 3,600 min | $12.80 |
| 3 sites | 5,400 min | $27.20 |
| 5 sites | 9,000 min | $56.00 |

**Formula:**
```
Cost = (minutes - 2000) × $0.008
```

### What if you sync more frequently?

| Frequency | Monthly Minutes | Cost/Month |
|-----------|----------------|------------|
| Every hour | 1,800 min | $0.00 (free) |
| Every 30 min | 3,600 min | $12.80 |
| Every 15 min | 7,200 min | $41.60 |
| Every 5 min | 21,600 min | $156.80 |

---

## Cost Comparison: All Tools

For **1 site, hourly sync, private repo**:

| Tool | Monthly Cost | Annual Cost | Notes |
|------|--------------|-------------|-------|
| **GitHub Actions** | **$0.00** | **$0.00** | Under free tier |
| **Pipedream** | $0.00 | $0.00 | 720 invocations << 100k limit |
| **n8n (cloud)** | $20.00 | $240.00 | Starter plan |
| **n8n (self-host)** | ~$5.00 | ~$60.00 | VPS cost only |
| **Railway** | $5.00 | $60.00 | After free credits |
| **Render** | $0.00 | $0.00 | 750 hours/month free |
| **Supabase Edge Functions** | $0.00 | $0.00 | But complex deployment |

---

## Recommended: GitHub Actions (It's FREE!)

### Why GitHub Actions Wins

✅ **Completely FREE** for your use case (1,869 min < 2,000 min)
✅ **Already using GitHub** - no new tools to learn
✅ **Version controlled** - workflow is in your repo
✅ **Easy debugging** - logs in Actions tab
✅ **Secrets management** - built-in vault
✅ **No firewall issues** - runs in cloud
✅ **Reliable** - backed by Microsoft infrastructure

### Implementation Files

I'll create two workflow files:

1. **`.github/workflows/sync-hourly.yml`** - Ongoing hourly sync
2. **`.github/workflows/backfill.yml`** - One-time backfill

---

## Implementation Plan

### Step 1: Add Secrets to GitHub

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these 3 secrets:
- `FLIGHTDECK_TOKEN` - Your Flightdeck API token
- `SUPABASE_URL` - `https://jywxcqcjsvlyehuvsoar.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### Step 2: Create Sync Script

File: `scripts/sync-to-supabase.js`
(I'll create this next)

### Step 3: Add Workflow Files

Two files in `.github/workflows/` directory
(I'll create these next)

### Step 4: Push to GitHub

```bash
git add .github/workflows/ scripts/sync-to-supabase.js
git commit -m "Add GitHub Actions hourly sync"
git push
```

### Step 5: Trigger Backfill

1. Go to Actions tab in GitHub
2. Select "Backfill Historical Data" workflow
3. Click "Run workflow"
4. Workflow will backfill Oct 15 - Nov 7

### Step 6: Monitor

- **Actions tab** shows all runs
- **Click any run** to see detailed logs
- **Email notifications** on failures (can configure)

---

## Monitoring Costs

### View Usage
1. Go to **Settings → Billing**
2. Click **View usage this month**
3. See minutes consumed

### Set Budget Alert
1. **Settings → Billing → Spending limits**
2. Set limit to $0 (will stop if you hit 2,000 minutes)
3. Or set to $10 as safety buffer

---

## When You'd Need to Pay

### Scenario 1: Adding More Sites
- 2 sites = 3,600 min/month → **$12.80/month**
- Still very cheap!

### Scenario 2: More Frequent Sync
- Every 30 minutes = 3,600 min/month → **$12.80/month**
- Every 15 minutes = 7,200 min/month → **$41.60/month**

### Scenario 3: Complex Processing
- If each sync takes 5 minutes instead of 2.5:
  - 720 × 5 = 3,600 min/month → **$12.80/month**

**Even in worst case, it's incredibly cheap!**

---

## My Recommendation

**Use GitHub Actions** because:

1. ✅ **$0/month** for your exact use case
2. ✅ **Already using GitHub** - no new tools
3. ✅ **Easy to debug** - familiar interface
4. ✅ **Version controlled** - workflow in git
5. ✅ **Solves firewall problem** - runs in cloud
6. ✅ **Built-in secrets** - secure token management
7. ✅ **Reliable** - Microsoft infrastructure
8. ✅ **Scalable** - cheap even if you grow

Ready to implement? I'll create:
1. Sync script (`scripts/sync-to-supabase.js`)
2. Hourly workflow (`.github/workflows/sync-hourly.yml`)
3. Backfill workflow (`.github/workflows/backfill.yml`)
