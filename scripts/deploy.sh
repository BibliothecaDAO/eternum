#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
slot deployments delete eternum-24 torii
slot deployments delete eternum-24 katana

echo "Deploying world to Realms L3..."
slot deployments create eternum-28 katana --version v1.0.0-alpha.3 --invoke-max-steps 25000000 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create eternum-28 torii --version v1.0.0-alpha.3 --world 0x72bea8ba4bc0f95fb3313cc6b8b4228bbd38c329f53e972df7fe38fa055f357 --rpc https://api.cartridge.gg/x/eternum-28/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/set_writer.sh --interval 1  --mode prod 

bun --env-file=../client/.env.production ../config/index.ts


echo "Setting up bank..."
bun --env-file=../client/.env.production ../config/bank/index.ts