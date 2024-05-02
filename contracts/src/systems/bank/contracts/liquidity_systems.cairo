use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ILiquiditySystems {
    fn add(bank_entity_id: u128, resource_type: u8, resource_amount: u128, lords_amount: u128,);
    fn remove(bank_entity_id: u128, resource_type: u8, shares: Fixed);
}


#[dojo::contract]
mod liquidity_systems {
    // Extenal imports
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use eternum::constants::ResourceTypes;
    use eternum::models::bank::bank::{BankAccounts};
    use eternum::models::bank::liquidity::{Liquidity};
    // Dojo imports
    use eternum::models::bank::market::{Market, MarketTrait};
    use eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};

    #[derive(Drop, starknet::Event)]
    struct LiquidityEvent {
        #[key]
        bank_entity_id: u128,
        #[key]
        bank_account_entity_id: u128,
        lords_amount: u128,
        resource_amount: u128,
        // price in lords for 1000 resource
        resource_price: u128,
        add: bool,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LiquidityEvent: LiquidityEvent,
    }

    #[abi(embed_v0)]
    impl LiquiditySystemsImpl of super::ILiquiditySystems<ContractState> {
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

            let mut resource = ResourceImpl::get(world, (bank_account_entity_id, resource_type));
            assert(resource.balance >= resource_amount, 'not enough resources');

            let mut player_lords = ResourceImpl::get(
                world, (bank_account_entity_id, ResourceTypes::LORDS)
            );
            assert(lords_amount <= player_lords.balance, 'not enough lords');

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let (cost_lords, cost_resource_amount, liquidity_shares, total_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount + cost_lords,
                    resource_amount: market.resource_amount + cost_resource_amount,
                    total_shares,
                })
            );

            player_lords.burn(cost_lords);
            player_lords.save(world);

            // update player resource
            resource.burn(cost_resource_amount);
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

            InternalLiquiditySystemsImpl::emit_event(
                world,
                market,
                bank_account_entity_id,
                cost_lords,
                cost_resource_amount,
                true,
            );

        }


        fn remove(world: IWorldDispatcher, bank_entity_id: u128, resource_type: u8, shares: Fixed) {
            let player = starknet::get_caller_address();

            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            let bank_account_entity_id = bank_account.entity_id;
            assert(bank_account_entity_id != 0, 'bank account not found');

            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            assert(player_liquidity.shares >= shares, 'not enough shares');

            let market = get!(world, (bank_entity_id, resource_type), Market);
            let (payout_lords, payout_resource_amount, total_shares) = market
                .remove_liquidity(shares);

            // update market
            set!(
                world,
                (Market {
                    bank_entity_id,
                    resource_type,
                    lords_amount: market.lords_amount - payout_lords,
                    resource_amount: market.resource_amount - payout_resource_amount,
                    total_shares,
                })
            );

            // update player lords
            let mut player_lords = ResourceImpl::get(
                world, (bank_account_entity_id, ResourceTypes::LORDS)
            );
            player_lords.add(payout_lords);
            player_lords.save(world);

            // update player resource
            let mut resource = ResourceImpl::get(world, (bank_account_entity_id, resource_type));
            resource.add(payout_resource_amount);
            resource.save(world);

            // update player liquidity
            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            set!(
                world,
                (Liquidity {
                    bank_entity_id, player, resource_type, shares: player_liquidity.shares - shares
                })
            );

            InternalLiquiditySystemsImpl::emit_event(
                world,
                market,
                bank_account_entity_id,
                payout_lords,
                payout_resource_amount,
                false,
            );
        }
    }

    #[generate_trait]
    impl InternalLiquiditySystemsImpl of InternalLiquiditySystemsTrait {
        fn emit_event(world: IWorldDispatcher, market: Market, bank_account_entity_id: u128, lords_amount: u128, resource_amount: u128, add: bool) {
            // resource price in lords for 1000 resources
            let resource_price = market.quote_amount(1000);

            emit!(
                world,
                (
                    Event::LiquidityEvent(
                        LiquidityEvent {
                            bank_entity_id: market.bank_entity_id, 
                            bank_account_entity_id, 
                            lords_amount, 
                            resource_amount, 
                            resource_price, 
                            add
                        }
                    ),
                )
            );
        }

    }
}
