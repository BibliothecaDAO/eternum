#[system]
mod CreateMercenary {
    use eternum::alias::ID;
    use eternum::components::position::Position;
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::movable::{Movable, NewMovable};
    use eternum::components::capacity::Capacity;
    use eternum::components::attack::{Attack, AttackTrait, AttackImpl};
    use eternum::components::config::AttackConfig;

    use eternum::constants::ResourceTypes;
    use eternum::constants::ATTACK_CONFIG_ID;
    
    use dojo::world::Context;

    use core::traits::Into;


    fn execute(ctx: Context, entity_id: ID) {

        let entity_owner = get!(ctx.world, entity_id, Owner);
        assert(entity_owner.address == ctx.origin, 'caller not owner');

        let attack_config = get!(ctx.world, ATTACK_CONFIG_ID, AttackConfig);
        assert(attack_config.value != 0, 'attack config not set');

        // make payment for attack
        let entity_fee_resource = get!(ctx.world, (entity_id, attack_config.fee_resource_type), Resource);
        assert(entity_fee_resource.balance >= attack_config.fee_amount, 'insufficient fund');
        
        set!(ctx.world, (
            Resource {
                entity_id,
                resource_type: entity_fee_resource.resource_type,
                balance: entity_fee_resource.balance - attack_config.fee_amount,
            }
        ));


        let mercenary_id: ID = ctx.world.uuid().into();
        let entity_position = get!(ctx.world, entity_id, Position);

        // create mercenary
        set!(ctx.world, (
                Attack {
                    entity_id: mercenary_id,
                    value: attack_config.value,
                    last_attack: 0
                },
                Owner {
                    entity_id: mercenary_id, 
                    address: ctx.origin
                },
                NewMovable {
                    entity_id: entity_id,
                    sec_per_km: 15, //? mercenary_config.sec_per_km ?
                    blocked: false,

                    departure_time: 0,
                    arrival_time: 0,

                    last_stop_coord_x: entity_position.x,
                    last_stop_coord_y: entity_position.y,
                    round_trip: false
                },
                Capacity {
                    entity_id: mercenary_id, 
                    weight_gram: 12, //? mercenary_config.weight_gram ?
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