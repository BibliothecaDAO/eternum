#[system]
mod CreateMercenary {
    use eternum::alias::ID;
    use eternum::components::position::Position;
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;
    use eternum::components::attack::{Attack, AttackTrait, AttackImpl};
    use eternum::components::quantity::{Quantity, QuantityTrait};

    use eternum::constants::ResourceTypes;
    
    use dojo::world::Context;

    use core::traits::Into;


    fn execute(ctx: Context, entity_id: u128, attack_chance: u8, mut transport_unit_ids: Array<u128>) {

        let entity_owner = get!(ctx.world, entity_id, Owner);
        assert(entity_owner.address == ctx.origin, 'caller not owner');

        let entity_position = get!(ctx.world, entity_id, Position);

        // calculate mercenary capacity and movement data
        
        let mut total_speed: u128 = 0;
        let mut total_quantity: u128 = 0;
        let mut total_capacity: u128 = 0;

        loop {
            match transport_unit_ids.pop_front() {
                Option::Some(transport_unit_id) => {

                    let transport_unit_position = get!(ctx.world, transport_unit_id, Position);
                    assert(entity_position.x == transport_unit_position.x, 'position mismatch');
                    assert(entity_position.y == transport_unit_position.y, 'position mismatch');

                    let transport_unit_owner = get!(ctx.world, transport_unit_id, Owner);
                    assert(transport_unit_owner.address == ctx.origin, 'caller not owner');

                    let transport_unit_movable = get!(ctx.world, transport_unit_id, Movable);
                    assert(transport_unit_movable.blocked == false, 'unit is blocked');

                    // block transport unit to prevent double use
                    let transport_unit_movable = get!(ctx.world, transport_unit_id, Movable);
                    set!(ctx.world, (
                        Movable { 
                            entity_id: transport_unit_id, 
                            sec_per_km: transport_unit_movable.sec_per_km, 
                            blocked: true
                        }
                    ));


                    let (transport_unit_capacity, transport_unit_quantity) 
                        = get!(ctx.world, transport_unit_id, (Capacity, Quantity));

                    let quantity: u128 = transport_unit_quantity.get_value();
                    total_speed += transport_unit_movable.sec_per_km.into() * quantity;
                    total_quantity += quantity;
                    total_capacity += transport_unit_capacity.weight_gram * quantity;
                },

                Option::None => {
                    break;
                }
            }; 
        };


        let average_speed = total_speed / total_quantity;
        let average_speed: u16 = average_speed.try_into().unwrap();

        // generate mercenary id
        let mercenary_id: ID = ctx.world.uuid().into();
        
        // create attack
        let attack = AttackImpl::new(mercenary_id, attack_chance);
        let attack_cost = attack.get_cost();

        // make payment for attack

        // todo@credence move hardcoded fee resource_type to config
        let entity_fee_resource = get!(ctx.world, (entity_id, ResourceTypes::SUNKEN_SHEKEL), Resource);
        assert(entity_fee_resource.balance >= attack_cost.into(), 'insufficient fund');

        set!(ctx.world, (
            Resource {
                entity_id,
                resource_type: entity_fee_resource.resource_type,
                balance: entity_fee_resource.balance - attack_cost.into(),
            }
        ));

        // create mercenary
        set!(ctx.world, (
                attack, 
                Owner {
                    entity_id: mercenary_id, 
                    address: ctx.origin
                },
                Movable {
                    entity_id: mercenary_id, 
                    sec_per_km: average_speed, 
                    blocked: false, 
                }, 
                Capacity {
                    entity_id: mercenary_id, 
                    weight_gram: total_capacity, 
                }, 
                Position {
                    entity_id: mercenary_id, 
                    x: entity_position.x, 
                    y: entity_position.y
                }
            )
        );
    }
}