#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter entity_id: " entity_id
read -p "Enter trade_id: " trade_id
read -p "Enter caravan_id: " caravan_id

command="sozo execute --world $world AttachCaravan --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,$trade_id,$caravan_id"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
