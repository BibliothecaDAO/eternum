#[dojo::contract]
mod caravan_systems {
    use core::poseidon::poseidon_hash_span;
    use eternum::alias::ID;

    use eternum::constants::{LevelIndex};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::caravan::CaravanMembers;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::inventory::Inventory;
    use eternum::models::metadata::ForeignKey;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, PositionTrait, Coord, TravelTrait};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::road::RoadImpl;
    use eternum::models::weight::Weight;

    use eternum::systems::leveling::contracts::leveling_systems::{
        InternalLevelingSystemsImpl as leveling
    };
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };
    use eternum::systems::transport::interface::caravan_systems_interface::{ICaravanSystems};

    use starknet::ContractAddress;

    #[generate_trait]
    impl InternalCaravanSystemsImpl of InternalCaravanSystemsTrait {
        fn check_owner(world: IWorldDispatcher, transport_id: ID, addr: ContractAddress) {
            let transport_owner = get!(world, transport_id, Owner);
            assert(transport_owner.address == addr, 'not caravan owner');
        }


        fn check_position(world: IWorldDispatcher, transport_id: ID, owner_id: ID) {
            let transport_position = get!(world, transport_id, Position);
            let owner_position = get!(world, owner_id, Position);
            assert(transport_position.x == owner_position.x, 'mismatched positions');
            assert(transport_position.y == owner_position.y, 'mismatched positions');
        }

        fn check_arrival_time(world: IWorldDispatcher, transport_id: ID) {
            let transport_arrival_time = get!(world, transport_id, ArrivalTime);
            assert(
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp().into(),
                'transport has not arrived'
            );
        }

        fn check_capacity(world: IWorldDispatcher, transport_id: ID, weight: u128) {
            let transport_weight = get!(world, transport_id, Weight);

            let transport_capacity = get!(world, transport_id, Capacity);
            let transport_quantity = get!(world, transport_id, Quantity);

            assert(
                transport_capacity
                    .can_carry_weight(
                        transport_quantity.get_value(), transport_weight.value + weight
                    ),
                'not enough capacity'
            );
        }


        fn get_travel_time(
            world: IWorldDispatcher, transport_id: ID, from_pos: Position, to_pos: Position
        ) -> (u64, u64) {
            let (caravan_movable, caravan_position) = get!(
                world, transport_id, (Movable, Position)
            );
            let mut one_way_trip_time = from_pos
                .calculate_travel_time(to_pos, caravan_movable.sec_per_km);

            // check if entity owner is a realm and apply bonuses if it is
            let entity_owner = get!(world, (transport_id), EntityOwner);
            let realm = get!(world, entity_owner.entity_owner_id, Realm);

            if realm.cities > 0 {
                one_way_trip_time =
                    InternalTravelSystemsImpl::use_travel_bonus(
                        world, @realm, @entity_owner, one_way_trip_time
                    );
            }

            let round_trip_time: u64 = 2 * one_way_trip_time;
            // reduce round trip time if there is a road
            let round_trip_time = RoadImpl::use_road(
                world, round_trip_time, caravan_position.into(), to_pos.into()
            );
            // update one way trip time incase round_trip_time was reduced
            one_way_trip_time = round_trip_time / 2;

            (round_trip_time, one_way_trip_time)
        }


        fn block(world: IWorldDispatcher, transport_id: ID) {
            let mut transport_movable = get!(world, transport_id, Movable);
            assert(transport_movable.blocked == false, 'transport is blocked');

            let transport_arrival_time = get!(world, transport_id, ArrivalTime);
            assert(
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp().into(),
                'transport in transit'
            );

            // update transport movable
            transport_movable.blocked = true;
            set!(world, (transport_movable))
        }


        fn unblock(world: IWorldDispatcher, transport_id: ID) {
            let mut transport_movable = get!(world, transport_id, Movable);
            assert(transport_movable.blocked == true, 'transport not blocked');

            // update transport movable
            transport_movable.blocked = false;
            set!(world, (transport_movable))
        }
    }
}
