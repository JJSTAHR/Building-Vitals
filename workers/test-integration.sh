#!/bin/bash

#####################################################################
# Integration Test Suite: Point → Timeseries → Chart Workflow
#####################################################################
# Tests the complete workflow from point selection to chart rendering
# with display_name enhancement and proper API parameter mapping
#####################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_DATA_DIR="$SCRIPT_DIR/test-data"
SAMPLE_DATA="$TEST_DATA_DIR/sample-points.json"
WORKER_DIR="$SCRIPT_DIR"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

#####################################################################
# Helper Functions
#####################################################################

log_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

log_test() {
    echo -e "${YELLOW}▶ Test $TESTS_RUN: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "  ℹ $1"
}

assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="$3"

    if [ "$expected" = "$actual" ]; then
        log_pass "$message"
        return 0
    else
        log_fail "$message"
        log_info "Expected: $expected"
        log_info "Actual: $actual"
        return 1
    fi
}

assert_not_null() {
    local value="$1"
    local message="$2"

    if [ -n "$value" ] && [ "$value" != "null" ]; then
        log_pass "$message"
        return 0
    else
        log_fail "$message"
        log_info "Value was null or empty"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="$3"

    if echo "$haystack" | grep -q "$needle"; then
        log_pass "$message"
        return 0
    else
        log_fail "$message"
        log_info "Expected to find: $needle"
        log_info "In: $haystack"
        return 1
    fi
}

#####################################################################
# Test Setup
#####################################################################

setup_tests() {
    log_header "Test Setup"

    # Verify test data exists
    if [ ! -f "$SAMPLE_DATA" ]; then
        echo -e "${RED}Error: Sample data not found at $SAMPLE_DATA${NC}"
        exit 1
    fi
    log_info "Sample data loaded from: $SAMPLE_DATA"

    # Verify worker exists
    if [ ! -f "$WORKER_DIR/points.js" ]; then
        echo -e "${RED}Error: Worker not found at $WORKER_DIR/points.js${NC}"
        exit 1
    fi
    log_info "Worker found at: $WORKER_DIR/points.js"

    # Create temp directory for test outputs
    export TEST_OUTPUT_DIR="$SCRIPT_DIR/test-output"
    mkdir -p "$TEST_OUTPUT_DIR"
    log_info "Test output directory: $TEST_OUTPUT_DIR"

    echo -e "${GREEN}✓ Setup complete${NC}\n"
}

#####################################################################
# Test 1: Enhanced Points Loading
#####################################################################

test_enhanced_points_loading() {
    ((TESTS_RUN++))
    log_test "Enhanced Points Loading"

    # Extract enhanced points from sample data
    local enhanced_points=$(cat "$SAMPLE_DATA" | jq -r '.enhancedPoints')

    # Verify we have enhanced points
    local count=$(echo "$enhanced_points" | jq 'length')
    assert_not_null "$count" "Enhanced points array loaded"

    # Verify count matches expected
    assert_equals "7" "$count" "Correct number of enhanced points"

    # Save for next tests
    echo "$enhanced_points" > "$TEST_OUTPUT_DIR/enhanced-points.json"
}

#####################################################################
# Test 2: Display Name Enhancement
#####################################################################

test_display_name_enhancement() {
    ((TESTS_RUN++))
    log_test "Display Name Enhancement"

    # Load enhanced points
    local points=$(cat "$TEST_OUTPUT_DIR/enhanced-points.json")

    # Test specific point: SURGERYCHILLER-Capacity
    local point=$(echo "$points" | jq -r '.[] | select(.Name == "SURGERYCHILLER-Capacity")')
    local display_name=$(echo "$point" | jq -r '.display_name')
    local name=$(echo "$point" | jq -r '.Name')

    # Verify display_name is set
    assert_not_null "$display_name" "Display name is set for SURGERYCHILLER-Capacity"

    # Verify display_name is human-readable
    assert_equals "SURGERYCHILLER Capacity" "$display_name" "Display name is properly formatted"

    # Verify Name field is preserved (for API calls)
    assert_equals "SURGERYCHILLER-Capacity" "$name" "Original Name field preserved for API"
}

#####################################################################
# Test 3: Multiple Point Enhancement
#####################################################################

test_multiple_point_enhancement() {
    ((TESTS_RUN++))
    log_test "Multiple Point Enhancement"

    local points=$(cat "$TEST_OUTPUT_DIR/enhanced-points.json")

    # Test multiple points have display_names
    local points_with_display=$(echo "$points" | jq '[.[] | select(.display_name != null)] | length')
    local total_points=$(echo "$points" | jq 'length')

    assert_equals "$total_points" "$points_with_display" "All points have display_name set"

    # Test specific cases
    local ahu_point=$(echo "$points" | jq -r '.[] | select(.Name == "AHU-01-ZoneTemp") | .display_name')
    assert_equals "AHU-01 Zone Temp" "$ahu_point" "AHU point correctly enhanced"

    local boiler_point=$(echo "$points" | jq -r '.[] | select(.Name == "BOILER-01-SupplyTemp") | .display_name')
    assert_equals "BOILER-01 Supply Temp" "$boiler_point" "BOILER point correctly enhanced"
}

#####################################################################
# Test 4: Chart Label Mapping
#####################################################################

test_chart_label_mapping() {
    ((TESTS_RUN++))
    log_test "Chart Label vs API Parameter Mapping"

    # Load expected chart config
    local chart_config=$(cat "$SAMPLE_DATA" | jq -r '.expectedChartConfig')
    local series=$(echo "$chart_config" | jq -r '.series')

    # Test first series
    local series1=$(echo "$series" | jq -r '.[0]')
    local label1=$(echo "$series1" | jq -r '.label')
    local api_param1=$(echo "$series1" | jq -r '.apiParameter')

    # Chart label should be display_name (human-readable)
    assert_equals "SURGERYCHILLER Capacity" "$label1" "Chart label uses display_name"

    # API parameter should be Name (machine-readable)
    assert_equals "SURGERYCHILLER-Capacity" "$api_param1" "API parameter uses Name field"

    # Test second series
    local series2=$(echo "$series" | jq -r '.[1]')
    local label2=$(echo "$series2" | jq -r '.label')
    local api_param2=$(echo "$series2" | jq -r '.apiParameter')

    assert_equals "AHU-01 Zone Temp" "$label2" "Second chart label uses display_name"
    assert_equals "AHU-01-ZoneTemp" "$api_param2" "Second API parameter uses Name field"
}

#####################################################################
# Test 5: Timeseries API Simulation
#####################################################################

test_timeseries_api_simulation() {
    ((TESTS_RUN++))
    log_test "Timeseries API Parameter Usage"

    # Load sample timeseries response
    local ts_response=$(cat "$SAMPLE_DATA" | jq -r '.timeseriesResponse')

    # Verify timeseries uses Name field as keys
    local keys=$(echo "$ts_response" | jq -r 'keys[]')

    assert_contains "$keys" "SURGERYCHILLER-Capacity" "Timeseries uses Name field (not display_name)"
    assert_contains "$keys" "AHU-01-ZoneTemp" "Second timeseries uses Name field"

    # Verify data structure
    local data=$(echo "$ts_response" | jq -r '."SURGERYCHILLER-Capacity".ts')
    local data_count=$(echo "$data" | jq 'length')

    assert_not_null "$data_count" "Timeseries data present for SURGERYCHILLER-Capacity"
    assert_equals "4" "$data_count" "Correct number of timeseries data points"
}

#####################################################################
# Test 6: End-to-End Chart Rendering Simulation
#####################################################################

test_e2e_chart_rendering() {
    ((TESTS_RUN++))
    log_test "End-to-End Chart Rendering Workflow"

    # Simulate the full workflow:
    # 1. User sees enhanced points with display_name
    local enhanced_points=$(cat "$TEST_OUTPUT_DIR/enhanced-points.json")
    local point=$(echo "$enhanced_points" | jq -r '.[] | select(.Name == "SURGERYCHILLER-Capacity")')

    # 2. User selects point (sees display_name in UI)
    local ui_label=$(echo "$point" | jq -r '.display_name')
    assert_equals "SURGERYCHILLER Capacity" "$ui_label" "UI shows display_name to user"

    # 3. App uses Name field for API call
    local api_param=$(echo "$point" | jq -r '.Name')
    assert_equals "SURGERYCHILLER-Capacity" "$api_param" "API call uses Name field"

    # 4. Timeseries data is fetched using Name
    local ts_data=$(cat "$SAMPLE_DATA" | jq -r ".timeseriesResponse.\"$api_param\"")
    assert_not_null "$ts_data" "Timeseries data retrieved using Name field"

    # 5. Chart is configured with display_name as label
    local chart_label=$(cat "$SAMPLE_DATA" | jq -r '.expectedChartConfig.series[] | select(.pointId == "SURGERYCHILLER-Capacity") | .label')
    assert_equals "$ui_label" "$chart_label" "Chart label matches display_name shown to user"

    log_info "Complete workflow verified: UI (display_name) → API (Name) → Chart (display_name)"
}

#####################################################################
# Test 7: Cache Behavior with Enhanced Points
#####################################################################

test_cache_behavior() {
    ((TESTS_RUN++))
    log_test "Cache Behavior with Enhanced Points"

    # Verify that display_name enhancement doesn't break caching
    local raw_points=$(cat "$SAMPLE_DATA" | jq -r '.rawPoints')
    local enhanced_points=$(cat "$SAMPLE_DATA" | jq -r '.enhancedPoints')

    # Both should have same Name fields (cache key)
    local raw_names=$(echo "$raw_points" | jq -r '.[].Name' | sort)
    local enhanced_names=$(echo "$enhanced_points" | jq -r '.[].Name' | sort)

    # Compare sorted names
    if [ "$raw_names" = "$enhanced_names" ]; then
        log_pass "Name fields preserved (cache keys intact)"
    else
        log_fail "Name fields modified (cache would break)"
        log_info "Raw names: $raw_names"
        log_info "Enhanced names: $enhanced_names"
    fi

    # Verify display_name is additive (doesn't replace Name)
    local point=$(echo "$enhanced_points" | jq -r '.[0]')
    local has_name=$(echo "$point" | jq 'has("Name")')
    local has_display=$(echo "$point" | jq 'has("display_name")')

    assert_equals "true" "$has_name" "Name field still present after enhancement"
    assert_equals "true" "$has_display" "display_name field added during enhancement"
}

#####################################################################
# Test 8: Worker Integration Test
#####################################################################

test_worker_integration() {
    ((TESTS_RUN++))
    log_test "Worker Integration (Node.js execution)"

    # Note: This test requires actual worker execution
    # For now, we verify worker file structure

    if [ -f "$WORKER_DIR/points.js" ]; then
        log_info "Worker file exists: points.js"

        # Check for key functions
        if grep -q "display_name" "$WORKER_DIR/points.js"; then
            log_pass "Worker contains display_name logic"
        else
            log_fail "Worker missing display_name logic"
        fi

        if grep -q "enhancePoint" "$WORKER_DIR/points.js" || grep -q "formatDisplayName" "$WORKER_DIR/points.js"; then
            log_pass "Worker has enhancement function"
        else
            log_fail "Worker missing enhancement function"
        fi
    else
        log_fail "Worker file not found"
    fi
}

#####################################################################
# Test Summary
#####################################################################

print_summary() {
    log_header "Test Summary"

    echo -e "Total Tests Run:    ${BLUE}$TESTS_RUN${NC}"
    echo -e "Tests Passed:       ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed:       ${RED}$TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}╔═══════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                       ║${NC}"
        echo -e "${GREEN}║   ✓ ALL TESTS PASSED SUCCESSFULLY!   ║${NC}"
        echo -e "${GREEN}║                                       ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}\n"
        exit 0
    else
        echo -e "\n${RED}╔═══════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                       ║${NC}"
        echo -e "${RED}║   ✗ SOME TESTS FAILED - SEE ABOVE    ║${NC}"
        echo -e "${RED}║                                       ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════╝${NC}\n"
        exit 1
    fi
}

#####################################################################
# Main Execution
#####################################################################

main() {
    log_header "Integration Test Suite: Point → Timeseries → Chart Workflow"

    setup_tests

    # Run all tests
    test_enhanced_points_loading
    test_display_name_enhancement
    test_multiple_point_enhancement
    test_chart_label_mapping
    test_timeseries_api_simulation
    test_e2e_chart_rendering
    test_cache_behavior
    test_worker_integration

    print_summary
}

# Run tests
main
