#[dojo::contract]
mod combat_systems {
    use eternum::alias::ID;

    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::position::{Position};
    use eternum::models::config::{
        SpeedConfig, WeightConfig, CapacityConfig, CombatConfig,
        SoldierConfig, HealthConfig, AttackConfig, DefenceConfig
    };
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::inventory::Inventory;
    use eternum::models::capacity::Capacity;
    use eternum::models::weight::Weight;
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::realm::Realm;
    use eternum::models::quantity::{Quantity, QuantityTrait};    
    use eternum::models::combat::{
        Attack, Health, Defence, Duty, Combat
    };
    

    use eternum::systems::combat::interface::{
        ISoldierSystems, ICombatSystems
    };
    use eternum::systems::resources::contracts::resource_systems::{
        InternalResourceChestSystemsImpl,
        InternalInventorySystemsImpl 
    };

    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };

    use eternum::constants::{
        WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE, COMBAT_CONFIG_ID,
        get_unzipped_resource_probabilities
    };

    use eternum::utils::random;
    use eternum::utils::math::{min};

    #[derive(Serde, Copy, Drop)]
    enum Winner {
        Attacker,
        Target
    }

    #[derive(Drop, starknet::Event)]
    struct CombatOutcome {
        #[key]
        attacker_realm_entity_id: u128,
        #[key]
        target_realm_entity_id: u128,
        attacking_entity_ids: Span<u128>,
        winner: Winner,
        stolen_resource_types: Span<u8>,
        stolen_resource_amounts: Span<u128>
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CombatOutcome: CombatOutcome,
    }



    #[external(v0)]
    impl SoldierSystemsImpl of ISoldierSystems<ContractState> {
        /// Create a number of soldiers for a realm
        /// and add them to the realms reserve unit
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `realm_entity_id` - The realm's entity id of the realm
        /// * `quantity` - The number of soldiers to create
        ///
        fn create_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, quantity: u128
        ) {

            // check that entity is a realm
            let realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');

            // check realm ownership
            let caller = starknet::get_caller_address();
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(
                realm_owner.address == caller,
                    'not realm owner'
            );


            // check that realm has enough resources to pay for the quantity

            let soldier_config: SoldierConfig = get!(world, SOLDIER_ENTITY_TYPE, SoldierConfig);
            let mut index = 0;
            loop {
                if index == soldier_config.resource_cost_count {
                    break;
                }

                let resource_cost 
                    = get!(world, (soldier_config.resource_cost_id, index), ResourceCost);
                let mut realm_resource 
                    = get!(world, (realm_entity_id, resource_cost.resource_type), Resource);

                assert(
                    realm_resource.balance >= resource_cost.amount * quantity,
                        'insufficient resources'
                );

                realm_resource.balance -= resource_cost.amount * quantity;
                set!(world, (realm_resource));

                index += 1;
            };



            let individual_max_health_value
                = get!(world, SOLDIER_ENTITY_TYPE, HealthConfig).max_value;
            let individual_max_attack_value
                = get!(world, SOLDIER_ENTITY_TYPE, AttackConfig).max_value;
            let individual_max_defence_value
                = get!(world, SOLDIER_ENTITY_TYPE, DefenceConfig).max_value;


                                    
            let entity_combat = get!(world, realm_entity_id, Combat);
            let soldiers_reserve_id = entity_combat.soldiers_reserve_id;


            let mut unit_quantity = get!(world, soldiers_reserve_id, Quantity);
            unit_quantity.value += quantity;

            let mut unit_health = get!(world, soldiers_reserve_id, Health);
            unit_health.value += individual_max_health_value * quantity;

            let mut unit_attack = get!(world, soldiers_reserve_id, Attack);
            unit_attack.value += individual_max_attack_value * quantity;

            let mut unit_defence = get!(world, soldiers_reserve_id, Defence);
            unit_defence.value += individual_max_defence_value * quantity;


            set!(world, (unit_health, unit_attack, unit_defence, unit_quantity));
        }

        ///  Create soldier(s) and assign them a duty.
        ///
        ///  Note: no soldier should have any resource in their inventory
        ///        when calling this function. if they do, they must dispose
        ///        of the items before calling this function.
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `entity_id` - The realm's entity id of the realm
        /// * `soldier_ids` - The ids of the soldiers that'll make up the unit
        /// * `duty` - The duty of the unit which can be either attack or defence.
        ///             Those assigned to attack will be deployed to raid other realms
        ///             while those assigned to defence will be deployed to defend the realm.
        ///             This means those attacking can travel and hold resources in inventory
        ///             while those defending cannot as they are deployed to the realm's town watch.      
        ///             
        ///
        fn detach_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            unit_id: u128, detached_quantity: u128
        ) -> ID {

            // check that caller owns unit
            let caller = starknet::get_caller_address();
            let unit_owner = get!(world, unit_id, Owner);
            assert(unit_owner.address == caller, 'not unit owner');

            // check that entity owner is a realm
            let unit_entity_owner = get!(world, unit_id, EntityOwner);
            let unit_realm = get!(world, unit_entity_owner.entity_owner_id, Realm);
            assert(unit_realm.realm_id != 0, 'not owned by realm');

            // check that there is more than one entity in unit
            let mut unit_quantity = get!(world, unit_id, Quantity);
            assert(unit_quantity.value > 1, 'not enough quantity');

            // check that unit isn't carrying anything
            let unit_inventory = get!(world, unit_id, Inventory);
            assert(unit_inventory.items_count == 0, 'unit inventory not empty');

            let unit_movable = get!(world, unit_id, Movable);
            assert(unit_movable.blocked == false, 'unit is blocked');

            let unit_arrival = get!(world, unit_id, ArrivalTime);
            assert(
                unit_arrival.arrives_at <= starknet::get_block_timestamp(), 
                    'unit is travelling'
            );




            // create a new unit 
            let mut unit_health = get!(world, unit_id, Health);
            let mut unit_attack = get!(world, unit_id, Attack);
            let mut unit_defence = get!(world, unit_id, Defence);

            let new_unit_health = (unit_health.value * detached_quantity ) / unit_quantity.value;
            let new_unit_attack = (unit_attack.value * detached_quantity ) / unit_quantity.value;
            let new_unit_defence = (unit_defence.value * detached_quantity ) / unit_quantity.value;

            let individual_capacity = 
                get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram;

            let individual_speed   
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km;

            let new_unit_id: u128 = world.uuid().into();

            let unit_position = get!(world, unit_id, Position);


            set!(world, (
                Owner {
                    entity_id: new_unit_id,
                    address: unit_owner.address
                },
                EntityOwner {
                    entity_id: new_unit_id,
                    entity_owner_id: unit_entity_owner.entity_owner_id
                },
                Health {
                    entity_id: new_unit_id,
                    value: new_unit_health
                },
                Attack {
                    entity_id: new_unit_id,
                    value: new_unit_attack
                },
                Defence {
                    entity_id: new_unit_id,
                    value: new_unit_defence 
                },
                Quantity { 
                    entity_id: new_unit_id,
                    value: detached_quantity
                },
                Position {
                    entity_id: new_unit_id,
                    x: unit_position.x,
                    y: unit_position.y
                },
                Inventory {
                    entity_id: new_unit_id,
                    items_key: world.uuid().into(),
                    items_count: 0
                },
                Capacity {
                    entity_id: new_unit_id,
                    weight_gram: individual_capacity
                },
                Movable {
                    entity_id: new_unit_id, 
                    sec_per_km: individual_speed, 
                    blocked: false,
                    round_trip: unit_movable.round_trip,
                    intermediate_coord_x: unit_movable.intermediate_coord_x,  
                    intermediate_coord_y: unit_movable.intermediate_coord_y,  
                }
            ));  


            // update the unit that we're creating a new unit from
            unit_health.value -= new_unit_health;
            unit_attack.value -= new_unit_attack;
            unit_defence.value -= new_unit_defence;
            unit_quantity.value -= detached_quantity;

            set!(world, (
                unit_health, 
                unit_attack, 
                unit_defence, 
                unit_quantity
            ));

            new_unit_id
      
        }





        /// Remove all soldiers from a unit and make them individual soldiers
        ///
        /// Note: If the unit is a raiding unit, they must not hold any resources
        ///       in their inventory.
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `unit_id` - The unit's entity id
        ///
        fn merge_soldiers(
            self: @ContractState, world: IWorldDispatcher, 
            merge_into_unit_id: u128, units: Span<(ID, u128)>
        ) {

            assert(units.len() > 0, 'need at least one unit');

            // ensure caller owns unit
            let caller = starknet::get_caller_address();
            let merge_into_unit_owner = get!(world, merge_into_unit_id, Owner);
            assert(merge_into_unit_owner.address == caller, 'not unit owner');
 

            // check that entity owner is a realm
            let merge_into_unit_entity_owner = get!(world, merge_into_unit_id, EntityOwner);
            let merge_into_unit_realm 
                = get!(world, merge_into_unit_entity_owner.entity_owner_id, Realm);
            assert(merge_into_unit_realm.realm_id != 0, 'not owned by realm');


            // ensure unit is not travelling 
            let merge_into_unit_arrival = get!(world, merge_into_unit_id, ArrivalTime);
            assert(
                merge_into_unit_arrival.arrives_at <= starknet::get_block_timestamp(),
                    'unit is travelling'
            );

            
            let mut merge_into_unit_health = get!(world, merge_into_unit_id, Health);
            let mut merge_into_unit_attack = get!(world, merge_into_unit_id, Attack);
            let mut merge_into_unit_defence = get!(world, merge_into_unit_id, Defence);
            let mut merge_into_unit_quantity = get!(world, merge_into_unit_id, Quantity);

            let merge_into_unit_position = get!(world, merge_into_unit_id, Position);

            let mut added_inventory_items: Array<u128> = array![];
            
            let mut index = 0; 
            loop {
                if index == units.len() {
                    break;
                }

                let (unit_id, amount) = *units.at(index);
                
                assert(amount > 0, 'invalid amount');

                let unit_owner = get!(world, unit_id, Owner);
                assert(unit_owner.address == caller, 'not unit owner');

                // ensure all units are owned by same realm
                let unit_entity_owner = get!(world, unit_id, EntityOwner);
                assert(
                    unit_entity_owner.entity_owner_id 
                        == merge_into_unit_entity_owner.entity_owner_id,
                            'not same entity owner'
                );


                let mut unit_quantity = get!(world, unit_id, Quantity);
                assert(unit_quantity.value >= amount, 'not enough quantity');

                let mut unit_inventory = get!(world, unit_id, Inventory);
                assert(unit_inventory.items_count == 0, 'inventory not empty');


                // ensure units are not travelling 
                let unit_arrival = get!(world, unit_id, ArrivalTime);
                assert(
                    unit_arrival.arrives_at <= starknet::get_block_timestamp(),
                        'unit is travelling'
                );


                // check that all units are at the same position
                
                let unit_position = get!(world, unit_id, Position);
                assert(
                    unit_position.x == merge_into_unit_position.x 
                        && unit_position.y == merge_into_unit_position.y,
                            'wrong position'
                );


                let mut unit_health = get!(world, unit_id, Health);
                let mut unit_attack = get!(world, unit_id, Attack);
                let mut unit_defence = get!(world, unit_id, Defence);

                let subtracted_health = unit_health.value * amount / unit_quantity.value;
                let subtracted_attack = unit_attack.value * amount / unit_quantity.value;
                let subtracted_defence = unit_defence.value * amount / unit_quantity.value;

                unit_health.value -= subtracted_health;
                unit_attack.value -= subtracted_attack;
                unit_defence.value -= subtracted_defence;
                unit_quantity.value -= amount;

                set!(world, (
                    unit_health, 
                    unit_attack, 
                    unit_defence, 
                    unit_quantity
                ));


                merge_into_unit_quantity.value += amount;
                merge_into_unit_health.value += subtracted_health;
                merge_into_unit_attack.value += subtracted_attack;
                merge_into_unit_defence.value += subtracted_defence;


                index += 1;
            };


            let individual_capacity = 
                get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram;

            let individual_speed   
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km;

            let mut merge_into_unit_movable = get!(world, merge_into_unit_id, Movable);
            let mut merge_into_unit_capacity = get!(world, merge_into_unit_id, Capacity);
            merge_into_unit_capacity.weight_gram = individual_capacity;
            merge_into_unit_movable.sec_per_km = individual_speed;

            
            set!(world, (
                merge_into_unit_health,
                merge_into_unit_attack,
                merge_into_unit_defence,
                merge_into_unit_quantity,

                merge_into_unit_capacity,
                merge_into_unit_movable,
            ));

        }


        /// Heal soldiers
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `unit_id` - The soldier or unit's entity id
        /// * `health_amount` - The amount of health you want to purchase.
        ///                     a unit's health ranges from 0 <= health <= max_health
        ///                     where max_health = max_health_value_per_soldier * quantity
        ///
        fn heal_soldiers( 
            self: @ContractState, world: IWorldDispatcher, unit_id: ID, health_amount: u128
        )  {

            let caller = starknet::get_caller_address();

            let unit_owner = get!(world, unit_id, Owner);
            assert(unit_owner.address == caller, 'not unit owner');

            let unit_realm_entity_id = get!(world, unit_id, EntityOwner).entity_owner_id;
            assert(unit_realm_entity_id != 0, 'invalid unit id');

            // check that entity owner is a realm
            let realm = get!(world, unit_realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');

            let mut unit_health = get!(world, unit_id, Health);
            let unit_quantity = get!(world, unit_id, Quantity);
            
            let soldier_health_config = get!(world, SOLDIER_ENTITY_TYPE, HealthConfig);

            let unit_max_health = soldier_health_config.max_value * unit_quantity.value;
            assert(unit_health.value + health_amount <= unit_max_health, 'max health exceeeded');

            // pay for the healing from the realm's resources
            let mut index = 0;
            loop {
                if index == soldier_health_config.resource_cost_count {
                    break;
                };

                let resource_cost 
                    = get!(world, (soldier_health_config.resource_cost_id, index), ResourceCost);
                let mut realm_resource 
                    = get!(world, (unit_realm_entity_id, resource_cost.resource_type), Resource);

                assert(
                    realm_resource.balance >= resource_cost.amount * health_amount,
                        'insufficient resources'
                );

                realm_resource.balance -= resource_cost.amount * health_amount;
                set!(world, (realm_resource));

                index += 1;
            };

            // heal the unit
            unit_health.value += health_amount;
            set!(world, (unit_health));

        }
    }



    #[external(v0)]
    impl CombatSystemsImpl of ICombatSystems<ContractState> {

        fn attack(
            self: @ContractState, world: IWorldDispatcher,
            attacker_ids: Span<u128>, target_realm_entity_id: u128
        ) {
            let caller = starknet::get_caller_address();

            let target_town_watch_id 
                = get!(world, target_realm_entity_id, Combat).town_watch_id;

            let mut target_town_watch_health = get!(world, target_town_watch_id, Health);
            assert(target_town_watch_health.value > 0, 'target is dead');


            let mut index = 0;
            let mut attackers_total_attack = 0;
            let mut attackers_total_defence = 0;
            let mut attackers_total_health = 0;
            let target_realm_position = get!(world, target_realm_entity_id, Position);
            loop {
                if index == attacker_ids.len() {
                    break;
                }
                let attacker_id = *attacker_ids.at(index);

                let attacker_owner = get!(world, attacker_id, Owner);
                assert(attacker_owner.address == caller, 'not attacker owner');

                let mut attacker_health = get!(world, attacker_id, Health);
                assert(attacker_health.value > 0, 'attacker is dead');

                let attacker_arrival = get!(world, attacker_id, ArrivalTime);
                assert(
                    attacker_arrival.arrives_at <= starknet::get_block_timestamp(),
                        'attacker is travelling'
                );


                let attacker_position = get!(world, attacker_id, Position);

                assert(
                    attacker_position.x == target_realm_position.x
                        && attacker_position.y == target_realm_position.y,
                            'position mismatch'
                );
                

                attackers_total_attack += get!(world, attacker_id, Attack).value;
                attackers_total_defence += get!(world, attacker_id, Defence).value;
                attackers_total_health += get!(world, attacker_id, Health).value;

                index +=1;
            };

            

            let mut target_town_watch_attack = get!(world, target_town_watch_id, Attack);
            let mut target_town_watch_defense = get!(world, target_town_watch_id, Defence);

            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![
                    attackers_total_attack * attackers_total_health, 
                    target_town_watch_defense.value * target_town_watch_health.value
                ].span(), 
                array![].span(), 1
            )[0];

            if attack_successful {
                // attack was a success && attacker dealt damage to target

                // get damage to target based on the attacker's attack value 
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );
                let damage = (attackers_total_attack * damage_percent) / 100;

                
                target_town_watch_health.value -= min(damage, target_town_watch_health.value);

                set!(world, (target_town_watch_attack, target_town_watch_defense, target_town_watch_health));


            } else {

                // attack failed && target dealt damage to attacker

                // get damage to attacker based on the target's attack value 
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );
                let mut damage = (target_town_watch_attack.value * damage_percent) / 100;

                // share damage between attackers
                damage = damage / attacker_ids.len().into();

                let mut index = 0;
                loop {
                    if index == attacker_ids.len() {
                        break;
                    }

                    let attacker_id = *attacker_ids.at(index);
                    
                    let mut attacker_attack = get!(world, attacker_id, Attack);
                    let mut attacker_defence = get!(world, attacker_id, Defence);
                    let mut attacker_health = get!(world, attacker_id, Health);

                    attacker_health.value -= min(damage, attacker_health.value);

                    set!(world, (attacker_attack, attacker_defence, attacker_health));

                    index += 1;
                };
            }

            // emit combat event
            let winner = if attack_successful {
                Winner::Attacker
            } else {
                Winner::Target
            };

            let attacker_realm_entity_id 
                = get!(world, *attacker_ids.at(0), EntityOwner).entity_owner_id;
            emit!(world, CombatOutcome { 
                    attacker_realm_entity_id,
                    attacking_entity_ids: attacker_ids,
                    target_realm_entity_id,
                    winner,
                    stolen_resource_types: array![].span(),
                    stolen_resource_amounts: array![].span()
             });

        }



        fn steal(
            self: @ContractState, world: IWorldDispatcher,
            attacker_id: u128, target_realm_entity_id: u128
        ) {
            // check that target is a realm
            let target_realm = get!(world, target_realm_entity_id, Realm);
            assert(target_realm.realm_id != 0, 'target not realm');

            let caller = starknet::get_caller_address();

            let attacker_owner = get!(world, attacker_id, Owner);
            assert(attacker_owner.address == caller, 'not attacker owner');
                                    
            let mut attacker_health = get!(world, attacker_id, Health);
            assert(attacker_health.value > 0, 'attacker is dead');

            let attacker_arrival = get!(world, attacker_id, ArrivalTime);
            assert(
                attacker_arrival.arrives_at <= starknet::get_block_timestamp(),
                    'attacker is travelling'
            );


         
            
            let attacker_position = get!(world, attacker_id, Position);
            let target_realm_position = get!(world, target_realm_entity_id, Position);

            assert(
                attacker_position.x == target_realm_position.x
                    && attacker_position.y == target_realm_position.y,
                        'position mismatch'
            );
            

            let mut attacker_attack = get!(world, attacker_id, Attack);
            let mut attacker_defence = get!(world, attacker_id, Defence);
            
            let target_town_watch_id 
                = get!(world, target_realm_entity_id, Combat).town_watch_id;

            let target_town_watch_health = get!(world, target_town_watch_id, Health);
            let target_town_watch_attack = get!(world, target_town_watch_id, Attack);
            let target_town_watch_defense = get!(world, target_town_watch_id, Defence);

            
            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![
                    attacker_attack.value * attacker_health.value, 
                    target_town_watch_defense.value * target_town_watch_health.value
                ].span(), 
                array![].span(), 1
            )[0];
            

            if attack_successful {
                // attack was a success 

                let mut stolen_resource_types: Array<u8> = array![];
                let mut stolen_resource_amounts: Array<u128> = array![];

                let attacker_capacity = get!(world, attacker_id, Capacity);
                let attacker_quantity = get!(world, attacker_id, Quantity);
                let attacker_total_weight_capacity 
                            = attacker_capacity.weight_gram * attacker_quantity.get_value();

                let mut attacker_current_weight = get!(world, attacker_id, Weight).value;
                let mut attacker_remaining_weight 
                    = attacker_total_weight_capacity - attacker_current_weight; 

                let (resource_types, resource_type_probabilities) 
                    = get_unzipped_resource_probabilities();

                let mut index = 0;

                // here we choose x number of resources (with replacement)
                // that the attacker can get away with 
                let combat_config = get!(world, COMBAT_CONFIG_ID, CombatConfig);
                let chosen_resource_types: Span<u8> = random::choices(
                    resource_types, resource_type_probabilities, 
                    array![].span(), combat_config.stealing_trial_count.into()
                );

                loop {

                    if index == chosen_resource_types.len() {
                        break;
                    }

                    let resource_type: u8 = *chosen_resource_types.at(index);

                    let resource_weight 
                        = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig).weight_gram;

                    let target_resource 
                        = get!(world, (target_realm_entity_id, resource_type), Resource);
                    let target_resource_weight = resource_weight * target_resource.balance;

                    if target_resource_weight > 0 {
                        let stolen_resource_amount 
                            = if (target_resource_weight + attacker_current_weight) 
                                <= attacker_total_weight_capacity {
                                
                                target_resource.balance
                            } else {

                                attacker_remaining_weight / resource_weight
                            };

                        if stolen_resource_amount > 0 {
                            attacker_current_weight 
                                += stolen_resource_amount * resource_weight;
                            attacker_remaining_weight
                                 -= stolen_resource_amount * resource_weight;

                            stolen_resource_types.append(resource_type);
                            stolen_resource_amounts.append(stolen_resource_amount);
                        }
                    }
                    index += 1;                
                };

                if stolen_resource_amounts.len() > 0 {
                    // create a resource chest for the attacker 
                    // and fill it with the stolen resources to it
                    let (attacker_resource_chest, _) 
                        = InternalResourceChestSystemsImpl::create(world, 
                            stolen_resource_types.span(), stolen_resource_amounts.span()
                        );
                    InternalResourceChestSystemsImpl::fill(
                        world, attacker_resource_chest.entity_id, target_realm_entity_id
                    );

                    // add the resource chest to the attacker's inventory
                    InternalInventorySystemsImpl::add(
                        world, 
                        attacker_id,
                        attacker_resource_chest.entity_id
                    );
                }

        
       
                let attacker_realm_entity_id 
                    = get!(world, attacker_id, EntityOwner).entity_owner_id;
                emit!(world, CombatOutcome { 
                        attacker_realm_entity_id,
                        attacking_entity_ids: array![attacker_id].span(),
                        target_realm_entity_id,
                        winner: Winner::Attacker,
                        stolen_resource_types: stolen_resource_types.span(),
                        stolen_resource_amounts: stolen_resource_amounts.span()
                });

            
            } else {
                
                // attack failed && target deals damage to attacker
                 
                
                // get damage to attacker based on the target's attack value 
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );
                let damage = (target_town_watch_attack.value * damage_percent) / 100;

                attacker_health.value -= min(damage, attacker_health.value);

                set!(world, (attacker_health));


                let attacker_realm_entity_id 
                    = get!(world, attacker_id, EntityOwner).entity_owner_id;
                emit!(world, CombatOutcome { 
                        attacker_realm_entity_id,
                        attacking_entity_ids: array![attacker_id].span(),
                        target_realm_entity_id,
                        winner: Winner::Target,
                        stolen_resource_types: array![].span(),
                        stolen_resource_amounts: array![].span()
                });
            }    


            // send attacker back to home realm
            let attacker_movable = get!(world, attacker_id, Movable);
            let attacker_entity_owner = get!(world, attacker_id, EntityOwner);
            let attacker_home_position 
                = get!(world, attacker_entity_owner.entity_owner_id, Position);
            InternalTravelSystemsImpl::travel(
                world, attacker_id, attacker_movable, 
                attacker_position.into(), attacker_home_position.into()
            );
        }
    }
}
