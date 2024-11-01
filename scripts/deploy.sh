#!/bin/bash

# build and deploy season pass contracts
printf "\n\n"
echo "----- Building Eternum Season Pass Contract ----- "

cd season_pass/contracts && scarb --release build
cd ../scripts/deployment && npm run deploy::prod 

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

# If deploying to slot
echo "Deploying world to Realms L3..."
slot deployments create -t epic eternum-rc0 katana --version v1.0.0-rc.0 --invoke-max-steps 10000000 --disable-fee true --block-time 2000

# get accounts
slot deployments accounts eternum-rc0 katana 

echo "Migrating world..."
sozo --profile prod migrate

echo "Setting up remote indexer on slot..."
slot deployments create -t epic eternum-rc0 torii --version v1.0.0-rc.0 --world 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2 --rpc https://api.cartridge.gg/x/eternum-rc0/katana --start-block 0  --index-pending true

echo "Setting up config..."

# NOTE: THE SEASON PASS MUST BE SETUP BEFORE THE CONFIG IS SETUP
bun --env-file=../client/.env.production ../config/index.ts
