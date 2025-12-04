#!/bin/bash

# =============================================================================
#     Realms Collectible Deployment Script
# =============================================================================
#
# DESCRIPTION:
#   This script handles the deployment process for the Realms Collectible smart 
#   contracts. It manages the build process using Scarb and executes the 
#   deployment using Bun.
#
# USAGE:
#   ./deploy.sh [type] [network]  - Builds and deploys the Realms Collectible contracts
#                                   where [type] is required (cosmetics, loot-chests, or elite-invite)
#                                   and [network] is optional and defaults to 'local'
#   Examples:
#   ./deploy.sh cosmetics           - Deploys cosmetics to local
#   ./deploy.sh cosmetics local     - Deploys cosmetics to local
#   ./deploy.sh loot-chests slot    - Deploys loot-chests to slot
#   ./deploy.sh elite-invite slot   - Deploys elite-invite to slot
#   ./deploy.sh cosmetics sepolia   - Deploys cosmetics to sepolia
#   ./deploy.sh loot-chests mainnet - Deploys loot-chests to mainnet
#
# PROCESS:
#   1. Builds the contracts using Scarb in release mode
#   2. Changes to deployment directory
#   3. Installs dependencies using Bun
#   4. Executes the deployment script for specified network
#
# REQUIREMENTS:
#   - Scarb (Starknet contract compiler)
#   - Bun (JavaScript runtime)
#   - Node.js dependencies in deployment directory
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
echo -e "${BLUE}║               Building Realms Collectible Contracts             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"

# Navigate to root contract directory
echo -e "${GREEN}► Navigating to realms collectible contract root directory...${NC}"
cd ../../

# Build contracts
echo -e "${GREEN}► Building realms collectible contracts with Scarb...${NC}"
scarb --release build

# Return to script directory
cd - > /dev/null

# Navigate to deployment directory
echo -e "${GREEN}► Installing realms collectible deployment dependencies...${NC}"
cd deployment
bun install

# Get collectible type parameter (required)
TYPE=$1

# Validate collectible type
if [ -z "$TYPE" ]; then
    echo -e "${RED}Error: Collectible type is required${NC}"
    echo -e "Usage: ./deploy.sh [type] [network]"
    echo -e "Valid types: cosmetics, loot-chests, elite-invite"
    exit 1
fi

if [ "$TYPE" != "cosmetics" ] && [ "$TYPE" != "loot-chests" ] && [ "$TYPE" != "elite-invite" ]; then
    echo -e "${RED}Error: Invalid collectible type '${TYPE}'${NC}"
    echo -e "Valid types: cosmetics, loot-chests, elite-invite"
    exit 1
fi

# Get network parameter, default to 'local' if not provided
NETWORK=${2:-local}

echo -e "${BLUE}► Deploying ${TYPE} to ${NETWORK}${NC}"

# Execute deployment
echo -e "${GREEN}► Executing realms collectible deployment script...${NC}"
bun run deploy:${TYPE}:${NETWORK}

echo -e "\n${GREEN}✔ Realms Collectible (${TYPE}) deployment process completed on ${NETWORK}${NC}\n"