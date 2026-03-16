#!/bin/bash
#
# test-scale.sh - Validate KEDA HTTPScaledObject scale-from-zero behavior
#
# This script tests that the Identity Service (and other services) can scale
# from 0 to 1 replica when traffic arrives, without deadlocking on the health
# check that was present in the old ScaledObject configuration.
#
# Prerequisites:
# - kubectl configured to access your cluster
# - HTTPScaledObjects deployed in openclaw-local namespace
# - KEDA HTTP add-on installed (provides HTTPScaledObject CRD + interceptor proxy)
# - Ingress configured with keda-add-ons-http-interceptor-proxy as backend
# - DNS/hosts configured for *.openclaw.local hostnames

set -e

# Configuration
NAMESPACE="openclaw-local"
SERVICE="identity-service"
HOST="identity.openclaw.local"
MAX_WAIT_SECONDS=180
CHECK_INTERVAL_SECONDS=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_blue() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first."
        exit 1
    fi

    # Check curl
    if ! command -v curl &> /dev/null; then
        log_error "curl not found. Please install curl first."
        exit 1
    fi

    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace '$NAMESPACE' does not exist."
        exit 1
    fi

    # Check HTTPScaledObject exists
    if ! kubectl get httpscaledobject "$SERVICE" -n "$NAMESPACE" &> /dev/null; then
        log_error "HTTPScaledObject '$SERVICE' not found in namespace '$NAMESPACE'."
        log_warn "Make sure you've deployed the HTTPScaledObjects first:"
        log_warn "  kubectl apply -f httpscaledobjects.yaml -n $NAMESPACE"
        exit 1
    fi

    # Check KEDA HTTP add-on interceptor proxy exists in keda namespace
    if ! kubectl get deployment keda-http-add-on-interceptor -n keda &> /dev/null; then
        log_warn "KEDA HTTP add-on interceptor not found in 'keda' namespace."
        log_warn "Make sure KEDA HTTP add-on is installed:"
        log_warn "  helm install keda-http kedacore/http-add-on -n keda --create-namespace"
        log_warn "Continuing anyway..."
    fi

    log_info "Prerequisites check passed!"
}

# Get current pod count for service
get_pod_count() {
    kubectl get pods -n "$NAMESPACE" -l "app=$SERVICE" --no-headers 2>/dev/null | wc -l
}

# Get running pod count (not Pending)
get_running_pod_count() {
    kubectl get pods -n "$NAMESPACE" -l "app=$SERVICE" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l
}

# Get pod status
get_pod_status() {
    kubectl get pods -n "$NAMESPACE" -l "app=$SERVICE" -o wide 2>/dev/null || echo "No pods found"
}

# Get HTTPScaledObject status
get_httpscaledobject_status() {
    kubectl get httpscaledobject "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.status}' 2>/dev/null | jq . || echo "No status available"
}

# Wait for service to have at least one running pod
wait_for_scale_up() {
    local start_time=$(date +%s)
    
    log_info "Waiting for service to scale up (max ${MAX_WAIT_SECONDS}s)..."
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local running_count=$(get_running_pod_count)
        local total_count=$(get_pod_count)
        
        echo -ne "\r  Pods: ${running_count} running / ${total_count} total (${elapsed}s elapsed)   "
        
        if [ "$running_count" -gt 0 ]; then
            echo ""
            log_info "Service has scaled up! Found ${running_count} running pod(s)."
            return 0
        fi
        
        if [ "$elapsed" -ge "$MAX_WAIT_SECONDS" ]; then
            echo ""
            log_error "Timeout waiting for service to scale up after ${MAX_WAIT_SECONDS}s."
            return 1
        fi
        
        sleep "$CHECK_INTERVAL_SECONDS"
    done
}

# Test the endpoint - retry until success or timeout
test_endpoint() {
    log_info "Testing endpoint: http://$HOST/health"
    log_info "The interceptor will queue this request while the service scales up..."
    echo ""
    
    local max_attempts=60
    local attempt=0
    local success=false
    local start_time=$(date +%s)
    
    while [ "$attempt" -lt "$max_attempts" ]; do
        attempt=$((attempt + 1))
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # Make request with timeout
        # Using -H "Host: $HOST" to route to the correct service
        response=$(curl -s -o /tmp/curl_response.txt -w "%{http_code}" \
            --connect-timeout 5 \
            --max-time 30 \
            -H "Host: $HOST" \
            "http://localhost/health" 2>/dev/null || echo "000")
        
        echo -ne "\r  Attempt ${attempt}/${max_attempts} (t=${elapsed}s): HTTP ${response}     "
        
        if [ "$response" = "200" ]; then
            echo ""
            log_info "SUCCESS! Endpoint returned HTTP 200."
            success=true
            break
        elif [ "$response" = "503" ]; then
            # 503 means no backend available - interceptor not set up or service not reachable
            sleep 1
        elif [ "$response" = "000" ]; then
            # Connection failed - likely no ingress or routing issue
            sleep 2
        else
            sleep "$CHECK_INTERVAL_SECONDS"
        fi
    done
    
    if [ "$success" = true ]; then
        return 0
    else
        echo ""
        log_error "Failed to get successful response after ${max_attempts} attempts."
        return 1
    fi
}

# Watch pods during test
watch_pods() {
    log_info "Starting pod watch (will auto-stop after ${MAX_WAIT_SECONDS}s)..."
    log_info "Monitoring: kubectl get pods -n $NAMESPACE -l app=$SERVICE"
    echo ""
    
    kubectl get pods -n "$NAMESPACE" -l "app=$SERVICE" -w 2>/dev/null &
    echo $! > /tmp/pod_watch.pid
}

# Stop watching pods
stop_watching() {
    if [ -f /tmp/pod_watch.pid ]; then
        kill $(cat /tmp/pod_watch.pid) 2>/dev/null || true
        rm -f /tmp/pod_watch.pid
    fi
}

# Display current state
show_current_state() {
    log_info "Current state of $NAMESPACE namespace:"
    echo ""
    echo "=== Pods for $SERVICE ==="
    get_pod_status
    echo ""
    echo "=== HTTPScaledObject Status ==="
    get_httpscaledobject_status
    echo ""
    echo "=== KEDA ScaledObjects (created by HTTPScaledObject controller) ==="
    kubectl get scaledobjects -n "$NAMESPACE" -l "app=$SERVICE" 2>/dev/null || echo "No ScaledObjects found"
    echo ""
}

# Main test function
run_test() {
    log_info "============================================================"
    log_info "  KEDA HTTPScaledObject Scale-from-Zero Test"
    log_info "============================================================"
    log_info ""
    log_info "Service: $SERVICE"
    log_info "Host: $HOST"
    log_info "Namespace: $NAMESPACE"
    log_info "Max wait time: ${MAX_WAIT_SECONDS}s"
    log_info ""
    
    # Show initial state
    log_info "=== Initial State ==="
    show_current_state
    
    # Check if service is already scaled up
    local initial_count=$(get_running_pod_count)
    if [ "$initial_count" -gt 0 ]; then
        log_warn "Service already has ${initial_count} running pod(s)."
        log_warn "To test scale-from-zero, scale down first:"
        log_warn "  kubectl scale deployment $SERVICE -n $NAMESPACE --replicas=0"
        echo ""
        read -p "Press Enter to continue anyway (will test endpoint as-is)..."
    fi
    
    echo ""
    log_info "=== Starting Test ==="
    echo ""
    
    # Start watching pods in background
    watch_pods
    
    # Give watch time to start
    sleep 1
    
    # Test the endpoint (this triggers the scale)
    test_endpoint
    local result=$?
    
    # Stop watching
    stop_watching
    
    echo ""
    log_info "=== Final State ==="
    show_current_state
    
    if [ $result -eq 0 ]; then
        log_info ""
        log_info "============================================================"
        log_info "  TEST PASSED!"
        log_info "  The service successfully responded to the request."
        log_info "============================================================"
    else
        log_error ""
        log_error "============================================================"
        log_error "  TEST FAILED!"
        log_error "  The service did not respond successfully."
        log_error "============================================================"
        log_info ""
        log_info "Troubleshooting:"
        log_info "1. Check Ingress configuration:"
        log_info "   kubectl describe ingress openclaw-services-ingress -n $NAMESPACE"
        log_info "2. Check Ingress controller logs"
        log_info "3. Check that keda-add-ons-http-interceptor-proxy is running in 'keda' namespace"
        log_info "4. Verify /etc/hosts entry for $HOST points to Ingress controller"
    fi
    
    return $result
}

# Cleanup function
cleanup() {
    log_info ""
    log_info "Cleaning up..."
    stop_watching
    rm -f /tmp/curl_response.txt
}

# Trap for cleanup
trap cleanup EXIT

# Parse arguments
SCALE_ONLY=false
WATCH_ONLY=false
SHOW_STATUS=false
SERVICE_ARG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            SERVICE_ARG="$2"
            shift 2
            ;;
        --scale-only)
            SCALE_ONLY=true
            shift
            ;;
        --watch)
            WATCH_ONLY=true
            shift
            ;;
        --status)
            SHOW_STATUS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Test KEDA HTTPScaledObject scale-from-zero behavior."
            echo ""
            echo "Options:"
            echo "  --service SERVICE   Test a different service (default: identity-service)"
            echo "  --scale-only        Only trigger scale-up, don't wait for response"
            echo "  --watch             Only watch pods, don't trigger requests"
            echo "  --status            Show current status and exit"
            echo "  --help              Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --service tenant-service"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Override service if specified
if [ -n "$SERVICE_ARG" ]; then
    SERVICE="$SERVICE_ARG"
    # Map service to hostname
    case "$SERVICE" in
        identity-service) HOST="identity.openclaw.local" ;;
        tenant-service) HOST="tenant.openclaw.local" ;;
        policy-service) HOST="policy.openclaw.local" ;;
        channel-ingress-service) HOST="channel-ingress.openclaw.local" ;;
        orchestration-service) HOST="orchestration.openclaw.local" ;;
        skill-control-service) HOST="skill-control.openclaw.local" ;;
        skill-runtime-service) HOST="skill-runtime.openclaw.local" ;;
        conversation-service) HOST="conversation.openclaw.local" ;;
        onboarding-service) HOST="onboarding.openclaw.local" ;;
        enterprise-portal) HOST="enterprise.openclaw.local" ;;
    esac
fi

# Main execution
check_prerequisites

if [ "$SHOW_STATUS" = true ]; then
    show_current_state
    exit 0
fi

if [ "$WATCH_ONLY" = true ]; then
    watch_pods
    sleep infinity &
    wait $!
fi

if [ "$SCALE_ONLY" = true ]; then
    log_info "Sending request to trigger scale-up: http://$HOST/health"
    curl -s -H "Host: $HOST" "http://localhost/health" > /dev/null 2>&1 || true
    log_info "Request sent. Monitor pods with:"
    log_info "  kubectl get pods -n $NAMESPACE -l app=$SERVICE -w"
    exit 0
fi

run_test