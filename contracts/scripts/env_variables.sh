#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca"
DOJO_PRIVATE_KEY="0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a"
SOZO_WORLD="0x177a3f3d912cf4b55f0f74eccf3b7def7c6144efeba033e9f21d9cdb0230c64"
KATANA_TOML_PATH="./manifests/dev/manifest.toml"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum-17/katana/"
        DOJO_ACCOUNT_ADDRESS="0x6bd82a20984e638c8e1d45770e2924e274e315b9609eb15c26384eac0094cf1"
        DOJO_PRIVATE_KEY="0x15ffe6ee85bcd75f93b395ec4471819d5dbebb77ea2f2a50b30ce7f67372ce4"
        SOZO_WORLD="0x1279ea22270cc40b33680760b66756c52c9782c19ff1aa48d61f687b618ba41"
        KATANA_TOML_PATH="./manifests/prod/manifest.toml"
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