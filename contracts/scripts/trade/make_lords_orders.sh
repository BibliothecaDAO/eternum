#!/bin/bash

## add the current uuid (uncomment in world.ts)
let current_uuid=
let realm_entity_id=current_uuid
sleep_time=0.3

source ./scripts/contracts.sh

# 0. Mint a realm
sozo execute $TEST_REALM_SYSTEMS create --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,$DOJO_ACCOUNT_ADDRESS,515,2,4,5,6,1,1,8,2,2087471,1610800
current_uuid=$((current_uuid + 1))
sleep $sleep_time

# 1. Mint each of the resources (for realm entityId #0)
sozo execute $TEST_RESOURCE_SYSTEMS mint --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${realm_entity_id},25,1,1000000000,2,1000000000,3,1000000000,4,1000000000,5,1000000000,6,1000000000,7,1000000000,8,1000000000,9,1000000000,10,1000000000,11,1000000000,12,1000000000,13,1000000000,14,1000000000,15,1000000000,16,1000000000,17,1000000000,18,1000000000,19,1000000000,20,1000000000,21,1000000000,22,1000000000,253,1000000000,254,1000000000,255,1000000000
sleep $sleep_time

# Initialize current_uuid

# 2. Create 100 caravans, sleep 1 second between each
for resource_id in {1..28} 
do
    ## sell lords
    for id in {1..10}
    do
        let resouce_amount=$(( (RANDOM % 99001) + 1000 ))
        let lords_amount=$(( (RANDOM % 99001) + 1000 ))

        ## echo the amounts
        echo "resource_id: $resource_id"
        echo "resource_amount: $resouce_amount"
        echo "lords_amount: $lords_amount"

        sozo execute $TRANSPORT_UNIT_SYSTEMS create_free_unit --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${realm_entity_id},1
        current_uuid=$((current_uuid + 1))
        sleep $sleep_time

        sozo execute $CARAVAN_SYSTEMS create --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,${current_uuid}
        current_uuid=$((current_uuid + 3))
        sleep $sleep_time

        sozo execute $TRADE_SYSTEMS create_order --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${realm_entity_id},1,253,1,${lords_amount},$((current_uuid - 1)),0,1,${resource_id},1,${resouce_amount},1703071538

        current_uuid=$((current_uuid + 3))
        sleep $sleep_time
    done

    ## buys lords
    for id in {1..10}
    do
        let resouce_amount=$(( (RANDOM % 99001) + 1000 ))
        let lords_amount=$(( (RANDOM % 99001) + 1000 ))

        sozo execute $TRANSPORT_UNIT_SYSTEMS create_free_unit --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${realm_entity_id},1
        current_uuid=$((current_uuid + 1))
        sleep $sleep_time

        sozo execute $CARAVAN_SYSTEMS create --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,1,${current_uuid}
        current_uuid=$((current_uuid + 3))
        sleep $sleep_time

        sozo execute $TRADE_SYSTEMS create_order --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${realm_entity_id},1,${resource_id},1,${resouce_amount},$((current_uuid - 1)),0,1,253,1,${lords_amount},1703071538
        current_uuid=$((current_uuid + 3))
        sleep $sleep_time
    done
done
