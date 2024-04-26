#!/bin/bash

export WORLD=0x55febeb6e93ac3b2d237ed2f2724cd9362260c02cfa6dd73378ac85efb3505d

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deploying world to Realms L3..."
sozo --profile prod migrate apply --name eternum6

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Setting up remote indexer on slot..."
slot deployments create eternum-5 torii --version 0.6.1-alpha.4 --world $WORLD --rpc https://api.cartridge.gg/x/realms/katana/ --start-block 0

echo "Setting up config..."
./scripts/set_config.sh --interval 2 --mode prod





