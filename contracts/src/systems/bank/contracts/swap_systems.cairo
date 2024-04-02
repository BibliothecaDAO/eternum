#[dojo::contract]
mod swap_systems {
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::models::owner::{Owner};
    use eternum::models::config::{BankConfig};
    use eternum::systems::bank::interface::swap::ISwapSystems;
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use eternum::models::resources::{Resource, ResourceTrait};

    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use cubit::f128::math::ops::{mul};

    use traits::{Into, TryInto};
    use option::OptionTrait;

    #[abi(embed_v0)]
    impl SwapSystemsImpl of ISwapSystems<ContractState> {
        fn buy(
            self: @ContractState,
            world: IWorldDispatcher,
            bank_entity_id: u128,
            resource_type: u8,
            amount: u128
        ) {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );

            let market = get!(world, (bank_entity_id, resource_type), Market);

            let cost = market.buy(amount);

            // cost more
            let (cost_increased, owner_fees_amount, lp_fees_amount) =
                InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled, true
            );

            // update owner bank account with fees
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_lords = get!(
                world, (owner_bank_account.entity_id, ResourceTypes::LORDS), Resource
            );
            owner_lords.balance += owner_fees_amount;
            owner_lords.save(world);

            assert(cost_increased <= player_lords.balance, 'not enough lords');

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount + cost,
                    resource_amount: market.resource_amount - amount,
                    fee_resource_amount: market.fee_resource_amount,
                    fee_lords_amount: market.fee_lords_amount + lp_fees_amount,
                })
            );

            // update player lords
            player_lords.balance -= cost_increased;
            player_lords.save(world);

            // update player resources
            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            resource.balance += amount;
            resource.save(world);
        }


        fn sell(
            self: @ContractState,
            world: IWorldDispatcher,
            bank_entity_id: u128,
            resource_type: u8,
            amount: u128
        ) {
            let player = starknet::get_caller_address();

            let bank = get!(world, bank_entity_id, Bank);
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            assert(resource.balance >= amount, 'not enough resources');

            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );

            let (amount_reduced, owner_fees_amount, lp_fees_amount) =
                InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled, false
            );

            // update owner bank account with fees
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_resource = get!(
                world, (owner_bank_account.entity_id, resource_type), Resource
            );
            owner_resource.balance += owner_fees_amount;
            owner_resource.save(world);

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let payout = market.sell(amount_reduced);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount - payout,
                    resource_amount: market.resource_amount + amount_reduced,
                    fee_resource_amount: market.fee_resource_amount + lp_fees_amount,
                    fee_lords_amount: market.fee_lords_amount,
                })
            );

            // update player lords
            player_lords.balance += payout;
            player_lords.save(world);

            // update player resource
            resource.balance -= amount;
            resource.save(world);
        }
    }

    #[generate_trait]
    impl InternalSwapSystemsImpl of InternalSwapSystemsTrait {
        fn split_fees(
            amount: u128, owner_fee_scaled: u128, lp_fee_scaled: u128, buy_resource: bool,
        ) -> (u128, u128, u128) {
            let amount_fixed = FixedTrait::new_unscaled(amount, false);

            let owner_fee_fixed = FixedTrait::new(owner_fee_scaled, buy_resource);
            let lp_fee_fixed = FixedTrait::new(lp_fee_scaled, buy_resource);

            let owner_amount_fixed = mul(amount_fixed, owner_fee_fixed);
            let lp_amount_fixed = mul(amount_fixed, lp_fee_fixed);

            let new_amount_fixed = amount_fixed - owner_amount_fixed - lp_amount_fixed;

            (
                new_amount_fixed.try_into().unwrap(),
                owner_amount_fixed.try_into().unwrap(),
                lp_amount_fixed.try_into().unwrap()
            )
        }
    }
}
