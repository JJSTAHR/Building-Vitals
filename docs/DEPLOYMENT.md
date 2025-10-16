# Deployment Guide - Building Vitals Token Management System

## Overview

This guide covers the deployment process for the Building Vitals token management system, including automated CI/CD pipelines, manual deployment procedures, and rollback strategies.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Automated Deployment (CI/CD)](#automated-deployment-cicd)
- [Manual Deployment](#manual-deployment)
- [Deployment Verification](#deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Feature Flag Management](#feature-flag-management)
- [Security Considerations](#security-considerations)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- Node.js 18+ and npm
- Git
- Firebase CLI: `npm install -g firebase-tools`
- Access to GitHub repository
- Firebase project credentials

### Required Secrets

Set up the following secrets in GitHub repository settings:

#### GitHub Secrets (Required)
```
VITE_ENCRYPTION_SECRET          # Encryption key for token management
VITE_DEFAULT_TOKEN_FALLS_CITY   # Default token for Falls City location
FIREBASE_SERVICE_ACCOUNT_PROD   # Firebase service account (production)
FIREBASE_SERVICE_ACCOUNT_STAGING # Firebase service account (staging)
FIREBASE_TOKEN                  # Firebase CI token
SLACK_WEBHOOK                   # Slack notifications webhook
SLACK_SECURITY_WEBHOOK          # Security alerts webhook
METRICS_API_KEY                 # Metrics API authentication
SNYK_TOKEN                      # Snyk security scanning
```

#### Environment Variables (.env)
```bash
# Application
VITE_ENCRYPTION_SECRET=your_encryption_secret_here
VITE_DEFAULT_TOKEN_FALLS_CITY=your_default_token_here

# Firebase
FIREBASE_PROJECT_ID=building-vitals-prod
FIREBASE_API_KEY=your_api_key_here

# Optional
VITE_ENABLE_ANALYTICS=true
VITE_LOG_LEVEL=info
```

## Environment Setup

### Local Development

1. Clone repository:
```bash
git clone https://github.com/yourusername/building-vitals.git
cd building-vitals
```

2. Install dependencies:
```bash
npm ci
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Run development server:
```bash
npm run dev
```

### Firebase Setup

1. Authenticate with Firebase:
```bash
firebase login
```

2. Initialize project (if needed):
```bash
firebase init
# Select: Hosting, Firestore
```

3. Configure Firebase projects:
```bash
# Add staging project
firebase use --add building-vitals-staging
firebase use --alias staging building-vitals-staging

# Add production project
firebase use --add building-vitals-prod
firebase use --alias production building-vitals-prod
```

## Automated Deployment (CI/CD)

### GitHub Actions Workflow

The CI/CD pipeline automatically runs on:
- Push to `main` branch (production)
- Push to `develop` branch (staging)
- Pull requests to `main`
- Manual trigger (`workflow_dispatch`)

### Pipeline Stages

1. **Test** (runs on all events)
   - Code linting
   - Type checking
   - Unit tests
   - Integration tests
   - Coverage reporting

2. **Build** (requires tests to pass)
   - Install dependencies
   - Build application
   - Upload artifacts

3. **E2E Tests** (requires build to complete)
   - Playwright end-to-end tests
   - Visual regression tests
   - Upload test reports

4. **Deploy Staging** (on `develop` branch)
   - Deploy to Firebase Hosting preview channel
   - Run smoke tests
   - Notify team via Slack

5. **Deploy Production** (on `main` branch)
   - Deploy to Firebase Hosting
   - Deploy Firestore rules and indexes
   - Run post-deployment verification
   - Create git tag and GitHub release
   - Update deployment metrics
   - Notify team via Slack

### Triggering Deployment

#### Automatic (on commit)
```bash
# Deploy to staging
git checkout develop
git add .
git commit -m "feat: add new feature"
git push origin develop

# Deploy to production
git checkout main
git merge develop
git push origin main
```

#### Manual (via GitHub UI)
1. Go to Actions tab
2. Select "Deploy Token Management System"
3. Click "Run workflow"
4. Select branch and confirm

## Manual Deployment

Use manual deployment for:
- Testing deployment process
- Emergency hotfixes
- Deployment from local machine

### Deploy Script Usage

```bash
# Deploy to staging (dry run)
./scripts/deploy.sh staging true

# Deploy to staging (actual)
./scripts/deploy.sh staging

# Deploy to production (dry run)
./scripts/deploy.sh production true

# Deploy to production (actual)
./scripts/deploy.sh production
```

### Manual Deployment Steps

1. **Prepare Environment**
```bash
# Ensure on correct branch
git checkout main  # for production
# git checkout develop  # for staging

# Pull latest changes
git pull origin main

# Set environment variables
export VITE_ENCRYPTION_SECRET="your_secret"
export VITE_DEFAULT_TOKEN_FALLS_CITY="your_token"
```

2. **Run Pre-flight Checks**
```bash
# Install dependencies
npm ci

# Run tests
npm run test:coverage
npm run test:integration

# Build application
npm run build
```

3. **Deploy**
```bash
# Staging
firebase deploy --only hosting \
  --project building-vitals-staging

# Production
firebase deploy --only hosting,firestore:rules,firestore:indexes \
  --project building-vitals-prod
```

4. **Verify Deployment**
```bash
./scripts/post-deploy-verify.sh https://buildingvitals.com
```

## Deployment Verification

### Automated Verification

The `post-deploy-verify.sh` script checks:

- Application health (HTTP 200)
- Response time (<3s)
- Critical page accessibility
- Static asset availability
- Security headers
- SSL certificate validity
- Firestore rules
- API endpoints

### Manual Verification

After deployment, verify:

1. **Authentication Flows**
   - Login works
   - Logout works
   - Token refresh works
   - Session management works

2. **Token Management**
   - Token creation
   - Token retrieval
   - Token updates
   - Token deletion
   - Encryption/decryption

3. **User Experience**
   - All pages load
   - No console errors
   - Forms submit correctly
   - Navigation works

4. **Monitoring**
   - Check Firebase Analytics
   - Review error logs
   - Monitor performance metrics

### Health Check Endpoints

```bash
# Application health
curl https://buildingvitals.com/

# API health
curl https://buildingvitals.com/api/health

# Check response time
curl -o /dev/null -s -w '%{time_total}\n' https://buildingvitals.com/
```

## Rollback Procedures

### When to Rollback

- Critical bugs in production
- Security vulnerabilities
- Performance degradation
- Data corruption issues
- Failed deployment verification

### Rollback Methods

#### 1. Automatic Rollback (Firebase)
```bash
# Rollback to previous deployment
./scripts/rollback.sh production
```

#### 2. Manual Rollback to Specific Version
```bash
# Find deployment tag
git tag -l

# Rollback to specific version
./scripts/rollback.sh production v20250111-143022
```

#### 3. Emergency Rollback
```bash
# Immediate rollback via Firebase CLI
firebase hosting:rollback --project building-vitals-prod --yes
```

### Post-Rollback Verification

1. Verify application is working
2. Check monitoring dashboards
3. Review error logs
4. Notify team
5. Document incident
6. Plan fix and re-deployment

## Feature Flag Management

### Available Feature Flags

- `enable_token_refresh` - Token refresh functionality
- `enable_token_rotation` - Automatic token rotation
- `enable_security_monitoring` - Enhanced security monitoring
- `enable_rate_limiting` - API rate limiting
- `enable_audit_logging` - Detailed audit logs
- `enable_two_factor_auth` - Two-factor authentication
- `enable_session_management` - Advanced session management
- `enable_ip_whitelisting` - IP-based access control
- `enable_advanced_analytics` - Enhanced analytics
- `enable_beta_features` - Beta features for testing

### Managing Feature Flags

```bash
# List all feature flags
./scripts/feature-flag-toggle.sh list

# Enable a feature
./scripts/feature-flag-toggle.sh enable enable_token_refresh

# Disable a feature
./scripts/feature-flag-toggle.sh disable enable_beta_features

# Get current value
./scripts/feature-flag-toggle.sh get enable_token_rotation
```

### Feature Flag Best Practices

1. Test in staging before production
2. Enable gradually (e.g., 10% → 50% → 100%)
3. Monitor metrics after enabling
4. Keep flags temporary
5. Remove old flags after feature is stable

## Security Considerations

### Secrets Management

- Never commit secrets to repository
- Use GitHub Secrets for CI/CD
- Rotate secrets regularly
- Use different secrets per environment
- Audit secret access

### Security Scanning

Automated security scans run daily:
- Dependency vulnerabilities (npm audit, Snyk)
- Code security issues (CodeQL)
- Secret detection (Gitleaks, TruffleHog)
- Container vulnerabilities (Trivy)
- License compliance

### Firestore Security Rules

Deploy rules with production deployment:
```bash
firebase deploy --only firestore:rules --project building-vitals-prod
```

### HTTPS and Certificates

- All traffic uses HTTPS
- Certificates auto-renewed by Firebase
- Monitor certificate expiry

## Monitoring and Alerts

### Key Metrics

Monitor these metrics post-deployment:

1. **Performance**
   - Page load time
   - Time to interactive
   - API response time
   - Database query time

2. **Errors**
   - JavaScript errors
   - API errors
   - Authentication failures
   - Database errors

3. **Business**
   - Active users
   - Login success rate
   - Token operations
   - Feature usage

### Alert Configuration

Set up alerts for:
- Error rate > 1%
- Response time > 3s
- Failed authentication > 5%
- Deployment failures

### Monitoring Tools

- Firebase Analytics - User behavior
- Firebase Performance - App performance
- Firebase Crashlytics - Error tracking
- Cloud Monitoring - Infrastructure

## Troubleshooting

### Common Issues

#### 1. Build Failures

**Symptom:** Build fails in CI/CD
**Solutions:**
```bash
# Check dependencies
npm ci

# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run type-check

# Check linting
npm run lint
```

#### 2. Deployment Failures

**Symptom:** Firebase deployment fails
**Solutions:**
```bash
# Re-authenticate
firebase login --reauth

# Check project ID
firebase use

# Verify build output
ls -la dist/

# Try deploying specific target
firebase deploy --only hosting --debug
```

#### 3. Post-Deployment Issues

**Symptom:** Application not working after deployment
**Solutions:**
```bash
# Check application logs
firebase hosting:channel:logs

# Verify environment variables
# Check Firebase Console > Hosting

# Rollback
./scripts/rollback.sh production

# Re-deploy with fixes
./scripts/deploy.sh production
```

#### 4. Authentication Issues

**Symptom:** Users cannot log in
**Solutions:**
- Check Firebase Authentication is enabled
- Verify Firestore rules are deployed
- Check API keys are correct
- Review browser console errors
- Check token encryption secret

### Getting Help

- Check [Firebase Status](https://status.firebase.google.com/)
- Review GitHub Actions logs
- Check Firebase Console logs
- Contact team lead
- Review error tracking (Sentry/Crashlytics)

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Firestore rules updated
- [ ] Database migrations ready (if any)
- [ ] Rollback plan documented
- [ ] Team notified

### During Deployment

- [ ] Monitor deployment progress
- [ ] Watch for errors in logs
- [ ] Check automated tests
- [ ] Verify deployment succeeded

### Post-Deployment

- [ ] Run verification script
- [ ] Test critical user flows
- [ ] Check monitoring dashboards
- [ ] Monitor error rates for 30 minutes
- [ ] Document any issues
- [ ] Notify team of completion

## Best Practices

1. **Always deploy to staging first**
2. **Run full test suite before production**
3. **Deploy during low-traffic periods**
4. **Monitor for at least 30 minutes post-deployment**
5. **Keep rollback plan ready**
6. **Document all deployments**
7. **Use feature flags for risky changes**
8. **Automate everything possible**
9. **Never skip verification steps**
10. **Communicate with team**

## Support

For deployment issues:
- Email: devops@buildingvitals.com
- Slack: #deployments
- On-call: Check PagerDuty

---

**Last Updated:** 2025-01-11
**Version:** 1.0.0
