#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
DOJO_PRIVATE_KEY="0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912"
SOZO_WORLD="0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2"
KATANA_TOML_PATH="./manifests/dev/deployment/manifest.toml"

# Check if the first argument is provided and set it to "dev" or "prod"
if [[ ! -z "$1" ]]; then
    if [[ "$1" == "prod" ]]; then
        echo "is prod"
        STARKNET_RPC_URL="https://api.cartridge.gg/x/eternum-rc0/katana/"
        DOJO_ACCOUNT_ADDRESS="0x46f957b7fe3335010607174edd5c4c3fae87b12c3760dc167ac738959d8c03b"
        DOJO_PRIVATE_KEY="0x66184a4482615568262bb3e63eb02517eece88afc39c3b5222467e7551611ad"
        SOZO_WORLD="0x073bad29b5c12b09f9023e8d3a5876ea6ebd41fa26cab5035369fec4691067c2"
        KATANA_TOML_PATH="./manifest_prod.json"
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