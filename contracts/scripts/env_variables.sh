#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca"
DOJO_PRIVATE_KEY="0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a"
SOZO_WORLD="0x76ca3dfc3e96843716f882546f0db96b7da0cf988bdba284b469d0defb2f48f"
KATANA_TOML_PATH="./manifests/dev/deployment/manifest.toml"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum-40/katana/"
        DOJO_ACCOUNT_ADDRESS="0x32daa4fbd48d1f4b5043229510c0ee8c56bad27de097776948ada7975d6f35"
        DOJO_PRIVATE_KEY="0x19d81680233a0a7643ad9486dde1d37ea7597b07448922995fc0b870e61666"
        SOZO_WORLD="0x76ca3dfc3e96843716f882546f0db96b7da0cf988bdba284b469d0defb2f48f"
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