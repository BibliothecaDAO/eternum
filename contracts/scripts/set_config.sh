#!/bin/bash

## TODO: create the whole config (all resource weight + all labor costs)

world="$SOZO_WORLD"

commands=(
    ### WORLD ###
    # realm_l2_contract
    "sozo execute --world $world SetWorldConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0"

    ### LABOR ###
    # base_labor_units 7200
    # base_resources_per_cycle 21
    # base_food_per_cycle 14000
    "sozo execute --world $world SetLaborConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 7200,21,14000"

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
    "sozo execute --world $world SetCapacityConfig --account-address $DOJO_ACCOUNT_ADDRESS --calldata 256,100000"

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

# Loop for resource types 1 to 28
for resource_type in {1..28}
do
    # resource_type_cost = 2,3
    # resource_type_value = 10,10
    commands+=(
        "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,515,2"
        # resource_type_cost = 3
        # resource_type_value = 10
        "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,2,10"
        # resource_type_cost = 3
        # resource_type_value = 10
        "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $resource_type,3,10"
    )
done

commands+=(
    # Resource type 254
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,515,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,2,10"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 254,3,10"

    # Resource type 255
    "sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,515,2"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,2,10"
    "sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata 255,3,10"
)


commands+=(
    # Define hyperstructure
    # hyperstructure type 1
    # resource 1,000 stone and 1,000 shekels
    # hyperstructure coordinate x: 800, y : 200 
    "sozo execute --world $world DefineHyperStructure --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1, 2,2,1000,3,1000, 800,200"
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

