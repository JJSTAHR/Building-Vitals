# Building Vitals - Quick Deployment Guide

Fast-track deployment guide for experienced users. For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Prerequisites (5 minutes)

```powershell
# Install required tools
winget install OpenJS.NodeJS.LTS
npm install -g supabase wrangler

# Verify installations
node --version    # v20+
supabase --version
wrangler --version
```

## One-Command Deployment

```batch
# Clone and deploy everything
git clone <repo-url>
cd Building-Vitals
npm install
scripts\deploy-all.bat
```

The `deploy-all.bat` script handles:
- Environment configuration
- Dependency installation
- Supabase deployment
- Cloudflare Worker deployment
- Deployment verification

## Manual Step-by-Step (10 minutes)

### 1. Environment Setup (2 min)

```batch
scripts\setup-environment.bat
```

Provide when prompted:
- Supabase URL and keys (from dashboard)
- ACE API key
- Worker URL (or use default)

### 2. Deploy Database (3 min)

```batch
scripts\deploy-supabase.bat
```

- Links to Supabase project
- Applies 30+ migrations
- Deploys Edge Functions
- Sets function secrets

### 3. Deploy Worker (2 min)

```batch
scripts\deploy-cloudflare.bat
```

- Authenticates with Cloudflare
- Deploys proxy worker
- Sets worker secrets

### 4. Verify Deployment (1 min)

```batch
scripts\verify-deployment.bat
# Or use Node.js version:
node scripts\verify-deployment.cjs
```

### 5. Start Application (1 min)

```batch
npm run dev
# Visit: http://localhost:3000
```

## Required Secrets

### Supabase Dashboard (Project Settings > API)
- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- `SUPABASE_ANON_KEY` - Anonymous key (public)

### ACE IoT Platform
- `ACE_API_KEY` - JWT authentication token

### Cloudflare Dashboard
- Worker URL (after deployment)

## Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| "Supabase CLI not found" | `npm install -g supabase` |
| "Migration failed" | Check Supabase dashboard for errors |
| "Worker deployment failed" | Run `wrangler login` |
| "No data in charts" | Check worker URL in `.env` |
| "Edge Function 401" | Reset secrets with `supabase secrets set` |

## Quick Commands

```batch
# Redeploy everything
scripts\deploy-all.bat

# Just Supabase
scripts\deploy-supabase.bat

# Just Worker
scripts\deploy-cloudflare.bat

# Test deployment
scripts\verify-deployment.bat
scripts\test-edge-functions.bat

# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
```

## File Structure

```
Building-Vitals/
├── .env                        # Your secrets (never commit!)
├── .env.example                # Template
├── docs/
│   ├── DEPLOYMENT_GUIDE.md     # Full deployment docs
│   └── QUICK_DEPLOYMENT.md     # This file
├── scripts/
│   ├── deploy-all.bat          # Complete deployment
│   ├── deploy-supabase.bat     # Database + functions
│   ├── deploy-cloudflare.bat   # Worker deployment
│   ├── setup-environment.bat   # Configure .env
│   ├── verify-deployment.bat   # Check deployment
│   ├── verify-deployment.cjs   # Node.js version
│   └── test-edge-functions.bat # Test functions
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations
└── wrangler.toml               # Worker configuration
```

## Production Checklist

- [ ] All secrets set (never in code!)
- [ ] Database migrations applied
- [ ] Edge Functions deployed
- [ ] Worker deployed and responding
- [ ] Verification passed
- [ ] `.env` in `.gitignore`
- [ ] Tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)

## GitHub Actions Setup

Add these secrets in: Repository Settings > Secrets and variables > Actions

```yaml
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ACE_API_KEY
VITE_ENCRYPTION_SECRET
FIREBASE_SERVICE_ACCOUNT_PROD
SLACK_WEBHOOK  # Optional
```

Push to `main` branch triggers automatic deployment.

## Support

- Full docs: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- Architecture: [ARCHITECTURE_CLOUDFLARE_VS_SUPABASE.md](./ARCHITECTURE_CLOUDFLARE_VS_SUPABASE.md)
- Troubleshooting: See deployment guide

## Next Steps

1. **Configure continuous sync**: Check Supabase dashboard for pg_cron jobs
2. **Set up monitoring**: Enable Cloudflare Analytics
3. **Add sites**: Update `sites` table for multi-site support
4. **Customize charts**: Edit chart configurations in frontend

---

**Deployment Time**: ~10 minutes (automated) | ~15 minutes (manual)

**Support**: See docs/ folder for detailed guides
