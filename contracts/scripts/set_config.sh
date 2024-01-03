#!/bin/bash

source ./scripts/contracts.sh

resource_precision=1000

## set banks
commands=(
    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1739434,1849206,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,0,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1656258,2042499,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1856118,2135886,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1548948,1720142,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1510000,2132414,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,983029,1708654,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1067862,1362576,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,712153,1655223,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1617475,1384248,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2000000,1645229,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,27,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2100000,1310000,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,30,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2419494,1582908,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,33,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2772678,1723517,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,36,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2961737,1943493,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,39,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2585155,2237035,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,42,2,253,0,253,1,1844674407370955161,100000,100000"

    "sozo execute $CONFIG_SYSTEMS create_bank --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2678852,1397859,2,253,1,254,10,253,1,255,5"
    "sozo execute $CONFIG_SYSTEMS set_bank_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,45,2,253,0,253,1,1844674407370955161,100000,100000"
)

commands+=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute $CONFIG_SYSTEMS set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,$DOJO_ACCOUNT_ADDRESS,0"

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
    # # fee resource type = 2 # Stone
    # # fee amount = 10
    # # speed up transit by 2x = 2
    "sozo execute $CONFIG_SYSTEMS set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,$((10 * resource_precision)),2"

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
    "sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999993,604800,1000,1844674407370955161,4611686018427387904,25,3780000,1260000,7,1,132000,2,103731,3,100889,4,69566,5,58327,6,45825,7,31033,8,8,25189,9,24057,10,15635,11,7896,12,6501,13,6291,14,6291,15,4527,7,16,4264,17,3659,18,2922,19,2448,20,1448,21,974,22,605"
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
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1652610,2103276,1"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2621909,1458147,2"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1650208,1764081,3"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2919158,2127177,4"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,740492,1446359,5"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2445183,2275580,6"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1954116,2171570,7"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1412094,1993452,8"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,893997,1873356,9"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2509517,1884363,10"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1097424,1476206,11"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1572668,1517683,12"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,1906818,1409047,13"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2072443,1712964,14"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2844078,1697894,15"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,605410,2023632,16"

    ## set leveling config
    ## 1247400000 wheat (330x the realm leveling amount)
    ## 415800000 fish (330x the realm leveling amount)
    ## resources 1 costs
    ## 1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000
    ## resources 2 costs
    ## 8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500
    ## resources 3 costs
    ## 16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000
    "sozo execute $CONFIG_SYSTEMS set_leveling_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,999999999999999992,604800,4,1844674407370955161,4611686018427387904,25,1247400000,415800000,7,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,7,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000"
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
        "sozo execute $CONFIG_SYSTEMS set_mint_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,24,1,872170,2,685390,3,666610,4,459650,5,385390,6,302780,7,205040,8,166430,9,158960,10,103300,11,52170,12,42960,13,41570,14,41570,15,29910,16,28170,17,24170,18,19300,19,16170,20,9570,21,6430,22,4000,254,7560000,255,2520000"
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

