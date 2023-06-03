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
    use eternum::components::entity_type::EntityType;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::components::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;

    use dojo_core::integer::U128IntoU250;

    fn execute(entity_id: ID, quantity: u128) {
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
        let quantity_tracker = commands::<QuantityTracker>::entity(
            (entity_id, REALM_ENTITY_TYPE).into()
        );
        assert(
            quantity_tracker.count + quantity <= max_free_transport,
            'not enough free transport unit'
        );

        // increment count
        // DISCUSS: need to decrease count when transport unit is destroyed
        commands::set_entity(
            (entity_id, REALM_ENTITY_TYPE).into(),
            (QuantityTracker { count: quantity_tracker.count + quantity })
        );

        // create the transport unit
        let id = commands::uuid();
        let speed = commands::<SpeedConfig>::entity((WORLD_CONFIG_ID, entity_type.value).into());
        let weight = commands::<CapacityConfig>::entity(
            (WORLD_CONFIG_ID, entity_type.value).into()
        );
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
                    arrives_at: 0
                }
            )
        )
    }
}
