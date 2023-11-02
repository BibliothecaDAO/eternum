#[dojo::contract]
mod transport_unit_systems {
    use eternum::alias::ID;
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::Position;
    use eternum::models::realm::Realm;
    use eternum::models::capacity::Capacity;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::config::{TravelConfig, SpeedConfig, CapacityConfig};
    use eternum::models::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{
        REALM_ENTITY_TYPE, WORLD_CONFIG_ID, TRANSPORT_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE
    };

    use eternum::systems::transport::interface::transport_unit_systems_interface::{
        ITransportUnitSystems
    };


    use core::poseidon::poseidon_hash_span;



    #[external(v0)]
    impl TransportUnitSystemsImpl of ITransportUnitSystems<ContractState>{

        /// Creates a new free transport unit.
        ///
        /// Transport units are the basic units of transports in 
        /// the game which can be combined to create a caravan.
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The id of the realm to create the transport unit in.
        /// * `quantity` - The number of transport units to create.
        ///
        fn create_free_unit(
            self: @ContractState, world: IWorldDispatcher,
             entity_id: u128, quantity: u128
        ) -> ID {
            // Ensure that the entity is a realm
            let (owner, realm, position) = get!(world, entity_id, (Owner, Realm, Position));

            // Ensure the entity is owned by the caller
            let caller = starknet::get_caller_address();
            assert(caller == owner.address, 'entity is not owned by caller');

            // Determine the max number of free transport units available for creation
            let travel_config = get!(world, TRANSPORT_CONFIG_ID, TravelConfig);
            let max_free_transport = realm.cities.into() * travel_config.free_transport_per_city;

            // TODO: Move to utils
            // Create a key for the quantity tracker
            let quantity_tracker_arr = array![entity_id.into(), FREE_TRANSPORT_ENTITY_TYPE.into()];
            let quantity_tracker_key = poseidon_hash_span(quantity_tracker_arr.span());

            // Check the existing count of free transport units
            let maybe_quantity_tracker = get!(world, quantity_tracker_key, QuantityTracker);
            let mut count = if maybe_quantity_tracker.count != 0 {
                maybe_quantity_tracker.count
            } else {
                0
            };

            // Ensure we're not exceeding the max free transport units allowed
            assert(count + quantity <= max_free_transport, 'not enough free transport unit');

            // Update count of free transport units
            // Note: Consider decrementing when a transport unit is destroyed
            set!(world, (
                QuantityTracker { 
                    entity_id: quantity_tracker_key, 
                    count: count + quantity 
                })
            );

            // Fetch configuration values for the new transport unit
            let (speed, capacity) 
                = get!(world, (WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE), (SpeedConfig, CapacityConfig));

            // Instantiate the new transport unit
            let id = world.uuid();
            set!(world, (
                    EntityOwner {
                        entity_id: id.into(),
                        entity_owner_id: entity_id
                    },
                    Position {
                        entity_id: id.into(), 
                        x: position.x, 
                        y: position.y
                    }, 
                    EntityMetadata {
                        entity_id: id.into(), 
                        entity_type: FREE_TRANSPORT_ENTITY_TYPE
                    }, 
                    Owner {
                        entity_id: id.into(), 
                        address: caller
                    }, 
                    Quantity {
                        entity_id: id.into(), 
                        value: quantity
                    }, 
                    Movable {
                        entity_id: id.into(), 
                        sec_per_km: speed.sec_per_km, 
                        blocked: false, 
                        round_trip: false,
                        intermediate_coord_x: 0,  
                        intermediate_coord_y: 0,  
                    }, 
                    ArrivalTime {
                        entity_id: id.into(), 
                        arrives_at: 0, 
                    }, 
                    Capacity {
                        entity_id: id.into(), 
                        weight_gram: capacity.weight_gram
                    }
                )
            );
            id.into()
        }
    }
}
