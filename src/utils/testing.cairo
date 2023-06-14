// components
use eternum::components::owner::OwnerComponent;
use eternum::components::realm::RealmComponent;
use eternum::components::config::{
    WorldConfigComponent, SpeedConfigComponent, CapacityConfigComponent
};
use eternum::components::metadata::MetaDataComponent;
use eternum::components::quantity::{QuantityComponent, QuantityTrackerComponent};
use eternum::components::resources::ResourceComponent;
use eternum::components::position::PositionComponent;
use eternum::components::capacity::CapacityComponent;
use eternum::components::movable::{MovableComponent, ArrivalTimeComponent};
use eternum::components::caravan::{CaravanMembersComponent, CaravanComponent};
use eternum::components::metadata::ForeignKeyComponent;
use eternum::components::trade::{StatusComponent, TradeComponent};
use eternum::components::trade::FungibleEntitiesComponent;

// systems
use eternum::systems::test::CreateRealm;
use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnit;
use eternum::systems::caravan::create_caravan::CreateCaravan;
use eternum::systems::config::speed_config::SetSpeedConfig;
use eternum::systems::config::capacity_config::SetCapacityConfig;
use eternum::systems::config::world_config::SetWorldConfig;
use eternum::systems::caravan::utils::{GetAverageSpeed, GetQuantity};
use eternum::systems::order::make_fungible_order::MakeFungibleOrder;
use eternum::systems::order::take_fungible_order::TakeFungibleOrder;
use eternum::systems::order::attach_caravan::AttachCaravan;
use eternum::systems::order::claim_fungible_order::ClaimFungibleOrder;

// consts
use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

use core::traits::Into;
use core::result::ResultTrait;
use array::ArrayTrait;
use option::OptionTrait;
use debug::PrintTrait;
use traits::TryInto;

use starknet::{
    ClassHash, syscalls::deploy_syscall, class_hash::Felt252TryIntoClassHash, get_caller_address
};

use dojo_core::storage::query::Query;
use dojo_core::test_utils::spawn_test_world;
use dojo_core::auth::systems::{GrantAuthRole, Route, RouteTrait};
use dojo_core::auth::components::{AuthRoleComponent, AuthStatusComponent};
use dojo_core::test_utils::mock_auth_components_systems;
use dojo_core::{
    executor::Executor, world::World, interfaces::{IWorldDispatcher, IWorldDispatcherTrait}
};

fn retrieve_list_of_world_components_and_systems() -> (Array<felt252>, Array<felt252>) {
    // components
    let mut components = array::ArrayTrait::<felt252>::new();
    components.append(OwnerComponent::TEST_CLASS_HASH);
    components.append(MovableComponent::TEST_CLASS_HASH);
    components.append(QuantityComponent::TEST_CLASS_HASH);
    components.append(RealmComponent::TEST_CLASS_HASH);
    components.append(SpeedConfigComponent::TEST_CLASS_HASH);
    components.append(CapacityConfigComponent::TEST_CLASS_HASH);
    components.append(WorldConfigComponent::TEST_CLASS_HASH);
    components.append(MetaDataComponent::TEST_CLASS_HASH);
    components.append(QuantityTrackerComponent::TEST_CLASS_HASH);
    components.append(PositionComponent::TEST_CLASS_HASH);
    components.append(CapacityComponent::TEST_CLASS_HASH);
    components.append(ArrivalTimeComponent::TEST_CLASS_HASH);
    components.append(CaravanMembersComponent::TEST_CLASS_HASH);
    components.append(CaravanComponent::TEST_CLASS_HASH);
    components.append(ForeignKeyComponent::TEST_CLASS_HASH);
    components.append(TradeComponent::TEST_CLASS_HASH);
    components.append(FungibleEntitiesComponent::TEST_CLASS_HASH);
    components.append(ResourceComponent::TEST_CLASS_HASH);
    components.append(StatusComponent::TEST_CLASS_HASH);
    components.append(AuthRoleComponent::TEST_CLASS_HASH);
    components.append(AuthStatusComponent::TEST_CLASS_HASH);
    // systems
    let mut systems = array::ArrayTrait::<felt252>::new();
    systems.append(GetAverageSpeed::TEST_CLASS_HASH);
    systems.append(CreateFreeTransportUnit::TEST_CLASS_HASH);
    systems.append(CreateCaravan::TEST_CLASS_HASH);
    systems.append(SetSpeedConfig::TEST_CLASS_HASH);
    systems.append(SetCapacityConfig::TEST_CLASS_HASH);
    systems.append(SetWorldConfig::TEST_CLASS_HASH);
    systems.append(CreateRealm::TEST_CLASS_HASH);
    systems.append(GetQuantity::TEST_CLASS_HASH);
    systems.append(MakeFungibleOrder::TEST_CLASS_HASH);
    systems.append(TakeFungibleOrder::TEST_CLASS_HASH);
    systems.append(GrantAuthRole::TEST_CLASS_HASH);
    systems.append(AttachCaravan::TEST_CLASS_HASH);
    systems.append(ClaimFungibleOrder::TEST_CLASS_HASH);

    (components, systems)
}

// used for testing, to register all systems and components in the world
fn spawn_test_world_with_setup() -> IWorldDispatcher {
    let (components, systems) = retrieve_list_of_world_components_and_systems();

    // routes
    let mut routes = array::ArrayTrait::<Route>::new();

    let world = spawn_test_world(components, systems, routes);

    world
}

fn spawn_test_world_without_init() -> IWorldDispatcher {
    // deploy executor
    let constructor_calldata = array::ArrayTrait::new();
    let (executor_address, _) = deploy_syscall(
        Executor::TEST_CLASS_HASH.try_into().unwrap(), 0, constructor_calldata.span(), false
    )
        .unwrap();

    // deploy world
    let mut world_constructor_calldata = array::ArrayTrait::new();
    world_constructor_calldata.append(executor_address.into());
    let (world_address, _) = deploy_syscall(
        World::TEST_CLASS_HASH.try_into().unwrap(), 0, world_constructor_calldata.span(), false
    )
        .unwrap();
    let world = IWorldDispatcher { contract_address: world_address };

    // register auth components and systems
    let (auth_components, auth_systems) = mock_auth_components_systems();
    let mut index = 0;
    loop {
        if index == auth_components.len() {
            break ();
        }
        world.register_component(*auth_components.at(index));
        index += 1;
    };

    let mut index = 0;
    loop {
        if index == auth_systems.len() {
            break ();
        }
        world.register_system(*auth_systems.at(index));
        index += 1;
    };

    // Grant Admin role to the spawner
    let caller = get_caller_address();
    let mut grant_role_calldata: Array<felt252> = ArrayTrait::new();

    grant_role_calldata.append(caller.into()); // target_id
    grant_role_calldata.append(World::ADMIN); // role_id
    world.execute('GrantAuthRole'.into(), grant_role_calldata.span());

    // register all systems and components in the world
    let (components, systems) = retrieve_list_of_world_components_and_systems();

    // register components
    let mut index = 0;
    loop {
        if index == components.len() {
            break ();
        }
        world.register_component((*components[index]).try_into().unwrap());
        index += 1;
    };

    // register systems
    let mut index = 0;
    loop {
        if index == systems.len() {
            break ();
        }
        world.register_system((*systems[index]).try_into().unwrap());
        index += 1;
    };

    world
}
