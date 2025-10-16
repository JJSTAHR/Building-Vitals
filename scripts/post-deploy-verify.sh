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
echo -e "${BLUE}  Post-Deployment Verification${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

URL=${1:-https://buildingvitals.com}
MAX_RETRIES=5
RETRY_DELAY=10

log_info "Target URL: $URL"
echo ""

# Health check with retries
log_info "Checking application health..."
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo "000")

    if [ "$HTTP_STATUS" -eq 200 ]; then
        log_success "Application is responding (HTTP $HTTP_STATUS)"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            log_warning "Application returned HTTP $HTTP_STATUS, retrying in ${RETRY_DELAY}s (attempt $RETRY_COUNT/$MAX_RETRIES)"
            sleep $RETRY_DELAY
        else
            log_error "Application not responding after $MAX_RETRIES attempts (HTTP $HTTP_STATUS)"
            exit 1
        fi
    fi
done

# Check response time
log_info "Checking response time..."
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$URL")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d'.' -f1)
log_info "Response time: ${RESPONSE_TIME_MS}ms"

if [ "$RESPONSE_TIME_MS" -lt 1000 ]; then
    log_success "Response time is good"
elif [ "$RESPONSE_TIME_MS" -lt 3000 ]; then
    log_warning "Response time is acceptable but could be improved"
else
    log_warning "Response time is slow (>${RESPONSE_TIME_MS}ms)"
fi

# Check for common pages
log_info "Checking critical pages..."
PAGES=("/" "/login" "/dashboard")
for page in "${PAGES[@]}"; do
    PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL$page")
    if [ "$PAGE_STATUS" -eq 200 ] || [ "$PAGE_STATUS" -eq 302 ]; then
        log_success "Page accessible: $page (HTTP $PAGE_STATUS)"
    else
        log_error "Page not accessible: $page (HTTP $PAGE_STATUS)"
        exit 1
    fi
done

# Check for required static assets
log_info "Checking static assets..."
ASSETS=("/assets/index.js" "/assets/index.css")
for asset in "${ASSETS[@]}"; do
    ASSET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL$asset" || echo "000")
    if [ "$ASSET_STATUS" -eq 200 ]; then
        log_success "Asset found: $asset"
    else
        log_warning "Asset not found: $asset (HTTP $ASSET_STATUS)"
    fi
done

# Check Content-Type headers
log_info "Checking Content-Type headers..."
CONTENT_TYPE=$(curl -s -I "$URL" | grep -i "content-type:" | cut -d' ' -f2- | tr -d '\r\n')
log_info "Content-Type: $CONTENT_TYPE"

if [[ $CONTENT_TYPE == *"text/html"* ]]; then
    log_success "Content-Type is correct"
else
    log_warning "Unexpected Content-Type: $CONTENT_TYPE"
fi

# Check for security headers
log_info "Checking security headers..."
HEADERS=$(curl -s -I "$URL")

check_header() {
    HEADER_NAME=$1
    if echo "$HEADERS" | grep -qi "$HEADER_NAME:"; then
        HEADER_VALUE=$(echo "$HEADERS" | grep -i "$HEADER_NAME:" | cut -d' ' -f2- | tr -d '\r\n')
        log_success "Security header present: $HEADER_NAME: $HEADER_VALUE"
    else
        log_warning "Security header missing: $HEADER_NAME"
    fi
}

check_header "X-Content-Type-Options"
check_header "X-Frame-Options"
check_header "X-XSS-Protection"
check_header "Strict-Transport-Security"
check_header "Content-Security-Policy"

# Check SSL certificate
log_info "Checking SSL certificate..."
if [[ $URL == https://* ]]; then
    SSL_EXPIRY=$(echo | openssl s_client -servername "${URL#https://}" -connect "${URL#https://}":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$SSL_EXPIRY" ]; then
        log_success "SSL certificate valid until: $SSL_EXPIRY"
    else
        log_warning "Could not verify SSL certificate"
    fi
else
    log_warning "URL is not HTTPS"
fi

# Check Firestore security rules (if firebase CLI available)
if command -v firebase &> /dev/null; then
    log_info "Verifying Firestore security rules..."
    if firebase firestore:rules:check 2>/dev/null; then
        log_success "Firestore security rules are valid"
    else
        log_warning "Could not verify Firestore security rules"
    fi
else
    log_warning "Firebase CLI not available, skipping Firestore checks"
fi

# Check for console errors (basic check)
log_info "Checking for JavaScript errors..."
PAGE_CONTENT=$(curl -s "$URL")
if echo "$PAGE_CONTENT" | grep -qi "error\|exception\|undefined is not"; then
    log_warning "Potential JavaScript errors detected in page content"
else
    log_success "No obvious JavaScript errors detected"
fi

# Performance metrics
log_info "Collecting performance metrics..."
METRICS=$(curl -o /dev/null -s -w "\nDNS lookup: %{time_namelookup}s\nTCP connect: %{time_connect}s\nSSL handshake: %{time_appconnect}s\nTransfer start: %{time_starttransfer}s\nTotal time: %{time_total}s\nSize: %{size_download} bytes\n" "$URL")
echo "$METRICS"

# Check API endpoints (if available)
log_info "Testing API health endpoint..."
API_HEALTH=$(curl -s "$URL/api/health" 2>/dev/null || echo '{"status":"endpoint_not_found"}')
if echo "$API_HEALTH" | grep -q "ok\|healthy"; then
    log_success "API health check passed"
else
    log_warning "API health endpoint not available or unhealthy"
fi

# Final summary
echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  Verification Summary${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
log_success "All critical verifications passed!"
echo ""
log_info "Next steps:"
log_info "  1. Test user authentication flows"
log_info "  2. Verify token management functionality"
log_info "  3. Check Firebase Analytics dashboard"
log_info "  4. Monitor error logs for 30 minutes"
log_info "  5. Perform manual QA spot checks"
echo ""
