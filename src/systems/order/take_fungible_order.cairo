// taker is the entity taking the trade
// trade_id is the entity holding the Meta of the trade 
mod TakeFungibleOrder {
    fn execute(taker_id: ID, trade_id: ID) {
        // get the trade 
        let meta = commands::<FungibleTrade>::entity(trade_id);

        // verify expiration date
        let ts = starknet::get_block_timestamp();
        assert(meta.expire_at > ts, 'trade expired');

        // assert that taker entity is owned by caller
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let (owner, taker_position) = commands::<Owner, Position>::entity(taker_id);
        assert(owner.address == caller, 'not owned by caller');

        // if taker_entity in meta is not 0, then only that entity can take the trade
        if meta.taker_id != 0 {
            assert(meta.taker_id == taker_id, 'not the taker');
        }

        // set status accepted 
        // change meta to add the taker entity id
        commands::set_entity(
            trade_id,
            FungibleTrade {
                maker_id: meta.maker_id,
                taker_id: taker_id,
                maker_order_id: meta.maker_order_id,
                taker_order_id: meta.taker_order_id,
                expire_at: meta.expire_at,
                claimed_by_maker: meta.claimed_by_maker,
                claimed_by_taker: meta.claimed_by_taker,
                taker_needs_caravan: meta.taker_needs_caravan,
            }
        );

        // change status to accepted for the trade_id
        commands::set_entity(trade_id, Status { status: status::Approved });

        // caravan only needed if both are not on the same position
        // get the maker position
        let maker_position = commands::<Position>::entity(meta.maker_id);
        let taker_position = commands::<Position>::entity(meta.taker_id);

        // check if there is a caravan attached to the maker
        let maybe_caravan = commands::<Caravan>::try_entity(meta.maker_order_id);
        match maybe_caravan {
            // travel
            Option::Some(caravan) => {
                let movable = commands::<Capacity, Movable>::entity(caravan.entity_id);
                let travel_time = maker_position
                    .calculate_travel_time(taker_position, movable.speed);
                commands::set_entity(
                    meta.maker_order_id,
                    (
                        ArrivalTime {
                            arrival_time: ts + travel_time
                            }, Position {
                            x: taker_position.x, y: taker_position.y
                        }
                    )
                )
            },
            // dont travel
            Option::None(_) => {
                commands::set_entity(
                    meta.maker_order_id,
                    (
                        ArrivalTime {
                            arrival_time: ts
                            }, Position {
                            x: maker_position.x, y: maker_position.y
                        }
                    )
                )
            },
        }

        // check if there is a caravan attached to the taker if needed
        if meta.taker_needs_caravan == true {
            let movable = commands::<Capacity, Movable>::entity(caravan.entity_id);
            let travel_time = taker_position.calculate_travel_time(maker_position, movable.speed);
            commands::set_entity(
                meta.taker_order_id,
                (
                    ArrivalTime {
                        arrival_time: ts + travel_time
                        }, Position {
                        x: maker_position.x, y: maker_position.y
                    }
                )
            )
        } else {
            // dont travel
            commands::set_entity(
                meta.taker_order_id,
                (
                    ArrivalTime {
                        arrival_time: ts
                        }, Position {
                        x: taker_position.x, y: taker_position.y
                    }
                )
            )
        }

        // remove fungible entities from the taker balance
        let mut index = 0;
        let fungible_entities = commands::<FungibleEntities>::entity(meta.taker_order_id);
        loop {
            if index == fungible_entities.count {
                break ();
            }
            let resource = commands::<Resource>::entity(
                meta.taker_order_id, fungible_entities.key, index
            );

            // remove the quantity from the taker balance
            let taker_resource = commands::<Resource>::entity(meta.taker, resource.resource_type);

            // assert has enough
            assert(taker_resource.balance >= resource.balance, 'not enough balance');

            // remove the quantity from the taker balance
            commands::set_entity(
                (taker, entity_type),
                Resource {
                    resource_type: resource.resource_type,
                    balance: taker_quantity.value - quantity.value
                }
            );
            index += 1;
        }
    }
}
