#[dojo::contract]
mod trade_systems {
    use eternum::alias::ID;

    use eternum::models::trade::FungibleEntities;
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionTrait};
    use eternum::models::realm::Realm;
    use eternum::models::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::models::capacity::Capacity;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::caravan::Caravan;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::road::{Road, RoadTrait, RoadImpl};
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::config::WeightConfig;
    use eternum::models::config::RoadConfig;
    use eternum::models::quantity::{
        Quantity,QuantityTrait, QuantityTracker
    };
    use eternum::models::trade::OrderId;


    use eternum::systems::trade::interface::trade_systems_interface::{
        ITradeSystems, ITradeCaravanSystems
    };

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};
    use eternum::constants::ROAD_CONFIG_ID;

    use core::poseidon::poseidon_hash_span;


    #[external(v0)]
    impl TradeSystemsImpl of ITradeSystems<ContractState> {
        // creates a non fungible order
        // if taker_id is specified, the order can only be taken by a certain entity
        // if taker_id = 0, then can be taken by any entity


        // TODO: create a function that takes also an array of strings as input, these 
        // strings are names of components that have the {type, balance} fields.
        // Using the name of the component, we can query and set component.

        // maker_id: entity id of the maker
        // maker_entity_types: array of entity types (resources or other) that the maker wants to trade
        // DISCUSS: called entity_types and not resource_types because initial goal is to create a system
        // that is not only for resources but for any other fungible entity type (like coins)
        // maker_quantities: array of quantities of the entity types that the maker wants to trade
        // taker_id: entity id of the taker
        // DISCUSS: if taker_id = 0, then the order can be taken by any entity, is there better way?
        // taker_entity_types: array of entity types (resources or other) that the taker wants to trade
        // taker_quantities: array of quantities of the entity types that the taker wants to trade
        // taker_needs_caravan: if true, the taker needs to send a caravan to the maker
        // expires_at: timestamp when the order expires
        fn create_order(
            self: @ContractState,
            world: IWorldDispatcher,
            maker_id: u128,
            maker_entity_types: Span<u8>,
            maker_quantities: Span<u128>,
            taker_id: u128,
            taker_entity_types: Span<u8>,
            taker_quantities: Span<u128>,
            taker_needs_caravan: bool,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            // assert that maker entity is owned by caller
            let maker_owner = get!(world, maker_id, Owner);
            assert(maker_owner.address == caller, 'Only owner can create order');

            // assert that length of maker_entity_types is equal to length of maker_quantities
            assert(maker_entity_types.len() == maker_quantities.len(), 'length not equal');

            // assert that length of taker_entity_types is equal to length of taker_quantities
            assert(taker_entity_types.len() == taker_quantities.len(), 'length not equal');

            // create maker order entity
            let maker_order_id = world.uuid();
            let fungible_entities_id = world.uuid();
            set!(world,(
                    FungibleEntities {
                        entity_id: maker_order_id.into(), 
                        key: fungible_entities_id.into(), 
                        count: maker_entity_types.len(), 
                    },
                )
            );
            // create maker fungible entities and remove them from the maker balance
            let mut index = 0;
            loop {
                if index == maker_entity_types.len() {
                    break ();
                }

                set!(world,(
                        OrderResource {
                            order_id: maker_order_id.into(), 
                            fungible_entities_id: fungible_entities_id.into(), 
                            index, resource_type: *maker_entity_types[index], 
                            balance: *maker_quantities[index]
                        }
                ));

                // decrease balance of maker
                let resource = get!(world, (maker_id, *maker_entity_types[index]), Resource);
                assert(resource.balance >= *maker_quantities[index], 'Balance too small');
                set!(world,(
                    Resource {
                        entity_id: maker_id,
                        resource_type: *maker_entity_types[index],
                        balance: resource.balance - *maker_quantities[index]
                    },)
                );

                index += 1;
            };

            // create taker order entity
            let taker_order_id = world.uuid();
            set!(world,(
                    FungibleEntities {
                        entity_id: taker_order_id.into(),
                        key: fungible_entities_id.into(), 
                        count: taker_entity_types.len(), 
                    },
                )
            );

            // create taker fungible entities but dont remove them from the taker balance, because 
            // needs to be taken first by a taker
            let mut index = 0;
            loop {
                if index == taker_entity_types.len() {
                    break ();
                }
                set!(world,(
                    OrderResource {
                        order_id: taker_order_id.into(), 
                        fungible_entities_id: fungible_entities_id.into(), 
                        index, 
                        resource_type: *taker_entity_types[index], 
                        balance: *taker_quantities[index] 
                    }
                ));

                index += 1;
            };

            // create trade entity
            let trade_id: ID = world.uuid().into();
            set!(world,(
                    Trade {
                        trade_id: trade_id,
                        maker_id,
                        taker_id,
                        maker_order_id: maker_order_id.into(),
                        taker_order_id: taker_order_id.into(),
                        claimed_by_maker: false,
                        claimed_by_taker: false,
                        expires_at: expires_at,
                        taker_needs_caravan: taker_needs_caravan,
                    }, 
                    Status {
                        // TODO: change back to enum when works with torii
                        trade_id: trade_id,
                        value: 0,
                    }
                ),
            );

            trade_id
        }







        fn accept_order(
            self: @ContractState, world: IWorldDispatcher,
            taker_id: u128, trade_id: u128
        ) {
            // get the trade 
            let (trade_meta, trade_status) = get!(world, trade_id, (Trade, Status));

            // verify expiration date
            let ts = starknet::get_block_timestamp();
            assert(trade_meta.expires_at > ts, 'trade expired');

            // assert that the status is open
            // TODO: change back to enum when works with torii
            let is_open = if (trade_status.value == 0) {
                true
            } else {
                false
            };
            assert(is_open, 'Trade is not open');

            // assert that taker entity is owned by caller
            let caller = starknet::get_caller_address();
            let owner = get!(world, taker_id, Owner);
            assert(owner.address == caller, 'not owned by caller');

            // if taker_entity in trade_meta is 0, then set the taker_id
            if trade_meta.taker_id == 0 {
                set!(world, (
                        Status {
                            trade_id,
                            value: 1
                        }, 
                        Trade {
                            trade_id,
                            maker_id: trade_meta.maker_id,
                            taker_id,
                            maker_order_id: trade_meta.maker_order_id,
                            taker_order_id: trade_meta.taker_order_id,
                            expires_at: trade_meta.expires_at,
                            claimed_by_maker: trade_meta.claimed_by_maker,
                            claimed_by_taker: trade_meta.claimed_by_taker,
                            taker_needs_caravan: trade_meta.taker_needs_caravan,
                        }
                ));
            } else {
                // if not 0, then verify if the taker_id is the one specified
                // then set the status as accepted
                assert(trade_meta.taker_id == taker_id, 'not the taker');
                set!(world, (Status { trade_id, value: 1 }, ));
            };

            // caravan only needed if both are not on the same position
            // get the maker position
            let maker_position = get!(world, trade_meta.maker_id, Position);
            let taker_position = get!(world, taker_id, Position);

            // check if there is a caravan attached to the maker
            let caravan_key_arr = array![trade_meta.maker_order_id.into(), trade_meta.maker_id.into()];
            let caravan_key = poseidon_hash_span(caravan_key_arr.span());
            let caravan = get!(world, caravan_key, Caravan);

            // if caravan id is not 0, it means there is a caravan
            if (caravan.caravan_id != 0) {
                let (movable, caravan_position) = get!(
                    world, caravan.caravan_id, (Movable, Position)
                );
                let travel_time = caravan_position
                    .calculate_travel_time(taker_position, movable.sec_per_km);

                let mut taker_order_travel_time: u64 = travel_time;  
                let mut maker_caravan_travel_time: u64 = 2 * travel_time; // 2x because of round trip (to taker and back)
                    
                // if a road exists, use it and get new travel time 
                let mut road: Road = RoadImpl::get(world, caravan_position.into(), taker_position.into());
                if road.usage_count > 0 {
                    let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);
                    
                    road.usage_count -= 1;
                    set!(world, (road));

                    taker_order_travel_time /= road_config.speed_up_by;
                    maker_caravan_travel_time /= road_config.speed_up_by; 
                }

                // SET ORDER
                set!(world, (
                        ArrivalTime {
                            entity_id: trade_meta.maker_order_id,
                            arrives_at: ts + taker_order_travel_time
                        }, 
                        Position {
                            entity_id: trade_meta.maker_order_id,
                            x: taker_position.x, 
                            y: taker_position.y
                        },
                    )
                );

                // SET CARAVAN
                // round trip with the caravan
                // dont change position because round trip
                // set back blocked to false
                set!(world, (
                        ArrivalTime {
                            entity_id: caravan.caravan_id,
                            arrives_at: ts + maker_caravan_travel_time
                        },
                        Movable {
                            entity_id: caravan.caravan_id,
                            sec_per_km: movable.sec_per_km, 
                            blocked: false, 
                        },
                    )
                );
            // no caravan = no travel
            } else {
                // SET ORDER
                set!(world, (
                        ArrivalTime {
                            entity_id: trade_meta.maker_order_id,
                            arrives_at: ts
                        }, 
                        Position {
                            entity_id: trade_meta.maker_order_id,
                            x: maker_position.x, 
                            y: maker_position.y
                        },
                    )
                );
            }

            // check if there is a caravan attached to the taker if needed
            //
            // taker caravan is not directly attached to the taker_order_id, but to the
            // (taker_order_id, taker_id), this is because more than one taker can attach a caravan to the same order
            // before one of them accepts it
            if trade_meta.taker_needs_caravan == true {
                let caravan_key_arr = array![trade_meta.taker_order_id.into(), taker_id.into()];
                let caravan_key = poseidon_hash_span(caravan_key_arr.span());
                let caravan = get!(world, caravan_key, Caravan);

                let (movable, caravan_position, owner) = get!(
                    world, caravan.caravan_id, (Movable, Position, Owner)
                );
                
                // assert that the owner of the caravan is the caller
                assert(owner.address == caller, 'not owned by caller');

                // if caravan, starts from the caravan position (not taker position)
                let travel_time = caravan_position
                    .calculate_travel_time(maker_position, movable.sec_per_km);

                let mut maker_order_travel_time: u64 = travel_time;  
                let mut taker_caravan_travel_time: u64= 2 * travel_time; // 2x because of round trip (to maker and back)
                    
                // if a road exists, use it and get new travel time 
                let mut road: Road = RoadImpl::get(world, caravan_position.into(), maker_position.into());
                if road.usage_count > 0 {
                    let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);
                    
                    road.usage_count -= 1;
                    set!(world, (road));


                    maker_order_travel_time /= road_config.speed_up_by;
                    taker_caravan_travel_time /= road_config.speed_up_by; 
                }

                // SET ORDER
                set!(world, (
                        ArrivalTime {
                            entity_id: trade_meta.taker_order_id,
                            arrives_at: ts + maker_order_travel_time
                        }, 
                        Position {
                            entity_id: trade_meta.taker_order_id,
                            x: maker_position.x, 
                            y: maker_position.y
                        },
                    )
                );

                // SET CARAVAN
                // set arrival time * 2
                // dont change position because round trip
                // set back blocked to false
                set!(world, (
                        ArrivalTime {
                            entity_id: caravan.caravan_id,
                            arrives_at: ts + taker_caravan_travel_time
                        }, 
                        Movable {
                            entity_id: caravan.caravan_id,
                            sec_per_km: movable.sec_per_km, 
                            blocked: false, 
                        },
                    )
                );
            } else {
                // dont travel
                set!(world, (
                        ArrivalTime {
                            entity_id: trade_meta.taker_order_id,
                            arrives_at: ts
                        }, 
                        Position {
                            entity_id: trade_meta.taker_order_id,
                            x: taker_position.x, 
                            y: taker_position.y
                        }
                    ),
                );
            };

            // remove fungible entities from the taker balance
            let mut index = 0;
            let fungible_entities = get!(world, trade_meta.taker_order_id, FungibleEntities);
            loop {
                if index == fungible_entities.count {
                    break ();
                };
                let order_resource = get!(
                    world, (trade_meta.taker_order_id, fungible_entities.key, index), OrderResource
                );

                // remove the quantity from the taker balance
                let taker_resource = get!(
                    world, (taker_id, order_resource.resource_type), Resource
                );

                // assert has enough
                assert(taker_resource.balance >= order_resource.balance, 'not enough balance');
                    
                // remove the quantity from the taker balance
                set!(world,( 
                    Resource {
                        entity_id: taker_id, 
                        resource_type: order_resource.resource_type, 
                        balance: taker_resource.balance - order_resource.balance
                    })
                );
                index += 1;
            };
        }




        fn claim_order(
            self: @ContractState, world: IWorldDispatcher,
            entity_id: u128, trade_id: u128
        ) {

            // assert caller is owner of the entity_id
            let caller = starknet::get_caller_address();    
            let owner = get!(world, entity_id, Owner);
            assert(owner.address == caller, 'not owned by caller');

            let trade_meta = get!(world, trade_id, Trade);

            // check if entity is maker or taker
            // if taker then query maker order id
            // if maker then query taker order id
            let mut order_id = 0;
            let mut claimed_by_maker = trade_meta.claimed_by_maker;
            let mut claimed_by_taker = trade_meta.claimed_by_taker;

            let order_id = if (entity_id == trade_meta.maker_id) {
                // caller is the maker so need the taker order
                assert(!claimed_by_maker, 'already claimed by maker');
                claimed_by_maker = true;
                trade_meta.taker_order_id
            } else {
                // assert caller is the taker
                assert(entity_id == trade_meta.taker_id, 'Caller is not maker nor taker');
                assert(!claimed_by_taker, 'already claimed by taker');
                claimed_by_taker = true;
                trade_meta.maker_order_id
            };

            set!(world,(
                Trade {
                    trade_id,
                    maker_id: trade_meta.maker_id,
                    taker_id: trade_meta.taker_id,
                    maker_order_id: trade_meta.maker_order_id,
                    taker_order_id: trade_meta.taker_order_id,
                    expires_at: trade_meta.expires_at,
                    claimed_by_maker,
                    claimed_by_taker,
                    taker_needs_caravan: trade_meta.taker_needs_caravan,
                }
            ));

            // check position and arrival time
            let (position, arrival_time, fungible_entities) = get!(
                world, order_id, (Position, ArrivalTime, FungibleEntities)
            );
            // assert that position is same as entity
            let entity_position = get!(world, entity_id, Position);
            // TODO: test out position equality
            assert(position.x == entity_position.x, 'position mismatch');
            assert(position.y == entity_position.y, 'position mismatch');

            let ts = starknet::get_block_timestamp();

            // assert that arrival time < current time 
            assert(arrival_time.arrives_at <= ts, 'not yet arrived');

            // loop over fungible entities and add to balance of entity
            let mut index = 0;
            loop {
                if index == fungible_entities.count {
                    break ();
                }

                let order_resource = get!(
                    world, (order_id, fungible_entities.key, index), OrderResource
                );

                // add quantity to balance of entity
                let current_resource = get!(
                    world, (entity_id, order_resource.resource_type), Resource
                );
                set!(world, (
                    Resource {
                        entity_id, 
                        resource_type: order_resource.resource_type,
                        balance: current_resource.balance + order_resource.balance,
                    }
                ));
                index += 1;
            }
        }





        fn cancel_order(self: @ContractState, world: IWorldDispatcher, trade_id: u128) {

            let (trade_meta, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade_meta.maker_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            // return resources back to maker
            let fungible_entites = get!(world, trade_meta.maker_order_id, FungibleEntities);
        
            let mut index = 0;
            loop {
                if index == fungible_entites.count {
                    break ();
                }
                let order_resource 
                    = get!(world,(trade_meta.maker_order_id, fungible_entites.key, index), OrderResource);
                let resource = get!(world, (trade_meta.maker_id, order_resource.resource_type), Resource);
                set!(world, ( 
                    Resource {
                        entity_id: trade_meta.maker_id,
                        resource_type: order_resource.resource_type,
                        balance: resource.balance + order_resource.balance,
                    }
                ));
                index += 1;
            };
    
            let maker_caravan 
                = TradeCaravanHelpersImpl::get(world, trade_meta.maker_order_id, trade_meta.maker_id);
            if  maker_caravan.caravan_id != 0 {
                TradeCaravanHelpersImpl::detach(world, maker_caravan);
            }

            let taker_caravan 
                = TradeCaravanHelpersImpl::get(world, trade_meta.taker_order_id, trade_meta.taker_id);
            if  taker_caravan.caravan_id != 0 {
                TradeCaravanHelpersImpl::detach(world, taker_caravan);
            }
            
            // cancel order
            set!(world, (
                Status { 
                    trade_id, 
                    value: TradeStatus::CANCELLED 
                }
            ));
        }
    }


    #[external(v0)]
    impl TradeCaravanSystemsImpl of ITradeCaravanSystems<ContractState> {

        fn attach_caravan(
            self: @ContractState, world: IWorldDispatcher,
            entity_id: u128, trade_id: u128, caravan_id: u128
        ) {
            let caller = starknet::get_caller_address();

            // get trade info
            let (trade_meta, trade_status) = get!(world, trade_id, (Trade, Status));

            // assert that caller is the owner of entity_id
            let (owner, position) = get!(world, entity_id, (Owner, Position));
            assert(owner.address == caller, 'Caller not owner of entity_id');

            // assert that the status is open
            // TODO: change back to enum when works with torii 
            let is_open = if (trade_status.value == 0) {
                true
            } else if (trade_status.value == 1) {
                false
            } else {
                false
            };
            assert(is_open, 'Trade is not open');

            let order_id = if (entity_id == trade_meta.maker_id) {
                // caller is the maker
                trade_meta.maker_order_id
            } else if trade_meta.taker_id == 0 {
                // no taker specified, caller can be taker
                trade_meta.taker_order_id
            } else {
                // caller is neither the maker nor the taker
                assert(entity_id == trade_meta.taker_id, 'Caller is not maker nor taker');
                trade_meta.taker_order_id
            };

            // get the fungible entities from the order
            let fungible_entities = get!(world, order_id, FungibleEntities);

            let mut total_weight = 0;
            let mut index = 0;
            // loop over all the fungible entities and get their quantity and weight
            loop {
                if index == fungible_entities.count {
                    break ();
                }

                // get quantity and entity_type from fungible_entities
                let order_resource = get!(
                    world, (order_id, fungible_entities.key, index), OrderResource
                );

                let entity_type_weight = get!(
                    world, (WORLD_CONFIG_ID, order_resource.resource_type), WeightConfig
                );

                let weight = entity_type_weight.weight_gram * order_resource.balance;
                total_weight += weight;
                index += 1;
            };

            // get the caravan capacity, movable and owner
            // get quantity as well, if quantity not present then it's 1
            let (caravan_capacity, caravan_owner, caravan_position) = get!(
                world, caravan_id, (Capacity, Owner, Position)
            );


            let quantity = get!(world, caravan_id, Quantity);
            let quantity = quantity.get_value();

            // assert that the caravan position is the same as the entity
            assert(caravan_position.x == position.x, 'Not same position');
            assert(caravan_position.y == position.y, 'Not same position');

            // assert that the owner if the caller
            assert(caravan_owner.address == caller, 'Caller not owner of caravan');

            // assert that the caravan can move the total weight
            assert(
                caravan_capacity.weight_gram * quantity >= total_weight, 
                    'Caravan capacity is not enough'
            );

            TradeCaravanHelpersImpl::attach(world, caravan_id, order_id, entity_id);
        
        }
    }




    #[generate_trait]
    impl TradeCaravanHelpersImpl of TradeCaravanHelpersTrait {

        #[inline(always)]
        fn get(world: IWorldDispatcher, order_id: ID, owner_id: ID) -> Caravan  {
            let caravan_key_arr = array![order_id.into(), owner_id.into()];
            let caravan_key = poseidon_hash_span(caravan_key_arr.span());

            get!(world, caravan_key, Caravan)
        }


        #[inline(always)]
        fn detach(world: IWorldDispatcher, caravan: Caravan){
            
            assert(caravan.caravan_id != 0, 'caravan not attached');

            let caravan_movable = get!(world, caravan.caravan_id, Movable);        
            assert(caravan_movable.blocked, 'caravan should be blocked');

            set!(world, (
                OrderId { 
                    entity_id: caravan.caravan_id, 
                    id: 0_u128
                }, 
                Movable { 
                    entity_id: caravan.caravan_id, 
                    sec_per_km: caravan_movable.sec_per_km, 
                    blocked: false
                }
            ));

            set!(world, (
                Caravan { 
                    entity_id: caravan.entity_id, 
                    caravan_id: 0_u128
                }
            ));
        }



        fn attach(world: IWorldDispatcher, caravan_id: ID, order_id: ID, owner_id: ID) {
                    
            let caravan = TradeCaravanHelpersImpl::get(world, order_id, owner_id);
            assert(caravan.caravan_id == 0, 'caravan already attached');

            let caravan_movable = get!(world, caravan_id, Movable);        
            assert(caravan_movable.blocked == false, 'caravan already blocked');

            //q: should we check if caravan is attached to another order?
            set!(world, (
                OrderId { 
                    entity_id: caravan_id, 
                    id: order_id 
                }, 
                Movable { 
                    entity_id: caravan_id, 
                    sec_per_km: caravan_movable.sec_per_km, 
                    blocked: true 
                })
            );

            set!(world, (
                Caravan { 
                    entity_id: caravan.entity_id, 
                    caravan_id
                }
            ));

        }


    }


}