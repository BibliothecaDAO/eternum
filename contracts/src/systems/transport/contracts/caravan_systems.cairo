#[dojo::contract]
mod caravan_systems {
    use eternum::alias::ID;
    use eternum::models::metadata::ForeignKey;
    use eternum::models::caravan::CaravanMembers;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::position::Position;
    use eternum::models::movable::Movable;
    use eternum::models::capacity::Capacity;
    use eternum::models::owner::Owner;
    use eternum::systems::transport::interface::caravan_systems_interface::{
        ICaravanSystems
    };

    use core::poseidon::poseidon_hash_span;

    #[external(v0)]
    impl CaravanSystemsImpl of ICaravanSystems<ContractState>{
        /// Create a caravan entity
        ///
        /// # Arguments
        ///
        /// * `entity_ids` - The list of transport units used to create the caravan
        ///
        fn create(self: @ContractState, world: IWorldDispatcher, entity_ids: Array<ID>) -> ID {
            // speed
            let mut total_speed: u128 = 0_u128;
            let mut total_quantity: u128 = 0_u128;
            // capacity
            let mut total_capacity: u128 = 0_u128;

            // get key to write each entity of the caravan
            let entities_key = world.uuid();
            // get caravan id
            let caravan_id: ID = world.uuid().into();

            let mut entity_position: Position = Position { entity_id: caravan_id, x: 0, y: 0 };

            let caller = starknet::get_caller_address();

            let mut index = 0;
            // loop over the entities to
            // - sum speed and capacity
            // - check that all positions are identical
            // - assert owner is caller
            // - assert entity is not already blocked (e.g. by another caravan)

            let length = entity_ids.len();
            loop {
                if index == length {
                    break ();
                }
                let entity_id: u128 = *entity_ids[index];

                // assert that they are movable
                // assert that they have a capacity component
                let (movable, capacity, position, quantity) = get!(
                    world, (entity_id), (Movable, Capacity, Position, Quantity)
                );

                // assert that they are all at the same position when index > 0
                // if index == 0, then initialize position as the first entity position
                if index != 0 {
                    assert(entity_position.x == position.x, 'entities not same position');
                    assert(entity_position.y == position.y, 'entities not same position');
                } else {
                    entity_position = position;
                }

                // assert that caller is the owner of the entities
                let owner = get!(world, (entity_id), Owner);
                assert(caller == owner.address, 'entity is not owned by caller');

                // assert that they are not blocked
                assert(movable.blocked == false, 'entity is blocked');

                // set entity in the caravan
                let foreign_key_arr = array![caravan_id.into(), entities_key.into(), index.into()];
                let foreign_key = poseidon_hash_span(foreign_key_arr.span());
                set!(world, (ForeignKey { foreign_key, entity_id }));

                // set the entity as blocked so that it cannot be used in another caravan
                set!(world, (
                    Movable { 
                        entity_id, 
                        sec_per_km: movable.sec_per_km, 
                        blocked: true,  
                    })
                );

                // TODO: add the Caravan component to each entity
                // so that when we know it's in a caravan
                let quantity: u128 = quantity.get_value();
                total_speed += movable.sec_per_km.into() * quantity;
                total_quantity += quantity;
                total_capacity += capacity.weight_gram * quantity;
                index += 1;
            };
            // DISCUSS: i created a getAverageSpeed system but
            // it would mean that we'd have to loop 2x over the entities

            // DISCUSS: i could also create a new CheckAllSamePosition system that checks
            // if a list of entities are at the same position, but again that would be 
            // an extra loop
            let average_speed = total_speed / total_quantity;
            let average_speed: u16 = average_speed.try_into().unwrap();

            // set the caravan entity
            set!(world, (
                    Owner {
                        entity_id: caravan_id, 
                        address: caller, 
                    }, 
                    Movable {
                        entity_id: caravan_id, 
                        sec_per_km: average_speed, 
                        blocked: false, 
                    }, 
                    Capacity {
                        entity_id: caravan_id, 
                        weight_gram: total_capacity, 
                    }, 
                    CaravanMembers {
                        entity_id: caravan_id, 
                        key: entities_key.into(), 
                        count: length
                    }, 
                    Position {
                        entity_id: caravan_id, 
                        x: entity_position.x, 
                        y: entity_position.y
                    }
                )
            );
            caravan_id
        }
    }
}