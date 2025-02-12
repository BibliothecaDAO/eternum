use s1_eternum::utils::math::{is_u64_bit_set, set_u64_bit};
use s1_eternum::alias::ID;

use dojo::{
    model::{ModelStorage, Model},
    world::WorldStorage,
};


#[derive(IntrospectPacked, PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct ResourceArrival {
    #[key]
    structure_id: ID,
    #[key]
    day: u64,
    hour_1: Span<(u8, u128)>,
    hour_2: Span<(u8, u128)>,
    hour_3: Span<(u8, u128)>,
    hour_4: Span<(u8, u128)>,
    hour_5: Span<(u8, u128)>,
    hour_6: Span<(u8, u128)>,
    hour_7: Span<(u8, u128)>,
    hour_8: Span<(u8, u128)>,
    hour_9: Span<(u8, u128)>,
    hour_10: Span<(u8, u128)>,
    hour_11: Span<(u8, u128)>,
    hour_12: Span<(u8, u128)>,
    hour_1_tracker: u64,
    hour_2_tracker: u64,
    hour_3_tracker: u64,
    hour_4_tracker: u64,
    hour_5_tracker: u64,
    hour_6_tracker: u64,
    hour_7_tracker: u64,
    hour_8_tracker: u64,
    hour_9_tracker: u64,
    hour_10_tracker: u64,
    hour_11_tracker: u64,
    hour_12_tracker: u64,
}

#[generate_trait]
impl ResourceArrivalImpl of ResourceArrivalTrait {
    fn increase_balance(
        resources: Span<(u8, u128)>,
        resource_index: u8,
        resource_type: u8,
        resource_tracker: u64,
        amount: u128,
    ) -> (Array<(u8, u128)>, u64) {
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
            (new_resources, new_resource_tracker)
        } else {
            // update resource in array
            let mut new_resources: Array<(u8, u128)> = resources.slice(0, index).into();
            new_resources.append(new_resource);
            new_resources.append_span(resources.slice(index + 1, resources.len() - (index + 1)).into());
            (new_resources, new_resource_tracker)
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

    fn read_resources(ref world: WorldStorage, structure_id: ID, day: u64, hour: u8) -> (Span<(u8, u128)>, u64) {
        let (resources_selector, resources_tracker_selector) = Self::hour_selectors(hour.into());
        let resources = world
            .read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_selector);
        let resources_tracker = world
            .read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_tracker_selector);
        return (resources, resources_tracker);
    }

    fn write_resources(
        ref world: WorldStorage,
        structure_id: ID,
        day: u64,
        hour: u8,
        resources: Span<(u8, u128)>,
        resources_tracker: u64,
    ) {
        let (resources_selector, resources_tracker_selector) = Self::hour_selectors(hour.into());
        world.write_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_selector, resources);
        world.write_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), resources_tracker_selector, resources_tracker);
    }

    fn hour_selectors(hour: felt252) -> (felt252, felt252) {
        match hour {
            0 => panic!("zero hour"),
            1 => (selector!("hour_1"), selector!("hour_1_tracker")),
            2 => (selector!("hour_2"), selector!("hour_2_tracker")),
            3 => (selector!("hour_3"), selector!("hour_3_tracker")),
            4 => (selector!("hour_4"), selector!("hour_4_tracker")),
            5 => (selector!("hour_5"), selector!("hour_5_tracker")),
            6 => (selector!("hour_6"), selector!("hour_6_tracker")),
            7 => (selector!("hour_7"), selector!("hour_7_tracker")),
            8 => (selector!("hour_8"), selector!("hour_8_tracker")),
            9 => (selector!("hour_9"), selector!("hour_9_tracker")),
            10 => (selector!("hour_10"), selector!("hour_10_tracker")),
            11 => (selector!("hour_11"), selector!("hour_11_tracker")),
            12 => (selector!("hour_12"), selector!("hour_12_tracker")),
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
    hour: u8,
    resources: Span<(ID, u8, u128)>, // (sender_structure_id, resource_type, amount)
}
