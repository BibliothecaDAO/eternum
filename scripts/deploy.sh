#!/bin/bash

cd contracts
source ./scripts/env_variables.sh prod

echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
slot deployments delete eternum-40 torii
slot deployments delete eternum-40 katana

echo "Deploying world to Realms L3..."
slot deployments create eternum-40 katana --tier epic --version v1.0.0-alpha.12 --invoke-max-steps 25000000 --disable-fee true --block-time 1000

echo "Migrating world..."
sozo --profile prod migrate apply --walnut

echo "Setting up remote indexer on slot..."
slot deployments create eternum-40 torii --tier epic --version v1.0.0-alpha.12 --world 0x76ca3dfc3e96843716f882546f0db96b7da0cf988bdba284b469d0defb2f48f --rpc https://api.cartridge.gg/x/eternum-40/katana --start-block 0  --index-pending true

echo "Setting up config..."
./scripts/set_writer.sh --interval 1 --mode prod

bun --env-file=../client/.env.production ../config/index.ts


echo "Setting up bank..."
bun --env-file=../client/.env.production ../config/bank/index.ts