use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ISwapSystems {
    fn buy(
        ref world: IWorldDispatcher,
        bank_entity_id: u128,
        entity_id: u128,
        resource_type: u8,
        amount: u128
    ) -> ID;
    fn sell(
        ref world: IWorldDispatcher,
        bank_entity_id: u128,
        entity_id: u128,
        resource_type: u8,
        amount: u128
    ) -> ID;
}

#[dojo::contract]
mod swap_systems {
    use cubit::f128::math::ops::{mul};
    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use eternum::models::bank::bank::{Bank};
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::config::{BankConfig};
    use eternum::models::config::{TickImpl, TickTrait};
    use eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};
    use eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};

    use option::OptionTrait;
    use traits::{Into, TryInto};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    struct SwapEvent {
        #[key]
        bank_entity_id: u128,
        #[key]
        entity_id: u128,
        resource_type: u8,
        lords_amount: u128,
        resource_amount: u128,
        bank_owner_fees: u128,
        lp_fees: u128,
        // price in lords for 1000 resource
        resource_price: u128,
        buy: bool,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl SwapSystemsImpl of super::ISwapSystems<ContractState> {
        fn buy(
            ref world: IWorldDispatcher,
            bank_entity_id: u128,
            entity_id: u128,
            resource_type: u8,
            amount: u128
        ) -> ID {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            // update market
            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            // calculate cost of resources
            let cost = market.buy(amount);
            // add the lords cost to the reserves
            market.lords_amount += cost;
            // add to the cost the owner fees and lp fees
            let (owner_fees_amount, lp_fees_amount, total_cost) = InternalSwapSystemsImpl::add_fees(
                cost, bank.owner_fee_scaled, bank_config.lp_fee_scaled
            );
            // remove payout from the market
            market.resource_amount -= amount;
            // add lp fees to the reserves
            market.lords_amount += lp_fees_amount;
            set!(world, (market));

            // update owner bank account with fees
            let mut bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
            bank_lords.add(owner_fees_amount);
            bank_lords.save(world);

            // udpate player lords
            let mut player_lords = ResourceImpl::get(world, (entity_id, ResourceTypes::LORDS));
            player_lords.burn(total_cost);
            player_lords.save(world);

            // pickup player resources
            let resources = array![(resource_type, amount)].span();
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                world, bank_entity_id, entity_id, resources
            );

            // emit event
            InternalSwapSystemsImpl::emit_event(
                world,
                market,
                entity_id,
                amount,
                cost,
                owner_fees_amount,
                lp_fees_amount,
                market.quote_amount(1000),
                true
            );

            // return donkey entity id
            donkey_id
        }


        fn sell(
            ref world: IWorldDispatcher,
            bank_entity_id: u128,
            entity_id: u128,
            resource_type: u8,
            amount: u128
        ) -> ID {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            // split resource amount into fees and rest
            let (owner_fees_amount, lp_fees_amount, rest) = InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled
            );

            // increase owner bank account with fees
            let mut owner_resource = ResourceImpl::get(world, (bank_entity_id, resource_type));
            owner_resource.add(owner_fees_amount);
            owner_resource.save(world);

            // update market
            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            // calculate payout on the rest
            let payout = market.sell(rest);
            // increase the lp with fees
            market.resource_amount += lp_fees_amount;
            // remove payout from the market
            market.lords_amount -= payout;
            // add resource amount to the market
            market.resource_amount += rest;
            set!(world, (market));

            // update player resource
            let mut resource = ResourceImpl::get(world, (entity_id, resource_type));
            resource.burn(amount);
            resource.save(world);

            // pickup player lords
            let mut resources = array![(ResourceTypes::LORDS, payout)].span();
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                world, bank_entity_id, entity_id, resources
            );

            // emit event
            InternalSwapSystemsImpl::emit_event(
                world,
                market,
                entity_id,
                payout,
                rest,
                owner_fees_amount,
                lp_fees_amount,
                market.quote_amount(1000),
                false
            );

            // return donkey_id
            donkey_id
        }
    }

    #[generate_trait]
    impl InternalSwapSystemsImpl of InternalSwapSystemsTrait {
        fn split_fees(
            amount: u128, owner_fee_scaled: u128, lp_fee_scaled: u128,
        ) -> (u128, u128, u128) {
            let amount_fixed = FixedTrait::new_unscaled(amount, false);

            let owner_fee_fixed = FixedTrait::new(owner_fee_scaled, false);
            let lp_fee_fixed = FixedTrait::new(lp_fee_scaled, false);

            let owner_amount_fixed = amount_fixed * owner_fee_fixed;
            let lp_amount_fixed = amount_fixed * lp_fee_fixed;

            let rest = amount_fixed - owner_amount_fixed - lp_amount_fixed;

            (
                owner_amount_fixed.try_into().unwrap(),
                lp_amount_fixed.try_into().unwrap(),
                rest.try_into().unwrap()
            )
        }

        fn add_fees(cost: u128, owner_fee_scaled: u128, lp_fee_scaled: u128) -> (u128, u128, u128) {
            let cost_fixed = FixedTrait::new_unscaled(cost, false);

            let owner_fee_fixed = FixedTrait::new(owner_fee_scaled, false);
            let lp_fee_fixed = FixedTrait::new(lp_fee_scaled, false);

            let owner_amount_fixed = cost_fixed * owner_fee_fixed;
            let lp_amount_fixed = cost_fixed * lp_fee_fixed;

            let total = cost_fixed + owner_amount_fixed + lp_amount_fixed;

            (
                owner_amount_fixed.try_into().unwrap(),
                lp_amount_fixed.try_into().unwrap(),
                total.try_into().unwrap()
            )
        }

        fn emit_event(
            world: IWorldDispatcher,
            market: Market,
            entity_id: u128,
            lords_amount: u128,
            resource_amount: u128,
            bank_owner_fees: u128,
            lp_fees: u128,
            resource_price: u128,
            buy: bool,
        ) {
            emit!(
                world,
                (SwapEvent {
                    bank_entity_id: market.bank_entity_id,
                    entity_id,
                    resource_type: market.resource_type,
                    lords_amount,
                    resource_amount,
                    bank_owner_fees,
                    lp_fees,
                    resource_price: market.quote_amount(1000),
                    buy,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }
    }
}
