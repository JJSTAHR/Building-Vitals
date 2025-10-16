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

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  Feature Flag Management${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Parse arguments
COMMAND=${1:-help}
FEATURE=${2:-}
VALUE=${3:-}
ENVIRONMENT=${4:-production}

# Available feature flags
AVAILABLE_FLAGS=(
    "enable_token_refresh"
    "enable_token_rotation"
    "enable_security_monitoring"
    "enable_rate_limiting"
    "enable_audit_logging"
    "enable_two_factor_auth"
    "enable_session_management"
    "enable_ip_whitelisting"
    "enable_advanced_analytics"
    "enable_beta_features"
)

# Function to show help
show_help() {
    echo "Usage: $0 <command> [feature] [value] [environment]"
    echo ""
    echo "Commands:"
    echo "  list                    - List all feature flags"
    echo "  get <feature>          - Get current value of a feature flag"
    echo "  set <feature> <value>  - Set feature flag value"
    echo "  enable <feature>       - Enable a feature flag"
    echo "  disable <feature>      - Disable a feature flag"
    echo "  help                   - Show this help message"
    echo ""
    echo "Available feature flags:"
    for flag in "${AVAILABLE_FLAGS[@]}"; do
        echo "  - $flag"
    done
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 get enable_token_refresh"
    echo "  $0 enable enable_token_rotation"
    echo "  $0 disable enable_beta_features"
    echo "  $0 set enable_rate_limiting true staging"
    echo ""
}

# Check if Firebase CLI is available
check_firebase_cli() {
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI not found. Please install it first:"
        log_info "  npm install -g firebase-tools"
        exit 1
    fi
}

# Get Firebase project ID
get_project_id() {
    if [ "$ENVIRONMENT" == "production" ]; then
        echo "building-vitals-prod"
    else
        echo "building-vitals-staging"
    fi
}

# List all feature flags
list_flags() {
    log_info "Fetching feature flags from Firebase Remote Config..."

    PROJECT_ID=$(get_project_id)

    log_info "Project: $PROJECT_ID"
    log_info "Environment: $ENVIRONMENT"
    echo ""

    # Note: This requires Firebase Remote Config API access
    # For now, show available flags
    log_info "Available feature flags:"
    for flag in "${AVAILABLE_FLAGS[@]}"; do
        echo "  $flag"
    done
    echo ""
    log_warning "To get current values, use Firebase Console or API"
    log_info "Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID/config"
}

# Get specific feature flag
get_flag() {
    if [ -z "$FEATURE" ]; then
        log_error "Feature name required"
        show_help
        exit 1
    fi

    check_firebase_cli
    PROJECT_ID=$(get_project_id)

    log_info "Getting feature flag: $FEATURE"
    log_info "Project: $PROJECT_ID"

    # Using Firebase Remote Config API
    # Note: Requires authentication
    firebase remoteconfig:get --project "$PROJECT_ID" | \
        grep -A 5 "\"$FEATURE\"" || \
        log_warning "Feature flag not found or not set"
}

# Set feature flag
set_flag() {
    if [ -z "$FEATURE" ] || [ -z "$VALUE" ]; then
        log_error "Feature name and value required"
        show_help
        exit 1
    fi

    check_firebase_cli
    PROJECT_ID=$(get_project_id)

    # Validate feature name
    if [[ ! " ${AVAILABLE_FLAGS[@]} " =~ " ${FEATURE} " ]]; then
        log_warning "Unknown feature flag: $FEATURE"
        log_info "Available flags: ${AVAILABLE_FLAGS[*]}"
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Confirm change
    echo -e "${YELLOW}About to set feature flag:${NC}"
    log_info "  Feature: $FEATURE"
    log_info "  Value: $VALUE"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Project: $PROJECT_ID"
    echo ""
    read -p "Confirm? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Cancelled"
        exit 1
    fi

    log_info "Setting feature flag..."

    # Create temporary config file
    TEMP_CONFIG=$(mktemp)
    cat > "$TEMP_CONFIG" << EOF
{
  "parameters": {
    "$FEATURE": {
      "defaultValue": {
        "value": "$VALUE"
      },
      "description": "Feature flag for $FEATURE",
      "valueType": "BOOLEAN"
    }
  }
}
EOF

    # Update Remote Config
    # Note: This is a simplified example
    log_warning "Firebase Remote Config update requires manual process"
    log_info "Steps to update:"
    log_info "  1. Go to Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID/config"
    log_info "  2. Add/update parameter: $FEATURE"
    log_info "  3. Set value: $VALUE"
    log_info "  4. Publish changes"
    echo ""
    log_info "Or use Firebase Admin SDK/API"

    rm "$TEMP_CONFIG"
}

# Enable feature flag
enable_flag() {
    if [ -z "$FEATURE" ]; then
        log_error "Feature name required"
        show_help
        exit 1
    fi

    VALUE="true"
    set_flag
}

# Disable feature flag
disable_flag() {
    if [ -z "$FEATURE" ]; then
        log_error "Feature name required"
        show_help
        exit 1
    fi

    VALUE="false"
    set_flag
}

# Execute command
case $COMMAND in
    list)
        list_flags
        ;;
    get)
        get_flag
        ;;
    set)
        set_flag
        ;;
    enable)
        enable_flag
        ;;
    disable)
        disable_flag
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac

log_success "Operation complete!"
echo ""
