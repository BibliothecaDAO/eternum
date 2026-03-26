#!/bin/bash

# =============================================================================
#     Eternum AMM Indexer Link Script
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
echo -e "${BLUE}║               Linking AMM To Indexer Env                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "\n"

echo -e "${GREEN}► Installing AMM deployment dependencies...${NC}"
cd deployment
bun install

NETWORK=${1:-local}

echo -e "${BLUE}► Linking indexer config for ${NETWORK}${NC}"
echo -e "${GREEN}► Executing indexer link script...${NC}"
bun run link-indexer:${NETWORK}

echo -e "\n${GREEN}✔ AMM indexer environment linked for ${NETWORK}${NC}\n"
