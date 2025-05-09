#!/bin/bash

# =============================================================================
#     Season Resources Grant Role Script
# =============================================================================
#
# DESCRIPTION:
#   This script handles the grant of role to mint in-game resources
#
# USAGE:
#   ./grant.sh [network]  - Builds and grants the Season Resources ERC20 contracts
#                           where [network] is optional and defaults to 'local'
#   Examples:
#   ./grant.sh local     - grants to local
#   ./grant.sh slot      - grants to slot
#   ./grant.sh sepolia   - grants to sepolia
#   ./grant.sh mainnet   - grants to mainnet
#
# PROCESS:
#   1. Builds the contracts using Scarb in release mode
#   2. Changes to grantment directory
#   3. Installs dependencies using Bun
#   4. Executes the grantment script for specified network
#
# REQUIREMENTS:
#   - Scarb (Starknet contract compiler)
#   - Bun (JavaScript runtime)
#   - Node.js dependencies in grantment directory
#
# =============================================================================


# Fallback colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'


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
# MAIN EXECUTION
#==============================================================================

echo -e "\n"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Granting Minter Role to In-Game Bridge           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"


# Navigate to grantment directory
echo -e "${GREEN}► Installing season resources grantment dependencies...${NC}"
cd deployment
bun install

# Get network parameter, default to 'local' if not provided
NETWORK=${1:-local}

echo -e "${BLUE}► Granting in ${NETWORK} Network${NC}"

# Execute grantment
echo -e "${GREEN}► Executing season resources grant role script...${NC}"
bun run grant:${NETWORK}

echo -e "\n${GREEN}✔ Season Resources grant role process completed on ${NETWORK}${NC}\n"