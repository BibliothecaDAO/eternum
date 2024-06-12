#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deploying world to Realms L3..."
sozo --profile prod migrate apply --name eternum

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Setting up remote indexer on slot..."
slot deployments create eternum-18 torii --version v0.7.0-alpha.5 --world 0x455860f93fad20b93ab401eaf9bb63bf86a8222ffe4b0a4216d4694603f4723 --rpc https://api.cartridge.gg/x/eternum-17/katana --start-block 0  --index-pending true

bun --env-file=../client/.env.production ../config/index.ts

echo "Setting up config..."
./scripts/set_writer.sh --interval 1  --mode prod 


echo "Setting up bank..."
./scripts/set_admin_bank.sh --mode prod --interval 2