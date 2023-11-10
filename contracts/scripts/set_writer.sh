#!/bin/bash

WORLD_ADDRESS="0x4d79c99ce9b489b77461e3491970ea5ede1f1966f4d2ff65ee76cd8701d6dad"
CONFIG_SYSTEMS="0x74c3dd7b64a0c8ad6a27276b9ec6a628774028734ea46cf3970ef185e35247d"
LABOR_SYSTEMS="0x5b3b02ba50cfb46af86c20d1eca1bbff5fe82ff2f8985aefc413267a5d05b00"
TRADE_SYSTEMS="0x7b54643f42a1c4298fe5e465105ccbee30ba505f3bedaa90f4951f9f15be8f0"
HYPERSTRUCTURE_SYSTEMS="0xfdcafc26f1d866ad585cadfb0fb177e4512d03f6020e67adadb5c66690d9c2"
RESOURCE_SYSTEMS="0x2dab8013b2dea3f5b37f31db94a5136843408efa04a966a6587f65056b1ef40"
CARAVAN_SYSTEMS="0x384fd2bf241ffc48425ed1fed389495e8066079cdb16865a73e6d3849d32c4f"
ROAD_SYSTEMS="0x46e8cc4deb048fed25465e134ebbfa962137daaf0bb52a63d41940af3638e4d"
TRANSPORT_UNIT_SYSTEMS="0x75eb7b6012dbb91d59aa20808de28666f8207478e08f4e4ee101bdb0ac89e63"
TRAVEL_SYSTEMS="0x8fa2df40a28c2ffb7a99267c1a67318451da3a5d39cadb18577a2d09856b0e"
TEST_REALM_SYSTEMS="0x141b54c5560368787c28e61f9c9542e3aaf26a3f426263cb0dcde36339eec30"
TEST_RESOURCE_SYSTEMS="0x5e2e8d20bc9f4c02050b2b6b7442a1ce06bbd9c0729716a7c5a478069c9b354"
COMBAT_SYSTEMS="0x778fd3e137dc0e58d94d599167aa431332b8529f9bfc8efd70a7ea4e9c74247"

commands=()

# Read the System to Components JSON file
system_models_json=$(cat ./scripts/system_models.json)

# Loop through each system
for system in $(echo $system_models_json | jq -r 'keys[]'); do
    # Loop through each component that the system writes to
    for model in $(echo $system_models_json | jq -r ".$system[]"); do
        system_var="${system}"
        contract_address="${!system_var}"
        # make the system a writer of the component
        commands+=("sozo auth writer --world "$SOZO_WORLD" $model $contract_address")
    done
done


# Ask the user for the desired delay between commands
read -p "Specify a delay in seconds between each command (or press Enter for no delay): " delay

# Check if the delay is a valid number (integer or floating point)
if [[ ! "$delay" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    delay=0
fi

for cmd in "${commands[@]}"; do
    echo "Executing command: $cmd"
    output=$(eval "$cmd")
    echo "Output:"
    echo "$output"
    echo "--------------------------------------"

    if [ $(echo "$delay > 0" | bc -l) -eq 1 ]; then
        echo "Sleeping for $delay seconds..."
        sleep $delay
    fi
done