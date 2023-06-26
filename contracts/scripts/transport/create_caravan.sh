#!/bin/bash

read -p "Enter the transport units (comma-separated): " transport_units

world="$SOZO_WORLD"
IFS=',' read -ra units_array <<< "$transport_units"
num_units=${#units_array[@]}
calldata="$num_units,$transport_units"

command="sozo execute --world $world CreateCaravan --calldata $calldata"

echo "Executing command: $command"
output=$(eval "$command")
echo "Output:"
echo "$output"
