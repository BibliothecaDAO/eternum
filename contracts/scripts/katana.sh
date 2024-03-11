#!/bin/bash
set -e

export STARKNET_RPC_URL=http://host.docker.internal:5050

katana --disable-fee --dev &

# Waiting for katana to boot
echo "Waiting for katana to boot before migrating..."
sleep 2

source ./scripts/env_variables.sh dev
sozo migrate --rpc-url $STARKNET_RPC_URL

printf '0.1\n' | ./scripts/set_config.sh
printf '0.1\n' | ./scripts/set_config_npc.sh

sleep 1000000000000