#[dojo::contract]
mod trade_systems {
    use eternum::alias::ID;

    use eternum::models::resources::Resource;
    use eternum::models::resources::{ResourceChest, DetachedResource};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionTrait, Coord, CoordTrait};
    use eternum::models::realm::Realm;
    use eternum::models::weight::Weight;
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

    use eternum::systems::resources::contracts::resource_systems::{
        InternalResourceChestSystemsImpl as resource_chest, 
        InternalInventorySystemsImpl as inventory
    };
    use eternum::systems::transport::contracts::caravan_systems::caravan_systems::{
        InternalCaravanSystemsImpl as caravan
    };
    use eternum::systems::trade::interface::trade_systems_interface::{
        ITradeSystems
    };

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use core::poseidon::poseidon_hash_span;


    #[external(v0)]
    impl TradeSystemsImpl of ITradeSystems<ContractState> {

        fn create_order(
            self: @ContractState,
            world: IWorldDispatcher,
            maker_id: u128,
            maker_gives_resource_types: Span<u8>,
            maker_gives_resource_amounts: Span<u128>,
            maker_transport_id: ID,
            taker_id: u128,
            taker_gives_resource_types: Span<u8>,
            taker_gives_resource_amounts: Span<u128>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let maker_owner = get!(world, maker_id, Owner);
            assert(maker_owner.address == caller, 'caller not maker');

            // check that transport id is valid
            caravan::check_owner(world, maker_transport_id, caller);
            caravan::check_position(world, maker_transport_id, maker_id);
            caravan::check_arrival_time(world, maker_transport_id);
            // block maker transport so it can't be used elsewhere
            caravan::block(world, maker_transport_id);
            

            // create resource chest that maker will collect
            let (maker_resource_chest, maker_resources_weight) 
                = resource_chest::create(
                    world, taker_gives_resource_types, taker_gives_resource_amounts
                );

            // check that maker's transport can carry 
            // the weight of the resource chest, when filled
            caravan::check_capacity(
                world, maker_transport_id, maker_resources_weight
            );
            
            
            // create resource chest that taker will collect
            let (taker_resource_chest, _) 
                = resource_chest::create(
                    world, maker_gives_resource_types, maker_gives_resource_amounts
                );

            // fill the taker's chest with the maker's resources
            resource_chest::fill(
                world, taker_resource_chest.entity_id, maker_id
            );
            

            // create trade entity
            let trade_id = world.uuid().into();
            set!(world,(
                    Trade {
                        trade_id,
                        maker_id,
                        maker_resource_chest_id: maker_resource_chest.entity_id,
                        maker_transport_id,
                        taker_id,
                        taker_resource_chest_id: taker_resource_chest.entity_id,
                        taker_transport_id: 0,
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
            taker_id: u128, taker_transport_id: u128, trade_id: u128
        ) {
            // check that caller is taker
            let caller = starknet::get_caller_address();
            let taker_owner = get!(world, taker_id, Owner);
            assert(taker_owner.address == caller, 'not owned by caller');


            let mut trade = get!(world, trade_id, Trade);
            let trade_status = get!(world, trade_id, Status);

            // check trade expiration and status
            let ts = starknet::get_block_timestamp();
            assert(trade.expires_at > ts, 'trade expired');
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');


            // if it's a direct offer, verify that its the correct taker 
            if trade.taker_id != 0 {
                assert(trade.taker_id == taker_id, 'not the taker');
            }

            let taker_position = get!(world, taker_id, Position);
            let maker_position = get!(world, trade.maker_id, Position);



            if taker_transport_id == 0 {
                ///// when the taker does not provide a transport entity, /////
                ///// it is assumed that the maker and taker are at the   /////
                ///// same location so the trade is completed immediately /////
                ///////////////////////////////////////////////////////////////

                assert(maker_position.x == taker_position.x, 'position mismatch');
                assert(maker_position.y == taker_position.y, 'position mismatch');

                // unblock maker's caravan
                caravan::unblock(world, trade.maker_transport_id);

                // fill the maker's resource chest with the traded items
                resource_chest::fill(
                    world, trade.maker_resource_chest_id, taker_id
                );
                // give traded resources to maker
                resource_chest::offload(
                    world, trade.maker_resource_chest_id, trade.maker_id
                );

                // give traded resources to taker
                resource_chest::offload(
                    world, trade.taker_resource_chest_id, taker_id
                );
                
            } else {
                ///////// What happens when taker uses transport ///////////////
                ////////////////////////////////////////////////////////////////
        
                // check that taker transport id is valid
                caravan::check_owner(world, taker_transport_id, caller);
                caravan::check_position(world, taker_transport_id, taker_id);
                caravan::check_arrival_time(world, taker_transport_id);

                let taker_resource_chest_weight 
                    = get!(world, trade.taker_resource_chest_id, Weight);
                caravan::check_capacity(
                    world, taker_transport_id, taker_resource_chest_weight.value
                );

                // get maker travel time
                let (maker_transport_round_trip_time, maker_transport_one_way_trip_time) 
                    = caravan::get_travel_time(
                        world, trade.maker_transport_id, maker_position, taker_position
                        ); 
            

        
                ///////// Updates For Maker ///////////////
                //////////////////////////////////////////


                // fill the maker's resource chest with the traded items
                resource_chest::fill(
                    world, trade.maker_resource_chest_id, taker_id
                );
                // lock chest until the maker has picked it up
                resource_chest::lock_until(
                    world, trade.maker_resource_chest_id, 
                    ts + maker_transport_one_way_trip_time
                );
                
                // attach maker's resource chest to maker's transport inventory
                inventory::add(
                    world, 
                    trade.maker_transport_id,
                    trade.maker_resource_chest_id
                );

                // unblock maker's caravan
                caravan::unblock(world, trade.maker_transport_id);

                let mut maker_transport_movable = get!(world, trade.maker_transport_id, Movable);
                maker_transport_movable.intermediate_coord_x = taker_position.x;
                maker_transport_movable.intermediate_coord_y = taker_position.y;
                maker_transport_movable.round_trip = true;
                
                set!(world, (maker_transport_movable));
                set!(world, (
                    ArrivalTime {
                        entity_id: trade.maker_transport_id,
                        arrives_at: ts + maker_transport_round_trip_time
                    },
                    Position {
                        entity_id: trade.maker_transport_id,
                        x: maker_position.x,
                        y: maker_position.y,
                    }
                    
                ));


                ///////// Updates For Taker ///////////////
                //////////////////////////////////////////

                // get taker travel time
                let (taker_transport_round_trip_time, taker_transport_one_way_trip_time) 
                    = caravan::get_travel_time(
                        world, taker_transport_id, taker_position, maker_position
                        ); 
                // lock chest until the taker has picked it up
                resource_chest::lock_until(
                    world, trade.taker_resource_chest_id, 
                    ts + taker_transport_one_way_trip_time
                );

                // attach taker's resource chest to taker's transport inventory
                inventory::add(
                    world, 
                    taker_transport_id,
                    trade.taker_resource_chest_id
                );

                let mut taker_transport_movable = get!(world, taker_transport_id, Movable);
                taker_transport_movable.intermediate_coord_x = maker_position.x;
                taker_transport_movable.intermediate_coord_y = maker_position.y;
                taker_transport_movable.round_trip = true;
                
                set!(world, (taker_transport_movable));
                set!(world, (
                    ArrivalTime {
                        entity_id: taker_transport_id,
                        arrives_at: ts + taker_transport_round_trip_time
                    },
                    Position {
                        entity_id: taker_transport_id,
                        x: taker_position.x,
                        y: taker_position.y,
                    }
                ));
            };

    
            

            /////////  Update Trade   ///////////////
            //////////////////////////////////////////

            trade.taker_id = taker_id;
            trade.taker_transport_id = taker_transport_id;
            set!(world, (trade));
            set!(world, (
                    Status {
                        trade_id,
                        value: TradeStatus::ACCEPTED,
                    }
                ),
            );            
        }


        fn cancel_order(self: @ContractState, world: IWorldDispatcher, trade_id: u128) {

            let (trade, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade.maker_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            // return resources to maker
            resource_chest::offload(
                world, trade.taker_resource_chest_id, trade.maker_id
            );
            // unblock maker's caravan
            caravan::unblock(world, trade.maker_transport_id);
    
            set!(world, (
                Status { 
                    trade_id, 
                    value: TradeStatus::CANCELLED 
                }
            ));
        }
    }

}