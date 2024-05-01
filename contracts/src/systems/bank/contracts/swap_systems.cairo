use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ISwapSystems {
    fn buy(bank_entity_id: u128, resource_type: u8, amount: u128);
    fn sell(bank_entity_id: u128, resource_type: u8, amount: u128);
}

#[dojo::contract]
mod swap_systems {
    use cubit::f128::math::ops::{mul};

    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::config::{BankConfig};
    use eternum::models::config::{TickImpl, TickTrait};
    use eternum::models::owner::{Owner};
    use eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};
    use option::OptionTrait;

    use traits::{Into, TryInto};

    #[abi(embed_v0)]
    impl SwapSystemsImpl of super::ISwapSystems<ContractState> {
        fn buy(world: IWorldDispatcher, bank_entity_id: u128, resource_type: u8, amount: u128) {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

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
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_lords = ResourceImpl::get(
                world, (owner_bank_account.entity_id, ResourceTypes::LORDS)
            );
            owner_lords.add(owner_fees_amount);
            owner_lords.save(world);

            // udpate player lords
            let mut player_lords = ResourceImpl::get(
                world, (bank_account_entity_id, ResourceTypes::LORDS)
            );
            player_lords.burn(total_cost);
            player_lords.save(world);

            // update player resources
            let mut resource = ResourceImpl::get(world, (bank_account_entity_id, resource_type));
            resource.add(amount);
            resource.save(world);
        }


        fn sell(world: IWorldDispatcher, bank_entity_id: u128, resource_type: u8, amount: u128) {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

            // split resource amount into fees and rest
            let (owner_fees_amount, lp_fees_amount, rest) = InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled
            );

            // increase owner bank account with fees
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_resource = ResourceImpl::get(
                world, (owner_bank_account.entity_id, resource_type)
            );
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

            // update player lords
            let mut player_lords = ResourceImpl::get(
                world, (bank_account_entity_id, ResourceTypes::LORDS)
            );
            player_lords.add(payout);
            player_lords.save(world);

            // update player resource
            let mut resource = ResourceImpl::get(world, (bank_account_entity_id, resource_type));
            resource.burn(amount);
            resource.save(world);
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
    }
}
