#!/bin/bash

# Import colors from shared script
source "$(dirname "$0")/colors.sh"

#==============================================================================
# HELPER FUNCTIONS
#==============================================================================

show_help() {
    cat << EOF
$(echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}")
$(echo -e "${BLUE}║              TOML Contract Updater                  ║${NC}")
$(echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}")

USAGE:
    $(basename "$0") <config_file> <json_file>

ARGUMENTS:
    config_file    Path to the TOML configuration file to update
    json_file      Path to the JSON file containing contract addresses

REQUIRED JSON FORMAT:
    {
        "seasonPass": "0x...",
        "realms": "0x...",
        "lords": "0x..."
    }

FEATURES:
    • Updates ERC721/ERC20 contract addresses from JSON file
    • Auto-detects and updates world address from corresponding manifest file
    • Supports slot, local, sepolia, and mainnet environments

EXAMPLES:
    1. Update local configuration:
       $(basename "$0") torii-local.toml addresses.json

    2. Update slot configuration (auto-detects manifest_slot.json):
       $(basename "$0") torii-slot.toml ../common/addresses/slot.json

REQUIREMENTS:
    - jq (JSON processor)
EOF
    exit 1
}

#==============================================================================
# INPUT VALIDATION
#==============================================================================

# Show help if requested or if no arguments provided
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]] || [ "$#" -ne 2 ]; then
    show_help
fi

CONFIG_FILE=$1
CONFIG_FILE_NAME=$(basename "$CONFIG_FILE")
JSON_FILE=$2

# Validate input files exist
if [ ! -f "$CONFIG_FILE" ] || [ ! -f "$JSON_FILE" ]; then
    echo -e "${RED}► Error: One or both input files don't exist${NC}"
    exit 1
fi

# Check for required dependencies
if ! command -v jq &> /dev/null; then
    echo -e "\n${RED}► Error: jq is required but not installed${NC}"
    echo -e "\n${YELLOW}Install using:${NC}"
    echo -e "  • Ubuntu/Debian: ${BOLD}sudo apt-get install jq${NC}"
    echo -e "  • MacOS: ${BOLD}brew install jq${NC}\n"
    exit 1
fi

#==============================================================================
# MAIN SCRIPT
#==============================================================================

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Torii TOML ERC721/ERC20 Update For       ║${NC}"
echo -e "${BLUE}║                                                   ║${NC}"    
echo -e "${GREEN}${BOLD}                  $CONFIG_FILE${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}\n"

# Extract and validate contract addresses
echo -e "${YELLOW}► Reading contract addresses...${NC}"
VILLAGE_PASS=$(jq -r '.villagePass' "$JSON_FILE")
SEASON_PASS=$(jq -r '.seasonPass' "$JSON_FILE")
REALMS=$(jq -r '.realms' "$JSON_FILE")
LORDS=$(jq -r '.lords' "$JSON_FILE")

# Auto-detect manifest file for world address
echo -e "${YELLOW}► Detecting manifest file for world address...${NC}"
WORLD_ADDRESS=""

# Extract environment from config file name (e.g., torii-local.toml -> local)
ENVIRONMENT=$(echo "$CONFIG_FILE_NAME" | sed 's/torii-\(.*\)\.toml/\1/')
MANIFEST_FILE="manifest_${ENVIRONMENT}.json"
echo -e "${GREEN}► Detected environment: $ENVIRONMENT${NC}"

# Try to extract world address if manifest file exists
if [[ -n "$MANIFEST_FILE" ]] && [[ -f "$MANIFEST_FILE" ]]; then
    echo -e "${GREEN}► Found manifest file: $MANIFEST_FILE${NC}"
    WORLD_ADDRESS=$(jq -r '.world.address' "$MANIFEST_FILE" 2>/dev/null)
    if [[ "$WORLD_ADDRESS" != "null" ]] && [[ -n "$WORLD_ADDRESS" ]]; then
        echo -e "${GREEN}► Extracted world address: $WORLD_ADDRESS${NC}"
    else
        echo -e "${YELLOW}► Warning: Could not extract world address from manifest${NC}"
        WORLD_ADDRESS=""
    fi
else
    echo -e "${YELLOW}► No manifest file found, skipping world address update${NC}"
fi


# Display contract information
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Contract Addresses                          ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  ${MAGENTA}${BOLD}VILLAGE PASS:${NC} ${BLUE}${BOLD}$VILLAGE_PASS${NC}${BLUE}  ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  ${MAGENTA}${BOLD}SEASON PASS:${NC} ${BLUE}${BOLD}$SEASON_PASS${NC}${BLUE}  ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  ${MAGENTA}${BOLD}REALMS:${NC} ${BLUE}${BOLD}$REALMS${NC}${BLUE}  ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  ${MAGENTA}${BOLD}LORDS:${NC} ${BLUE}${BOLD}$LORDS${NC}${BLUE}  ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
if [[ -n "$WORLD_ADDRESS" ]]; then
echo -e "${BLUE}║  ${MAGENTA}${BOLD}WORLD ADDRESS:${NC} ${GREEN}${BOLD}$WORLD_ADDRESS${NC}${BLUE}  ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"

# Create a temporary file for safe file modification
echo -e "${YELLOW}► Updating TOML configuration...${NC}"
tmp_file=$(mktemp)

# Process the TOML file
awk -v season_pass="$SEASON_PASS" -v village_pass="$VILLAGE_PASS" -v realms="$REALMS" -v lords="$LORDS" -v world_address="$WORLD_ADDRESS" '
BEGIN { erc721_count = 0 }
{
    if ($0 ~ /erc721:0x[0-9a-fA-F]+/) {
        erc721_count++
        if (erc721_count == 1) {
            gsub(/erc721:0x[0-9a-fA-F]+/, "erc721:" village_pass)
        } else if (erc721_count == 2) {
            gsub(/erc721:0x[0-9a-fA-F]+/, "erc721:" season_pass)
        } else if (erc721_count == 3) {
            gsub(/erc721:0x[0-9a-fA-F]+/, "erc721:" realms)
        }
    } else if ($0 ~ /erc20:0x[0-9a-fA-F]+/) {
        gsub(/erc20:0x[0-9a-fA-F]+/, "erc20:" lords)
    } else if ($0 ~ /^world_address\s*=/ && world_address != "") {
        gsub(/^world_address\s*=\s*"[^"]*"/, "world_address = \"" world_address "\"")
    }
    print $0
}' "$CONFIG_FILE" > "$tmp_file"

# Safely replace the original file
mv "$tmp_file" "$CONFIG_FILE"

if [[ -n "$WORLD_ADDRESS" ]]; then
    echo -e "${GREEN}✔ Contract addresses and world address updated successfully${NC}"
else
    echo -e "${GREEN}✔ Contract addresses updated successfully${NC}"
fi