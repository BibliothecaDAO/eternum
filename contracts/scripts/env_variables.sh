#!/bin/bash

# Default values (dev)
STARKNET_RPC_URL="http://localhost:5050"
DOJO_ACCOUNT_ADDRESS="0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca"
DOJO_PRIVATE_KEY="0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a"
SOZO_WORLD="0x177a3f3d912cf4b55f0f74eccf3b7def7c6144efeba033e9f21d9cdb0230c64"

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

export WOOD=1
export STONE=2
export COAL=3
export COPPER=4
export OBSIDIAN=5
export SILVER=6
export IRONWOOD=7
export COLDIRON=8
export GOLD=9
export HARTWOOD=10
export DIAMONDS=11
export SAPPHIRE=12
export RUBY=13
export DEEPCRYSTAL=14
export IGNIUM=15
export ETHEREALSILICA=16
export TRUEICE=17
export TWILIGHTQUARTZ=18
export ALCHEMICALSILVER=19
export ADAMANTINE=20
export MITHRAL=21
export DRAGONHIDE=22

# Transports
export DONKEY=249;

# Units
export KNIGHT=250
export CROSSBOWMEN=251
export PALADIN=252

export LORDS=253
export WHEAT=254
export FISH=255

export DONKEY_ENTITY_TYPE=256
export REALM_ENTITY_TYPE=257
export SOLDIER_ENTITY_TYPE=258
export ARMY_ENTITY_TYPE=259