#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca"
DOJO_PRIVATE_KEY="0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a"
SOZO_WORLD="0xa92287241cfe50996a7d5b1af3ab036b99528e97a77980ac36c34dfda28562"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/realms/katana/"
        DOJO_ACCOUNT_ADDRESS="0x7d549f53e4c914608e8a3537eccc5e540c6c6c21547b49a28d3ae9b708db0bc"
        DOJO_PRIVATE_KEY="0x4a3b4a925e3d264affeb8d05c56dbeb0c7ec431d062ce69c2f1ffb83a3c5013"
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