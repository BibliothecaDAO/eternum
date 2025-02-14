use dojo::{model::{Model, ModelStorage}, world::WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::utils::math::{is_u64_bit_set, set_u64_bit};


#[derive(Introspect, PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct ResourceArrival {
    #[key]
    structure_id: ID,
    #[key]
    day: u64,
    slot_1: Span<(u8, u128)>,
    slot_2: Span<(u8, u128)>,
    slot_3: Span<(u8, u128)>,
    slot_4: Span<(u8, u128)>,
    slot_5: Span<(u8, u128)>,
    slot_6: Span<(u8, u128)>,
    slot_7: Span<(u8, u128)>,
    slot_8: Span<(u8, u128)>,
    slot_9: Span<(u8, u128)>,
    slot_10: Span<(u8, u128)>,
    slot_11: Span<(u8, u128)>,
    slot_12: Span<(u8, u128)>,
}


// no need to use this in client
#[derive(IntrospectPacked, PartialEq, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct ResourceArrivalTracker {
    #[key]
    structure_id: ID,
    #[key]
    day: u64,
    slot_1_tracker: u64,
    slot_2_tracker: u64,
    slot_3_tracker: u64,
    slot_4_tracker: u64,
    slot_5_tracker: u64,
    slot_6_tracker: u64,
    slot_7_tracker: u64,
    slot_8_tracker: u64,
    slot_9_tracker: u64,
    slot_10_tracker: u64,
    slot_11_tracker: u64,
    slot_12_tracker: u64,
    total_amount: u128,
}


#[generate_trait]
impl ResourceArrivalImpl of ResourceArrivalTrait {
    fn interval_hours() -> u64 {
        2 // resource arrival gate open every 2 hours
    }

    fn arrival_slot(ref world: WorldStorage, travel_time: u64) -> (u64, u8) {
        let arrival_interval_hours = Self::interval_hours();
        let arrival_time = starknet::get_block_timestamp() + travel_time;
        let day = arrival_time / 86400;
        let hour = (arrival_time % 86400) / 3600;

        // it time is between 00:00:00 and 01:59:59, then slot = 1
        // if time is between 02:00:00 and 03:59:59, then slot = 2
        // if time is between 04:00:00 and 05:59:59, then slot = 3
        // if time is between 06:00:00 and 07:59:59, then slot = 4
        // if time is between 08:00:00 and 09:59:59, then slot = 5
        // if time is between 10:00:00 and 11:59:59, then slot = 6
        // if time is between 12:00:00 and 13:59:59, then slot = 7
        // if time is between 14:00:00 and 15:59:59, then slot = 8
        // if time is between 16:00:00 and 17:59:59, then slot = 9
        // if time is between 18:00:00 and 19:59:59, then slot = 10
        // if time is between 20:00:00 and 21:59:59, then slot = 11
        // if time is between 22:00:00 and 23:59:59, then slot = 12

        let time_slot = (hour + arrival_interval_hours) / arrival_interval_hours;
        return (day, time_slot.try_into().unwrap());
    }


    fn increase_balance(
        ref total_amount: u128,
        ref resources: Span<(u8, u128)>,
        resource_index: u8,
        ref resource_tracker: u64,
        resource_type: u8,
        amount: u128,
    ) {
        let mut balance = 0;
        let mut index: u32 = resources.len();
        if Self::contains_resource(resource_tracker, resource_type) {
            // update balance and index if resource exists
            let (iresource_type, iresource_amount): (u8, u128) = *resources.at(resource_index.into());
            assert!(iresource_type == resource_type, "resource type mismatch");
            balance = iresource_amount;
            index = resource_index.into();
        }
        let new_balance = balance + amount;
        let new_resource: (u8, u128) = (resource_type, new_balance);
        let new_resource_tracker = Self::set_contains_resource(resource_tracker, resource_type, true);

        if index == resources.len() {
            // add resource to array
            let mut new_resources: Array<(u8, u128)> = resources.into();
            new_resources.append(new_resource);

            total_amount += amount;
            resources = new_resources.span();
            resource_tracker = new_resource_tracker;
        } else {
            // update resource in array
            let mut new_resources: Array<(u8, u128)> = resources.slice(0, index).into();
            new_resources.append(new_resource);
            new_resources.append_span(resources.slice(index + 1, resources.len() - (index + 1)).into());

            total_amount += amount;
            resources = new_resources.span();
            resource_tracker = new_resource_tracker;
        }
    }

    fn contains_resource(tracker: u64, resource_type: u8) -> bool {
        let pos = resource_type - 1;
        is_u64_bit_set(tracker, pos.into())
    }

    fn set_contains_resource(mut tracker: u64, resource_type: u8, value: bool) -> u64 {
        let pos = resource_type - 1;
        set_u64_bit(tracker, pos.into(), value)
    }

    fn delete(ref world: WorldStorage, structure_id: ID, day: u64) {
        let empty_resources: Span<(u8, u128)> = array![].span();
        let mut resource_arrival_model = ResourceArrival {
            structure_id,
            day,
            slot_1: empty_resources,
            slot_2: empty_resources,
            slot_3: empty_resources,
            slot_4: empty_resources,
            slot_5: empty_resources,
            slot_6: empty_resources,
            slot_7: empty_resources,
            slot_8: empty_resources,
            slot_9: empty_resources,
            slot_10: empty_resources,
            slot_11: empty_resources,
            slot_12: empty_resources,
        };
        world.erase_model(@resource_arrival_model);

        let mut resource_arrival_tracker_model: ResourceArrivalTracker = Default::default();
        resource_arrival_tracker_model.structure_id = structure_id;
        resource_arrival_tracker_model.day = day;
        world.erase_model(@resource_arrival_tracker_model);
    }

    fn read_resources(ref world: WorldStorage, structure_id: ID, day: u64, slot: u8) -> (Span<(u8, u128)>, u64, u128) {
        let (resources_selector, resources_tracker_selector) = Self::slot_selectors(slot.into());
        let resources = world
            .read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_selector);
        let resources_tracker = world
            .read_member(
                Model::<ResourceArrivalTracker>::ptr_from_keys((structure_id, day)), resources_tracker_selector,
            );
        let total_amount = world
            .read_member(
                Model::<ResourceArrivalTracker>::ptr_from_keys((structure_id, day)), selector!("total_amount"),
            );
        return (resources, resources_tracker, total_amount);
    }

    fn write_resources(
        ref world: WorldStorage,
        structure_id: ID,
        day: u64,
        slot: u8,
        resources: Span<(u8, u128)>,
        resources_tracker: u64,
        total_amount: u128,
    ) {
        let (resources_selector, resources_tracker_selector) = Self::slot_selectors(slot.into());
        world.write_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_selector, resources);
        world
            .write_member(
                Model::<ResourceArrivalTracker>::ptr_from_keys((structure_id, day)),
                resources_tracker_selector,
                resources_tracker,
            );
        world
            .write_member(
                Model::<ResourceArrivalTracker>::ptr_from_keys((structure_id, day)),
                selector!("total_amount"),
                total_amount,
            );
    }

    fn slot_selectors(hour: felt252) -> (felt252, felt252) {
        match hour {
            0 => panic!("zero hour"),
            1 => (selector!("slot_1"), selector!("slot_1_tracker")),
            2 => (selector!("slot_2"), selector!("slot_2_tracker")),
            3 => (selector!("slot_3"), selector!("slot_3_tracker")),
            4 => (selector!("slot_4"), selector!("slot_4_tracker")),
            5 => (selector!("slot_5"), selector!("slot_5_tracker")),
            6 => (selector!("slot_6"), selector!("slot_6_tracker")),
            7 => (selector!("slot_7"), selector!("slot_7_tracker")),
            8 => (selector!("slot_8"), selector!("slot_8_tracker")),
            9 => (selector!("slot_9"), selector!("slot_9_tracker")),
            10 => (selector!("slot_10"), selector!("slot_10_tracker")),
            11 => (selector!("slot_11"), selector!("slot_11_tracker")),
            12 => (selector!("slot_12"), selector!("slot_12_tracker")),
            _ => panic!("exceeds max hours"),
        }
    }
}


#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
struct ResourceSender {
    #[key]
    hash: felt252, // poseidon hash of structure_id, day, hour
    structure_id: ID,
    day: u64,
    slot: u8,
    resources: Span<(ID, u8, u128)> // (sender_structure_id, resource_type, amount)
}
