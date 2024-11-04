#!/bin/bash

# Function to update or add a variable in a specified file
update_variable_in_file() {
    local key=$1
    local value=$2
    local file=$3

    # Check if the key already exists in the file
    if grep -q "^$key=" "$file"; then
        # Update the existing key with the new value
        sed -i '' "s|^$key=.*|$key=$value|" "$file"
    else
        # Add the new key-value pair to the file
        echo "$key=$value" >> "$file"
    fi
}

# Function to update or add a variable in a TOML file
update_variable_in_toml() {
    local key=$1
    local value=$2
    local file=$3

    # Check if the key already exists in the file
    if grep -q "^$key = " "$file"; then
        # Update the existing key with the new value
        sed -i '' "s|^$key = .*|$key = \"$value\"|" "$file"
    else
        # Add the new key-value pair to the file
        echo "$key = \"$value\"" >> "$file"
    fi
}

# Check if the correct number of arguments is provided
if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <VITE_PUBLIC_MASTER_ADDRESS> <VITE_PUBLIC_MASTER_PRIVATE_KEY> <VITE_PUBLIC_NODE_URL> <SOZO_WORLD>"
    exit 1
fi

# Accept values as parameters
VITE_PUBLIC_MASTER_ADDRESS="$1"
VITE_PUBLIC_MASTER_PRIVATE_KEY="$2"
VITE_PUBLIC_NODE_URL="$3"
SOZO_WORLD="$4"
# Define file paths
ENV_PRODUCTION_FILE="../client/.env.production"
DOJO_PROD_TOML_FILE="../contracts/dojo_prod.toml"
SEASON_PASS_ENV_PRODUCTION_FILE="../season_pass/scripts/deployment/.env.production"

# Update the .env.production file with the new values
update_variable_in_file "VITE_PUBLIC_MASTER_ADDRESS" "$VITE_PUBLIC_MASTER_ADDRESS" "$ENV_PRODUCTION_FILE"
update_variable_in_file "VITE_PUBLIC_MASTER_PRIVATE_KEY" "$VITE_PUBLIC_MASTER_PRIVATE_KEY" "$ENV_PRODUCTION_FILE"
update_variable_in_file "VITE_PUBLIC_NODE_URL" "https://api.cartridge.gg/x/$VITE_PUBLIC_NODE_URL/katana" "$ENV_PRODUCTION_FILE"
update_variable_in_file "VITE_PUBLIC_TORII" "https://api.cartridge.gg/x/$VITE_PUBLIC_NODE_URL/torii" "$ENV_PRODUCTION_FILE"
update_variable_in_file "VITE_PUBLIC_TORII_RELAY" "/dns4/api.cartridge.gg/tcp/443/x-parity-wss/%2Fx%2F$VITE_PUBLIC_NODE_URL%2Ftorii%2Fwss" "$ENV_PRODUCTION_FILE"

# Update the dojo_prod.toml file with the new values
update_variable_in_toml "account_address" "$VITE_PUBLIC_MASTER_ADDRESS" "$DOJO_PROD_TOML_FILE"
update_variable_in_toml "private_key" "$VITE_PUBLIC_MASTER_PRIVATE_KEY" "$DOJO_PROD_TOML_FILE"
update_variable_in_toml "rpc_url" "https://api.cartridge.gg/x/$VITE_PUBLIC_NODE_URL/katana" "$DOJO_PROD_TOML_FILE"

# Update the season_pass .env.production file with the new values
update_variable_in_file "STARKNET_ACCOUNT_ADDRESS" "$VITE_PUBLIC_MASTER_ADDRESS" "$SEASON_PASS_ENV_PRODUCTION_FILE"
update_variable_in_file "STARKNET_ACCOUNT_PRIVATE_KEY" "$VITE_PUBLIC_MASTER_PRIVATE_KEY" "$SEASON_PASS_ENV_PRODUCTION_FILE"
update_variable_in_file "RPC_API_KEY" "https://api.cartridge.gg/x/$VITE_PUBLIC_NODE_URL/katana" "$SEASON_PASS_ENV_PRODUCTION_FILE"
update_variable_in_file "SEASON_PASS_ADMIN" "$VITE_PUBLIC_MASTER_ADDRESS" "$SEASON_PASS_ENV_PRODUCTION_FILE"

export STARKNET_RPC_URL="https://api.cartridge.gg/x/$VITE_PUBLIC_NODE_URL/katana"
export DOJO_ACCOUNT_ADDRESS=$VITE_PUBLIC_MASTER_ADDRESS
export DOJO_PRIVATE_KEY=$VITE_PUBLIC_MASTER_PRIVATE_KEY
export SOZO_WORLD=$SOZO_WORLD
export KATANA_TOML_PATH="./manifest_prod.json"

echo "STARKNET_RPC_URL: $STARKNET_RPC_URL"
echo "DOJO_ACCOUNT_ADDRESS: $DOJO_ACCOUNT_ADDRESS"
echo "DOJO_PRIVATE_KEY: $DOJO_PRIVATE_KEY"
echo "SOZO_WORLD: $SOZO_WORLD"
echo "KATANA_TOML_PATH: $KATANA_TOML_PATH"

echo "Updated .env.production, dojo_prod.toml, and season_pass .env.production with the new variables."
