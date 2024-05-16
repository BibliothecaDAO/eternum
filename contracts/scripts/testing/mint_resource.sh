#!/bin/bash

# Function to show usage
usage() {
    echo "Usage: $0 --mode [prod|dev]"
    exit 1
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

read -p "Enter entity id: " entity_id
read -p "Enter resource type: " resource_type
read -p "Enter amount: " amount

world="$SOZO_WORLD"

source ./scripts/env_variables.sh $mode

source ./scripts/contracts.sh

commands=(
    "sozo execute --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,1,$resource_type,$amount $DEV_RESOURCE_SYSTEMS mint"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
