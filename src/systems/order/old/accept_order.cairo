#[system]
mod AcceptOrder {
    use eternum::alias::ID;
    use eternum::constants::LORDS_ID;
    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::resources::Resource;
    use eternum::components::order::Order;
    use eternum::components::position::Position;

    use starknet::ContractAddress;

    use traits::Into;
    // use array::ArrayTrait;
    use box::BoxTrait;

    #[external]
    fn execute(taker: ID, order_id: ID, taker_caravan: Span<ID>) {
        // assertions
        // assert that taker is a realm
        // assert that caller is taker owner
        // assert that taker has enough resources

        let ts = get_block_timestamp();

        //
        // fill the taker caravan units + calculate taker arrival time at maker and back to taker
        //

        // get total weight of taker resources
        let resource_type_weight = commands::<ResourceWeight>::entity(
            (RESOURCE_CONFIG_ID, taker_resource_type)
        );

        let mut remaining_weight = resource_type_weight.weight_gram * taker_quantity;
        let mut total_speed = 0;
        let mut total_quantity = 0;

        // register the entites in the caravan
        let mut index = 0;
        let taker_caravan_count = loop {
            if index == taker_caravan.len() {
                // if we reach capacity limit, we need to add additionnal free caravan units
                let (free_transport_unit_capacity, free_transport_unit_speed) =
                    commands::<CapacityConfig,
                SpeedConfig>::entity((WORLD_CONFIG, FREE_TRANSPORT_ENTITY_TYPE).into());
                let mut quantity = remaining_weight / free_transport_unit_capacity.weight_gram;
                let rem = remaining_weight % free_transport_unit_capacity.weight_gram;
                if rem > 0 {
                    quantity += 1;
                }
                // create a new entity of free transtport units and block them until they are used
                let free_transport_unit_id = commands::uuid();
                commands::set_entity(
                    (free_transport_unit_id),
                    (
                        Quantity {
                            quantity
                            }, Capacity {
                            weight_gram: free_transport_unit_capacity.weight_gram
                            }, Movable {
                            arrival_time: 0, blocked: true, speed: free_transport_unit_speed.speed
                        }
                    )
                );
                // attach the new entity to the order entity id
                commmands::set_entity(
                    (order_id, index), (Entity { entity_id: free_transport_unit_id })
                );
                // increment total_quantity
                total_quantity += quantity;
                // increment total_speed
                total_speed += free_transport_unit_speed.speed * quantity;
                break index;
            };
            // loop over the given caravan transport units to see if they can carry the resources 
            let caravan_transport_unit_id = *taker_caravan[index];
            let (quantity, capacity, speed) = commands::<Quantity, Capacity, Speed>::entity((caravan_transport_unit_id));
            if capacity.weight_gram * quantity.quantity >= remaining_weight {
                // attach the entity to the order entity id
                commmands::set_entity(
                    (order_id, index), (Entity { entity_id: caravan_transport_unit_id })
                );
                break index;
            } else {
                // attach the entity to the order entity id
                commmands::set_entity(
                    (order_id, index), (Entity { entity_id: caravan_transport_unit_id })
                );
                remaining_weight -= (capacity.weight_gram * quantity);
            };
            let movable = commands::<Movable>::entity((caravan_transport_unit_id));
            // assert caravan unit is not blocked
            assert(movable.blocked == false, 'Caravan unit is blocked');
            // assert that the caravan unit is not travelling
            assert(movable.arrival_time <= ts, 'Caravan unit is travelling');
            // block the caravan unit for travel
            commands::set_entity(
                (caravan_transport_unit_id),
                (Movable { arrival_time: 0, blocked: true, speed: speed.speed })
            );
            // increment total_quantity
            total_quantity += quantity;
            // increment total_speed
            total_speed += speed.speed * quantity;
            index += 1;
        };

        // calculate average speed
        let average_speed = total_speed / total_quantity;

        // calculate the arrival times
        let taker_position = commands::<Position>::entity((taker));
        let maker_position = commands::<Position>::entity((order.maker));

        let travel_time = taker_position.calculate_travel_time(maker_position, average_speed);
        let taker_arrival = ts + travel_time;

        // loop over the taker caravan units to update their arrival time
        let mut index = 0;
        loop {
            if index == taker_caravan_count {
                break;
            };
            let caravan_unit = commands::<Entity>::entity((order_id, index));
            let movable = commands::<Movable>::entity((caravan_unit.entity_id));

            // update the arrival time
            // x2 because it needs to come back
            // don't update the position because it comes back to same position
            commands::set_entity(
                (caravan_unit.entity_id),
                (Movable {
                    arrival_time: ts + 2*travel_time,
                    blocked: false,
                    speed: movable.speed
                })
            );
        };

        //
        // calculate maker arrival time
        //

        let mut total_speed = 0;
        let mut total_quantity = 0;

        let order = commands::<Order>::entity((order_id));

        // calculate the maker arrival time
        let mut index = 0;
        loop {
            if index == order.maker_caravan_count {
                break;
            };
            let caravan_unit = commands::<Entity>::entity((order_id, index));
            let (movable, quantity) = commands::<Movable>::entity((caravan_unit.entity_id));

            // increment total_quantity
            total_quantity += quantity.quantity;
            // increment total_speed
            total_speed += movable.speed * quantity.quantity;
            index += 1;
        };

        // calculate average speed
        let average_speed = total_speed / total_quantity;

        // calculate travel time
        let travel_time = maker_position.calculate_travel_time(maker_position, average_speed);
        let maker_arrival = ts + travel_time;

        // update the maker caravan units
        loop {
            if index == order.maker_caravan_count {
                break;
            };
            let caravan_unit = commands::<Entity>::entity((order_id, index));
            let movable = commands::<Movable>::entity((caravan_unit.entity_id));

            // update the arrival time
            // x2 because it needs to come back
            // don't update the position because it comes back to same position
            commands::set_entity(
                (caravan_unit.entity_id),
                (Movable {
                    arrival_time: taker_arrival + 2*travel_time,
                    blocked: false,
                    speed: movable.speed
                })
            );
        };

        // remove the resource balance from the taker
        let taker_resource = commands::<Resource>::entity((taker, order.taker_resource_type));
        // verify that balance is high enough
        assert(taker_resource.balance >= order.taker_resource_quantity, 'Taker does not have enough resources');
        // update the taker resource balance
        commands::set_entity(
            (taker, order.taker_resource_type),
            (Resource {
                balance: taker_resource.balance - order.taker_resource_quantity
            })
        );

        // update the order entity
        commands::set_entity(
            order_id,
            (Order {
                order.maker,
                order.maker_resource_type,
                order.maker_resource_quantity,
                maker_arrival,
                order.maker_caravan_count,
                taker,
                taker_resource_type,
                taker_resource_quantity,
                taker_arrival,
                taker_caravan_count,
                order.expire_at,
                status: OrderStatus::ACCEPTED
            })
        );
    }
}
