#!/bin/bash

### STEPS

# 0. set configuration
# 1. Create 2 realms
# 2. Mint resources 1 and 2 for realm 1
# 3. Mint resources 3 and 4 for realm 2
# 4. Create free transport units for realm 1
# 5. Create free transport units for realm 2
# 6. Create caravan for realm 1
# 7. Create caravan for realm 2
# 8. Realm 1 makes order
# 9. Realm 1 attaches caravan to order
# 10. Realm 2 attaches caravan to order
# 11. Realm 2 accepts order

# TODO: wrong entity ids for creating caravan and trade

world="$SOZO_WORLD"

script_dir="$(cd "$(dirname "$0")" && pwd)"
# console log script dir  
echo "Script dir: $script_dir"
# set config
source "$script_dir/../../set_config.sh"

# mint realms
source "$script_dir/../mint_realms.sh"

commands=(
    # mint resources 1 and 2 for realm 1
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,1,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,2,1000"
    # mint resources 3 and 4 for realm 2
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,3,1000"
    "sozo execute --world $world MintResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,4,1000"

    # create free transport units for realm 1
    "sozo execute --world $world CreateFreeTransportUnit --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,10"
    "sozo execute --world $world CreateFreeTransportUnit --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,10"
    # create caravan for realm 1
    "sozo execute --world $world CreateCaravan --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,5,6"

    # create free transport units for realm 2
    "sozo execute --world $world CreateFreeTransportUnit --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,10"
    "sozo execute --world $world CreateFreeTransportUnit --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,10"
    # create caravan for realm 1
    "sozo execute --world $world CreateCaravan --account-address $DOJO_ACCOUNT_ADDRESS --calldata 2,9,10"

    # make order
    # realm 1 trades 50 resource type 1 and 100 resource type 2 against 200 resource type 3 and 300 resource type 4
    "sozo execute --world $world MakeFungibleOrder --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,2,1,2,2,50,100,1,2,3,4,2,200,300,1,1000000000000"

    #attach caravan to order
    #realm 1
    # carvan id = 5
    "sozo execute --world $world AttachCaravan --account-address $DOJO_ACCOUNT_ADDRESS --calldata 0,16,8" 
    #realm 2
    "sozo execute --world $world AttachCaravan --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,16,12"

    #take order
    "sozo execute --world $world TakeFungibleOrder --account-address $DOJO_ACCOUNT_ADDRESS --calldata 1,16"

)

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"
done
