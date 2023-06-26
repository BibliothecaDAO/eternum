#!/bin/bash

world="$SOZO_WORLD"

read -p "Enter Realm Entity Id: " entity_id
read -p "Enter resource type: " resource_type

command="sozo execute --world $world HarvestLabor --account-address $DOJO_ACCOUNT_ADDRESS --calldata $entity_id,$resource_type"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
