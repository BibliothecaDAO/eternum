#!/bin/bash

cd contracts


echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
slot deployments delete eternum-40 torii
slot deployments delete eternum-40 katana

echo "Deploying world to Realms L3..."
slot deployments create eternum-41 katana --version v1.0.0-alpha.12 --invoke-max-steps 25000000 --disable-fee true --block-time 1000

# get accounts
slot deployments accounts eternum-41 katana 

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create eternum-41 torii --version v1.0.0-alpha.12 --world 0x76ca3dfc3e96843716f882546f0db96b7da0cf988bdba284b469d0defb2f48f --rpc https://api.cartridge.gg/x/eternum-41/katana --start-block 0  --index-pending true

echo "Setting up config..."

# update the config
source ./scripts/env_variables.sh prod
./scripts/set_writer.sh --interval 1 --mode prod

bun --env-file=../client/.env.production ../config/index.ts
