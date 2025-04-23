#!/bin/bash

# =============================================================================
#     Village Pass Deployment Script
# =============================================================================
#
# DESCRIPTION:
#   This script handles the deployment process for the Village Pass smart 
#   contracts. It manages the build process using Scarb and executes the 
#   deployment using Bun.
#
# USAGE:
#   ./deploy.sh [network]  - Builds and deploys the Village Pass contracts
#                           where [network] is optional and defaults to 'local'
#   Examples:
#   ./deploy.sh      - Deploys to local
#   ./deploy.sh local     - Deploys to local
#   ./deploy.sh slot      - Deploys to slot
#   ./deploy.sh sepolia   - Deploys to sepolia
#   ./deploy.sh mainnet   - Deploys to mainnet
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
echo -e "${BLUE}║               Building Village Pass Contracts             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"

# Navigate to root contract directory
echo -e "${GREEN}► Navigating to village pass contract root directory...${NC}"
cd ../../

# Build contracts
echo -e "${GREEN}► Building village pass contracts with Scarb...${NC}"
scarb --release build

# Return to script directory
cd - > /dev/null

# Navigate to deployment directory
echo -e "${GREEN}► Installing village pass deployment dependencies...${NC}"
cd deployment
bun install

# Get network parameter, default to 'local' if not provided
NETWORK=${1:-local}

echo -e "${BLUE}► Deploying to ${NETWORK}${NC}"

# Execute deployment
echo -e "${GREEN}► Executing village pass deployment script...${NC}"
bun run deploy:${NETWORK}

echo -e "\n${GREEN}✔ village Pass deployment process completed on ${NETWORK}${NC}\n"