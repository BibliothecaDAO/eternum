// from an array of entites that are movable, create one with a new movable component 
// and capacity component
mod CreateCaravan {
    fn execute(entity_ids: Array<ID>) {
        let mut index = 0;
        // speed
        let mut total_speed = 0;
        // capacity
        let mut total_capacity = 0;
        let mut total_quantity = 0;

        // get key to write each entity of the caravan
        let entities_key = commands::uuid();

        // get caravan id
        let caravan_id = commands::uuid();

        loop { // loop over the entities
            // assert that they are movable

            // try to retrieve the Quantity component
            // if not present quantity = 1

            // set entity in the caravan
            commands::set_entity((caravan_id, entities_key, index), (Entity {*entity_ids[index], }));
        }
        let average_speed = total_speed / total_quantity;

        // set the caravan entity
        commands::set_entity(
            caravan_id,
            (
                Movable {
                    speed: total_speed
                    }, Capacity {
                    capacity: total_capacity, 
                    }, Entites {
                    key: entities_key, count: entity_ids.len()
                }
            )
        );
    }
}
