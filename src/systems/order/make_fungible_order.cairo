// creates a non fungible order
// if taker_id is specified, the order can only be taken by a certain entity
// if taker_id = 0, then can be taken by any entity

#[system]
mod MakeFungibleOrder {
    use eternum::components::entities::FungibleEntities;
    use eternum::components::resources::Resource;
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::realm::Realm;
    use eternum::components::trade::FungibleTrade;
    use eternum::components::capacity::Capacity;
    use eternum::components::entity_type::EntityType;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::components::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;
    use dojo_core::serde::SpanSerde;
    use debug::PrintTrait;

    use dojo_core::integer::U128IntoU250;

    // maker_id: entity id of the maker
    // maker_entity_types: array of entity types (resources or other) that the maker wants to trade
    // maker_quantities: array of quantities of the entity types that the maker wants to trade
    // taker_id: entity id of the taker
    // taker_entity_types: array of entity types (resources or other) that the taker wants to trade
    // taker_quantities: array of quantities of the entity types that the taker wants to trade
    // taker_needs_caravan: if true, the taker needs to send a caravan to the maker
    // expires_at: timestamp when the order expires
    fn execute(
        maker_id: ID,
        maker_entity_types: Span<u8>,
        maker_quantities: Span<u128>,
        taker_id: ID,
        taker_entity_types: Span<u8>,
        taker_quantities: Span<u128>,
        taker_needs_caravan: bool,
        expires_at: u64
    ) -> ID {
        // assert that maker entity is owned by caller
        let maker_owner = commands::<Owner>::entity(maker_id.into());
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        assert(maker_owner.address == caller, 'Only owner can create order');

        // assert that length of maker_entity_types is equal to length of maker_quantities
        assert(maker_entity_types.len() == maker_quantities.len(), 'length not equal');

        // assert that length of taker_entity_types is equal to length of taker_quantities
        assert(taker_entity_types.len() == taker_quantities.len(), 'length not equal');

        // create maker order entity
        let maker_order_id = commands::uuid();
        let fungible_entities_id = commands::uuid();
        commands::set_entity(
            maker_order_id.into(),
            (
                FungibleEntities {
                    key: fungible_entities_id.into(), count: maker_entity_types.len(), 
                },
            )
        );
        // create maker fungible entities and remove them from the maker balance
        let mut index = 0;
        loop {
            if index == maker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (maker_order_id, fungible_entities_id, index).into(),
                (Resource {
                    resource_type: *maker_entity_types[index], balance: *maker_quantities[index]
                })
            );

            // let quantity = commands::<Quantity>::entity(
            //     (maker_id, *maker_entity_types[index]).into()
            // );

            // assert(quantity.value >= *maker_quantities[index], 'Balance too small');

            // decrease balance of maker
            let query = (maker_id, *maker_entity_types[index]).into();
            let resource = commands::<Resource>::entity(query);
            assert(resource.balance >= *maker_quantities[index], 'Balance too small');
            commands::set_entity(
                query,
                (Resource {
                    resource_type: *maker_entity_types[index],
                    balance: resource.balance - *maker_quantities[index]
                })
            );

            index += 1;
        };

        // create taker order entity
        let taker_order_id = commands::uuid();
        commands::set_entity(
            taker_order_id.into(),
            (
                FungibleEntities {
                    key: fungible_entities_id.into(), count: taker_entity_types.len(), 
                },
            )
        );

        // create taker fungible entities but dont remove them from the taker balance, because 
        // needs to be taken first
        let mut index = 0;
        loop {
            if index == taker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (taker_order_id, fungible_entities_id, index).into(),
                (Resource {
                    balance: *taker_quantities[index], resource_type: *taker_entity_types[index]
                })
            );

            index += 1;
        };

        // create trade entity
        let trade_id = commands::uuid();
        commands::set_entity(
            trade_id.into(),
            (FungibleTrade {
                maker_id,
                taker_id,
                maker_order_id: maker_order_id.into(),
                taker_order_id: taker_order_id.into(),
                claimed_by_maker: false,
                claimed_by_taker: false,
                expires_at: expires_at,
                taker_needs_caravan: taker_needs_caravan,
            })
        );
        trade_id.into()
    }
}

mod tests {
    use eternum::alias::ID;
    use eternum::components::entities::ForeignKey;
    use eternum::components::caravan::CaravanMembers;
    use eternum::components::quantity::Quantity;
    use eternum::components::position::Position;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;
    use eternum::components::owner::Owner;

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
    use eternum::systems::caravan::utils::GetAverageSpeedSystem;

    // consts
    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

    // utils
    use eternum::utils::testing::spawn_test_world_with_setup;

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

    // test that the average speed is correct
    #[test]
    #[available_gas(300000000000)]
    fn test_make_fungible_order() {
        let world = spawn_test_world_with_setup();
        // set caller as admin 
        let mut values = array::ArrayTrait::<felt252>::new();
        values.append(11);
        values.append('Admin'.into());
        world.execute('GrantAuthRole'.into(), values.span());
        // set as executor
        starknet::testing::set_contract_address(starknet::contract_address_const::<1>());
        // ap change issue
        // let maker_id = 11;
        // let taker_id = 12;

        // create entity 1
        let mut values = array::ArrayTrait::<felt252>::new();
        values.append(11);
        world.set_entity('Owner'.into(), 11.into(), 0_u8, values.span());

        // entity 2
        let mut values = array::ArrayTrait::<felt252>::new();
        values.append(12);
        world.set_entity('Owner'.into(), 12.into(), 0_u8, values.span());

        // add resources to entity 1 and 2
        let mut values = array::ArrayTrait::<felt252>::new();
        // resource_type
        values.append(1);
        // balance
        values.append(100);
        world.set_entity('Resource'.into(), (11, 1).into(), 0_u8, values.span());
        world.set_entity('Resource'.into(), (12, 1).into(), 0_u8, values.span());
        let mut resources_2 = array::ArrayTrait::<felt252>::new();
        // resource_type
        resources_2.append(2);
        // balance
        resources_2.append(100);
        world.set_entity('Resource'.into(), (11, 2).into(), 0_u8, values.span());
        world.set_entity('Resource'.into(), (12, 2).into(), 0_u8, values.span());

        // create order
        starknet::testing::set_account_contract_address(starknet::contract_address_const::<11>());
        let mut values = array::ArrayTrait::<felt252>::new();
        // maker_id
        values.append(11);
        // len
        values.append(2);
        // types
        values.append(1);
        values.append(2);
        // len
        values.append(2);
        // quantities
        values.append(100);
        values.append(100);
        // taker_id
        values.append(12);
        // len
        values.append(2);
        // types
        values.append(1);
        values.append(2);
        // len
        values.append(2);
        // quantities
        values.append(100);
        values.append(100);
        // taker_needs_caravan
        values.append(0);
        // expires_at
        values.append(100);
        let result = world.execute('MakeFungibleOrder'.into(), values.span());
        let trade_id = *result[0];

        // check balances
        let resource = world.entity('Resource'.into(), (11, 1).into(), 0_u8, 0_usize);
        assert(*resource[1] == 0, 'Balance should be 0');
        let resource = world.entity('Resource'.into(), (11, 2).into(), 0_u8, 0_usize);
        assert(*resource[1] == 0, 'Balance should be 0');

        let resource = world.entity('Resource'.into(), (12, 1).into(), 0_u8, 0_usize);
        assert(*resource[1] == 100, 'Balance should be 100');
        let resource = world.entity('Resource'.into(), (12, 2).into(), 0_u8, 0_usize);
        assert(*resource[1] == 100, 'Balance should be 100');

        // check that the trade was created
        let trade = world.entity('FungibleTrade'.into(), trade_id.into(), 0_u8, 0_usize);
        assert(*trade[0] == 11, 'Maker id should be 11');
        assert(*trade[1] == 12, 'Taker id should be 12');
        let maker_order_id = *trade[2];
        let taker_order_id = *trade[3];
        assert(*trade[4] == 100, 'Expires at should be 100');
        assert(*trade[5] == 0, 'Claimed should be false');
        assert(*trade[6] == 0, 'Claimed should be false');
        assert(*trade[7] == 0, 'Need caravan should be false');

        // check that the maker order was created
        let maker_order = world
            .entity('FungibleEntities'.into(), maker_order_id.into(), 0_u8, 0_usize);
        assert(*maker_order[1] == 2, 'Count should be 2');
        let key = *maker_order[0];
        let resource = world
            .entity('Resource'.into(), (maker_order_id, key, 0).into(), 0_u8, 0_usize);
        assert(*resource[0] == 1, 'Resource type should be 1');
        assert(*resource[1] == 100, 'Balance should be 100');
        let resource = world
            .entity('Resource'.into(), (maker_order_id, key, 1).into(), 0_u8, 0_usize);
        assert(*resource[0] == 2, 'Resource type should be 2');
        assert(*resource[1] == 100, 'Balance should be 100');

        // check that taker order was created
        let taker_order = world
            .entity('FungibleEntities'.into(), taker_order_id.into(), 0_u8, 0_usize);
        assert(*taker_order[1] == 2, 'Count should be 2');
        let key = *taker_order[0];
        let resource = world
            .entity('Resource'.into(), (taker_order_id, key, 0).into(), 0_u8, 0_usize);
        assert(*resource[0] == 1, 'Resource type should be 1');
        assert(*resource[1] == 100, 'Balance should be 100');
        let resource = world
            .entity('Resource'.into(), (taker_order_id, key, 1).into(), 0_u8, 0_usize);
        assert(*resource[0] == 2, 'Resource type should be 2');
        assert(*resource[1] == 100, 'Balance should be 100');
    }
}
