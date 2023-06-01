// creates a non fungible order
// if taker_id is specified, the order can only be taken by a certain entity
// if taker_id = 0, then can be taken by any entity

mod MakeFungibleOrder {
    fn execute(
        maker: ID,
        maker_entity_types: Array<u8>,
        maker_quantities: Array<u128>,
        taker: ID,
        taker_entity_types: Array<u8>,
        taker_quantities: Array<u128>,
        taker_needs_caravan: bool,
        expires_at: u64,
    ) {
        // assert that maker is owned by caller

        // asset that length of maker_entity_types is equal to length of maker_quantities

        // assert that length of taker_entity_types is equal to length of taker_quantities

        // create maker order entity
        let maker_order_id = commands::uuid();

        let fungible_entites_id = commands::uuid();

        commands::set_entity(
            maker_order_id,
            (FungibleEntities { key: fungible_entites_id, count: maker_entity_types.len(),  }, )
        )
        // create maker fungible entities and remove them from the maker balance
        let mut index = 0;
        loop {
            if index = maker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (maker_order, fungible_entites_id),
                (
                    Quantity {
                        value: *maker_quantities[index]
                        }, EntityType {
                        value: *maker_entity_types[index]
                    }
                )
            )

            // decrease balance of maker
            let query = (maker, *maker_entity_types[index]).into();
            let quantity = commands::<Quantity>::entity(query);
            assert(quantity.value >= *quantities[index], 'Balance too small');
            commmands::set_entity(query, Quantity { value: quantity.value - *quantities[index] });

            index += 1;
        }

        // create taker order entity
        let taker_order_id = commands::uuid();
        commands::set_entity(
            maker_order_id,
            (FungibleEntities { key: fungible_entites_id, count: taker_entity_types.len(),  }, )
        )

        // create taker fungible entities but dont remove them from the taker balance, because 
        // needs to be taken first
        let mut index = 0;
        loop {
            if index = taker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (taker_order, fungible_entites_id),
                (
                    Quantity {
                        value: *taker_quantities[index]
                        }, EntityType {
                        value: *taker_entity_types[index]
                    }
                )
            );

            index += 1;
        };

        // create trade entity
        let trade_id = commands::uuid();
        commands::set_entity(
            trade_id,
            (Meta {
                maker: maker_order_id,
                taker: taker_order_id,
                taker_needs_caravan: taker_needs_caravan,
                expires_at: expires_at,
            })
        )
    }
}
