use s1_eternum::alias::ID;

#[starknet::interface]
pub trait ITradeSystems<T> {
    fn create_order(
        ref self: T,
        maker_id: ID,
        taker_id: ID,
        maker_gives_resource_type: u8,
        maker_gives_min_resource_amount: u128,
        maker_gives_max_count: u128, // maker_gives_resource_amount = maker_gives_min_resource_amount * maker_gives_max_count
        taker_pays_min_lords_amount: u128,
        expires_at: u32,
    ) -> ID;
    fn accept_order(ref self: T, taker_id: ID, trade_id: ID, taker_buys_count: u128);

    fn cancel_order(ref self: T, trade_id: ID);
}

#[dojo::contract]
pub mod trade_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use s1_eternum::alias::ID;

    use s1_eternum::constants::{DEFAULT_NS, ResourceTypes};
    use s1_eternum::models::config::{SpeedImpl, TradeConfig, WorldConfigUtilImpl};
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureOwnerStoreImpl,
    };
    use s1_eternum::models::trade::{Trade, TradeCount, TradeCountImpl};
    use s1_eternum::models::weight::{Weight};
    use s1_eternum::systems::utils::distance::{iDistanceKmImpl};
    use s1_eternum::systems::utils::donkey::{iDonkeyImpl};
    use starknet::ContractAddress;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct CreateOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct AcceptOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        #[key]
        id: ID,
        trade_id: ID,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct CancelOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    impl TradeSystemsImpl of super::ITradeSystems<ContractState> {
        fn create_order(
            ref self: ContractState,
            maker_id: ID,
            taker_id: ID,
            maker_gives_resource_type: u8,
            maker_gives_min_resource_amount: u128,
            maker_gives_max_count: u128, // maker_gives_resource_amount = maker_gives_min_resource_amount * maker_gives_max_count
            taker_pays_min_lords_amount: u128,
            expires_at: u32,
        ) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure maker structure is owned by caller
            let maker_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, maker_id);
            maker_structure_owner.assert_caller_owner();

            // ensure taker structure exists
            if taker_id.is_non_zero() {
                let taker_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, taker_id);
                taker_structure.assert_exists();
            }

            // ensure trade count does not exceed max
            let trade_config: TradeConfig = WorldConfigUtilImpl::get_member(world, selector!("trade_config"));
            let mut trade_count: TradeCount = world.read_model(maker_id);
            assert!(trade_count.count < trade_config.max_count, "trade count exceeds max");

            // ensure expires at is in the future
            let now = starknet::get_block_timestamp().try_into().unwrap();
            assert!(expires_at > now, "expires at is in the past");

            // ensure maker resource is not lords
            assert!(maker_gives_resource_type != ResourceTypes::LORDS, "maker resource is lords");

            // ensure amounts are valid
            assert!(maker_gives_resource_type.is_non_zero(), "maker gives resource type is 0");
            assert!(taker_pays_min_lords_amount.is_non_zero(), "taker pays min lords amount is 0");
            assert!(maker_gives_max_count.is_non_zero(), "maker gives max count is 0");

            // ensure resouce amount being given is greater than 0
            let maker_gives_max_resource_amount = maker_gives_max_count * maker_gives_min_resource_amount;
            let taker_gives_max_lords_amount = maker_gives_max_count * taker_pays_min_lords_amount;

            // burn offered resource from maker balance
            let mut maker_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, maker_id);
            let maker_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, maker_gives_resource_type);
            let mut maker_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                maker_id,
                maker_gives_resource_type,
                ref maker_structure_weight,
                maker_resource_weight_grams,
                true,
            );
            maker_resource
                .spend(maker_gives_max_resource_amount, ref maker_structure_weight, maker_resource_weight_grams);
            maker_resource.store(ref world);

            // burn enough maker donkeys to carry resources given by taker
            let taker_lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let taker_lords_weight: u128 = taker_gives_max_lords_amount * taker_lords_weight_grams;
            let maker_donkey_amount = iDonkeyImpl::needed_amount(ref world, taker_lords_weight);
            iDonkeyImpl::burn(ref world, maker_id, ref maker_structure_weight, maker_donkey_amount);

            // update structure weight
            maker_structure_weight.store(ref world, maker_id);

            // create trade entity
            let trade_id = world.dispatcher.uuid();
            world
                .write_model(
                    @Trade {
                        trade_id,
                        maker_id,
                        maker_gives_resource_type,
                        maker_gives_min_resource_amount,
                        maker_gives_max_count,
                        taker_id,
                        taker_pays_min_lords_amount,
                        expires_at,
                    },
                );

            // increment trade count
            trade_count.count += 1;
            world.write_model(@trade_count);

            world.emit_event(@CreateOrder { taker_id, maker_id, trade_id, timestamp: starknet::get_block_timestamp() });

            trade_id
        }


        fn accept_order(ref self: ContractState, taker_id: ID, trade_id: ID, taker_buys_count: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure trade exists
            let mut trade: Trade = world.read_model(trade_id);
            assert!(trade.maker_id.is_non_zero(), "trade does not exist");

            // ensure caller owns taker structure
            let taker_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, trade.taker_id);
            taker_structure_owner.assert_caller_owner();

            // ensure trade is not expired
            let now = starknet::get_block_timestamp().try_into().unwrap();
            assert!(trade.expires_at > now, "trade expired");

            // ensure caller is the taker if offer is private
            if trade.taker_id.is_non_zero() {
                assert!(trade.taker_id == taker_id, "not the taker");
            }

            // ensure taker structure exists if offer is public
            let taker_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, taker_id);
            if trade.taker_id.is_zero() {
                taker_structure.assert_exists();
            }

            // ensure buy amount is valid
            assert!(taker_buys_count.is_non_zero(), "taker buys resource amount is 0");
            assert!(taker_buys_count <= trade.maker_gives_max_count, "attempting to buy more than available");

            // compute resource arrival time
            let maker_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, trade.maker_id);
            let donkey_speed = SpeedImpl::for_donkey(ref world);
            let travel_time = starknet::get_block_timestamp()
                + iDistanceKmImpl::time_required(
                    ref world, maker_structure.coord(), taker_structure.coord(), donkey_speed, true,
                );
            let (arrival_day, arrival_slot) = ResourceArrivalImpl::arrival_slot(ref world, travel_time);

            // send the taker's resource to the maker
            let taker_pays_lords_amount = taker_buys_count * trade.taker_pays_min_lords_amount;
            let mut maker_resources_array = ResourceArrivalImpl::read_slot(
                ref world, trade.maker_id, arrival_day, arrival_slot,
            );
            let mut maker_resource_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                ref world, trade.maker_id, arrival_day,
            );
            ResourceArrivalImpl::slot_increase_balances(
                ref maker_resources_array,
                array![(ResourceTypes::LORDS, taker_pays_lords_amount)].span(),
                ref maker_resource_arrival_total_amount,
            );

            ResourceArrivalImpl::write_slot(
                ref world, trade.maker_id, arrival_day, arrival_slot, maker_resources_array,
            );
            ResourceArrivalImpl::write_day_total(
                ref world, trade.maker_id, arrival_day, maker_resource_arrival_total_amount,
            );

            // send the maker's resource to the taker
            let maker_gives_resource_amount = taker_buys_count * trade.maker_gives_min_resource_amount;
            let mut taker_resources_array = ResourceArrivalImpl::read_slot(
                ref world, trade.taker_id, arrival_day, arrival_slot,
            );
            let mut taker_resource_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                ref world, trade.taker_id, arrival_day,
            );
            ResourceArrivalImpl::slot_increase_balances(
                ref taker_resources_array,
                array![(trade.maker_gives_resource_type, maker_gives_resource_amount)].span(),
                ref taker_resource_arrival_total_amount,
            );
            ResourceArrivalImpl::write_slot(
                ref world, trade.taker_id, arrival_day, arrival_slot, taker_resources_array,
            );
            ResourceArrivalImpl::write_day_total(
                ref world, trade.taker_id, arrival_day, taker_resource_arrival_total_amount,
            );

            // burn enough taker donkeys to carry resources given by maker
            let mut taker_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, trade.taker_id);
            let maker_resource_weight_grams: u128 = ResourceWeightImpl::grams(
                ref world, trade.maker_gives_resource_type,
            );
            let maker_resource_weight: u128 = maker_gives_resource_amount * maker_resource_weight_grams;
            let taker_donkey_amount = iDonkeyImpl::needed_amount(ref world, maker_resource_weight);
            iDonkeyImpl::burn(ref world, taker_id, ref taker_structure_weight, taker_donkey_amount);
            iDonkeyImpl::burn_finialize(ref world, trade.taker_id, taker_donkey_amount, taker_structure_owner);

            // update taker structure weight
            taker_structure_weight.store(ref world, trade.taker_id);

            // finalize maker donkey burn to pickup lords from taker
            let mut maker_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, trade.maker_id,
            );
            let taker_lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let taker_lords_weight: u128 = taker_pays_lords_amount * taker_lords_weight_grams;
            let maker_donkey_amount = iDonkeyImpl::needed_amount(ref world, taker_lords_weight);
            iDonkeyImpl::burn_finialize(ref world, trade.maker_id, maker_donkey_amount, maker_structure_owner);

            // update trade and trade count
            trade.maker_gives_max_count -= taker_buys_count;
            if trade.maker_gives_max_count.is_zero() {
                // decrease trade count
                let mut trade_count: TradeCount = world.read_model(trade.maker_id);
                trade_count.decrease(ref world);

                // delete trade
                world.erase_model(@trade);
            } else {
                world.write_model(@trade);
            }

            // todo: add more data to event
            world
                .emit_event(
                    @AcceptOrder {
                        id: world.dispatcher.uuid(),
                        taker_id,
                        maker_id: trade.maker_id,
                        trade_id: trade.trade_id,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn cancel_order(ref self: ContractState, trade_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure trade exists
            let mut trade: Trade = world.read_model(trade_id);
            assert!(trade.maker_id.is_non_zero(), "trade does not exist");

            // ensure caller owns maker structure
            let maker_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, trade.maker_id);
            maker_structure_owner.assert_caller_owner();

            // return offered resource to maker balance
            let maker_gives_max_resource_amount = trade.maker_gives_max_count * trade.maker_gives_min_resource_amount;
            let mut maker_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, trade.maker_id);
            let maker_resource_weight_grams: u128 = ResourceWeightImpl::grams(
                ref world, trade.maker_gives_resource_type,
            );
            let mut maker_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                trade.maker_id,
                trade.maker_gives_resource_type,
                ref maker_structure_weight,
                maker_resource_weight_grams,
                true,
            );
            maker_resource
                .add(maker_gives_max_resource_amount, ref maker_structure_weight, maker_resource_weight_grams);
            maker_resource.store(ref world);

            // return burned donkeys to maker
            let taker_gives_max_lords_amount = trade.maker_gives_max_count * trade.taker_pays_min_lords_amount;
            let taker_lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let taker_lords_weight: u128 = taker_gives_max_lords_amount * taker_lords_weight_grams;

            // todo: ensure the donkey amount cant be gamed

            let maker_donkey_amount = iDonkeyImpl::needed_amount(ref world, taker_lords_weight);
            iDonkeyImpl::create(ref world, trade.maker_id, ref maker_structure_weight, maker_donkey_amount);

            // update maker structure weight
            maker_structure_weight.store(ref world, trade.maker_id);

            // delete trade
            world.erase_model(@trade);

            // decrease trade count
            let mut trade_count: TradeCount = world.read_model(trade.maker_id);
            trade_count.decrease(ref world);

            // emit event
            world
                .emit_event(
                    @CancelOrder {
                        taker_id: trade.taker_id,
                        maker_id: trade.maker_id,
                        trade_id,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
