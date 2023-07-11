#!/bin/bash

script_dir="$(cd "$(dirname "$0")" && pwd)"
# console log script dir  
echo "Script dir: $script_dir"

# set env variables
source "$script_dir/../env_variables.sh"
world="$SOZO_WORLD"

# set config
source "$script_dir/../set_config.sh"

# mint realms
source "$script_dir/mint_realms.sh"

# mint basic resources (to pay for labor) for first 5 realm entities
commands=(
    # realm 1
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,3,1000"
    # realm 2
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,3,1000"
    # realm 3
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,3,1000"
    # realm 4
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 3,3,1000"
    # realm 5
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,2,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 4,3,1000"
)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done