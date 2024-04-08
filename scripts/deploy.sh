#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --release build

echo "Deploying world to Realms L3..."
sozo --release migrate --rpc-url https://api.cartridge.gg/x/realms/katana/ --name eternum4

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Setting up remote indexer on slot..."
slot deployments create eternum torii --version v0.6.0-alpha.3 --world $SOZO_WORLD --rpc https://api.cartridge.gg/x/realms/katana/ --start-block 0

echo "Setting up config..."
./scripts/set_config.sh --interval 2 --mode prod





