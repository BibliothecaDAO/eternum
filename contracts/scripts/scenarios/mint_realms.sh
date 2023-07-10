#!/bin/bash

world="$SOZO_WORLD"

## mints 2 realms with predefined options

# TODO: find the right propoerties of each realm
## position + resources OK, need to do the rest (harbors, rivers, cities etc)
commands=(
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
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,515,2,4,5,6,1,1,8,2087471,1610800"
    # realm 2
    ## name: Ilgzhijajilg
    ## 6627269347851 = 6, 7, 8, 9, 10, 11
    ## position = ["1140133", "5246"]
    ## ["Coal"]
    ## 3
    ## order = perfection = 9
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,3,1,4,5,6,1,1,9,2940133,1805246"
    # realm 3
    ## name: Hetokamohuti
    ## position = ["-1074801", "166004"]
    ## ["Wood", "Stone", "Copper"]
    ## [1, 2, 4]
    ## order = rage = 15
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,66052,3,4,5,6,1,1,15,725199,1966004"
    # realm 4
    ## name: Egonal
    ## position = ["-543670", "-333106"]
    ## "Copper", "Wood", "Ironwood", "Obsidian", "Coal", "Stone"
    ## [4, 1, 7, 5, 3, 2]
    ## order = fox = 6 
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,4402459247362,6,4,5,6,1,1,6,1256330,1466894"
    # realm 5
    ## name: ‘oak Leukue
    ## position = ["-922801", "-545996"]
    ## ["Gold"]
    ## 9
    ## order = twins = 13
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,0x06f62894bfd81d2e396ce266b2ad0f21e0668d604e5bb1077337b6d570a54aea,9,1,4,5,6,1,1,13,877199,1254004"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
