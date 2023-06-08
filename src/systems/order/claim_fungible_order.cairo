// claim either maker or taker order
// TODO: to finish + testing
#[system]
mod ClaimFungibleOrder {
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::components::config::WeightConfig;
    use eternum::components::capacity::Capacity;
    use eternum::components::movable::Movable;
    use eternum::components::quantity::Quantity;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::resources::Resource;
    use eternum::components::caravan::Caravan;
    use eternum::components::trade::{FungibleTrade, Status, status};
    use eternum::components::entities::FungibleEntities;

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;
    use dojo_core::serde::SpanSerde;
    use debug::PrintTrait;

    fn execute(entity_id: ID, trade_id: ID) {
        // assert caller is owner of the entity_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = commands::<Owner>::entity(entity_id.into());
        assert(owner.address == caller, 'not owned by caller');

        let meta = commands::<FungibleTrade>::entity(trade_id.into());

        // check if entity is maker or taker
        // if taker then query maker order id
        // if maker then query taker order id
        let mut order_id = 0;
        let mut claimed_by_maker = meta.claimed_by_maker;
        let mut claimed_by_taker = meta.claimed_by_taker;

        let order_id = if (entity_id == meta.maker_id) {
            // caller is the maker
            meta.maker_order_id
        } else if meta.taker_id == 0 {
            // no taker specified, caller can be taker
            meta.taker_order_id
        } else {
            // caller is neither the maker nor the taker
            assert(entity_id == meta.taker_id, 'Caller is not maker nor taker');
            meta.taker_order_id
        };

        // set status to claimed
        commands::set_entity(
            trade_id.into(),
            (FungibleTrade {
                maker_id: meta.maker_id,
                taker_id: meta.taker_id,
                maker_order_id: meta.maker_order_id,
                taker_order_id: meta.taker_order_id,
                expires_at: meta.expires_at,
                claimed_by_maker,
                claimed_by_taker,
                taker_needs_caravan: meta.taker_needs_caravan,
            })
        );

        // check position and arrival time
        let (position, arrival_time, fungible_entities) = commands::<Position,
        ArrivalTime,
        FungibleEntities>::entity(order_id.into());
        // assert that position is same as entity
        let entity_position = commands::<Position>::entity(entity_id.into());
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
            let maybe_current_resource = commands::<Resource>::try_entity(
                (entity_id, entity_type).into()
            );
            match maybe_current_resource {
                Option::Some(current_resource) => {
                    // set new balance 
                    // TODO: if entity does not exist, create it
                    commands::set_entity(
                        (entity_id, entity_type).into(),
                        (Resource {
                            balance: current_resource.balance + order_resource.balance,
                            resource_type,
                            entity_type
                        })
                    );
                },
                Option::None(_) => {
                    // create new resource
                    commands::set_entity(
                        (entity_id, entity_type).into(),
                        (Resource { balance: order_resource.balance, resource_type: entity_type })
                    );
                }
            }
            index += 1;
        };
    }
}

// TODO: need to test it when withdraw gas is working
mod tests {
    // utils
    use eternum::utils::testing::spawn_test_world_with_setup;
    use eternum::constants::WORLD_CONFIG_ID;

    use core::traits::Into;
    use array::ArrayTrait;
    use option::OptionTrait;
    use debug::PrintTrait;

    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::storage::query::{Query, TupleSize3IntoQuery};
    use dojo_core::storage::query::TupleSize2IntoQuery;
    use dojo_core::execution_context::Context;
    use dojo_core::auth::components::AuthRole;

    #[test]
    #[available_gas(30000000000000)]
    // 1. attach for the maker
    // 2. attach for the taker
    fn test_claim_order() {}
}
