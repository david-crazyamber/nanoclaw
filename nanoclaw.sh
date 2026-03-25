#!/bin/bash
#
# NanoClaw Service Management Script
# Usage: ./nanoclaw.sh {start|stop|restart|status|logs|build|login}
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.nanoclaw.plist"
LOG_DIR="$SCRIPT_DIR/logs"
SERVICE_NAME="com.nanoclaw"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}=== NanoClaw: $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

is_macos() {
    [[ "$(uname)" == "Darwin" ]]
}

is_linux() {
    [[ "$(uname)" == "Linux" ]]
}

service_status() {
    print_status "Service Status"

    if is_macos; then
        # Get PID using pgrep for the node process
        local pid=$(pgrep -f "node.*dist/index.js" 2>/dev/null | head -1)

        if [[ -n "$pid" ]]; then
            print_success "Running (PID: $pid)"
        elif [[ -f "$PLIST_PATH" ]]; then
            print_warning "Loaded but not running"
        else
            print_warning "Not loaded"
        fi
    elif is_linux; then
        systemctl --user is-active nanoclaw 2>/dev/null && print_success "Running" || print_warning "Not running"
    fi

    # Check port
    if lsof -i :3001 >/dev/null 2>&1; then
        local port_pid=$(lsof -t -i :3001 2>/dev/null)
        echo -e "Port 3001: ${GREEN}In use${NC} (PID: $port_pid)"
    else
        echo -e "Port 3001: ${YELLOW}Not in use${NC}"
    fi
}

start_service() {
    print_status "Starting Service"

    if is_macos; then
        if [[ -f "$PLIST_PATH" ]]; then
            launchctl load "$PLIST_PATH" 2>/dev/null || true
            sleep 2
            service_status
        else
            print_error "Plist not found. Run setup first."
            exit 1
        fi
    elif is_linux; then
        systemctl --user start nanoclaw
        print_success "Service started"
    fi
}

stop_service() {
    print_status "Stopping Service"

    if is_macos; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true

        # Kill any orphan processes on port 3001
        local pid=$(lsof -t -i :3001 2>/dev/null)
        if [[ -n "$pid" ]]; then
            print_warning "Killing orphan process (PID: $pid)"
            kill "$pid" 2>/dev/null || true
        fi

        print_success "Service stopped"
    elif is_linux; then
        systemctl --user stop nanoclaw
        print_success "Service stopped"
    fi
}

restart_service() {
    print_status "Restarting Service"
    stop_service
    sleep 1
    start_service
}

view_logs() {
    local lines=${1:-50}
    local follow=${2:-false}

    print_status "Logs"

    if [[ "$follow" == "true" ]]; then
        echo "Following logs (Ctrl+C to exit)..."
        tail -f "$LOG_DIR/nanoclaw.log" 2>/dev/null || tail -f "$LOG_DIR/nanoclaw.log"
    else
        echo "Last $lines lines:"
        tail -n "$lines" "$LOG_DIR/nanoclaw.log" 2>/dev/null || echo "No logs yet"
    fi
}

view_error_logs() {
    print_status "Error Logs"
    tail -50 "$LOG_DIR/nanoclaw.error.log" 2>/dev/null || echo "No error logs"
}

build_project() {
    print_status "Building Project"

    cd "$SCRIPT_DIR"
    npm run build

    print_success "Build complete"
}

build_container() {
    print_status "Building Container"

    cd "$SCRIPT_DIR/container"
    ./build.sh

    print_success "Container built"
}

weixin_login() {
    print_status "WeChat Login"

    cd "$SCRIPT_DIR"
    npx tsx scripts/weixin-login.ts
}

dev_mode() {
    print_status "Development Mode"

    echo "Stopping service first..."
    stop_service

    echo ""
    echo "Starting in development mode (Ctrl+C to exit)..."
    echo ""

    cd "$SCRIPT_DIR"
    npm run dev
}

show_help() {
    echo "
NanoClaw Service Management

Usage: $0 <command> [options]

Commands:
  start       Start the NanoClaw service
  stop        Stop the NanoClaw service
  restart     Restart the NanoClaw service
  status      Show service status
  logs        View recent logs (default: 50 lines)
              Options: $0 logs [lines] [--follow|-f]
  errors      View error logs
  build       Build the TypeScript project
  container   Rebuild the Docker container
  login       Run WeChat login script
  dev         Run in development mode (stops service first)
  help        Show this help message

Examples:
  $0 start
  $0 logs 100
  $0 logs -f          # Follow logs
  $0 restart
  $0 dev
"
}

# Main
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        service_status
        ;;
    logs)
        if [[ "${2:-}" == "-f" || "${2:-}" == "--follow" ]]; then
            view_logs 50 true
        elif [[ "${3:-}" == "-f" || "${3:-}" == "--follow" ]]; then
            view_logs "${2:-50}" true
        else
            view_logs "${2:-50}" false
        fi
        ;;
    errors|error)
        view_error_logs
        ;;
    build)
        build_project
        ;;
    container)
        build_container
        ;;
    login|weixin)
        weixin_login
        ;;
    dev)
        dev_mode
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        show_help
        exit 1
        ;;
esac
