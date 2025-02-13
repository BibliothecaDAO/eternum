use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;

#[starknet::interface]
trait ILiquiditySystems<T> {
    fn add(
        ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, resource_amount: u128, lords_amount: u128,
    );
    fn remove(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed, player_resource_index: u8);
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
    use s1_eternum::alias::ID;
    use s1_eternum::constants::ResourceTypes;
    use s1_eternum::constants::{DEFAULT_NS, RESOURCE_PRECISION};
    use s1_eternum::models::bank::liquidity::{Liquidity};
    use s1_eternum::models::bank::bank::{Bank};
    use s1_eternum::models::bank::market::{Market, MarketTrait};
    use s1_eternum::models::owner::{Owner, OwnerTrait};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};
    use s1_eternum::models::weight::{W3eight, W3eightTrait};
    use s1_eternum::models::resource::r3esource::{SingleR33esourceStoreImpl, SingleR33esourceImpl, WeightUnitImpl, WeightStoreImpl};
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureTrait};
    use s1_eternum::systems::utils::resource::{iResourceImpl};

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
        // price in lords for 1 * RESOURCE_PRECISION resource
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

            let bank: Bank = world.read_model(bank_entity_id);
            assert(bank.exists, "Bank does not exist");

            let mut player_structure: Structure = world.read_model(entity_id);
            player_structure.owner.assert_caller_owner();

            assert!(resource_type != ResourceTypes::LORDS, "resource type cannot be lords");

            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let (cost_lords, cost_resource_amount, liquidity_shares, total_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            market.lords_amount += cost_lords;
            market.resource_amount += cost_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            // burn the resource the player is exchanging lping with lords
            let mut player_structure_weight: W3eight = WeightStoreImpl::retrieve(ref world, entity_id);
            let player_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
            let mut player_resource = SingleR33esourceStoreImpl::retrieve(
                ref world, entity_id, resource_type, ref player_structure_weight, player_resource_weight_grams, true,
            );
            player_resource.spend(cost_resource_amount, ref player_structure_weight, player_resource_weight_grams);
            player_resource.store(ref world);
            
            // burn the lords added to lp
            let lords_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::LORDS);
            let mut player_lords_resource = SingleR33esourceStoreImpl::retrieve(
                ref world, entity_id, ResourceTypes::LORDS, ref player_structure_weight, lords_weight_grams, true,
            );
            player_lords_resource.spend(cost_lords, ref player_structure_weight, lords_weight_grams);
            player_lords_resource.store(ref world);

            // update player liquidity
            let player = starknet::get_caller_address();
            let mut player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            player_liquidity.shares += liquidity_shares;

            world.write_model(@player_liquidity);

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, entity_id, cost_lords, cost_resource_amount, true,
            );
        }


        fn remove(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: Fixed, player_resource_index: u8) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            let bank: Bank = world.read_model(bank_entity_id);
            assert(bank.exists, "Bank does not exist");


            assert!(resource_type != ResourceTypes::LORDS, "resource type cannot be lords");

            let mut player_structure: Structure = world.read_model(entity_id);
            player_structure.owner.assert_caller_owner();

            let player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            assert(player_liquidity.shares >= shares, 'not enough shares');

            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let (payout_lords, payout_resource_amount, total_shares) = market.remove_liquidity(shares);

            market.lords_amount -= payout_lords;
            market.resource_amount -= payout_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            // burn the resource the player is exchanging for lords
            let resources = array![(ResourceTypes::LORDS, payout_lords), (resource_type, payout_resource_amount)]
                .span();
            let mut bank_structure: Structure = world.read_model(bank_entity_id);
            let mut bank_structure_weight: W3eight = WeightStoreImpl::retrieve(ref world, bank_entity_id);
            iResourceImpl::structure_to_structure_delayed(
                ref world, ref bank_structure, ref bank_structure_weight, 
                ref player_structure, array![player_resource_index].span(), resources, true,
            );

            // update bonk strutcure weight
            bank_structure_weight.store(ref world, bank_entity_id);

            // update player liquidity
            let player = starknet::get_caller_address();
            let mut player_liquidity: Liquidity = world.read_model((bank_entity_id, player, resource_type));
            player_liquidity.shares -= shares;
            world.write_model(@player_liquidity);

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, entity_id, payout_lords, payout_resource_amount, false,
            );

        }
    }

    #[generate_trait]
    pub impl InternalLiquiditySystemsImpl of InternalLiquiditySystemsTrait {
        fn emit_event(
            ref world: WorldStorage,
            market: Market,
            entity_id: ID,
            lords_amount: u128,
            resource_amount: u128,
            add: bool,
        ) {
            let resource_price = if market.has_liquidity() {
                market.quote_amount(1 * RESOURCE_PRECISION)
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
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
