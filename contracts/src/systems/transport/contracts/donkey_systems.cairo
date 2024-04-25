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

    use eternum::systems::resources::contracts::resource_systems::{
        ResourceSystemsImpl, InternalResourceSystemsImpl
    };


    #[generate_trait]
    impl InternalDonkeySystemsImpl of InternalDonkeySystemsTrait {
        fn create_donkey(
            world: IWorldDispatcher,
            payer_id: ID,
            receiver_id: ID,
            weight: u128,
            start_coord: Coord,
            intermediate_coord: Coord
        ) -> ID {
            // get number of donkeys needed
            let donkey_amount = InternalDonkeySystemsImpl::get_donkey_needed(world, weight);

            // burn amount of donkey needed
            let mut donkeys: Resource = ResourceImpl::get(world, (payer_id, ResourceTypes::DONKEY));
            donkeys.burn(donkey_amount);
            donkeys.save(world);

            let donkey_speed_config = get!(
                world, (WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE), SpeedConfig
            );
            let donkey_id: ID = world.uuid().into();
            let is_round_trip: bool = payer_id == receiver_id;
            let arrives_at: u64 = starknet::get_block_timestamp()
                + InternalDonkeySystemsImpl::get_donkey_travel_time(
                    world,
                    start_coord,
                    intermediate_coord,
                    donkey_speed_config.sec_per_km,
                    is_round_trip
                );
            let delivery_coord: Coord = if is_round_trip {
                start_coord
            } else {
                intermediate_coord
            };

            set!(
                world,
                (
                    EntityOwner { entity_id: donkey_id, entity_owner_id: receiver_id, },
                    Inventory {
                        entity_id: donkey_id, items_key: world.uuid().into(), items_count: 0
                    },
                    ArrivalTime { entity_id: donkey_id, arrives_at: arrives_at, },
                    Position { entity_id: donkey_id, x: delivery_coord.x, y: delivery_coord.y }
                )
            );

            return donkey_id;
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
            sec_per_km: u16,
            round_trip: bool,
        ) -> u64 {
            // calculate arrival time
            let mut travel_time = resources_coord
                .calculate_travel_time(destination_coord, sec_per_km);

            // reduce travel time if there is a road
            let mut travel_time = RoadImpl::use_road(
                world, travel_time, resources_coord, destination_coord
            );

            // if it's a round trip, donkey has to travel back
            if round_trip {
                travel_time *= 2;
            };

            travel_time
        }
    }
}
