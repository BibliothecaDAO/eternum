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
    fn accept_order(taker_id: u128, trade_id: u128);
    fn cancel_order(trade_id: u128);
}

#[dojo::contract]
mod trade_systems {
    use core::poseidon::poseidon_hash_span;
    use eternum::alias::ID;

    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::RoadConfig;
    use eternum::models::config::WeightConfig;
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::inventory::{Inventory};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, PositionTrait, Coord, TravelTrait};
    use eternum::models::quantity::{Quantity, QuantityTrait, QuantityTracker};
    use eternum::models::realm::Realm;

    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::models::resources::{ResourceChest, DetachedResource};
    use eternum::models::road::{Road, RoadTrait, RoadImpl};
    use eternum::models::trade::{Trade, Status, TradeStatus};
    use eternum::models::weight::Weight;
    use eternum::systems::resources::contracts::resource_systems::{
        InternalResourceChestSystemsImpl as resource_chest,
        InternalInventorySystemsImpl as inventory
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
            maker_gives_resources: Span<(u8, u128)>,
            taker_id: u128,
            taker_gives_resources: Span<(u8, u128)>,
            expires_at: u64
        ) -> ID {
            let caller = starknet::get_caller_address();

            let maker_owner = get!(world, maker_id, Owner);
            assert(maker_owner.address == caller, 'caller not maker');

            // create resource chest that maker will collect
            let (maker_resource_chest, maker_resources_weight) = resource_chest::create(
                world, taker_gives_resources
            );

            // create resource chest that taker will collect
            let (taker_resource_chest, _) = resource_chest::create(world, maker_gives_resources);

            // fill the taker's chest with the maker's resources
            resource_chest::fill(world, taker_resource_chest.entity_id, maker_id);

            // burn the maker donkeys
            let mut maker_donkeys = ResourceImpl::get(world, (maker_id, ResourceTypes::DONKEY));
            let maker_donkey_amount = donkey::get_donkey_needed(world, maker_resources_weight);
            maker_donkeys.burn(maker_donkey_amount);
            maker_donkeys.save(world);

            // create trade entity
            let trade_id = world.uuid().into();
            set!(
                world,
                (
                    Trade {
                        trade_id,
                        maker_id,
                        maker_resource_chest_id: maker_resource_chest.entity_id,
                        taker_id,
                        taker_resource_chest_id: taker_resource_chest.entity_id,
                        expires_at: expires_at,
                    },
                    Status { trade_id: trade_id, value: TradeStatus::OPEN, }
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


        fn accept_order(world: IWorldDispatcher, taker_id: u128, trade_id: u128) {
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

            // burn the taker donkeys
            let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
            let mut taker_donkeys = ResourceImpl::get(world, (taker_id, ResourceTypes::DONKEY));
            let taker_donkey_amount = donkey::get_donkey_needed(world, taker_resource_chest_weight.value);
            taker_donkeys.burn(taker_donkey_amount);
            taker_donkeys.save(world);

            // get travel time
            let donkey_speed_config 
                = get!(world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), SpeedConfig);
            let travel_time = 0;
            let travel_time = donkey::get_donkey_travel_time(
                world, taker_position.into(), maker_position.into(), donkey_speed_config.sec_per_km, true
            );

            ///////// Updates For Maker ///////////////
            //////////////////////////////////////////

            // fill the maker's resource chest with the traded items
            resource_chest::fill(world, trade.maker_resource_chest_id, taker_id);

            let maker_inventory_entity_id: u128 = world.uuid().into();
            // add inventory to make transfer function work
            set!(
                world,
                Inventory {
                    entity_id: maker_inventory_entity_id,
                    items_key: world.uuid().into(),
                    items_count: 0
                }
            );
            inventory::add(world, maker_inventory_entity_id, trade.maker_resource_chest_id);

            let maker_owner = get!(world, trade.maker_id, Owner);

            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: maker_inventory_entity_id, arrives_at: ts.into() + travel_time
                    },
                    Position {
                        entity_id: maker_inventory_entity_id,
                        x: maker_position.x,
                        y: maker_position.y,
                    },
                    Owner { entity_id: maker_inventory_entity_id, address: maker_owner.address, }
                )
            );

            ///////// Updates For Taker ///////////////
            //////////////////////////////////////////

            let taker_inventory_entity_id: u128 = world.uuid().into();
            // add inventory to make transfer function work
            set!(
                world,
                Inventory {
                    entity_id: taker_inventory_entity_id,
                    items_key: world.uuid().into(),
                    items_count: 0
                }
            );
            inventory::add(world, taker_inventory_entity_id, trade.taker_resource_chest_id);

            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: taker_inventory_entity_id, arrives_at: ts.into() + travel_time
                    },
                    Position {
                        entity_id: taker_inventory_entity_id,
                        x: taker_position.x,
                        y: taker_position.y,
                    },
                    Owner { entity_id: taker_inventory_entity_id, address: taker_owner.address, }
                )
            );

            /////////  Update Trade   ///////////////
            //////////////////////////////////////////

            trade.taker_id = taker_id;
            set!(world, (trade));
            set!(world, (Status { trade_id, value: TradeStatus::ACCEPTED, }),);
        }


        fn cancel_order(world: IWorldDispatcher, trade_id: u128) {
            let (trade, trade_status) = get!(world, trade_id, (Trade, Status));
            let owner = get!(world, trade.maker_id, Owner);

            assert(owner.address == starknet::get_caller_address(), 'caller must be trade maker');
            assert(trade_status.value == TradeStatus::OPEN, 'trade must be open');

            // return donkeys to maker
            let resource_weight = get!(world, trade.taker_resource_chest_id, Weight);
            let donkey_amount = donkey::get_donkey_needed(world, resource_weight.value);
            let mut maker_donkeys: Resource = ResourceImpl::get(
                world, (trade.maker_id, ResourceTypes::DONKEY)
            );
            maker_donkeys.add(donkey_amount);
            maker_donkeys.save(world);

            // return resources to maker
            resource_chest::offload(world, 0, trade.taker_resource_chest_id, trade.maker_id);

            set!(world, (Status { trade_id, value: TradeStatus::CANCELLED }));
        }
    }
}
