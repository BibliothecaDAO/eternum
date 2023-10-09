use eternum::models::resources::Resource;
use eternum::models::trade::FungibleEntities;
use eternum::models::owner::Owner;
use eternum::models::position::{Position, Coord};
use eternum::models::capacity::Capacity;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::caravan::Caravan;
use eternum::models::config::{WeightConfig, RoadConfig};
use eternum::models::road::{Road, RoadImpl};
use eternum::models::trade::{Trade,Status, OrderId, OrderResource};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::{WORLD_CONFIG_ID, ROAD_CONFIG_ID};

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::poseidon::poseidon_hash_span;
use core::array::ArrayTrait;


fn setup(taker_needs_caravan: bool) -> (
    IWorldDispatcher, u128, u128, u128, u128, u128, ITradeSystemsDispatcher
) {
    let world = spawn_eternum();
    
    // set as executor
    starknet::testing::set_contract_address(world.executor());
    
    set!(world,(
        RoadConfig {
            config_id: ROAD_CONFIG_ID, 
            fee_resource_type: ResourceTypes::STONE,
            fee_amount: 10,
            speed_up_by: 2
            }
    ));

    let maker_id = 11_u128;
    let taker_id = 12_u128;

    set!(world, (Position { x: 100_000, y: 200_000, entity_id: maker_id}));
    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id}));

    set!(world, (Position { x: 900_000, y: 100_000, entity_id: taker_id}));
    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id}));




    // give wood and stone resources to taker
    set!(world, (
        Resource { 
            entity_id: taker_id, 
            resource_type: ResourceTypes::WOOD, 
            balance: 600
        }
    ));

    set!(world, (
        Resource { 
            entity_id: taker_id, 
            resource_type: ResourceTypes::STONE, 
            balance: 600
        }
    ));

    // create a trade  
    let trade_id = 10_u128;
    let maker_order_id = 13_u128;
    let taker_order_id = 14_u128;
    set!(world, (Trade {
            trade_id,
            maker_id: maker_id,
            taker_id: taker_id,
            maker_order_id: maker_order_id,
            taker_order_id: taker_order_id,
            expires_at: 100,
            claimed_by_maker: false,
            claimed_by_taker: false,
            taker_needs_caravan
    }));



    // set fungible entities for maker
    set!(world, (FungibleEntities { entity_id: maker_order_id, count: 2, key: 33}));
    set!(world, (
        OrderResource { 
            order_id: maker_order_id,
            fungible_entities_id: 33,
            index: 0,
            resource_type: ResourceTypes::GOLD,
            balance: 100
        }
    ));
    set!(world, (
        OrderResource { 
            order_id: maker_order_id,
            fungible_entities_id: 33,
            index: 1,
            resource_type: ResourceTypes::SILVER,
            balance: 200
        }
    ));



    
    // set fungible entities for taker
    set!(world, (FungibleEntities { entity_id: taker_order_id, count: 2, key: 34}));
    set!(world, (
        OrderResource { 
            order_id: taker_order_id,
            fungible_entities_id: 34,
            index: 0,
            resource_type: ResourceTypes::WOOD,
            balance: 100
        }
    ));

    set!(world, (
        OrderResource { 
            order_id: taker_order_id,
            fungible_entities_id: 34,
            index: 1,
            resource_type: ResourceTypes::STONE,
            balance: 200
        }
    ));

    let trade_systems_address 
        = deploy_system(trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };

    (
        world, maker_id, taker_id, trade_id,
         maker_order_id, taker_order_id, trade_systems_dispatcher
    )
}





#[test]
#[available_gas(30000000000000)]
fn test_accept_trade_without_caravan() {

    let (
        world,
        maker_id,
        taker_id, 
        trade_id, 
        maker_order_id, 
        taker_order_id,
        trade_systems_dispatcher
    ) = setup(false);


    // taker accepts trade
    starknet::testing::set_contract_address(
        contract_address_const::<'taker'>()
    );
    trade_systems_dispatcher.accept_order(
        world, 
        taker_id,
        trade_id
    );




    // taker wood balance should be 500
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 500, 'resource balance should be 500'); // 600 - 100

    // taker stone balance should be 400
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 400, 'resource balance should be 400'); // 600 - 200


    // status should be accepted
    let status = get!(world, trade_id, Status);
    assert(status.value == 1, 'status should be accepted');


    // verify arrival time of maker order
    let maker_arrival_time = get!(world, maker_order_id, ArrivalTime);
    assert(maker_arrival_time.arrives_at == 0, 'arrival time should be 0');


    // verify arrival time of taker order
    let taker_arrival_time = get!(world, taker_order_id, ArrivalTime);
    assert(taker_arrival_time.arrives_at == 0, 'arrival time should be 0');
    

    // verify position of maker order
    let maker_order_position = get!(world, maker_order_id, Position);
    assert(maker_order_position.x == 100_000, 'position x should be 100,000');
    assert(maker_order_position.y == 200_000, 'position y should be 200,000');


    // verify position of taker order
    let taker_order_position = get!(world, taker_order_id, Position);
    assert(taker_order_position.x == 900_000, 'position x should be 900,000');
    assert(taker_order_position.y == 100_000, 'position y should be 100,000');
}






#[test]
#[available_gas(30000000000000)]
fn test_accept_trade_with_caravan() {
    
    let (
        world,
        maker_id,
        taker_id, 
        trade_id, 
        maker_order_id, 
        taker_order_id,
        trade_systems_dispatcher
    ) = setup(true);

    // create a caravan owned by the maker
    let maker_caravan_id = 20_u128;
    let maker_caravan_id_felt: felt252 = maker_caravan_id.into();

    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_caravan_id}));
    set!(world, (Position { x: 100_000, y: 200_000, entity_id: maker_caravan_id}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: maker_caravan_id}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: maker_caravan_id}));
    // attach caravan to the maker order
    let maker_caravan_key_arr = array![maker_order_id.into(), maker_id.into()];
    let maker_caravan_key = poseidon_hash_span(maker_caravan_key_arr.span());
    set!(world, (Caravan { caravan_id: maker_caravan_id, entity_id: maker_caravan_key }));


    // create a caravan owned by the taker
    let taker_caravan_id = 30_u128;
    let taker_caravan_id_felt: felt252 = taker_caravan_id.into();
    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_caravan_id}));
    set!(world, (Position { x: 900_000, y: 100_000, entity_id: taker_caravan_id}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: taker_caravan_id}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: taker_caravan_id}));
    // attach caravan to the taker order
    let taker_caravan_key_arr = array![taker_order_id.into(), taker_id.into()];
    let taker_caravan_key = poseidon_hash_span(taker_caravan_key_arr.span());
    set!(world, (Caravan { caravan_id: taker_caravan_id, entity_id: taker_caravan_key }));



    // taker accepts trade
    starknet::testing::set_contract_address(
        contract_address_const::<'taker'>()
    );
    trade_systems_dispatcher.accept_order(
        world, 
        taker_id,
        trade_id
    );




    // taker wood balance should be 500
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 500, 'resource balance should be 500'); // 600 - 100

    // taker stone balance should be 400
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 400, 'resource balance should be 400'); // 600 - 200


    // status should be accepted
    let status = get!(world, trade_id, Status);
    assert(status.value == 1, 'status should be accepted');

    
    // verify arrival time and position of maker order
    let maker_order_arrival_time = get!(world, maker_order_id, ArrivalTime);
    let maker_order_position = get!(world, maker_order_id, Position);
    assert(maker_order_arrival_time.arrives_at == 800, 'arrival time should be 800');
    assert(maker_order_position.x == 900_000, 'position x should be 900,000');
    assert(maker_order_position.y == 100_000, 'position y should be 100,000');
    // verify arrival time of maker caravan
    let maker_caravan_arrival_time = get!(world, maker_caravan_id, ArrivalTime);
    assert(maker_caravan_arrival_time.arrives_at == (800 * 2), 'arrival time should be 1600');



    // verify arrival time and position of taker order
    let taker_order_arrival_time = get!(world, taker_order_id, ArrivalTime);
    let taker_order_position = get!(world, taker_order_id, Position);
    assert(taker_order_arrival_time.arrives_at == 800, 'arrival time should be 800');
    assert(taker_order_position.x == 100_000, 'position x should be 100,000');
    assert(taker_order_position.y == 200_000, 'position y should be 200,000');
    // verify arrival time of taker caravan
    let taker_caravan_arrival_time = get!(world, taker_caravan_id, ArrivalTime);
    assert(taker_caravan_arrival_time.arrives_at == (800 * 2), 'arrival time should be 1600');


}


#[test]
#[available_gas(30000000000000)]
fn test_accept_trade_with_caravan_by_road() {
    
    let (
        world,
        maker_id,
        taker_id, 
        trade_id, 
        maker_order_id, 
        taker_order_id,
        trade_systems_dispatcher
    ) = setup(true);

    // create a caravan owned by the maker
    let maker_caravan_id = 20_u128;
    let maker_caravan_id_felt: felt252 = maker_caravan_id.into();

    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_caravan_id}));
    set!(world, (Position { x: 100_000, y: 200_000, entity_id: maker_caravan_id}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: maker_caravan_id}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: maker_caravan_id}));
    // attach caravan to the maker order
    let maker_caravan_key_arr = array![maker_order_id.into(), maker_id.into()];
    let maker_caravan_key = poseidon_hash_span(maker_caravan_key_arr.span());
    set!(world, (Caravan { caravan_id: maker_caravan_id, entity_id: maker_caravan_key }));


    // create a caravan owned by the taker
    let taker_caravan_id = 30_u128;
    let taker_caravan_id_felt: felt252 = taker_caravan_id.into();

    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_caravan_id}));
    set!(world, (Position { x: 900_000, y: 100_000, entity_id: taker_caravan_id}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: taker_caravan_id}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: taker_caravan_id}));
    // attach caravan to the taker order
    let taker_caravan_key_arr = array![taker_order_id.into(), taker_id.into()];
    let taker_caravan_key = poseidon_hash_span(taker_caravan_key_arr.span());
    set!(world, (Caravan { caravan_id: taker_caravan_id, entity_id: taker_caravan_key }));

    // create road from maker to taker
    // maker location == maker caravan location, same for taker
    let maker_coord: Coord = get!(world, maker_id, Position).into();
    let taker_coord: Coord = get!(world, taker_id, Position).into();
    set!(world, ( 
        Road {
            start_coord_x: maker_coord.x,
            start_coord_y: maker_coord.y,
            end_coord_x: taker_coord.x,
            end_coord_y: taker_coord.y,
            usage_count: 2
        }
    ));


    // taker accepts trade
    starknet::testing::set_contract_address(
        contract_address_const::<'taker'>()
    );
    trade_systems_dispatcher.accept_order(
        world, 
        taker_id,
        trade_id
    );


    // taker wood balance should be 500
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 500, 'resource balance should be 500'); // 600 - 100

    // taker stone balance should be 400
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 400, 'resource balance should be 400'); // 600 - 200


    // status should be accepted
    let status = get!(world, trade_id, Status);
    assert(status.value == 1, 'status should be accepted');

    
    // verify arrival time and position of maker order
    let maker_order_arrival_time = get!(world, maker_order_id, ArrivalTime);
    let maker_order_position = get!(world, maker_order_id, Position);
    assert(maker_order_arrival_time.arrives_at == 800 / 2 , 'arrival time should be 400 a');
    assert(maker_order_position.x == 900_000, 'position x should be 900,000');
    assert(maker_order_position.y == 100_000, 'position y should be 100,000');
    // verify arrival time of maker caravan
    let maker_caravan_arrival_time = get!(world, maker_caravan_id, ArrivalTime);
    assert(maker_caravan_arrival_time.arrives_at == (800 * 2) / 2, 'arrival time should be 800');



    // verify arrival time and position of taker order
    let taker_order_arrival_time = get!(world, taker_order_id, ArrivalTime);
    let taker_order_position = get!(world, taker_order_id, Position);
    assert(taker_order_arrival_time.arrives_at == 800 / 2 , 'arrival time should be 400 b');
    assert(taker_order_position.x == 100_000, 'position x should be 100,000');
    assert(taker_order_position.y == 200_000, 'position y should be 200,000');
    // verify arrival time of taker caravan
    let taker_caravan_arrival_time = get!(world, taker_caravan_id, ArrivalTime);
    assert(taker_caravan_arrival_time.arrives_at == (800 * 2) / 2, 'arrival time should be 800');



    // verify that road usage count was updated
    let road = RoadImpl::get(world, maker_coord, taker_coord);
    assert(road.usage_count == 0, 'incorrect road usage count');
}