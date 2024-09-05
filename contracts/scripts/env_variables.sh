#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca"
DOJO_PRIVATE_KEY="0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a"
SOZO_WORLD="0x6918fe8c1ba16bdc83b9790cd9168d730aa98a22c65164578ef99af1c8cbc76"
KATANA_TOML_PATH="./manifests/dev/deployment/manifest.toml"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum-35/katana/"
        DOJO_ACCOUNT_ADDRESS="0x3501b8b055c43cc73e01a766a6df019e4ec2beb3667d26852cd66d42b1ea1"
        DOJO_PRIVATE_KEY="0x70da7559cd23cc1d2f75f1238587660c546fc75af677b949a7bc70aac294023"
        SOZO_WORLD="0x6918fe8c1ba16bdc83b9790cd9168d730aa98a22c65164578ef99af1c8cbc76"
        KATANA_TOML_PATH="./manifests/prod/deployment/manifest.toml"
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
export KATANA_TOML_PATH

# Optional: Display the chosen configuration
echo "Selected configuration:"
echo "STARKNET_RPC_URL: $STARKNET_RPC_URL"
echo "DOJO_ACCOUNT_ADDRESS: $DOJO_ACCOUNT_ADDRESS"
echo "DOJO_PRIVATE_KEY: $DOJO_PRIVATE_KEY"
echo "SOZO_WORLD: $SOZO_WORLD"
echo "KATANA_TOML_PATH: $KATANA_TOML_PATH"