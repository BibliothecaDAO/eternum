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

# env variables
export WOOD=1
export STONE=2
export COAL=3
export COPPER=4
export OBSIDIAN=5
export SILVER=6
export IRONWOOD=7
export COLDIRON=8
export GOLD=9
export HARTWOOD=10
export DIAMONDS=11
export SAPPHIRE=12
export RUBY=13
export DEEPCRYSTAL=14
export IGNIUM=15
export ETHEREALSILICA=16
export TRUEICE=17
export TWILIGHTQUARTZ=18
export ALCHEMICALSILVER=19
export ADAMANTINE=20
export MITHRAL=21
export DRAGONHIDE=22
export EARTHENSHARD=29

# Transports
export DONKEY=249;

# Units
export KNIGHT=250
export CROSSBOWMEN=251
export PALADIN=252

export LORDS=253
export WHEAT=254
export FISH=255

export DONKEY_ENTITY_TYPE=256
export REALM_ENTITY_TYPE=257
export ARMY_ENTITY_TYPE=258

export BUILDING_NONE=0
export BUILDING_CASTLE=1
export BUILDING_RESOURCE=2
export BUILDING_FARM=3
export BUILDING_FISHING_VILLAGE=4
export BUILDING_BARRACKS=5
export BUILDING_MARKET=6
export BUILDING_ARCHERY_RANGE=7
export BUILDING_STABLE=8
export BUILDING_DONKEY_FARM=9
export BUILDING_TRADING_POST=10
export BUILDING_WORKERS_HUT=11
export BUILDING_WATCH_TOWER=12
export BUILDING_WALLS=13
export BUILDING_STOREHOUSE=14

# entity ids
export ADMIN_BANK_ACCOUNT_ENTITY_ID=999999999999999999 
export ADMIN_BANK_ENTITY_ID=999999999999999998

export FOOD_LIQUIDITY=20000
export DONKEYS_LIQUIDITY=300
export TROOPS_LIQUIDITY=30
export RESOURCE_LIQUIDITY=200
export LORDS_LIQUIDITY_PER_RESOURCE=200
export RESOURCE_NUMBER=100000

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

    "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$WOOD"
)

# ------- MINT DONKEYKS AND LORDS IN ADMIN BANK ACCOUNT ------
commands+=(
    "sozo execute $DEV_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADMIN_BANK_ACCOUNT_ENTITY_ID,1,$LORDS,$(($LORDS_LIQUIDITY_PER_RESOURCE * $RESOURCE_PRECISION * $RESOURCE_NUMBER))"

    "sozo model get Resource $ADMIN_BANK_ACCOUNT_ENTITY_ID,$LORDS"
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