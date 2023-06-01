mod AttachCaravan {
    fn execute(order_id: ID, caravan_id: ID) {
        // check if there is an owner on the order id, if it's the case, needs to be same as caller
        let maybe_owner = commands::<Owner>::try_entity(order_id);
        match maybe_owner { // if owner assert that caller
        // if no owner than ok 
        }

        let fungible_entites = commands::<FungibleEntities>::entity(order_id);

        // get the fungible entities from the order
        let fungible_entities = commands::<FungibleEntities>::entity(order_id);

        let mut total_weight = 0;
        let mut index = 0;
        // loop over all the fungible entities and get their quantity and weight
        loop {
            if index == fungible_entities.count {
                break ();
            }

            // get quantity and entity_type from fungible_entities
            let (quantity, entity_type) = commands::<Quantity,
            EntityType>::entity(order_id, fungible_entites.key, index);

            let entity_type_weight = commands::<EntityTypeWeight>::entity(
                (ENTITY_TYPE_CONFIG_ID, entity_type)
            );

            let weight = entity_type_weight.weight_gram * quantity.value;
            total_weight += weight;
        };
        // get the caravan capacity
        let capacity = commands::<Capacity>::entity(caravan_id);

        // assert that the caravan can move the total weight
        assert(capacity.weight_gram >= total_weight, 'Caravan capacity is not enough');

        // attach the caravan to the order
        commands::set_entity(order_id, (Caravan { caravan_id }))
    }
}
