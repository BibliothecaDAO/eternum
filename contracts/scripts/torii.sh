#!/bin/bash
set -e

source ./scripts/env_variables.sh dev

export STARKNET_RPC_URL=http://katana:5050

sozo migrate --rpc-url $STARKNET_RPC_URL

torii --world $SOZO_WORLD --rpc $STARKNET_RPC_URL &

# echo "Waiting for torii to boot..."
sleep 5

if [ -z "$RESTART_TORII" ]; then
	printf '0.1\n' | ./scripts/set_config.sh
fi

sleep 1000000000000