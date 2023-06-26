#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter taker_id: " taker_id
read -p "Enter trade_id: " trade_id

command="sozo execute --world $world TakeFungibleOrder --account-address $DOJO_ACCOUNT_ADDRESS --calldata $taker_id,$trade_id"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
