#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter realm_id: " realm_id

# Check if owner is empty and assign a default value
read -p "Enter owner address: " owner
if [ -z "$owner" ]; then
    owner=$DOJO_ACCOUNT_ADDRESS
fi

read -p "Enter packed resources (use pack_resources file): " packed_resources
if [ -z "$packed_resources" ]; then
    packed_resources=66051
fi

read -p "Enter number of packed resources: " packed_resources_len
if [ -z "$packed_resources_len" ]; then
    packed_resources_len=6
fi

read -p "Enter number of cities: " cities
if [ -z "$cities" ]; then
    cities=6
fi

read -p "Enter number of harbors: " harbors
if [ -z "$harbors" ]; then
    harbors=6
fi

read -p "Enter number of rivers: " rivers
if [ -z "$rivers" ]; then
    rivers=6
fi

read -p "Enter number of regions: " regions
if [ -z "$regions" ]; then
    regions=6
fi

read -p "Enter number of wonders: " wonder
if [ -z "$wonder" ]; then
    wonder=1
fi

read -p "Enter order: " order
if [ -z "$order" ]; then
    order=1
fi

read -p "Enter position x: " position_x
if [ -z "$position_x" ]; then
    position_x=100000
fi

read -p "Enter position y: " position_y
if [ -z "$position_y" ]; then
    position_y=200000
fi

commands=(
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata $realm_id,$owner,$packed_resources,$packed_resources_len,$cities,$harbors,$rivers,$regions,$wonder,$order,2,$position_x,$position_y"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
