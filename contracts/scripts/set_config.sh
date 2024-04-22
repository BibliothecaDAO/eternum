#!/bin/bash

source ./scripts/contracts.sh

resource_precision=1000

## set bank config
commands+=(
    # owner cost in lords
    # lp fees
    "sozo execute $CONFIG_SYSTEMS set_bank_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 100000,0"
)

## set tick config
commands+=(
    # max_moves_per_tick = 3
    # tick_interval_in_seconds = 900
    "sozo execute $CONFIG_SYSTEMS set_tick_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,900"
)

## set exploration config
commands+=(
    # wheat_burn_amount = 300000
    # fish_burn_amount = 150000
    # reward_resource_amount = 20000
    "sozo execute $CONFIG_SYSTEMS set_exploration_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 300000,150000,20000"
)

commands+=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute $CONFIG_SYSTEMS set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DOJO_ACCOUNT_ADDRESS,0"

    # ### SPEED ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 360 sec per km = 10km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,360"

    # ### TRAVEL ###
    # # free transport per city = 10 (for testing);
    "sozo execute $CONFIG_SYSTEMS set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10"

    # ### CAPACITY ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 100000 gr = 100 kg
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,$((100000 * resource_precision))"

    # ### ROAD ###
    # # 10 wheat, fish, stone and wood per road usage
    # # speed up transit by 2x = 2
    "sozo execute $CONFIG_SYSTEMS set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,1,10000,2,10000,254,10000,255,10000,2"

)

### LEVELING CONFIG ###
commands+=(
    ## leveling cost
    ## decay_scaled = 1844674407370955161 => 10%,
    ## cost_percentage_scaled = 4611686018427387904 => 25%,
    ## base_multiplier = 25 => 25%,
    ## wheat_base_amount = 3780 => 12 hours of average prod,
    ## fish_base_amount = 1260 => 12 hours of average prod,
    ## resource_1_costs = 1, 132, 2, 104, 3, 101, 4, 70, 5, 58, 6, 46, 7, 31,
    ## resource_2_costs = 8, 25, 9, 24, 10, 16, 11, 8, 12, 7, 13, 6, 14, 6, 15, 5,
    ## resource_3_costs = 16, 4, 17, 4, 18, 3, 19, 2, 20, 1, 21, 1, 22, 1,
    "sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 999999999999999993,604800,1000,1844674407370955161,4611686018427387904,25,11340000,3780000,7,1,756000,2,594097,3,577816,4,398426,5,334057,6,262452,7,177732,8,8,144266,9,137783,10,89544,11,45224,12,37235,13,36029,14,36029,15,25929,7,16,24421,17,20954,18,16733,19,14020,20,8291,21,5578,22,3467"
)


### SOLDIERS CONFIG ###
commands+=(
    ## soldier weight 
    ## 80 kg = 80000 gr
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,80000"

    ## soldier capacity
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,$((100000 * resource_precision))"

    ## soldier speed
    ## 800 sec per km = 4.5 km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,800"

    ## soldier cost
    ## 7560 wheat (254)
    ## 2520 fish (255)

    ## soldier burning
    ## 150 wheat per soldier
    ## 50 fish per soldier
    "sozo execute $CONFIG_SYSTEMS set_soldier_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,254,1512000,255,504000,150000,50000"

    ## soldier health
    ## 10 
    ## 7560/2 wheat (254)
    ## 2520/2 fish (255)
    "sozo execute $CONFIG_SYSTEMS set_health_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,2,254,75600,255,25200,10"

    ## soldier attack
    ## 10 
    "sozo execute $CONFIG_SYSTEMS set_attack_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,10"

    ## soldier defence
    ## 10 
    "sozo execute $CONFIG_SYSTEMS set_defence_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 258,10"

    ## combat config
    ## stealing_trial_count
    ## 100 wheat per soldier
    ## 30 fish per soldier
    "sozo execute $CONFIG_SYSTEMS set_combat_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 999999999999999994,3,100000,300000"
)

### WEIGHT ###
# Loop for resource types 1 to 28
for resource_type in {1..28}
do
    commands+=(
        # 1kg/1000 g per resource unit (resource precision = 1000)
        "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,1000"
    )
done

### WEIGHT ###
commands+=(
    # Resource type 253
    # 1 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 253,1"
    # Resource type 254
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,100"
    # Resource type 255
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,100"
)


## LABOR COSTS
# commands+=(
#     # resourceId: 1
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,33816319,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,2,3274"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,3,3184"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,255,5500"
#     # resourceId: 2
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,17039103,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,1,4166"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,3,3184"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,255,5500"
#     # resourceId: 3
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,33881855,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,2,3274"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,4,2195"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,255,5500"
#     # resourceId: 4
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,17170175,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,1,4166"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,5,1841"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,255,5500"
#     # resourceId: 5
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,67567359,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,4,2195"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,6,1446"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,255,5500"
#     # resourceId: 6
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,84410111,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,5,1841"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,7,979"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,255,5500"
#     # resourceId: 7
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,101252863,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,6,1446"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,8,795"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,255,5500"
#     # resourceId: 8
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,118095615,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,7,979"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,9,759"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,255,5500"
#     # resourceId: 9
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,134938367,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,8,795"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,10,493"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,255,5500"
#     # resourceId: 10
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,151781119,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,9,759"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,11,249"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,255,5500"
#     # resourceId: 11
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,168623871,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,10,493"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,12,205"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,255,5500"
#     # resourceId: 12
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,185466623,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,11,249"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,13,198"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,255,5500"
#     # resourceId: 13
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,202309375,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,12,205"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,14,198"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,255,5500"
#     # resourceId: 14
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,219152127,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,13,198"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,15,142"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,255,5500"
#     # resourceId: 15
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,235994879,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,14,198"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,16,134"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,255,5500"
#     # resourceId: 16
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,252837631,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,15,142"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,17,115"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,255,5500"
#     # resourceId: 17
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,269680383,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,16,134"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,18,92"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,255,5500"
#     # resourceId: 18
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,286523135,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,17,115"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,19,77"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,255,5500"
#     # resourceId: 19
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,303496959,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,18,92"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,22,19"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,255,5500"
#     # resourceId: 20
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,320208639,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,19,77"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,21,30"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,255,5500"
#     # resourceId: 21
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,337051391,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,20,45"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,22,19"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,255,5500"
#     # resourceId: 22
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,336985855,4"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,20,45"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,21,30"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,254,11000"
#     "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,255,5500"
# )

export AMOUNT_PER_TICK=1000

commands+=(
    # resourceId: 1
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WOOD,$AMOUNT_PER_TICK,1,$STONE,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $STONE,$AMOUNT_PER_TICK,1,$COAL,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COAL,$AMOUNT_PER_TICK,1,$COPPER,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COPPER,$AMOUNT_PER_TICK,1,$OBSIDIAN,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $OBSIDIAN,$AMOUNT_PER_TICK,1,$SILVER,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SILVER,$AMOUNT_PER_TICK,1,$IRONWOOD,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $IRONWOOD,$AMOUNT_PER_TICK,1,$COLDIRON,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $COLDIRON,$AMOUNT_PER_TICK,1,$GOLD,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $GOLD,$AMOUNT_PER_TICK,1,$HARTWOOD,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $HARTWOOD,$AMOUNT_PER_TICK,1,$DIAMONDS,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DIAMONDS,$AMOUNT_PER_TICK,1,$SAPPHIRE,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SAPPHIRE,$AMOUNT_PER_TICK,1,$RUBY,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $RUBY,$AMOUNT_PER_TICK,1,$DEEPCRYSTAL,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DEEPCRYSTAL,$AMOUNT_PER_TICK,1,$IGNIUM,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $IGNIUM,$AMOUNT_PER_TICK,1,$ETHEREALSILICA,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ETHEREALSILICA,$AMOUNT_PER_TICK,1,$TRUEICE,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $TRUEICE,$AMOUNT_PER_TICK,1,$TWILIGHTQUARTZ,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $TWILIGHTQUARTZ,$AMOUNT_PER_TICK,1,$ALCHEMICALSILVER,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ALCHEMICALSILVER,$AMOUNT_PER_TICK,1,$ADAMANTINE,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $ADAMANTINE,$AMOUNT_PER_TICK,1,$MITHRAL,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $MITHRAL,$AMOUNT_PER_TICK,1,$DRAGONHIDE,10"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $DRAGONHIDE,$AMOUNT_PER_TICK,1,$MITHRAL,10"

    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $WHEAT,$AMOUNT_PER_TICK,0"
    "sozo execute $CONFIG_SYSTEMS set_production_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $FISH,$AMOUNT_PER_TICK,0"
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
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 24,1,378000,2,297049,3,288908,4,199213,5,167029,6,131226,7,88866,8,72133,9,68892,10,44772,11,22612,12,18618,13,18015,14,18015,15,12965,16,12211,17,10477,18,8367,19,7010,20,4146,21,2789,22,1734,254,12474000,255,4158000"
    )
else
    # commands+=(
    #     "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 25,1,0,2,0,3,0,4,0,5,0,6,0,7,0,8,0,9,0,10,0,11,0,12,0,13,0,14,0,15,0,16,0,17,0,18,0,19,0,20,0,21,0,22,0,253,0,254,0,255,0"
    # )
    commands+=(
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata 25,1,200000,2,200000,3,200000,4,200000,5,200000,6,200000,7,200000,8,200000,9,200000,10,200000,11,200000,12,200000,13,200000,14,200000,15,200000,16,200000,17,200000,18,200000,19,200000,20,200000,21,200000,22,200000,253,200000,254,200000,255,200000"
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