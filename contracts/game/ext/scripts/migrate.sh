#!/bin/bash

# =============================================================================
#          Eternum Game Contract Migration Script
# =============================================================================
#
# DESCRIPTION:
#   This script automates the build and deployment process for the game contracts
#   using sozo. 
#
# USAGE:
#   ./migrate.sh [OPTIONS]
#
# OPTIONS:
#   --profile <name>  Specify the deployment profile (default: "local")
#                     Common values: local, sepolia, mainnet
#   --world <addr>    Specify a world contract address to connect to
#                     If not specified, the default world addr will be used and printed
#
# EXAMPLES:
#   ./migrate.sh                          # Uses local profile
#   ./migrate.sh --profile sepolia        # Migrate to sepolia
#   ./migrate.sh --profile sepolia --world 0x1234...  # Connect to existing world
#
# PROCESS:
#   1. Builds all game contracts using 'sozo build'
#   2. Migrates (deploys) the contracts using 'sozo migrate'
#   3. Provides visual feedback throughout the process
#
# REQUIREMENTS:
#   - Sozo CLI tool must be installed and in PATH
#   - Proper configuration in Scarb.toml for the target profile
#
# =============================================================================



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

PROFILE="local"
WORLD_CONTRACT=""

# Color definitions
GREEN=$(echo -e '\033[0;32m')
BLUE=$(echo -e '\033[0;34m')
YELLOW=$(echo -e '\033[1;33m')
RED=$(echo -e '\033[0;31m')
BOLD=$(echo -e '\033[1m')
NC=$(echo -e '\033[0m') # No Color

#==============================================================================
# ARGUMENT PARSING
#==============================================================================

# Check if the "--profile" flag is provided
if [[ "$*" == *"--profile"* ]]; then
    for ((i=1; i<=$#; i++)); do
        if [[ "${!i}" == "--profile" ]] && [ $((i+1)) -le $# ]; then
            PROFILE="${!((i+1))}"
            break
        fi
    done
fi

# Check if the "--world" flag is provided
if [[ "$*" == *"--world"* ]]; then
    for ((i=1; i<=$#; i++)); do
        if [[ "${!i}" == "--world" ]] && [ $((i+1)) -le $# ]; then
            WORLD_CONTRACT="--world ${!((i+1))}"
            break
        fi
    done
fi

#==============================================================================
# CONTRACT COMPILATION
#==============================================================================

echo -e ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Game Contract Compilation                 ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo -e ""

echo -e "${YELLOW}► Building Game contracts with ${BOLD}${PROFILE}${YELLOW}"\
       "and world contract: ${BOLD}${WORLD_CONTRACT:-(unspecified)}${YELLOW}${NC}"
COMMAND="sozo build --profile $PROFILE $WORLD_CONTRACT"
echo -e ""
echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
echo -e ""
$COMMAND

#==============================================================================
# CONTRACT MIGRATION
#==============================================================================

echo -e ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                Game Contract Migration              ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo -e ""

echo -e "${YELLOW}► Migrating Game contracts with ${BOLD}${PROFILE}${YELLOW}"\
       "and world contract: ${BOLD}${WORLD_CONTRACT:-(unspecified)}${YELLOW}${NC}"
COMMAND="sozo migrate --profile $PROFILE $WORLD_CONTRACT"
echo -e ""
echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
echo -e ""
$COMMAND

echo -e ""
echo -e "${GREEN}✔ Migration completed successfully${NC}"
echo -e ""