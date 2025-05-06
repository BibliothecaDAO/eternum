use core::dict::Felt252Dict;
use core::num::traits::Zero;
use dojo::{model::{Model, ModelStorage}, world::WorldStorage};
use s1_eternum::alias::ID;


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
    slot_13: Span<(u8, u128)>,
    slot_14: Span<(u8, u128)>,
    slot_15: Span<(u8, u128)>,
    slot_16: Span<(u8, u128)>,
    slot_17: Span<(u8, u128)>,
    slot_18: Span<(u8, u128)>,
    slot_19: Span<(u8, u128)>,
    slot_20: Span<(u8, u128)>,
    slot_21: Span<(u8, u128)>,
    slot_22: Span<(u8, u128)>,
    slot_23: Span<(u8, u128)>,
    slot_24: Span<(u8, u128)>,
    initialized: bool,
    // just used to track if any resources are in the arrival
    total_amount: u128,
}


#[generate_trait]
pub impl ResourceArrivalImpl of ResourceArrivalTrait {
    fn initialize(
        ref world: WorldStorage, structure_id: ID, day: u64, slot_selector: felt252, slot_resources: Span<(u8, u128)>,
    ) {
        let mut resource_arrival_model: ResourceArrival = Default::default();
        resource_arrival_model.structure_id = structure_id;
        resource_arrival_model.day = day;
        resource_arrival_model.initialized = true;

        if slot_selector == selector!("slot_1") {
            resource_arrival_model.slot_1 = slot_resources;
        } else if slot_selector == selector!("slot_2") {
            resource_arrival_model.slot_2 = slot_resources;
        } else if slot_selector == selector!("slot_3") {
            resource_arrival_model.slot_3 = slot_resources;
        } else if slot_selector == selector!("slot_4") {
            resource_arrival_model.slot_4 = slot_resources;
        } else if slot_selector == selector!("slot_5") {
            resource_arrival_model.slot_5 = slot_resources;
        } else if slot_selector == selector!("slot_6") {
            resource_arrival_model.slot_6 = slot_resources;
        } else if slot_selector == selector!("slot_7") {
            resource_arrival_model.slot_7 = slot_resources;
        } else if slot_selector == selector!("slot_8") {
            resource_arrival_model.slot_8 = slot_resources;
        } else if slot_selector == selector!("slot_9") {
            resource_arrival_model.slot_9 = slot_resources;
        } else if slot_selector == selector!("slot_10") {
            resource_arrival_model.slot_10 = slot_resources;
        } else if slot_selector == selector!("slot_11") {
            resource_arrival_model.slot_11 = slot_resources;
        } else if slot_selector == selector!("slot_12") {
            resource_arrival_model.slot_12 = slot_resources;
        } else if slot_selector == selector!("slot_13") {
            resource_arrival_model.slot_13 = slot_resources;
        } else if slot_selector == selector!("slot_14") {
            resource_arrival_model.slot_14 = slot_resources;
        } else if slot_selector == selector!("slot_15") {
            resource_arrival_model.slot_15 = slot_resources;
        } else if slot_selector == selector!("slot_16") {
            resource_arrival_model.slot_16 = slot_resources;
        } else if slot_selector == selector!("slot_17") {
            resource_arrival_model.slot_17 = slot_resources;
        } else if slot_selector == selector!("slot_18") {
            resource_arrival_model.slot_18 = slot_resources;
        } else if slot_selector == selector!("slot_19") {
            resource_arrival_model.slot_19 = slot_resources;
        } else if slot_selector == selector!("slot_20") {
            resource_arrival_model.slot_20 = slot_resources;
        } else if slot_selector == selector!("slot_21") {
            resource_arrival_model.slot_21 = slot_resources;
        } else if slot_selector == selector!("slot_22") {
            resource_arrival_model.slot_22 = slot_resources;
        } else if slot_selector == selector!("slot_23") {
            resource_arrival_model.slot_23 = slot_resources;
        } else if slot_selector == selector!("slot_24") {
            resource_arrival_model.slot_24 = slot_resources;
        }
        world.write_model(@resource_arrival_model);
    }

    fn interval_hours() -> u64 {
        1 // resource arrival gate open every 1 hour (24 slots per day)
    }

    fn last_slot() -> u8 {
        24
    }


    // todo: verify
    fn slot_time_has_passed(ref world: WorldStorage, day: u64, slot: u8) -> bool {
        let (last_open_slot_day, last_open_slot_hour) = Self::previous_arrival_slot(ref world, 0);

        if day < last_open_slot_day {
            return true;
        }

        if day == last_open_slot_day {
            if slot <= last_open_slot_hour {
                return true;
            } else {
                return false;
            }
        }
        return false;
    }


    fn previous_arrival_slot(ref world: WorldStorage, travel_time: u64) -> (u64, u8) {
        let (arrival_day, arrival_slot) = Self::arrival_slot(ref world, travel_time);
        if arrival_slot == 1 {
            // the last slot of the previous day
            (arrival_day - 1, Self::last_slot())
        } else {
            // the previous slot of the same day
            (arrival_day, arrival_slot - 1)
        }
    }

    fn arrival_slot(ref world: WorldStorage, travel_time: u64) -> (u64, u8) {
        let arrival_interval_hours = Self::interval_hours();
        let arrival_time = starknet::get_block_timestamp() + travel_time;
        let day = arrival_time / 86400;
        let hour = (arrival_time % 86400) / 3600;

        // Each hour corresponds to a slot (1-24)
        // if time is between 00:00:00 and 00:59:59, then slot = 1
        // if time is between 01:00:00 and 01:59:59, then slot = 2
        // ...
        // if time is between 23:00:00 and 23:59:59, then slot = 24

        let time_slot = (hour + arrival_interval_hours) / arrival_interval_hours;
        return (day, time_slot.try_into().unwrap());
    }


    fn slot_increase_balances(
        ref existing_resources: Span<(u8, u128)>, added_resources: Span<(u8, u128)>, ref total_amount: u128,
    ) {
        // todo check gas cost when both arrays are full

        // add existing resources to the dict
        let mut add_resource: Felt252Dict<u128> = Default::default();
        for (resource_type, amount) in added_resources {
            add_resource.insert((*resource_type).into(), *amount);
        };

        let mut new_resources: Array<(u8, u128)> = array![];
        for (resource_type, balance) in existing_resources {
            let mut balance = *balance;
            let mut amount = add_resource.get((*resource_type).into());
            if amount.is_non_zero() {
                balance += amount;
                total_amount += amount;
            }
            add_resource.insert((*resource_type).into(), 0);
            new_resources.append((*resource_type, balance));
        };

        for (resource_type, _) in added_resources {
            let mut amount = add_resource.get((*resource_type).into());
            if amount.is_non_zero() {
                new_resources.append((*resource_type, amount));
                total_amount += amount;
            }
        };
        existing_resources = new_resources.span();
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
            slot_13: empty_resources,
            slot_14: empty_resources,
            slot_15: empty_resources,
            slot_16: empty_resources,
            slot_17: empty_resources,
            slot_18: empty_resources,
            slot_19: empty_resources,
            slot_20: empty_resources,
            slot_21: empty_resources,
            slot_22: empty_resources,
            slot_23: empty_resources,
            slot_24: empty_resources,
            initialized: false,
            total_amount: 0,
        };
        world.erase_model(@resource_arrival_model);
    }

    fn read_day_total(ref world: WorldStorage, structure_id: ID, day: u64) -> u128 {
        let total_amount = world
            .read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), selector!("total_amount"));
        return total_amount;
    }

    fn read_slot(ref world: WorldStorage, structure_id: ID, day: u64, slot: u8) -> Span<(u8, u128)> {
        let slot_selector = Self::slot_selector(slot.into());
        let resources = world.read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), slot_selector);
        return resources;
    }

    fn write_slot(ref world: WorldStorage, structure_id: ID, day: u64, slot: u8, resources: Span<(u8, u128)>) {
        let slot_selector = Self::slot_selector(slot.into());

        // read the resource arrival tracker initialized flag
        // todo: check if this allows people create empty resource arrival models

        let initialized: bool = world
            .read_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), selector!("initialized"));
        if !initialized {
            Self::initialize(ref world, structure_id, day, slot_selector, resources);
        } else {
            world.write_member(Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), slot_selector, resources);
        }
    }

    fn write_day_total(ref world: WorldStorage, structure_id: ID, day: u64, total_amount: u128) {
        world
            .write_member(
                Model::<ResourceArrival>::ptr_from_keys((structure_id, day)), selector!("total_amount"), total_amount,
            );
    }

    fn slot_selector(hour: felt252) -> felt252 {
        match hour {
            0 => panic!("zero hour"),
            1 => selector!("slot_1"),
            2 => selector!("slot_2"),
            3 => selector!("slot_3"),
            4 => selector!("slot_4"),
            5 => selector!("slot_5"),
            6 => selector!("slot_6"),
            7 => selector!("slot_7"),
            8 => selector!("slot_8"),
            9 => selector!("slot_9"),
            10 => selector!("slot_10"),
            11 => selector!("slot_11"),
            12 => selector!("slot_12"),
            13 => selector!("slot_13"),
            14 => selector!("slot_14"),
            15 => selector!("slot_15"),
            16 => selector!("slot_16"),
            17 => selector!("slot_17"),
            18 => selector!("slot_18"),
            19 => selector!("slot_19"),
            20 => selector!("slot_20"),
            21 => selector!("slot_21"),
            22 => selector!("slot_22"),
            23 => selector!("slot_23"),
            24 => selector!("slot_24"),
            _ => panic!("exceeds max hours"),
        }
    }
}


impl ResourceArrivalDefault of Default<ResourceArrival> {
    fn default() -> ResourceArrival {
        let zero_span: Span<(u8, u128)> = array![].span();
        return ResourceArrival {
            structure_id: 0,
            day: 0,
            slot_1: zero_span,
            slot_2: zero_span,
            slot_3: zero_span,
            slot_4: zero_span,
            slot_5: zero_span,
            slot_6: zero_span,
            slot_7: zero_span,
            slot_8: zero_span,
            slot_9: zero_span,
            slot_10: zero_span,
            slot_11: zero_span,
            slot_12: zero_span,
            slot_13: zero_span,
            slot_14: zero_span,
            slot_15: zero_span,
            slot_16: zero_span,
            slot_17: zero_span,
            slot_18: zero_span,
            slot_19: zero_span,
            slot_20: zero_span,
            slot_21: zero_span,
            slot_22: zero_span,
            slot_23: zero_span,
            slot_24: zero_span,
            initialized: false,
            total_amount: 0,
        };
    }
}
