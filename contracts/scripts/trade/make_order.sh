#!/bin/bash

# TODO: in order for easy testing in the UI, we should create scripts that set the game into a certain state
# like 2 people trading resources and waiting for their caravans to arrive

world="$SOZO_WORLD"

read -p "Enter maker_id: " maker_id
read -p "Enter taker_id: " taker_id

# maker_id
# maker_entity_types = 1,2 (len 2)
# maker_quantities = 50, 100 (len 2)
# taker_id
# taker_entity_types = 3,4 (len 2)
# taker_quantities = 200, 300 (len 2)
# taker_needs_caravan = 0
# expires_at = 100000000000000000000
# calldata = 1, 2, 1, 2, 2, 50, 100, 2, 2, 3, 4, 2, 200, 300, 0
command="sozo execute --world $world MakeFungibleOrder --calldata $maker_id,2,1,2,2,50,100,$taker_id,2,3,4,2,200,300,1,1000000000000"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
