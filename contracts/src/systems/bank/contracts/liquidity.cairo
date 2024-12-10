use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;

#[starknet::interface]
trait ILiquiditySystems<T> {
    fn add(
        ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, resource_amount: u128, lords_amount: u128,
    );
    fn remove(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed) -> ID;
}

#[dojo::contract]
mod liquidity_systems {
    // Extenal imports
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    // Eternum imports
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::constants::ResourceTypes;
    use s0_eternum::models::bank::liquidity::{Liquidity};
    use s0_eternum::models::bank::market::{Market, MarketTrait};
    use s0_eternum::models::owner::{Owner, OwnerTrait};
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};
    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
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
            ref self: ContractState,
            bank_entity_id: ID,
            entity_id: ID,
            resource_type: u8,
            resource_amount: u128,
            lords_amount: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let owner: Owner = world.read_model(entity_id);
            owner.assert_caller_owner();
            let mut resource = ResourceImpl::get(ref world, (entity_id, resource_type));
            assert(resource.balance >= resource_amount, 'not enough resources');

            let mut player_lords = ResourceImpl::get(ref world, (entity_id, ResourceTypes::LORDS));
            assert(lords_amount <= player_lords.balance, 'not enough lords');

            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let (cost_lords, cost_resource_amount, liquidity_shares, total_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            market.lords_amount += cost_lords;
            market.resource_amount += cost_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            player_lords.burn(cost_lords);
            player_lords.save(ref world);

            // update player resource
            resource.burn(cost_resource_amount);
            resource.save(ref world);

            // update player liquidity
            let player = starknet::get_caller_address();
            let mut player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            player_liquidity.shares += liquidity_shares;

            world.write_model(@player_liquidity);

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, entity_id, cost_lords, cost_resource_amount, true,
            );
        }


        fn remove(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            let player = starknet::get_caller_address();
            let owner: Owner = world.read_model(entity_id);
            owner.assert_caller_owner();

            let player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            assert(player_liquidity.shares >= shares, 'not enough shares');

            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let (payout_lords, payout_resource_amount, total_shares) = market.remove_liquidity(shares);

            market.lords_amount -= payout_lords;
            market.resource_amount -= payout_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            let resources = array![(ResourceTypes::LORDS, payout_lords), (resource_type, payout_resource_amount)]
                .span();

            // then entity picks up the resources at the bank
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                ref world, bank_entity_id, entity_id, resources
            );

            // update player liquidity
            let mut player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            player_liquidity.shares -= shares;
            world.write_model(@player_liquidity);

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, entity_id, payout_lords, payout_resource_amount, false,
            );
            // return donkey id
            donkey_id
        }
    }

    #[generate_trait]
    pub impl InternalLiquiditySystemsImpl of InternalLiquiditySystemsTrait {
        fn emit_event(
            ref world: WorldStorage, market: Market, entity_id: ID, lords_amount: u128, resource_amount: u128, add: bool
        ) {
            let resource_price = if market.has_liquidity() {
                market.quote_amount(1000)
            } else {
                0
            };
            world
                .emit_event(
                    @LiquidityEvent {
                        bank_entity_id: market.bank_entity_id,
                        entity_id,
                        resource_type: market.resource_type,
                        lords_amount,
                        resource_amount,
                        resource_price: resource_price,
                        add,
                        timestamp: starknet::get_block_timestamp()
                    }
                );
        }
    }
}
