#!/bin/bash

read -p "Enter entity id: " entity_id
read -p "Enter resource type: " resource_type
read -p "Enter amount: " amount

world="$SOZO_WORLD"

commands=(
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,$resource_type,$amount"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
