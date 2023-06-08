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
use eternum::components::entities::ForeignKeyComponent;
use eternum::components::trade::{StatusComponent, FungibleTradeComponent};
use eternum::components::entities::FungibleEntitiesComponent;

// systems
use eternum::systems::test::CreateRealm;
use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnit;
use eternum::systems::caravan::create_caravan::CreateCaravan;
use eternum::systems::config::speed_config::SetSpeedConfig;
use eternum::systems::config::capacity_config::SetCapacityConfig;
use eternum::systems::config::world_config::WorldConfig;
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

fn spawn_test_world_with_setup() -> IWorldDispatcher {
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
    components.append(FungibleTradeComponent::TEST_CLASS_HASH);
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
    systems.append(WorldConfig::TEST_CLASS_HASH);
    systems.append(CreateRealm::TEST_CLASS_HASH);
    systems.append(GetQuantity::TEST_CLASS_HASH);
    systems.append(MakeFungibleOrder::TEST_CLASS_HASH);
    systems.append(TakeFungibleOrder::TEST_CLASS_HASH);
    systems.append(GrantAuthRole::TEST_CLASS_HASH);
    systems.append(AttachCaravan::TEST_CLASS_HASH);

    // create auth routes
    let mut routes = array::ArrayTrait::new();
    // GetAverageSpeed
    routes.append(RouteTrait::new('GetAverageSpeed'.into(), 'Tester'.into(), 'Owner'.into(), ));
    routes.append(RouteTrait::new('GetAverageSpeed'.into(), 'Tester'.into(), 'Movable'.into(), ));
    routes.append(RouteTrait::new('GetAverageSpeed'.into(), 'Tester'.into(), 'Quantity'.into(), ));

    // CreateFreeTransportUnit
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Position'.into(), )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Realm'.into(), )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Owner'.into(), )
        );
    routes
        .append(
            RouteTrait::new(
                'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'QuantityTracker'.into(), 
            )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'MetaData'.into(), )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Quantity'.into(), )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Movable'.into(), )
        );
    routes
        .append(
            RouteTrait::new(
                'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'ArrivalTime'.into(), 
            )
        );
    routes
        .append(
            RouteTrait::new('CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Capacity'.into(), )
        );

    // CreateCaravan
    routes
        .append(
            RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'CaravanMembers'.into(), )
        );
    routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Movable'.into(), ));
    routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Capacity'.into(), ));
    routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Owner'.into(), ));
    routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Position'.into(), ));
    routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'ForeignKey'.into(), ));

    // CreateRealm
    routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Owner'.into(), ));
    routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Realm'.into(), ));
    routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Position'.into(), ));
    routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'MetaData'.into(), ));

    // configs
    routes
        .append(RouteTrait::new('SetSpeedConfig'.into(), 'Tester'.into(), 'SpeedConfig'.into(), ));
    routes
        .append(
            RouteTrait::new('SetCapacityConfig'.into(), 'Tester'.into(), 'CapacityConfig'.into(), )
        );
    routes.append(RouteTrait::new('WorldConfig'.into(), 'Tester'.into(), 'WorldConfig'.into(), ));

    let world = spawn_test_world(components, systems, routes);

    world
}
