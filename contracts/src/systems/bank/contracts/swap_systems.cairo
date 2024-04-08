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

            // cost more
            let (owner_fees_amount, lp_fees_amount) = InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled
            );

            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            let cost = market.buy(amount);
            market.lords_amount += cost + lp_fees_amount;
            market.resource_amount -= amount;
            // update market
            set!(world, (market));

            // update owner bank account with fees
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_lords = get!(
                world, (owner_bank_account.entity_id, ResourceTypes::LORDS), Resource
            );
            owner_lords.add(world, owner_fees_amount);

            // udpate player lords
            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );
            player_lords.deduct(world, cost + owner_fees_amount + lp_fees_amount, true);

            // update player resources
            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            resource.balance += amount;
            resource.save(world);
        }


        fn sell(
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

            let (owner_fees_amount, lp_fees_amount) = InternalSwapSystemsImpl::split_fees(
                amount, bank.owner_fee_scaled, bank_config.lp_fee_scaled
            );

            // increase owner bank account with fees
            let bank_owner = get!(world, bank_entity_id, Owner);
            let owner_bank_account = get!(
                world, (bank_entity_id, bank_owner.address), BankAccounts
            );
            let mut owner_resource = get!(
                world, (owner_bank_account.entity_id, resource_type), Resource
            );
            owner_resource.add(world, owner_fees_amount);

            // update market
            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            let payout = market.sell(amount - owner_fees_amount - lp_fees_amount);
            market.lords_amount -= payout;
            market.resource_amount += amount - owner_fees_amount;
            set!(world, (market));

            // update player lords
            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );
            player_lords.add(world, payout);

            // update player resource
            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            resource.deduct(world, amount, true);
        }
    }

    #[generate_trait]
    impl InternalSwapSystemsImpl of InternalSwapSystemsTrait {
        fn split_fees(amount: u128, owner_fee_scaled: u128, lp_fee_scaled: u128,) -> (u128, u128) {
            let amount_fixed = FixedTrait::new_unscaled(amount, false);

            let owner_fee_fixed = FixedTrait::new(owner_fee_scaled, false);
            let lp_fee_fixed = FixedTrait::new(lp_fee_scaled, false);

            let owner_amount_fixed = amount_fixed * owner_fee_fixed;
            let lp_amount_fixed = amount_fixed * lp_fee_fixed;

            (owner_amount_fixed.try_into().unwrap(), lp_amount_fixed.try_into().unwrap())
        }
    }
}
