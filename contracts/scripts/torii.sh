#!/bin/bash
set -e

source ./scripts/env_variables.sh dev

export STARKNET_RPC_URL=http://katana:5050

torii --world $SOZO_WORLD --rpc $STARKNET_RPC_URL --database $WORLD_DB
