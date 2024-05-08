#!/bin/bash

source ./scripts/contracts.sh

delay=0

# Function to show usage
usage() {
    echo "Usage: $0  [--interval delay]"
    exit 1
}

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mode) mode="${2:-}"; shift 2;;
        --interval) delay="${2:-}"; shift 2;;
        *) usage;;
    esac
done

NPC_SYSTEMS=$(get_contract_address "eternum::systems::npc::contracts::npc_systems")

LORE_MACHINE_PUB_KEY=0x175436af24aa0b0c720ebd341dd6c396fa03a02dd8379041191c773f5460e0b


NPC_SPAWN_DELAY=100
MAX_NUM_RESIDENT_NPCS=5
MAX_NUM_NATIVE_NPCS=5
NPC_ENTITY_TYPE=259
SEC_PER_KM=800 # => 4.5 km/h

commands=(
	"sozo execute ${CONFIG_SYSTEMS} set_npc_config --account-address ${DOJO_ACCOUNT_ADDRESS} --calldata ${NPC_SPAWN_DELAY},${LORE_MACHINE_PUB_KEY},${MAX_NUM_RESIDENT_NPCS},${MAX_NUM_NATIVE_NPCS}"
	# NPC speed
	# 800 sec per km = 4.5 km/h
	"sozo execute ${CONFIG_SYSTEMS} set_speed_config --account-address ${DOJO_ACCOUNT_ADDRESS} --calldata ${NPC_ENTITY_TYPE},${SEC_PER_KM}"
)

# Read the System to Components JSON file
system_models_json=$(cat ./scripts/npc_models.json)


# Loop through each system
for system in $(echo $system_models_json | jq -r 'keys[]'); do
    # Loop through each component that the system writes to
    for model in $(echo $system_models_json | jq -r ".$system[]"); do
        system_var="${system}"
        contract_address="${!system_var}"
        # make the system a writer of the component
		commands+=("sozo auth grant writer $model,$contract_address")
    done
done

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