#!/bin/bash

commands=() 

# Function to show usage
usage() {
    echo "Usage: $0"
    exit 1
}

create_realms() {
    local num_realms=$1
    for ((i=1; i<=$num_realms; i++)); do
        commands+=("sozo execute --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0x1,1,0x20309,3,5,5,5,5,1,1 $REALM_SYSTEMS create && sleep 0.1")
    done
}

world="$SOZO_WORLD"

source ./scripts/env_variables.sh dev

source ./scripts/contracts.sh

read -p "Enter the number of realms you want to mint: " num_realms
create_realms "$num_realms"

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
