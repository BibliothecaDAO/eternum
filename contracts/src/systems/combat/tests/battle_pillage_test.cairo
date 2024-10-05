use core::array::SpanTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::{
    alias::ID,
    models::{
        position::{Coord, Position}, weight::Weight, resources::{ResourceTypes, RESOURCE_PRECISION}, combat::{Troops},
        quantity::Quantity, config::CapacityConfig
    },
    systems::{
        config::contracts::config_systems,
        combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait},
    },
    utils::testing::{
        world::spawn_eternum, general::{mint, teleport, spawn_realm, create_army_with_troops},
        systems::{deploy_system, deploy_realm_systems, deploy_combat_systems},
        config::{
            set_combat_config, setup_globals, set_stamina_config, set_capacity_config, set_speed_config,
            set_weight_config, set_travel_and_explore_stamina_cost_config, set_battle_config
        }
    },
};
use starknet::contract_address_const;


const DEFAULT_BLOCK_TIMESTAMP: u64 = 20_000;
const ATTACKER: felt252 = 'player1';
const DEFENDER: felt252 = 'player2';

const STARTING_KNIGHT_COUNT: u128 = 100 * RESOURCE_PRECISION;

const DEFENDER_REALM_COORD_X: u32 = 2;
const DEFENDER_REALM_COORD_Y: u32 = 3;

fn setup() -> (IWorldDispatcher, ICombatContractDispatcher, ID, ID) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_combat_config(config_systems_address);
    setup_globals(config_systems_address);
    set_stamina_config(config_systems_address);
    set_capacity_config(config_systems_address);
    set_speed_config(config_systems_address);
    set_weight_config(config_systems_address);
    set_travel_and_explore_stamina_cost_config(config_systems_address);
    set_battle_config(config_systems_address);

    let realm_system_dispatcher = deploy_realm_systems(world);
    let combat_system_dispatcher = deploy_combat_systems(world);

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP);

    // SPAWN ATTACKER REALM & ARMY
    starknet::testing::set_contract_address(contract_address_const::<ATTACKER>());

    let attacker_realm_entity_id = spawn_realm(world, realm_system_dispatcher, Position { entity_id: 0, x: 1, y: 1 });

    mint(world, attacker_realm_entity_id, array![(ResourceTypes::KNIGHT, STARTING_KNIGHT_COUNT),].span());

    let attacking_troops = Troops {
        knight_count: STARTING_KNIGHT_COUNT.try_into().unwrap(), paladin_count: 0, crossbowman_count: 0,
    };

    let attacker_realm_army_unit_id = create_army_with_troops(
        world, combat_system_dispatcher, attacker_realm_entity_id, attacking_troops, false
    );

    // SPAWN DEFENDER REALM & DEFENSIVE ARMY
    starknet::testing::set_contract_address(contract_address_const::<DEFENDER>());

    let defender_realm_entity_id = spawn_realm(
        world, realm_system_dispatcher, Position { entity_id: 0, x: DEFENDER_REALM_COORD_X, y: DEFENDER_REALM_COORD_Y }
    );

    mint(
        world,
        defender_realm_entity_id,
        array![
            (ResourceTypes::WOOD, 100_000),
            (ResourceTypes::STONE, 100_000),
            (ResourceTypes::COAL, 100_000),
            (ResourceTypes::COPPER, 100_000),
            (ResourceTypes::OBSIDIAN, 100_000),
            (ResourceTypes::SILVER, 100_000),
            (ResourceTypes::IRONWOOD, 100_000),
            (ResourceTypes::COLD_IRON, 100_000),
            (ResourceTypes::GOLD, 100_000),
            (ResourceTypes::HARTWOOD, 100_000),
            (ResourceTypes::DIAMONDS, 100_000),
            (ResourceTypes::SAPPHIRE, 100_000),
            (ResourceTypes::RUBY, 100_000),
            (ResourceTypes::DEEP_CRYSTAL, 100_000),
            (ResourceTypes::IGNIUM, 100_000),
            (ResourceTypes::ETHEREAL_SILICA, 100_000),
            (ResourceTypes::TRUE_ICE, 100_000),
            (ResourceTypes::TWILIGHT_QUARTZ, 100_000),
            (ResourceTypes::ALCHEMICAL_SILVER, 100_000),
            (ResourceTypes::ADAMANTINE, 100_000),
            (ResourceTypes::MITHRAL, 100_000),
            (ResourceTypes::DRAGONHIDE, 100_000),
            (ResourceTypes::DEMONHIDE, 100_000),
        ]
            .span()
    );

    teleport(world, attacker_realm_army_unit_id, Coord { x: DEFENDER_REALM_COORD_X, y: DEFENDER_REALM_COORD_Y });

    (world, combat_system_dispatcher, attacker_realm_army_unit_id, defender_realm_entity_id)
}

#[test]
fn test_battle_pillage__near_max_capacity() {
    let (world, combat_system_dispatcher, attacker_realm_army_unit_id, defender_realm_entity_id) = setup();

    starknet::testing::set_contract_address(contract_address_const::<ATTACKER>());

    let realm_pos = get!(world, defender_realm_entity_id, Position);
    let army_pos = get!(world, attacker_realm_army_unit_id, Position);
    assert_eq!(army_pos.x, realm_pos.x, "Army & realm not at same pos");
    assert_eq!(army_pos.y, realm_pos.y, "Army & realm not at same pos");

    let mut army_weight = get!(world, attacker_realm_army_unit_id, Weight);
    set!(world, Weight { entity_id: attacker_realm_army_unit_id, value: 950_000 });
    let initial_army_weight = army_weight.value;
    assert_eq!(initial_army_weight, 0, "Initial army weight not correct");

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP * 2);

    let _army_quantity = get!(world, attacker_realm_army_unit_id, Quantity);

    let _capacity_config = get!(world, 3, CapacityConfig);

    combat_system_dispatcher.battle_pillage(attacker_realm_army_unit_id, defender_realm_entity_id);

    let army_weight = get!(world, attacker_realm_army_unit_id, Weight).value;

    assert_ne!(initial_army_weight, army_weight, "Weight not changed after pillage");
}

#[test]
fn test_simple_battle_pillage() {
    let (world, combat_system_dispatcher, attacker_realm_army_unit_id, defender_realm_entity_id) = setup();

    starknet::testing::set_contract_address(contract_address_const::<ATTACKER>());

    let realm_pos = get!(world, defender_realm_entity_id, Position);
    let army_pos = get!(world, attacker_realm_army_unit_id, Position);
    assert_eq!(army_pos.x, realm_pos.x, "Army & realm not at same pos");
    assert_eq!(army_pos.y, realm_pos.y, "Army & realm not at same pos");

    let mut army_weight = get!(world, attacker_realm_army_unit_id, Weight);
    let initial_army_weight = army_weight.value;

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP * 2);

    let army_quantity = get!(world, attacker_realm_army_unit_id, Quantity);

    let capacity_config = get!(world, 3, CapacityConfig);

    combat_system_dispatcher.battle_pillage(attacker_realm_army_unit_id, defender_realm_entity_id);

    let army_weight = get!(world, attacker_realm_army_unit_id, Weight).value;

    assert_ne!(initial_army_weight, army_weight, "Weight not changed after pillage");
}

