#[system]
mod Raid {
    
    use eternum::components::position::{Coord, CoordTrait, Position};
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::movable::{Movable, Travel, TravelTrait};
    use eternum::components::capacity::Capacity;
    use eternum::components::health::Health;
    use eternum::components::attack::{Attack, AttackTrait, AttackImpl};
    use eternum::components::quantity::{Quantity, QuantityTrait};
    use eternum::components::config::WeightConfigImpl;

    use eternum::utils::{make_seed_from_transaction_hash, random};

    
    use dojo::world::Context;

    use core::traits::{Into, TryInto};


    fn execute(ctx: Context, raiding_entity_id: u128, adversary_entity_id: u128, mut resource_types: Span<u8>) {

        assert(resource_types.len() > 0, 'no resources to raid');

        let raiding_entity_owner = get!(ctx.world, raiding_entity_id, Owner);
        assert(raiding_entity_owner.address == ctx.origin, 'caller not owner');


        let ts = starknet::get_block_timestamp();
        
        let raiding_entity_travel = get!(ctx.world, raiding_entity_id, Travel);
        let raiding_entity_position = get!(ctx.world, raiding_entity_id, Position);
        let raiding_entity_live_coord: Coord = raiding_entity_travel.live_location(
            raiding_entity_position.into(), 
            ts
        );


        let adversary_entity_travel = get!(ctx.world, adversary_entity_id, Travel);
        let adversary_entity_position = get!(ctx.world, adversary_entity_id, Position);
        let adversary_entity_live_coord: Coord = adversary_entity_travel.live_location(
            adversary_entity_position.into(), 
            ts
        );
        

        let live_distance_between_entities 
            = raiding_entity_live_coord.measure_distance(adversary_entity_live_coord);
        
        // todo@credence move hardcoded distance to config
        assert(live_distance_between_entities <= 1, 'too far to attack');



        let adversary_entity_health = get!(ctx.world, adversary_entity_id, Health);
        assert(adversary_entity_health.balance > 0, 'advesary can not be raided');
      
        let raiding_entity_capacity = get!(ctx.world, raiding_entity_id, Capacity);
        assert(raiding_entity_capacity.weight_gram > 0, 'raiding entity has no capacity');


        let mut raiding_entity_attack = get!(ctx.world, raiding_entity_id, Attack);
        assert(raiding_entity_attack.can_attack(), 'raiding entity cant attack');
              
        if raiding_entity_attack.launch() { 
            // successful attack

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

            
            // todo@credence move hardcoded damage to config
            // random damage from 1 - 50 
            let randomness_seed = make_seed_from_transaction_hash(0);
            let mut damage: u8 = (random(randomness_seed, 50) + 1).try_into().unwrap();
            if adversary_entity_health.balance < damage {
                damage = adversary_entity_health.balance;
            }
            set!(ctx.world, (
                Health {
                    entity_id: adversary_entity_health.entity_id,
                    balance: adversary_entity_health.balance - damage
                }
            ));

        }

        raiding_entity_attack.last_attack = starknet::get_block_timestamp();
        set!(ctx.world, (raiding_entity_attack));
        

    }
}