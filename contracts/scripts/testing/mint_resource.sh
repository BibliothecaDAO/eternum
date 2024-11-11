#!/bin/bash

commands=() 

# Function to show usage
usage() {
    echo "Usage: $0 --mode [prod|dev]"
    exit 1
}

mint_all_resources() {
    local entity_id=$1
    local amount=$2
    local resources=(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 29 249 250 251 252 253 254 255)
    
    for resource in "${resources[@]}"; do
        commands+=("sozo execute eternum-dev_resource_systems mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,1,$resource,$amount --world 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2  && sleep 0.1")
    done
}


# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mode) mode="${2:-}"; shift 2;;
        --interval) delay="${2:-}"; shift 2;;
        *) usage;;
    esac
done

# Validate mode
if [[ "$mode" != "prod" && "$mode" != "dev" ]]; then
    echo "Error: Invalid mode specified. Please use prod or dev."
    usage
fi

world="$SOZO_WORLD"


source ./scripts/env_variables.sh $mode

source ./scripts/contracts.sh

read -p "Enter entity id: " entity_id
read -p "Do you want to mint all resources? (y/n): " mint_all

if [[ $mint_all == "y" || $mint_all == "Y" ]]; then
    read -p "Enter amount for all resources: " all_amount
    mint_all_resources "$entity_id" "$((all_amount * 1000))"
else
	read -p "Enter resource type: " resource_type
	read -p "Enter amount: " amount
    commands+=(
        "sozo execute eternum-dev_resource_systems mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,1,$resource_type,$((amount * 1000)) --world 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2
    )
fi



for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
