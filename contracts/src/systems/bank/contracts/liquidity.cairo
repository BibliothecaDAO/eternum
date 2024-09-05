use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ILiquiditySystems {
    fn add(
        ref world: IWorldDispatcher,
        bank_entity_id: ID,
        entity_id: ID,
        resource_type: u8,
        resource_amount: u128,
        lords_amount: u128,
    );
    fn remove(ref world: IWorldDispatcher, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed) -> ID;
}

#[dojo::contract]
mod liquidity_systems {
    // Extenal imports
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    // Eternum imports
    use eternum::alias::ID;
    use eternum::constants::ResourceTypes;
    use eternum::models::bank::liquidity::{Liquidity};
    use eternum::models::bank::market::{Market, MarketCustomTrait};
    use eternum::models::owner::{Owner, OwnerCustomTrait};
    use eternum::models::resources::{Resource, ResourceCustomImpl, ResourceCustomTrait};
    use eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct LiquidityEvent {
        #[key]
        bank_entity_id: ID,
        #[key]
        entity_id: ID,
        resource_type: u8,
        lords_amount: u128,
        resource_amount: u128,
        // price in lords for 1000 resource
        resource_price: u128,
        add: bool,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl LiquiditySystemsImpl of super::ILiquiditySystems<ContractState> {
        fn add(
            ref world: IWorldDispatcher,
            bank_entity_id: ID,
            entity_id: ID,
            resource_type: u8,
            resource_amount: u128,
            lords_amount: u128,
        ) {
            get!(world, entity_id, Owner).assert_caller_owner();
            let mut resource = ResourceCustomImpl::get(world, (entity_id, resource_type));
            assert(resource.balance >= resource_amount, 'not enough resources');

            let mut player_lords = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::LORDS));
            assert(lords_amount <= player_lords.balance, 'not enough lords');

            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            let (cost_lords, cost_resource_amount, liquidity_shares, total_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            market.lords_amount += cost_lords;
            market.resource_amount += cost_resource_amount;
            market.total_shares = total_shares;

            // update market
            set!(world, (market,));

            player_lords.burn(cost_lords);
            player_lords.save(world);

            // update player resource
            resource.burn(cost_resource_amount);
            resource.save(world);

            // update player liquidity
            let player = starknet::get_caller_address();
            let mut player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            player_liquidity.shares += liquidity_shares;

            set!(world, (player_liquidity,));

            InternalLiquiditySystemsImpl::emit_event(world, market, entity_id, cost_lords, cost_resource_amount, true,);
        }


        fn remove(
            ref world: IWorldDispatcher, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed
        ) -> ID {
            let player = starknet::get_caller_address();
            get!(world, entity_id, Owner).assert_caller_owner();

            let player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            assert(player_liquidity.shares >= shares, 'not enough shares');

            let mut market = get!(world, (bank_entity_id, resource_type), Market);
            let (payout_lords, payout_resource_amount, total_shares) = market.remove_liquidity(shares);

            market.lords_amount -= payout_lords;
            market.resource_amount -= payout_resource_amount;
            market.total_shares = total_shares;

            // update market
            set!(world, (market,));

            let resources = array![(ResourceTypes::LORDS, payout_lords), (resource_type, payout_resource_amount)]
                .span();

            // then entity picks up the resources at the bank
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                world, bank_entity_id, entity_id, resources
            );

            // update player liquidity
            let mut player_liquidity = get!(world, (bank_entity_id, player, resource_type), Liquidity);
            player_liquidity.shares -= shares;
            set!(world, (player_liquidity,));

            InternalLiquiditySystemsImpl::emit_event(
                world, market, entity_id, payout_lords, payout_resource_amount, false,
            );
            // return donkey id
            donkey_id
        }
    }

    #[generate_trait]
    pub impl InternalLiquiditySystemsImpl of InternalLiquiditySystemsTrait {
        fn emit_event(
            world: IWorldDispatcher, market: Market, entity_id: ID, lords_amount: u128, resource_amount: u128, add: bool
        ) {
            let resource_price = if market.has_liquidity() {
                market.quote_amount(1000)
            } else {
                0
            };
            emit!(
                world,
                (LiquidityEvent {
                    bank_entity_id: market.bank_entity_id,
                    entity_id,
                    resource_type: market.resource_type,
                    lords_amount,
                    resource_amount,
                    resource_price: resource_price,
                    add,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }
    }
}
