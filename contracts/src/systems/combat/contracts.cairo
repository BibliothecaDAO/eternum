#[dojo::contract]
mod combat_systems {
    use eternum::alias::ID;

    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::position::{Position, HomePosition};
    use eternum::models::config::{SpeedConfig, WeightConfig, CapacityConfig};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::inventory::Inventory;
    use eternum::models::capacity::Capacity;
    use eternum::models::weight::Weight;
    use eternum::models::owner::Owner;
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
        WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE
    };

    use eternum::utils::random::random;


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
            entity_id: u128, quantity: u128
        ) {


            let caller = starknet::get_caller_address();
            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == caller,
                    'not entity owner'
            );

            // check that entity is a realm
            let entity_realm = get!(world, entity_id, Realm);
            assert(entity_realm.realm_id != 0, 'not a realm');


            // todo@credence add payment here

            let entity_position = get!(world, entity_id, Position);
            let soldier_carry_capacity 
                =  InternalSoldierSystemsImpl::get_carry_capacity_per_soldier(world);

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
                    Health {
                        entity_id: soldier_id,
                        value: 100
                    },
                    Attack {
                        entity_id: soldier_id,
                        value: 100
                    },
                    Defence {
                        entity_id: soldier_id,
                        value: 100
                    },
                    Quantity {
                        entity_id: soldier_id,
                        value: 1
                    },
                    HomePosition {
                        entity_id: soldier_id,
                        x: entity_position.x,
                        y: entity_position.y
                    },
                    Position {
                        entity_id: soldier_id,
                        x: entity_position.x,
                        y: entity_position.y
                    },
                    Inventory {
                        entity_id: soldier_id,
                        items_key: world.uuid().into(),
                        items_count: 0
                    },
                    Movable {
                        entity_id: soldier_id, 
                        sec_per_km: InternalSoldierSystemsImpl::get_speed_per_soldier(world),
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

        ///  Create a group of soldiers and deploy them
        ///  assign them a duty.
        ///
        /// Note: no soldier should hold any resources in their inventory
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
            entity_id: u128, soldier_ids: Span<ID>, duty: Duty
        ) {
            assert(soldier_ids.len() > 1, 'single soldier group');

            let caller = starknet::get_caller_address();
            
            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == caller,
                    'not entity owner'
            );

            // check that entity is a realm
            let entity_realm = get!(world, entity_id, Realm);
            assert(entity_realm.realm_id != 0, 'not a realm');


            let entity_position = get!(world, entity_id, Position);
            let group_position = get!(world, *soldier_ids[0], Position);

            let ts = starknet::get_block_timestamp();

            let mut index = 0;
            let mut total_attack = 0;
            let mut total_defense = 0 ;
            let mut total_health = 0;
            let mut total_quantity = 0;
            let mut total_speed: u128 = 0;

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
                    HomePosition {
                        entity_id: soldier_id,
                        x: 0,
                        y: 0
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
                    }
                ));

                index += 1;
            };

            

            let group_id
                = match duty {
                    Duty::Attack => {

                        // create a new raiding unit

                        let raider_id: u128 = world.uuid().into();
                        let raider_speed = (total_speed / total_quantity).try_into().unwrap();

                        set!(world, (
                            Inventory {
                                entity_id: raider_id,
                                items_key: world.uuid().into(),
                                items_count: 0
                            },
                            Capacity {
                                entity_id: raider_id,
                                weight_gram: InternalSoldierSystemsImpl::get_carry_capacity_per_soldier(world)
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
                        assert(
                            entity_position.x == group_position.x
                                && entity_position.y == group_position.y,
                                    'group outside realm'
                        );
                        let entity_town_watch = get!(world, entity_id, TownWatch);
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
                HomePosition {
                    entity_id: group_id,
                    x: entity_position.x,
                    y: entity_position.y
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


            let group_attack = get!(world, group_id, Attack);
            let group_defense = get!(world, group_id, Defence);
            let group_position = get!(world, group_id, Position);
            let group_arrival = get!(world, group_id, ArrivalTime);
            let group_home_position = get!(world, group_id, HomePosition);

            let soldier_individual_health = group_health.value / group_quantity.value;
            let soldier_individual_attack = group_attack.value / group_quantity.value;
            let soldier_individual_defense = group_defense.value / group_quantity.value;
            
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
                        sec_per_km: InternalSoldierSystemsImpl::get_speed_per_soldier(world),
                        blocked: false,
                        round_trip: group_movable.round_trip,
                        intermediate_coord_x: group_movable.intermediate_coord_x,  
                        intermediate_coord_y: group_movable.intermediate_coord_y,  
                    },
                    HomePosition {
                        entity_id: soldier_id,
                        x: group_home_position.x,
                        y: group_home_position.y
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


    #[generate_trait]
    impl InternalSoldierSystemsImpl of InternalSoldierSystemsTrait {

        fn get_speed_per_soldier(world: IWorldDispatcher) -> u16 {
            get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km
        }

        fn get_carry_capacity_per_soldier(world: IWorldDispatcher) -> u128 {
            get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram
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


            // todo@credence calculate randomness with probability

            // get random value between 0 and 100
            let salt: u128 = starknet::get_block_timestamp().into();
            let random_value = random(salt, 100 + 1 );

            if random_value >= 50 {
                // attack was a success 

                let damage = (attacker_attack.value * random_value) / 100;
                let mut target_health = get!(world, target_id, Health);

                target_health.value -= damage;
                set!(world, (target_health));

            } else {

                // attack failed and target dealt damage to attacker

                let damage = (target_attack.value * (100 - random_value)) / 100;
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


            // todo@credence calculate randomness with probability

            // get random value between 0 and 100
            let salt: u128 = starknet::get_block_timestamp().into();
            let random_value = random(salt, 100 + 1 );

            let attacker_inventory = get!(world, attacker_id, Inventory);

            if random_value >= 50 {

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
                loop {
                    if index == trials {
                        break;
                    }

                    // todo@credence calculate resource with probability

                    let random_1000 = random(salt, 1000 + 1);
                    let resource_type = random_1000 % 28;
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

                // target deals damage to attacker
                let damage = (target_attack.value * (100 - random_value)) / 100;
                let mut attacker_health = get!(world, attacker_id, Health);

                attacker_health.value -= damage;
                set!(world, (attacker_health));

                // send attacker back to home realm
                let attacker_movable = get!(world, attacker_id, Movable);
                let attacker_home_position = get!(world, attacker_id, HomePosition);
                InternalTravelSystemsImpl::travel(
                    world, attacker_id, attacker_movable, 
                    attacker_position.into(), attacker_home_position.into()
                );
            }    
        }
    }
}
