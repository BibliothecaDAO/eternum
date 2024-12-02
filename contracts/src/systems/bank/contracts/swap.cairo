use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;

#[starknet::interface]
trait ISwapSystems<T> {
    fn buy(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128) -> ID;
    fn sell(ref self: T, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128) -> ID;
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

    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use s0_eternum::models::bank::bank::{Bank};
    use s0_eternum::models::bank::market::{Market, MarketTrait};
    use s0_eternum::models::config::{BankConfig};
    use s0_eternum::models::config::{TickImpl, TickTrait};
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};
    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::systems::bank::contracts::bank::bank_systems::{InternalBankSystemsImpl};
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
        // price in lords for 1000 resource
        resource_price: u128,
        buy: bool,
        timestamp: u64,
    }

    #[abi(embed_v0)]
    impl SwapSystemsImpl of super::ISwapSystems<ContractState> {
        fn buy(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank: Bank = world.read_model(bank_entity_id);
            let bank_config: BankConfig = world.read_model(WORLD_CONFIG_ID);

            // get lords price of resource expressed to be bought from amm
            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let lords_cost_from_amm = market.buy(bank_config.lp_fee_num, bank_config.lp_fee_denom, amount);
            let lps_fee = lords_cost_from_amm - market.buy(0, 1, amount);
            let bank_lords_fee_amount = (lords_cost_from_amm * bank.owner_fee_num) / bank.owner_fee_denom;
            let total_lords_cost = lords_cost_from_amm + bank_lords_fee_amount;

            // udpate player lords
            let mut player_lords = ResourceImpl::get(ref world, (entity_id, ResourceTypes::LORDS));
            player_lords.burn(total_lords_cost);
            player_lords.save(ref world);

            // add bank fees to bank
            let mut bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
            bank_lords.add(bank_lords_fee_amount);
            bank_lords.save(ref world);

            // update market liquidity
            market.lords_amount += lords_cost_from_amm;
            market.resource_amount -= amount;
            world.write_model(@market);

            // player picks up resources with donkey
            let resources = array![(resource_type, amount)].span();
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                ref world, bank_entity_id, entity_id, resources
            );

            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                entity_id,
                lords_cost_from_amm,
                amount,
                bank_lords_fee_amount,
                lps_fee,
                market.buy(0, 1, 1000),
                true
            );

            // return donkey entity id
            donkey_id
        }


        fn sell(ref self: ContractState, bank_entity_id: ID, entity_id: ID, resource_type: u8, amount: u128) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank: Bank = world.read_model(bank_entity_id);
            let bank_config: BankConfig = world.read_model(WORLD_CONFIG_ID);

            // get lords received from amm after resource amount is sold
            let mut market: Market = world.read_model((bank_entity_id, resource_type));
            let lords_received_from_amm = market.sell(bank_config.lp_fee_num, bank_config.lp_fee_denom, amount);
            let lps_fee = market.sell(0, 1, amount) - lords_received_from_amm;

            let bank_lords_fee_amount = (lords_received_from_amm * bank.owner_fee_num) / bank.owner_fee_denom;
            let total_lords_received = lords_received_from_amm - bank_lords_fee_amount;

            // burn the resource the player is exchanging for lords
            let mut player_resource = ResourceImpl::get(ref world, (entity_id, resource_type));
            player_resource.burn(amount);
            player_resource.save(ref world);

            // add bank fees to bank
            let mut bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
            bank_lords.add(bank_lords_fee_amount);
            bank_lords.save(ref world);

            // update market liquidity
            market.lords_amount -= lords_received_from_amm;
            market.resource_amount += amount;
            world.write_model(@market);

            // pickup player lords
            let mut resources = array![(ResourceTypes::LORDS, total_lords_received)].span();
            let donkey_id = InternalBankSystemsImpl::pickup_resources_from_bank(
                ref world, bank_entity_id, entity_id, resources
            );

            // emit event
            InternalSwapSystemsImpl::emit_event(
                ref world,
                market,
                entity_id,
                total_lords_received,
                amount,
                bank_lords_fee_amount,
                lps_fee,
                market.buy(0, 1, 1000),
                false
            );

            // return donkey_id
            donkey_id
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
                        resource_price: market.quote_amount(1000),
                        buy,
                        timestamp: starknet::get_block_timestamp()
                    }
                );
        }
    }
}
