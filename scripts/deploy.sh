#!/bin/bash

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

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

# Configuration
ENVIRONMENT=${1:-staging}
DRY_RUN=${2:-false}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  Building Vitals Deployment Script${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Dry Run: $DRY_RUN"
log_info "Project Root: $PROJECT_ROOT"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if required commands are available
REQUIRED_COMMANDS=("node" "npm" "git" "firebase")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v $cmd &> /dev/null; then
        log_error "Required command '$cmd' not found"
        exit 1
    fi
done
log_success "All required commands available"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version 18 or higher required (found: v$NODE_VERSION)"
    exit 1
fi
log_success "Node.js version check passed (v$NODE_VERSION)"

# Check environment variables
REQUIRED_ENV_VARS=("VITE_ENCRYPTION_SECRET")
for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable '$var' not set"
        log_info "Please set it in your .env file or environment"
        exit 1
    fi
done
log_success "All required environment variables set"

# Check git status
if [[ $(git status --porcelain) ]]; then
    log_warning "Working directory not clean"
    git status --short
    echo ""
    read -p "Continue with uncommitted changes? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled"
        exit 1
    fi
else
    log_success "Working directory clean"
fi

# Check if on correct branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$ENVIRONMENT" == "production" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    log_error "Production deployments must be from 'main' branch (current: $CURRENT_BRANCH)"
    exit 1
fi
if [ "$ENVIRONMENT" == "staging" ] && [ "$CURRENT_BRANCH" != "develop" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    log_warning "Staging deployments typically use 'develop' branch (current: $CURRENT_BRANCH)"
fi
log_success "Branch check passed: $CURRENT_BRANCH"

# Pull latest changes
log_info "Pulling latest changes..."
git pull origin "$CURRENT_BRANCH"
log_success "Repository up to date"

# Install dependencies
log_info "Installing dependencies..."
npm ci
log_success "Dependencies installed"

# Run linting
log_info "Running linting..."
if npm run lint; then
    log_success "Linting passed"
else
    log_warning "Linting found issues (continuing anyway)"
fi

# Run type checking
log_info "Running type checking..."
if npm run type-check; then
    log_success "Type checking passed"
else
    log_warning "Type checking found issues (continuing anyway)"
fi

# Run tests
log_info "Running unit tests..."
if npm run test:coverage; then
    log_success "Unit tests passed"
else
    log_error "Unit tests failed"
    exit 1
fi

log_info "Running integration tests..."
if npm run test:integration; then
    log_success "Integration tests passed"
else
    log_warning "Integration tests had issues (continuing anyway)"
fi

# Build application
log_info "Building application..."
if npm run build; then
    log_success "Build completed successfully"
else
    log_error "Build failed"
    exit 1
fi

# Check build size
BUILD_SIZE=$(du -sh dist/ | cut -f1)
log_info "Build size: $BUILD_SIZE"

# Deploy based on environment
if [ "$ENVIRONMENT" == "production" ]; then
    echo ""
    echo -e "${RED}===========================================${NC}"
    echo -e "${RED}  PRODUCTION DEPLOYMENT${NC}"
    echo -e "${RED}===========================================${NC}"
    echo ""
    log_warning "You are about to deploy to PRODUCTION"
    echo ""
    read -p "Type 'yes' to confirm: " -r
    if [[ ! $REPLY == "yes" ]]; then
        log_error "Deployment cancelled"
        exit 1
    fi

    if [ "$DRY_RUN" == "true" ]; then
        log_warning "DRY RUN: Would deploy to production"
        log_info "Commands that would run:"
        echo "  firebase deploy --only hosting --project building-vitals-prod"
        echo "  firebase deploy --only firestore:rules --project building-vitals-prod"
        echo "  firebase deploy --only firestore:indexes --project building-vitals-prod"
    else
        log_info "Deploying to production..."

        # Deploy hosting
        log_info "Deploying to Firebase Hosting..."
        firebase deploy --only hosting --project building-vitals-prod

        # Deploy Firestore rules
        log_info "Deploying Firestore rules..."
        firebase deploy --only firestore:rules --project building-vitals-prod

        # Deploy Firestore indexes
        log_info "Deploying Firestore indexes..."
        firebase deploy --only firestore:indexes --project building-vitals-prod

        # Create git tag
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        TAG="v$TIMESTAMP"
        log_info "Creating git tag: $TAG"
        git tag -a "$TAG" -m "Production deployment $TAG"
        git push origin "$TAG"

        log_success "Production deployment complete!"
        log_info "Production URL: https://buildingvitals.com"
    fi

elif [ "$ENVIRONMENT" == "staging" ]; then
    if [ "$DRY_RUN" == "true" ]; then
        log_warning "DRY RUN: Would deploy to staging"
        log_info "Command that would run:"
        echo "  firebase deploy --only hosting --project building-vitals-staging"
    else
        log_info "Deploying to staging..."
        firebase deploy --only hosting --project building-vitals-staging

        log_success "Staging deployment complete!"
        log_info "Staging URL: https://staging.buildingvitals.com"
    fi
else
    log_error "Invalid environment: $ENVIRONMENT (must be 'staging' or 'production')"
    exit 1
fi

# Run post-deployment verification
if [ "$DRY_RUN" != "true" ]; then
    echo ""
    log_info "Running post-deployment verification..."
    if [ -f "$SCRIPT_DIR/post-deploy-verify.sh" ]; then
        chmod +x "$SCRIPT_DIR/post-deploy-verify.sh"

        if [ "$ENVIRONMENT" == "production" ]; then
            "$SCRIPT_DIR/post-deploy-verify.sh" "https://buildingvitals.com"
        else
            "$SCRIPT_DIR/post-deploy-verify.sh" "https://staging.buildingvitals.com"
        fi
    else
        log_warning "Post-deployment verification script not found"
    fi
fi

echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
log_info "Summary:"
log_info "  Environment: $ENVIRONMENT"
log_info "  Branch: $CURRENT_BRANCH"
log_info "  Build Size: $BUILD_SIZE"
if [ "$ENVIRONMENT" == "production" ]; then
    log_info "  Tag: $TAG"
fi
echo ""
