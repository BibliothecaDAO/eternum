#[dojo::contract]
mod combat_systems {
    use eternum::alias::ID;

    use eternum::models::order::{Orders, OrdersTrait};
    use eternum::models::resources::{OwnedResourcesTracker, OwnedResourcesTrackerTrait};
    
    use eternum::models::resources::{Resource, ResourceCost, ResourceFoodImpl};
    use eternum::models::position::{Position};
    use eternum::models::config::{
        SpeedConfig, WeightConfig, CapacityConfig, CombatConfig,
        SoldierConfig, HealthConfig, AttackConfig, DefenceConfig,
        LevelingConfig
    };
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::inventory::Inventory;
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::capacity::Capacity;
    use eternum::models::weight::Weight;
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::realm::Realm;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::quantity::{Quantity, QuantityTrait};    
    use eternum::models::combat::{
        Attack, Health, Defence, Duty, TownWatch
    };
    

    use eternum::systems::combat::interface::{
        ISoldierSystems, ICombatSystems
    };
    use eternum::systems::resources::contracts::resource_systems::{
        InternalResourceSystemsImpl
    };

    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };

    use eternum::constants::{
        WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE, COMBAT_CONFIG_ID,
        REALM_LEVELING_CONFIG_ID,
        LevelIndex, HYPERSTRUCTURE_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_START_TIER,
        REALM_LEVELING_START_TIER
    };

    use eternum::utils::random;
    use eternum::utils::math::{min};
    use eternum::constants::ResourceTypes;    


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
        target_entity_id: u128,
        attacking_entity_ids: Span<u128>,
        stolen_resources: Span<(u8, u128)>,
        winner: Winner,
        damage: u128,
        ts: u64
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CombatOutcome: CombatOutcome,
    }



    #[external(v0)]
    impl SoldierSystemsImpl of ISoldierSystems<ContractState> {
        /// Create a raider unit for a realm
        /// 
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `realm_entity_id` - The realm's entity id of the realm
        /// * `quantity` - The number of soldiers in the new unit
        ///
        fn create_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, quantity: u128
        ) -> ID {

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

            assert(quantity > 0, 'invalid quantity value');


            // check that realm has enough resources to pay for the quantity
            // and subtract from balance if they do

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
            
            let individual_max_health_value
                = get!(world, SOLDIER_ENTITY_TYPE, HealthConfig).max_value;
            let individual_max_attack_value
                = get!(world, SOLDIER_ENTITY_TYPE, AttackConfig).max_value;
            let individual_max_defence_value
                = get!(world, SOLDIER_ENTITY_TYPE, DefenceConfig).max_value;
            let individual_capacity
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig).weight_gram;
            let individual_speed   
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km;

                                    
            let new_unit_id = world.uuid().into();


            set!(world, (
                Owner {
                    entity_id: new_unit_id,
                    address: realm_owner.address
                },
                EntityOwner {
                    entity_id: new_unit_id,
                    entity_owner_id: realm_entity_id
                },
                Health {
                    entity_id: new_unit_id,
                    value: individual_max_health_value * quantity
                },
                Attack {
                    entity_id: new_unit_id,
                    value: individual_max_attack_value * quantity
                },
                Defence {
                    entity_id: new_unit_id,
                    value: individual_max_defence_value * quantity 
                },
                Quantity { 
                    entity_id: new_unit_id,
                    value: quantity
                },
                Position {
                    entity_id: new_unit_id,
                    x: realm_position.x,
                    y: realm_position.y
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
                    round_trip: false,
                    start_coord_x: 0,
                    start_coord_y: 0,
                    intermediate_coord_x: 0,  
                    intermediate_coord_y: 0,  
                }
            ));  

            new_unit_id

        }

        ///  Detach soldiers from a unit
        ///
        ///  Note: no soldier should have any resource in their inventory
        ///        when calling this function. if they do, they must dispose
        ///        of the items before calling this function.
        ///
        ///  When new units are formed using this function,
        ///  they are free to roam the map and wage war irrespective of
        ///  of where they were detached from. E.g when you detach some soldiers from
        ///  the reserve unit, they are free to roam the map even though reserve's can't
        ///
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `unit_id` - The unit you want to remove soldiers from to form another group 
        /// * `detached_quantity` - The number of soldiers you want to 
        ///                         remove from unit_id to form another group   
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
                unit_arrival.arrives_at <= starknet::get_block_timestamp().into(), 
                    'unit is travelling'
            );


            // create a new unit 
            let mut unit_health = get!(world, unit_id, Health);
            let mut unit_attack = get!(world, unit_id, Attack);
            let mut unit_defence = get!(world, unit_id, Defence);

            let new_unit_health = (unit_health.value * detached_quantity ) / unit_quantity.value;
            let new_unit_attack = (unit_attack.value * detached_quantity ) / unit_quantity.value;
            let new_unit_defence = (unit_defence.value * detached_quantity ) / unit_quantity.value;

            let combat_unit_speed   
                = get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km;

            let new_unit_id: u128 = world.uuid().into();

            let unit_capacity = get!(world, unit_id, Capacity);
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
                    weight_gram: unit_capacity.weight_gram
                },
                Movable {
                    entity_id: new_unit_id, 
                    sec_per_km: combat_unit_speed, 
                    blocked: unit_movable.blocked,
                    round_trip: unit_movable.round_trip,
                    start_coord_x: unit_movable.start_coord_x,
                    start_coord_y: unit_movable.start_coord_y,
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





        /// Merge soldier units together
        ///
        /// This function would be useful, for example, if you want to 
        /// add some soldiers to the town watch after detaching them from 
        /// the realm's reserve unit.
        ///
        /// It could also be used to merge soldiers from a raiding unit
        /// into the town watch and vice versa
        ///
        /// It could also be used to merge two raiding units together
        /// 
        /// # Arguments
        ///
        /// * `world` - The world address
        /// * `merge_into_unit_id` - The unit you want to merge the other units into
        /// * `units` - The other units (unit ids and quantity) what would be merged
        ///
        /// Note: the `units` must not hold any resources in their inventory.
        ///
        fn merge_soldiers(
            self: @ContractState, world: IWorldDispatcher, 
            merge_into_unit_id: u128, units: Span<(ID, u128)>
        ) {

            assert(units.len() > 0, 'need at least one unit');

            // // ensure caller owns unit
            let caller = starknet::get_caller_address();
            // let merge_into_unit_owner = get!(world, merge_into_unit_id, Owner);
            // assert(merge_into_unit_owner.address == caller, 'not unit owner');
 

            // check that entity owner is a realm
            // let merge_into_unit_entity_owner = get!(world, merge_into_unit_id, EntityOwner);
            // let merge_into_unit_realm 
            //     = get!(world, merge_into_unit_entity_owner.entity_owner_id, Realm);
            // assert(merge_into_unit_realm.realm_id != 0, 'not owned by realm');


            // ensure unit is not blocked
            let merge_into_unit_movable = get!(world, merge_into_unit_id, Movable);
            assert(
                merge_into_unit_movable.blocked == false,
                    'unit is blocked'
            );


            // ensure unit is not travelling 
            let merge_into_unit_arrival = get!(world, merge_into_unit_id, ArrivalTime);
            assert(
                merge_into_unit_arrival.arrives_at <= starknet::get_block_timestamp().into(),
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

                // ensure all units are owned by same realm
                let unit_owner = get!(world, unit_id, Owner);
                assert(unit_owner.address == caller, 'not unit owner');

                // let unit_entity_owner = get!(world, unit_id, EntityOwner);
                // assert(
                //     unit_entity_owner.entity_owner_id 
                //         == merge_into_unit_entity_owner.entity_owner_id,
                //             'not same entity owner'
                // );


                let mut unit_quantity = get!(world, unit_id, Quantity);
                assert(unit_quantity.value >= amount, 'not enough quantity');

                let mut unit_inventory = get!(world, unit_id, Inventory);
                assert(unit_inventory.items_count == 0, 'inventory not empty');


                // ensure units is not blocked 
                let unit_movable = get!(world, unit_id, Movable);
                assert(
                    unit_movable.blocked == false,
                        'unit is blocked'
                );

                // ensure units are not travelling 
                let unit_arrival = get!(world, unit_id, ArrivalTime);
                assert(
                    unit_arrival.arrives_at <= starknet::get_block_timestamp().into(),
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
            
            set!(world, (
                merge_into_unit_health,
                merge_into_unit_attack,
                merge_into_unit_defence,
                merge_into_unit_quantity
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
            attacker_ids: Span<u128>, target_entity_id: u128
        ) {
            let caller = starknet::get_caller_address();

            let target_town_watch_id 
                = get!(world, target_entity_id, TownWatch).town_watch_id;
            
            let mut target_town_watch_health = get!(world, target_town_watch_id, Health);
            assert(target_town_watch_health.value > 0, 'target is dead');

            let ts = starknet::get_block_timestamp();

            let mut index = 0;
            let mut attackers_total_attack = 0;
            let mut attackers_total_defence = 0;
            let mut attackers_total_health = 0;
            let target_position = get!(world, target_entity_id, Position);
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
                    attacker_arrival.arrives_at <= ts.into(),
                        'attacker is travelling'
                );


                let attacker_position = get!(world, attacker_id, Position);

                assert(
                    attacker_position.x == target_position.x
                        && attacker_position.y == target_position.y,
                            'position mismatch'
                );
                

                attackers_total_attack += get!(world, attacker_id, Attack).value;
                attackers_total_defence += get!(world, attacker_id, Defence).value;
                attackers_total_health += get!(world, attacker_id, Health).value;

                index +=1;
            };

            let attacker_realm_entity_id 
                = get!(world, *attacker_ids.at(0), EntityOwner).entity_owner_id;
            let attacker_realm = get!(world, attacker_realm_entity_id, Realm );


            let mut target_town_watch_attack = get!(world, target_town_watch_id, Attack);
            let mut target_town_watch_defense = get!(world, target_town_watch_id, Defence);
            let mut target_town_watch_health = get!(world, target_town_watch_id, Health);

            // TODO: use the leveling helper function to get bonus


            /////// REALM LEVEL BONUS ///////
            let leveling_config: LevelingConfig = get!(world, REALM_LEVELING_CONFIG_ID, LevelingConfig);
            let attacker_level = get!(world, (attacker_realm_entity_id), Level);
            let attacker_level_bonus 
                = attacker_level.get_index_multiplier(
                    leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER
                    ) - 100;

            let target_level = get!(world, (target_entity_id), Level);
            let target_level_bonus 
                = target_level.get_index_multiplier(
                    leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER
                    ) - 100;

            ////// ORDER LEVEL BONUS //////

            // attacker order bonus
            let attacker_order = get!(world, attacker_realm.order, Orders);
            let attacker_order_bonus = attacker_order.get_bonus_multiplier();
            

            // defender order bonus (if it is a realm)      
            let target_realm = get!(world, target_entity_id, Realm);
            let target_order = get!(world, target_realm.order, Orders);
            let target_order_bonus = target_order.get_bonus_multiplier();



            let attackers_total_attack 
                    = attackers_total_attack 
                        + ((attackers_total_attack * attacker_level_bonus) / 100) 
                        + ((attackers_total_attack * attacker_order_bonus) / attacker_order.get_bonus_denominator());

            let target_total_attack = 
                    target_town_watch_attack.value 
                        + ((target_town_watch_attack.value * target_level_bonus) / 100) 
                        + ((target_town_watch_attack.value * target_order_bonus) / target_order.get_bonus_denominator());
            let target_total_defence = 
                    target_town_watch_defense.value 
                        + ((target_town_watch_defense.value * target_level_bonus) / 100) 
                        + ((target_town_watch_defense.value * target_order_bonus) / target_order.get_bonus_denominator());


            let mut damage: u128 = 0; 

            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![
                    attackers_total_attack * attackers_total_health, 
                    target_total_defence * target_town_watch_health.value
                ].span(), 
                array![].span(), 1, true
            )[0];

            if attack_successful {
                // attack was a success && attacker dealt damage to target

                // get damage to target based on the attacker's attack value 
                let salt: u128 = ts.into();
                let damage_percent = random::random(salt, 100 + 1 );
                damage = (attackers_total_attack * damage_percent) / 100;

                target_town_watch_health.value -= min(damage, target_town_watch_health.value);

                set!(world, (target_town_watch_attack, target_town_watch_defense, target_town_watch_health));

            } else {

                // attack failed && target dealt damage to attacker

                // get damage to attacker based on the target's attack value 
                let salt: u128 = ts.into();
                let damage_percent = random::random(salt, 100 + 1 );
                damage = (target_total_attack * damage_percent) / 100;

                // share damage between attackers
                damage = damage / attacker_ids.len().into();

                let mut index = 0;
                loop {
                    if index == attacker_ids.len() {
                        break;
                    }

                    let attacker_id = *attacker_ids.at(index);
                    let mut attacker_health = get!(world, attacker_id, Health);

                    attacker_health.value -= min(damage, attacker_health.value);
                    set!(world, (attacker_health));

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
                    target_entity_id,
                    stolen_resources: array![].span(),
                    winner,
                    damage,
                    ts,
             });

        }



        fn steal(
            self: @ContractState, world: IWorldDispatcher,
            attacker_id: u128, target_entity_id: u128
        ) {
            // check that target is a realm
            // let target_realm = get!(world, target_entity_id, Realm);
            
            // assert(target_realm.realm_id != 0, 'target not realm');

            let caller = starknet::get_caller_address();
            let ts = starknet::get_block_timestamp();

            let attacker_owner = get!(world, attacker_id, Owner);
            assert(attacker_owner.address == caller, 'not attacker owner');
                                    
            let mut attacker_health = get!(world, attacker_id, Health);
            assert(attacker_health.value > 0, 'attacker is dead');

            let attacker_arrival = get!(world, attacker_id, ArrivalTime);
            assert(
                attacker_arrival.arrives_at <= ts.into(),
                    'attacker is travelling'
            );
            
            let attacker_position = get!(world, attacker_id, Position);
            let target_position = get!(world, target_entity_id, Position);

            assert(
                attacker_position.x == target_position.x
                    && attacker_position.y == target_position.y,
                        'position mismatch'
            );
            

            let mut attacker_attack = get!(world, attacker_id, Attack);
            let mut attacker_defence = get!(world, attacker_id, Defence);
            
            let target_town_watch_id 
                = get!(world, target_entity_id, TownWatch).town_watch_id;

            let target_town_watch_health = get!(world, target_town_watch_id, Health);
            let target_town_watch_attack = get!(world, target_town_watch_id, Attack);
            let target_town_watch_defense = get!(world, target_town_watch_id, Defence);

            let attacker_realm_entity_id = get!(world, attacker_id, EntityOwner).entity_owner_id;
            let attacker_realm = get!(world, attacker_realm_entity_id, Realm );
            let combat_config = get!(world, COMBAT_CONFIG_ID, CombatConfig);

            let mut target_town_watch_attack = get!(world, target_town_watch_id, Attack);
            let mut target_town_watch_defense = get!(world, target_town_watch_id, Defence);
            let mut target_town_watch_health = get!(world, target_town_watch_id, Health);

            /////// REALM LEVEL BONUS ///////
            let leveling_config: LevelingConfig = get!(world, REALM_LEVELING_CONFIG_ID, LevelingConfig);
            let attacker_level = get!(world, (attacker_realm_entity_id), Level);
            let attacker_level_bonus 
                = attacker_level.get_index_multiplier(
                    leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER
                    ) - 100;

            let target_level = get!(world, (target_entity_id), Level);
            let target_level_bonus 
                = target_level.get_index_multiplier(
                    leveling_config, LevelIndex::COMBAT, REALM_LEVELING_START_TIER
                    ) - 100;


            ////// ORDER LEVEL BONUS //////

            // attacker order bonus
            let attacker_order = get!(world, attacker_realm.order, Orders);
            let attacker_order_bonus = attacker_order.get_bonus_multiplier();
            

            // defender order bonus (if it is a realm)      
            let target_realm = get!(world, target_entity_id, Realm);
            let target_order = get!(world, target_realm.order, Orders);
            let target_order_bonus = target_order.get_bonus_multiplier();

            // need to divide by 100**2 because level_bonus in precision 100
            let attackers_total_attack 
                    = attacker_attack.value 
                        + ((attacker_attack.value * attacker_level_bonus) / 100) 
                        + ((attacker_attack.value * attacker_order_bonus) / attacker_order.get_bonus_denominator());

            // need to divide by 100**2 because level_bonus in precision 100
            let target_total_attack = 
                    target_town_watch_attack.value 
                        + ((target_town_watch_attack.value * target_level_bonus) / 100) 
                        + ((target_town_watch_attack.value * target_order_bonus) / target_order.get_bonus_denominator());
            let target_total_defence = 
                    target_town_watch_defense.value 
                        + ((target_town_watch_defense.value * target_level_bonus) / 100) 
                        + ((target_town_watch_defense.value * target_order_bonus) / target_order.get_bonus_denominator());


            let attack_successful: bool = *random::choices(
                array![true, false].span(), 
                array![
                    attackers_total_attack * attacker_health.value, 
                    target_total_defence * target_town_watch_health.value
                ].span(), 
                array![].span(), 1, true
            )[0];
            

            if attack_successful {


                // burn target's food (fish and wheat)
                let attacker_quantity = get!(world, attacker_id, Quantity);
                let mut wheat_burn_amount = combat_config.wheat_burn_per_soldier * attacker_quantity.value;
                let mut fish_burn_amount = combat_config.fish_burn_per_soldier * attacker_quantity.value;
                ResourceFoodImpl::burn_food(
                    world, target_entity_id, wheat_burn_amount, fish_burn_amount, check_balance: false
                );


                // steal resources
                let mut stolen_resources: Array<(u8, u128)> = array![];

                let attacker_capacity = get!(world, attacker_id, Capacity);
                let attacker_total_weight_capacity 
                            = attacker_capacity.weight_gram * attacker_quantity.get_value();

                let mut attacker_current_weight = get!(world, attacker_id, Weight).value;
                let mut attacker_remaining_weight 
                    = attacker_total_weight_capacity - attacker_current_weight; 

                // get all the (stealable) resources that the target owns
                // and the probabilities of each resource's ocurence
                let entitys_resources = get!(world, target_entity_id, OwnedResourcesTracker);
                let (stealable_resource_types, stealable_resources_probs) 
                    =  entitys_resources.get_owned_resources_and_probs();



                let mut chosen_resource_types: Span<u8> = stealable_resource_types;
                if combat_config.stealing_trial_count.into() <= stealable_resource_types.len() {
                    // above, we use <= and not just < because if there are 2 resources and we want to choose 2
                    // we still want to pick the more probable resource first (and not just the first one)

                    // here we choose x number of resources that the attacker can get away with 
                    let choose_with_replacement = false;
                    chosen_resource_types = random::choices(
                        stealable_resource_types, stealable_resources_probs, 
                        array![].span(), combat_config.stealing_trial_count.into(), choose_with_replacement
                    );
                }

                let mut index = 0;

                loop {

                    if index == chosen_resource_types.len() {
                        break;
                    }

                    let resource_type: u8 = *chosen_resource_types.at(index);

                    let resource_weight 
                        = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig).weight_gram;

                    let target_resource 
                        = get!(world, (target_entity_id, resource_type), Resource);
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

                            stolen_resources.append(
                                (resource_type, stolen_resource_amount)
                            );
                        }
                    }
                    index += 1;                
                };

                if stolen_resources.len() > 0 {
                    // give stolen resources to attacker

                    InternalResourceSystemsImpl::transfer(
                        world,
                        target_entity_id,
                        attacker_id,
                        stolen_resources.span()
                    );
                    
                }

        
       
                let attacker_realm_entity_id 
                    = get!(world, attacker_id, EntityOwner).entity_owner_id;
                emit!(world, CombatOutcome { 
                        attacker_realm_entity_id,
                        attacking_entity_ids: array![attacker_id].span(),
                        target_entity_id,
                        stolen_resources: stolen_resources.span(),
                        winner: Winner::Attacker,
                        damage: 0,
                        ts
                });

            
            } else {
                
                // attack failed && target deals damage to attacker
                 
                
                // get damage to attacker based on the target's attack value 
                let salt: u128 = ts.into();
                let damage_percent = random::random(salt, 100 + 1 );
                let damage = (target_total_attack * damage_percent) / 100;

                attacker_health.value -= min(damage, attacker_health.value);

                set!(world, (attacker_health));


                let attacker_realm_entity_id 
                    = get!(world, attacker_id, EntityOwner).entity_owner_id;
                emit!(world, CombatOutcome { 
                        attacker_realm_entity_id,
                        attacking_entity_ids: array![attacker_id].span(),
                        target_entity_id,
                        stolen_resources: array![].span(),
                        winner: Winner::Target,
                        damage,
                        ts
                });
            }    


            // send attacker back to home realm
            let attacker_movable = get!(world, attacker_id, Movable);
            let attacker_home_position 
                = get!(world, attacker_realm_entity_id, Position);
            InternalTravelSystemsImpl::travel(
                world, attacker_id, attacker_movable, 
                attacker_position.into(), attacker_home_position.into()
            );
        }
    }
}
