#!/bin/bash

source ./scripts/contracts.sh

declare -a NPC_MODELS=("Npc" "RealmRegistry" "LastSpawned" "Owner" "EntityOwner" "Position" "Movable" "ArrivalTime")

NPC_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::npc::contracts::npc_systems" ).address')

LORE_MACHINE_PUB_KEY=0x175436af24aa0b0c720ebd341dd6c396fa03a02dd8379041191c773f5460e0b

MAX_NUM_RESIDENT_NPCS=5
MAX_NUM_NATIVE_NPCS=5
NPC_ENTITY_TYPE=259
SEC_PER_KM=800 # => 4.5 km/h

commands=(
	"sozo execute ${CONFIG_SYSTEMS} set_npc_config --account-address ${DOJO_ACCOUNT_ADDRESS} --calldata ${SOZO_WORLD},100,${LORE_MACHINE_PUB_KEY},${MAX_NUM_RESIDENT_NPCS},${MAX_NUM_NATIVE_NPCS}"
	# NPC speed
	# 800 sec per km = 4.5 km/h
	"sozo execute ${CONFIG_SYSTEMS} set_speed_config --account-address ${DOJO_ACCOUNT_ADDRESS} --calldata ${SOZO_WORLD},${NPC_ENTITY_TYPE},${SEC_PER_KM}"
)

for model in "${NPC_MODELS[@]}"; do
	# make the system a writer of the component
	commands+=("sozo auth writer --world ${SOZO_WORLD} ${model} ${NPC_SYSTEMS}")
done

# Ask the user for the desired delay between commands
read -p "Specify a delay in seconds between each command (or press Enter for no delay): " delay

# Check if the delay is a valid number (integer or floating point)
if [[ ! ${delay} =~ ^[0-9]*\.?[0-9]+$ ]]; then
	delay=0
fi

for cmd in "${commands[@]}"; do
	echo "Executing command: ${cmd}"
	output=$(eval "${cmd}")
	echo "Output:"
	echo "${output}"
	echo "--------------------------------------"

	if [[ $(echo "${delay} > 0" | bc -l) -eq 1 ]]; then
		echo "Sleeping for ${delay} seconds..."
		sleep "${delay}"
	fi
done
