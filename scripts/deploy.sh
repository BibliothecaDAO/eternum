#!/bin/bash

# Create a Slot -> if deploying to slot
slot deployments create -t epic eternum-rc0 katana --version v1.0.0-rc.0 --invoke-max-steps 10000000 --disable-fee true --block-time 2000

# get accounts 
# -> update prod env_variables.sh
# -> update .env.production
# -> update dojo_prod.toml
slot deployments accounts eternum-rc0 katana 

# get variables
VITE_PUBLIC_MASTER_ADDRESS=0x46f957b7fe3335010607174edd5c4c3fae87b12c3760dc167ac738959d8c03b
VITE_PUBLIC_MASTER_PRIVATE_KEY=0x66184a4482615568262bb3e63eb02517eece88afc39c3b5222467e7551611ad
VITE_PUBLIC_NODE_URL=eternum-rc0
SOZO_WORLD=0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2

# update variables
# if you have changed the name of the world you will need to update the address 
sh ./update_variables.sh 0x46f957b7fe3335010607174edd5c4c3fae87b12c3760dc167ac738959d8c03b 0x66184a4482615568262bb3e63eb02517eece88afc39c3b5222467e7551611ad eternum-rc0 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2

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
VITE_REALMS_ADDRESS=$(cat ./addresses/prod/test_realms.json | jq -r '.address')
VITE_LORDS_ADDRESS=$(cat ./addresses/prod/test_lords.json | jq -r '.address')

# remove the old addresses if they exist
ENV_FILE=../../../client/.env.production
sed -i '' '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
sed -i '' '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
sed -i '' '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

# add the new addresses to the ENV file
echo "" >> $ENV_FILE
echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

cd ../../../
printf "\n\n"


# ------------------------------------------------------------------------------------------------
# Build and deploy eternum contracts
# @dev: only run this if deploying to slot
# ------------------------------------------------------------------------------------------------

cd contracts

echo "Build contracts..."
sozo --profile prod build

echo "Deleting previous indexer and network..."
# slot deployments delete eternum-40 torii
# slot deployments delete eternum-40 katana

echo "Migrating world..."
sozo --profile prod migrate

echo "Setting up remote indexer on slot..."
slot deployments create -t epic eternum-rc0 torii --version v1.0.0-rc.0 --world 0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2 --rpc https://api.cartridge.gg/x/eternum-rc0/katana --start-block 0  --index-pending true

echo "Setting up config..."

# NOTE: THE SEASON PASS MUST BE SETUP BEFORE THE CONFIG IS SETUP
bun --env-file=../client/.env.production ../config/index.ts
