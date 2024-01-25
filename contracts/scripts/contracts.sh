#!/bin/bash

export SOZO_WORLD=$(cat ./target/dev/manifest.json | jq -r '.world.address')

export CONFIG_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::config::contracts::config_systems" ).address')

export LABOR_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::labor::contracts::labor_systems" ).address')

export TRADE_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::trade::contracts::trade_systems::trade_systems" ).address')

export RESOURCE_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::resources::contracts::resource_systems" ).address')

export CARAVAN_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::transport::contracts::caravan_systems::caravan_systems" ).address')

export ROAD_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::transport::contracts::road_systems::road_systems" ).address')

export TRANSPORT_UNIT_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::transport::contracts::transport_unit_systems::transport_unit_systems" ).address')

export TRAVEL_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::transport::contracts::travel_systems::travel_systems" ).address')

export REALM_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::realm::contracts::realm_systems" ).address')

export TEST_RESOURCE_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::test::contracts::resource::test_resource_systems" ).address')

export COMBAT_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::combat::contracts::combat_systems" ).address')

export LEVELING_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::leveling::contracts::leveling_systems" ).address')

export NAME_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::name::contracts::name_systems" ).address')

export BANK_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::bank::contracts::bank_systems" ).address')

export HYPERSTRUCTURE_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::hyperstructure::contracts::hyperstructure_systems" ).address')

export BUILDINGS_SYSTEMS=$(cat ./target/dev/manifest.json | jq -r '.contracts[] | select(.name == "eternum::systems::buildings::contracts::buildings_systems" ).address')

echo "-------------------------ADDRESS----------------------------------------"
echo world : $SOZO_WORLD
echo config : $CONFIG_SYSTEMS
echo labor : $LABOR_SYSTEMS
echo trade : $TRADE_SYSTEMS
echo resource : $RESOURCE_SYSTEMS
echo caravan : $CARAVAN_SYSTEMS
echo road : $ROAD_SYSTEMS
echo transport_unit : $TRANSPORT_UNIT_SYSTEMS
echo travel : $TRAVEL_SYSTEMS
echo realm : $REALM_SYSTEMS
echo test_resource : $TEST_RESOURCE_SYSTEMS
echo combat : $COMBAT_SYSTEMS
echo leveling : $LEVELING_SYSTEMS
echo name : $NAME_SYSTEMS
echo bank : $BANK_SYSTEMS
echo hyperstructure : $HYPERSTRUCTURE_SYSTEMS
echo buildings : $BUILDINGS_SYSTEMS