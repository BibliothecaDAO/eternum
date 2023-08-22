#!/bin/bash

world="$SOZO_WORLD"

## mints 2 realms with predefined options

# TODO: find the right propoerties of each realm
## position + resources OK, need to do the rest (harbors, rivers, cities etc)
commands=(
    # realm 2
    ## name: Ilgzhijajilg
    ## 6627269347851 = 6, 7, 8, 9, 10, 11
    ## position = ["1140133", "5246"]
    ## ["Coal"]
    ## 3
    ## order = perfection = 9
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,$DOJO_ACCOUNT_ADDRESS,3,1,4,5,6,1,1,9,2,2940133,1805246"
    # realm 3
    ## name: Hetokamohuti
    ## position = ["-1074801", "166004"]
    ## ["Wood", "Stone", "Copper"]
    ## [1, 2, 4]
    ## order = rage = 15
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,$DOJO_ACCOUNT_ADDRESS,66052,3,4,5,6,1,1,15,2,725199,1966004"
    # realm 4
    ## name: Egonal
    ## position = ["-543670", "-333106"]
    ## "Copper", "Wood", "Ironwood", "Obsidian", "Coal", "Stone"
    ## [4, 1, 7, 5, 3, 2]
    ## order = fox = 6 
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,$DOJO_ACCOUNT_ADDRESS,4402459247362,6,4,5,6,1,1,6,2,1256330,1466894"
    # realm 5
    ## name: ‘oak Leukue
    ## position = ["-922801", "-545996"]
    ## ["Gold"]
    ## 9
    ## order = twins = 13
    "sozo execute --world $world CreateRealm --account-address $DOJO_ACCOUNT_ADDRESS --calldata 5,$DOJO_ACCOUNT_ADDRESS,9,1,4,5,6,1,1,13,2,877199,1254004"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
