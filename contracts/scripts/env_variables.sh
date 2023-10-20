#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0x517ececd29116499f4a1b64b094da79ba08dfd54a3edaa316134c41f8160973"
DOJO_PRIVATE_KEY="0x1800000000300000180000000000030000000000003006001800006600"
SOZO_WORLD="0x57abdb7a9b7d35a4c628ba0a0d1209bd5793b78f1efce4bb3a405ef3f9ad383"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum/katana"
        DOJO_ACCOUNT_ADDRESS="0x3f0b949804d6677952974ab11a5b15b46bd0963d1d71ca573460027fc9302f5"
        DOJO_PRIVATE_KEY="0x44a4d4b4c4ec9cf3720cdb47cad479c014e50a9b9b78f9cc23efc16c602c224"
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