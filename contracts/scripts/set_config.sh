#!/bin/bash

source ./scripts/contracts.sh

# // precision
export RESOURCE_PRECISION=1000

# // capactity
export DONKEY_CAPACITY=100000

# // resources
export RESOURCE_AMOUNT_PER_TICK=10
export FOOD_PER_TICK=30
export DONKEYS_PER_TICK=3
export KNIGHTS_PER_TICK=2
export CROSSBOWMEN_PER_TICK=2
export PALADIN_PER_TICK=2

# // global 
export MAX_MOVE_PER_TICK=3
export TICK_INTERVAL_IN_SECONDS=900

# // exploration
export EXPLORATION_WHEAT_BURN_AMOUNT=30000
export EXPLORATION_FISH_BURN_AMOUNT=15000
export EXPLORATION_REWARD_RESOURCE_AMOUNT=20000

# // costs
export RESOURCE_BUILDING_COST=500
export FARM_BUILDING_COST=900
export MARKET_BUILDING_COST=1500
export MILITARY_BUILDING_COST=2000
export WORKERS_HUT_BUILDING_COST=500
export WALLS_BUILDING_COST=3000
export STOREHOUSE_BUILDING_COST=2000

# // population
export RESOURCE_BUILDING_POPULATION=2
export FARM_BUILDING_POPULATION=1
export FISHING_BUILDING_POPULATION=1
export MARKET_BUILDING_POPULATION=3
export MILITARY_BUILDING_POPULATION=3
export WATCH_TOWER_POPULATION=3
export WORKERS_HUT_POPULATION=0
export STOREHOUSE_POPULATION=1

# // capacity
export WORKERS_HUT_CAPACITY=5


# ------ POPULATION + CAPACITY CONFIG ------
# params: population, capacity
commands+=(
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_RESOURCE,$RESOURCE_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FARM,$FARM_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FISHING_VILLAGE,$FISHING_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_MARKET,$MARKET_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_BARRACKS,$MILITARY_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_ARCHERY_RANGE,$MILITARY_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_STABLE,$MILITARY_BUILDING_POPULATION,0"
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_WORKERS_HUT,$WORKERS_HUT_POPULATION,$WORKERS_HUT_CAPACITY"
    
    "sozo execute $CONFIG_SYSTEMS set_population_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_STOREHOUSE,$STOREHOUSE_POPULATION,0"
    )


# ------ BANK CONFIG ------
# params: owner_cost, lp_fees
commands+=("sozo execute $CONFIG_SYSTEMS set_bank_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 100000,0")

# ------ TICK CONFIG ------
# params: max_move_per_tick, tick_interval_in_seconds
commands+=("sozo execute $CONFIG_SYSTEMS set_tick_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $MAX_MOVE_PER_TICK,$TICK_INTERVAL_IN_SECONDS")

# ------ EXPLORATION CONFIG ------
# params: wheat_burn_amount, fish_burn_amount, reward_resource_amount
commands+=("sozo execute $CONFIG_SYSTEMS set_exploration_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $EXPLORATION_WHEAT_BURN_AMOUNT,$EXPLORATION_FISH_BURN_AMOUNT,$EXPLORATION_REWARD_RESOURCE_AMOUNT")

# ------ WORLD CONFIG ------
commands+=(
    # realm_l2_contract
    "sozo execute $CONFIG_SYSTEMS set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DOJO_ACCOUNT_ADDRESS,0"

    # ### SPEED ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 360 sec per km = 10km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DONKEY_ENTITY_TYPE,$TICK_INTERVAL_IN_SECONDS"
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ARMY_ENTITY_TYPE,$TICK_INTERVAL_IN_SECONDS"

    # ### TRAVEL ###
    # # free transport per city = 10 (for testing);
    "sozo execute $CONFIG_SYSTEMS set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10"

    # ### CAPACITY ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 100000 gr = 100 kg
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,$(($DONKEY_CAPACITY * $RESOURCE_PRECISION))"

    # ### ROAD ###
    # # 10 wheat, fish, stone and wood per road usage
    # # speed up transit by 2x = 2
    "sozo execute $CONFIG_SYSTEMS set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,1,10000,2,10000,254,10000,255,10000,2"
)


# ------ WEIGHT CONFIG ------
for resource_type in {1..28}
do
    commands+=(
        # 1kg/1000 g per resource unit (resource precision = 1000)
        "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,1000"
    )
done

commands+=(
    # 1 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $LORDS,1"
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $FISH,100"
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WHEAT,100"
)

# ------ COMBAT CONFIG ------
commands+=(
    # config_id: 0
    # knight_health: 10,
    # paladin_health: 10,
    # crossbowman_health: 10,
    # knight_strength: 7,
    # paladin_strength: 7,
    # crossbowman_strength: 7,
    # advantage_percent: 1000, // 10%
    # disadvantage_percent: 1000, // 10% 
    "sozo execute $CONFIG_SYSTEMS set_troop_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,10,10,10,7,7,7,1000,1000"
)



commands+=(
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FARM,$WHEAT,1,$WHEAT,$(($FARM_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FISHING_VILLAGE,$FISH,1,$WHEAT,$(($FARM_BUILDING_COST * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_WORKERS_HUT,$WHEAT,$(($WORKERS_HUT_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_STOREHOUSE,$WHEAT,$(($STOREHOUSE_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_MARKET,$DONKEY,1,$WHEAT,$(($MARKET_BUILDING_COST * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_BARRACKS,$KNIGHT,1,$WHEAT,$(($MILITARY_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_ARCHERY_RANGE,$CROSSBOWMEN,1,$WHEAT,$(($MILITARY_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_STABLE,$PALADIN,1,$WHEAT,$(($MILITARY_BUILDING_COST * $RESOURCE_PRECISION))"

)

# Resource Buildings - All the same for now.
declare -A resources=(
    [WOOD]=1
    [STONE]=2
    [COAL]=3
    [COPPER]=4
    [OBSIDIAN]=5
    [SILVER]=6
    [IRONWOOD]=7
    [COLDIRON]=8
    [GOLD]=9
    [HARTWOOD]=10
    [DIAMONDS]=11
    [SAPPHIRE]=12
    [RUBY]=13
    [DEEPCRYSTAL]=14
    [IGNIUM]=15
    [ETHEREALSILICA]=16
    [TRUEICE]=17
    [TWILIGHTQUARTZ]=18
    [ALCHEMICALSILVER]=19
    [ADAMANTINE]=20
    [MITHRAL]=21
    [DRAGONHIDE]=22
)

for resource in "${!resources[@]}"; do
    resource_id=${resources[$resource]}
    commands+=("sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_RESOURCE,$resource_id,1,$WHEAT,$(($RESOURCE_BUILDING_COST * $RESOURCE_PRECISION))")
done

commands+=(
    # resourceId: 1
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WOOD,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$STONE,1500,$COAL,1600"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STONE,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$WOOD,2500,$COAL,1900"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COAL,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$STONE,2100,$COPPER,1400"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COPPER,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$COAL,2900,$OBSIDIAN,1700"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $OBSIDIAN,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$COPPER,2400,$SILVER,1600"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SILVER,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$OBSIDIAN,2500,$IRONWOOD,1400"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $IRONWOOD,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$SILVER,3000,$COLDIRON,1600"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COLDIRON,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$IRONWOOD,2500,$GOLD,1900"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $GOLD,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$COLDIRON,2100,$HARTWOOD,1300"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $HARTWOOD,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$GOLD,3100,$DIAMONDS,1000"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DIAMONDS,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$HARTWOOD,4000,$SAPPHIRE,1600"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SAPPHIRE,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$DIAMONDS,2400,$RUBY,1900"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $RUBY,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$SAPPHIRE,2100,$DEEPCRYSTAL,2000"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DEEPCRYSTAL,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$RUBY,2000,$IGNIUM,1400"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $IGNIUM,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$DEEPCRYSTAL,2800,$ETHEREALSILICA,1900"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ETHEREALSILICA,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$IGNIUM,2100,$TRUEICE,1700"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $TRUEICE,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$ETHEREALSILICA,2300,$TWILIGHTQUARTZ,1600"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $TWILIGHTQUARTZ,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$TRUEICE,2500,$ALCHEMICALSILVER,1700"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ALCHEMICALSILVER,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$TWILIGHTQUARTZ,2400,$ADAMANTINE,1200"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADAMANTINE,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$ALCHEMICALSILVER,3400,$MITHRAL,1300"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $MITHRAL,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$ADAMANTINE,3000,$DRAGONHIDE,1200"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DRAGONHIDE,$(($RESOURCE_AMOUNT_PER_TICK * $RESOURCE_PRECISION)),2,$MITHRAL,3200,$WOOD,436100"

    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DONKEY,$(($DONKEYS_PER_TICK * $RESOURCE_PRECISION)),1,$WHEAT,2500"

    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $KNIGHT,$(($KNIGHTS_PER_TICK * $RESOURCE_PRECISION)),3,$WHEAT,2500,$SILVER,1000,$IRONWOOD,2500"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $CROSSBOWMEN,$(($CROSSBOWMEN_PER_TICK * $RESOURCE_PRECISION)),3,$WHEAT,2500,$SILVER,1000,$COLDIRON,2500"  
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $PALADIN,$(($PALADIN_PER_TICK * $RESOURCE_PRECISION)),3,$WHEAT,2500,$SILVER,1000,$GOLD,2500"

    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WHEAT,$(($FOOD_PER_TICK * $RESOURCE_PRECISION)),0"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $FISH,$(($FOOD_PER_TICK * $RESOURCE_PRECISION)),0"
)


# Initialize variables
mode=""
delay=0

# Function to show usage
usage() {
    echo "Usage: $0 --mode [prod|dev] [--interval delay]"
    echo "  --mode: Specify the environment mode (prod or dev)."
    echo "  --interval: Specify a delay in seconds between each command."
    exit 1
}

# Check if at least one argument is provided
if [ $# -eq 0 ]; then
    usage
fi

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mode)
            if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
                mode=$2
                shift 2
            else
                echo "Error: --mode requires an argument (prod or dev)."
                usage
            fi
            ;;
        --interval)
            if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
                delay=$2
                shift 2
            else
                echo "Error: --interval requires a numeric argument."
                usage
            fi
            ;;
        *)
            usage
            ;;
    esac
done

# Validate mode
if [ "$mode" != "prod" ] && [ "$mode" != "dev" ]; then
    echo "Error: Invalid mode specified. Please use prod or dev."
    usage
fi

# Initialize commands based on mode
if [[ "$mode" == "prod" ]]; then
    commands+=(
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 29,1,20000,2,20000,3,20000,4,20000,5,20000,6,20000,7,20000,8,20000,9,20000,10,20000,11,20000,12,20000,13,20000,14,20000,15,20000,16,20000,17,20000,18,20000,19,20000,20,20000,21,20000,22,20000,249,2000,250,2000,251,2000,252,2000,253,200000,254,200000,255,200000"
    )
else
    # commands+=(
    #     "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 25,1,0,2,0,3,0,4,0,5,0,6,0,7,0,8,0,9,0,10,0,11,0,12,0,13,0,14,0,15,0,16,0,17,0,18,0,19,0,20,0,21,0,22,0,253,0,254,0,255,0"
    # )
    commands+=(
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 29,1,20000,2,20000,3,20000,4,20000,5,20000,6,20000,7,20000,8,20000,9,20000,10,20000,11,20000,12,20000,13,20000,14,20000,15,20000,16,20000,17,20000,18,20000,19,20000,20,20000,21,20000,22,20000,249,20000,250,2000,251,2000,252,2000,253,2000000,254,2000000,255,2000000"
        # set donkey speed at highest for dev
        # 1 sec per km
        "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,1"
    )
fi

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

./scripts/set_writer.sh --interval $delay