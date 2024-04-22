#[dojo::contract]
mod donkey_systems {
    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use eternum::models::config::{SpeedConfig, CapacityConfig};
    use eternum::models::inventory::{Inventory};
    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::models::weight::Weight;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::order::{Orders, OrdersTrait};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Coord, Position, TravelTrait, CoordTrait, Direction};
    use eternum::models::realm::Realm;
    use eternum::models::road::RoadImpl;
    use eternum::models::tick::{TickMove, TickMoveTrait};

    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};

    use eternum::systems::transport::interface::donkey_systems_interface::{IDonkeySystems};


    #[abi(embed_v0)]
    impl DonkeySystemsImpl of IDonkeySystems<ContractState> {
        fn send_donkeys(
            world: IWorldDispatcher,
            sender_entity_id: ID,
            amount: u128,
            destination_coord: Coord
        ) -> ID {
            let sender_entity_owner = get!(world, sender_entity_id, Owner);
            assert(
                sender_entity_owner.address == starknet::get_caller_address(), 'not owner of entity'
            );

            let sender_entity_position = get!(world, sender_entity_id, Position);
            let sender_entity_coord: Coord = sender_entity_position.into();
            assert(sender_entity_coord != destination_coord, 'entity is at destination');

            let resources = array![(ResourceTypes::DONKEY, amount)];

            InternalDonkeySystemsImpl::move_resources(
                world, sender_entity_id, sender_entity_id, resources.span(), sender_entity_coord, destination_coord, false
            )
        }


        fn send_resources(
            world: IWorldDispatcher,
            sender_entity_id: ID,
            resources: Span<(u8, u128)>,
            destination_coord: Coord
        ) -> ID {

            let sender_entity_owner = get!(world, sender_entity_id, Owner);
            assert(
                sender_entity_owner.address == starknet::get_caller_address(), 'not owner of entity'
            );

            let sender_entity_position = get!(world, sender_entity_id, Position);
            let sender_entity_coord: Coord = sender_entity_position.into();
            assert(sender_entity_coord != destination_coord, 'entity is at destination');

            InternalDonkeySystemsImpl::move_resources(
                world, sender_entity_id, sender_entity_id, resources, sender_entity_coord, destination_coord, true
            )

        }


        // same as send resources but:
        // - the resource sender and the donkey holder is not the same entity
        // - the donkeys do 2x travel time because round trip
        fn pickup_resources(            
            world: IWorldDispatcher,
            donkey_owner_entity_id: ID,
            resource_owner_entity_id: ID,
            resources: Span<(u8, u128)>,
            ) -> ID {

            let caller = starknet::get_caller_address();
            let donkey_owner = get!(world, donkey_owner_entity_id, Owner);
            assert(
                donkey_owner.address == caller, 'not owner of entity'
            );
            let resource_owner = get!(world, resource_owner_entity_id, Owner);
            assert(
                resource_owner.address == caller, 'not owner of entity'
            );

            let donkey_entity_position = get!(world, donkey_owner_entity_id, Position);
            let donkey_entity_coord: Coord = donkey_entity_position.into();
            let resource_owner_position = get!(world, resource_owner_entity_id, Position);
            let resource_owner_coord: Coord = resource_owner_position.into();
            assert(donkey_entity_coord != resource_owner_coord, 'entities on same position');

            InternalDonkeySystemsImpl::move_resources(
                world, resource_owner_entity_id, donkey_owner_entity_id, resources, resource_owner_coord, donkey_entity_coord, true
            )
        }
    }
        
        #[generate_trait]
        impl InternalDonkeySystemsImpl of InternalDonkeySystemsTrait { 
        fn move_resources(
            world: IWorldDispatcher,
            resource_owner_entity_id: ID,
            donkey_owner_entity_id: ID,
            resources: Span<(u8, u128)>,
            resources_coord: Coord,
            destination_coord: Coord,
            burn_donkeys: bool
        ) -> ID {

            let receiver_entity_id: u128 = world.uuid().into();
            // add inventory to make transfer function work
            set!(world, Inventory { entity_id: receiver_entity_id, items_key: world.uuid().into(), items_count: 0});

            // remove resources from sender id and add resources to new entity id
            let resource_chest_entity_id = InternalResourceSystemsImpl::transfer(
                world, resource_owner_entity_id, receiver_entity_id, resources
            );

            // get weight
            let resources_weight = get!(world, resource_chest_entity_id, Weight);

            if burn_donkeys {
                // get number of donkeys needed
                let donkey_amount = InternalDonkeySystemsImpl::get_donkey_needed(world, resources_weight.value);

                // burn amount of donkey needed
                let mut donkeys: Resource = ResourceImpl::get(
                    world, (donkey_owner_entity_id, ResourceTypes::DONKEY)
                );
                assert(donkeys.balance >= donkey_amount, 'not enough donkeys');
                donkeys.balance -= donkey_amount;
                donkeys.save(world);
            }

            let travel_time = InternalDonkeySystemsImpl::donkey_travel_time(world, resources_coord, destination_coord, donkey_owner_entity_id == resource_owner_entity_id);

            let ts = starknet::get_block_timestamp();

            let donkey_owner = get!(world, donkey_owner_entity_id, Owner);

            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: receiver_entity_id,
                        arrives_at: ts.into() + travel_time
                    },
                    Position { entity_id: receiver_entity_id, x: destination_coord.x, y: destination_coord.y },
                    Owner { entity_id: receiver_entity_id, address: donkey_owner.address }
                )
            );        

            resource_chest_entity_id
        }

        fn get_donkey_needed(
            world: IWorldDispatcher,
            resources_weight: u128,
        ) -> u128 {
            let capacity_per_donkey = get!(world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), CapacityConfig);
            resources_weight / capacity_per_donkey.weight_gram
        }

        fn donkey_travel_time(
            world: IWorldDispatcher,
            resources_coord: Coord,
            destination_coord: Coord,
            round_trip: bool,
        ) -> u64 {
            // get travel speed of entity
            let donkey_speed_config = get!(world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), SpeedConfig);

            // calculate arrival time
            let mut travel_time = resources_coord
                .calculate_travel_time(destination_coord, donkey_speed_config.sec_per_km);

            // reduce travel time if there is a road
            let mut travel_time = RoadImpl::use_road(world, travel_time, resources_coord, destination_coord);

            // if donkey and resource owner are different the donkey has to travel back
            if round_trip {
                travel_time *= 2;
            };

            travel_time
        }

    }
}