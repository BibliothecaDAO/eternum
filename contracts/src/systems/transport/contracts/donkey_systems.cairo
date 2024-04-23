#[dojo::interface]
trait IDonkeySystems {
    fn send_donkeys(
        sender_entity_id: eternum::alias::ID,
        amount: u128,
        destination_coord: eternum::models::position::Coord
    ) -> eternum::alias::ID;
    fn send_resources(
        sender_entity_id: eternum::alias::ID,
        resources: Span<(u8, u128)>,
        destination_coord: eternum::models::position::Coord
    ) -> eternum::alias::ID;
    fn pickup_resources(
        donkey_owner_entity_id: eternum::alias::ID,
        resource_owner_entity_id: eternum::alias::ID,
        resources: Span<(u8, u128)>
    ) -> eternum::alias::ID;
}


#[dojo::contract]
mod donkey_systems {
    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes};
    use eternum::models::config::{SpeedConfig, CapacityConfig};
    use eternum::models::inventory::{Inventory};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::order::{Orders, OrdersTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerTrait};
    use eternum::models::position::{
        Coord, Position, TravelTrait, CoordTrait, Direction, PositionTrait
    };
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::models::road::RoadImpl;
    use eternum::models::tick::{TickMove, TickMoveTrait};
    use eternum::models::weight::Weight;

    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};


    #[abi(embed_v0)]
    impl DonkeySystemsImpl of super::IDonkeySystems<ContractState> {
        fn send_donkeys(
            world: IWorldDispatcher, sender_entity_id: ID, amount: u128, destination_coord: Coord
        ) -> ID {
            get!(world, sender_entity_id, Owner).assert_caller_owner();

            let sender_entity_coord = get!(world, sender_entity_id, Position);

            sender_entity_coord.assert_same_location(destination_coord);

            InternalDonkeySystemsImpl::move_resources(
                world,
                sender_entity_id,
                sender_entity_id,
                array![(ResourceTypes::DONKEY, amount)].span(),
                sender_entity_coord.into(),
                destination_coord,
                false
            )
        }


        fn send_resources(
            world: IWorldDispatcher,
            sender_entity_id: ID,
            resources: Span<(u8, u128)>,
            destination_coord: Coord
        ) -> ID {
            get!(world, sender_entity_id, Owner).assert_caller_owner();

            let sender_entity_coord = get!(world, sender_entity_id, Position);

            sender_entity_coord.assert_same_location(destination_coord);

            InternalDonkeySystemsImpl::move_resources(
                world,
                sender_entity_id,
                sender_entity_id,
                resources,
                sender_entity_coord.into(),
                destination_coord,
                true
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
            // check if caller is owner
            get!(world, donkey_owner_entity_id, Owner).assert_caller_owner();

            // check if resource owner is owner
            get!(world, resource_owner_entity_id, Owner).assert_caller_owner();

            let donkey_entity_coord = get!(world, donkey_owner_entity_id, Position);
            let resource_owner_coord: Coord = get!(world, resource_owner_entity_id, Position)
                .into();

            donkey_entity_coord.assert_not_same_location(resource_owner_coord);

            InternalDonkeySystemsImpl::move_resources(
                world,
                resource_owner_entity_id,
                donkey_owner_entity_id,
                resources,
                resource_owner_coord,
                donkey_entity_coord.into(),
                true
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
            set!(
                world,
                Inventory {
                    entity_id: receiver_entity_id, items_key: world.uuid().into(), items_count: 0
                }
            );

            // remove resources from sender id and add resources to new entity id
            let resource_chest_entity_id = InternalResourceSystemsImpl::transfer(
                world, resource_owner_entity_id, receiver_entity_id, resources
            );

            // get weight
            let resources_weight = get!(world, resource_chest_entity_id, Weight);

            if burn_donkeys {
                // get number of donkeys needed
                let donkey_amount = InternalDonkeySystemsImpl::get_donkey_needed(
                    world, resources_weight.value
                );

                // burn amount of donkey needed
                let mut donkeys: Resource = ResourceImpl::get(
                    world, (donkey_owner_entity_id, ResourceTypes::DONKEY)
                );

                donkeys.burn(donkey_amount);
                donkeys.save(world);
            }

            let travel_time = InternalDonkeySystemsImpl::get_donkey_travel_time(
                world,
                resources_coord,
                destination_coord,
                donkey_owner_entity_id == resource_owner_entity_id
            )
                + starknet::get_block_timestamp();

            let donkey_owner = get!(world, donkey_owner_entity_id, Owner).address;

            set!(
                world,
                (
                    ArrivalTime { entity_id: receiver_entity_id, arrives_at: travel_time },
                    Position {
                        entity_id: receiver_entity_id,
                        x: destination_coord.x,
                        y: destination_coord.y
                    },
                    Owner { entity_id: receiver_entity_id, address: donkey_owner }
                )
            );

            resource_chest_entity_id
        }

        fn get_donkey_needed(world: IWorldDispatcher, resources_weight: u128,) -> u128 {
            let capacity_per_donkey = get!(
                world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), CapacityConfig
            );
            resources_weight / capacity_per_donkey.weight_gram
        }

        fn get_donkey_travel_time(
            world: IWorldDispatcher,
            resources_coord: Coord,
            destination_coord: Coord,
            round_trip: bool,
        ) -> u64 {
            // get travel speed of entity
            let donkey_speed_config = get!(
                world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), SpeedConfig
            );

            // calculate arrival time
            let mut travel_time = resources_coord
                .calculate_travel_time(destination_coord, donkey_speed_config.sec_per_km);

            // reduce travel time if there is a road
            let mut travel_time = RoadImpl::use_road(
                world, travel_time, resources_coord, destination_coord
            );

            // if donkey and resource owner are different the donkey has to travel back
            if round_trip {
                travel_time *= 2;
            };

            travel_time
        }
    }
}
