use eternum::alias::ID;
use eternum::components::caravan::CaravanMembers;
use eternum::components::quantity::Quantity;
use eternum::components::position::Position;
use eternum::components::movable::Movable;
use eternum::components::capacity::Capacity;
use eternum::components::owner::{Owner, OwnerExistsImpl};
use eternum::components::ComponentManagerTrait;
use starknet::contract_address_const;
use traits::Into;
use option::Option;

use dojo::world::{Context, IWorldDispatcherTrait};



#[derive(Drop, Copy)]
struct Caravan {
    id: u128,
    ctx: Context,
    owner: Owner,
    movable: Movable,
    capacity: Capacity,
    members: CaravanMembers,
    position: Position
}



#[generate_trait]
impl CaravanImpl of CaravanTrait {
    fn new(ctx: Context) -> Caravan {
        Caravan {
            id: ctx.world.uuid().into(),
            ctx,
            owner: Owner{
                entity_id: 0_u128,
                address: contract_address_const::<0>()
            },
            movable: Movable {
                entity_id: 0_u128,
                sec_per_km: 0,
                blocked: false
            },
            capacity: Capacity {
                entity_id: 0_u128,
                weight_gram: 0
            },
            members: CaravanMembers {
                entity_id: 0_u128,
                key: 0,
                count: 0
            },
            position: Position {
                entity_id: 0_u128,
                x: 0,
                y: 0
            }
        }
    }

    fn owner(self: Caravan) -> Owner {
        self.get()
    }

    fn movable(self: Caravan) -> Movable {
        self.get()
    }

    fn capacity(self: Caravan) -> Capacity {
        self.get()
    }

    fn members(self: Caravan) -> CaravanMembers {
        self.get()
    }

    fn position(self: Caravan) -> Position {
        self.get()
    }

}

impl CaravanOwnerManagerImpl of ComponentManagerTrait<Caravan, Owner> {   

    fn get(self: Caravan) -> Owner {
        get!(self.ctx.world, self.id, Owner)
    }

    fn set(self: Caravan, value: Owner) {
        set!(self.ctx.world, (value))
    }

}


impl CaravanMovableManagerImpl of ComponentManagerTrait<Caravan, Movable> {   

    fn get(self: Caravan) -> Movable {
        get!(self.ctx.world, self.id, Movable)
    }

    fn set(self: Caravan, value: Movable) {
        set!(self.ctx.world, (value))
    }

}


impl CaravanCapacityManagerImpl of ComponentManagerTrait<Caravan, Capacity> {

    fn get(self: Caravan) -> Capacity {
        get!(self.ctx.world, self.id, Capacity)
    }

    fn set(self: Caravan, value: Capacity) {
        set!(self.ctx.world, (value))
    }

}


impl CaravanMembersManagerImpl of ComponentManagerTrait<Caravan, CaravanMembers> {

    fn get(self: Caravan) -> CaravanMembers {
        get!(self.ctx.world, self.id, CaravanMembers)
    }

    fn set(self: Caravan, value: CaravanMembers) {
        set!(self.ctx.world, (value))
    }

}


impl CaravanPositionManagerImpl of ComponentManagerTrait<Caravan, Position> {

    fn get(self: Caravan) -> Position {
        get!(self.ctx.world, self.id, Position)
    }

    fn set(self: Caravan, value: Position) {
        set!(self.ctx.world, (value))
    }

}