use s1_eternum::alias::ID;
#[starknet::interface]
trait ILiquiditySystems<T> {
    fn add(
        ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, resource_amount: u128, lords_amount: u128,
    );
    fn remove(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: u128);
}
// todo: discuss: liquidity can be used to shield funds from realm raid and cpature
#[dojo::contract]
mod liquidity_systems {
    // Extenal imports
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{WorldStorageTrait};
    // Eternum imports
    use s1_eternum::alias::ID;
    use s1_eternum::constants::ResourceTypes;
    use s1_eternum::constants::{DEFAULT_NS, RESOURCE_PRECISION};
    use s1_eternum::models::bank::liquidity::{Liquidity};
    use s1_eternum::models::bank::market::{Market, MarketTrait};
    use s1_eternum::models::config::{SeasonConfigImpl};
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
    };
    use s1_eternum::models::weight::{Weight};
    use s1_eternum::systems::config::contracts::config_systems::{check_caller_is_admin};
    use s1_eternum::systems::resources::contracts::resource_bridge_systems::{
        IResourceBridgeSystemsDispatcher, IResourceBridgeSystemsDispatcherTrait,
    };
    use s1_eternum::systems::utils::resource::{iResourceTransferImpl};
    use starknet::ContractAddress;


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

            // ensure liquidity can only be added during main game time
            if !check_caller_is_admin(world) {
                SeasonConfigImpl::get(world).assert_started_and_not_over();
            }

            // ensure caller owns structure adding liquidity
            let mut player_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            player_structure_owner.assert_caller_owner();

            // ensure bank_entity_id is a bank
            let bank_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, bank_entity_id);
            assert!(bank_structure_base.category == StructureCategory::Bank.into(), "structure is not a bank");

            // ensure lords are not added as liquidity
            assert!(resource_type != ResourceTypes::LORDS, "resource type cannot be lords");

            // get market for resource type
            let mut market: Market = world.read_model(resource_type);
            let (cost_lords, cost_resource_amount, liquidity_shares, total_shares) = market
                .add_liquidity(lords_amount, resource_amount);

            market.lords_amount += cost_lords;
            market.resource_amount += cost_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            // todo : tie lp liquidity to an id instead of just burning it

            // burn the resource the player is exchanging lping with lords
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
            let player_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut player_resource = SingleResourceStoreImpl::retrieve(
                ref world, entity_id, resource_type, ref player_structure_weight, player_resource_weight_grams, true,
            );
            player_resource.spend(cost_resource_amount, ref player_structure_weight, player_resource_weight_grams);
            player_resource.store(ref world);

            // burn the lords added to lp
            let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let mut player_lords_resource = SingleResourceStoreImpl::retrieve(
                ref world, entity_id, ResourceTypes::LORDS, ref player_structure_weight, lords_weight_grams, true,
            );
            player_lords_resource.spend(cost_lords, ref player_structure_weight, lords_weight_grams);
            player_lords_resource.store(ref world);

            // store player structure weight
            player_structure_weight.store(ref world, entity_id);

            // increase player liquidity
            let mut player_liquidity: Liquidity = world.read_model((player_structure_owner, resource_type));
            player_liquidity.shares += liquidity_shares;

            world.write_model(@player_liquidity);

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, bank_entity_id, entity_id, cost_lords, cost_resource_amount, true,
            );
        }


        fn remove(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, shares: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // only liquidity removal is only allowed when main game has started
            // and grace period has not elapsed
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            // ensure resource type is not lords
            assert!(resource_type != ResourceTypes::LORDS, "resource type cannot be lords");

            // ensure bank_entity_id is a bank
            let bank_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, bank_entity_id);
            assert!(bank_structure_base.category == StructureCategory::Bank.into(), "structure is not a bank");

            // get market for resource type
            let mut market: Market = world.read_model(resource_type);
            let (payout_lords, payout_resource_amount, total_shares) = market.remove_liquidity(shares);
            // reduce market liquidity
            market.lords_amount -= payout_lords;
            market.resource_amount -= payout_resource_amount;
            market.total_shares = total_shares;

            // update market
            world.write_model(@market);

            // reduce player liquidity
            let caller = starknet::get_caller_address();
            let mut player_liquidity: Liquidity = world.read_model((caller, resource_type));
            assert!(player_liquidity.shares >= shares, "share amount is greater than player liquidity");
            player_liquidity.shares -= shares;

            // if player has no liquidity, erase model
            if player_liquidity.shares == 0 {
                world.erase_model(@player_liquidity);
            } else {
                world.write_model(@player_liquidity);
            }

            // send liquidity to caller
            if entity_id.is_non_zero() {
                ////////////////////////////////////////
                // RECEIVE LIQUIDITY INTO A STRUCTURE //
                ////////////////////////////////////////

                // ensure caller owns structure that receives liquidity
                let player_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
                player_structure_owner.assert_caller_owner();

                let mut player_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, entity_id);
                let mut bank_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, bank_entity_id);
                let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
                let mut bank_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                    ref world, bank_entity_id,
                );

                let resources = array![(ResourceTypes::LORDS, payout_lords), (resource_type, payout_resource_amount)]
                    .span();
                iResourceTransferImpl::structure_to_structure_delayed(
                    ref world,
                    bank_entity_id,
                    bank_structure_owner,
                    bank_structure_base,
                    ref bank_structure_weight,
                    entity_id,
                    player_structure_owner,
                    player_structure_base,
                    ref player_structure_weight,
                    resources,
                    true,
                    true,
                );

                // store structure weights
                player_structure_weight.store(ref world, entity_id);
                bank_structure_weight.store(ref world, bank_entity_id);
            } else {
                ////////////////////////////////////////////
                // RECEIVE LIQUIDITY INTO WALLET DIRECTLY //
                ////////////////////////////////////////////

                // get bridge systems address
                let (bridge_systems_address, _) = world.dns(@"resource_bridge_systems").unwrap();
                let bridge_systems: IResourceBridgeSystemsDispatcher = IResourceBridgeSystemsDispatcher {
                    contract_address: bridge_systems_address,
                };

                // payout resource and lords
                bridge_systems.lp_withdraw(caller, bank_entity_id, resource_type, payout_resource_amount);
                bridge_systems.lp_withdraw(caller, bank_entity_id, ResourceTypes::LORDS, payout_lords);
            }

            InternalLiquiditySystemsImpl::emit_event(
                ref world, market, bank_entity_id, entity_id, payout_lords, payout_resource_amount, false,
            );
        }
    }

    #[generate_trait]
    pub impl InternalLiquiditySystemsImpl of InternalLiquiditySystemsTrait {
        fn emit_event(
            ref world: WorldStorage,
            market: Market,
            bank_entity_id: ID,
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
                        bank_entity_id,
                        entity_id,
                        resource_type: market.resource_type,
                        lords_amount,
                        resource_amount,
                        resource_price,
                        add,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
