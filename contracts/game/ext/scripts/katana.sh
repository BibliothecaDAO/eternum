#!/bin/bash

# =============================================================================
# Katana Local Node Management Script
# =============================================================================
#
# DESCRIPTION:
#   This script manages a local Katana node instance for Starknet development.
#   Katana is a local development node for Starknet, similar to Ganache for
#   Ethereum. This script handles starting, stopping, and managing the node
#   with proper logging and process management.
#
#
# USAGE:
#   ./katana.sh         - Starts a new Katana node instance
#   ./katana.sh --kill  - Stops any running Katana instance
#
# CONFIGURATION:
#   The script starts Katana with the following settings:
#   - Maximum invoke steps: 25,000,000
#   - CORS: Enabled for all origins
#   - Block time: 2500ms (2.5 seconds)
#   - Dev mode: Enabled
#   - Transaction fees: Disabled
#   - Default port: 5050
#
# FILES:
#   - PID file: contracts/game/pids/katana.pid
#   - Log file: contracts/game/logs/katana.log
#
# REQUIREMENTS:
#   - Katana must be installed and available in PATH
#   - lsof command for port management
#   - Basic Unix commands (kill, sed, etc.)
#
# =============================================================================


# Import colors
source "$(dirname "$0")/colors.sh"

#==============================================================================
# ERROR HANDLING
#==============================================================================

set -e  # Exit on error
set -o pipefail  # Exit if any command in a pipe fails

error_handler() {
    echo -e "\n${RED}► Error: Command failed at line $1${NC}"
    exit 1
}

trap 'error_handler ${LINENO}' ERR

#==============================================================================
# CONFIGURATION
#==============================================================================

# File paths and ports
LOG_DIR="logs"
PID_DIR="pids"
LOG_FILE="$LOG_DIR/katana.log"
PID_FILE="$PID_DIR/katana.pid"
PORT=5050

# Katana settings
KATANA_MAX_INVOKE_STEPS=25000000 # 25,000,000

#==============================================================================
# UTILITY FUNCTIONS
#==============================================================================

# Function to check and free port
free_port() {
    if lsof -i :$PORT > /dev/null 2>&1; then
        echo -e "${YELLOW}► Port $PORT is in use. Attempting to free it...${NC}"
        # Get all PIDs and handle them one by one
        lsof -t -i :$PORT | while read -r PORT_PID; do
            if [ ! -z "$PORT_PID" ]; then
                echo -e "${RED}► Killing process using port $PORT (PID: ${BOLD}$PORT_PID${NC}${RED})${NC}"
                kill -9 "$PORT_PID"
            fi
        done
        sleep 1
    fi
}

# Function to stop existing Katana process
stop_katana() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${YELLOW}► Stopping existing Katana process (PID: ${BOLD}$OLD_PID${NC}${YELLOW})${NC}"
            kill "$OLD_PID"
            sleep 2
        fi
        rm "$PID_FILE"
    fi
}

# Function to handle log formatting
setup_log_handling() {
    sed -u \
        -e 's/\x1b\[2m//g' \
        -e 's/\x1b\[0m//g' \
        -e 's/\x1b\[32m//g' \
        -e 's/\x1b\[3m//g' \
        -e 's/\x1b\[31m//g' \
        -e 's/\x1b\[33m//g' \
        -e 's/\x1b\[34m//g' \
        -e 's/\x1b\[35m//g' \
        -e 's/\x1b\[36m//g' \
        -e 's/\x1b\[37m//g' \
        >> "$LOG_FILE" 2>&1
}

#==============================================================================
# MAIN EXECUTION
#==============================================================================

KATANA_VERSION=$(katana --version)
DISPLAY_TITLE="Starting up $KATANA_VERSION"
if [ "$1" == "--kill" ]; then
    DISPLAY_TITLE="Stopping Katana"
fi

echo -e ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          $DISPLAY_TITLE                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e ""

# Create required directories if they don't exist
mkdir -p $PID_DIR $LOG_DIR

# Add kill-only functionality
if [ "$1" == "--kill" ]; then
    if [ -f "$PID_FILE" ]; then
        stop_katana
        free_port
        echo -e "${GREEN}✔ Katana stopped successfully${NC}"
    else
        echo -e "${YELLOW}► No Katana process found (no PID file)${NC}"
    fi
    exit 0
fi

#==============================================================================
# KATANA STARTUP
#==============================================================================

# Stop any existing Katana process
stop_katana

# Free port if in use
free_port

# Delete existing log file
if [ -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}► Removing existing log file${NC}"
    rm "$LOG_FILE"
fi

# Run katana in the background with log handling
katana --invoke-max-steps $KATANA_MAX_INVOKE_STEPS \
    --http.cors_origins "*" \
    --explorer \
    --cartridge.paymaster \
    --dev \
    --dev.no-fee > >(setup_log_handling) 2>&1 &

# Store the PID
echo $! > "$PID_FILE"
echo -e "${GREEN}✔ Katana started with PID: ${BOLD}$(cat $PID_FILE)${NC}"
echo -e "${GREEN}✔ PID file: contracts/game/${BOLD}$PID_FILE${NC}"
echo -e "${GREEN}✔ Log file: contracts/game/${BOLD}$LOG_FILE${NC}"
echo -e ""