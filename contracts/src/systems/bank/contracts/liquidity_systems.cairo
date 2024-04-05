#[dojo::contract]
mod liquidity_systems {
    // Dojo imports
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::bank::liquidity::{Liquidity};
    use eternum::systems::bank::interface::liquidity::ILiquiditySystems;
    use eternum::models::bank::bank::{BankAccounts};
    use eternum::models::resources::{Resource, ResourceTrait};
    use eternum::constants::ResourceTypes;

    // Extenal imports
    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    #[abi(embed_v0)]
    impl LiquiditySystemsImpl of ILiquiditySystems<ContractState> {
        fn add(
            world: IWorldDispatcher,
            bank_entity_id: u128,
            resource_type: u8,
            resource_amount: u128,
            lords_amount: u128,
        ) {
            let player = starknet::get_caller_address();

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'bank account not found');

            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            assert(resource.balance >= resource_amount, 'not enough resources');

            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );
            assert(lords_amount <= player_lords.balance, 'not enough lords');

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let (cost_lords, cost_resource_amount, liquidity_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount + cost_lords,
                    resource_amount: market.resource_amount + cost_resource_amount,
                })
            );

            player_lords.balance -= cost_lords;
            player_lords.save(world);

            // update player resource
            resource.balance -= cost_resource_amount;
            resource.save(world);

            // update player liquidity
            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            set!(
                world,
                (Liquidity {
                    bank_entity_id,
                    player,
                    resource_type: resource_type,
                    shares: player_liquidity.shares + liquidity_shares
                })
            );
        }


        fn remove(
            world: IWorldDispatcher,
            bank_entity_id: u128,
            resource_type: u8,
            shares: Fixed
        ) {
            let player = starknet::get_caller_address();

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'bank account not found');

            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            assert(player_liquidity.shares >= shares, 'not enough shares');

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let (payout_lords, payout_resource_amount) = market.remove_liquidity(shares);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount - payout_lords,
                    resource_amount: market.resource_amount - payout_resource_amount,
                })
            );

            // update player lords
            let mut player_lords = get!(
                world, (bank_account_entity_id, ResourceTypes::LORDS), Resource
            );
            player_lords.balance += payout_lords;
            player_lords.save(world);

            // update player resource
            let mut resource = get!(world, (bank_account_entity_id, resource_type), Resource);
            resource.balance += payout_resource_amount;
            resource.save(world);

            // update player liquidity
            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            set!(
                world,
                (Liquidity {
                    bank_entity_id, player, resource_type, shares: player_liquidity.shares - shares
                })
            );
        }
    }
}
