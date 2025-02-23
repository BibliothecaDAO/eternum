use core::array::SpanTrait;
use core::num::traits::zero::Zero;
use dojo::world::WorldStorage;

use s1_eternum::alias::ID;
use s1_eternum::models::config::{SpeedImpl};
use s1_eternum::models::position::{Coord};

use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::season::SeasonImpl;
use s1_eternum::models::structure::{StructureBase, StructureBaseImpl, StructureBaseStoreImpl};
use s1_eternum::models::troop::{ExplorerTroops};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::distance::{iDistanceImpl};
use s1_eternum::systems::utils::donkey::{iDonkeyImpl};

#[generate_trait]
pub impl iResourceTransferImpl of iResourceTransferTrait {
    #[inline(always)]
    fn structure_to_structure_instant(
        ref world: WorldStorage,
        from_structure_id: ID,
        from_structure: StructureBase,
        ref from_structure_weight: Weight,
        to_structure_id: ID,
        to_structure: StructureBase,
        ref to_structure_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_transfer(
            ref world,
            from_structure_id,
            ref from_structure_weight,
            to_structure_id,
            ref to_structure_weight,
            resources,
            false,
        );
    }


    #[inline(always)]
    fn structure_to_structure_delayed(
        ref world: WorldStorage,
        from_structure_id: ID,
        from_structure_owner: starknet::ContractAddress,
        from_structure: StructureBase,
        ref from_structure_weight: Weight,
        to_structure_id: ID,
        to_structure_coord: Coord,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
        free: bool,
        pickup: bool,
    ) {
        Self::_delayed_transfer(
            ref world,
            true,
            from_structure_id,
            from_structure_owner,
            from_structure.coord(),
            ref from_structure_weight,
            to_structure_id,
            to_structure_coord,
            to_structure_resource_indexes,
            resources,
            free,
            pickup,
        );
    }


    #[inline(always)]
    fn troop_to_troop_instant(
        ref world: WorldStorage,
        from_troop: ExplorerTroops,
        ref from_troop_weight: Weight,
        to_troop: ExplorerTroops,
        ref to_troop_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_transfer(
            ref world,
            from_troop.explorer_id,
            ref from_troop_weight,
            to_troop.explorer_id,
            ref to_troop_weight,
            resources,
            false,
        );
    }

    #[inline(always)]
    fn troop_to_structure_delayed(
        ref world: WorldStorage,
        ref from_troop: ExplorerTroops,
        ref from_troop_owner: starknet::ContractAddress,
        ref from_troop_weight: Weight,
        to_structure_id: ID,
        to_structure_coord: Coord,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
        pickup: bool,
    ) {
        Self::_delayed_transfer(
            ref world,
            true,
            from_troop.explorer_id,
            from_troop_owner,
            from_troop.coord,
            ref from_troop_weight,
            to_structure_id,
            to_structure_coord,
            to_structure_resource_indexes,
            resources,
            false,
            pickup,
        );
    }


    fn _instant_transfer(
        ref world: WorldStorage,
        from_id: ID,
        ref from_weight: Weight,
        to_id: ID,
        ref to_weight: Weight,
        mut resources: Span<(u8, u128)>,
        free: bool,
    ) {
        let mut resources_clone = resources.clone();

        loop {
            match resources_clone.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // spend from from_resource balance
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                    if free == false {
                        let mut from_resource = SingleResourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, true,
                        );
                        from_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_resource.store(ref world);
                    }

                    // add resource to balance
                    let mut to_resource = SingleResourceStoreImpl::retrieve(
                        ref world, to_id, resource_type, ref to_weight, resource_weight_grams, true,
                    );
                    to_resource.spend(resource_amount, ref to_weight, resource_weight_grams);
                    to_resource.store(ref world);
                },
                Option::None => { break; },
            }
        };

        if free == false {
            // update from_resource weight
            from_weight.store(ref world, from_id);
        }

        // update to_resource weight
        to_weight.store(ref world, to_id);
    }


    fn _delayed_transfer(
        ref world: WorldStorage,
        from_structure: bool,
        from_id: ID,
        from_owner: starknet::ContractAddress,
        from_coord: Coord,
        ref from_weight: Weight,
        to_id: ID,
        to_coord: Coord,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
        free: bool,
        pickup: bool,
    ) {
        assert!(from_id != 0, "from entity does not exist");
        assert!(to_id != 0, "to_structure does not exist");
        assert!(to_id != from_id, "from_structure and to_structure are the same");

        assert!(from_coord.is_non_zero(), "from_entity is not stationary");
        assert!(to_coord.is_non_zero(), "to_entity is not stationary");
        assert!(from_coord != to_coord, "from_entity and to_entity are in the same location");

        let mut resources_clone = resources.clone();
        let donkey_speed = SpeedImpl::for_donkey(ref world);
        let travel_time = starknet::get_block_timestamp()
            + iDistanceImpl::time_required(ref world, from_coord, to_coord, donkey_speed, pickup);
        let (arrival_day, arrival_slot) = ResourceArrivalImpl::arrival_slot(ref world, travel_time);

        let (
            mut to_structure_resources_array,
            mut to_structure_resources_tracker,
            mut to_structure_resource_arrival_total_amount,
        ) =
            ResourceArrivalImpl::read_resources(
            ref world, to_id, arrival_day, arrival_slot,
        );
        let mut total_resources_weight: u128 = 0;
        loop {
            match resources_clone.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // spend from from_structure balance
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                    let resource_weight: u128 = resource_amount * resource_weight_grams;
                    total_resources_weight += resource_weight;

                    if free == false {
                        let mut from_entity_resource = SingleResourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, from_structure,
                        );
                        from_entity_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_entity_resource.store(ref world);
                    }

                    // add resource to to_structure resource arrivals
                    let to_structure_resource_index = *(to_structure_resource_indexes.pop_front().unwrap());
                    ResourceArrivalImpl::increase_balance(
                        ref to_structure_resource_arrival_total_amount,
                        ref to_structure_resources_array,
                        to_structure_resource_index,
                        ref to_structure_resources_tracker,
                        resource_type,
                        resource_amount,
                    );
                },
                Option::None => { break; },
            }
        };

        // update to_structure resource arrivals
        ResourceArrivalImpl::write_resources(
            ref world,
            to_id,
            arrival_day,
            arrival_slot,
            to_structure_resources_array,
            to_structure_resources_tracker,
            to_structure_resource_arrival_total_amount,
        );

        if free == false {
            // burn enough donkeys to carry resources from from_structure to to_structure
            let from_entity_donkey_amount = iDonkeyImpl::needed_amount(ref world, total_resources_weight);
            iDonkeyImpl::burn(ref world, from_id, ref from_weight, from_entity_donkey_amount);
            iDonkeyImpl::burn_finialize(ref world, from_id, from_entity_donkey_amount, from_owner);

            // update from_structure weight
            from_weight.store(ref world, from_id);
        }
    }

    fn deliver_arrivals(
        ref world: WorldStorage,
        to_structure_id: ID,
        ref to_structure_weight: Weight,
        mut day: u64,
        mut slot: u8,
        mut resource_count: u8,
    ) {
        assert!(resource_count.is_non_zero(), "resource count is 0");

        let (
            mut to_structure_resources_array,
            mut to_structure_resources_tracker,
            mut to_structure_resource_arrival_total_amount,
        ) =
            ResourceArrivalImpl::read_resources(
            ref world, to_structure_id, day, slot,
        );
        let mut resource_index: u8 = 0;
        loop {
            match to_structure_resources_array.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // stop if we've reached the end of the resources specified
                    if resource_index + 1 > resource_count {
                        break;
                    }

                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                    // add resource to to_structure balance
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                    let mut to_structure_resource = SingleResourceStoreImpl::retrieve(
                        ref world, to_structure_id, resource_type, ref to_structure_weight, resource_weight_grams, true,
                    );
                    to_structure_resource.spend(resource_amount, ref to_structure_weight, resource_weight_grams);
                    to_structure_resource.store(ref world);

                    // update to_structure resource arrivals
                    ResourceArrivalImpl::increase_balance(
                        ref to_structure_resource_arrival_total_amount,
                        ref to_structure_resources_array,
                        resource_index,
                        ref to_structure_resources_tracker,
                        resource_type,
                        resource_amount,
                    );

                    resource_index += 1;
                },
                Option::None => { break; },
            }
        };

        // update to_structure weight
        to_structure_weight.store(ref world, to_structure_id);

        if to_structure_resource_arrival_total_amount.is_zero() {
            // delete to_structure resource arrivals
            ResourceArrivalImpl::delete(ref world, to_structure_id, day);
        } else {
            // update to_structure resource arrivals
            ResourceArrivalImpl::write_resources(
                ref world,
                to_structure_id,
                day,
                slot,
                to_structure_resources_array,
                to_structure_resources_tracker,
                to_structure_resource_arrival_total_amount,
            );
        }
    }


    fn _emit_event(
        ref world: WorldStorage, sender_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>,
    ) { // let mut sending_realm_id = 0;
    // let sending_realm: Realm = world.read_model(sender_structure_id);
    // if sending_realm.realm_id != 0 {
    //     sending_realm_id = sending_realm.realm_id;
    // } else {
    //     let sending_entity_owner: EntityOwner = world.read_model(sender_structure_id);
    //     sending_realm_id = sending_entity_owner.get_realm_id(world);
    // }

    // world
    //     .emit_event(
    //         @Transfer {
    //             recipient_structure_id,
    //             sending_realm_id,
    //             sender_structure_id,
    //             resources,
    //             timestamp: starknet::get_block_timestamp(),
    //         },
    //     );
    }
}
