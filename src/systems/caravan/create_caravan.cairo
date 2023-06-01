// from an array of entities that are movable, create one with a new movable component 
// and capacity component
mod CreateCaravan {
    use eternum::alias::ID;

    fn execute(entity_ids: Array<ID>) {
        // speed
        let mut total_speed = 0;
        let mut total_quantity = 0;
        // capacity
        let mut total_capacity = 0;

        // get key to write each entity of the caravan
        let entities_key = commands::uuid();

        // get caravan id
        let caravan_id = commands::uuid();

        let mut index = 0;
        // loop over the entities
        loop {
            // assert that they are movable
            // assert that they have a capacity component
            let (movable, capacity) = commands::<Movable, Capacity>::entity(*entity_ids[index]);

            // try to retrieve the Quantity component of the entity
            let mut quantity: u128 = 1_u128;
            let maybe_quantity = commands::<Quantity>::try_entity(*entity_ids[index]);
            match maybe_quantity {
                Option::Some(res) => {
                    quantity = res.value;
                },
                Option::None(_) => { // if not present quantity = 1
                }
            };

            // set entity in the caravan
            commands::set_entity(
                (caravan_id, entities_key, index), (Entity { entity_id: *entity_ids[index],  })
            );
        };
        let average_speed = total_speed / total_quantity;

        // set the caravan entity
        commands::set_entity(
            caravan_id,
            (
                Movable {
                    speed: total_speed
                    }, Capacity {
                    capacity: total_capacity, 
                    }, Entities {
                    key: entities_key, count: entity_ids.len()
                }
            )
        );
    }
}
