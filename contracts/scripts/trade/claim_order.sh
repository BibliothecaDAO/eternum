#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter entity_id: " entity_id
read -p "Enter trade_id: " trade_id

command="sozo execute --world $world ClaimFungibleOrder --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,$trade_id"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
