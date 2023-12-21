#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0x517ececd29116499f4a1b64b094da79ba08dfd54a3edaa316134c41f8160973"
DOJO_PRIVATE_KEY="0x1800000000300000180000000000030000000000003006001800006600"
SOZO_WORLD="0x5cb4ce060de62a7b6bfd4cb70fd4ae3196bfe399c372cb0863e632ba8cc73ef"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum2/katana"
        DOJO_ACCOUNT_ADDRESS="0x2e9ddabb027df5caf5b5b89dd54cbe9d95a2fe843f7cabd38897f4354801ae7"
        DOJO_PRIVATE_KEY="0x110c454ce82b356f60d18d1975a2347dbe6adc83256e98b2ad1346fbf440ad4"
    elif [[ "$1" != "dev" ]]; then
        echo "Invalid argument. Use 'dev' or 'prod'."
        exit 1
    fi
fi

# Set the environment variables
export STARKNET_RPC_URL
export DOJO_ACCOUNT_ADDRESS
export DOJO_PRIVATE_KEY
export SOZO_WORLD

# Optional: Display the chosen configuration
echo "Selected configuration:"
echo "STARKNET_RPC_URL: $STARKNET_RPC_URL"
echo "DOJO_ACCOUNT_ADDRESS: $DOJO_ACCOUNT_ADDRESS"
echo "DOJO_PRIVATE_KEY: $DOJO_PRIVATE_KEY"
echo "SOZO_WORLD: $SOZO_WORLD"