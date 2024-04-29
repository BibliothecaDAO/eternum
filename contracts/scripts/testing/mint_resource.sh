#!/bin/bash

read -p "Enter entity id: " entity_id
read -p "Enter resource type: " resource_type
read -p "Enter amount: " amount

world="$SOZO_WORLD"

commands=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,$entity_id,1,$resource_type,$amount"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
