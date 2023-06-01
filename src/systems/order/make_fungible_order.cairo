// creates a non fungible order
// if taker_id is specified, the order can only be taken by a certain entity
// if taker_id = 0, then can be taken by any entity

mod MakeFungibleOrder {
    use eternum::components::entities::FungibleEntities;
    use eternum::components::resources::Resource;

    fn execute(
        maker_id: ID,
        maker_entity_types: Array<u8>,
        maker_quantities: Array<u128>,
        taker_id: ID,
        taker_entity_types: Array<u8>,
        taker_quantities: Array<u128>,
        taker_needs_caravan: bool,
        expires_at: u64,
    ) {
        // assert that maker is owned by caller
        let maker_owner = commands::<Owner>::entity(maker_id);
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        assert(maker_owner == caller, 'Only owner can create order');

        // assert that length of maker_entity_types is equal to length of maker_quantities
        assert(maker_entity_types.len() == maker_quantities.len(), 'length not equal')

        // assert that length of taker_entity_types is equal to length of taker_quantities
        assert(taker_entity_types.len() == taker_quantities.len(), 'length not equal')

        // create maker order entity
        let maker_order_id = commands::uuid();
        let fungible_entities_id = commands::uuid();
        commands::set_entity(
            maker_order_id,
            (FungibleEntities { key: fungible_entities_id, count: maker_entity_types.len(),  }, )
        )
        // create maker fungible entities and remove them from the maker balance
        let mut index = 0;
        loop {
            if index = maker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (maker_order, fungible_entities_id),
                (Resource {
                    resource_type: *maker_entity_types[index], balance: *maker_quantities[index]
                })
            )

            // decrease balance of maker
            let query = (maker, *maker_entity_types[index]).into();
            let resource = commands::<Resource>::entity(query);
            assert(resource.balance >= *quantities[index], 'Balance too small');
            commmands::set_entity(
                query,
                Resource {
                    resource_type: *maker_entity_types[index],
                    balance: quantity.value - *quantities[index]
                }
            );

            index += 1;
        }

        // create taker order entity
        let taker_order_id = commands::uuid();
        commands::set_entity(
            taker_order_id,
            (FungibleEntities { key: fungible_entities_id, count: taker_entity_types.len(),  }, )
        )

        // create taker fungible entities but dont remove them from the taker balance, because 
        // needs to be taken first
        let mut index = 0;
        loop {
            if index = taker_entity_types.len() {
                break ();
            }

            commands::set_entity(
                (taker_order_id, fungible_entities_id),
                (Resource {
                    balance: *taker_quantities[index], entity_type: *taker_entity_types[index]
                })
            );

            index += 1;
        };

        // create trade entity
        let trade_id = commands::uuid();
        commands::set_entity(
            order_id,
            (FungibleTrade {
                maker_id,
                taker_id,
                taker_order_id,
                maker_order_id,
                claimed_by_maker: false,
                claimed_by_taker: false,
                expires_at: expires_at,
                taker_needs_caravan: taker_needs_caravan,
            })
        )

        trade_id
    }
}
