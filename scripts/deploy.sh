#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
slot deployments delete eternum-chat torii
slot deployments delete eternum-chat katana

echo "Deploying world to Realms L3..."
slot deployments create eternum-chat katana --version v1.0.0-alpha.9 --invoke-max-steps 25000000 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create eternum-chat torii --version v1.0.0-alpha.9 --world 0x6918fe8c1ba16bdc83b9790cd9168d730aa98a22c65164578ef99af1c8cbc76 --rpc https://api.cartridge.gg/x/eternum-chat/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/set_writer.sh --interval 1 --mode prod

bun --env-file=../client/.env.production ../config/index.ts


echo "Setting up bank..."
bun --env-file=../client/.env.production ../config/bank/index.ts