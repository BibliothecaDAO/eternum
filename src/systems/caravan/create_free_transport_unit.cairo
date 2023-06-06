// store the number of free transport unit per realm
// get the maximum number of free transport unit per realm from the world config

// DISCUSS: non fungible because can have different positions, so cannot be attached to an entity
// so each group of transport unit is an independent entity

#[system]
mod CreateFreeTransportUnit {
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::realm::Realm;
    use eternum::components::capacity::Capacity;
    use eternum::components::entity_type::EntityType;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::components::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use debug::PrintTrait;

    use dojo_core::integer::U128IntoU250;

    fn execute(entity_id: ID, quantity: u128) -> ID {
        // assert that the entity is a realm
        let (owner, realm, position, entity_type) = commands::<Owner,
        Realm,
        Position,
        EntityType>::entity(entity_id.into());

        // assert that entity is owned by caller
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        assert(caller == owner.address, 'entity is not owned by caller');

        // check how many free transport units you can still build
        let world_config = commands::<WorldConfig>::entity(WORLD_CONFIG_ID.into());

        // nb cities for the realm
        let max_free_transport = realm.cities.into() * world_config.free_transport_per_city;

        // check the quantity_tracker for free transport unit
        let maybe_quantity_tracker = commands::<QuantityTracker>::try_entity(
            (entity_id, REALM_ENTITY_TYPE).into()
        );
        let count = match maybe_quantity_tracker {
            Option::Some(quantity_tracker) => (quantity_tracker.count),
            Option::None(_) => {
                0
            }
        };
        assert(count + quantity <= max_free_transport, 'not enough free transport unit');

        // increment count
        // DISCUSS: need to decrease count when transport unit is destroyed
        commands::set_entity(
            (entity_id, FREE_TRANSPORT_ENTITY_TYPE).into(),
            (QuantityTracker { count: count + quantity })
        );

        // create the transport unit
        let id = commands::uuid();
        let id_1 = commands::uuid();
        let (speed, capacity) = commands::<SpeedConfig,
        CapacityConfig>::entity((WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE).into());
        // a free transport unit has 
        // - position
        // - entity_type
        // - owner
        // - quantity
        // - speed
        // - arrival time
        commands::set_entity(
            id.into(),
            (
                Position {
                    x: position.x, y: position.y
                    }, EntityType {
                    value: FREE_TRANSPORT_ENTITY_TYPE
                    }, Owner {
                    address: caller
                    }, Quantity {
                    value: quantity
                    }, Movable {
                    km_per_hr: speed.km_per_hr.try_into().unwrap(), blocked: false, 
                    }, ArrivalTime {
                    arrives_at: 0, 
                    }, Capacity {
                    weight_gram: capacity.weight_gram
                }
            )
        );
        id.into()
    }
}


mod tests {
    // components
    use eternum::components::realm::RealmComponent;
    use eternum::components::owner::OwnerComponent;
    use eternum::components::config::{
        WorldConfigComponent, SpeedConfigComponent, CapacityConfigComponent
    };
    use eternum::components::entity_type::EntityTypeComponent;
    use eternum::components::quantity::{QuantityComponent, QuantityTrackerComponent};
    use eternum::components::position::PositionComponent;
    use eternum::components::capacity::CapacityComponent;
    use eternum::components::movable::{MovableComponent, ArrivalTimeComponent};

    // systems
    use eternum::systems::test::CreateRealmSystem;
    use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnitSystem;
    use eternum::systems::config::speed_config::SetSpeedConfigSystem;
    use eternum::systems::config::capacity_config::SetCapacityConfigSystem;
    use eternum::systems::config::world_config::WorldConfigSystem;

    // consts
    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

    use core::traits::Into;
    use core::result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use debug::PrintTrait;

    use starknet::syscalls::deploy_syscall;

    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::storage::query::Query;
    use dojo_core::test_utils::spawn_test_world;
    use dojo_core::auth::systems::{Route, RouteTrait};

    #[test]
    #[available_gas(300000000000)]
    fn test_create_free_transport_unit() {
        // components
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(OwnerComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(SpeedConfigComponent::TEST_CLASS_HASH);
        components.append(CapacityConfigComponent::TEST_CLASS_HASH);
        components.append(WorldConfigComponent::TEST_CLASS_HASH);
        components.append(EntityTypeComponent::TEST_CLASS_HASH);
        components.append(QuantityComponent::TEST_CLASS_HASH);
        components.append(PositionComponent::TEST_CLASS_HASH);
        components.append(CapacityComponent::TEST_CLASS_HASH);
        components.append(MovableComponent::TEST_CLASS_HASH);
        components.append(ArrivalTimeComponent::TEST_CLASS_HASH);
        components.append(QuantityTrackerComponent::TEST_CLASS_HASH);
        // systems
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(CreateFreeTransportUnitSystem::TEST_CLASS_HASH);
        systems.append(SetSpeedConfigSystem::TEST_CLASS_HASH);
        systems.append(SetCapacityConfigSystem::TEST_CLASS_HASH);
        systems.append(WorldConfigSystem::TEST_CLASS_HASH);
        systems.append(CreateRealmSystem::TEST_CLASS_HASH);

        // create auth routes
        let mut routes = array::ArrayTrait::new();
        // CreateFreeTransportUnit
        routes
            .append(
                RouteTrait::new(
                    'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Position'.into(), 
                )
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
                RouteTrait::new(
                    'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Quantity'.into(), 
                )
            );
        routes
            .append(
                RouteTrait::new(
                    'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Movable'.into(), 
                )
            );
        routes
            .append(
                RouteTrait::new(
                    'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'ArrivalTime'.into(), 
                )
            );
        routes
            .append(
                RouteTrait::new(
                    'CreateFreeTransportUnit'.into(), 'Tester'.into(), 'Capacity'.into(), 
                )
            );
        // CreateRealm
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Owner'.into(), ));
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Realm'.into(), ));
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Position'.into(), ));
        routes
            .append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'EntityType'.into(), ));

        // configs
        routes
            .append(
                RouteTrait::new('SetSpeedConfig'.into(), 'Tester'.into(), 'SpeedConfig'.into(), )
            );
        routes
            .append(
                RouteTrait::new(
                    'SetCapacityConfig'.into(), 'Tester'.into(), 'CapacityConfig'.into(), 
                )
            );
        routes
            .append(RouteTrait::new('WorldConfig'.into(), 'Tester'.into(), 'WorldConfig'.into(), ));

        let world = spawn_test_world(components, systems, routes);

        /// CREATE ENTITIES ///
        // set realm entity
        let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
        create_realm_calldata.append(1);
        create_realm_calldata.append(starknet::get_caller_address().into());
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        // cities = 6
        create_realm_calldata.append(6);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        // position
        create_realm_calldata.append(20);
        create_realm_calldata.append(30);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());

        // set speed configuration entity
        let mut set_speed_conf_calldata = array::ArrayTrait::<felt252>::new();
        set_speed_conf_calldata.append(FREE_TRANSPORT_ENTITY_TYPE.into());
        // speed of 10 km per hr for free transport unit
        set_speed_conf_calldata.append(10);
        world.execute('SetSpeedConfig'.into(), set_speed_conf_calldata.span());
        // set world config
        let mut world_config_call_data = array::ArrayTrait::<felt252>::new();
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(252000000000000000000);
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        // 10 free transport per city
        world_config_call_data.append(10);
        world.execute('WorldConfig'.into(), world_config_call_data.span());

        // set capacity configuration entity
        let mut set_capacity_conf_calldata = array::ArrayTrait::<felt252>::new();
        set_capacity_conf_calldata.append(FREE_TRANSPORT_ENTITY_TYPE.into());
        // free transport unit can carry 200_000 grams (200 kg)
        set_capacity_conf_calldata.append(200000);
        world.execute('SetCapacityConfig'.into(), set_capacity_conf_calldata.span());

        // create free transport unit
        let mut create_free_transport_unit_calldata = array::ArrayTrait::<felt252>::new();
        create_free_transport_unit_calldata.append(1);
        create_free_transport_unit_calldata.append(10);
        let result = world
            .execute('CreateFreeTransportUnit'.into(), create_free_transport_unit_calldata.span());
        let new_entity_id = (*result[0]);

        // check that the free transport unit has been created
        let quantity = world.entity('Quantity'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*quantity[0] == 10, 'free transport unit not created');
        // verify that quantity tracker has been updated
        let quantity_tracker = world
            .entity(
                'QuantityTracker'.into(), (1, FREE_TRANSPORT_ENTITY_TYPE).into(), 0_u8, 0_usize
            );
        assert(*quantity_tracker[0] == 10, 'quantity tracker not updated');

        // verify the position
        let position = world.entity('Position'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*position[0] == 20, 'position not set');
        assert(*position[1] == 30, 'position not set');

        // verify the entity type
        let entity_type = world.entity('EntityType'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*entity_type[0] == FREE_TRANSPORT_ENTITY_TYPE.into(), 'entity type not set');

        // verify the owner
        let owner = world.entity('Owner'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*owner[0] == starknet::get_caller_address().into(), 'owner not set');

        // verify the capacity
        let capacity = world.entity('Capacity'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*capacity[0] == 200000, 'capacity not set');

        // verify the speed
        let speed = world.entity('Movable'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*speed[0] == 10, 'speed not set');
        // verify that the free transport unit is not blocked
        assert(*speed[1] == 0, 'entity is blocked');

        // verify the arrival time
        let arrival_time = world.entity('ArrivalTime'.into(), new_entity_id.into(), 0_u8, 0_usize);
        assert(*arrival_time[0] == 0, 'arrival time not set');
    }
// TODO: #[should_panic(expected: ('not enough free transport unit', ))]
// not working atm 
}
