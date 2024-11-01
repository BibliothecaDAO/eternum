#!/bin/bash

get_world_address() {
    local contract_name="dojo-world"
    awk -v name="$contract_name" '
    $1 == "address" { last_address = $3 }  # Store the last seen address
    $1 == "manifest_name" && $3 == "\"" name "\"" { gsub(/"/, "", last_address); print last_address; exit; }  # Remove quotes before printing
    ' "$KATANA_TOML_PATH"
}

get_contract_address() {
    local contract_name="$1"
    awk -v name="$contract_name" '
    $1 == "address" { last_address = $3 }  # Store the last seen address
    $1 == "tag" && $3 == "\"" name "\"" { print last_address; exit; }  # When name matches, print the last stored address
    ' "$KATANA_TOML_PATH"
}

export DOJO_WORLD_ADDRESS=$(get_world_address)

export CONFIG_SYSTEMS=$(get_contract_address "eternum-config_systems")

export TRADE_SYSTEMS=$(get_contract_address "eternum-trade_systems")

export RESOURCE_SYSTEMS=$(get_contract_address "eternum-resource_systems")

export RESOURCE_BRIDGE_SYSTEMS=$(get_contract_address "eternum-resource_bridge_systems")

export DONKEY_SYSTEMS=$(get_contract_address "eternum-donkey_systems")

export TRAVEL_SYSTEMS=$(get_contract_address "eternum-travel_systems")

export REALM_SYSTEMS=$(get_contract_address "eternum-realm_systems")

export DEV_RESOURCE_SYSTEMS=$(get_contract_address "eternum-dev_resource_systems")

export TROOP_SYSTEMS=$(get_contract_address "eternum-troop_systems")

export BATTLE_SYSTEMS=$(get_contract_address "eternum-battle_systems")

export BATTLE_PILLAGE_SYSTEMS=$(get_contract_address "eternum-battle_pillage_systems")

export NAME_SYSTEMS=$(get_contract_address "eternum-name_systems")

export BANK_SYSTEMS=$(get_contract_address "eternum-bank_systems")

export SWAP_SYSTEMS=$(get_contract_address "eternum-swap_systems")

export LIQUIDITY_SYSTEMS=$(get_contract_address "eternum-liquidity_systems")

export HYPERSTRUCTURE_SYSTEMS=$(get_contract_address "eternum-hyperstructure_systems")

export BUILDINGS_SYSTEMS=$(get_contract_address "eternum-building_systems")

export MAP_SYSTEMS=$(get_contract_address "eternum-map_systems")

export DEV_BANK_SYSTEMS=$(get_contract_address "eternum-dev_bank_systems")

export GUILD_SYSTEMS=$(get_contract_address "eternum-guild_systems")

export OWNERSHIP_SYSTEMS=$(get_contract_address "eternum-ownership_systems")

export DEV_REALM_SYSTEMS=$(get_contract_address "eternum-dev_realm_systems")

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