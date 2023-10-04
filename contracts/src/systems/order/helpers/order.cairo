use eternum::alias::ID;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::trade::{Status, TradeStatus};


#[inline(always)]
fn cancel(world: IWorldDispatcher, trade_id: ID){
    set!(world, (
        Status { 
            trade_id, 
            value: TradeStatus::CANCELLED 
        }
    ));
}


    

mod resource {
    use eternum::alias::ID;
    use eternum::models::caravan::Caravan;
    use eternum::models::trade::FungibleEntities;
    use eternum::models::trade::OrderResource;
    use eternum::models::resources::Resource;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    fn give(world: IWorldDispatcher, order_id: ID, to: ID) {
        let fungible_entites = get!(world, order_id, FungibleEntities);
    
        let mut index = 0;
        loop {
            if index == fungible_entites.count {
                break ();
            }
            let order_resource = get!(world,(order_id, fungible_entites.key, index), OrderResource);
            let resource = get!(world, (to, order_resource.resource_type), Resource);
            set!(world, ( 
                Resource {
                    entity_id: to,
                    resource_type: order_resource.resource_type,
                    balance: resource.balance + order_resource.balance,
                }
            ));
            index += 1;
        };
    }

    fn take(world: IWorldDispatcher, order_ida: ID, to: ID) {
        let fungible_entites = get!(world, order_ida, FungibleEntities);
        
        let mut index = 0;
        loop {
            if index == fungible_entites.count {
                break ();
            }
            let order_resource = get!(world,(order_ida, fungible_entites.key, index), OrderResource);
            let resource = get!(world, (to, order_resource.resource_type), Resource);
            set!(world, ( 
                Resource {
                    entity_id: to,
                    resource_type: order_resource.resource_type,
                    balance: resource.balance - order_resource.balance,
                }
            ));
            
            index += 1;
        };
    }
}


mod caravan {
    use eternum::alias::ID;
    use eternum::models::caravan::Caravan;
    use eternum::models::movable::Movable;
    use eternum::models::trade::OrderId;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    
    use traits::Into;
    use array::ArrayTrait;
    use poseidon::poseidon_hash_span;


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
                
        let caravan = get(world, order_id, owner_id);
        assert(caravan.caravan_id == 0, 'caravan already attached');

        let caravan_movable = get!(world, caravan.caravan_id, Movable);        
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

