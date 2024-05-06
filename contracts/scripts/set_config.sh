#!/bin/bash

source ./scripts/contracts.sh

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

if [[ "$mode" == "prod" ]]; then 
    export STARTING_FOOD=2000
    export STARTING_DONKEYS=30
    export STARTING_TROOPS=3
    export STARTING_RESOURCES=20
    export STARTING_LORDS=100

    export TICK_INTERVAL_IN_SECONDS=900

    # 300 sec/km = 12 km /hour
    export DONKEY_SPEED=300
    export ARMY_SPEED=300
else
    export STARTING_FOOD=2000
    export STARTING_DONKEYS=30
    export STARTING_TROOPS=3
    export STARTING_RESOURCES=20
    export STARTING_LORDS=100

    export TICK_INTERVAL_IN_SECONDS=900

    export DONKEY_SPEED=1
    export ARMY_SPEED=1
fi

# // precision
export RESOURCE_PRECISION=1000

# // capactity
export DONKEY_CAPACITY=100 # kg
export ARMY_CAPACITY=1 # kg

# // resources
export RESOURCE_AMOUNT_PER_TICK=10
export FOOD_PER_TICK=30
export DONKEYS_PER_TICK=3
export KNIGHTS_PER_TICK=2
export CROSSBOWMEN_PER_TICK=2
export PALADIN_PER_TICK=2

# // global 
export MAX_MOVE_PER_TICK=3

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

# // starting resources config ids
export STARTING_ID_FOOD=1
export STARTING_ID_COMMON_RESOURCES=2
export STARTING_ID_UNCOMMON_RESOURCES=3
export STARTING_ID_UNIQUE_RESOURCES=4
export STARTING_ID_RARE_RESOURCES=5
export STARTING_ID_LEGENDARY_RESOURCES=6
export STARTING_ID_MYTHIC_RESOURCES=7
export STARTING_ID_TRADE=8
export STARTING_ID_MILITARY=9

# weight - grams
export RESOURCE_UNIT_WEIGHT=1000
export FOOD_UNIT_WEIGHT=100
export CURRENCY_UNIT_WEIGHT=1

// banks
export BANK_OWNER_COST=100000
export BANK_LP_FEES=922337203685477580

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
commands+=("sozo execute $CONFIG_SYSTEMS set_bank_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BANK_OWNER_COST,$BANK_LP_FEES")

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
    # # 300 sec per km = 12km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DONKEY_ENTITY_TYPE,$DONKEY_SPEED"
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ARMY_ENTITY_TYPE,$ARMY_SPEED"

    # ### TRAVEL ###
    # # free transport per city = 10 (for testing);
    # "sozo execute $CONFIG_SYSTEMS set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10"

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
        "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,$RESOURCE_UNIT_WEIGHT"
    )
done

commands+=(
    # 1 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $LORDS,$CURRENCY_UNIT_WEIGHT"
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $FISH,$FOOD_UNIT_WEIGHT"
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WHEAT,$FOOD_UNIT_WEIGHT"
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

    # ### CAPACITY ###
    # # entity type ARMY_ENTITY_TYPE = 258
    # # 1 kg
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ARMY_ENTITY_TYPE,$(($ARMY_CAPACITY * $RESOURCE_PRECISION))"

)



commands+=(
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FARM,$WHEAT,1,$WHEAT,$(($FARM_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_FISHING_VILLAGE,$FISH,1,$WHEAT,$(($FARM_BUILDING_COST * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_WORKERS_HUT,$WHEAT,1,$WHEAT,$(($WORKERS_HUT_BUILDING_COST * $RESOURCE_PRECISION))"
    "sozo execute $CONFIG_SYSTEMS set_building_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $BUILDING_STOREHOUSE,$WHEAT,1,$WHEAT,$(($STOREHOUSE_BUILDING_COST * $RESOURCE_PRECISION))"
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




commands+=(
    # FOOD STARTING CONFIG
    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_FOOD,2,$WHEAT,$(($STARTING_FOOD * $RESOURCE_PRECISION)),$FISH,$(($STARTING_FOOD * $RESOURCE_PRECISION))"

    # # TRADE STARTING CONFIG
    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_TRADE,2,$DONKEY,$(($STARTING_DONKEYS * $RESOURCE_PRECISION)),$LORDS,$(($STARTING_LORDS * $RESOURCE_PRECISION))"

    # # MILITARY STARTING CONFIG
    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_MILITARY,3,$KNIGHT,$(($STARTING_TROOPS * $RESOURCE_PRECISION)),$CROSSBOWMEN,$(($STARTING_TROOPS * $RESOURCE_PRECISION)),$PALADIN,$(($STARTING_TROOPS * $RESOURCE_PRECISION))"

    # RESOURCES STARTING CONFIG
    # We split into 3 groups to avoid hitting the max step limit
    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_COMMON_RESOURCES,4,$WOOD,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$STONE,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$COAL,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$COPPER,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_UNCOMMON_RESOURCES,3,$OBSIDIAN,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$SILVER,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$IRONWOOD,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_UNIQUE_RESOURCES,4,$COLDIRON,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$GOLD,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$HARTWOOD,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$DIAMONDS,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_RARE_RESOURCES,3,$SAPPHIRE,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$RUBY,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$DEEPCRYSTAL,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_LEGENDARY_RESOURCES,4,$IGNIUM,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$ETHEREALSILICA,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$TRUEICE,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$TWILIGHTQUARTZ,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"

    "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STARTING_ID_MYTHIC_RESOURCES,4,$ALCHEMICALSILVER,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$ADAMANTINE,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$MITHRAL,$(($STARTING_RESOURCES * $RESOURCE_PRECISION)),$DRAGONHIDE,$(($STARTING_RESOURCES * $RESOURCE_PRECISION))"
)


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

./scripts/set_writer.sh --interval $delay  --mode $mode
