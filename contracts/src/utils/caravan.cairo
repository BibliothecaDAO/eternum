
use eternum::alias::ID;
use eternum::components::caravan::Caravan;
use eternum::components::movable::{Movable, ArrivalTime};
use eternum::components::position::{Position, PositionTrait};
use eternum::components::road::{Road, RoadTrait, RoadImpl};
use eternum::components::capacity::Capacity;
use eternum::components::quantity::{Quantity, QuantityTrait};
use eternum::components::caravan::{CaravanAttachment, Cargo, CargoItem};
use eternum::components::resources::Resource;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use traits::Into;
use array::ArrayTrait;




fn travel(world: IWorldDispatcher, caravan_id: ID, start_position: Position, end_position: Position) {
    let caravan_position = get!(world, caravan_id, Position);
    assert(caravan_position.x == start_position.x, 'caravan position mismatch');
    assert(caravan_position.y == start_position.y, 'caravan position mismatch');
    
    let caravan_movable = get!(world, caravan_id, Movable);        
    assert(caravan_movable.blocked == false, 'caravan already blocked');

    let caravan_attachment = get!(world, caravan_id, CaravanAttachment);
    assert(caravan_attachment.cargo_id != 0, 'cargo not attached');
    
    let mut travel_time = caravan_position
        .calculate_travel_time(end_position, caravan_movable.sec_per_km);
    
    // if a road exists, use it and get new travel time 
    let mut road: Road = RoadImpl::get(world, caravan_position.into(), end_position.into());
    if road.usage_count > 0 {
        road.travel(world);
        travel_time /= road.speed_boost();
    }

   
    set!(world,(
        ArrivalTime {
            entity_id: caravan_id,
            arrives_at: starknet::get_block_timestamp() + travel_time
        }, 
        Position {
            entity_id: caravan_id,
            x: end_position.x,
            y: end_position.y
        },
        Movable { 
            entity_id: caravan_id, 
            sec_per_km: caravan_movable.sec_per_km, 
            blocked: true 
        }
    ));

}


#[inline(always)]
fn onboard(world: IWorldDispatcher, caravan_id: ID, cargo: Cargo) {
            
    let caravan_attachment = get!(world, caravan_id, CaravanAttachment);
    assert(caravan_attachment.cargo_id == 0, 'cargo already attached');
    
    let (caravan_capacity, caravan_quantity) = get!(world, caravan_id, (Capacity, Quantity));
    let quantity = caravan_quantity.get_value();
    assert(caravan_capacity.weight_gram * quantity >= cargo.weight, 'caravan capacity not enough'); 


    set!(world, (
        CaravanAttachment { 
            caravan_id,
            cargo_id: cargo.cargo_id
        },
        Cargo {
            cargo_id: cargo.cargo_id, 
            caravan_id: caravan_id, 
            weight: cargo.weight,
            count: cargo.count
        }
    ));

}



#[inline(always)]
fn offboard(world: IWorldDispatcher, caravan_id: ID) -> Cargo {
            
    let mut caravan_attachment = get!(world, caravan_id, CaravanAttachment);
    assert(caravan_attachment.cargo_id != 0, 'cargo not attached');

    let mut cargo = get!(world, caravan_attachment.cargo_id, Cargo);
    
    // dissociate cargo from caravan
    cargo.caravan_id = 0;
    caravan_attachment.cargo_id = 0;

    set!(world, (caravan_attachment, cargo));

    cargo
}



mod cargo {

    use eternum::alias::ID;
    use eternum::components::caravan::{Cargo, CargoItem};
    use eternum::components::resources::Resource;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


    #[inline(always)]
    fn new(cargo_id: ID) -> Cargo {        
        Cargo {
            cargo_id, 
            caravan_id: 0, 
            weight: 0,
            count: 0
        }
    }




    #[inline(always)]
    fn add(world: IWorldDispatcher, from_entity_id: ID, cargo_id: ID, index: usize, resource_type: u8, amount: u128) {
        let from_entity_resource = get!(world, (from_entity_id, resource_type), Resource);
        assert(from_entity_resource.balance >= amount, 'not enough resources');

        
        set!(world, (
            Resource { 
                entity_id: from_entity_resource.entity_id, 
                resource_type: from_entity_resource.resource_type, 
                balance: from_entity_resource.balance - amount
            },
            CargoItem {
                cargo_id, 
                index, 
                resource_type, 
                amount
            }
        ));
    }

    
    
    #[inline]
    fn release(world: IWorldDispatcher, to_entity_id: ID, cargo: Cargo) {

        assert(cargo.caravan_id == 0, 'cargo still attached');

        let mut index = 0;
        loop {
            if index == cargo.count {
                break;
            }

            let cargo_item = get!(world, (cargo.cargo_id, index), CargoItem);
            let to_entity_resource = get!(world, (to_entity_id, cargo_item.resource_type), Resource);

            set!(world, (
                Resource { 
                    entity_id: to_entity_id, 
                    resource_type: cargo_item.resource_type, 
                    balance: to_entity_resource.balance + cargo_item.amount
                },
                CargoItem {
                    cargo_id: cargo_item.cargo_id,
                    index, 
                    resource_type: cargo_item.resource_type,
                    amount: 0
                }
            ));

            index += 1;
        };


        set!(world, (
            Cargo {
                cargo_id: cargo.cargo_id, 
                caravan_id: 0, 
                weight: 0,
                count: 0
            }
        ));
        
    }
    
}

