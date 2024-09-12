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
