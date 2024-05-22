use core::option::OptionTrait;

use core::traits::Into;

use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{ResourceTypes, get_resources_without_earthenshards};
use eternum::models::hyperstructure::{Progress, Contribution};
use eternum::models::level::Level;
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::position::{Coord};
use eternum::models::resources::Resource;
use eternum::models::structure::{Structure, StructureCount, StructureCountTrait, StructureCategory};

use eternum::systems::config::contracts::{
    config_systems, config_systems::HyperstructureConfigImpl, IHyperstructureConfigDispatcher,
    IHyperstructureConfig, IHyperstructureConfigDispatcherTrait
};
use eternum::systems::hyperstructure::contracts::{
    hyperstructure_systems, IHyperstructureSystems, IHyperstructureSystemsDispatcher,
    IHyperstructureSystemsDispatcherTrait
};
use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

const TEST_AMOUNT: u128 = 1_000_000;

fn setup() -> (IWorldDispatcher, u128, IHyperstructureSystemsDispatcher) {
    let world = spawn_eternum();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    let realm_systems_address = deploy_system(world, realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // increment to start with a realm_entity_id != 0
    world.uuid();

    let realm_entity_id = realm_systems_dispatcher
        .create(
            1, // realm id
            0x20309, // resource_types_packed // 2,3,9 // stone, coal, gold
            3, // resource_types_count
            5, // cities
            5, // harbors
            5, // rivers
            5, // regions
            1, // wonder
            1, // order
            Position { x: 500200, y: 1, entity_id: 1_u128 }, // position  
        // x needs to be > 470200 to get zone

        );

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    set!(
        world,
        (
            Resource {
                entity_id: realm_entity_id,
                resource_type: ResourceTypes::EARTHEN_SHARD,
                balance: TEST_AMOUNT,
            },
        )
    );

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut resources_for_completion = array![(ResourceTypes::EARTHEN_SHARD, TEST_AMOUNT)];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);

        resources_for_completion.append((resource_type, TEST_AMOUNT));

        set!(
            world, (Resource { entity_id: realm_entity_id, resource_type, balance: TEST_AMOUNT, },)
        );

        i += 1;
    };

    hyperstructure_config_dispatcher.set_hyperstructure_config(resources_for_completion.span());

    let hyperstructure_systems_address = deploy_system(
        world, hyperstructure_systems::TEST_CLASS_HASH
    );
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher {
        contract_address: hyperstructure_systems_address
    };
    (world, realm_entity_id, hyperstructure_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn test_create_hyperstructure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let hyperstructure_entity_id = hyperstructure_systems_dispatcher
        .create(realm_entity_id, Coord { x: 0, y: 0 });

    let structure = get!(world, hyperstructure_entity_id, Structure);
    assert(
        structure.category == StructureCategory::Hyperstructure, 'invalid category for structure'
    );

    let structure_count = get!(world, Coord { x: 0, y: 0 }, StructureCount);
    assert(structure_count.count == 1, 'invalid structure count');

    let hyperstructure_position = get!(world, hyperstructure_entity_id, Position);
    assert(
        hyperstructure_position.x == 0 && hyperstructure_position.y == 0, 'invalid position for hs'
    );

    let hyperstructure_owner = get!(world, hyperstructure_entity_id, Owner);
    assert(
        hyperstructure_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of hs'
    );

    let progress = get!(world, (hyperstructure_entity_id, ResourceTypes::EARTHEN_SHARD), Progress);
    assert(progress.amount == TEST_AMOUNT, 'Invalid progress');

    let contribution = get!(
        world,
        (
            hyperstructure_entity_id,
            contract_address_const::<'player1'>(),
            ResourceTypes::EARTHEN_SHARD
        ),
        Contribution
    );
    assert(contribution.amount == TEST_AMOUNT, 'Invalid contribution amount');
    assert(
        contribution.player_address == contract_address_const::<'player1'>(),
        'invalid contribution address'
    );
    assert(
        contribution.resource_type == ResourceTypes::EARTHEN_SHARD, 'invalid contribution resource'
    );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 1, resource type: 29 (unknown resource name), balance: 0). deduction: 1000000",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_create_hyperstructure_not_enough_eartenshards() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    set!(
        world,
        (
            Resource {
                entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: 0,
            },
        )
    );

    let _ = hyperstructure_systems_dispatcher.create(realm_entity_id, Coord { x: 0, y: 0 });
}

#[test]
#[available_gas(3000000000000)]
fn test_contribute_one_resource() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
    let contribution_amount = 100_000;

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let hyperstructure_entity_id = hyperstructure_systems_dispatcher
        .create(realm_entity_id, Coord { x: 0, y: 0 });

    let contributions = array![(ResourceTypes::WOOD, contribution_amount),].span();
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD),
        Contribution
    );
    assert(wood_contribution.amount == contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == contribution_amount, 'invalid wood progress');

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);
    let wood_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD),
        Contribution
    );
    assert(wood_contribution.amount == contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == contribution_amount * 2, 'invalid wood progress');
}

#[test]
#[available_gas(3000000000000)]
fn test_contribute_two_resources() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
    let wood_contribution_amount = 100_000;
    let stone_contribution_amount = 200_000;

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let hyperstructure_entity_id = hyperstructure_systems_dispatcher
        .create(realm_entity_id, Coord { x: 0, y: 0 });

    let contributions = array![
        (ResourceTypes::WOOD, wood_contribution_amount),
        (ResourceTypes::STONE, stone_contribution_amount)
    ]
        .span();

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD),
        Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount, 'invalid wood progress');

    let stone_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE),
        Contribution
    );
    assert(stone_contribution.amount == stone_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount, 'invalid wood progress');

    // contribute a second time
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD),
        Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount * 2, 'invalid wood progress');

    let stone_contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE),
        Contribution
    );
    assert(
        stone_contribution.amount == stone_contribution_amount * 2, 'invalid contribution amount'
    );

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount * 2, 'invalid wood progress');
}


#[test]
#[available_gas(3000000000000)]
fn test_finish_hyperstructure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let hyperstructure_entity_id = hyperstructure_systems_dispatcher
        .create(realm_entity_id, Coord { x: 0, y: 0 });

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut contributions = array![];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);
        contributions.append((resource_type, TEST_AMOUNT));
        i += 1;
    };

    hyperstructure_systems_dispatcher
        .contribute_to_construction(
            hyperstructure_entity_id, realm_entity_id, contributions.span()
        );

    let hyperstructure_finished_selector =
        0x10e79c3a2a9908c09d1b27bc9528744056ed39d0391b08fc6d21b482e4dbab;

    let mut found = false;
    loop {
        let mut event_option = starknet::testing::pop_log_raw(world.contract_address);
        match event_option {
            Option::Some(val) => {
                let (mut keys, mut data) = val;

                let event_selector = *keys.at(0);
                if (event_selector != hyperstructure_finished_selector) {
                    continue;
                }

                found = true;

                let event_hyperstructure_entity_id = (*data.at(0));
                let timestamp = (*data.at(1));

                assert(
                    event_hyperstructure_entity_id == hyperstructure_entity_id.into(),
                    'wrong entity_id'
                );
                assert(timestamp == 0, 'wrong timestamp');

                break;
            },
            Option::None => { break; },
        }
    };
    assert(found == true, 'HyperstructureFinished missing');
}
