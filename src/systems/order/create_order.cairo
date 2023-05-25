#[system]
mod CreateOrder {
    use eternum::alias::ID;
    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::resources::Resource;
    use eternum::components::order::Order;
    use eternum::components::position::Position;

    use starknet::ContractAddress;

    use traits::Into;
    use array::ArrayTrait;
    use box::BoxTrait;

    // caravan is a list of entity ids that can carry the resources
    #[external]
    fn execute(
        maker: ID,
        maker_resource_type: u8,
        maker_quantity: u128,
        taker_resource_type: u8,
        taker_quantity: u128,
        expire_at: u64,
        maker_caravan: Span<ID>,
    ) {
        // assert maker is a realm entity
        // assert that realm owner is caller
        // assert that realm has enough resources

        // get total weight of maker resources
        let resource_type_weight = commands::<ResourceWeight>::entity(
            (RESOURCE_CONFIG_ID, maker_resource_type)
        );
        let mut remaining_weight = resource_type_weight.weight_gram * maker_quantity;

        // get order id
        let order_id = commands::uuid();

        // register the entites in the caravan
        let mut index = 0;
        let maker_caravan_count = loop {
            if index == maker_caravan.len() {
                // if we reach capacity limit, we need to add additionnal free caravan units
                let (free_transport_unit_capacity, free_transport_unit_speed) =
                    commands::<CapacityConfig,
                SpeedConfig>::entity(FREE_TRANSPORT_ENTITY_TYPE);
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
                break index;
            };
            // loop over the given caravan transport units to see if they can carry the resources 
            let caravan_transport_unit_id = *maker_caravan[index];
            let (quantity, capacity, speed) = commands::<Quantity,
            Capacity,
            Speed>::entity((caravan_transport_unit_id));
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
            let ts = get_block_timestamp();
            assert(movable.arrival_time <= ts, 'Caravan unit is blocked');
            // block the caravan unit for travel
            commands::set_entity(
                (caravan_transport_unit_id),
                (Movable { arrival_time: 0, blocked: true, speed: speed.speed })
            );
            index += 1;
        };
        // create the order entity
        // don't fill the taker fields
        // don't fill the arrival fields 
        commands::set_entity(
            order_id,
            (Order {
                maker,
                maker_resource_type,
                maker_resource_quantity,
                maker_arrival: 0,
                maker_caravan_count,
                taker: 0,
                taker_resource_type,
                taker_resource_quantity,
                taker_arrival: 0,
                taker_caravan_count: 0,
                expire_at,
                status: OrderStatus::OPEN
            })
        );
        // assert that resources are big enough
        let resource = commands::<Resource>::entity((maker, maker_resource_type));
        assert(resource.balance >= maker_resource_quantity, 'Not enough resources');
        // remove the resources from the realm balance
        commands::set_entity(
            maker,
            maker_resource_type,
            Resource { balance: resource.balance - maker_resource_quantity }
        );
    }
}
