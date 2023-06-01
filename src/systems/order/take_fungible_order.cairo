// taker is the entity taking the trade
// trade_id is the entity holding the Meta of the trade 
mod TakeFungibleOrder {
    fn execute(taker: ID, trade_id: ID) {
        // get the trade 
        let meta = commands::<Meta>::entity(trade_id);

        // verify expiration date
        let ts = starknet::get_block_timestamp();
        assert(meta.expiration_date > ts, 'trade expired');

        // assert that taker entity is owned by caller
        let caller = starknet::get_original_caller();
        let (owner, taker_position) = commands::<Owner, Position>::entity(taker);
        assert(owner.address == caller, 'not owned by caller');

        // if taker_entity in meta is not 0, then only that entity can take the trade
        if meta.taker != 0 {
            assert(meta.taker == taker, 'not the taker');
        }

        // set status accepted 
        // change meta to add the taker entity id
        commands::set_entity(trade_id, Meta { taker, status: status::Approved });

        // caravan only needed if both are not on the same position
        // get the maker position
        let maker_position = commands::<Position>::entity(meta.maker);
        // check if taker and maker are on the same position
        let taker_order_position = taker_position;
        let maker_order_position = maker_position;
        let mut taker_order_arrival_time = ts;
        let mut maker_order_arrival_time = ts;

        // check if there is a caravan attached to the maker
        let maybe_caravan = commands::<Caravan>::try_entity(meta.maker_order_id);
        match maybe_caravan {
            // travel
            Some::Ok(caravan) => {
                let (movable) = commands::<Capacity, Movable>::entity(caravan.entity_id);
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
            Some::None(_) => {
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
            let (movable) = commands::<Capacity, Movable>::entity(caravan.entity_id);
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
        let fungible_entites = commands::<FungibleEntity>::entity(meta.taker_order_id);
        loop {
            if index == fungible_entites.count {
                break ();
            }
            let (quantity, entity_type) = commands::<Quantity,
            EntityType>::entity(meta.taker_order_id, fungible_entites.key, index);

            // remove the quantity from the taker balance
            let taker_quantity = commands::<Quantity>::entity(meta.taker, entity_type.value);

            // assert has enough
            assert(taker_quantity.value >= quantity.value, 'not enough quantity');

            // remove the quantity from the taker balance
            commands::set_entity(
                (taker, entity_type), Quantity { value: taker_quantity.value - quantity.value }
            );
            index += 1;
        }
    }
}
