// claim order allows the maker or taker to get the resources
// in their balances when the order has arrived at their realm
#[system]
mod ClaimOrder {
    fn execute(entity_id: ID, order_id: ID) {
        // assertions
        // assert that caller is owner of entity_id
        // assert that entity_id is a realm

        let order = commands::<Order>::entity(order_id);

        let ts = get_block_timestamp();

        if order.maker == entity_id {
            // verify that taker resources have arrived at the maker
            assert(order.taker_arrival < ts, 'order not arrived');
            // add the taker resources to the maker balance
            let maker_resource = commands::<Resource>::entity(entity_id, order.maker_resource_type);

            // update the balance
            commands::set_entity(
                entity_id,
                order.maker_resource_type,
                Resource { balance: maker_resource.balance + order.taker_resource_quantity }
            )
            // set taker qty to 0 in order
            // so that it cannot claim it again
            commands::set_entity(order_id, Order { taker_resource_quantity: 0 })
        } else {
            // verify that entity_id is the taker then
            assert(order.taker == entity_id, 'entity is not the taker');
            // verify that maker resources have arrived at the taker
            assert(order.maker_arrival < ts, 'order not arrived');

            // add the maker resources to the taker balance
            let taker_resource = commands::<Resource>::entity(entity_id, order.taker_resource_type);

            // update the balance
            commands::set_entity(
                entity_id,
                order.taker_resource_type,
                Resource { balance: taker_resource.balance + order.maker_resource_quantity }
            )

            // set maker qty to 0 in order
            // so that it cannot claim it again
            commands::set_entity(order_id, Order { maker_resource_quantity: 0 })
        }
    }
}
