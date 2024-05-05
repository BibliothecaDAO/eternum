#!/bin/bash

# Initialize variables
# delay=0
# notw: only works with delay=2 seconds
# Initialize variables
mode=""
delay=0

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

source ./scripts/env_variables.sh $mode

source ./scripts/contracts.sh

# entity ids
export ADMIN_BANK_ACCOUNT_ENTITY_ID=999999999999999999 
export ADMIN_BANK_ENTITY_ID=999999999999999998

export FOOD_LIQUIDITY=20000
export DONKEYS_LIQUIDITY=300
export TROOPS_LIQUIDITY=30
export RESOURCE_LIQUIDITY=200
export LORDS_LIQUIDITY_PER_RESOURCE=200
export RESOURCE_NUMBER=28

# Precision
export RESOURCE_PRECISION=1000

# Banks
export COORD_X=2147483900
export COORD_Y=2147483801
export BANK_OWNER_FEES=922337203685477580

# ------ CREATE ADMIN BANK ------
# params:  coord, owner_fees
commands+=(
    "sozo execute $DEV_BANK_SYSTEMS create_admin_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COORD_X,$COORD_Y,$BANK_OWNER_FEES"
)

# ------ MINT RESOURCES IN ADMIN BANK ACCOUNT ------
# params: length_of_array, [resource_id, amount]...
# mint resources from 1 to 22 with 1000 precision and $RESOURCE_LIQUIDITY, takes an array of resources as input
commands+=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ACCOUNT_ENTITY_ID,22,1,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),2,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),3,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),4,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),5,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),6,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),7,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),8,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),9,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),10,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),11,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),12,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),13,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),14,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),15,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),16,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),17,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),18,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),19,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),20,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),21,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),22,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION))"
)

# ------- MINT DONKEYKS AND LORDS IN ADMIN BANK ACCOUNT ------
commands+=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ACCOUNT_ENTITY_ID,2,249,$(($DONKEYS_LIQUIDITY * $RESOURCE_PRECISION)),253,$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION * RESOURCE_NUMBER))"
)

# -------- MINT TRROPS IN ADMIN BANK ACCOUNT ------
commands+=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ACCOUNT_ENTITY_ID,3,250,$(($TROOPS_LIQUIDITY * $RESOURCE_PRECISION)),251,$(($TROOPS_LIQUIDITY * $RESOURCE_PRECISION)),252,$(($TROOPS_LIQUIDITY * $RESOURCE_PRECISION))"
)

# -------- MINT FOOD IN ADMIN BANK ACCOUNT --------
commands+=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ACCOUNT_ENTITY_ID,2,254,$(($FOOD_LIQUIDITY * $RESOURCE_PRECISION)),255,$(($FOOD_LIQUIDITY * $RESOURCE_PRECISION))"
)

# -------- ADD RESOURCES TO LIQUIDITY --------
# resources
for resource_id in {1..22}
do
    commands+=(
        "sozo execute $LIQUIDITY_SYSTEMS add --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ENTITY_ID,$resource_id,$(($RESOURCE_LIQUIDITY * $RESOURCE_PRECISION)),$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION))"

        "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$resource_id"
    )
done

# donkeys
commands+=(
    "sozo execute $LIQUIDITY_SYSTEMS add --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ENTITY_ID,$DONKEY,$(($DONKEYS_LIQUIDITY * $RESOURCE_PRECISION)),$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION))"

    "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$DONKEY"
)

# troops
for troop_id in {250..252}
do
    commands+=(
        "sozo execute $LIQUIDITY_SYSTEMS add --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ENTITY_ID,$troop_id,$(($TROOPS_LIQUIDITY * $RESOURCE_PRECISION)),$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION))"

        "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$troop_id"
    )
     
done

# food
for food_id in {254..255}
do
    commands+=(
        "sozo execute $LIQUIDITY_SYSTEMS add --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ENTITY_ID,$food_id,$(($FOOD_LIQUIDITY * $RESOURCE_PRECISION)),$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION))"

        "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$food_id"
    )
done


for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"

    if [ $(echo "$delay > 0" | bc -l) -eq 1 ]; then
        echo "Sleeping for $delay seconds..."
        sleep $delay
    fi
done