use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ITradeSystems {
    fn create_order(
        ref world: IWorldDispatcher,
        maker_id: ID,
        maker_gives_resources: Span<(u8, u128)>,
        taker_id: ID,
        taker_gives_resources: Span<(u8, u128)>,
        expires_at: u64
    ) -> ID;
    fn accept_order(
        ref world: IWorldDispatcher,
        taker_id: ID,
        trade_id: ID,
        maker_gives_resources: Span<(u8, u128)>,
        taker_gives_resources: Span<(u8, u128)>
    );
    fn cancel_order(ref world: IWorldDispatcher, trade_id: ID, return_resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod trade_systems {
    use core::poseidon::poseidon_hash_span as hash;
    use eternum::alias::ID;

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use eternum::models::capacity::{Capacity, CapacityCustomTrait};
    use eternum::models::config::RoadConfig;
    use eternum::models::config::{WeightConfig, WeightConfigCustomImpl};
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionCustomTrait, Coord, TravelTrait};
    use eternum::models::quantity::{Quantity, QuantityCustomTrait, QuantityTracker};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{DetachedResource};

    use eternum::models::resources::{Resource, ResourceCustomImpl};
    use eternum::models::road::{Road, RoadCustomTrait, RoadCustomImpl};
    use eternum::models::trade::{Trade, Status, TradeStatus};
    use eternum::models::weight::{Weight, WeightCustomTrait};
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl as internal_resources,};

    use eternum::systems::transport::contracts::donkey_systems::donkey_systems::{InternalDonkeySystemsImpl as donkey};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct CreateOrder {
        #[key]
        taker_id: ID,
        #[key]
        maker_id: ID,
        trade_id: ID,
        timestamp: u64
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
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
    #[dojo::event]
    #[dojo::model]
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
            ref world: IWorldDispatcher,
            maker_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            taker_id: ID,
            mut taker_gives_resources: Span<(u8, u128)>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let maker_owner = get!(world, maker_id, Owner);
            assert(maker_owner.address == caller, 'caller not maker');

            let maker_gives_resources_id: ID = world.uuid();
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
                        let mut maker_resource: Resource = ResourceCustomImpl::get(world, (maker_id, *resource_type));
                        maker_resource.burn(*resource_amount);
                        maker_resource.save(world);

                        // save maker's traded resources
                        set!(
                            world,
                            (DetachedResource {
                                entity_id: maker_gives_resources_id,
                                index: maker_gives_resources_count,
                                resource_type: *resource_type,
                                resource_amount: *resource_amount
                            })
                        );

                        maker_gives_resources_count += 1;

                        // update maker resources weight
                        maker_gives_resources_weight +=
                            WeightConfigCustomImpl::get_weight(world, *resource_type, *resource_amount);

                        maker_gives_resources_felt_arr.append((*resource_type).into());
                        maker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // deduct weight from maker
            let mut maker_weight: Weight = get!(world, maker_id, Weight);
            let mut maker_capacity: Capacity = get!(world, maker_id, Capacity);
            maker_weight.deduct(maker_capacity, maker_gives_resources_weight);
            set!(world, (maker_weight));

            let taker_gives_resources_id: ID = world.uuid();
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
                        set!(
                            world,
                            (DetachedResource {
                                entity_id: taker_gives_resources_id,
                                index: taker_gives_resources_count,
                                resource_type: *resource_type,
                                resource_amount: *resource_amount
                            })
                        );

                        taker_gives_resources_count += 1;

                        // update taker resources weight
                        taker_gives_resources_weight +=
                            WeightConfigCustomImpl::get_weight(world, *resource_type, *resource_amount);

                        taker_gives_resources_felt_arr.append((*resource_type).into());
                        taker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // burn enough maker donkeys to carry resources given by taker
            donkey::burn_donkey(world, maker_id, taker_gives_resources_weight);

            // create trade entity
            let trade_id = world.uuid();
            set!(
                world,
                (
                    Trade {
                        trade_id,
                        maker_id,
                        maker_gives_resources_id,
                        maker_gives_resources_hash: hash(maker_gives_resources_felt_arr.span()),
                        maker_gives_resources_weight,
                        taker_id,
                        taker_gives_resources_id,
                        taker_gives_resources_hash: hash(taker_gives_resources_felt_arr.span()),
                        taker_gives_resources_weight,
                        expires_at,
                    },
                    Status { trade_id: trade_id, value: TradeStatus::OPEN }
                ),
            );

            emit!(world, (CreateOrder { taker_id, maker_id, trade_id, timestamp: starknet::get_block_timestamp() }));

            trade_id
        }


        fn accept_order(
            ref world: IWorldDispatcher,
            taker_id: ID,
            trade_id: ID,
            mut maker_gives_resources: Span<(u8, u128)>,
            mut taker_gives_resources: Span<(u8, u128)>
        ) {
            // check that caller is taker
            let caller = starknet::get_caller_address();
            let taker_owner = get!(world, taker_id, Owner);
            assert(taker_owner.address == caller, 'not owned by caller');

            let mut trade = get!(world, trade_id, Trade);
            let trade_status = get!(world, trade_id, Status);

            // check trade expiration
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');

            // verify taker if it's a direct offer
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            // update trade
            trade.taker_id = taker_id;
            set!(world, (trade));

            // check and update trade status
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');
            set!(world, (Status { trade_id, value: TradeStatus::ACCEPTED, }),);

            let (_, taker_receives_resources_hash, _) = internal_resources::transfer(
                world, trade.maker_id, trade.taker_id, maker_gives_resources, trade.taker_id, true, false
            );
            assert!(
                taker_receives_resources_hash == trade.maker_gives_resources_hash,
                "wrong maker_gives_resources provided"
            );

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                world, trade.taker_id, trade.maker_id, taker_gives_resources, trade.maker_id, false, true
            );

            assert!(
                maker_receives_resources_hash == trade.taker_gives_resources_hash,
                "wrong taker_gives_resources provided"
            );

            emit!(
                world,
                (AcceptOrder {
                    id: world.uuid(),
                    taker_id,
                    maker_id: trade.maker_id,
                    trade_id,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }


        fn cancel_order(ref world: IWorldDispatcher, trade_id: ID, mut return_resources: Span<(u8, u128)>,) {
            let (trade, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade.maker_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                world, 0, trade.maker_id, return_resources, 0, false, false
            );

            assert!(
                maker_receives_resources_hash == trade.maker_gives_resources_hash, "wrong return resources provided"
            );

            // return donkeys to maker
            donkey::return_donkey(world, trade.maker_id, trade.taker_gives_resources_weight);

            set!(world, (Status { trade_id, value: TradeStatus::CANCELLED }));

            emit!(
                world,
                (CancelOrder {
                    taker_id: trade.taker_id,
                    maker_id: trade.maker_id,
                    trade_id,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }
    }
}
