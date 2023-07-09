#!/bin/bash

# mints resources for realm 1 and 2
# realm 1: 1000 of resource 1 and 2
# realm 2: 1000 of resource 3 and 4

read -p "Enter entity_1_id: " entity_1_id
read -p "Enter entity_2_id: " entity_2_id

world="$SOZO_WORLD"

commands=(
    # realm 1
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,1,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,3,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_1_id,4,1000"
    # realm 2
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,6,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,7,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,8,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,9,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,10,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_2_id,11,1000"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
