#!/bin/bash

read -p "Enter entity_1_id: " entity_1_id
read -p "Enter entity_2_id: " entity_2_id

world="$SOZO_WORLD"

commands=(
    # realm 1
    "sozo execute --world $world MintResources --calldata $entity_1_id,1,1000"
    "sozo execute --world $world MintResources --calldata $entity_1_id,2,1000"
    # realm 2
    "sozo execute --world $world MintResources --calldata $entity_2_id,3,1000"
    "sozo execute --world $world MintResources --calldata $entity_2_id,4,1000"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
