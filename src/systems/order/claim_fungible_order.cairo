mod ClaimFungibleOrder {
    fn execute(entity_id: ID, trade_id: ID) {
        // claim either maker or taker order

        // check if entity is maker or taker
        let meta = commands::<Meta>::entity(trade_id);

        let mut order_id = 0;
        if entity_id == meta.maker {
            order_id = meta.maker_order_id;
        } else {
            order_id = meta.taker_order_id;
        }

        // check position and arrival time
        let (position, arrival_time, status, fungible_entities) = commands::<Position,
        ArrivalTime,
        Status,
        FungibleEntities>::entity(order_id);
        // assert that position
        assert(position == entity_position);

        let ts = starknet::get_block_timestamp();

        // assert that arrival time < current time 
        assert(arrival_time < ts);

        // check if order is already claimed
        assert(status.value != Status::CLAIMED(), 'Order already claimed');

        // loop over fungible entities and add to balance of entity
        let mut index = 0;
        loop {
            if index == fungible_entities.count {
                break ();
            }

            let (quantity, entity_type) = commands::<Quantity,
            EntityType>::entity(order_id, fungible_entities.key, index);

            // add quantity to balance of entity
            let current_quantity = commands::<Quantity>::entity(entity_id, entity_type);
            // set new balance 
            // TODO: if entity does not exist, create it
            commands::set_entity(
                (entity_id, entity_type), Quantity { value: current_quantity + quantity }
            );

            index += 1;
        };

        // set status to claimed
        commands::set_entity(order_id, Status { value: Status::CLAIMED() });
    }
}
