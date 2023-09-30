#[system]
mod Raid {
    
    use eternum::components::position::{Coord, CoordTrait, Position};
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::movable::{Movable, NewMovable, NewMovableTrait};
    use eternum::components::capacity::Capacity;
    use eternum::components::health::Health;
    use eternum::components::attack::{Attack, AttackTrait, AttackImpl};
    use eternum::components::quantity::{Quantity, QuantityTrait};
    use eternum::components::config::{AttackConfig, WeightConfigImpl};

    use eternum::constants::ATTACK_CONFIG_ID;
    
    use dojo::world::Context;

    use core::traits::{Into, TryInto};


    fn execute(ctx: Context, raiding_entity_id: u128, adversary_entity_id: u128, mut resource_types: Span<u8>) {

        assert(resource_types.len() > 0, 'no resources to raid');

        let raiding_entity_owner = get!(ctx.world, raiding_entity_id, Owner);
        assert(raiding_entity_owner.address == ctx.origin, 'caller not owner');

        
        let raiding_entity_movable = get!(ctx.world, raiding_entity_id, NewMovable);
        let raiding_entity_position = get!(ctx.world, raiding_entity_id, Position);
        let raiding_entity_live_coord: Coord 
            = raiding_entity_movable.live_location(raiding_entity_position.into());


        let adversary_entity_movable = get!(ctx.world, adversary_entity_id, NewMovable);
        let adversary_entity_position = get!(ctx.world, adversary_entity_id, Position);
        let adversary_entity_live_coord: Coord 
            = adversary_entity_movable.live_location(adversary_entity_position.into());
        

        let live_distance_between_entities 
            = raiding_entity_live_coord.measure_distance(adversary_entity_live_coord);
        
        let attack_config = get!(ctx.world, ATTACK_CONFIG_ID, AttackConfig);
        assert(live_distance_between_entities <= attack_config.min_attack_distance,
             'too far to attack'
        );


        let mut adversary_entity_health = get!(ctx.world, adversary_entity_id, Health);
        assert(adversary_entity_health.balance > 0, 'advesary can not be raided');
      
        let raiding_entity_capacity = get!(ctx.world, raiding_entity_id, Capacity);
        assert(raiding_entity_capacity.weight_gram > 0, 'raiding entity has no capacity');


        let mut raiding_entity_attack = get!(ctx.world, raiding_entity_id, Attack);
        assert(raiding_entity_attack.can_launch(attack_config.min_cooldown_minutes), 
                'raiding entity cant attack'
        );

        
        // launch attack and calculate damage

        if raiding_entity_attack.launch() {  
            // attack was a success
            if adversary_entity_health.balance > raiding_entity_attack.value.into() {
                adversary_entity_health.balance -= raiding_entity_attack.value.into();
            } else {
                adversary_entity_health.balance = 0;
            }

            set!(ctx.world, (adversary_entity_health));
        }

        if adversary_entity_health.balance == 0 {

            let raiding_entity_quantity = get!(ctx.world, raiding_entity_id, Quantity);
            let raiding_entity_total_capacity = raiding_entity_capacity.weight_gram * raiding_entity_quantity.get_value();

            let mut resource_total_weight = 0;

            loop {
                match resource_types.pop_front() {
                    Option::Some(resource_type) => {
                        let adversary_resource = get!(ctx.world, adversary_entity_id, Resource);

                        resource_total_weight += WeightConfigImpl::get_weight(
                                ctx.world, *resource_type, adversary_resource.balance
                            );

                        if resource_total_weight < raiding_entity_total_capacity {
                            let raiding_entity_resource = get!(ctx.world, raiding_entity_id, Resource);
                            set!(ctx.world, (
                                Resource {
                                    entity_id: raiding_entity_resource.entity_id,
                                    resource_type: raiding_entity_resource.resource_type,
                                    balance: raiding_entity_resource.balance + adversary_resource.balance
                                },
                                Resource {
                                    entity_id: adversary_entity_id,
                                    resource_type: *resource_type,
                                    balance: 0
                                }
                            ));
                        }    
                    },

                    Option::None => {
                        break;
                    }
                };    
            };            
        }

        // update last attack timestamp
        set!(ctx.world, (
            Attack {
                entity_id: raiding_entity_attack.entity_id,
                value: raiding_entity_attack.value,
                last_attack: starknet::get_block_timestamp()
            }
        ));
        

    }
}