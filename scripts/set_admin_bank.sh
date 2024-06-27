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

echo "----- Creating Admin Bank -----"
# if [[ "$setConfig" == "true" ]]; then
#     bun --env-file=../client/.env.development ../config/bank/index.ts
# fi

bun --env-file=../client/.env.development ../config/bank/index.ts

