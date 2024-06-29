#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deploying world to Realms L3..."
slot deployments create eternum-23 katana --version v0.7.2 --invoke-max-steps 25000000 --disable-fee true --block-time 3000

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Migrating world..."
sozo --profile prod migrate apply --name eternum

echo "Setting up remote indexer on slot..."
slot deployments create eternum-23 torii --version v0.7.2 --world 0x161b08e252b353008665e85ab5dcb0044a61186eb14b999657d14c04c94c824 --rpc https://api.cartridge.gg/x/eternum-23/katana --start-block 0  --index-pending true

bun --env-file=../client/.env.production ../config/index.ts

echo "Setting up config..."
./scripts/set_writer.sh --interval 1  --mode prod 

echo "Setting up bank..."
bun --env-file=../client/.env.production ../config/bank/index.ts