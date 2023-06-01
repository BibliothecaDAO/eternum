// claim either maker or taker order
mod ClaimFungibleOrder {
    use eternum::components::trade::FungibleTrade;
    fn execute(entity_id: ID, trade_id: ID) {
        // assert caller is owner of the entity_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = commands::<Owner>::entity(entity_id);
        assert(owner.address == caller, 'not owned by caller');

        // check if entity is maker or taker
        // if taker then query maker order id
        // if maker then query taker order id
        let mut order_id = 0;
        let mut claimed_by_maker = meta.claimed_by_maker;
        let mut claimed_by_taker = meta.claimed_by_taker;

        if entity_id == meta.maker_id {
            order_id = meta.taker_order_id;
            // check if maker order is already claimed
            assert(meta.claimed_by_maker == false, 'Order is already claimed')
            claimed_by_maker = true;
        } else {
            assert(entity_id == meta.taker_id, 'Entity is neither maker nor taker');
            order_id = meta.maker_order_id;
            // check if maker order is already claimed
            assert(meta.claimed_by_taker == false, 'Order is already claimed')
            claimed_by_taker = true;
        }

        // set status to claimed
        commands::set_entity(
            trade_id,
            (FungibleTrade {
                maker_id: meta.maker_id,
                taker_id: meta.taker_id,
                maker_order_id: meta.maker_order_id,
                taker_order_id: meta.taker_order_,
                expire_at: meta.expire_at,
                claimed_by_maker,
                claimed_by_taker,
                taker_needs_caravan: meta.taker_needs_caravan,
            })
        )

        // check position and arrival time
        let (position, arrival_time, fungible_entities) = commands::<Position,
        ArrivalTime,
        FungibleEntities>::entity(order_id);
        // assert that position is same as entity
        let entity_position = commmands::<Position>::entity(entity_id);
        assert(position == entity_position);

        let ts = starknet::get_block_timestamp();

        // assert that arrival time < current time 
        assert(arrival_time < ts);

        // loop over fungible entities and add to balance of entity
        let mut index = 0;
        loop {
            if index == fungible_entities.count {
                break ();
            }

            let order_resource = commands::<Resource>::entity(
                order_id, fungible_entities.key, index
            );

            // add quantity to balance of entity
            let maybe_current_resource = commands::<Resource>::try_entity(entity_id, entity_type);
            match maybe_current_resource {
                Option::Some(current_resource) => {
                    // set new balance 
                    // TODO: if entity does not exist, create it
                    commands::set_entity(
                        (entity_id, entity_type),
                        Resource {
                            balance: current_resource.balance + order_resource.balance,
                            resource_type,
                            entity_type
                        }
                    );
                },
                Option::None(_) => {
                    // create new resource
                    commands::set_entity(
                        (entity_id, entity_type),
                        Resource { balance: order_resource.balance, resource_type: entity_type }
                    );
                }
            }
            index += 1;
        };
    }
}
