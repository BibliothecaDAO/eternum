use core::option::OptionTrait;

use core::traits::Into;

use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{ResourceTypes, get_resources_without_earthenshards};
use eternum::models::hyperstructure::{Progress, Contribution, Hyperstructure};
use eternum::models::level::Level;
use eternum::models::owner::Owner;
use eternum::models::position::{Position, Coord};
use eternum::models::resources::Resource;
use eternum::models::structure::{Structure, StructureCount, StructureCountCustomTrait, StructureCategory};

use eternum::systems::config::contracts::{
    config_systems, config_systems::HyperstructureConfigCustomImpl, IHyperstructureConfigDispatcher,
    IHyperstructureConfig, IHyperstructureConfigDispatcherTrait
};

use eternum::systems::hyperstructure::contracts::{
    hyperstructure_systems, IHyperstructureSystems, IHyperstructureSystemsDispatcher,
    IHyperstructureSystemsDispatcherTrait
};

use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_hyperstructure_systems},
    general::{spawn_realm, get_default_realm_pos, spawn_hyperstructure, get_default_hyperstructure_coord},
    config::{set_capacity_config, set_settlement_config}
};

use starknet::contract_address_const;

const TEST_AMOUNT: u128 = 1_000_000;
const TIME_BETWEEN_SHARES_CHANGE: u64 = 1_000;
const POINTS_PER_CYCLE: u128 = 1_000;
const POINTS_FOR_WIN: u128 = 3_000_000;
const POINTS_ON_COMPLETION: u128 = 2_000_000;

fn setup() -> (IWorldDispatcher, ID, IHyperstructureSystemsDispatcher) {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);
    set_settlement_config(config_systems_address);

    let realm_systems_dispatcher = deploy_realm_systems(world);
    let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(world);

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher { contract_address: config_systems_address };

    set!(
        world,
        (
            Resource {
                entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: TEST_AMOUNT * 10,
            },
        )
    );

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut resources_for_completion = array![(ResourceTypes::EARTHEN_SHARD, TEST_AMOUNT)];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);

        resources_for_completion.append((resource_type, TEST_AMOUNT));

        set!(world, (Resource { entity_id: realm_entity_id, resource_type, balance: TEST_AMOUNT * 10, },));

        i += 1;
    };

    hyperstructure_config_dispatcher
        .set_hyperstructure_config(
            resources_for_completion.span(),
            TIME_BETWEEN_SHARES_CHANGE,
            POINTS_PER_CYCLE,
            POINTS_FOR_WIN,
            POINTS_ON_COMPLETION
        );

    (world, realm_entity_id, hyperstructure_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn test_create_hyperstructure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let structure = get!(world, hyperstructure_entity_id, Structure);
    assert(structure.category == StructureCategory::Hyperstructure, 'invalid category for structure');

    let structure_count = get!(world, get_default_hyperstructure_coord(), StructureCount);
    assert(structure_count.count == 1, 'invalid structure count');

    let hyperstructure_position = get!(world, hyperstructure_entity_id, Position);
    assert(hyperstructure_position.x == 0 && hyperstructure_position.y == 0, 'invalid position for hs');

    let hyperstructure_owner = get!(world, hyperstructure_entity_id, Owner);
    assert(hyperstructure_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of hs');

    let progress = get!(world, (hyperstructure_entity_id, ResourceTypes::EARTHEN_SHARD), Progress);
    assert(progress.amount == TEST_AMOUNT, 'Invalid progress');

    let contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::EARTHEN_SHARD),
        Contribution
    );
    assert(contribution.amount == TEST_AMOUNT, 'Invalid contribution amount');
    assert(contribution.player_address == contract_address_const::<'player1'>(), 'invalid contribution address');
    assert(contribution.resource_type == ResourceTypes::EARTHEN_SHARD, 'invalid contribution resource');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 1, resource type: EARTHEN SHARD, balance: 0). deduction: 1000000",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_create_hyperstructure_not_enough_eartenshards() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    set!(world, (Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: 0, },));

    spawn_hyperstructure(world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord());
}

#[test]
#[available_gas(3000000000000)]
fn test_contribute_one_resource() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
    let contribution_amount = 100_000;

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let contributions = array![(ResourceTypes::WOOD, contribution_amount),].span();
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == contribution_amount, 'invalid wood progress');

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);
    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
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

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let contributions = array![
        (ResourceTypes::WOOD, wood_contribution_amount), (ResourceTypes::STONE, stone_contribution_amount)
    ]
        .span();

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount, 'invalid wood progress');

    let stone_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE), Contribution
    );
    assert(stone_contribution.amount == stone_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount, 'invalid wood progress');

    // contribute a second time
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount * 2, 'invalid wood progress');

    let stone_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE), Contribution
    );
    assert(stone_contribution.amount == stone_contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount * 2, 'invalid wood progress');
}

#[test]
#[available_gas(3000000000000)]
fn test_finish_hyperstructure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut contributions = array![];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);
        contributions.append((resource_type, TEST_AMOUNT));
        i += 1;
    };

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions.span());

    let hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);
    assert(hyperstructure.completed, 'hyperstructure not completed');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ("Not enough points to end the game", 'ENTRYPOINT_FAILED'))]
fn test_end_game_failure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_and_finish_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    hyperstructure_systems_dispatcher.end_game(array![hyperstructure_entity_id].span(), array![].span());
}


#[test]
#[available_gas(3000000000000)]
fn test_end_game_success_completion_only() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 }
    );

    let hyperstructure_entity_id_1 = spawn_and_finish_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 1, y: 1 }
    );

    hyperstructure_systems_dispatcher
        .end_game(array![hyperstructure_entity_id_0, hyperstructure_entity_id_1].span(), array![].span());
}

#[test]
#[available_gas(3000000000000)]
fn test_end_game_success_completion_and_shares() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 }
    );

    hyperstructure_systems_dispatcher
        .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

    starknet::testing::set_block_timestamp(1001);

    hyperstructure_systems_dispatcher
        .end_game(array![hyperstructure_entity_id_0].span(), array![(hyperstructure_entity_id_0, 0)].span());
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ("Not enough points to end the game", 'ENTRYPOINT_FAILED'))]
fn test_end_game_failure_completion_and_shares() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 }
    );

    hyperstructure_systems_dispatcher
        .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

    starknet::testing::set_block_timestamp(1000);

    hyperstructure_systems_dispatcher
        .end_game(array![hyperstructure_entity_id_0].span(), array![(hyperstructure_entity_id_0, 0)].span());
}

fn spawn_and_finish_hyperstructure(
    world: IWorldDispatcher,
    hyperstructure_systems_dispatcher: IHyperstructureSystemsDispatcher,
    realm_entity_id: ID,
    coord: Coord
) -> ID {
    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, coord
    );

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut contributions = array![];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);
        contributions.append((resource_type, TEST_AMOUNT));
        i += 1;
    };

    // + POINTS_ON_COMPLETION (2_000_000)
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions.span());

    let hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);
    assert(hyperstructure.completed, 'hyperstructure not completed');

    hyperstructure_entity_id
}
