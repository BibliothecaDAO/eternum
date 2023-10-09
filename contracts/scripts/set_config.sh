#!/bin/bash

world="$SOZO_WORLD"
config_systems="0x4f20cbbf05e68381835b37f121a25579db3c590e0f9d46bddc9c3ef3bfa6fab"
labor_systems="0x335327d78d09ed985634747744dad73448cfc4fc4cd38e118ca0b5974b79b57"
realm_systems="0x3fb814a3500e64f6df3fbaaffccd6d697f7fa8b385f2d94cbdee9fa86325bc"
resource_systems="0x4f59f4df4e7044f7bea774a186b6ebc1bde4121b7b023db6ed62c5a0f335f25"
hyperstructure_systems="0x7fc13e19c4638228b4d110e44146456e202d29849b9cbb0ddfffcc8bdf0785e"

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
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,1,2058"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,2,1617"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,254,3,1573"
# resourceId: 255
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,263430,3"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,4,3477"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,5,2915"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,255,6,2290"
# resourceId: 1
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,515,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,2,39292"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,1,3,38215"
# resourceId: 2
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,259,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,1,50000"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,2,3,38215"
# resourceId: 3
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,516,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,2,39292"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,3,4,26350"
# resourceId: 4
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,261,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,1,50000"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,4,5,22093"
# resourceId: 5
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,1030,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,4,26350"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,5,6,17357"
# resourceId: 6
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,1287,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,5,22093"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,6,7,11754"
# resourceId: 7
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,1544,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,6,17357"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,7,8,9541"
# resourceId: 8
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,1801,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,7,11754"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,8,9,9112"
# resourceId: 9
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,2058,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,8,9541"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,9,10,5922"
# resourceId: 10
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,2315,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,9,9112"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,10,11,2991"
# resourceId: 11
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,2572,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,10,5922"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,11,12,2462"
# resourceId: 12
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,2829,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,11,2991"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,12,13,2382"
# resourceId: 13
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,3086,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,12,2462"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,13,14,2382"
# resourceId: 14
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,3343,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,13,2382"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,14,15,1714"
# resourceId: 15
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,3600,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,14,2382"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,15,16,1615"
# resourceId: 16
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,3857,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,15,1714"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,16,17,1385"
# resourceId: 17
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,4114,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,16,1615"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,17,18,1106"
# resourceId: 18
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,4371,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,17,1385"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,18,19,927"
# resourceId: 19
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,4630,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,18,1106"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,19,22,229"
# resourceId: 20
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,4885,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,19,927"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,20,21,368"
# resourceId: 21
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,5142,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,20,548"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,21,22,229"
# resourceId: 22
"sozo execute $config_systems set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,5141,2"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,20,548"
"sozo execute $config_systems set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $world,22,21,368"
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

