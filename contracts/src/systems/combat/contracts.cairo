#[dojo::contract]
mod combat_systems {
    use eternum::alias::ID;

    use eternum::models::resources::ResourceCost;
    use eternum::models::position::{Position, HomePosition};
    use eternum::models::config::SpeedConfig;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::owner::Owner;
    use eternum::models::quantity::Quantity;    
    use eternum::models::combat::{
        Health, Attack, Defence, Duty, TownWatch
    };

    use eternum::systems::combat::interface::{
        ISoldierSystems
    };

    use eternum::constants::{
        WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE
    };


    #[external(v0)]
    impl SoldierSystemsImpl of ISoldierSystems<ContractState> {

        fn create_soldiers( 
            self: @ContractState, world: IWorldDispatcher, 
            entity_id: u128, quantity: u128
        ) {

            // q: check if entity is a realm?

            let caller = starknet::get_caller_address();

            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == caller,
                    'not entity owner'
            );

            let entity_position = get!(world, entity_id, Position);

            // todo@credence add payment here

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
                    Movable {
                        entity_id: soldier_id, 
                        sec_per_km: InternalSoldierSystemsImpl::get_soldier_speed(world),
                        blocked: false,
                        round_trip: false,
                        intermediate_coord_x: 0,  
                        intermediate_coord_y: 0,  
                    },
                    ArrivalTime {
                        entity_id: soldier_id,
                        arrives_at: 0 // just being explicit
                    }
                ));

                 index += 1;
            };
        }

        //  Deploy a number of soldiers to carry out a duty
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

            let entity_position = get!(world, entity_id, Position);
            let group_position = get!(world, *soldier_ids[0], Position);


            let (group_id, group_can_travel) 
                = match duty {
                    Duty::Attack => {
                        let raider_id: u128 = world.uuid().into();
                        let raider_can_travel = true;
                        (raider_id, raider_can_travel)
                    },
                    Duty::Defence => {
                        assert(
                            entity_position.x == group_position.x
                                && entity_position.y == group_position.y,
                                    'group outside realm'
                        );
                        let entity_town_watch = get!(world, entity_id, TownWatch);
                        let town_watch_id = entity_town_watch.town_watch_id;
                        let town_watch_can_travel = false;

                        (town_watch_id, town_watch_can_travel)
                    }
                };

            let ts = starknet::get_block_timestamp();

            let mut index = 0;
            let mut total_attack = get!(world, group_id, Attack).value;
            let mut total_defense = get!(world, group_id, Defence).value;
            let mut total_health = get!(world, group_id, Health).value;
            let mut total_quantity = get!(world, group_id, Quantity).value;
            let mut total_speed: u128 = get!(world, group_id, Movable).sec_per_km.into();

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

                // check that it is a single soldier
                let soldier_quantity = get!(world, soldier_id, Quantity);
                assert(soldier_quantity.value == 1, 'not a single soldier');

                                
                let soldier_attack = get!(world, soldier_id, Attack);
                let soldier_defense = get!(world, soldier_id, Defence);
                let soldier_health = get!(world, soldier_id, Health);
                let soldier_quantity = get!(world, soldier_id, Quantity);
                let soldier_movable = get!(world, soldier_id, Movable);

                total_attack += soldier_attack.value.into();
                total_defense += soldier_defense.value.into();
                total_health += soldier_health.value.into();
                total_quantity += soldier_quantity.value.into();
                total_speed 
                    += soldier_movable.sec_per_km.into() * soldier_quantity.value.into();
                
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

            // this is prolly a bad formula to get average speed
            // but it shows the idea
            total_speed /= total_quantity;
            let total_speed: u16 = total_speed.try_into().unwrap();


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
                Movable {
                    entity_id: group_id, 
                    sec_per_km: total_speed, 
                    blocked: group_can_travel,
                    round_trip: false,
                    intermediate_coord_x: 0,  
                    intermediate_coord_y: 0,  
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
                },
                ArrivalTime {
                    entity_id: group_id,
                    arrives_at: 0 // just being explicit
                }
            ))
        }


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
                        sec_per_km: InternalSoldierSystemsImpl::get_soldier_speed(world),
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

        fn get_soldier_speed(world: IWorldDispatcher) -> u16 {
            get!(world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), SpeedConfig).sec_per_km
        }

    }
}
