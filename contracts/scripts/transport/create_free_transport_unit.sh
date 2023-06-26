#!/bin/bash

read -p "Enter the entity ID: " entity_id
read -p "Enter the number of free transport units: " num_units

world="$SOZO_WORLD"
calldata="$entity_id,$num_units"

command="sozo execute --world $world CreateFreeTransportUnit --account-address $DOJO_ACCOUNT_ADDRESS --calldata $calldata"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
