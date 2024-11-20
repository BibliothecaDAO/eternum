#!/bin/bash

# Create a Slot -> if deploying to slot
slot deployments create -t epic eternum-rc1-1 katana --version v1.0.1 --invoke-max-steps 10000000 --disable-fee true --block-time 2000

# get accounts 
# -> update prod env_variables.sh
# -> update .env.production
# -> update dojo_prod.toml
slot deployments accounts eternum-rc1-1 katana 

# get variables
VITE_PUBLIC_MASTER_ADDRESS=
VITE_PUBLIC_MASTER_PRIVATE_KEY=
VITE_PUBLIC_NODE_URL=eternum-rc1-1
SOZO_WORLD=0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2

# update variables
# if you have changed the name of the world you will need to update the address 
sh ./scripts/update_variables.sh 0x304202e63b4db2f125ff900a3423c92a684c21fb86a6036f273c473bb6c5dfa <> eternum-rc1-1 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2

# ------------------------------------------------------------------------------------------------
# Build and deploy season pass contracts
# @dev: only run this if deploying to slot
# ------------------------------------------------------------------------------------------------
printf "\n\n"
echo "----- Building Eternum Season Pass Contract ----- "

cd season_pass/contracts && scarb --release build
cd ../scripts/deployment && npm run deploy::prod 

# update the .env.production file with the season pass and test realms contracts addresses
VITE_SEASON_PASS_ADDRESS=$(cat ./addresses/prod/season_pass.json | jq -r '.address')
# VITE_REALMS_ADDRESS=$(cat ./addresses/prod/test_realms.json | jq -r '.address')
# VITE_LORDS_ADDRESS=$(cat ./addresses/prod/test_lords.json | jq -r '.address')

# remove the old addresses if they exist
ENV_FILE=../../../client/.env.production
sed -i '' '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
# sed -i '' '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
# sed -i '' '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

# add the new addresses to the ENV file
echo "" >> $ENV_FILE
echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    # echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    # echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

cd ../../../
printf "\n\n"


# ------------------------------------------------------------------------------------------------
# Build and deploy eternum contracts
# @dev: only run this if deploying to slot
# ------------------------------------------------------------------------------------------------

cd contracts

echo "Build contracts..."
sozo build --profile prod

echo "Deleting previous indexer and network..."
# slot deployments delete eternum-40 torii
# slot deployments delete eternum-40 katana

echo "Migrating world..."
sozo migrate --profile prod 

echo "Setting up remote indexer on slot..."
slot deployments create -t epic eternum-rc-sepolia-4 torii --version v1.0.1 --world 0x05013b17c43a2b664ec2a38aa45f6d891db1188622ec7cf320411321c3248fb5 --rpc https://api.cartridge.gg/x/starknet/sepolia --start-block 0  --index-pending true --config-file ./torii.toml

echo "Setting up config..."

# NOTE: THE SEASON PASS MUST BE SETUP BEFORE THE CONFIG IS SETUP
bun --env-file=../client/.env.production ../config/index.ts
