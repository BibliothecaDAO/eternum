#[dojo::contract]
mod trade_systems {
    use eternum::alias::ID;

    use eternum::models::resources::Resource;
    use eternum::models::caravan::{Caravan, CaravanBurden};
    use eternum::models::resources::{Burden, BurdenResource};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionTrait};
    use eternum::models::realm::Realm;
    use eternum::models::trade::{Trade, Status, TradeStatus};
    use eternum::models::capacity::Capacity;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::road::{Road, RoadTrait, RoadImpl};
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::config::WeightConfig;
    use eternum::models::config::RoadConfig;
    use eternum::models::quantity::{
        Quantity, QuantityTrait, QuantityTracker
    };

    use eternum::systems::resources::contracts::resource_systems::InternalBurdenImpl;
    use eternum::systems::trade::interface::trade_systems_interface::{
        ITradeSystems, ITradeCaravanSystems
    };

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use core::poseidon::poseidon_hash_span;


    #[external(v0)]
    impl TradeSystemsImpl of ITradeSystems<ContractState> {

        fn create_order(
            self: @ContractState,
            world: IWorldDispatcher,
            seller_id: u128,
            seller_resource_types: Span<u8>,
            seller_resource_amounts: Span<u128>,
            seller_caravan_id: ID,
            buyer_id: u128,
            buyer_resource_types: Span<u8>,
            buyer_resource_amounts: Span<u128>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let seller_owner = get!(world, seller_id, Owner);
            assert(seller_owner.address == caller, 'Only owner can create order');

            // create burden that buyer will collect
            let buyer_collects_burden 
                = InternalBurdenImpl::bundle(
                    world, seller_id, Zeroable::zero(),
                    seller_resource_types, seller_resource_amounts
                    );

            // create burden that seller will collect
            let seller_collects_burden 
                = InternalBurdenImpl::bundle(
                    world, Zeroable::zero(), Zeroable::zero(),
                    buyer_resource_types, buyer_resource_amounts
                    );

            // attach burden to seller's caravan 
            TradeCaravanHelpersImpl::attach(
                world, seller_id, seller_caravan_id, seller_collects_burden
                );


            // create trade entity
            let trade_id = world.uuid().into();
            set!(world,(
                    Trade {
                        trade_id,
                        seller_id,
                        seller_collects_burden_id: seller_collects_burden.burden_id,
                        seller_caravan_id,
                        buyer_id,
                        buyer_collects_burden_id: buyer_collects_burden.burden_id,
                        buyer_caravan_id: 0,
                        expires_at: expires_at,
                    },
                    Status {
                        trade_id: trade_id,
                        value: TradeStatus::OPEN,
                    }
                ),
            );

            trade_id
        }







        fn accept_order(
            self: @ContractState, world: IWorldDispatcher,
            buyer_id: u128, buyer_caravan_id: u128, trade_id: u128
        ) {
            // check that caller is buyer
            let caller = starknet::get_caller_address();
            let owner = get!(world, buyer_id, Owner);
            assert(owner.address == caller, 'not owned by caller');


            let trade_status = get!(world, trade_id, Status);
            let mut trade_meta = get!(world, trade_id, Trade);

            // check trade expiration and status
            let ts = starknet::get_block_timestamp();
            assert(trade_meta.expires_at > ts, 'trade expired');
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');


            // if it's a direct offer, verify that its the correct buyer 
            if trade_meta.buyer_id != 0 {
                assert(trade_meta.buyer_id == buyer_id, 'not the buyer');
            } 

            // attach burden to buyer's caravan 
            let buyer_collects_burden = get!(world, trade_meta.buyer_collects_burden_id, Burden);
            TradeCaravanHelpersImpl::attach(
                world, buyer_id, buyer_caravan_id, buyer_collects_burden
                );

           // remove traded resources from the buyer's balance 
            let mut seller_collects_burden = get!(world, trade_meta.seller_collects_burden_id, Burden);
            InternalBurdenImpl::make_deposit(world, buyer_id, seller_collects_burden);


            // update trade meta and status
            trade_meta.buyer_id = buyer_id;
            trade_meta.buyer_caravan_id = buyer_caravan_id;
            set!(world, (trade_meta));
            set!(world, (
                    Status {
                        trade_id,
                        value: TradeStatus::ACCEPTED,
                    }
                ),
            );


            // calculate trip time
            let buyer_position = get!(world, buyer_id, Position);
            let seller_position = get!(world, trade_meta.seller_id, Position);
            let (seller_caravan_movable, seller_caravan_position) 
                = get!(world, trade_meta.seller_caravan_id, (Movable, Position));
            let one_way_trip_time 
                = seller_caravan_position.calculate_travel_time(
                    buyer_position, seller_caravan_movable.sec_per_km
                    );
            let mut round_trip_time: u64 = 2 * one_way_trip_time;
            // reduce round trip time if there is a road
            RoadImpl::use_road(
                 world, round_trip_time, seller_caravan_position.into(), buyer_position.into()
                );


            set!(world, (
                    ArrivalTime {
                        entity_id: trade_meta.seller_collects_burden_id,
                        arrives_at: ts + round_trip_time
                    },
                    Position {
                        entity_id: trade_meta.seller_collects_burden_id,
                        x: seller_position.x,
                        y: seller_position.y,
                    },
                    ArrivalTime {
                        entity_id: trade_meta.seller_caravan_id,
                        arrives_at: ts + round_trip_time
                    },
                    Position {
                        entity_id: trade_meta.seller_caravan_id,
                        x: seller_position.x,
                        y: seller_position.y,
                    },
            ));

            set!(world, (
                    ArrivalTime {
                        entity_id: trade_meta.buyer_collects_burden_id,
                        arrives_at: ts + round_trip_time
                    },
                    Position {
                        entity_id: trade_meta.buyer_collects_burden_id,
                        x: buyer_position.x,
                        y: buyer_position.y,
                    },
                    ArrivalTime {
                        entity_id: trade_meta.buyer_caravan_id,
                        arrives_at: ts + round_trip_time
                    },
                    Position {
                        entity_id: trade_meta.buyer_caravan_id,
                        x: buyer_position.x,
                        y: buyer_position.y,
                    }
            ));
        }


        fn cancel_order(self: @ContractState, world: IWorldDispatcher, trade_id: u128) {

            let (trade_meta, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade_meta.seller_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade seller');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            // return resources to seller
            let seller_collects_burden 
                = get!(world, trade_meta.seller_collects_burden_id, Burden);
            InternalBurdenImpl::unbundle(world, trade_meta.seller_id, seller_collects_burden);
    
            set!(world, (
                Status { 
                    trade_id, 
                    value: TradeStatus::CANCELLED 
                }
            ));
        }
    }



    #[generate_trait]
    impl TradeCaravanHelpersImpl of TradeCaravanHelpersTrait {

        fn attach(
            world: IWorldDispatcher, entity_id: ID, caravan_id: ID, burden: Burden
            ) {
         
            let caravan_owner = get!(world, caravan_id, Owner);   
            assert(
                caravan_owner.address == starknet::get_caller_address(),
                     'caller not owner of caravan'
            );
            
            let caravan_position = get!(world, caravan_id, Position);
            let entity_position = get!(world, entity_id, Position);
            let burden_position = get!(world, burden.burden_id, Position);

            assert(caravan_position.x == entity_position.x, 'Not same position');
            assert(caravan_position.y == entity_position.y, 'Not same position');

            let caravan_movable = get!(world, caravan_id, Movable);        
            assert(caravan_movable.blocked == false, 'caravan already blocked');

            let caravan_arrival_time = get!(world, caravan_id, ArrivalTime);
            assert(caravan_arrival_time.arrives_at <= starknet::get_block_timestamp(),
                         'caravan is in transit'
            );
     

            // ensure caravan can carry the weight
            let caravan = get!(world, caravan_id, Caravan);
            let caravan_burden_count = caravan.burden_count + 1;
            let caravan_burden_weight = caravan.burden_weight + burden.resources_weight;

            let caravan_capacity = get!(world, caravan_id, Capacity);   
            let caravan_quantity = get!(world, caravan_id, Quantity);
            let caravan_quantity = caravan_quantity.get_value();
            assert(
                caravan_capacity.weight_gram * caravan_quantity >= caravan_burden_weight,
                    'Caravan capacity is not enough'
            );


            set!(world, (
                Caravan {
                    entity_id: caravan_id,
                    burden_count: caravan_burden_count,
                    burden_weight: caravan_burden_weight,
                },
                CaravanBurden {
                    entity_id: caravan_id,
                    index: caravan_burden_count,
                    burden_id: burden.burden_id,
                }
            ));
                     
        }
    }


}