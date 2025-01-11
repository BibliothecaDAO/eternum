#!/bin/bash

# =============================================================================
#     Season Resources Deployment Script
# =============================================================================
#
# DESCRIPTION:
#   This script handles the deployment process for the Season Resources ERC20 smart 
#   contracts. It manages the build process using Scarb and executes the 
#   deployment using Bun.
#
# USAGE:
#   ./deploy.sh  - Builds and deploys the Season Resources ERC20 contracts
#
# PROCESS:
#   1. Builds the contracts using Scarb in release mode
#   2. Changes to deployment directory
#   3. Installs dependencies using Bun
#   4. Executes the deployment script
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
echo -e "${BLUE}║          Building Season Resources ERC20 Contracts       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"

# Navigate to root contract directory
echo -e "${GREEN}► Navigating to season resources contract root directory...${NC}"
cd ../../

# Build contracts
echo -e "${GREEN}► Building season resources contracts with Scarb...${NC}"
scarb --release build

# Return to script directory
cd - > /dev/null

# Navigate to deployment directory
echo -e "${GREEN}► Installing season resources deployment dependencies...${NC}"
cd deployment
bun install

# Execute deployment
echo -e "${GREEN}► Executing season resources deployment script...${NC}"
bun run deploy

echo -e "\n${GREEN}✔ Season Resources deployment process completed${NC}\n"
