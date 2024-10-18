#!/bin/bash

# build and deploy season pass contracts
printf "\n\n"
echo "----- Building Eternum Season Pass Contract ----- "

cd season_pass/contracts && scarb --release build
cd ../scripts/deployment && npm run deploy 

# update the .env.production file with the season pass and test realms contracts addresses
VITE_SEASON_PASS_ADDRESS=$(cat ./addresses/dev/season_pass.json | jq -r '.address')
VITE_REALMS_ADDRESS=$(cat ./addresses/dev/test_realms.json | jq -r '.address')

# remove the old addresses if they exist
ENV_FILE=../../../client/.env.production
sed -i '' '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
sed -i '' '/VITE_REALMS_ADDRESS=/d' $ENV_FILE

# add the new addresses to the ENV file
echo "" >> $ENV_FILE
echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

cd ../../../
printf "\n\n"


# build eternum contracts
cd contracts


echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
slot deployments delete eternum-40 torii
slot deployments delete eternum-40 katana

echo "Deploying world to Realms L3..."
slot deployments create -t epic eternum-42 katana --version v1.0.0-alpha.16 --invoke-max-steps 25000000 --disable-fee true --block-time 1000

# get accounts
slot deployments accounts eternum-42 katana 

echo "Migrating world..."
sozo --profile prod migrate apply

echo "Setting up remote indexer on slot..."
slot deployments create -t epic eternum-42 torii --version v1.0.0-alpha.16 --world 0x320b2713e324fe3125bbc42d85ff69cb3c0908b436fa38a35746dbc45deeb11 --rpc https://api.cartridge.gg/x/eternum-42/katana --start-block 0  --index-pending true

echo "Setting up config..."

# update the config
source ./scripts/env_variables.sh prod
./scripts/set_writer.sh --interval 1 --mode prod

bun --env-file=../client/.env.production ../config/index.ts
