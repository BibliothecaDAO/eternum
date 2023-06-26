#!/bin/bash

## TODO: create the whole config (all resource weight + all labor costs)

world="$SOZO_WORLD"

commands=(
    ### WORLD ###
    # day_timee
    # vault_bp
    # base_resource_per_day = 252
    # vault_time 
    # lords_per_day
    # tick_time
    # realm_l2_contract
    "sozo execute --world $world SetWorldConfig --calldata 0,0,252000000000000000000,0,0,0,0"

    ### LABOR ###
    # base_labor_units 7200
    # vault_percentage 250
    # base_resources_per_cycle 21000000000000000000
    "sozo execute --world $world SetLaborConfig --calldata 7200,250,21000000000000000000"
    # resource_type_labor = 1
    # resource_types_packed = 515 (3 et 2)
    # resource_types_count = 2
    "sozo execute --world $world SetLaborCostResources --calldata 1,515,2"
    # resource_type_labor = 1
    # resource_type_cost = 2
    # resource_type_value = 10
    "sozo execute --world $world SetLaborCostAmount --calldata 1,2,10"
    # resource_type_labor = 1
    # resource_type_cost = 3
    # resource_type_value = 10
    "sozo execute --world $world SetLaborCostAmount --calldata 1,3,10"

    ### SPEED ###
    # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # 360 sec per km = 10km/h
    "sozo execute --world $world SetSpeedConfig --calldata 256,360"

    ### TRAVEL ###
    # free transport per city = 10;
    "sozo execute --world $world SetTravelConfig --calldata 10"

    ### CAPACITY ###
    # entity type FREE_TRANSPORT_ENTITY_TYPE = 256
    # 100000 gr = 100 kg
    "sozo execute --world $world SetCapacityConfig --calldata 256,100000"

    ### WEIGHT ###
    # 1 gr for resource type 1,2,3,4
    "sozo execute --world $world SetWeightConfig --calldata 1,1"
    "sozo execute --world $world SetWeightConfig --calldata 2,1"
    "sozo execute --world $world SetWeightConfig --calldata 3,1"
    "sozo execute --world $world SetWeightConfig --calldata 4,1"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
