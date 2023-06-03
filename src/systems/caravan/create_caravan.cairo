// from an array of entities that are movable, create one with a new movable component 
// and capacity component

// 1. you need to remove the position component of all entities in the caravan
// 2. position is reset for all subentities when the caravan is deleted 
// 3. caravan hash a position, movable and arrival_time component

#[system]
mod CreateCaravan {
    use eternum::alias::ID;
    use eternum::components::entities::{Entities, Entity};
    use eternum::components::quantity::Quantity;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;

    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;

    use dojo_core::integer::U128IntoU250;
    use dojo_core::serde::SpanSerde;
    // use dojo_core::integer::U32IntoU250;

    fn execute(entity_ids: Span<felt252>) {
        // speed
        let mut total_speed: u128 = 0_u128;
        let mut total_quantity: u128 = 0_u128;
        // capacity
        let mut total_capacity: u128 = 0_u128;

        // get key to write each entity of the caravan
        let entities_key = commands::uuid();

        // get caravan id
        let caravan_id = commands::uuid();

        let mut index = 0;
        // loop over the entities
        loop {
            if index == entity_ids.len() {
                break ();
            }
            // assert that they are movable
            // assert that they have a capacity component
            let (movable, capacity) = commands::<Movable,
            Capacity>::entity((*entity_ids[index]).into());

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
                (Entity { entity_id: (*entity_ids[index]).try_into().unwrap(),  })
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
                Movable {
                    km_per_hr: average_speed, blocked: false, 
                    }, Capacity {
                    weight_gram: total_capacity, 
                    }, Entities {
                    key: entities_key.into(), count: entity_ids.len()
                }
            )
        );
    }
}
