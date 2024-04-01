#[dojo::contract]
mod swap_systems {
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::bank::bank::{BankAccounts};
    use eternum::systems::bank::interface::swap::ISwapSystems;
    use eternum::constants::ResourceTypes;
    use eternum::models::resources::{Resource, ResourceTrait};

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

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );

            let market = get!(world, (bank_entity_id, resource_type), Market);

            let cost = market.buy(amount);
            assert(cost <= player_lords.balance, 'not enough lords');

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount + cost,
                    resource_amount: market.resource_amount - amount,
                })
            );

            // update player lords
            player_lords.balance -= cost;
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

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'no bank account');

            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            assert(resource.balance >= amount, 'not enough resources');

            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let payout = market.sell(amount);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount - payout,
                    resource_amount: market.resource_amount + amount,
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
}
