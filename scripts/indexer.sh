#!/bin/bash

ROOT_DIR=$(pwd)

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
    ENV_FILE=$ROOT_DIR/client/.env.local
    sed "${SED_INPLACE[@]}" '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

    # add the new addresses to the .env.local file
    echo "" >> $ENV_FILE
    echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

    # Create directories if they don't exist
    mkdir -p $ROOT_DIR/common/addresses

    # Set addresses file path
    ADDRESSES_FILE=$ROOT_DIR/common/addresses/addresses.local.json

    # Replace/create the addresses JSON file
    if [ -f "$ADDRESSES_FILE" ]; then
        rm -f $ADDRESSES_FILE
    fi
    cat > $ADDRESSES_FILE << EOF
{
    "seasonPass": "$VITE_SEASON_PASS_ADDRESS",
    "realms":     "$VITE_REALMS_ADDRESS",
    "lords":      "$VITE_LORDS_ADDRESS"
}
EOF

    ENV_FILE=$ROOT_DIR/landing/.env.local
    sed "${SED_INPLACE[@]}" '/VITE_SEASON_PASS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_REALMS_ADDRESS=/d' $ENV_FILE
    sed "${SED_INPLACE[@]}" '/VITE_LORDS_ADDRESS=/d' $ENV_FILE

    # add the new addresses to the .env.local file
    echo "" >> $ENV_FILE
    echo "VITE_SEASON_PASS_ADDRESS=$VITE_SEASON_PASS_ADDRESS" >> $ENV_FILE
    echo "VITE_REALMS_ADDRESS=$VITE_REALMS_ADDRESS" >> $ENV_FILE
    echo "VITE_LORDS_ADDRESS=$VITE_LORDS_ADDRESS" >> $ENV_FILE

    TORII_CONFIG_FILE=$ROOT_DIR/contracts/torii.toml
    # Ensure the torii_config_file exists
    if [[ ! -f "$TORII_CONFIG_FILE" ]]; then
        echo "contracts = []" > "$TORII_CONFIG_FILE"
        echo "Created new torii_config_file at $TORII_CONFIG_FILE"
    fi

	# THIS IS ONL NECESSARY FOR LOCAL BUILDS
    # Remove existing ERC721 entries
    sed "${SED_INPLACE[@]}" '/"erc721:/d' "$TORII_CONFIG_FILE"

    # Insert new ERC721 entries before the closing ]
    sed "${SED_INPLACE[@]}" "/contracts = \[/a\\
    \ \ \"erc721:$VITE_REALMS_ADDRESS\",\\
    \ \ \"erc721:$VITE_SEASON_PASS_ADDRESS\",\\
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

if [[ "$external" == "true" ]]; then
    printf "\n\n"
    echo "----- Building Season Resources Contract ----- "
    printf "\n\n"

    # source .env file in deployment
    cd ..
    source ./season_resources/scripts/deployment/.env

    # build and deploy season resources contract
    cd season_resources/contracts && scarb --release build
    cd ../scripts/deployment && npm run deploy 

    # return to eternum/contracts directory
    cd - && cd .. && cd .. && cd contracts

fi

echo "-----  Started indexer ----- "
rm -rf torii-db
torii --world 0x05013b17c43a2b664ec2a38aa45f6d891db1188622ec7cf320411321c3248fb5 --http.cors_origins "*" --config torii.toml

