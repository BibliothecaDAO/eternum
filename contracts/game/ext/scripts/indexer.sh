#!/bin/bash

# =============================================================================
# Torii Indexer Management Script
# =============================================================================
#
# DESCRIPTION:
#   This script manages a Torii indexer instance for Starknet development.
#   Torii is an indexer that helps query and index Starknet blockchain data.
#   This script handles starting and managing the indexer with proper logging
#   and process management.
#
# USAGE:
#   ./indexer.sh                          - Starts a new Torii indexer instance
#   ./indexer.sh --kill                   - Stops any running indexer instance
#   ./indexer.sh --world <world_address>  - Starts indexer with custom world address
#
# CONFIGURATION:
#   The script starts Torii with the following settings:
#   - Default World address: 0x6a9e4c6f0799160ea8ddc43ff982a5f83d7f633e9732ce42701de1288ff705f
#   - CORS: Enabled for all origins
#   - Config file: torii.toml
#
# FILES:
#   - PID file: ./pids/indexer.pid
#   - Log file: ./logs/indexer.log
#   - Database: ./torii-db
#
# REQUIREMENTS:
#   - Torii must be installed and available in PATH
#   - Basic Unix commands
#
# EXAMPLES:
#   Start with default settings:
#     ./indexer.sh
#
#   Start with custom world address:
#     ./indexer.sh --world 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
#
#   Stop running instance:
#     ./indexer.sh --kill
#
# =============================================================================

#==============================================================================
# ERROR HANDLING
#==============================================================================

# Import colors
source "$(dirname "$0")/colors.sh"


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

# File paths
LOG_DIR="logs"
PID_DIR="pids"
LOG_FILE="$LOG_DIR/indexer.log"
PID_FILE="$PID_DIR/indexer.pid"
DB_DIR="torii-db"

# Torii settings
DEFAULT_WORLD_ADDRESS="0x6a9e4c6f0799160ea8ddc43ff982a5f83d7f633e9732ce42701de1288ff705f"
WORLD_ADDRESS=${2:-$DEFAULT_WORLD_ADDRESS}  # Use provided address or default
PORT=8080  # Default Torii port


#==============================================================================
# UTILITY FUNCTIONS
#==============================================================================

# Function to stop existing indexer process
stop_indexer() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${YELLOW}► Stopping existing Torii indexer process (PID: ${BOLD}$OLD_PID${NC}${YELLOW})${NC}"
            kill "$OLD_PID"
            sleep 2
        fi
        rm "$PID_FILE"
    fi
}

# Function to handle log formatting
setup_log_handling() {
    sed -u \
        -e 's/\x1b\[[0-9;]*m//g' \
        >> "$LOG_FILE" 2>&1
}

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

#==============================================================================
# MAIN EXECUTION
#==============================================================================

echo -e ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                Starting up Torii Indexer                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e ""

# Create required directories if they don't exist
mkdir -p $PID_DIR $LOG_DIR

# Handle command line arguments
if [ "$1" == "--kill" ]; then
    if [ -f "$PID_FILE" ]; then
        stop_indexer
        echo -e "${GREEN}✔ Indexer stopped successfully${NC}"
    else
        echo -e "${YELLOW}► No indexer process found (no PID file)${NC}"
    fi
    exit 0
elif [ "$1" == "--world" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}► Error: World address must be provided with --world flag${NC}"
        exit 1
    fi
    WORLD_ADDRESS="$2"
fi

#==============================================================================
# INDEXER STARTUP
#==============================================================================

# Stop any existing indexer process
stop_indexer

# Free up the port if it's in use
free_port

# Clean up existing database
if [ -d "$DB_DIR" ]; then
    echo -e "${YELLOW}► Removing existing database${NC}"
    rm -rf "$DB_DIR"
fi

# Delete existing log file
if [ -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}► Removing existing log file${NC}"
    rm "$LOG_FILE"
fi

# Run torii in the background with log handling
echo -e ""
echo -e "${GREEN}Starting Torii Indexer with world address: ${BOLD}${BLUE}$WORLD_ADDRESS${NC}"
echo -e ""
torii --world $WORLD_ADDRESS \
    --http.cors_origins "*" \
    --config torii.toml 2>&1 | setup_log_handling &

# Store the PID
echo $! > "$PID_FILE"

# Wait briefly and check if process is still running
sleep 2
if ! kill -0 $(cat "$PID_FILE") 2>/dev/null; then
    echo -e "${RED}► Indexer failed to start. Error from log:${NC}"
    tail -n 5 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi

echo -e "${GREEN}✔ Indexer started with PID: ${BOLD}$(cat $PID_FILE)${NC}"
echo -e "${GREEN}✔ PID file: ${BOLD}$PID_FILE${NC}"
echo -e "${GREEN}✔ Log file: ${BOLD}$LOG_FILE${NC}"
echo -e ""

echo -e "${GREEN}✔ torii indexer started successfully${NC}"
echo -e ""