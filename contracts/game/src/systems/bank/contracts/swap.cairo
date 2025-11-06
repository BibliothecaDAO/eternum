use crate::alias::ID;

#[starknet::interface]
pub trait ISwapSystems<T> {
    fn buy(ref self: T, bank_entity_id: ID, structure_id: ID, resource_type: u8, amount: u128);
    fn sell(ref self: T, bank_entity_id: ID, structure_id: ID, resource_type: u8, amount: u128);
}

#[dojo::contract]
pub mod swap_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::bank::market::{Market, MarketTrait};
    use crate::models::config::{BankConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
    };
    use crate::models::weight::Weight;
    use crate::systems::utils::resource::iResourceTransferImpl;
    use starknet::ContractAddress;


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
        fn buy(ref self: ContractState, bank_entity_id: ID, structure_id: ID, resource_type: u8, amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure season is open
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure player entity is a structure
            let mut player_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            player_structure_base.assert_exists();

            // ensure caller owns structure
            let mut player_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            player_structure_owner.assert_caller_owner();

            // ensure bank_entity_id is a bank
            let bank_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, bank_entity_id);
            assert!(bank_structure_base.category == StructureCategory::Bank.into(), "structure is not a bank");

            // get lords price of resource expressed to be bought from amm
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut market: Market = world.read_model(resource_type);
            let lords_cost_from_amm = market
                .buy(bank_config.lp_fee_num.into(), bank_config.lp_fee_denom.into(), amount);
            let lps_fee = lords_cost_from_amm - market.buy(0, 1, amount);
            let bank_lords_fee_amount = (lords_cost_from_amm * bank_config.owner_fee_num.into())
                / bank_config.owner_fee_denom.into();
            let total_lords_cost = lords_cost_from_amm + bank_lords_fee_amount;

            // burn the resource the player is exchanging for lords
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let mut player_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, ResourceTypes::LORDS, ref player_structure_weight, lords_weight_grams, true,
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
            let bank_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, bank_entity_id);
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                bank_entity_id,
                bank_structure_owner,
                bank_structure_base,
                ref bank_structure_weight,
                structure_id,
                player_structure_owner,
                player_structure_base,
                ref player_structure_weight,
                resources,
                true,
                true,
            );

            // store structure weights
            player_structure_weight.store(ref world, structure_id);
            bank_structure_weight.store(ref world, bank_entity_id);

            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                bank_entity_id,
                structure_id,
                lords_cost_from_amm,
                amount,
                bank_lords_fee_amount,
                lps_fee,
                market.buy(0, 1, RESOURCE_PRECISION),
                true,
            );
        }


        fn sell(ref self: ContractState, bank_entity_id: ID, structure_id: ID, resource_type: u8, amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure player entity is a structure
            let mut player_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            player_structure_base.assert_exists();

            // ensure caller owns structure
            let mut player_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            player_structure_owner.assert_caller_owner();

            // ensure bank_entity_id is a bank
            let bank_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, bank_entity_id);
            assert!(bank_structure_base.category == StructureCategory::Bank.into(), "structure is not a bank");

            // get lords received from amm after resource amount is sold
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut market: Market = world.read_model(resource_type);
            let lords_received_from_amm = market
                .sell(bank_config.lp_fee_num.into(), bank_config.lp_fee_denom.into(), amount);
            let lps_fee = market.sell(0, 1, amount) - lords_received_from_amm;

            let bank_lords_fee_amount = (lords_received_from_amm * bank_config.owner_fee_num.into())
                / bank_config.owner_fee_denom.into();
            let total_lords_received = lords_received_from_amm - bank_lords_fee_amount;

            // burn the resource the player is exchanging for lords
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let player_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut player_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, resource_type, ref player_structure_weight, player_resource_weight_grams, true,
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

            // pickup player lords
            let mut resources = array![(ResourceTypes::LORDS, total_lords_received)].span();
            let mut bank_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, bank_entity_id,
            );
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                bank_entity_id,
                bank_structure_owner,
                bank_structure_base,
                ref bank_structure_weight,
                structure_id,
                player_structure_owner,
                player_structure_base,
                ref player_structure_weight,
                resources,
                true,
                true,
            );

            // update structure weights
            player_structure_weight.store(ref world, structure_id);
            bank_structure_weight.store(ref world, bank_entity_id);

            // update market liquidity
            market.lords_amount -= lords_received_from_amm;
            market.resource_amount += amount;
            world.write_model(@market);

            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                bank_entity_id,
                structure_id,
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
            bank_entity_id: ID,
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
                        bank_entity_id: bank_entity_id,
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
