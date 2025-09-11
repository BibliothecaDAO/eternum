#!/bin/bash

# =============================================================================
#          Eternum Game Contract Migration Script
# =============================================================================
#
# DESCRIPTION:
#   Automates build and migration for game contracts using sozo.
#
# USAGE:
#   ./migrate.sh [OPTIONS]
#
# OPTIONS:
#   --profile <name>      Specify deployment profile (default: "local")
#   --world <addr>        Specify world contract address to connect to
#   --build-only          Only build contracts, do not migrate
#   --migrate-only        Only migrate contracts, do not build
#
# EXAMPLES:
#   ./migrate.sh
#   ./migrate.sh --profile sepolia
#   ./migrate.sh --build-only
#   ./migrate.sh --migrate-only
#
# REQUIREMENTS:
#   - Sozo CLI tool must be installed and in PATH
#   - Proper configuration in Scarb.toml for the target profile
#
# =============================================================================


# Import colors
source "$(dirname "$0")/colors.sh"

set -e
set -o pipefail

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
BUILD_ONLY=0
MIGRATE_ONLY=0

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
        --build-only)
            BUILD_ONLY=1
            shift
            ;;
        --migrate-only)
            MIGRATE_ONLY=1
            shift
            ;;
        *)
            shift
            ;;
    esac
done

#==============================================================================
# CONTRACT COMPILATION
#==============================================================================

if [[ $MIGRATE_ONLY -eq 0 ]]; then
    echo -e ""
    echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           Game Contract Compilation                 ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
    echo -e ""

    echo -e "${YELLOW}► Building Game contracts with --profile ${BOLD}${PROFILE}${YELLOW}"
    COMMAND="sozo build --profile $PROFILE"
    echo -e ""
    echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
    echo -e ""
    $COMMAND
fi

#==============================================================================
# CONTRACT MIGRATION
#==============================================================================

if [[ $BUILD_ONLY -eq 0 ]]; then
    echo -e ""
    echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                Game Contract Migration              ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
    echo -e ""

    echo -e "${YELLOW}► Migrating Game contracts with --profile ${BOLD}${PROFILE}${YELLOW}"\
           "and world contract: ${BOLD}${WORLD_CONTRACT:-(unspecified)}${YELLOW}${NC}"
    COMMAND="env RUST_LOG=starknet=trace sozo migrate --profile $PROFILE $WORLD_CONTRACT"
    echo -e ""
    echo -e "${BLUE}► Running command: ${BOLD}${COMMAND}${BLUE}${NC}"
    echo -e ""
    $COMMAND

    echo -e ""
    echo -e "${GREEN}✔ Migration completed successfully${NC}"
    echo -e ""
fi