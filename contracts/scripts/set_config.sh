#!/bin/bash

source ./scripts/contracts.sh

resource_precision=1000

## set banks
commands=(
"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483838,2147483684,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,0,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483945,2147483695,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483763,2147483698,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483673,2147483699,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147484047,2147483704,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147484106,2147483733,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483897,2147483766,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483693,2147483798,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147484021,2147483806,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483819,2147483812,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,27,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483951,2147483850,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,30,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483789,2147483880,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,33,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147484105,2147483886,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,36,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483877,2147483894,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,39,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147483696,2147483901,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,42,2,253,0,253,1,1844674407370955161,100000,100000"

"sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2147484019,2147483912,2,253,1,254,10,253,1,255,5"
"sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,45,2,253,0,253,1,1844674407370955161,100000,100000"
)

commands+=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute $CONFIG_SYSTEMS set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,$DOJO_ACCOUNT_ADDRESS,0"

    ### BUILDINGS CONFIG ###
    # level_multiplier = 10
    # discount = 90% = 16602069666338596454
    # resources 1 = [1, 2, 3, 7, 10, 17] = 1108152355345
    # resources 1 count = 6
    # resources 2 = [4, 6, 8, 9, 19, 20] = 4423951127316
    # resources 2 count = 6
    # resources 3 =  [11, 12, 13, 14, 18] = 47446822418
    # resources 3 count = 5
    # resources 4 = [5, 15, 16, 21, 22] = 21727548694
    # resources 4 count = 5
    "sozo execute $CONFIG_SYSTEMS set_labor_buildings_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,16602069666338596454,1108152355345,6,4423951127316,6,47446822418,5,21727548694,5,8,1,126000,2,99016,3,96303,7,29622,10,14924,17,3492,254,1890000,255,630000,8,4,66404,6,43742,8,24044,9,22964,19,2337,20,1382,254,1890000,255,630000,7,11,7537,12,6206,13,6005,14,6005,18,2789,254,1890000,255,630000,7,5,55676,15,4321,16,4070,21,930,22,578,254,1890000,255,630000"

    # ### LABOR ###
    # # base_labor_units 7200
    # # base_resources_per_cycle 21
    # # base_food_per_cycle 21
    "sozo execute $CONFIG_SYSTEMS set_labor_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7200,$((21 * resource_precision)),$((21 * resource_precision))"

    # ### SPEED ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 360 sec per km = 10km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,256,360"

    # ### TRAVEL ###
    # # free transport per city = 10 (for testing);
    "sozo execute $CONFIG_SYSTEMS set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10"

    # ### CAPACITY ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 100000 gr = 100 kg
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,256,$((100000 * resource_precision))"

    # ### ROAD ###
    # # 10 wheat, fish, stone and wood per road usage
    # # speed up transit by 2x = 2
    "sozo execute $CONFIG_SYSTEMS set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,1,10000,2,10000,254,10000,255,10000,2"

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
    "sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999993,604800,1000,1844674407370955161,4611686018427387904,25,11340000,3780000,7,1,756000,2,594097,3,577816,4,398426,5,334057,6,262452,7,177732,8,8,144266,9,137783,10,89544,11,45224,12,37235,13,36029,14,36029,15,25929,7,16,24421,17,20954,18,16733,19,14020,20,8291,21,5578,22,3467"
)


### SOLDIERS CONFIG ###
commands+=(
    ## soldier weight 
    ## 80 kg = 80000 gr
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,80000"

    ## soldier capacity
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,$((100000 * resource_precision))"

    ## soldier speed
    ## 800 sec per km = 4.5 km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,800"

    ## soldier cost
    ## 7560 wheat (254)
    ## 2520 fish (255)

    ## soldier burning
    ## 150 wheat per soldier
    ## 50 fish per soldier
    "sozo execute $CONFIG_SYSTEMS set_soldier_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,254,1512000,255,504000,150000,50000"

    ## soldier health
    ## 10 
    ## 7560/2 wheat (254)
    ## 2520/2 fish (255)
    "sozo execute $CONFIG_SYSTEMS set_health_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,2,254,75600,255,25200,10"

    ## soldier attack
    ## 10 
    "sozo execute $CONFIG_SYSTEMS set_attack_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,10"

    ## soldier defence
    ## 10 
    "sozo execute $CONFIG_SYSTEMS set_defence_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,258,10"

    ## combat config
    ## stealing_trial_count
    ## 100 wheat per soldier
    ## 30 fish per soldier
    "sozo execute $CONFIG_SYSTEMS set_combat_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999994,3,100000,300000"
)

### WEIGHT ###
# Loop for resource types 1 to 28
for resource_type in {1..28}
do
    commands+=(
        # 1kg/1000 g per resource unit (resource precision = 1000)
        "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,$resource_type,1000"
    )
done

### WEIGHT ###
commands+=(
    # Resource type 253
    # 1 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,253,1"
    # Resource type 254
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,100"
    # Resource type 255
    # 0.1 kg/ 100 gr per unit
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,100"
)


## LABOR COSTS
commands+=(
    ## food is free now
    #resourceId: 254
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,66051,3"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,1,171"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,2,134"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,3,131"
    # resourceId: 255
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,263430,3"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,4,289"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,5,242"
    #"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,6,190"
    # resourceId: 1
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,33816319,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2,3274"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,3,3184"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,255,5500"
    # resourceId: 2
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,17039103,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,1,4166"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,3,3184"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,255,5500"
    # resourceId: 3
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,33881855,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,2,3274"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,4,2195"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,255,5500"
    # resourceId: 4
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,17170175,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,1,4166"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,5,1841"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,255,5500"
    # resourceId: 5
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,67567359,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,4,2195"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,6,1446"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,255,5500"
    # resourceId: 6
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,84410111,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,5,1841"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,7,979"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,255,5500"
    # resourceId: 7
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,101252863,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,6,1446"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,8,795"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,255,5500"
    # resourceId: 8
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,118095615,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,7,979"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,9,759"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,255,5500"
    # resourceId: 9
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,134938367,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,8,795"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,10,493"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,255,5500"
    # resourceId: 10
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,151781119,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,9,759"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,11,249"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,255,5500"
    # resourceId: 11
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,168623871,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,10,493"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,12,205"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,255,5500"
    # resourceId: 12
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,185466623,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,11,249"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,13,198"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,255,5500"
    # resourceId: 13
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,202309375,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,12,205"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,14,198"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,255,5500"
    # resourceId: 14
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,219152127,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,13,198"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,15,142"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,255,5500"
    # resourceId: 15
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,235994879,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,14,198"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,16,134"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,255,5500"
    # resourceId: 16
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,252837631,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,15,142"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,17,115"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,255,5500"
    # resourceId: 17
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,269680383,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,16,134"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,18,92"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,255,5500"
    # resourceId: 18
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,286523135,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,17,115"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,19,77"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,255,5500"
    # resourceId: 19
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,303496959,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,18,92"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,22,19"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,255,5500"
    # resourceId: 20
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,320208639,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,19,77"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,21,30"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,255,5500"
    # resourceId: 21
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,337051391,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,20,45"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,22,19"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,255,5500"
    # resourceId: 22
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,336985855,4"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,20,45"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,21,30"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,254,11000"
    "sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,255,5500"
)

commands+=(
    # create hyperstructures
    # @dev generated using data/hyperstructures/generateCommands.js
    # data => ./contracts/data/hyperstructures/hyperstructures.json
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483965,2147483695,4,1,9450000,2,7426208,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483832,2147483696,4,3,7222702,4,4980326,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483700,2147483715,4,5,4175714,6,3280649,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147484094,2147483715,4,7,2221646,8,1803321,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483898,2147483795,4,9,1722294,10,1119301,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147484017,2147483796,4,11,565302,12,465432,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483778,2147483797,4,13,450359,14,450359,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483700,2147483878,4,15,324106,16,305263,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147484094,2147483878,4,17,261926,18,209162,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483832,2147483897,4,19,175246,20,103640,254,45000000,255,15000000"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2147483965,2147483897,4,21,69719,22,43342,254,45000000,255,15000000"
)

#### SET LABOR AUCTIONS ####

commands+=(
    # assuming 20 realms per zone
    # labor on 5 different food/non-food resources every day
    # 12 labor units needed per day for full-time
    # 20 * 5 * 12 = 960 labor units per day per zone as target

    # 0.1 decay = 1844674407370955161
    "sozo execute $CONFIG_SYSTEMS set_labor_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1844674407370955161,960,10"
)


# Read the System to Components JSON file
system_models_json=$(cat ./scripts/system_models.json)

# Loop through each system
for system in $(echo $system_models_json | jq -r 'keys[]'); do
    # Loop through each component that the system writes to
    for model in $(echo $system_models_json | jq -r ".$system[]"); do
        system_var="${system}"
        contract_address="${!system_var}"
        # make the system a writer of the component
        commands+=("sozo auth writer --world "$SOZO_WORLD" $model $contract_address")
    done
done

### STARTING REALM RESOURCE BALANCES
# Check if the first argument is provided and set it to "dev" or "prod"
if [[ "$1" == "prod" ]]; then
    commands+=(
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,1,378000,2,297049,3,288908,4,199213,5,167029,6,131226,7,88866,8,72133,9,68892,10,44772,11,22612,12,18618,13,18015,14,18015,15,12965,16,12211,17,10477,18,8367,19,7010,20,4146,21,2789,22,1734,254,12474000,255,4158000"
    )
else
    # Add command for no argument case, which is also treated as dev
    commands+=(
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,25,1,1000000000,2,1000000000,3,1000000000,4,1000000000,5,1000000000,6,1000000000,7,1000000000,8,1000000000,9,1000000000,10,1000000000,11,1000000000,12,1000000000,13,1000000000,14,1000000000,15,1000000000,16,1000000000,17,1000000000,18,1000000000,19,1000000000,20,1000000000,21,1000000000,22,1000000000,253,1000000000,254,1000000000,255,1000000000"
    )
fi


# Ask the user for the desired delay between commands
read -p "Specify a delay in seconds between each command (or press Enter for no delay): " delay

# Check if the delay is a valid number (integer or floating point)
if [[ ! "$delay" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    delay=0
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

