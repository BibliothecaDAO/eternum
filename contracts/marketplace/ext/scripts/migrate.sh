#!/bin/bash

# =============================================================================
#          SeasonPass Marketplace Contract Migration Script
# =============================================================================
#
# DESCRIPTION:
#   This script automates the build and deployment process for the marketplace contracts
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

PROFILE="local"
WORLD_CONTRACT=""

#==============================================================================
# ARGUMENT PARSING
#==============================================================================

# Parse arguments using a while loop
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --world)
            WORLD_CONTRACT="--world $2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

#==============================================================================
# CONTRACT COMPILATION
#==============================================================================

echo -e ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           MarketPlace Contract Compilation                 ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo -e ""

echo -e "${YELLOW}► Building MarketPlace contracts with --profile ${BOLD}${PROFILE}${YELLOW}"
COMMAND="sozo build --profile $PROFILE"
echo -e ""
echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
echo -e ""
$COMMAND

#==============================================================================
# CONTRACT MIGRATION
#==============================================================================

echo -e ""
echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                Marketplace Contract Migration              ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
echo -e ""

echo -e "${YELLOW}► Migrating Marketplace contracts with --profile ${BOLD}${PROFILE}${YELLOW}"\
       "and world contract: ${BOLD}${WORLD_CONTRACT:-(unspecified)}${YELLOW}${NC}"
COMMAND="sozo migrate --profile $PROFILE $WORLD_CONTRACT --fee eth"
echo -e ""
echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
echo -e ""
$COMMAND

echo -e ""
echo -e "${GREEN}✔ Migration completed successfully${NC}"
echo -e ""