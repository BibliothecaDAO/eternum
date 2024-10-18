#!/bin/bash

setConfig=""

# Function to show usage
usage() {
    echo "Usage: $0 [--setConfig]"
    exit 1
}

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --setConfig) setConfig="true"; shift 1;;
        *) usage;;
    esac
done

if [[ "$setConfig" == "true" ]]; then
    printf "\n\n"
    echo "----- Building Eternum Season Pass Contract ----- "
    printf "\n\n"

    # build and deploy season pass contract
    cd season_pass/contracts && scarb --release build
    cd ../scripts/deployment && npm run deploy 

    # update the .env.local file with the season pass and test realms contracts addresses
    VITE_SEASON_PASS_ADDRESS=$(cat ./addresses/dev/season_pass.json | jq -r '.address')
    VITE_REALMS_ADDRESS=$(cat ./addresses/dev/test_realms.json | jq -r '.address')
    VITE_LORDS_ADDRESS=$(cat ./addresses/dev/test_lords.json | jq -r '.address')

    # remove the old addresses if they exist
    ENV_FILE=../../../client/.env.local
    sed -i '' '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
    sed -i '' '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
    sed -i '' '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

    # add the new addresses to the .env.local file
    echo "" >> $ENV_FILE
    echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

    cd ../../../
    printf "\n\n"
fi


# build and deploy world contracts
cd contracts

echo "----- Building World -----"
sozo build

echo "----- Migrating World -----"
sozo migrate apply


if [[ "$setConfig" == "true" ]]; then
    echo "----- Auth and World Contracts: Set 0.1s ----- "
    source scripts/env_variables.sh dev
    ./scripts/set_writer.sh --interval 0.1  --mode dev

    bun --env-file=../client/.env.local ../config/index.ts
fi

echo "-----  Started indexer ----- "
rm torii.db
torii --world 0x76ca3dfc3e96843716f882546f0db96b7da0cf988bdba284b469d0defb2f48f --database torii.db --allowed-origins "*"
