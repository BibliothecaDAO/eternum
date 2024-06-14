#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deploying world to Realms L3..."
sozo --profile prod migrate apply --name eternum1

echo "Deleting previous indexer..."
slot deployments delete eternum torii

echo "Setting up remote indexer on slot..."
slot deployments create eternum-19 torii --version v0.7.0-alpha.5 --world 0x3731cc419863d4112dde39187122286dcbd9950d89053892087481d3ad6bb82 --rpc https://api.cartridge.gg/x/eternum-17/katana --start-block 0  --index-pending true

bun --env-file=../client/.env.production ../config/index.ts

echo "Setting up config..."
./scripts/set_writer.sh --interval 1  --mode prod 


echo "Setting up bank..."
./scripts/set_admin_bank.sh --mode prod --interval 2