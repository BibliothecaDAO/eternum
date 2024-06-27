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

cd contracts

echo "----- Building World -----"
sozo build

echo "----- Migrating World -----"
sozo migrate apply --name eternum


if [[ "$setConfig" == "true" ]]; then
    bun --env-file=../client/.env.local ../config/index.ts

    echo "----- Auth and World Contracts: Set 0.1s ----- "
    source scripts/env_variables.sh dev
    ./scripts/set_writer.sh --interval 0.1  --mode dev
fi

echo "-----  Started indexer ----- "
rm torii.db
torii --world 0x0161b08e252b353008665e85ab5dcb0044a61186eb14b999657d14c04c94c824 --database torii.db --allowed-origins "*"