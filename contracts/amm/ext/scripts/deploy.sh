#!/bin/bash

# =============================================================================
#     Eternum AMM Deployment Script
# =============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

set -e
set -o pipefail

error_handler() {
    echo -e "\n${RED}► Error: Command failed at line $1${NC}"
    exit 1
}

trap 'error_handler ${LINENO}' ERR

echo -e "\n"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Building Eternum AMM                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"

echo -e "${GREEN}► Navigating to AMM contract root directory...${NC}"
cd ../../

echo -e "${GREEN}► Building AMM contracts with Scarb...${NC}"
scarb --release build

cd - > /dev/null

echo -e "${GREEN}► Installing AMM deployment dependencies...${NC}"
cd deployment
bun install

NETWORK=${1:-local}

echo -e "${BLUE}► Deploying to ${NETWORK}${NC}"
echo -e "${GREEN}► Executing AMM deployment script...${NC}"
bun run deploy:${NETWORK}

echo -e "\n${GREEN}✔ AMM deployment process completed on ${NETWORK}${NC}\n"
