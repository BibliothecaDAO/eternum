#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deploying world to Realms L3..."
sozo --profile prod migrate apply --name eternum5 

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Setting up remote indexer on slot..."
slot deployments create eternum torii --version 0.6.1-alpha.4 --world $SOZO_WORLD --rpc https://api.cartridge.gg/x/realms/katana/ --start-block 0

echo "Setting up config..."
./scripts/set_config.sh --interval 2 --mode prod





