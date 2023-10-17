#[dojo::contract]
mod trade_systems {
    use eternum::alias::ID;

    use eternum::models::trade::FungibleEntities;
    use eternum::models::resources::Resource;
    use eternum::models::trade::{Delivery, DeliveryResource};
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
        // if buyer_id is specified, the order can only be taken by a certain entity
        // if buyer_id = 0, then can be taken by any entity


        // TODO: create a function that takes also an array of strings as input, these 
        // strings are names of components that have the {type, balance} fields.
        // Using the name of the component, we can query and set component.

        // seller_id: entity id of the seller
        // seller_entity_types: array of entity types (resources or other) that the seller wants to trade
        // DISCUSS: called entity_types and not resource_types because initial goal is to create a system
        // that is not only for resources but for any other fungible entity type (like coins)
        // seller_quantities: array of quantities of the entity types that the seller wants to trade
        // buyer_id: entity id of the buyer
        // DISCUSS: if buyer_id = 0, then the order can be taken by any entity, is there better way?
        // buyer_entity_types: array of entity types (resources or other) that the buyer wants to trade
        // buyer_quantities: array of quantities of the entity types that the buyer wants to trade
        // buyer_needs_caravan: if true, the buyer needs to send a caravan to the seller
        // expires_at: timestamp when the order expires
        fn create_order(
            self: @ContractState,
            world: IWorldDispatcher,
            seller_id: u128,
            seller_entity_types: Span<u8>,
            seller_quantities: Span<u128>,
            seller_caravan_id: ID,
            buyer_id: u128,
            buyer_entity_types: Span<u8>,
            buyer_quantities: Span<u128>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let seller_owner = get!(world, seller_id, Owner);
            assert(seller_owner.address == caller, 'Only owner can create order');

            assert(seller_entity_types.len() == seller_quantities.len(), 'length not equal');
            assert(buyer_entity_types.len() == buyer_quantities.len(), 'length not equal');

            // create buyer delivery 

            let buyer_delivery_id = world.uuid().into();

            // add buyer delivery resources and remove 
            // resources up for sale from seller's balance
            let mut index = 0;
            let mut sold_resources_weight = 0;
            loop {
                if index == seller_entity_types.len() {
                    break ();
                }
                let sold_resource_type = *seller_entity_types[index];
                let sold_resource_amount = *seller_quantities[index];

                set!(world,(
                        DeliveryResource {
                            delivery_id: buyer_delivery_id,
                            index: index,
                            resource_type: sold_resource_type,
                            resource_amount: sold_resource_amount
                        }
                ));

                // decrease balance of seller
                let resource = get!(world, (seller_id, sold_resource_type), Resource);
                assert(resource.balance >= sold_resource_amount, 'Balance too small');
                set!(world,(
                    Resource {
                        entity_id: seller_id,
                        resource_type: sold_resource_type,
                        balance: resource.balance - sold_resource_amount
                    },)
                );


                // update resources total weight
                let resource_type_weight 
                    = get!(world, (WORLD_CONFIG_ID, sold_resource_type), WeightConfig);
                sold_resources_weight += resource_type_weight.weight_gram * sold_resource_amount;

                index += 1;
            };


            set!(world,(
                    Delivery {
                        delivery_id: buyer_delivery_id,
                        from_entity_id: seller_id,
                        to_entity_id: buyer_id,
                        resources_count: seller_entity_types.len(),
                        resources_weight: sold_resources_weight
                    }
                )
            );


            // create seller delivery

            let seller_delivery_id = world.uuid().into();

            // add seller delivery resources
            let mut index = 0;
            let mut bought_resources_weight = 0;
            loop {
                if index == buyer_entity_types.len() {
                    break ();
                }

                let bought_resource_type = *buyer_entity_types[index];
                let bought_resource_amount = *buyer_quantities[index];

                set!(world,(
                    DeliveryResource {
                        delivery_id: seller_delivery_id,
                        index: index,
                        resource_type: bought_resource_type,
                        resource_amount: bought_resource_amount
                    }
                ));

                // update resources total weight
                let resource_type_weight 
                    = get!(world, (WORLD_CONFIG_ID, bought_resource_type), WeightConfig);
                bought_resources_weight += resource_type_weight.weight_gram * bought_resource_amount;

                index += 1;
            };


            let seller_delivery 
                = Delivery {
                    delivery_id: seller_delivery_id,
                    from_entity_id: buyer_id,
                    to_entity_id: seller_id,
                    resources_count: buyer_entity_types.len(),
                    resources_weight: bought_resources_weight
                };
            set!(world,(seller_delivery));

            // ensure caravan can be attached to delivery
            TradeCaravanHelpersImpl::assert_can_be_attached(
                world, seller_id, seller_caravan_id, seller_delivery
            );


            // create trade entity
            let trade_id = world.uuid().into();
            set!(world,(
                    Trade {
                        trade_id,
                        seller_id,
                        seller_delivery_id: seller_delivery_id.into(),
                        seller_caravan_id,
                        buyer_id,
                        buyer_delivery_id: buyer_delivery_id.into(),
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

            let trade_status = get!(world, trade_id, Status);
            let mut trade_meta = get!(world, trade_id, Trade);

            // check trade expiration and status
            let ts = starknet::get_block_timestamp();
            assert(trade_meta.expires_at > ts, 'trade expired');
            assert(trade_status.value == TradeStatus::OPEN, 'trade is not open');

            // check that caller is buyer
            let caller = starknet::get_caller_address();
            let owner = get!(world, buyer_id, Owner);
            assert(owner.address == caller, 'not owned by caller');

            // if it's a direct offer, verify that its the correct buyer 
            if trade_meta.buyer_id != 0 {
                assert(trade_meta.buyer_id == buyer_id, 'not the buyer');
            } 
            trade_meta.buyer_id = buyer_id;

            // attach buyer's caravan to delivery
            let buyer_delivery = get!(world, trade_meta.buyer_delivery_id, Delivery);
            TradeCaravanHelpersImpl::assert_can_be_attached(
                world, buyer_id, buyer_caravan_id, buyer_delivery
            );
            trade_meta.buyer_caravan_id = buyer_caravan_id;



            let buyer_position = get!(world, buyer_id, Position);

            // calculate trip time
            let (seller_caravan_movable, seller_caravan_position) 
                = get!(world, trade_meta.seller_caravan_id, (Movable, Position));
            let one_way_trip_time 
                = seller_caravan_position.calculate_travel_time(
                    buyer_position, seller_caravan_movable.sec_per_km
                    );
            let mut round_trip_time: u64 = 2 * one_way_trip_time;

            // if a road exists, use it and get new travel time 
            let mut road
                = RoadImpl::get(world, seller_caravan_position.into(), buyer_position.into());
            if road.usage_count > 0 {
                let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);
                
                road.usage_count -= 1;
                set!(world, (road));
                round_trip_time /= road_config.speed_up_by; 
            }

            set!(world, (
                    ArrivalTime {
                        entity_id: trade_meta.seller_delivery_id,
                        arrives_at: ts + round_trip_time
                    },
                    ArrivalTime {
                        entity_id: trade_meta.seller_caravan_id,
                        arrives_at: ts + round_trip_time
                    },
            ));

            set!(world, (
                    ArrivalTime {
                        entity_id: trade_meta.buyer_delivery_id,
                        arrives_at: ts + round_trip_time
                    },
                    ArrivalTime {
                        entity_id: trade_meta.buyer_caravan_id,
                        arrives_at: ts + round_trip_time
                    },
            ));

        

            // deduct the resources the buyer is giving seller from balance
            let mut index = 0;
            let seller_delivery = get!(world, trade_meta.seller_delivery_id, Delivery);
            loop {
                if index == seller_delivery.resources_count {
                    break ();
                };

                let seller_delivery_resource 
                    = get!(world, (seller_delivery.delivery_id, index), DeliveryResource);
                
                let buyer_resource 
                    = get!(world, (buyer_id, seller_delivery_resource.resource_type), Resource);
                assert(
                    buyer_resource.balance >= seller_delivery_resource.resource_amount, 
                        'not enough balance'
                );
                    
                set!(world,( 
                    Resource {
                        entity_id: buyer_id, 
                        resource_type: buyer_resource.resource_type, 
                        balance: buyer_resource.balance - seller_delivery_resource.resource_amount
                    })
                );
                index += 1;
            };

            set!(world, (
                    trade_meta,
                    Status {
                        trade_id,
                        value: TradeStatus::ACCEPTED
                    }
            ));
        }




        fn claim_delivery(
            self: @ContractState, world: IWorldDispatcher,
            entity_id: u128, delivery_id: u128
        ) {

            let caller = starknet::get_caller_address();    
            let owner = get!(world, entity_id, Owner);
            assert(owner.address == caller, 'not owned by caller');

            let delivery = get!(world, delivery_id, Delivery);
            assert(delivery.to_entity_id == entity_id, 'not the receiver');

            // ensure delivery has arrived
            let delivery_arrival_time = get!(world, delivery_id, ArrivalTime);
            assert(
                delivery_arrival_time.arrives_at > 0, 
                        'delivery has not left'
            );
            assert(
                delivery_arrival_time.arrives_at <= starknet::get_block_timestamp(), 
                        'delivery has not arrived'
            );


            // add delivery items to entity's balance
            let mut index = 0;
            loop {
                if index == delivery.resources_count {
                    break ();
                };

                let delivery_resource = get!(world, (delivery.delivery_id, index), DeliveryResource);
                let mut entity_resource = get!(world, (entity_id, delivery_resource.resource_type), Resource);
                
                entity_resource.balance += delivery_resource.resource_amount;
                set!(world,( entity_resource ));

                index += 1;
            };
        }


        fn cancel_order(self: @ContractState, world: IWorldDispatcher, trade_id: u128) {

            let (trade_meta, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade_meta.seller_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade seller');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            // return resources to seller
            let seller_delivery = get!(world, trade_meta.seller_delivery_id, Delivery);
        
            let mut index = 0;
            loop {
                if index == seller_delivery.resources_count {
                    break ();
                }
                let seller_delivery_resource 
                    = get!(world,(trade_meta.seller_delivery_id, index), DeliveryResource);
                let mut seller_resource 
                    = get!(world, (trade_meta.seller_id, seller_delivery_resource.resource_type), Resource);
                
                seller_resource.balance += seller_delivery_resource.resource_amount;
                set!(world, ( seller_resource));

                index += 1;
            };

            // cancel order
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

        fn assert_can_be_attached(
            world: IWorldDispatcher, entity_id: ID, caravan_id: ID, delivery: Delivery
            ) {
         
            let caravan_owner = get!(world, caravan_id, Owner);   
            assert(
                caravan_owner.address == starknet::get_caller_address(),
                     'caller not owner of caravan'
            );
            
            let caravan_position = get!(world, caravan_id, Position);
            let entity_position = get!(world, entity_id, Position);

            assert(caravan_position.x == entity_position.x, 'Not same position');
            assert(caravan_position.y == entity_position.y, 'Not same position');

            // ensure caravan can carry the weight
            let caravan_capacity = get!(world, caravan_id, Capacity);   
            let caravan_quantity = get!(world, caravan_id, Quantity);
            let caravan_quantity = caravan_quantity.get_value();
            assert(
                caravan_capacity.weight_gram * caravan_quantity >= delivery.resources_weight,
                    'Caravan capacity is not enough'
            );


            let caravan_movable = get!(world, caravan_id, Movable);        
            assert(caravan_movable.blocked == false, 'caravan already blocked');

            // todo@credence check if caravan is in transit
        
        }
    }


}