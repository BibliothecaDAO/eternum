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

// consts
use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

use core::traits::Into;
use core::result::ResultTrait;
use array::ArrayTrait;
use option::OptionTrait;
use debug::PrintTrait;

use starknet::syscalls::deploy_syscall;

use dojo_core::interfaces::IWorldDispatcherTrait;
use dojo_core::interfaces::IWorldDispatcher;
use dojo_core::storage::query::Query;
use dojo_core::test_utils::spawn_test_world;
use dojo_core::auth::systems::{GrantAuthRole, Route, RouteTrait};
use dojo_core::auth::components::{AuthRoleComponent, AuthStatusComponent};

// used for testing, to register all systems and components in the world
fn spawn_test_world_with_setup() -> IWorldDispatcher {
    // register all systems and components in the world
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

    // routes
    let mut routes = array::ArrayTrait::<Route>::new();

    let world = spawn_test_world(components, systems, routes);

    world
}
