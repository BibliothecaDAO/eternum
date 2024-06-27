#!/bin/bash

# Initialize the delay variable
mode=""
delay=""

# Function to show usage
usage() {
    echo "Usage: $0 --mode [prod|dev] [--interval delay]"
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

# run the contracts.sh file
source ./scripts/contracts.sh

commands=()

# Read the System to Components JSON file
system_models_json=$(cat ./scripts/system_models.json)

# Initialize an empty string for the multicall command
multicall_command=""

# Loop through each system
for system in $(echo $system_models_json | jq -r 'keys[]'); do
    system_var="${system}"
    contract_address="${!system_var}"
    
    # Loop through each component that the system writes to
    for model in $(echo $system_models_json | jq -r ".$system[]"); do
        # Append to the multicall command
        multicall_command+=" $model,$contract_address"
    done
done

# Construct the final command
if [[ "$mode" == "prod" ]]; then
    final_command="sozo --profile prod auth grant writer$multicall_command"
else
    final_command="sozo auth grant writer$multicall_command"
fi

# Add the final command to the commands array
commands+=("$final_command")


# Ask for delay if not provided
if [ -z "$delay" ]; then
    read -p "Specify a delay in seconds between each command (or press Enter for no delay): " delay
    # Validate that delay is a number
    if ! [[ "$delay" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        delay=0
    fi
fi

# Execute commands
for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"

    if [ "$(echo "$delay > 0" | bc -l)" -eq 1 ]; then
        echo "Sleeping for $delay seconds..."
        sleep $delay
    fi
done
