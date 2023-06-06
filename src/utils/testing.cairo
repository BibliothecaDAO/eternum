// components
use eternum::components::owner::OwnerComponent;
use eternum::components::realm::RealmComponent;
use eternum::components::config::{
    WorldConfigComponent, SpeedConfigComponent, CapacityConfigComponent
};
use eternum::components::entity_type::EntityTypeComponent;
use eternum::components::quantity::{QuantityComponent, QuantityTrackerComponent};
use eternum::components::resources::ResourceComponent;
use eternum::components::position::PositionComponent;
use eternum::components::capacity::CapacityComponent;
use eternum::components::movable::{MovableComponent, ArrivalTimeComponent};
use eternum::components::caravan::CaravanMembersComponent;
use eternum::components::entities::ForeignKeyComponent;
use eternum::components::trade::FungibleTradeComponent;
use eternum::components::entities::FungibleEntitiesComponent;

// systems
use eternum::systems::test::CreateRealmSystem;
use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnitSystem;
use eternum::systems::caravan::create_caravan::CreateCaravanSystem;
use eternum::systems::config::speed_config::SetSpeedConfigSystem;
use eternum::systems::config::capacity_config::SetCapacityConfigSystem;
use eternum::systems::config::world_config::WorldConfigSystem;
use eternum::systems::caravan::utils::{GetAverageSpeedSystem, GetQuantitySystem};
use eternum::systems::order::make_fungible_order::MakeFungibleOrderSystem;

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
use dojo_core::auth::systems::{Route, RouteTrait};

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
    components.append(EntityTypeComponent::TEST_CLASS_HASH);
    components.append(QuantityTrackerComponent::TEST_CLASS_HASH);
    components.append(PositionComponent::TEST_CLASS_HASH);
    components.append(CapacityComponent::TEST_CLASS_HASH);
    components.append(ArrivalTimeComponent::TEST_CLASS_HASH);
    components.append(CaravanMembersComponent::TEST_CLASS_HASH);
    components.append(ForeignKeyComponent::TEST_CLASS_HASH);
    components.append(FungibleTradeComponent::TEST_CLASS_HASH);
    components.append(FungibleEntitiesComponent::TEST_CLASS_HASH);
    components.append(ResourceComponent::TEST_CLASS_HASH);
    // systems
    let mut systems = array::ArrayTrait::<felt252>::new();
    systems.append(GetAverageSpeedSystem::TEST_CLASS_HASH);
    systems.append(CreateFreeTransportUnitSystem::TEST_CLASS_HASH);
    systems.append(CreateCaravanSystem::TEST_CLASS_HASH);
    systems.append(SetSpeedConfigSystem::TEST_CLASS_HASH);
    systems.append(SetCapacityConfigSystem::TEST_CLASS_HASH);
    systems.append(WorldConfigSystem::TEST_CLASS_HASH);
    systems.append(CreateRealmSystem::TEST_CLASS_HASH);
    systems.append(GetQuantitySystem::TEST_CLASS_HASH);
    systems.append(MakeFungibleOrderSystem::TEST_CLASS_HASH);

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
            RouteTrait::new(
                'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'EntityType'.into(), 
            )
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
    routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'EntityType'.into(), ));

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
