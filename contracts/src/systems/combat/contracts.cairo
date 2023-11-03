#[dojo::contract]
mod combat_systems {
    use eternum::alias::ID;

    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::position::{Position};
    use eternum::models::config::{
        SpeedConfig, WeightConfig, CapacityConfig, 
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
        Attack, AttackTrait, 
        Health, Defence, Duty, TownWatch
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
        WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE,
        get_unzipped_resource_probabilities
    };

    use eternum::utils::random;


    #[external(v0)]
    impl SoldierSystemsImpl of ISoldierSystems<ContractState> {
        /// Create a number of soldiers for a realm
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `entity_id` - The realm's entity id of the realm
        /// * `quantity` - The number of soldiers to create
        ///
        fn create_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, quantity: u128
        ) {


            let caller = starknet::get_caller_address();
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(
                realm_owner.address == caller,
                    'not realm owner'
            );

            // check that entity is a realm
            let realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');


            // check that realm has enough resources to pay for the soldiers

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

            let realm_position = get!(world, realm_entity_id, Position);

            let soldier_carry_capacity 
                =  get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram;
            let soldier_speed 
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km; 
            let soldier_health_value
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), HealthConfig).value;
            let soldier_attack_value
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), AttackConfig).value;
            let soldier_defense_value
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), DefenceConfig).value;


            let mut index = 0;
            loop {
                if index == quantity {
                    break;
                }

                let soldier_id: u128 = world.uuid().into();
                set!(world, (
                    Owner {
                        entity_id: soldier_id,
                        address: caller
                    },
                    EntityOwner {
                        entity_id: soldier_id,
                        entity_owner_id: realm_entity_id
                    },
                    Health {
                        entity_id: soldier_id,
                        value: soldier_health_value
                    },
                    Attack {
                        entity_id: soldier_id,
                        value: soldier_attack_value
                    },
                    Defence {
                        entity_id: soldier_id,
                        value: soldier_defense_value
                    },
                    Quantity {
                        entity_id: soldier_id,
                        value: 1
                    },
                    Position {
                        entity_id: soldier_id,
                        x: realm_position.x,
                        y: realm_position.y
                    },
                    Inventory {
                        entity_id: soldier_id,
                        items_key: world.uuid().into(),
                        items_count: 0
                    },
                    Movable {
                        entity_id: soldier_id, 
                        sec_per_km: soldier_speed,
                        blocked: false,
                        round_trip: false,
                        intermediate_coord_x: 0,  
                        intermediate_coord_y: 0,  
                    },
                    Capacity {
                        entity_id: soldier_id,
                        weight_gram: soldier_carry_capacity 
                    },
                ));

                 index += 1;
            };
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
        /// * `soldier_ids` - The ids of the soldiers that'll make up the group
        /// * `duty` - The duty of the group which can be either attack or defence.
        ///             Those assigned to attack will be deployed to raid other realms
        ///             while those assigned to defence will be deployed to defend the realm.
        ///             This means those attacking can travel and hold resources in inventory
        ///             while those defending cannot as they are deployed to the realm's town watch.      
        ///             
        ///
        fn group_and_deploy_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, soldier_ids: Span<ID>, duty: Duty
        ) {

            let caller = starknet::get_caller_address();

            
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(
                realm_owner.address == caller,
                    'not entity owner'
            );


            // check that entity is a realm
            let realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');


            let mut index = 0;
            let mut total_attack = 0;
            let mut total_defense = 0 ;
            let mut total_health = 0;
            let mut total_quantity = 0;
            let mut total_speed: u128 = 0;

            let ts = starknet::get_block_timestamp();
            let group_position = get!(world, *soldier_ids[0], Position);

            loop {
                if index == soldier_ids.len() {
                    break;
                }

                let soldier_id = *soldier_ids[index];

                // check that all soldiers are in the same position
                let soldier_position = get!(world, soldier_id, Position);                
                assert(
                    soldier_position.x == group_position.x,
                    'soldiers wrong position'
                );

                // check that soldier is not travelling
                let soldier_arrival = get!(world, soldier_id, ArrivalTime);
                assert(
                    soldier_arrival.arrives_at <= ts, 
                        'soldier in transit'
                );
                
                // check that soldier_id is owned by caller
                let soldier_owner = get!(world, soldier_id, Owner);
                assert(soldier_owner.address == caller, 'not soldier owner');

                // check that soldier belongs to same realm
                let soldier_entity_owner = get!(world, soldier_id, EntityOwner);
                assert(
                    soldier_entity_owner.entity_owner_id == realm_entity_id,
                        'soldier wrong realm'
                );

                // check that soldier inventory is empty
                let soldier_inventory = get!(world, soldier_id, Inventory);
                assert(soldier_inventory.items_count == 0, 'soldier inventory not empty');

                // check that it is a single soldier
                let soldier_quantity = get!(world, soldier_id, Quantity);
                assert(soldier_quantity.value == 1, 'not a single soldier');

                let soldier_health = get!(world, soldier_id, Health);
                assert(soldier_health.value > 0, 'soldier is dead');

                let soldier_attack = get!(world, soldier_id, Attack);
                assert(soldier_attack.value > 0, 'soldier has no attack');

                let soldier_defense = get!(world, soldier_id, Defence);
                assert(soldier_defense.value > 0, 'soldier has no defense');

                let soldier_movable = get!(world, soldier_id, Movable);
                
                total_speed 
                    += soldier_movable.sec_per_km.into() * soldier_quantity.value.into();
                total_attack += soldier_attack.value.into();
                total_defense += soldier_defense.value.into();
                total_health += soldier_health.value.into();
                total_quantity += soldier_quantity.value.into();


                // delete soldier
                set!(world, (
                    Owner {
                        entity_id: soldier_id,
                        address: Zeroable::zero()
                    },
                    EntityOwner {
                        entity_id: soldier_id,
                        entity_owner_id: 0
                    },
                    Health {
                        entity_id: soldier_id,
                        value: 0
                    },
                    Attack {
                        entity_id: soldier_id,
                        value: 0
                    },
                    Defence {
                        entity_id: soldier_id,
                        value: 0
                    },
                    Quantity {
                        entity_id: soldier_id,
                        value: 0
                    },
                    Position {
                        entity_id: soldier_id,
                        x: 0,
                        y: 0
                    },
                    Movable {
                        entity_id: soldier_id, 
                        sec_per_km: 0,
                        blocked: false,
                        round_trip: false,
                        intermediate_coord_x: 0,  
                        intermediate_coord_y: 0,  
                    },
                    ArrivalTime {
                        entity_id: soldier_id,
                        arrives_at: 0 
                    },
                ));

                index += 1;
            };

            

            let group_id
                = match duty {
                    Duty::Attack => {

                        // create a new raiding unit

                        let raider_id: u128 = world.uuid().into();

                        // raider speed is the avaerage speed of all soldiers
                        let raider_speed = (total_speed / total_quantity).try_into().unwrap();
                        let raider_capacity = 
                            get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram;

                        set!(world, (
                            Inventory {
                                entity_id: raider_id,
                                items_key: world.uuid().into(),
                                items_count: 0
                            },
                            Capacity {
                                entity_id: raider_id,
                                weight_gram: raider_capacity
                            },
                            Movable {
                                entity_id: raider_id, 
                                sec_per_km: raider_speed, 
                                blocked: false,
                                round_trip: false,
                                intermediate_coord_x: 0,  
                                intermediate_coord_y: 0,  
                            }
                        ));
                        
                        raider_id
                    },
                    Duty::Defence => {

                        let realm_position = get!(world, realm_entity_id, Position);
                        assert(
                            realm_position.x == group_position.x
                                && realm_position.y == group_position.y,
                                    'group outside realm'
                        );
                        let entity_town_watch = get!(world, realm_entity_id, TownWatch);
                        let town_watch_id = entity_town_watch.town_watch_id;

                        set!(world, (
                            Movable {
                                entity_id: town_watch_id, 
                                sec_per_km: 0, 
                                blocked: true,
                                round_trip: false,
                                intermediate_coord_x: 0,  
                                intermediate_coord_y: 0 
                            }
                        ));

                        town_watch_id
                    }
                };



            total_attack += get!(world, group_id, Attack).value;
            total_defense += get!(world, group_id, Defence).value;
            total_health += get!(world, group_id, Health).value;
            total_quantity += get!(world, group_id, Quantity).value;


            set!(world, (
                Owner {
                    entity_id: group_id,
                    address: caller
                },
                EntityOwner {
                    entity_id: group_id,
                    entity_owner_id: realm_entity_id
                },
                Health {
                    entity_id: group_id,
                    value: total_health
                },
                Attack {
                    entity_id: group_id,
                    value: total_attack
                },
                Defence {
                    entity_id: group_id,
                    value: total_defense
                },
                Quantity {
                    entity_id: group_id,
                    value: total_quantity
                },
                Position {
                    entity_id: group_id,
                    x: group_position.x,
                    y: group_position.y
                }
            ));            
        }


        /// Remove all soldiers from a group and make them individual soldiers
        ///
        /// Note: If the group is a raiding unit, they must not hold any resources
        ///       in their inventory.
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `group_id` - The group's entity id
        ///
        fn ungroup_soldiers(
            self: @ContractState, world: IWorldDispatcher, group_id: ID
        ){

            let caller = starknet::get_caller_address();

            let group_owner = get!(world, group_id, Owner);
            assert(group_owner.address == caller, 'not group owner');

            let group_health = get!(world, group_id, Health);
            assert(group_health.value > 0, 'group is dead');

            let group_quantity = get!(world, group_id, Quantity);
            assert(group_quantity.value > 1, 'not a group');

            let group_movable = get!(world, group_id, Movable);
            assert(group_movable.blocked == false, 'group is blocked');

            let group_inventory = get!(world, group_id, Inventory);
            assert(group_inventory.items_count == 0, 'group inventory not empty');

            let group_arrival = get!(world, group_id, ArrivalTime);
            assert(
                    group_arrival.arrives_at <= starknet::get_block_timestamp(),
                        'group is travelling'
            );


            let group_entity_owner = get!(world, group_id, EntityOwner);
            let group_attack = get!(world, group_id, Attack);
            let group_defense = get!(world, group_id, Defence);
            let group_position = get!(world, group_id, Position);
            let group_arrival = get!(world, group_id, ArrivalTime);

            let soldier_individual_health = group_health.value / group_quantity.value;
            let soldier_individual_attack = group_attack.value / group_quantity.value;
            let soldier_individual_defense = group_defense.value / group_quantity.value;
            let soldier_individual_speed   
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km;
            
            let mut index = 0;
            loop {
                if index == group_quantity.value {
                    break;
                }

                let soldier_id: u128 = world.uuid().into();
                set!(world, (
                    Owner {
                        entity_id: soldier_id,
                        address: caller
                    },
                    EntityOwner {
                        entity_id: soldier_id,
                        entity_owner_id: group_entity_owner.entity_owner_id
                    },
                    Health {
                        entity_id: soldier_id,
                        value: soldier_individual_health
                    },
                    Attack {
                        entity_id: soldier_id,
                        value: soldier_individual_attack
                    },
                    Defence {
                        entity_id: soldier_id,
                        value: soldier_individual_defense
                    },
                    Quantity { 
                        entity_id: soldier_id,
                        value: 1
                    },
                    Movable {
                        entity_id: soldier_id, 
                        sec_per_km: soldier_individual_speed,
                        blocked: false,
                        round_trip: group_movable.round_trip,
                        intermediate_coord_x: group_movable.intermediate_coord_x,  
                        intermediate_coord_y: group_movable.intermediate_coord_y,  
                    },
                    Position {
                        entity_id: soldier_id,
                        x: group_position.x,
                        y: group_position.y
                    },
                    ArrivalTime {
                        entity_id: soldier_id,
                        arrives_at: group_arrival.arrives_at
                    }
                ));

                index += 1;
            };
        }
    }



    #[external(v0)]
    impl CombatSystemsImpl of ICombatSystems<ContractState> {

        fn attack(
            self: @ContractState, world: IWorldDispatcher,
            attacker_id: u128, target_id: u128
        ) {
            let caller = starknet::get_caller_address();

            let attacker_owner = get!(world, attacker_id, Owner);
            assert(attacker_owner.address == caller, 'no attacker owner');

            let attacker_health = get!(world, attacker_id, Health);
            assert(attacker_health.value > 0, 'attacker is dead');

            let attacker_arrival = get!(world, attacker_id, ArrivalTime);
            assert(
                attacker_arrival.arrives_at <= starknet::get_block_timestamp(),
                    'attacker is travelling'
            );

            let target_health = get!(world, target_id, Health);
            assert(target_health.value > 0, 'target is dead');

            let attacker_position = get!(world, attacker_id, Position);
            let target_position = get!(world, target_id, Position);

            assert(
                attacker_position.x == target_position.x
                    && attacker_position.y == target_position.y,
                        'position mismatch'
            );
            

            let attacker_attack = get!(world, attacker_id, Attack);
            let attacker_defence = get!(world, attacker_id, Defence);

            let target_attack = get!(world, target_id, Attack);
            let target_defense = get!(world, target_id, Defence);

            let attack_success_probability 
                = attacker_attack
                    .get_success_probability(target_defense.value);

            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![attack_success_probability, 100 - attack_success_probability].span(), 
                array![].span(), 1
            )[0];

            if attack_successful {
                // attack was a success 

                // get random damage
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );
                let damage = (attacker_attack.value * damage_percent) / 100;
                let mut target_health = get!(world, target_id, Health);

                target_health.value -= damage;
                set!(world, (target_health));

            } else {

                // attack failed and target dealt damage to attacker

                // get random damage
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );
                let damage = (target_attack.value * damage_percent) / 100;
                let mut attacker_health = get!(world, attacker_id, Health);

                attacker_health.value -= damage;
                set!(world, (attacker_health));
            }
        }



        fn steal(
            self: @ContractState, world: IWorldDispatcher,
            attacker_id: u128, target_id: u128
        ) {

            let caller = starknet::get_caller_address();

            let attacker_owner = get!(world, attacker_id, Owner);
            assert(attacker_owner.address == caller, 'no attacker owner');
                                    
            let attacker_health = get!(world, attacker_id, Health);
            assert(attacker_health.value > 0, 'attacker is dead');

            let attacker_arrival = get!(world, attacker_id, ArrivalTime);
            assert(
                attacker_arrival.arrives_at <= starknet::get_block_timestamp(),
                    'attacker is travelling'
            );

            
            let attacker_position = get!(world, attacker_id, Position);
            let target_position = get!(world, target_id, Position);

            assert(
                attacker_position.x == target_position.x
                    && attacker_position.y == target_position.y,
                        'position mismatch'
            );
            

            let attacker_attack = get!(world, attacker_id, Attack);
            let attacker_defence = get!(world, attacker_id, Defence);

            let target_attack = get!(world, target_id, Attack);
            let target_defense = get!(world, target_id, Defence);

            let attack_success_probability 
                = attacker_attack
                    .get_success_probability(target_defense.value);


            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![attack_success_probability, 100 - attack_success_probability].span(), 
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

                let trials = 5;
                let mut index = 0;
                let (resource_types, resource_type_probabilities) 
                    = get_unzipped_resource_probabilities();
                loop {
                    if index == trials {
                        break;
                    }

                    let resource_type: u128 = *random::choices(
                        resource_types, resource_type_probabilities, 
                        array![].span(), 1
                    )[0];

                    let resource_weight 
                        = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig).weight_gram;

                    let target_resource = get!(world, (target_id, resource_type), Resource);
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

                            stolen_resource_types.append(resource_type.try_into().unwrap());
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
                        world, attacker_resource_chest.entity_id, target_id
                    );

                    // add the resource chest to the attacker's inventory
                    InternalInventorySystemsImpl::add(
                        world, 
                        attacker_id,
                        attacker_resource_chest.entity_id
                    );
                }

            
            } else {
                
                // attack failed 

                // get random damage
                let salt: u128 = starknet::get_block_timestamp().into();
                let damage_percent = random::random(salt, 100 + 1 );

                // target deals damage to attacker
                let damage = (target_attack.value * damage_percent) / 100;
                let mut attacker_health = get!(world, attacker_id, Health);

                attacker_health.value -= damage;
                set!(world, (attacker_health));

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
}
