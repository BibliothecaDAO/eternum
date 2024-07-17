use core::array::SpanTrait;
use core::traits::IndexView;
use core::traits::TryInto;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{
    constants::{ResourceTypes, WORLD_CONFIG_ID, TickIds},
    systems::{
        map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait},
        transport::contracts::travel_systems::{
            travel_systems, ITravelSystemsDispatcher, ITravelSystemsDispatcherTrait
        },
        dev::contracts::resource::{IResourceSystemsDispatcherTrait},
        combat::contracts::{
            combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait
        },
        config::contracts::{
            config_systems, IRealmFreeMintConfigDispatcher, IRealmFreeMintConfigDispatcherTrait,
            IMapConfigDispatcher, IMapConfigDispatcherTrait, IWeightConfigDispatcher,
            IWeightConfigDispatcherTrait, IStaminaConfigDispatcher, IStaminaConfigDispatcherTrait,
            IMercenariesConfigDispatcher, IMercenariesConfigDispatcherTrait,
        }
    },
    models::{
        capacity::Capacity, combat::{Battle}, combat::{Health, Troops},
        config::{TickConfig, StaminaConfig}, map::Tile, movable::{Movable},
        owner::{EntityOwner, Owner}, position::{Position, Coord, CoordTrait, Direction},
        quantity::Quantity, realm::Realm, resources::{Resource, ResourceFoodImpl}, stamina::Stamina,
        structure::{Structure, StructureCategory, StructureCount,}, weight::Weight,
    },
    utils::testing::{
        world::spawn_eternum,
        systems::{
            deploy_system, deploy_realm_systems, deploy_combat_systems, deploy_dev_resource_systems
        },
        general::{spawn_realm, get_default_realm_pos, create_army_with_troops},
        config::{set_tick_config, set_combat_config, set_speed_config}
    }
};

use starknet::contract_address_const;

const INITIAL_KNIGHT_BALANCE: u128 = 50_000;

const TIMESTAMP: u64 = 10000;

fn setup() -> (IWorldDispatcher, u128, Span<u128>, ICombatContractDispatcher) {
    let world = spawn_eternum();

    starknet::testing::set_block_timestamp(TIMESTAMP);
    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let dev_resource_systems_dispatcher = deploy_dev_resource_systems(world);
    let realm_systems_dispatcher = deploy_realm_systems(world);
    let combat_systems_dispatcher = deploy_combat_systems(world);

    set_tick_config(config_systems_address);
    set_combat_config(config_systems_address);
    set_speed_config(config_systems_address);

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    dev_resource_systems_dispatcher
        .mint(realm_entity_id, array![(ResourceTypes::KNIGHT, INITIAL_KNIGHT_BALANCE)].span());

    let mut army_unit_ids: Array<u128> = array![];
    let army_unit_id: u128 = create_army_with_troops(
        world,
        combat_systems_dispatcher,
        realm_entity_id,
        Troops { knight_count: 1000, paladin_count: 0, crossbowman_count: 0 },
        false
    );
    army_unit_ids.append(army_unit_id);

    let army_unit_id: u128 = create_army_with_troops(
        world,
        combat_systems_dispatcher,
        realm_entity_id,
        Troops { knight_count: 1000, paladin_count: 0, crossbowman_count: 0 },
        false
    );
    army_unit_ids.append(army_unit_id);

    (world, realm_entity_id, army_unit_ids.span(), combat_systems_dispatcher)
}

#[test]
fn test_battle_start_and_leave() {
    let (world, realm_entity_id, army_unit_ids, combat_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());

    let battle_entity_id = combat_systems_dispatcher
        .battle_start(*army_unit_ids.at(0), *army_unit_ids.at(1));

    starknet::testing::set_block_timestamp(99999);

    combat_systems_dispatcher.battle_leave(battle_entity_id, *army_unit_ids.at(0));
    combat_systems_dispatcher.battle_leave(battle_entity_id, *army_unit_ids.at(1));
}
