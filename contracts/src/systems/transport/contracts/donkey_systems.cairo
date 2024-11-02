#[dojo::contract]
mod donkey_systems {
    use bushido_trophy::store::{Store, StoreTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;

    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE, ResourceTypes, RESOURCE_PRECISION};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::config::{SpeedConfig, CapacityConfig, CapacityConfigCategory, CapacityConfigCustomImpl};
    use eternum::models::movable::{Movable, MovableCustomImpl, ArrivalTime};
    use eternum::models::order::{Orders, OrdersCustomTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerCustomTrait};
    use eternum::models::position::{Coord, Position, TravelTrait, CoordTrait, Direction, PositionCustomTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceCustomImpl};
    use eternum::models::weight::Weight;

    use eternum::systems::resources::contracts::resource_systems::resource_systems::{
        ResourceSystemsImpl, InternalResourceSystemsImpl
    };
    use eternum::utils::tasks::index::{Task, TaskTrait};

    use starknet::ContractAddress;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: true)]
    struct BurnDonkey {
        #[key]
        player_address: ContractAddress,
        #[key]
        entity_id: ID,
        amount: u128,
        timestamp: u64,
    }

    #[generate_trait]
    pub impl InternalDonkeySystemsImpl of InternalDonkeySystemsTrait {
        fn burn_donkey(ref world: WorldStorage, payer_id: ID, weight: u128) {
            // get number of donkeys needed
            let donkey_amount = Self::get_donkey_needed(ref world, weight);

            // burn amount of donkey needed
            let mut donkeys: Resource = ResourceCustomImpl::get(ref world, (payer_id, ResourceTypes::DONKEY));
            donkeys.burn(donkey_amount);
            donkeys.save(ref world);

            // emit burn donkey event
            let time = starknet::get_block_timestamp();
            world
                .emit_event(
                    @BurnDonkey {
                        entity_id: payer_id,
                        player_address: starknet::get_caller_address(),
                        amount: donkey_amount,
                        timestamp: time
                    }
                );

            // [Achievement] Consume donkeys
            if donkey_amount != 0 {
                let count = (donkey_amount % core::integer::BoundedU32::max().into()).try_into().unwrap();
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id = Task::Breeder.identifier();
                // Raw version of emitting trophy progress when ContractState is not available
                let mut store = StoreTrait::new(world);
                store.update(player_id, task_id, count, time);
            }
        }

        fn return_donkey(ref world: WorldStorage, payer_id: ID, weight: u128) {
            // get number of donkeys needed
            let donkey_amount = Self::get_donkey_needed(ref world, weight);

            // return amount of donkey needed
            let mut donkeys: Resource = ResourceCustomImpl::get(ref world, (payer_id, ResourceTypes::DONKEY));
            donkeys.add(donkey_amount);
            donkeys.save(ref world);
        }

        fn create_donkey(
            ref world: WorldStorage,
            is_round_trip: bool,
            donkey_id: ID,
            receiver_id: ID,
            start_coord: Coord,
            intermediate_coord: Coord
        ) -> ID {
            let arrives_at: u64 = starknet::get_block_timestamp()
                + Self::get_donkey_travel_time(
                    ref world,
                    start_coord,
                    intermediate_coord,
                    MovableCustomImpl::sec_per_km(ref world, DONKEY_ENTITY_TYPE),
                    is_round_trip
                );

            let delivery_coord: Coord = intermediate_coord;
            world.write_model(@EntityOwner { entity_id: donkey_id, entity_owner_id: receiver_id, });
            world.write_model(@ArrivalTime { entity_id: donkey_id, arrives_at: arrives_at, });
            world.write_model(@Position { entity_id: donkey_id, x: delivery_coord.x, y: delivery_coord.y });
            world.write_model(@CapacityCategory { entity_id: donkey_id, category: CapacityConfigCategory::Donkey });

            return donkey_id;
        }

        fn get_donkey_needed(ref world: WorldStorage, resources_weight: u128,) -> u128 {
            let donkey_capacity = CapacityConfigCustomImpl::get(ref world, CapacityConfigCategory::Donkey);
            let reminder = resources_weight % donkey_capacity.weight_gram;
            let donkeys = if reminder == 0 {
                resources_weight / donkey_capacity.weight_gram
            } else {
                resources_weight / donkey_capacity.weight_gram + 1
            };
            donkeys * RESOURCE_PRECISION
        }

        fn get_donkey_travel_time(
            ref world: WorldStorage,
            resources_coord: Coord,
            destination_coord: Coord,
            sec_per_km: u16,
            round_trip: bool,
        ) -> u64 {
            // calculate arrival time
            let mut travel_time = resources_coord.calculate_travel_time(destination_coord, sec_per_km);
            // if it's a round trip, donkey has to travel back
            if round_trip {
                travel_time *= 2;
            };

            travel_time
        }
    }
}
