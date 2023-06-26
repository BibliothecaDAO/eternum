#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter Realm Entity Id: " entity_id
read -p "Enter resource type: " resource_type
read -p "Enter labor units: " labor_units 
read -p "Enter multiplier: " multiplier 

command="sozo execute --world $world BuildLabor --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,$resource_type,$labor_units,$multiplier"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
