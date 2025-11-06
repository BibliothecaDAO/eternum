#!/bin/bash

# =============================================================================
#     Realms Collectible Deployment Script
# =============================================================================
#
# DESCRIPTION:
#   This script handles the declare process for the Realms Collectible smart 
#   contracts. It manages the build process using Scarb and executes the 
#   declare using Bun.
#
# USAGE:
#   ./declare.sh [network]  - Builds and declares the Realms Collectible contracts
#                           where [network] is optional and defaults to 'local'
#   Examples:
#   ./declare.sh           - Declares to local
#   ./declare.sh local     - Declares to local
#   ./declare.sh slot      - Declares to slot
#   ./declare.sh sepolia   - Declares to sepolia
#   ./declare.sh mainnet   - Declares to mainnet
#
#   Note: This declare script is network-only and does not require a collectible type
#
# PROCESS:
#   1. Builds the contracts using Scarb in release mode
#   2. Changes to deployment directory
#   3. Installs dependencies using Bun
#   4. Executes the declare script for specified network
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
echo -e "${GREEN}► Installing realms collectible declare dependencies...${NC}"
cd deployment
bun install

# Get network parameter, default to 'local' if not provided
NETWORK=${1:-local}

echo -e "${BLUE}► Declaring to ${NETWORK}${NC}"

# Execute declare
echo -e "${GREEN}► Executing realms collectible declare script...${NC}"
bun run declare:${NETWORK}

echo -e "\n${GREEN}✔ Realms Collectible declare process completed on ${NETWORK}${NC}\n"