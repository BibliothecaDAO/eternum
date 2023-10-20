#!/bin/bash

CONFIG_SYSTEMS="0xd81a66847b86b0aca0d66053b731e701f745e42c1ed40d59ae3221b1a52711";
LABOR_SYSTEMS="0x4c171c6de260a9865743d05ba27771b9c758fa176a88982982facaca188cf65";
TRADE_SYSTEMS="0x2139d726bf9c34b3d0f68e740a16233604993534ad809329ac5788fa136adf1";
HYPERSTRUCTURE_SYSTEMS="0xca23e4b5195bc2560bd537b35b9ef45f6e49a0923d8ecd36c515a423ae269";
RESOURCE_SYSTEMS="0x3515736afe8663c5e673df2a7db08ed55b90c79b9a81e71d537d6962de6fd98";
CARAVAN_SYSTEMS="0x693a6c8b9643cfcdb3e3eb63c3b76aca7b80eaec17d46662714ca6d2bfe8c26";
ROAD_SYSTEMS="0x489761647ff04e1163659537e9b4967a67ddbfc3be73aa60f8039e69c3ee74d";
TRANSPORT_UNIT_SYSTEMS="0x155b8cbe4b8c2464ab60db85411dffdd57d28320c93246dd3c02bdee2d18479";
TRAVEL_SYSTEMS="0x70717be365c143d9f4ae207e420d0c3525a7c79197a20e6e63e4dec0b1b26cd";
TEST_REALM_SYSTEMS="0xee850f8d8ded18763d23e35d3592f9549081124bee0c32ffb2ef355deb1b68";
TEST_RESOURCE_SYSTEMS="0x17505387265fa24a4846cb3b3207aa92c3e6f918f74883a43be959265d19e44";

resource_precision=1000

commands=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute $CONFIG_SYSTEMS set_world_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,0"

    # ### LABOR ###
    # # base_labor_units 7200
    # # base_resources_per_cycle 21
    # # base_food_per_cycle 14000
    "sozo execute $CONFIG_SYSTEMS set_labor_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7200,$((21 * resource_precision)),$((14000 * resource_precision))"

    # ### SPEED ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 360 sec per km = 10km/h
    "sozo execute $CONFIG_SYSTEMS set_speed_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,256,360"

    # ### TRAVEL ###
    # # free transport per city = 100 (for testing);
    "sozo execute $CONFIG_SYSTEMS set_travel_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,100"

    # ### CAPACITY ###
    # # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # # 100000 gr = 100 kg
    "sozo execute $CONFIG_SYSTEMS set_capacity_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,256,$((100 * resource_precision))"

    # ### ROAD ###
    # # fee resource type = 2 # Stone
    # # fee amount = 10
    # # speed up transit by 2x = 2
    "sozo execute $CONFIG_SYSTEMS set_road_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,10,2"

)

### WEIGHT ###
# Loop for resource types 1 to 28
for resource_type in {1..28}
do
    commands+=(
        # 1 g per resource
        "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,$resource_type,1"
    )
done

### WEIGHT ###
commands+=(
    # Resource type 253
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,253,1"
    # Resource type 254
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,1"
    # Resource type 255
    "sozo execute $CONFIG_SYSTEMS set_weight_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,1"
)


## LABOR COSTS
commands+=(
# resourceId: 254
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,66051,3"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,1,171"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,2,134"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,254,3,131"
# resourceId: 255
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,263430,3"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,4,289"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,5,242"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,255,6,190"
# resourceId: 1
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,515,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,2,3274"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,3,3184"
# resourceId: 2
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,259,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,1,4166"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,2,3,3184"
# resourceId: 3
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,516,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,2,3274"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,3,4,2195"
# resourceId: 4
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,261,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,1,4166"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,4,5,1841"
# resourceId: 5
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,1030,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,4,2195"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,5,6,1446"
# resourceId: 6
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,1287,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,5,1841"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,6,7,979"
# resourceId: 7
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,1544,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,6,1446"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,7,8,795"
# resourceId: 8
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,1801,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,7,979"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,8,9,759"
# resourceId: 9
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,2058,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,8,795"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,9,10,493"
# resourceId: 10
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,2315,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,9,759"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,10,11,249"
# resourceId: 11
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,2572,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,10,493"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,11,12,205"
# resourceId: 12
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,2829,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,11,249"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,12,13,198"
# resourceId: 13
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,3086,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,12,205"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,13,14,198"
# resourceId: 14
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,3343,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,13,198"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,14,15,142"
# resourceId: 15
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,3600,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,14,198"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,15,16,134"
# resourceId: 16
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,3857,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,15,142"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,16,17,115"
# resourceId: 17
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,4114,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,16,134"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,17,18,92"
# resourceId: 18
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,4371,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,17,115"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,18,19,77"
# resourceId: 19
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,4630,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,18,92"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,19,22,19"
# resourceId: 20
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,4885,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,19,77"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,20,21,30"
# resourceId: 21
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,5142,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,20,45"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,21,22,19"
# resourceId: 22
"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,5141,2"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,20,45"
"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,22,21,30"
)


commands+=(
    # Define hyperstructures
    # @dev generated using data/hyperstructures/generateCommands.js
    # data => ./contracts/data/hyperstructures/hyperstructures.json
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1652610,2103276"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2621909,1458147"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1650208,1764081"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2919158,2127177"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,740492,1446359"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2445183,2275580"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1954116,2171570"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1412094,1993452"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,893997,1873356"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2509517,1884363"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1097424,1476206"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1572668,1517683"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1906818,1409047"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2072443,1712964"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2844078,1697894"
    "sozo execute $CONFIG_SYSTEMS create_hyperstructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,605410,2023632"
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
    "sozo execute $TEST_REALM_SYSTEMS create --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,$DOJO_ACCOUNT_ADDRESS,515,2,4,5,6,1,1,8,2,2087471,1610800"
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

