#!/bin/bash

world="$SOZO_WORLD"
config_systems="0x5a457e2ecf5f338c2122e35046becb5172ba3d3cf73c0de584e504ee895af65";
labor_systems="0x2c96a033f4871ade10b83f17230beaf848bf1de62f202d00753d36b970a2202";
trade_systems="0x2d5178ac3bf7d6d5fc116f543f9c8ac7eba381d09f77d1d464d1f9ebfe81391";
hyperstructure_systems="0x32e7b7e9e21f2d02c6f030e624514eb55003e7d3a299cbb90cc97c9df91b333";
resource_systems="0x58e0f847a24a5905350bdd445db3f472442ed55fdfabff26cb400a1d13ba195";
caravan_systems="0x6cbac984e419dd953e07bacb6a45da22cb0534ea1d73fcf9075abef4b1398dd";
road_systems="0x24805155428a16f39f2959e59bfb0fedac5e83d31fbdf6e1776c27036efe7a3";
transport_unit_systems="0x64d9dce7519c641e6eb269b69d045d96cf3cef1b9b723b8c7e1248646bfd066";
travel_systems="0x6da6277375679a626f8a362aa0659ccfd377163d08c3e5bf59db3a0fdb08c42";
realm_systems="0x2bc672da1c2fdf17d509c543845784dbf93894a4c0b72aaee0aecd195a64405";

resource_precision=1000

commands=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute $config_systems set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,0"

    # ### LABOR ###
    # # base_labor_units 7200
    # # base_resources_per_cycle 21
    # # base_food_per_cycle 14000
    "sozo execute $config_systems set_labor_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7200,$((21 * resource_precision)),$((14000 * resource_precision))"

    # ### SPEED ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 360 sec per km = 10km/h
    "sozo execute $config_systems set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,256,360"

    # ### TRAVEL ###
    # # free transport per city = 100 (for testing);
    "sozo execute $config_systems set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,100"

    # ### CAPACITY ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 100000 gr = 100 kg
    "sozo execute $config_systems set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,256,$((100 * resource_precision))"

    # ### ROAD ###
    # # fee resource type = 2 # Stone
    # # fee amount = 10
    # # speed up transit by 2x = 2

    "sozo execute $config_systems set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,10,2"

)

### WEIGHT ###
# Loop for resource types 1 to 28
for resource_type in {1..28}
do
    commands+=(
        # 1 g per resource
        "sozo execute $config_systems set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,$resource_type,1"
    )
done

### WEIGHT ###
commands+=(
    # Resource type 253
    "sozo execute $config_systems set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,253,1"
    # Resource type 254
    "sozo execute $config_systems set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,1"
    # Resource type 255
    "sozo execute $config_systems set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,1"
)


## LABOR COSTS
commands+=(
# resourceId: 254
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,66051,3"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,1,171"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,2,134"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,3,131"
# resourceId: 255
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,263430,3"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,4,289"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,5,242"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,6,190"
# resourceId: 1
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,515,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,2,3274"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,3,3184"
# resourceId: 2
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,259,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,1,4166"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,3,3184"
# resourceId: 3
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,516,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,2,3274"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,4,2195"
# resourceId: 4
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,261,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,1,4166"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,5,1841"
# resourceId: 5
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,1030,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,4,2195"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,6,1446"
# resourceId: 6
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,1287,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,5,1841"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,7,979"
# resourceId: 7
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,1544,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,6,1446"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,8,795"
# resourceId: 8
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,1801,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,7,979"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,9,759"
# resourceId: 9
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,2058,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,8,795"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,10,493"
# resourceId: 10
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,2315,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,9,759"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,11,249"
# resourceId: 11
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,2572,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,10,493"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,12,205"
# resourceId: 12
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,2829,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,11,249"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,13,198"
# resourceId: 13
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,3086,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,12,205"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,14,198"
# resourceId: 14
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,3343,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,13,198"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,15,142"
# resourceId: 15
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,3600,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,14,198"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,16,134"
# resourceId: 16
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,3857,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,15,142"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,17,115"
# resourceId: 17
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,4114,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,16,134"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,18,92"
# resourceId: 18
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,4371,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,17,115"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,19,77"
# resourceId: 19
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,4630,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,18,92"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,22,19"
# resourceId: 20
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,4885,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,19,77"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,21,30"
# resourceId: 21
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,5142,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,20,45"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,22,19"
# resourceId: 22
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,5141,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,20,45"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,21,30"
)


commands+=(
    # Define hyperstructures
    # @dev generated using data/hyperstructures/generateCommands.js
    # data => ./contracts/data/hyperstructures/hyperstructures.json
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,740492,1446359"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,893997,1873356"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,605410,2023632"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1097424,1476206"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1572668,1517683"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1650208,1764081"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1412094,1993452"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1652610,2103276"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1954116,2171570"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2072443,1712964"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,1906818,1409047"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2621909,1458147"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2844078,1697894"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2509517,1884363"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2919158,2127177"
    "sozo execute $config_systems create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,4,1,1000000,2,1000000,3,1000000,4,1000000,22,1,10000000,2,10000000,3,10000000,4,10000000,5,10000000,6,10000000,7,10000000,8,10000000,9,10000000,10,10000000,11,10000000,12,10000000,13,10000000,14,10000000,15,10000000,16,10000000,17,10000000,18,10000000,19,10000000,20,10000000,21,10000000,22,10000000,2445183,2275580"
)

commands+=(
    # NOTE: mint a random realm so that no player has the 0x0 entity id as a realm
    # because 0x0 is also used in make_fungible_order as taker_id to specify that any entity can take the order
    # TODO: need to rethink make_fungible_order so that we don't rely on taker_id 0x0 to know who can take order
    ## realm 1:
    ## name: Stolsli
    ## resources_ids_packed = 4328719365 (1,2,3,4,5)
    ## cities = 4
    ## harbors = 5
    ## rivers = 6
    ## coordinates with offset of + 1800000
    ## position = ["287471", "-189200"]
    ## "Stone", "Coal"]
    ## [2, 3]
    ## order = giants = 8
    "sozo execute $realm_systems create --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,$DOJO_ACCOUNT_ADDRESS,515,2,4,5,6,1,1,8,2,2087471,1610800"
)


#### SET LABOR AUCTIONS ####

commands+=(
    # assuming 20 realms per zone
    # labor on 5 different food/non-food resources every day
    # 12 labor units needed per day for full-time
    # 20 * 5 * 12 = 960 labor units per day per zone as target

    # 0.1 decay = 1844674407370955161
    "sozo execute $config_systems set_labor_auction --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1844674407370955161,960,10"
)


# Read the System to Components JSON file
# system_components_json=$(cat ./scripts/system_models.json)

# Loop through each system
# for system in $(echo $system_components_json | jq -r 'keys[]'); do
#     # Loop through each component that the system writes to
#     for model in $(echo $system_components_json | jq -r ".$system[]"); do
#         # make the system a writer of the component
#         commands+=("sozo auth writer --world "$world" $model $system")
#     done
# done


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

