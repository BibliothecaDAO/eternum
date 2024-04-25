use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ITradeSystems {
    fn create_order(
        maker_id: u128,
        maker_gives_resources: Span<(u8, u128)>,
        taker_id: u128,
        taker_gives_resources: Span<(u8, u128)>,
        expires_at: u64
    ) -> ID;
    fn accept_order(
        taker_id: u128,
        trade_id: u128,
        maker_gives_resources: Span<(u8, u128)>,
        taker_gives_resources: Span<(u8, u128)>
    );
    fn cancel_order(trade_id: u128, return_resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod trade_systems {
    use core::poseidon::poseidon_hash_span as hash;
    use eternum::alias::ID;

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::config::RoadConfig;
    use eternum::models::config::WeightConfig;
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionTrait, Coord, TravelTrait};
    use eternum::models::quantity::{Quantity, QuantityTrait, QuantityTracker};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{DetachedResource};

    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::models::road::{Road, RoadTrait, RoadImpl};
    use eternum::models::trade::{Trade, Status, TradeStatus};
    use eternum::models::weight::{Weight, WeightTrait};
    use eternum::systems::resources::contracts::resource_systems::{
        InternalResourceSystemsImpl as internal_resources,
    };

    use eternum::systems::transport::contracts::donkey_systems::donkey_systems::{
        InternalDonkeySystemsImpl as donkey
    };

    #[derive(Drop, starknet::Event)]
    struct CreateOrder {
        #[key]
        taker_id: u128,
        #[key]
        maker_id: u128,
        trade_id: u128,
        maker_gives_resources: Span<(u8, u128)>,
        taker_gives_resources: Span<(u8, u128)>
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CreateOrder: CreateOrder,
    }


    #[abi(embed_v0)]
    impl TradeSystemsImpl of super::ITradeSystems<ContractState> {
        fn create_order(
            world: IWorldDispatcher,
            maker_id: u128,
            mut maker_gives_resources: Span<(u8, u128)>,
            taker_id: u128,
            mut taker_gives_resources: Span<(u8, u128)>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let maker_owner = get!(world, maker_id, Owner);
            assert(maker_owner.address == caller, 'caller not maker');

            let maker_gives_resources_id: ID = world.uuid().into();
            let mut maker_gives_resources_count: u32 = 0;
            let mut maker_gives_resources_felt_arr: Array<felt252> = array![];
            let mut maker_resources_weight = 0;
            loop {
                match maker_gives_resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        // burn offered resource from maker balance
                        let mut maker_resource: Resource = ResourceImpl::get(
                            world, (maker_id, *resource_type)
                        );
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
                        let resource_weight: WeightConfig = get!(
                            world, (WORLD_CONFIG_ID, *resource_type), WeightConfig
                        );
                        maker_resources_weight += resource_weight.weight_gram * *resource_amount;

                        maker_gives_resources_felt_arr.append((*resource_type).into());
                        maker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // burn the maker donkeys
            let mut maker_donkey_resource = ResourceImpl::get(
                world, (maker_id, ResourceTypes::DONKEY)
            );
            let maker_donkey_amount = donkey::get_donkey_needed(world, maker_resources_weight);
            maker_donkey_resource.burn(maker_donkey_amount);
            maker_donkey_resource.save(world);

            // deduct weight from maker
            let mut maker_weight: Weight = get!(world, maker_id, Weight);
            let mut maker_capacity: Capacity = get!(world, maker_id, Capacity);
            maker_weight.deduct(maker_capacity, maker_resources_weight);
            set!(world, (maker_weight));

            let taker_gives_resources_id: ID = world.uuid().into();
            let mut taker_gives_resources_count: u32 = 0;
            let mut taker_gives_resources_felt_arr: Array<felt252> = array![];
            loop {
                match taker_gives_resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
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

                        taker_gives_resources_felt_arr.append((*resource_type).into());
                        taker_gives_resources_felt_arr.append((*resource_amount).into());
                    },
                    Option::None => { break; }
                }
            };

            // create trade entity
            let trade_id = world.uuid().into();
            set!(
                world,
                (
                    Trade {
                        trade_id,
                        maker_id,
                        maker_gives_resources_id,
                        maker_gives_resources_hash: hash(maker_gives_resources_felt_arr.span()),
                        taker_id,
                        taker_gives_resources_id,
                        taker_gives_resources_hash: hash(taker_gives_resources_felt_arr.span()),
                        expires_at,
                    },
                    Status { trade_id: trade_id, value: TradeStatus::OPEN }
                ),
            );

            emit!(
                world,
                (
                    Event::CreateOrder(
                        CreateOrder {
                            taker_id,
                            maker_id,
                            trade_id,
                            maker_gives_resources,
                            taker_gives_resources
                        }
                    ),
                )
            );

            trade_id
        }


        fn accept_order(
            world: IWorldDispatcher,
            taker_id: u128,
            trade_id: u128,
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
                world, 0, trade.maker_id, trade.taker_id, maker_gives_resources
            );
            assert!(
                taker_receives_resources_hash == trade.maker_gives_resources_hash,
                "wrong maker_gives_resources provided"
            );

            let (_, maker_receives_resources_hash, _) = internal_resources::transfer(
                world, trade.taker_id, trade.taker_id, trade.maker_id, taker_gives_resources
            );

            assert!(
                maker_receives_resources_hash == trade.taker_gives_resources_hash,
                "wrong taker_gives_resources provided"
            );
        }


        fn cancel_order(
            world: IWorldDispatcher, trade_id: u128, mut return_resources: Span<(u8, u128)>,
        ) {
            let (trade, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade.maker_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            let (_, maker_receives_resources_hash, resources_weight) = internal_resources::transfer(
                world, 0, 0, trade.maker_id, return_resources
            );

            assert!(
                maker_receives_resources_hash == trade.maker_gives_resources_hash,
                "wrong return resources provided"
            );

            // return donkeys to maker
            let donkey_amount = donkey::get_donkey_needed(world, resources_weight);
            let mut maker_donkey_resource: Resource = ResourceImpl::get(
                world, (trade.maker_id, ResourceTypes::DONKEY)
            );
            maker_donkey_resource.add(donkey_amount);
            maker_donkey_resource.save(world);

            set!(world, (Status { trade_id, value: TradeStatus::CANCELLED }));
        }
    }
}
