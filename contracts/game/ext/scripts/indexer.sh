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
#   ./indexer.sh [options]
#
# OPTIONS:
#   --kill                    Stops any running indexer instance
#   --world <world_address>   Starts indexer with custom world address
#   --rpc <url>              Sets custom RPC URL
#   --network <name>         Sets network name (default: local)
#   --help                   Shows usage information
#
# CONFIGURATION:
#   The script starts Torii with the following default settings:
#   - RPC URL: http://localhost:8080
#   - Network: local
#   - Config file: torii-<network>.toml
#
# FILES:
#   - PID file: contracts/game/pids/indexer.<network>.pid
#   - Log file: contracts/game/logs/indexer.<network>.log
#   - Database: contracts/game/torii-<network>.db
#
# EXAMPLES:
#   Start with default settings:
#     ./indexer.sh
#
#   Start with custom settings:
#     ./indexer.sh --world 0x123... --rpc http://localhost:8080 --network local
#
#   Stop specific network instance:
#     ./indexer.sh --kill --network local
#
# =============================================================================

#==============================================================================
# ERROR HANDLING
#==============================================================================

# Import colors
source "$(dirname "$0")/colors.sh"

set -e          # Exit on error
set -o pipefail # Exit if any command in a pipe fails

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
DEFAULT_NETWORK="local" # just a name when saving log and pid files
NETWORK=${NETWORK:-$DEFAULT_NETWORK}
LOG_FILE="$LOG_DIR/indexer.$NETWORK.log"
PID_FILE="$PID_DIR/indexer.$NETWORK.pid"
DB_DIR="torii-$NETWORK"
TORII_CONFIG="torii-$NETWORK.toml"

# Torii settings
DEFAULT_RPC_URL="http://localhost:8080"
WORLD_ADDRESS=""  # Will be overridden by args if provided
RPC_URL=${RPC_URL:-$DEFAULT_RPC_URL}  # Use env var or default
PORT=8080

#==============================================================================
# ARGUMENT PARSING
#==============================================================================

print_usage() {
  echo -e "${BLUE}Usage:${NC}"
  echo -e "  ./indexer.sh [options]"
  echo -e ""
  echo -e "${BLUE}Options:${NC}"
  echo -e "  --kill              Stop the running indexer instance"
  echo -e "  --world <address>   Set the World contract address"
  echo -e "  --rpc <url>        Set the RPC URL"
  echo -e "  --network <name>    Set the network name (default: devnet)"
  echo -e "  --help             Show this help message"
  echo -e ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  --kill)
    KILL_MODE=true
    shift
    ;;
  --world)
    if [[ -z "$2" || "$2" == --* ]]; then
      echo -e "${RED}► Error: World address must be provided with --world flag${NC}"
      exit 1
    fi
    WORLD_ADDRESS="$2"
    shift 2
    ;;
  --rpc)
    if [[ -z "$2" || "$2" == --* ]]; then
      echo -e "${RED}► Error: RPC URL must be provided with --rpc flag${NC}"
      exit 1
    fi
    RPC_URL="$2"
    shift 2
    ;;
  --network)
    if [[ -z "$2" || "$2" == --* ]]; then
      echo -e "${RED}► Error: Network name must be provided with --network flag${NC}"
      exit 1
    fi
    NETWORK="$2"
    LOG_FILE="$LOG_DIR/indexer.$NETWORK.log"
    PID_FILE="$PID_DIR/indexer.$NETWORK.pid"
    shift 2
    ;;
  --help)
    print_usage
    exit 0
    ;;
  *)
    echo -e "${RED}► Error: Unknown option: $1${NC}"
    print_usage
    exit 1
    ;;
  esac
done

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
    >>"$LOG_FILE" 2>&1
}

# Function to check and free port
free_port() {
  if lsof -i :$PORT >/dev/null 2>&1; then
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

DISPLAY_TITLE="Starting up Torii Indexer"
if [ "$KILL_MODE" = true ]; then
  DISPLAY_TITLE="Stopping Torii Indexer"
fi

TORII_VERSION=$(torii --version)

echo -e ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                $DISPLAY_TITLE $TORII_VERSION                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e ""

# Create required directories if they don't exist
mkdir -p $PID_DIR $LOG_DIR

# Handle kill mode
if [ "$KILL_MODE" = true ]; then
  if [ -f "$PID_FILE" ]; then
    free_port
    stop_indexer
    echo -e "${GREEN}✔ Indexer stopped successfully${NC}"
  else
    echo -e "${YELLOW}► No indexer process found (no PID file)${NC}"
  fi
  exit 0
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

# Prepare base command
TORII_CMD="torii --config $TORII_CONFIG"

# Add world address if provided
if [ -n "$WORLD_ADDRESS" ]; then
    TORII_CMD="$TORII_CMD --world $WORLD_ADDRESS"
fi

# Add RPC URL if not using localhost
if [ "$RPC_URL" != "http://localhost:8080" ] && [ "$RPC_URL" != "http://127.0.0.1:8080" ]; then
    TORII_CMD="$TORII_CMD --rpc $RPC_URL"
fi

# Execute with logging
$TORII_CMD > >(setup_log_handling) 2>&1 &

# Store the PID
echo $! >"$PID_FILE"

# Wait briefly and check if process is still running
sleep 2
if ! kill -0 $(cat "$PID_FILE") 2>/dev/null; then
  echo -e "${RED}► Indexer failed to start. Error from log:${NC}"
  tail -n 5 "$LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

echo -e "${GREEN}✔ Indexer started with PID: ${BOLD}$(cat $PID_FILE)${NC}"
echo -e "${GREEN}✔ PID file: contracts/game/${BOLD}$PID_FILE${NC}"
echo -e "${GREEN}✔ Log file: contracts/game/${BOLD}$LOG_FILE${NC}"
echo -e ""

echo -e "${GREEN}✔ torii indexer started successfully at ${BLUE}http://localhost:${PORT}${NC}"
echo -e ""

