#!/bin/bash

get_contract_address() {
    local contract_name="$1"
    awk -v name="$contract_name" '
    /"address":/ { gsub(/[",]/, "", $2); last_address = $2 }  # Store the last seen address, removing quotes and commas
    /"tag":/ && $2 ~ name { print last_address; exit; }  # When name matches, print the last stored address
    ' "$KATANA_TOML_PATH"
}

export DOJO_WORLD_ADDRESS=$SOZO_WORLD

export CONFIG_SYSTEMS=$(get_contract_address "s0_eternum-config_systems")

export TRADE_SYSTEMS=$(get_contract_address "s0_eternum-trade_systems")

export RESOURCE_SYSTEMS=$(get_contract_address "s0_eternum-resource_systems")

export RESOURCE_BRIDGE_SYSTEMS=$(get_contract_address "s0_eternum-resource_bridge_systems")

export DONKEY_SYSTEMS=$(get_contract_address "s0_eternum-donkey_systems")

export TRAVEL_SYSTEMS=$(get_contract_address "s0_eternum-travel_systems")

export REALM_SYSTEMS=$(get_contract_address "s0_eternum-realm_systems")

export DEV_RESOURCE_SYSTEMS=$(get_contract_address "s0_eternum-dev_resource_systems")

export TROOP_SYSTEMS=$(get_contract_address "s0_eternum-troop_systems")

export BATTLE_SYSTEMS=$(get_contract_address "s0_eternum-battle_systems")

export BATTLE_PILLAGE_SYSTEMS=$(get_contract_address "s0_eternum-battle_pillage_systems")

export NAME_SYSTEMS=$(get_contract_address "s0_eternum-name_systems")

export BANK_SYSTEMS=$(get_contract_address "s0_eternum-bank_systems")

export SWAP_SYSTEMS=$(get_contract_address "s0_eternum-swap_systems")

export LIQUIDITY_SYSTEMS=$(get_contract_address "s0_eternum-liquidity_systems")

export HYPERSTRUCTURE_SYSTEMS=$(get_contract_address "s0_eternum-hyperstructure_systems")

export BUILDINGS_SYSTEMS=$(get_contract_address "s0_eternum-building_systems")

export MAP_SYSTEMS=$(get_contract_address "s0_eternum-map_systems")

export DEV_BANK_SYSTEMS=$(get_contract_address "s0_eternum-dev_bank_systems")

export GUILD_SYSTEMS=$(get_contract_address "s0_eternum-guild_systems")

export OWNERSHIP_SYSTEMS=$(get_contract_address "s0_eternum-ownership_systems")

export DEV_REALM_SYSTEMS=$(get_contract_address "s0_eternum-dev_realm_systems")

# Display the addresses
echo "-------------------------ADDRESS----------------------------------------"
echo world : $DOJO_WORLD_ADDRESS
echo config : $CONFIG_SYSTEMS
echo trade : $TRADE_SYSTEMS
echo resource : $RESOURCE_SYSTEMS
echo resource_bridge : $RESOURCE_BRIDGE_SYSTEMS
echo donkey : $DONKEY_SYSTEMS
echo travel : $TRAVEL_SYSTEMS
echo realm : $REALM_SYSTEMS
echo test_resource : $DEV_RESOURCE_SYSTEMS
echo battle : $BATTLE_SYSTEMS
echo battle_pillage : $BATTLE_PILLAGE_SYSTEMS
echo troop : $TROOP_SYSTEMS
echo name : $NAME_SYSTEMS
echo bank : $BANK_SYSTEMS
echo swap : $SWAP_SYSTEMS
echo liquidity : $LIQUIDITY_SYSTEMS
echo hyperstructure : $HYPERSTRUCTURE_SYSTEMS
echo buildings : $BUILDINGS_SYSTEMS
echo maps : $MAP_SYSTEMS
echo test_bank : $DEV_BANK_SYSTEMS
echo guild : $GUILD_SYSTEMS
echo ownership : $OWNERSHIP_SYSTEMS
echo test_realm : $DEV_REALM_SYSTEMS