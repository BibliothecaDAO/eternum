#!/bin/bash

# mints 1000 of some resources for a relam 

read -p "Enter entityId: " entity_1_id

world="$SOZO_WORLD"

commands=(
    # realm 1
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,1,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,3,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,4,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,5,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,6,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,7,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,8,1000"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
