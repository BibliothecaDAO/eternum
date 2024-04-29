#!/bin/bash

get_contract_address() {
    local contract_name="$1"
    awk -v name="$contract_name" '
    $1 == "address" { last_address = $3 }  # Store the last seen address
    $1 == "name" && $3 == "\"" name "\"" { print last_address; exit; }  # When name matches, print the last stored address
    ' "$KATANA_TOML_PATH"
}

export SOZO_WORLD=$(get_contract_address "dojo::world::world")

export CONFIG_SYSTEMS=$(get_contract_address "eternum::systems::config::contracts::config_systems")

export TRADE_SYSTEMS=$(get_contract_address "eternum::systems::trade::contracts::trade_systems::trade_systems")

export RESOURCE_SYSTEMS=$(get_contract_address "eternum::systems::resources::contracts::resource_systems")

export DONKEY_SYSTEMS=$(get_contract_address "eternum::systems::transport::contracts::donkey_systems::donkey_systems")

export ROAD_SYSTEMS=$(get_contract_address "eternum::systems::transport::contracts::road_systems::road_systems")

export TRAVEL_SYSTEMS=$(get_contract_address "eternum::systems::transport::contracts::travel_systems::travel_systems")

export REALM_SYSTEMS=$(get_contract_address "eternum::systems::realm::contracts::realm_systems")

export DEV_RESOURCE_SYSTEMS=$(get_contract_address "eternum::systems::test::contracts::resource::dev_resource_systems")

export COMBAT_SYSTEMS=$(get_contract_address "eternum::systems::combat::contracts::combat_systems")

export LEVELING_SYSTEMS=$(get_contract_address "eternum::systems::leveling::contracts::leveling_systems")

export NAME_SYSTEMS=$(get_contract_address "eternum::systems::name::contracts::name_systems")

export BANK_SYSTEMS=$(get_contract_address "eternum::systems::bank::contracts::bank_systems::bank_systems")

export SWAP_SYSTEMS=$(get_contract_address "eternum::systems::bank::contracts::swap_systems::swap_systems")

export LIQUIDITY_SYSTEMS=$(get_contract_address "eternum::systems::bank::contracts::liquidity_systems::liquidity_systems")

export HYPERSTRUCTURE_SYSTEMS=$(get_contract_address "eternum::systems::hyperstructure::contracts::hyperstructure_systems")

export BUILDINGS_SYSTEMS=$(get_contract_address "eternum::systems::buildings::contracts::building_systems")

export MAP_SYSTEMS=$(get_contract_address "eternum::systems::map::contracts::map_systems")

# Display the addresses
echo "-------------------------ADDRESS----------------------------------------"
echo world : $SOZO_WORLD
echo config : $CONFIG_SYSTEMS
echo trade : $TRADE_SYSTEMS
echo resource : $RESOURCE_SYSTEMS
echo road : $ROAD_SYSTEMS
echo donkey : $DONKEY_SYSTEMS
echo travel : $TRAVEL_SYSTEMS
echo realm : $REALM_SYSTEMS
echo test_resource : $DEV_RESOURCE_SYSTEMS
echo combat : $COMBAT_SYSTEMS
echo leveling : $LEVELING_SYSTEMS
echo name : $NAME_SYSTEMS
echo bank : $BANK_SYSTEMS
echo swap : $SWAP_SYSTEMS
echo liquidity : $LIQUIDITY_SYSTEMS
echo hyperstructure : $HYPERSTRUCTURE_SYSTEMS
echo buildings : $BUILDINGS_SYSTEMS
echo maps : $MAP_SYSTEMS
