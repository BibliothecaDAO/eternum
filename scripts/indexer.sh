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
    bun --env-file=../client/.env.development ../config/index.ts

    echo "----- Auth and World Contracts: Set 0.1s ----- "
    source scripts/env_variables.sh dev
    ./scripts/set_writer.sh --interval 0.1  --mode dev
fi

echo "-----  Started indexer ----- "
torii --world 0x177a3f3d912cf4b55f0f74eccf3b7def7c6144efeba033e9f21d9cdb0230c64