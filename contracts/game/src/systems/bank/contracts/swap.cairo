use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;

#[starknet::interface]
trait ISwapSystems<T> {
    fn buy(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128, player_resource_index: u8);
    fn sell(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128, player_resource_index: u8);
}

#[dojo::contract]
mod swap_systems {
    use cubit::f128::math::ops::{mul};
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use option::OptionTrait;

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, RESOURCE_PRECISION};
    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use s1_eternum::models::bank::bank::{Bank};
    use s1_eternum::models::bank::market::{Market, MarketTrait};
    use s1_eternum::models::config::{BankConfig, WorldConfigUtilImpl};
    use s1_eternum::models::config::{TickImpl, TickTrait};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};
    use s1_eternum::models::weight::{Weight, WeightTrait};
    use s1_eternum::models::resource::resource::{SingleResourceStoreImpl, SingleResourceImpl, ResourceWeightImpl, WeightStoreImpl};
    use s1_eternum::models::troop::{ExplorerTroops};
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureTrait};
    use s1_eternum::systems::utils::resource::{iResourceTransferImpl};

    use traits::{Into, TryInto};


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct SwapEvent {
        #[key]
        bank_entity_id: ID,
        #[key]
        entity_id: ID,
        #[key]
        id: ID,
        resource_type: u8,
        lords_amount: u128,
        resource_amount: u128,
        bank_owner_fees: u128,
        lp_fees: u128,
        // price in lords for 1 * RESOURCE_PRECISION resource
        resource_price: u128,
        buy: bool,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl SwapSystemsImpl of super::ISwapSystems<ContractState> {
        fn buy(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128, player_resource_index: u8) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank: Bank = world.read_model(bank_entity_id);
            assert!(bank.exists, "Bank does not exist");

            // ensure player entity is a structure
            let mut player_structure: Structure = world.read_model(entity_id);
            player_structure.assert_exists();

            // get lords price of resource expressed to be bought from amm
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let lords_cost_from_amm = market.buy(bank_config.lp_fee_num, bank_config.lp_fee_denom, amount);
            let lps_fee = lords_cost_from_amm - market.buy(0, 1, amount);
            let bank_lords_fee_amount = (lords_cost_from_amm * bank.owner_fee_num) / bank.owner_fee_denom;
            let total_lords_cost = lords_cost_from_amm + bank_lords_fee_amount;

            // burn the resource the player is exchanging for lords
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
            let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let mut player_resource = SingleResourceStoreImpl::retrieve(
                ref world, entity_id, ResourceTypes::LORDS, ref player_structure_weight, lords_weight_grams, true,
            );
            player_resource.spend(total_lords_cost, ref player_structure_weight, lords_weight_grams);
            player_resource.store(ref world);
            

            // add bank fees to bank
            let mut bank_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, bank_entity_id);
            let mut bank_lords_resource = SingleResourceStoreImpl::retrieve(
                ref world, bank_entity_id, ResourceTypes::LORDS, ref bank_structure_weight, lords_weight_grams, true,
            );
            bank_lords_resource.add(bank_lords_fee_amount, ref bank_structure_weight, lords_weight_grams);
            bank_lords_resource.store(ref world);
            

            // update market liquidity
            market.lords_amount += lords_cost_from_amm;
            market.resource_amount -= amount;
            world.write_model(@market);

            // player picks up resources with donkey
            let resources = array![(resource_type, amount)].span();
            let mut bank_structure: Structure = world.read_model(bank_entity_id);
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world, ref bank_structure, ref bank_structure_weight, 
                ref player_structure, array![player_resource_index].span(), resources, true, true
            );

            // update player and bank weights
            player_structure_weight.store(ref world, entity_id);
            bank_structure_weight.store(ref world, bank_entity_id);


            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                entity_id,
                lords_cost_from_amm,
                amount,
                bank_lords_fee_amount,
                lps_fee,
                market.buy(0, 1, RESOURCE_PRECISION),
                true,
            );
        }


        fn sell(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128, player_resource_index: u8)  {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank: Bank = world.read_model(bank_entity_id);
            assert!(bank.exists, "Bank does not exist");

            // get lords received from amm after resource amount is sold
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let lords_received_from_amm = market.sell(bank_config.lp_fee_num, bank_config.lp_fee_denom, amount);
            let lps_fee = market.sell(0, 1, amount) - lords_received_from_amm;

            let bank_lords_fee_amount = (lords_received_from_amm * bank.owner_fee_num) / bank.owner_fee_denom;
            let total_lords_received = lords_received_from_amm - bank_lords_fee_amount;

            // ensure player entity is a structure
            let mut player_structure: Structure = world.read_model(entity_id);
            player_structure.assert_exists();

            // burn the resource the player is exchanging for lords
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
            let player_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut player_resource = SingleResourceStoreImpl::retrieve(
                ref world, entity_id, resource_type, ref player_structure_weight, player_resource_weight_grams, true,
            );
            player_resource.spend(amount, ref player_structure_weight, player_resource_weight_grams);
            player_resource.store(ref world);

            // add bank fees to bank
            let mut bank_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, bank_entity_id);
            let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let mut bank_lords_resource = SingleResourceStoreImpl::retrieve(
                ref world, bank_entity_id, ResourceTypes::LORDS, ref bank_structure_weight, lords_weight_grams, true,
            );
            bank_lords_resource.add(bank_lords_fee_amount, ref bank_structure_weight, lords_weight_grams);
            bank_lords_resource.store(ref world);


            // update market liquidity
            market.lords_amount -= lords_received_from_amm;
            market.resource_amount += amount;
            world.write_model(@market);

            // pickup player lords
            let mut resources = array![(ResourceTypes::LORDS, total_lords_received)].span();
            let mut bank_structure: Structure = world.read_model(bank_entity_id);

            iResourceTransferImpl::structure_to_structure_delayed(
                ref world, ref bank_structure, ref bank_structure_weight, 
                ref player_structure, array![player_resource_index].span(), resources, true, true
            );

            // update player and bank weights
            player_structure_weight.store(ref world, entity_id);
            bank_structure_weight.store(ref world, bank_entity_id);
            

            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                entity_id,
                total_lords_received,
                amount,
                bank_lords_fee_amount,
                lps_fee,
                market.buy(0, 1, RESOURCE_PRECISION),
                false,
            );

        }
    }

    #[generate_trait]
    pub impl InternalSwapSystemsImpl of InternalSwapSystemsTrait {
        fn emit_event(
            ref world: WorldStorage,
            market: Market,
            entity_id: ID,
            lords_amount: u128,
            resource_amount: u128,
            bank_owner_fees: u128,
            lp_fees: u128,
            resource_price: u128,
            buy: bool,
        ) {
            world
                .emit_event(
                    @SwapEvent {
                        id: world.dispatcher.uuid(),
                        bank_entity_id: market.bank_entity_id,
                        entity_id,
                        resource_type: market.resource_type,
                        lords_amount,
                        resource_amount,
                        bank_owner_fees,
                        lp_fees,
                        resource_price: market.quote_amount(RESOURCE_PRECISION),
                        buy,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
