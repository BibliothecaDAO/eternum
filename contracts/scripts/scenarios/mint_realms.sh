#!/bin/bash

world="$SOZO_WORLD"

## mints 2 realms with predefined options

commands=(
    ## realm 1:
    ## resources_ids_packed = 4328719365 (1,2,3,4,5)
    ## cities = 4
    ## harbors = 5
    ## rivers = 6
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,4328719365,4,4,5,6,1,1,1,100000,200000"
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,1,1,1,1,1,1,1,1,200000,1000000"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
