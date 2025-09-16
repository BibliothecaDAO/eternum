#!/bin/bash

# =============================================================================
# Slot Deployment Script
# =============================================================================
#
# DESCRIPTION:
#   This script manages deployments of remote Katana and Torii (indexer)
#
# USAGE:
#   ./slot.sh <command> [options]
#
# COMMANDS:
#   katana            Deploy Katana network
#   torii             Deploy Torii indexer
#
# PARAMETERS:
#   For Torii deployment (all required):
#   --world <address>    The World address
#   --network <network>  Network to deploy to
#   --project <name>     Project name for deployment
#   --toml <dir>         Directory containing torii config files (named torii-<network>.toml)
#
#   For Katana deployment:
#   --project <name>     Project name (optional, auto-generated if not specified)
#
# NETWORK OPTIONS:
#   - slot: Local Katana network (requires --project)
#   - mainnet: Eternum mainnet
#   - sepolia: Starknet Sepolia testnet
#
# EXAMPLES:
#   1. Deploy Katana with auto-generated project name:
#      ./slot.sh katana
#
#   2. Deploy Katana with specific project:
#      ./slot.sh katana --project my-project
#
#   3. Deploy Torii (all parameters required):
#      ./slot.sh torii --network mainnet --world 0x123 --project my-project
#
# NETWORK CONFIGURATIONS:
#   slot:    https://api.cartridge.gg/x/<project-name>/katana
#            (Requires prior Katana deployment with same project name)
#   mainnet: https://api.cartridge.gg/x/eternum/mainnet
#   sepolia: https://api.cartridge.gg/x/starknet/sepolia
#
# PROJECT NAMING:
#   - If --project is not specified for Katana:
#     Auto-generates name in format: slot-<adjective>-<noun>
#   - For Torii deployments, --project is always required
#
# ERROR HANDLING:
#   - Validates all required parameters based on command
#   - Ensures project name is specified for Torii and slot network
#   - Checks for valid network selection
#   - Handles deployment failures gracefully
#
# =============================================================================

# Import colors from shared script (assuming same directory as migrate.sh)
source "$(dirname "$0")/colors.sh"

#==============================================================================
# CONFIGURATION
#==============================================================================

KATANA_MAX_INVOKE_STEPS=25000000 # 25,000,000
KATANA_BLOCK_TIME=1000 # 1 seconds
SN_NETWORK="slot"
# Default RPC URL will now be set based on network selection
RPC_URL=""
COMMAND=""

# First argument is the command
if [ $# -gt 0 ]; then
    case "$1" in
        "katana"|"torii")
            COMMAND="$1"
            shift
            ;;
        "--help"|"-h")
            display_help
            ;;
        *)
            echo -e "${RED}► Error: Unknown command '$1'. Use 'katana' or 'torii'${NC}"
            exit 1
            ;;
    esac
fi

# Process remaining arguments as options
while [[ $# -gt 0 ]]; do
    case $1 in
        --world)
            WORLD="$2"
            shift 2
            ;;
        --project)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --network)
            SN_NETWORK="$2"
            shift 2
            ;;
        --toml)
            TOML_PATH="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}► Error: Unknown option $1${NC}"
            exit 1
            ;;
    esac
done

# Validate command
if [ -z "$COMMAND" ]; then
    echo -e "${RED}► Error: Must specify either 'katana' or 'torii' command${NC}"
    exit 1
fi

# Validate required parameters for torii
if [ "$COMMAND" = "torii" ]; then
    if [ -z "$SN_NETWORK" ]; then
        echo -e "\n${RED}► Error: Network must be specified using --network parameter for Torii deployment${NC}\n"
        exit 1
    fi
    if [ -z "$WORLD" ]; then
        echo -e "\n${RED}► Error: World address must be provided using --world parameter for Torii deployment${NC}\n"
        exit 1
    fi
    if [ -z "$PROJECT_NAME" ]; then
        echo -e "\n${RED}► Error: Project name must be specified using --project parameter for Torii deployment${NC}\n"
        exit 1
    fi
    if [ -z "$TOML_PATH" ]; then
        echo -e "\n${RED}► Error: Torii config directory must be specified using --toml parameter${NC}\n"
        exit 1
    fi
    
    # Construct the full config file path
    TOML_FILE="torii-$SN_NETWORK.toml"
    FULL_TOML_PATH="$TOML_PATH/$TOML_FILE"
    
    if [ ! -f "$FULL_TOML_PATH" ]; then
        echo -e "\n${RED}► Error: Torii config file not found at: $FULL_TOML_PATH${NC}\n"
        exit 1
    fi

    RPC_URL="https://api.cartridge.gg/x/$PROJECT_NAME/katana"
    if [ "$SN_NETWORK" = "mainnet" ]; then
        RPC_URL="https://api.cartridge.gg/x/eternum/mainnet"
    fi
    if [ "$SN_NETWORK" = "sepolia" ]; then
        RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
    fi
    echo -e "\n\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║                      ${MAGENTA}${BOLD}NETWORK CONFIG${NC}${BLUE}                          ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║  ${MAGENTA}${BOLD}RPC URL:${NC} ${BLUE}${BOLD}$RPC_URL${NC}${BLUE}  ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║  ${MAGENTA}${BOLD}TORII CONFIG:${NC} ${BLUE}${BOLD}$FULL_TOML_PATH${NC}${BLUE}  ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "\n${YELLOW}► Make sure you have already deployed Katana with this project name${NC}\n\n"
fi

# Update validation checks
if [ "$COMMAND" = "torii" ] && [ -z "$WORLD" ]; then
    echo -e "${RED}► Error: World address must be provided using --world parameter for Torii deployment${NC}"
    exit 1
fi

# Validate deployment options
if [ "$COMMAND" = "katana" ] && [ "$COMMAND" = "torii" ]; then
    echo -e "${RED}► Error: Cannot deploy Katana and Torii simultaneously. Please choose one.${NC}"
    exit 1
fi

if [ "$COMMAND" != "katana" ] && [ "$COMMAND" != "torii" ]; then
    echo -e "${RED}► Error: Must specify either --katana or --torii${NC}"
    exit 1
fi

#==============================================================================
# HELPER FUNCTIONS
#==============================================================================

generate_project_name() {
    local adjectives=(
        "red" "blue" "gold" "dark" "wild" "bold" "pure" 
        "fast" "calm" "wise" "brave" "free" "firm" "true" 
        "raw" "real" "deep" "fair" "safe" "warm" "cool" 
        "keen" "soft" "loud" "new" "old" "hot" "cold" 
        "big" "small" "swift" "strong" "bright" "clear"
    )
    local nouns=(
        "gate" "path" "star" "moon" "sun" "tree" "rock"
        "cave" "peak" "lake" "sea" "bay" "port" "base"
        "dome" "fort" "keep" "den" "nest" "home" "road"
        "way" "hall" "hub" "core" "ring" "well" "post"
        "node" "link" "grid" "web" "net" "zone" "spot"
    )
    local adj1=${adjectives[$RANDOM % ${#adjectives[@]}]}
    local noun=${nouns[$RANDOM % ${#nouns[@]}]}
    echo "slot-${adj1}-${noun}"
}

display_help() {
    cat << EOF
$(echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}")
$(echo -e "${BLUE}║                Slot Deployment Help                 ║${NC}")
$(echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}")

USAGE:
    ./slot.sh <command> [options]

COMMANDS:
    katana             Deploy Katana network
    torii              Deploy Torii indexer

OPTIONS:
    --world <address>    The World address (required for torii)
    --network <network>  Network to deploy to (required for torii)
                        Options: slot, mainnet, sepolia
    --project <name>     Custom project name (default: auto-generated)
    --toml <dir>         Directory containing torii config files (named torii-<network>.toml)

EXAMPLES:
    1. Deploy Katana:
       ./slot.sh katana 

    2. Deploy Katana with custom project name:
       ./slot.sh katana --project my-project


    3. Deploy Torii:
       ./slot.sh torii --network mainnet --world 0x123 --project my-project
       ./slot.sh torii --network sepolia --world 0x123 --project my-project
       ./slot.sh torii --network slot --world 0x123 --project my-project


SEQUENCER CONFIGURATIONS:
    slot:    https://api.cartridge.gg/x/<project-name>/katana
    mainnet: https://api.cartridge.gg/x/eternum/mainnet
    sepolia: https://api.cartridge.gg/x/starknet/sepolia
EOF
    exit 0
}

#==============================================================================
# ERROR HANDLING
#==============================================================================

set -e
trap 'echo -e "\n${RED}► Error: Command failed at line $LINENO${NC}"; exit 1' ERR

#==============================================================================
# MAIN SCRIPT
#==============================================================================

# Generate project name if not provided
if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME=$(generate_project_name)
fi

echo -e "\n${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                Slot Deployment Setup                 ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}► Project name: ${BOLD}$PROJECT_NAME${NC}\n"

# Add reminder function
print_env_reminder() {
    local command="$1"
    local box_width=60
    
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              Update Environment Variables                         ║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║                                                                  ║${NC}"
    echo -e "${BLUE}║  ${YELLOW}REMEMBER TO UPDATE:${NC}${BLUE}                                    ║${NC}"
    echo -e "${BLUE}║  ${BOLD}1. client/apps/game/.env.${SN_NETWORK}${NC}${BLUE}                       ║${NC}"
    echo -e "${BLUE}║  ${BOLD}2. contracts/game/dojo_${SN_NETWORK}.toml${NC}${BLUE} rpc_url${NC}                    ║${NC}"
    echo -e "${BLUE}║  ${BOLD}3. contracts/common/env.${SN_NETWORK}${NC}${BLUE} STARKNET_RPC${NC}                    ║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║                                                                  ║${NC}"

    if [ "$command" = "katana" ]; then
        cat << EOF
${BLUE}  ${GREEN}VITE_PUBLIC_CHAIN    = ${BOLD}$SN_NETWORK${NC}${BLUE}                               ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_SLOT     = ${BOLD}$PROJECT_NAME${NC}${BLUE}                             ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_NODE_URL = ${BOLD}https://api.cartridge.gg/x/$PROJECT_NAME/katana${NC}${BLUE}  ${NC}
EOF
    elif [ "$command" = "torii" ]; then
        cat << EOF
${BLUE}  ${GREEN}VITE_PUBLIC_CHAIN       = ${BOLD}$SN_NETWORK${NC}${BLUE}                            ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_SLOT        = ${BOLD}$PROJECT_NAME${NC}${BLUE}                          ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_NODE_URL    = ${BOLD}$RPC_URL${NC}${BLUE}                              ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_TORII       = ${BOLD}https://api.cartridge.gg/x/$PROJECT_NAME/torii${NC}${BLUE} ${NC}
${BLUE}  ${GREEN}VITE_PUBLIC_TORII_RELAY = ${BOLD}/dns4/api.cartridge.gg/tcp/443/x-parity-wss/%2Fx%2F$PROJECT_NAME%2Ftorii%2Fwss${NC}${BLUE} ${NC}
EOF
    fi
    echo -e "${BLUE}║                                                                  ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}\n"
}

# Update deployment section to include reminders
if [ "$COMMAND" = "katana" ]; then
    echo -e "${YELLOW}► Setting up Katana network...${NC}"
    slot deployments create --team realms-eternum $PROJECT_NAME katana \
        --invoke-max-steps "$KATANA_MAX_INVOKE_STEPS" \
        --dev --dev.no-fee

    echo -e "\n${YELLOW}► Deployment accounts:${NC}"
    slot deployments accounts "$PROJECT_NAME" katana
    
    print_env_reminder "katana"
fi

if [ "$COMMAND" = "torii" ]; then
    echo -e "\n${YELLOW}► Setting up Torii indexer...${NC}"
    slot deployments create --team realms-eternum $PROJECT_NAME torii \
        --version v1.7.0-alpha.1 \
        --world $WORLD \
        --rpc $RPC_URL \
        --indexing.pending \
        --config "$FULL_TOML_PATH"
        
    print_env_reminder "torii"
fi

echo -e "${GREEN}✔ Deployment completed successfully${NC}"
echo -e "\n\n"
echo -e "${MAGENTA}${BOLD}PROJECT NAME:${NC}"
echo -e "\n"
echo -e "${BLUE}${BOLD}$PROJECT_NAME${NC}"
echo -e "\n\n"
echo "$PROJECT_NAME"

