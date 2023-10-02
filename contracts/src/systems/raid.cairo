#[system]
mod AttackTravellingEntity {
    
    use eternum::components::position::{Coord, CoordTrait, Position};
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::movable::{Movable, NewMovable, NewMovableTrait};
    use eternum::components::capacity::Capacity;
    use eternum::components::health::Health;
    use eternum::components::attack::{Attack, AttackTrait, AttackImpl};
    use eternum::components::quantity::{Quantity, QuantityTrait};
    use eternum::components::config::{AttackConfig, WeightConfig};
    use eternum::constants::{WORLD_CONFIG_ID, ATTACK_CONFIG_ID};

    
    use dojo::world::Context;

    use core::traits::{Into, TryInto};


    fn execute(ctx: Context, attacker_id: u128, defender_id: u128, mut resource_types: Span<u8>) {

        assert(resource_types.len() > 0, 'no resources to raid');

        let attacker_owner = get!(ctx.world, attacker_id, Owner);
        assert(attacker_owner.address == ctx.origin, 'caller not owner');

        
        let attacker_movable = get!(ctx.world, attacker_id, NewMovable);
        let attacker_position = get!(ctx.world, attacker_id, Position);
        let attacker_live_coord: Coord 
            = attacker_movable.live_location(attacker_position.into());
        assert(attacker_live_coord != attacker_position.into(), 
                'attacker not traveling'
        );        


        let defender_movable = get!(ctx.world, defender_id, NewMovable);
        let defender_position = get!(ctx.world, defender_id, Position);
        let defender_live_coord: Coord 
            = defender_movable.live_location(defender_position.into());
        assert(defender_live_coord != defender_position.into(), 
                'defender not traveling'
        );



        let live_distance_between_entities 
            = attacker_live_coord.measure_distance(defender_live_coord);
        
        let attack_config = get!(ctx.world, ATTACK_CONFIG_ID, AttackConfig);
        assert(live_distance_between_entities <= attack_config.min_attack_distance,
             'too far to attack'
        );


        let mut defender_health = get!(ctx.world, defender_id, Health);
        assert(defender_health.balance > 0, 'defender can not be raided');
      
        let attacker_capacity = get!(ctx.world, attacker_id, Capacity);
        assert(attacker_capacity.weight_gram > 0, 'attacker has no capacity');


        let mut attacker_attack = get!(ctx.world, attacker_id, Attack);
        assert(attacker_attack.can_launch(attack_config.min_cooldown_minutes), 
                'attacker cant attack'
        );

        
        // launch attack and calculate damage

        if attacker_attack.launch() {  
            // attack was a success
            if defender_health.balance > attacker_attack.value.into() {
                defender_health.balance -= attacker_attack.value.into();
            } else {
                defender_health.balance = 0;
            }

            set!(ctx.world, (defender_health));
        }

        if defender_health.balance == 0 {

            // defender was killed, loot resources

            let attacker_quantity = get!(ctx.world, attacker_id, Quantity);
            let attacker_total_capacity 
                = attacker_capacity.weight_gram * attacker_quantity.get_value();

            // q@credence: how do we get the total weight of resources already in the attacker? 
            let mut loot_remaining_weight = attacker_total_capacity;

            loop {
                match resource_types.pop_front() {
                    Option::Some(resource_type) => {

                        let defender_resource 
                            = get!(ctx.world, (defender_id, *resource_type), Resource);

                        let resource_weight_config 
                                = get!(ctx.world, (WORLD_CONFIG_ID, *resource_type), WeightConfig);

                        let defender_resource_total_weight = resource_weight_config.weight_gram *  defender_resource.balance;
                        let loot_resource_amount = if (defender_resource_total_weight <= loot_remaining_weight) {
                                loot_remaining_weight -= defender_resource_total_weight;
                                defender_resource.balance
                                
                            } else {
                                let amount = loot_remaining_weight / resource_weight_config.weight_gram;
                                loot_remaining_weight -= resource_weight_config.weight_gram * amount;
                                amount
                            };

                        if loot_resource_amount > 0 {
                            let attacker_resource 
                                = get!(ctx.world, (attacker_id, *resource_type), Resource);
                            set!(ctx.world, (
                                    Resource {
                                        entity_id: attacker_resource.entity_id,
                                        resource_type: attacker_resource.resource_type,
                                        balance: attacker_resource.balance + loot_resource_amount
                                    },
                                    Resource {
                                        entity_id: defender_resource.entity_id,
                                        resource_type: defender_resource.resource_type,
                                        balance: defender_resource.balance - loot_resource_amount
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
                entity_id: attacker_attack.entity_id,
                value: attacker_attack.value,
                last_attack: starknet::get_block_timestamp()
            }
        ));
        

    }
}