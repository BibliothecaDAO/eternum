#!/bin/bash

## TODO: create the whole config (all resource weight + all labor costs)

world="$SOZO_WORLD"

resource_precision=1000

commands=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute --world $world SetWorldConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0"

    ### LABOR ###
    # base_labor_units 7200
    # base_resources_per_cycle 21
    # base_food_per_cycle 14000
    "sozo execute --world $world SetLaborConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7200,$((21 * resource_precision)),$((14000 * resource_precision))"

    ### SPEED ###
    # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # 360 sec per km = 10km/h
    "sozo execute --world $world SetSpeedConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,360"

    ### TRAVEL ###
    # free transport per city = 100 (for testing);
    "sozo execute --world $world SetTravelConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 100"

    ### CAPACITY ###
    # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # 100000 gr = 100 kg
    "sozo execute --world $world SetCapacityConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,$((100 * resource_precision))"

    ### ROAD ###
    # fee resource type = 2 # Stone
    # fee amount = 10
    # speed up transit by 2x = 2

    "sozo execute --world $world SetRoadConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,10,2"

)

### WEIGHT ###
# Loop for resource types 1 to 28
for resource_type in {1..28}
# for resource_type in {1..2}
do
    commands+=(
        # 1 g per resource
        "sozo execute --world $world SetWeightConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,1"
    )
done

### WEIGHT ###
commands+=(
    # Resource type 253
    "sozo execute --world $world SetWeightConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 253,1"
    # Resource type 254
    "sozo execute --world $world SetWeightConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,1"
    # Resource type 255
    "sozo execute --world $world SetWeightConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,1"
)


## LABOR COSTS
commands+=(
    # resourceId: 254
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,66051,3"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,1,171"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,2,134"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,3,131"
    # resourceId: 255
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,263430,3"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,4,289"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,5,242"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,6,190"
    # resourceId: 1
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,515,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,2,3274"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,3,3184"
    # resourceId: 2
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,259,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,1,4166"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,3,3184"
    # resourceId: 3
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,516,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,2,3274"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,4,2195"
    # resourceId: 4
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,261,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,1,4166"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,5,1841"
    # resourceId: 5
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,1030,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,4,2195"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,6,1446"
    # resourceId: 6
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,1287,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,5,1841"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 6,7,979"
    # resourceId: 7
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,1544,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,6,1446"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7,8,795"
    # resourceId: 8
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,1801,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,7,979"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 8,9,759"
    # resourceId: 9
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,2058,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,8,795"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 9,10,493"
    # resourceId: 10
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,2315,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,9,759"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 10,11,249"
    # resourceId: 11
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,2572,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,10,493"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 11,12,205"
    # resourceId: 12
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,2829,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,11,249"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 12,13,198"
    # resourceId: 13
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,3086,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,12,205"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 13,14,198"
    # resourceId: 14
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,3343,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,13,198"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 14,15,142"
    # resourceId: 15
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,3600,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,14,198"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 15,16,134"
    # resourceId: 16
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,3857,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,15,142"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 16,17,115"
    # resourceId: 17
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,4114,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,16,134"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 17,18,92"
    # resourceId: 18
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,4371,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,17,115"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 18,19,77"
    # resourceId: 19
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,4630,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,18,92"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 19,22,19"
    # resourceId: 20
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,4885,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,19,77"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 20,21,30"
    # resourceId: 21
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,5142,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,20,45"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 21,22,19"
    # resourceId: 22
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,5141,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,20,45"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 22,21,30"
)


commands+=(
    # Define hyperstructures
    # @dev generated using data/hyperstructures/generateCommands.js
    # data => ./contracts/data/hyperstructures/hyperstructures.json
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1652610,2103276"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2621909,1458147"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1650208,1764081"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2919158,2127177"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,740492,1446359"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2445183,2275580"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1954116,2171570"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1412094,1993452"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,893997,1873356"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2509517,1884363"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1097424,1476206"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1572668,1517683"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,1906818,1409047"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2072443,1712964"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,2844078,1697894"
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1,1744340,2,1370780,3,1333220,4,919300,22,1,43608500,2,34269500,3,33330500,4,22982500,5,19269500,6,15138999,7,10252000,8,8321500,9,7948000,10,5165000,11,2608500,12,2148000,13,2078500,14,2078500,15,1495500,16,1408500,17,1208500,18,965000,19,808500,20,478500,21,321500,22,200000,605410,2023632"
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
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,$DOJO_ACCOUNT_ADDRESS,515,2,4,5,6,1,1,8,2,2087471,1610800"
)


#### SET LABOR AUCTIONS ####

commands+=(
    # assuming 20 realms per zone
    # labor on 5 different food/non-food resources every day
    # 12 labor units needed per day for full-time
    # 20 * 5 * 12 = 960 labor units per day per zone as target

    # 0.1 decay = 1844674407370955161
    "sozo execute --world $world CreateLaborAuction --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1844674407370955161,960,10"
)


# Read the System to Components JSON file
system_components_json=$(cat ./scripts/system_components.json)

# Loop through each system
for system in $(echo $system_components_json | jq -r 'keys[]'); do
    # Loop through each component that the system writes to
    for component in $(echo $system_components_json | jq -r ".$system[]"); do
        # make the system a writer of the component
        commands+=("sozo auth writer --world "$world" $component $system")
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

