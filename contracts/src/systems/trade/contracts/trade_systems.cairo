use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;

#[starknet::interface]
trait ITradeSystems<T> {
    fn create_order(
        ref self: T,
        maker_id: ID,
        maker_gives_resources: Span<(u8, u128)>,
        taker_id: ID,
        taker_gives_resources: Span<(u8, u128)>,
        expires_at: u64
    ) -> ID;
    fn accept_order(
        ref self: T,
        taker_id: ID,
        trade_id: ID,
        maker_gives_resources: Span<(u8, u128)>,
        taker_gives_resources: Span<(u8, u128)>
    );
    fn accept_partial_order(
        ref self: T,
        taker_id: ID,
        trade_id: ID,
        maker_gives_resources: Span<(u8, u128)>,
        taker_gives_resources: Span<(u8, u128)>,
        taker_gives_actual_amount: u128
    );
    fn cancel_order(ref self: T, trade_id: ID, return_resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod trade_systems {
    use core::poseidon::poseidon_hash_span as hash;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::alias::ID;

    use s0_eternum::constants::{DEFAULT_NS, REALM_ENTITY_TYPE, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use s0_eternum::models::config::{WeightConfig, WeightConfigCustomImpl};
    use s0_eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig, CapacityConfigCustomImpl};
    use s0_eternum::models::movable::{Movable, ArrivalTime};
    use s0_eternum::models::owner::Owner;
    use s0_eternum::models::position::{Position, PositionCustomTrait, Coord, TravelTrait};
    use s0_eternum::models::quantity::{Quantity, QuantityTracker};
    use s0_eternum::models::realm::Realm;
    use s0_eternum::models::resources::{DetachedResource};

    use s0_eternum::models::resources::{Resource, ResourceCustomImpl};

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::trade::{Trade, Status, TradeStatus};
    use s0_eternum::models::weight::{Weight, WeightCustomTrait};
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{
        InternalResourceSystemsImpl as internal_resources,
    };

    use s0_eternum::systems::transport::contracts::donkey_systems::donkey_systems::{
        InternalDonkeySystemsImpl as donkey
    };


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct CreateOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64
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
        timestamp: u64
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct AcceptPartialOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct CancelOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64
    }


    #[abi(embed_v0)]
    impl TradeSystemsImpl of super::ITradeSystems<ContractState> {
        fn create_order(
            ref self: ContractState,
            maker_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            taker_id: ID,
            mut taker_gives_resources: Span<(u8, u128)>,
            expires_at: u64
        ) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let caller = starknet::get_caller_address();

            let maker_owner: Owner = world.read_model(maker_id);
            assert(maker_owner.address == caller, 'caller not maker');

            let maker_gives_resources_id: ID = world.dispatcher.uuid();
            let mut maker_gives_resources_count: u32 = 0;
            let mut maker_gives_resources_felt_arr: Array<felt252> = array![];
            let mut maker_gives_resources_weight = 0;
            loop {
                match maker_gives_resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        assert(*resource_amount != 0, 'maker resource amount is 0');
                        // burn offered resource from maker balance
                        let mut maker_resource: Resource = ResourceCustomImpl::get(
                            ref world, (maker_id, *resource_type)
                        );
                        maker_resource.burn(*resource_amount);
                        maker_resource.save(ref world);

                        // save maker's traded resources
                        world
                            .write_model(
                                @DetachedResource {
                                    entity_id: maker_gives_resources_id,
                                    index: maker_gives_resources_count,
                                    resource_type: *resource_type,
                                    resource_amount: *resource_amount
                                }
                            );

                        maker_gives_resources_count += 1;

                        // update maker resources weight
                        maker_gives_resources_weight +=
                            WeightConfigCustomImpl::get_weight_grams(ref world, *resource_type, *resource_amount);

                        maker_gives_resources_felt_arr.append((*resource_type).into());
                        maker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // deduct weight from maker
            let mut maker_weight: Weight = world.read_model(maker_id);
            let mut maker_capacity: CapacityConfig = CapacityConfigCustomImpl::get_from_entity(ref world, maker_id);

            maker_weight.deduct(maker_capacity, maker_gives_resources_weight);
            world.write_model(@maker_weight);

            let taker_gives_resources_id: ID = world.dispatcher.uuid();
            let mut taker_gives_resources_count: u32 = 0;
            let mut taker_gives_resources_felt_arr: Array<felt252> = array![];
            let mut taker_gives_resources_weight = 0;
            loop {
                match taker_gives_resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        assert(*resource_amount != 0, 'taker resource amount is 0');
                        // save taker's traded resources
                        world
                            .write_model(
                                @DetachedResource {
                                    entity_id: taker_gives_resources_id,
                                    index: taker_gives_resources_count,
                                    resource_type: *resource_type,
                                    resource_amount: *resource_amount
                                }
                            );

                        taker_gives_resources_count += 1;

                        // update taker resources weight
                        taker_gives_resources_weight +=
                            WeightConfigCustomImpl::get_weight_grams(ref world, *resource_type, *resource_amount);

                        taker_gives_resources_felt_arr.append((*resource_type).into());
                        taker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // burn enough maker donkeys to carry resources given by taker
            donkey::burn_donkey(ref world, maker_id, taker_gives_resources_weight);

            // create trade entity
            let trade_id = world.dispatcher.uuid();
            world
                .write_model(
                    @Trade {
                        trade_id,
                        maker_id,
                        maker_gives_resources_id,
                        maker_gives_resources_origin_id: maker_gives_resources_id,
                        maker_gives_resources_hash: hash(maker_gives_resources_felt_arr.span()),
                        maker_gives_resources_weight,
                        taker_id,
                        taker_gives_resources_id,
                        taker_gives_resources_origin_id: taker_gives_resources_id,
                        taker_gives_resources_hash: hash(taker_gives_resources_felt_arr.span()),
                        taker_gives_resources_weight,
                        expires_at,
                    }
                );
            world.write_model(@Status { trade_id: trade_id, value: TradeStatus::OPEN });

            world.emit_event(@CreateOrder { taker_id, maker_id, trade_id, timestamp: starknet::get_block_timestamp() });

            trade_id
        }


        fn accept_order(
            ref self: ContractState,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            mut taker_gives_resources: Span<(u8, u128)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // check that caller is taker
            let caller = starknet::get_caller_address();
            let taker_owner: Owner = world.read_model(taker_id);
            assert(taker_owner.address == caller, 'not owned by caller');

            InternalTradeSystemsImpl::accept_order(
                ref world, taker_id, trade_id, maker_gives_resources, taker_gives_resources
            );
        }


        fn accept_partial_order(
            ref self: ContractState,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            mut taker_gives_resources: Span<(u8, u128)>,
            mut taker_gives_actual_amount: u128
        ) { // Ensure only one resource type is being traded and input lengths match
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            assert!(taker_gives_actual_amount.is_non_zero(), "amount taker gives must be greater than 0");
            assert!(maker_gives_resources.len() == 1, "only one resource type is supported for partial orders");
            assert!(maker_gives_resources.len() == taker_gives_resources.len(), "resources lengths must be equal");

            // Verify caller is the taker
            let caller = starknet::get_caller_address();
            let taker_owner: Owner = world.read_model(taker_id);
            assert(taker_owner.address == caller, 'not owned by caller');
            // Get trade details and status
            let mut trade: Trade = world.read_model(trade_id);
            let trade_status: Status = world.read_model(trade_id);

            // Check trade expiration and taker validity
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            // Ensure trade is open and update status to accepted
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');

            // Extract and verify maker's resource details
            let (maker_gives_resource_type, maker_gives_resource_amount) = maker_gives_resources.pop_front().unwrap();
            let maker_gives_resource_type = *maker_gives_resource_type;
            let maker_gives_resource_amount = *maker_gives_resource_amount;
            assert!(maker_gives_resource_amount > 0, "trade is closed (1)");
            let maker_gives_resources_felt_arr: Array<felt252> = array![
                maker_gives_resource_type.into(), maker_gives_resource_amount.into()
            ];
            let maker_gives_resources_hash = hash(maker_gives_resources_felt_arr.span());
            assert!(
                maker_gives_resources_hash == trade.maker_gives_resources_hash, "wrong maker_gives_resources provided"
            );

            // Extract and verify taker's resource details
            let (taker_gives_resource_type, taker_gives_resource_amount) = taker_gives_resources.pop_front().unwrap();
            let taker_gives_resource_type = *taker_gives_resource_type;
            let taker_gives_resource_amount = *taker_gives_resource_amount;
            assert!(taker_gives_resource_amount > 0, "trade is closed (2)");
            let taker_gives_resources_felt_arr: Array<felt252> = array![
                taker_gives_resource_type.into(), taker_gives_resource_amount.into()
            ];
            let taker_gives_resources_hash = hash(taker_gives_resources_felt_arr.span());
            assert!(
                taker_gives_resources_hash == trade.taker_gives_resources_hash, "wrong taker_gives_resources provided"
            );
            // Calculate actual transfer amounts and weights
            let maker_gives_actual_amount = maker_gives_resource_amount
                * taker_gives_actual_amount
                / taker_gives_resource_amount;
            let maker_gives_resources_actual = array![(maker_gives_resource_type, maker_gives_actual_amount)].span();
            let maker_gives_resources_actual_weight = WeightConfigCustomImpl::get_weight_grams(
                ref world, maker_gives_resource_type, maker_gives_actual_amount
            );
            let taker_gives_resources_actual = array![(taker_gives_resource_type, taker_gives_actual_amount)].span();
            let taker_gives_resources_actual_weight = WeightConfigCustomImpl::get_weight_grams(
                ref world, taker_gives_resource_type, taker_gives_actual_amount
            );

            if maker_gives_actual_amount == maker_gives_resource_amount {
                InternalTradeSystemsImpl::accept_order(
                    ref world, taker_id, trade_id, maker_gives_resources_actual, taker_gives_resources_actual
                );
            } else {
                // create new order

                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///
                let new_maker_gives_resources = array![(maker_gives_resource_type, maker_gives_actual_amount)].span();
                let new_maker_gives_resources_felt_arr = array![
                    maker_gives_resource_type.into(), maker_gives_actual_amount.into()
                ];
                let new_taker_gives_resources = array![(taker_gives_resource_type, taker_gives_actual_amount)].span();
                let new_taker_gives_resources_felt_arr = array![
                    taker_gives_resource_type.into(), taker_gives_actual_amount.into()
                ];
                let new_maker_gives_resources_felt_arr_id: ID = world.dispatcher.uuid();
                let new_taker_gives_resources_felt_arr_id: ID = world.dispatcher.uuid();
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: new_maker_gives_resources_felt_arr_id,
                            index: 0,
                            resource_type: maker_gives_resource_type,
                            resource_amount: maker_gives_actual_amount
                        },
                    );
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: new_taker_gives_resources_felt_arr_id,
                            index: 0,
                            resource_type: taker_gives_resource_type,
                            resource_amount: taker_gives_actual_amount
                        }
                    );

                let new_trade_id = world.dispatcher.uuid();
                world
                    .write_model(
                        @Trade {
                            trade_id: new_trade_id,
                            maker_id: trade.maker_id,
                            maker_gives_resources_origin_id: trade.maker_gives_resources_origin_id,
                            maker_gives_resources_id: new_maker_gives_resources_felt_arr_id,
                            maker_gives_resources_hash: hash(new_maker_gives_resources_felt_arr.span()),
                            maker_gives_resources_weight: maker_gives_resources_actual_weight,
                            taker_id: trade.taker_id,
                            taker_gives_resources_origin_id: trade.taker_gives_resources_origin_id,
                            taker_gives_resources_id: new_taker_gives_resources_felt_arr_id,
                            taker_gives_resources_hash: hash(new_taker_gives_resources_felt_arr.span()),
                            taker_gives_resources_weight: taker_gives_resources_actual_weight,
                            expires_at: trade.expires_at,
                        },
                    );
                world.write_model(@Status { trade_id: new_trade_id, value: TradeStatus::OPEN });

                // accept new order
                InternalTradeSystemsImpl::accept_order(
                    ref world, taker_id, new_trade_id, new_maker_gives_resources, new_taker_gives_resources
                );

                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////
                ///////////////////////////////////////////////////////////////////////

                // Calculate remaining amounts and update trade details
                let maker_amount_left = maker_gives_resource_amount - maker_gives_actual_amount;
                let taker_amount_left = taker_gives_resource_amount - taker_gives_actual_amount;
                trade
                    .maker_gives_resources_hash =
                        hash(array![maker_gives_resource_type.into(), maker_amount_left.into()].span());
                trade
                    .taker_gives_resources_hash =
                        hash(array![taker_gives_resource_type.into(), taker_amount_left.into()].span());
                trade.maker_gives_resources_weight -= maker_gives_resources_actual_weight;
                trade.taker_gives_resources_weight -= taker_gives_resources_actual_weight;
                trade.maker_gives_resources_id = world.dispatcher.uuid();
                trade.taker_gives_resources_id = world.dispatcher.uuid();
                // Update detached resources for maker and taker
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: trade.maker_gives_resources_id,
                            index: 0,
                            resource_type: maker_gives_resource_type,
                            resource_amount: maker_amount_left
                        }
                    );
                world
                    .write_model(
                        @DetachedResource {
                            entity_id: trade.taker_gives_resources_id,
                            index: 0,
                            resource_type: taker_gives_resource_type,
                            resource_amount: taker_amount_left
                        }
                    );

                // Save updated trade
                world.write_model(@trade);
            }
        }


        fn cancel_order(ref self: ContractState, trade_id: ID, mut return_resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let trade: Trade = world.read_model(trade_id);
            let trade_status: Status = world.read_model(trade_id);
            let owner: Owner = world.read_model(trade.maker_id);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, 0, trade.maker_id, return_resources, 0, false, false
            );

            assert!(
                maker_receives_resources_hash == trade.maker_gives_resources_hash, "wrong return resources provided"
            );

            // return donkeys to maker
            donkey::return_donkey(ref world, trade.maker_id, trade.taker_gives_resources_weight);

            world.write_model(@Status { trade_id, value: TradeStatus::CANCELLED });

            world
                .emit_event(
                    @CancelOrder {
                        taker_id: trade.taker_id,
                        maker_id: trade.maker_id,
                        trade_id,
                        timestamp: starknet::get_block_timestamp()
                    }
                );
        }
    }


    #[generate_trait]
    impl InternalTradeSystemsImpl of InternalTradeSystemsTrait {
        fn accept_order(
            ref world: WorldStorage,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            mut taker_gives_resources: Span<(u8, u128)>
        ) {
            let mut trade: Trade = world.read_model(trade_id);
            let trade_status: Status = world.read_model(trade_id);

            // check trade expiration
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');

            // verify taker if it's a direct offer
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            // update trade
            trade.taker_id = taker_id;
            world.write_model(@trade);

            // check and update trade status
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');
            world.write_model(@Status { trade_id, value: TradeStatus::ACCEPTED });

            let (_, taker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, trade.maker_id, trade.taker_id, maker_gives_resources, trade.taker_id, true, false
            );
            assert!(
                taker_receives_resources_hash == trade.maker_gives_resources_hash,
                "wrong maker_gives_resources provided"
            );

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                ref world, trade.taker_id, trade.maker_id, taker_gives_resources, trade.maker_id, false, true
            );

            assert!(
                maker_receives_resources_hash == trade.taker_gives_resources_hash,
                "wrong taker_gives_resources provided"
            );

            world
                .emit_event(
                    @AcceptOrder {
                        id: world.dispatcher.uuid(),
                        taker_id,
                        maker_id: trade.maker_id,
                        trade_id,
                        timestamp: starknet::get_block_timestamp()
                    }
                );
        }
    }
}
