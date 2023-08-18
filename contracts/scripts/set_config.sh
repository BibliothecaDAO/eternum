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
    # NOTE: mint a random realm so that no player has the 0x0 entity id as a realm
    # because 0x0 is also used in make_fungible_order as taker_id to specify that any entity can take the order
    # TODO: need to rethink make_fungible_order so that we don't rely on taker_id 0x0 to know who can take order
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,$DOJO_ACCOUNT_ADDRESS,515,2,4,5,6,1,1,8,2,2087471,1610800"
)

prod=false  # Default value
# Check if --prod option is present
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        prod=true
    fi
fi

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"

    if [ "$prod" = true ]; then
        echo "Sleeping for 3 second..."
        sleep 3
    fi
done

