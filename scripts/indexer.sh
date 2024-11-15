#!/bin/bash

setConfig=""
external=""

# Function to show usage
usage() {
    echo "Usage: $0 [--setConfig] [--external]"
    exit 1
}

# Detect OS and set sed in-place options
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_INPLACE=(-i '')
else
    SED_INPLACE=(-i)
fi

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --setConfig) setConfig="true"; shift 1;;
        --external) external="true"; shift 1;;
        *) usage;;
    esac
done

if [[ "$external" == "true" ]]; then
    printf "\n\n"
    echo "----- Building Eternum Season Pass Contract ----- "
    printf "\n\n"

    # source .env file in deployment
    source ./season_pass/scripts/deployment/.env

    # build and deploy season pass contract
    cd season_pass/contracts && scarb --release build
    cd ../scripts/deployment && npm run deploy 

    # update the .env.local file with the season pass and test realms contracts addresses
    VITE_SEASON_PASS_ADDRESS=$(cat ./addresses/dev/season_pass.json | jq -r '.address')
    VITE_REALMS_ADDRESS=$(cat ./addresses/dev/test_realms.json | jq -r '.address')
    VITE_LORDS_ADDRESS=$(cat ./addresses/dev/test_lords.json | jq -r '.address')

    # remove the old addresses if they exist
    ENV_FILE=../../../client/.env.local
    sed "${SED_INPLACE[@]}" '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

    # add the new addresses to the .env.local file
    echo "" >> $ENV_FILE
    echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE


    ENV_FILE=../../../landing/.env.local
    sed "${SED_INPLACE[@]}" '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

    # add the new addresses to the .env.local file
    echo "" >> $ENV_FILE
    echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

    TORII_CONFIG_FILE=../../../contracts/torii.toml
    # Ensure the torii_config_file exists
    if [[ ! -f "$TORII_CONFIG_FILE" ]]; then
        echo "contracts = []" > "$TORII_CONFIG_FILE"
        echo "Created new torii_config_file at $TORII_CONFIG_FILE"
    fi
        # Remove existing ERC721 entries
    sed "${SED_INPLACE[@]}" '/"erc721": "/d' "$TORII_CONFIG_FILE"

    # Insert new ERC721 entries before the closing ]
    sed "${SED_INPLACE[@]}" "/contracts = \[/a\\
    \ \ \"erc721\": \"$VITE_REALMS_ADDRESS\",\\
    \ \ \"erc721\": \"$VITE_SEASON_PASS_ADDRESS\",\\
    " "$TORII_CONFIG_FILE"

    cd ../../../
    printf "\n\n"
fi


# build and deploy world contracts
cd contracts

echo "----- Building World -----"
sozo build

echo "----- Migrating World -----"
sozo migrate

if [[ "$setConfig" == "true" ]]; then
    bun --env-file=../client/.env.local ../config/index.ts
fi

echo "-----  Started indexer ----- "
rm torii.db
torii --world 0x05013b17c43a2b664ec2a38aa45f6d891db1188622ec7cf320411321c3248fb5 --http.cors_origins "*" --config torii.toml

