use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;

#[starknet::interface]
trait ITradeSystems<T> {
    fn create_order(
        ref self: T,
        maker_id: ID,
        maker_gives_resource: (u8, u128),
        taker_id: ID,
        taker_gives_resource: (u8, u128),
        expires_at: u64,
    ) -> ID;
    fn accept_order(
        ref self: T,
        taker_id: ID,
        trade_id: ID,
        maker_gives_resource: (u8, u128),
        taker_gives_resource: (u8, u128),
    );
    fn accept_partial_order(
        ref self: T,
        taker_id: ID,
        trade_id: ID,
        maker_gives_resource: (u8, u128),
        taker_gives_resource: (u8, u128),
        taker_gives_actual_amount: u128,
    );
    fn cancel_order(ref self: T, trade_id: ID, return_resources: (u8, u128));
}

#[dojo::contract]
mod trade_systems {
    use core::poseidon::poseidon_hash_span as hash;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s1_eternum::alias::ID;

    use s1_eternum::constants::{DEFAULT_NS, DONKEY_ENTITY_TYPE, REALM_ENTITY_TYPE, ResourceTypes, WORLD_CONFIG_ID};
    use s1_eternum::models::config::{CapacityConfig, CapacityConfigImpl, SpeedConfig, WorldConfig};
    use s1_eternum::models::config::{WeightConfig, WeightConfigImpl};
    use s1_eternum::models::movable::Movable;
    use s1_eternum::models::owner::{Owner, OwnerTrait};
    use s1_eternum::models::structure::{Structure, StructureImpl, StructureCategory};
    use s1_eternum::models::position::{Coord, Position, PositionTrait, TravelTrait};
    use s1_eternum::models::quantity::{Quantity, QuantityTracker};
    use s1_eternum::models::realm::Realm;
    use s1_eternum::models::resource::resource::{DetachedResource};

    use s1_eternum::models::resource::resource::{Resource, ResourceImpl};

    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::trade::{Trade, TradeStatus};
    use s1_eternum::models::weight::{W3eight, W3eightTrait};
    use s1_eternum::models::resource::r3esource::{SingleR33esourceStoreImpl, SingleR33esourceImpl, WeightUnitImpl, WeightStoreImpl};
    use s1_eternum::systems::resources::contracts::resource_systems::resource_systems::{
        InternalResourceSystemsImpl as internal_resources,
    };

    use s1_eternum::systems::utils::donkey::{iDonkeyImpl};


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
    struct AcceptPartialOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
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
            mut maker_gives_resource: (u8, u128),
            taker_id: ID,
            mut taker_gives_resource: (u8, u128),
            expires_at: u64,
        ) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure maker structure is owned by caller
            let maker_structure: Structure = world.read_model(maker_id);
            maker_structure.owner.assert_caller_owner();

            // ensure taker structure exists
            let taker_structure: Structure = world.read_model(taker_id);
            taker_structure.assert_exists();


            // ensure resouce amount being given is greater than 0
            let (maker_gives_resource_type, maker_gives_resource_amount) = maker_gives_resource;
            let (taker_gives_resource_type, taker_gives_resource_amount) = taker_gives_resource;
            assert!(maker_gives_resource_amount.is_non_zero(), "maker resource amount is 0");
            assert!(taker_gives_resource_amount.is_non_zero(), "taker resource amount is 0");


            // burn offered resource from maker balance
            let mut maker_structure_weight: W3eight = WeightStoreImpl::retrieve(ref world, maker_id);
            let maker_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, maker_gives_resource_type);
            let mut maker_resource = SingleR33esourceStoreImpl::retrieve(
                ref world, maker_id, maker_gives_resource_type, ref maker_structure_weight, maker_resource_weight_grams, true,
            );
            maker_resource.spend(maker_gives_resource_amount, ref maker_structure_weight, maker_resource_weight_grams);
            maker_resource.store(ref world);

    
            // burn enough maker donkeys to carry resources given by taker
            let taker_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, taker_gives_resource_type);
            let taker_resource_weight: u128 = taker_gives_resource_amount * taker_resource_weight_grams;
            iDonkeyImpl::burn(ref world, maker_id, maker_structure.owner, ref maker_structure_weight, taker_resource_weight, false);


            // update structure weight
            maker_structure_weight.store(ref world, maker_id);



            // save maker's traded resources
            let maker_gives_resource_id: ID = world.dispatcher.uuid();
            world
                .write_model(
                    @DetachedResource {
                        entity_id: maker_gives_resource_id,
                        index: 0,
                        resource_type: maker_gives_resource_type,
                        resource_amount: maker_gives_resource_amount,
                    },
                );


            // save taker's traded resources
            let taker_gives_resource_id: ID = world.dispatcher.uuid();
            world
                .write_model(
                    @DetachedResource {
                        entity_id: taker_gives_resource_id,
                        index: 0,
                        resource_type: taker_gives_resource_type,
                        resource_amount: taker_gives_resource_amount,
                    },
                );



            // create trade entity
            let trade_id = world.dispatcher.uuid();
            world
                .write_model(
                    @Trade {
                        trade_id,
                        maker_id,
                        maker_gives_resource_id,
                        maker_gives_resource_origin_id: maker_gives_resource_id,
                        maker_gives_resource_hash: hash(array![maker_gives_resource_type.into(), maker_gives_resource_amount.into()].span()),
                        taker_id,
                        taker_gives_resource_id,
                        taker_gives_resource_origin_id: taker_gives_resource_id,
                        taker_gives_resource_hash: hash(array![taker_gives_resource_type.into(), taker_gives_resource_amount.into()].span()),
                        status: TradeStatus::OPEN,
                        expires_at,
                    },
                );

            world.emit_event(@CreateOrder { taker_id, maker_id, trade_id, timestamp: starknet::get_block_timestamp() });

            trade_id
        }


        fn accept_order(
            ref self: ContractState,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resource: (u8, u128),
            mut taker_gives_resource: (u8, u128),
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // check that caller is taker
            let caller = starknet::get_caller_address();
            let taker_owner: Owner = world.read_model(taker_id);
            assert(taker_owner.address == caller, 'not owned by caller');

            InternalTradeSystemsImpl::accept_order(
                ref world, taker_id, trade_id, maker_gives_resource, taker_gives_resource,
            );
        }


        fn accept_partial_order(
            ref self: ContractState,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resource: Span<(u8, u128)>,
            mut taker_gives_resource: Span<(u8, u128)>,
            mut taker_gives_actual_amount: u128,
        ) { // Ensure only one resource type is being traded and input lengths match
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            assert!(taker_gives_actual_amount.is_non_zero(), "amount taker gives must be greater than 0");
            assert!(maker_gives_resource.len() == 1, "only one resource type is supported for partial orders");
            assert!(maker_gives_resource.len() == taker_gives_resource.len(), "resources lengths must be equal");

            // Verify caller is the taker
            let caller = starknet::get_caller_address();
            let taker_owner: Owner = world.read_model(taker_id);
            assert(taker_owner.address == caller, 'not owned by caller');
            // Get trade details and status
            let mut trade: Trade = world.read_model(trade_id);

            // Check trade expiration and taker validity
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            // Ensure trade is open and update status to accepted
            assert(trade.status == TradeStatus::OPEN, 'trade is not open');

            // Extract and verify maker's resource details
            let (maker_gives_resource_type, maker_gives_resource_amount) = maker_gives_resource.pop_front().unwrap();
            let maker_gives_resource_type = *maker_gives_resource_type;
            let maker_gives_resource_amount = *maker_gives_resource_amount;
            assert!(maker_gives_resource_amount > 0, "trade is closed (1)");
            let maker_gives_resource_felt_arr: Array<felt252> = array![
                maker_gives_resource_type.into(), maker_gives_resource_amount.into(),
            ];
            let maker_gives_resource_hash = hash(maker_gives_resource_felt_arr.span());
            assert!(
                maker_gives_resource_hash == trade.maker_gives_resource_hash, "wrong maker_gives_resource provided",
            );

            // Extract and verify taker's resource details
            let (taker_gives_resource_type, taker_gives_resource_amount) = taker_gives_resource.pop_front().unwrap();
            let taker_gives_resource_type = *taker_gives_resource_type;
            let taker_gives_resource_amount = *taker_gives_resource_amount;
            assert!(taker_gives_resource_amount > 0, "trade is closed (2)");
            let taker_gives_resource_felt_arr: Array<felt252> = array![
                taker_gives_resource_type.into(), taker_gives_resource_amount.into(),
            ];
            let taker_gives_resource_hash = hash(taker_gives_resource_felt_arr.span());
            assert!(
                taker_gives_resource_hash == trade.taker_gives_resource_hash, "wrong taker_gives_resource provided",
            );
            // Calculate actual transfer amounts and weights
            let maker_gives_actual_amount = maker_gives_resource_amount
                * taker_gives_actual_amount
                / taker_gives_resource_amount;
            let maker_gives_resource_actual = array![(maker_gives_resource_type, maker_gives_actual_amount)].span();
            let maker_gives_resource_actual_weight = WeightConfigImpl::get_weight_grams(
                ref world, maker_gives_resource_type, maker_gives_actual_amount,
            );
            let taker_gives_resource_actual = array![(taker_gives_resource_type, taker_gives_actual_amount)].span();
            let taker_gives_resource_actual_weight = WeightConfigImpl::get_weight_grams(
                ref world, taker_gives_resource_type, taker_gives_actual_amount,
            );

            if maker_gives_actual_amount == maker_gives_resource_amount {
                InternalTradeSystemsImpl::accept_order(
                    ref world, taker_id, trade_id, maker_gives_resource_actual, taker_gives_resource_actual,
                );
            } else {
                // create new order

                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///
                let new_maker_gives_resource = array![(maker_gives_resource_type, maker_gives_actual_amount)].span();
                let new_maker_gives_resource_felt_arr = array![
                    maker_gives_resource_type.into(), maker_gives_actual_amount.into(),
                ];
                let new_taker_gives_resource = array![(taker_gives_resource_type, taker_gives_actual_amount)].span();
                let new_taker_gives_resource_felt_arr = array![
                    taker_gives_resource_type.into(), taker_gives_actual_amount.into(),
                ];
                let new_maker_gives_resource_felt_arr_id: ID = world.dispatcher.uuid();
                let new_taker_gives_resource_felt_arr_id: ID = world.dispatcher.uuid();
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: new_maker_gives_resource_felt_arr_id,
                            index: 0,
                            resource_type: maker_gives_resource_type,
                            resource_amount: maker_gives_actual_amount,
                        },
                    );
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: new_taker_gives_resource_felt_arr_id,
                            index: 0,
                            resource_type: taker_gives_resource_type,
                            resource_amount: taker_gives_actual_amount,
                        },
                    );

                let new_trade_id = world.dispatcher.uuid();
                world
                    .write_model(
                        @Trade {
                            trade_id: new_trade_id,
                            maker_id: trade.maker_id,
                            maker_gives_resource_origin_id: trade.maker_gives_resource_origin_id,
                            maker_gives_resource_id: new_maker_gives_resource_felt_arr_id,
                            maker_gives_resource_hash: hash(new_maker_gives_resource_felt_arr.span()),
                            maker_gives_resource_weight: maker_gives_resource_actual_weight,
                            taker_id: trade.taker_id,
                            taker_gives_resource_origin_id: trade.taker_gives_resource_origin_id,
                            taker_gives_resource_id: new_taker_gives_resource_felt_arr_id,
                            taker_gives_resource_hash: hash(new_taker_gives_resource_felt_arr.span()),
                            taker_gives_resource_weight: taker_gives_resource_actual_weight,
                            status: TradeStatus::OPEN,
                            expires_at: trade.expires_at,
                        },
                    );

                // accept new order
                InternalTradeSystemsImpl::accept_order(
                    ref world, taker_id, new_trade_id, new_maker_gives_resource, new_taker_gives_resource,
                );

                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////

                // Calculate remaining amounts and update trade details
                let maker_amount_left = maker_gives_resource_amount - maker_gives_actual_amount;
                let taker_amount_left = taker_gives_resource_amount - taker_gives_actual_amount;
                trade
                    .maker_gives_resource_hash =
                        hash(array![maker_gives_resource_type.into(), maker_amount_left.into()].span());
                trade
                    .taker_gives_resource_hash =
                        hash(array![taker_gives_resource_type.into(), taker_amount_left.into()].span());
                trade.maker_gives_resource_weight -= maker_gives_resource_actual_weight;
                trade.taker_gives_resource_weight -= taker_gives_resource_actual_weight;
                trade.maker_gives_resource_id = world.dispatcher.uuid();
                trade.taker_gives_resource_id = world.dispatcher.uuid();
                // Update detached resources for maker and taker
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: trade.maker_gives_resource_id,
                            index: 0,
                            resource_type: maker_gives_resource_type,
                            resource_amount: maker_amount_left,
                        },
                    );
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: trade.taker_gives_resource_id,
                            index: 0,
                            resource_type: taker_gives_resource_type,
                            resource_amount: taker_amount_left,
                        },
                    );

                // Save updated trade
                world.write_model(@trade);
            }
        }


        fn cancel_order(ref self: ContractState, trade_id: ID, mut return_resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let mut trade: Trade = world.read_model(trade_id);
            let owner: Owner = world.read_model(trade.maker_id);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade.status == TradeStatus::OPEN, 'trade must be open');

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, 0, trade.maker_id, return_resources, 0, false, false,
            );

            assert!(
                maker_receives_resources_hash == trade.maker_gives_resource_hash, "wrong return resources provided",
            );

            // return donkeys to maker
            donkey::return_donkey(ref world, trade.maker_id, trade.taker_gives_resource_weight);

            trade.status = TradeStatus::CANCELLED;
            world.write_model(@trade);

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


    #[generate_trait]
    impl InternalTradeSystemsImpl of InternalTradeSystemsTrait {
        fn accept_order(
            ref world: WorldStorage,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resource: (u8, u128),
            mut taker_gives_resource: (u8, u128),
        ) {
            let mut trade: Trade = world.read_model(trade_id);

            // check trade expiration
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');

            // verify taker if it's a direct offer
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            // check and update trade status
            assert(trade.status == TradeStatus::OPEN, 'trade is not open');
            trade.status = TradeStatus::ACCEPTED;

            // update trade
            trade.taker_id = taker_id;
            world.write_model(@trade);

            let (_, taker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, trade.maker_id, trade.taker_id, maker_gives_resource, trade.taker_id, true, false,
            );
            assert!(
                taker_receives_resources_hash == trade.maker_gives_resource_hash,
                "wrong maker_gives_resource provided",
            );

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, trade.taker_id, trade.maker_id, taker_gives_resource, trade.maker_id, false, true,
            );

            assert!(
                maker_receives_resources_hash == trade.taker_gives_resource_hash,
                "wrong taker_gives_resource provided",
            );

            // give donkey burn achievement to trade maker only after successful transfer
            let donkey_amount = donkey::get_donkey_needed(ref world, trade.taker_gives_resource_weight);
            let maker_owner: Owner = world.read_model(trade.maker_id);
            donkey::give_breeder_achievement(ref world, donkey_amount, maker_owner.address);

            world
                .emit_event(
                    @AcceptOrder {
                        id: world.dispatcher.uuid(),
                        taker_id,
                        maker_id: trade.maker_id,
                        trade_id,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
