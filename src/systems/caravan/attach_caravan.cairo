mod AttachCaravan {
    use eternum::alias::ID;
    use eternum::components::entities::FungibleEntities;

    fn execute(order_id: ID, caravan_id: ID) {
        // DISCUSS: anybody can attach a caravan so need to check if that's an issue
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
            let resource = commands::<Resource>::entity(order_id, fungible_entities.key, index);

            let entity_type_weight = commands::<EntityTypeWeight>::entity(
                (ENTITY_TYPE_CONFIG_ID, resource.resource_type)
            );

            let weight = entity_type_weight.weight_gram * resource.balance;
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
