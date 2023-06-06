// from an array of entities that are movable, create one with a new movable component 
// and capacity component

// 1. you need to remove the position component of all entities in the caravan
// 2. position is reset for all subentities when the caravan is deleted 
// 3. caravan hash a position, movable and arrival_time component

#[system]
mod CreateCaravan {
    use eternum::alias::ID;
    use eternum::components::entities::ForeignKey;
    use eternum::components::caravan::CaravanMembers;
    use eternum::components::quantity::Quantity;
    use eternum::components::position::Position;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;
    use eternum::components::owner::Owner;

    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use box::BoxTrait;
    use debug::PrintTrait;

    use dojo_core::integer::U128IntoU250;
    use dojo_core::serde::SpanSerde;

    fn execute(entity_ids: Span<felt252>) -> ID {
        // speed
        let mut total_speed: u128 = 0_u128;
        let mut total_quantity: u128 = 0_u128;
        // capacity
        let mut total_capacity: u128 = 0_u128;

        // get key to write each entity of the caravan
        let entities_key = commands::uuid();

        // get caravan id
        let caravan_id = commands::uuid();
        let mut entity_position: Position = Position { x: 0, y: 0 };

        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let mut index = 0;
        // loop over the entities
        loop {
            if index == entity_ids.len() {
                break ();
            }
            // assert that they are movable
            // assert that they have a capacity component
            let (movable, capacity, position) = commands::<Movable,
            Capacity,
            Position>::entity((*entity_ids[index]).into());

            // assert that they are all at the same position
            if index != 0 {
                assert(entity_position == position, 'entities not same position');
            } else {
                entity_position = position;
            }

            // assert that caller is the owner of the entities
            let owner = commands::<Owner>::entity((*entity_ids[index]).into());
            assert(caller == owner.address, 'entity is not owned by caller');

            // assert that they are not blocked
            assert(movable.blocked == false, 'entity is blocked');

            // try to retrieve the Quantity component of the entity
            let maybe_quantity = commands::<Quantity>::try_entity((*entity_ids[index]).into());
            // TODO: match inside a loop does not work yet on dojo
            let quantity = match maybe_quantity {
                Option::Some(res) => {
                    res.value
                },
                Option::None(_) => { // if not present quantity = 1
                    1_u128
                }
            };
            // set entity in the caravan
            commands::set_entity(
                (caravan_id, entities_key, index).into(),
                (ForeignKey { entity_id: (*entity_ids[index]).try_into().unwrap(),  })
            );
            total_speed += movable.km_per_hr.into() * quantity;
            total_quantity += quantity;
            total_capacity += capacity.weight_gram;
            index += 1;
        };
        let average_speed = total_speed / total_quantity;
        let average_speed: u8 = average_speed.try_into().unwrap();

        // set the caravan entity
        commands::set_entity(
            caravan_id.into(),
            (
                Owner {
                    address: caller, 
                    }, Movable {
                    km_per_hr: average_speed, blocked: false, 
                    }, Capacity {
                    weight_gram: total_capacity, 
                    }, CaravanMembers {
                    key: entities_key.into(), count: entity_ids.len()
                    }, Position {
                    x: entity_position.x, y: entity_position.y
                }
            )
        );
        caravan_id.into()
    }
}

mod tests {
    // components
    use eternum::components::owner::OwnerComponent;
    use eternum::components::realm::RealmComponent;
    use eternum::components::config::{
        WorldConfigComponent, SpeedConfigComponent, CapacityConfigComponent
    };
    use eternum::components::entity_type::EntityTypeComponent;
    use eternum::components::quantity::{QuantityComponent, QuantityTrackerComponent};
    use eternum::components::position::PositionComponent;
    use eternum::components::capacity::CapacityComponent;
    use eternum::components::movable::{MovableComponent, ArrivalTimeComponent};
    use eternum::components::caravan::CaravanMembersComponent;
    use eternum::components::entities::ForeignKeyComponent;

    // systems
    use eternum::systems::test::CreateRealmSystem;
    use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnitSystem;
    use eternum::systems::caravan::create_caravan::CreateCaravanSystem;
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
    fn test_create_caravan() {
        // components
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(OwnerComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(SpeedConfigComponent::TEST_CLASS_HASH);
        components.append(CapacityConfigComponent::TEST_CLASS_HASH);
        components.append(WorldConfigComponent::TEST_CLASS_HASH);
        components.append(EntityTypeComponent::TEST_CLASS_HASH);
        components.append(QuantityComponent::TEST_CLASS_HASH);
        components.append(QuantityTrackerComponent::TEST_CLASS_HASH);
        components.append(PositionComponent::TEST_CLASS_HASH);
        components.append(CapacityComponent::TEST_CLASS_HASH);
        components.append(MovableComponent::TEST_CLASS_HASH);
        components.append(ArrivalTimeComponent::TEST_CLASS_HASH);
        components.append(CaravanMembersComponent::TEST_CLASS_HASH);
        components.append(ForeignKeyComponent::TEST_CLASS_HASH);
        // systems
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(CreateFreeTransportUnitSystem::TEST_CLASS_HASH);
        systems.append(CreateCaravanSystem::TEST_CLASS_HASH);
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
        // CreateCaravan
        routes
            .append(
                RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'CaravanMembers'.into(), )
            );
        routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Movable'.into(), ));
        routes
            .append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Capacity'.into(), ));
        routes.append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Owner'.into(), ));
        routes
            .append(RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'Position'.into(), ));
        routes
            .append(
                RouteTrait::new('CreateCaravan'.into(), 'Tester'.into(), 'ForeignKey'.into(), )
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
        let units_1_id: felt252 = *result[0];
        // create free transport unit
        let mut create_free_transport_unit_calldata = array::ArrayTrait::<felt252>::new();
        create_free_transport_unit_calldata.append(1);
        create_free_transport_unit_calldata.append(10);
        let result = world
            .execute('CreateFreeTransportUnit'.into(), create_free_transport_unit_calldata.span());
        let units_2_id: felt252 = *result[0];

        // create caravan
        let mut create_caravan_calldata = array::ArrayTrait::<felt252>::new();
        create_caravan_calldata.append(2);
        create_caravan_calldata.append(units_1_id);
        create_caravan_calldata.append(units_2_id);
        let result = world.execute('CreateCaravan'.into(), create_caravan_calldata.span());
        let caravan_id = *result[0];

        // assert that the caravan has been created
        let caravan_members = world
            .entity('CaravanMembers'.into(), caravan_id.into(), 0_u8, 0_usize);

        // verify that the caravan has been created
        let caravan_members = world
            .entity('CaravanMembers'.into(), caravan_id.into(), 0_u8, 0_usize);
        assert(*caravan_members[1] == 2, 'count not right');

        // verify that the caravan has the correct speed
        let speed = world.entity('Movable'.into(), caravan_id.into(), 0_u8, 0_usize);
        assert(*speed[0] == 10, 'speed not set');
        // verify that the caravan is not blocked
        assert(*speed[1] == 0, 'entity is blocked');

        // verify that the caravan has the correct capacity
        let capacity = world.entity('Capacity'.into(), caravan_id.into(), 0_u8, 0_usize);
        assert(*capacity[0] == 400000, 'capacity not set');

        // verify that the caravan has the correct position
        let position = world.entity('Position'.into(), caravan_id.into(), 0_u8, 0_usize);
        assert(*position[0] == 20, 'position not set');
        assert(*position[1] == 30, 'position not set');

        // verify that the caravan has the correct owner
        let owner = world.entity('Owner'.into(), caravan_id.into(), 0_u8, 0_usize);
        assert(*owner[0] == starknet::get_caller_address().into(), 'owner not set');

        // verify that the caravan has the correct foreign key
        let foreign_key_1 = world
            .entity(
                'ForeignKey'.into(), (caravan_id, *caravan_members[0], 0).into(), 0_u8, 0_usize
            );
        assert(*foreign_key_1[0] == units_1_id, 'foreign key not set');

        let foreign_key_2 = world
            .entity(
                'ForeignKey'.into(), (caravan_id, *caravan_members[0], 1).into(), 0_u8, 0_usize
            );

        assert(*foreign_key_2[0] == units_2_id, 'foreign key not set');
    }
}
