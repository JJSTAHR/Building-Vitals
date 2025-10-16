#!/bin/bash

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${RED}===========================================${NC}"
echo -e "${RED}  Deployment Rollback Script${NC}"
echo -e "${RED}===========================================${NC}"
echo ""

ENVIRONMENT=${1:-production}
VERSION=${2:-previous}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info "Environment: $ENVIRONMENT"
log_info "Version: $VERSION"
echo ""

# Validate environment
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
    log_error "Invalid environment: $ENVIRONMENT (must be 'staging' or 'production')"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    log_error "Firebase CLI not found. Please install it first:"
    log_info "  npm install -g firebase-tools"
    exit 1
fi

# Confirm rollback
echo -e "${RED}WARNING: This will rollback the $ENVIRONMENT deployment!${NC}"
echo ""
log_warning "Current deployment will be replaced with: $VERSION"
echo ""
read -p "Are you absolutely sure? Type 'yes' to confirm: " -r
if [[ ! $REPLY == "yes" ]]; then
    log_error "Rollback cancelled"
    exit 1
fi

# Get current deployment info
log_info "Getting current deployment information..."
FIREBASE_PROJECT="building-vitals-$ENVIRONMENT"
if [ "$ENVIRONMENT" == "production" ]; then
    FIREBASE_PROJECT="building-vitals-prod"
fi

log_info "Firebase project: $FIREBASE_PROJECT"

# List recent deployments
log_info "Recent deployments:"
firebase hosting:channel:list --project "$FIREBASE_PROJECT" 2>/dev/null || log_warning "Could not list channels"

# Create backup of current deployment
log_info "Creating backup of current deployment..."
BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
git tag -a "$BACKUP_TAG" -m "Backup before rollback to $VERSION" 2>/dev/null || log_warning "Could not create backup tag"

# Rollback Firebase Hosting
log_info "Rolling back Firebase Hosting..."
if [ "$VERSION" == "previous" ]; then
    # Rollback to previous version
    firebase hosting:rollback --project "$FIREBASE_PROJECT" --yes
    log_success "Rolled back to previous version"
else
    # Rollback to specific version
    log_warning "Specific version rollback requires manual deployment from git tag"
    log_info "Steps to rollback to specific version:"
    log_info "  1. git checkout $VERSION"
    log_info "  2. npm ci"
    log_info "  3. npm run build"
    log_info "  4. firebase deploy --only hosting --project $FIREBASE_PROJECT"
    echo ""
    read -p "Do you want to proceed with manual rollback? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout "$VERSION"
        npm ci
        npm run build
        firebase deploy --only hosting --project "$FIREBASE_PROJECT"
        log_success "Deployed version $VERSION"
    else
        log_error "Rollback cancelled"
        exit 1
    fi
fi

# Rollback Firestore rules (if needed)
log_warning "Firestore rules rollback must be done manually if needed"
if [ -d "firestore-rules-backup" ]; then
    log_info "Backup location: firestore-rules-backup/"
    log_info "To restore Firestore rules:"
    log_info "  1. Review backup files in firestore-rules-backup/"
    log_info "  2. Copy desired rules to firestore.rules"
    log_info "  3. Run: firebase deploy --only firestore:rules --project $FIREBASE_PROJECT"
else
    log_warning "No Firestore rules backup found"
    log_info "If you need to rollback rules, restore from version control:"
    log_info "  git show $VERSION:firestore.rules > firestore.rules"
fi

# Verify rollback
log_info "Verifying rollback..."
sleep 5  # Wait for deployment to propagate

if [ "$ENVIRONMENT" == "production" ]; then
    URL="https://buildingvitals.com"
else
    URL="https://staging.buildingvitals.com"
fi

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$HTTP_STATUS" -eq 200 ]; then
    log_success "Application is responding (HTTP $HTTP_STATUS)"
else
    log_error "Application returned HTTP $HTTP_STATUS"
    log_warning "Manual verification required!"
fi

# Run post-rollback verification
if [ -f "$SCRIPT_DIR/post-deploy-verify.sh" ]; then
    log_info "Running post-rollback verification..."
    chmod +x "$SCRIPT_DIR/post-deploy-verify.sh"
    "$SCRIPT_DIR/post-deploy-verify.sh" "$URL" || log_warning "Verification had issues"
fi

# Log rollback event
log_info "Logging rollback event..."
ROLLBACK_LOG="$PROJECT_ROOT/deployment-logs/rollback-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$PROJECT_ROOT/deployment-logs"
cat > "$ROLLBACK_LOG" << EOF
Rollback Event
==============
Date: $(date)
Environment: $ENVIRONMENT
Previous Version: current
Rolled Back To: $VERSION
Backup Tag: $BACKUP_TAG
Performed By: $(whoami)
Reason: Manual rollback
Status: Success
EOF

log_success "Rollback log saved to: $ROLLBACK_LOG"

# Notify team
log_warning "IMPORTANT: Notify your team about this rollback!"
log_info "Recommended notifications:"
log_info "  1. Post in team Slack channel"
log_info "  2. Update incident ticket"
log_info "  3. Document rollback reason"
log_info "  4. Plan for re-deployment"

echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  Rollback Complete!${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
log_info "Summary:"
log_info "  Environment: $ENVIRONMENT"
log_info "  Rolled back to: $VERSION"
log_info "  Backup tag: $BACKUP_TAG"
log_info "  URL: $URL"
echo ""
log_warning "Next steps:"
log_info "  1. Monitor application for stability"
log_info "  2. Review logs for errors"
log_info "  3. Investigate root cause of issues"
log_info "  4. Fix issues before re-deploying"
log_info "  5. Test thoroughly in staging"
echo ""
