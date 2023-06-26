#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter maker_id: " maker_id
if [ -z "$maker_id" ]; then
    maker_id=1
fi

read -p "Enter taker_id: " taker_id
if [ -z "$taker_id" ]; then
    taker_id=2
fi

maker_entity_types=""
maker_entity_amounts=""

while true; do
    read -p "Enter resource type for maker (press Enter to skip): " resource_type
    if [ -z "$resource_type" ]; then
        break
    fi

    read -p "Enter resource amount for maker: " resource_amount

    if [ -n "$maker_entity_types" ]; then
        maker_entity_types+=",$resource_type"
        maker_entity_amounts+=",$resource_amount"
    else
        maker_entity_types="$resource_type"
        maker_entity_amounts="$resource_amount"
    fi
done

# Calculate the length of maker_entity_types
IFS=',' read -ra maker_entity_types_arr <<< "$maker_entity_types"
maker_entity_types_len=${#maker_entity_types_arr[@]}

taker_entity_types=""
taker_entity_amounts=""

while true; do
    read -p "Enter resource type for taker (press Enter to skip): " resource_type
    if [ -z "$resource_type" ]; then
        break
    fi

    read -p "Enter resource amount for taker: " resource_amount

    if [ -n "$taker_entity_types" ]; then
        taker_entity_types+=",$resource_type"
        taker_entity_amounts+=",$resource_amount"
    else
        taker_entity_types="$resource_type"
        taker_entity_amounts="$resource_amount"
    fi
done

# Calculate the length of taker_entity_types
IFS=',' read -ra taker_entity_types_arr <<< "$taker_entity_types"
taker_entity_types_len=${#taker_entity_types_arr[@]}

# taker_needs_caravan = 1
# expires_at = 100000000000000000000
command="sozo execute --world $world MakeFungibleOrder --account-address $DOJO_ACCOUNT_ADDRESS --calldata $maker_id,$maker_entity_types_len,$maker_entity_types,$maker_entity_types_len,$maker_entity_amounts,$taker_id,$taker_entity_types_len,$taker_entity_types,$taker_entity_types_len,$taker_entity_amounts,1,1000000000000"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
