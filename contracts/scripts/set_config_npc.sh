#!/bin/bash

source ./scripts/contracts.sh

declare -a NPC_MODELS=("Npc" "NpcConfig" "LastSpawned")

NPC_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::npc::contracts::npc_systems" ).address')

LORE_MACHINE_PUB_KEY=0x141a26313bd3355fe4c4f3dda7e40dfb77ce54aea5f62578b4ec5aad8dd63b1

commands=(
    "sozo execute $CONFIG_SYSTEMS set_npc_config --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,100,$LORE_MACHINE_PUB_KEY"
)

for model in "${NPC_MODELS[@]}"
do
    # make the system a writer of the component
    commands+=("sozo auth writer --world "$SOZO_WORLD" $model ${NPC_SYSTEMS}")
done


# Ask the user for the desired delay between commands
read -p "Specify a delay in seconds between each command (or press Enter for no delay): " delay

# Check if the delay is a valid number (integer or floating point)
if [[ ! "$delay" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    delay=0
fi

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"

    if [ $(echo "$delay > 0" | bc -l) -eq 1 ]; then
        echo "Sleeping for $delay seconds..."
        sleep $delay
    fi
done

