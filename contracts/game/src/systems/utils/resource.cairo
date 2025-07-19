use core::array::SpanTrait;
use core::num::traits::zero::Zero;
use dojo::world::WorldStorage;

use s1_eternum::alias::ID;
use s1_eternum::constants::{all_resource_ids, is_bank};
use s1_eternum::models::config::{SpeedImpl};
use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl,
};
use s1_eternum::models::troop::{ExplorerTroops};
use s1_eternum::models::weight::{Weight, WeightImpl};
use s1_eternum::systems::utils::distance::{iDistanceKmImpl};
use s1_eternum::systems::utils::donkey::{iDonkeyImpl};
use s1_eternum::systems::utils::village::{iVillageImpl};


#[generate_trait]
pub impl iResourceTransferImpl of iResourceTransferTrait {
    #[inline(always)]
    fn structure_to_structure_delayed(
        ref world: WorldStorage,
        from_structure_id: ID,
        from_structure_owner: starknet::ContractAddress,
        from_structure: StructureBase,
        ref from_structure_weight: Weight,
        to_structure_id: ID,
        to_structure_owner: starknet::ContractAddress,
        to_structure_base: StructureBase,
        ref to_structure_weight: Weight,
        mut resources: Span<(u8, u128)>,
        mint: bool,
        pickup: bool,
    ) {
        Self::_delayed_transfer(
            ref world,
            true,
            from_structure_id,
            from_structure_owner,
            from_structure,
            ref from_structure_weight,
            to_structure_id,
            to_structure_owner,
            to_structure_base,
            ref to_structure_weight,
            resources,
            mint,
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
    fn troop_burn_instant(
        ref world: WorldStorage,
        from_troop: ExplorerTroops,
        ref from_troop_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_burn(ref world, from_troop.explorer_id, ref from_troop_weight, resources);
    }

    #[inline(always)]
    fn structure_burn_instant(
        ref world: WorldStorage,
        from_structure_id: ID,
        ref from_structure_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_burn(ref world, from_structure_id, ref from_structure_weight, resources);
    }

    #[inline(always)]
    fn structure_weight_regularize(ref world: WorldStorage, from_structure_ids: Array<ID>) {
        let all_resources: Array<u8> = all_resource_ids();
        for structure_id in from_structure_ids {
            // ensure structure has an owner
            let structure_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            assert!(structure_owner.is_non_zero(), "structure has no owner");

            // ensure structure weight capacity is not zero
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            assert!(structure_weight.capacity.is_non_zero(), "structure weight capacity is zero");

            let mut new_total_weight: u128 = 0;
            for i in 0..all_resources.len() {
                let resource_type: u8 = *all_resources.at(i);
                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);

                // we use false here so that production is excluded
                let mut structure_resource = SingleResourceStoreImpl::retrieve(
                    ref world, structure_id, resource_type, ref structure_weight, resource_weight_grams, false,
                );
                new_total_weight += structure_resource.balance * resource_weight_grams;
            };

            if new_total_weight <= structure_weight.capacity {
                structure_weight.weight = new_total_weight;
                structure_weight.store(ref world, structure_id);
            }
        }
    }

    #[inline(always)]
    fn troop_to_structure_instant(
        ref world: WorldStorage,
        from_troop_id: ID,
        ref from_troop_weight: Weight,
        to_structure_id: ID,
        ref to_structure_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_arrivals_transfer(
            ref world, from_troop_id, ref from_troop_weight, to_structure_id, resources, false,
        );
    }

    #[inline(always)]
    fn structure_to_troop_instant(
        ref world: WorldStorage,
        from_structure_id: ID,
        ref from_structure_weight: Weight,
        to_troop_id: ID,
        ref to_troop_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::ensure_no_troop_resource(resources);
        Self::_instant_transfer(
            ref world, from_structure_id, ref from_structure_weight, to_troop_id, ref to_troop_weight, resources, false,
        );
    }

    fn structure_to_troop_raid_instant(
        ref world: WorldStorage,
        from_structure_id: ID,
        ref from_structure_weight: Weight,
        to_troop_id: ID,
        ref to_troop_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_transfer_storable(
            ref world, from_structure_id, ref from_structure_weight, to_troop_id, ref to_troop_weight, resources,
        );
    }


    #[inline(always)]
    fn portal_to_structure_arrivals_instant(
        ref world: WorldStorage, to_structure_id: ID, mut resources: Span<(u8, u128)>,
    ) {
        let from_id = 0;
        let mut from_weight = Default::default();
        Self::_instant_arrivals_transfer(ref world, from_id, ref from_weight, to_structure_id, resources, true);
    }


    fn _instant_transfer(
        ref world: WorldStorage,
        from_id: ID,
        ref from_weight: Weight,
        to_id: ID,
        ref to_weight: Weight,
        mut resources: Span<(u8, u128)>,
        mint: bool,
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
                    if mint == false {
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
                    to_resource.add(resource_amount, ref to_weight, resource_weight_grams);
                    to_resource.store(ref world);
                },
                Option::None => { break; },
            }
        };

        if mint == false {
            // update from_resource weight
            from_weight.store(ref world, from_id);
        }

        // update to_resource weight
        to_weight.store(ref world, to_id);
    }


    fn _instant_transfer_storable(
        ref world: WorldStorage,
        from_id: ID,
        ref from_weight: Weight,
        to_id: ID,
        ref to_weight: Weight,
        mut resources: Span<(u8, u128)>,
    ) {
        let mut resources_clone = resources.clone();
        loop {
            match resources_clone.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);

                    // update the resource amount to be the maximum storable amount
                    let (resource_amount, _) = SingleResourceImpl::storable_amount(
                        resource_amount, to_weight.unused(), resource_weight_grams,
                    );
                    if resource_amount.is_non_zero() {
                        // add resource to to_resource balance
                        let mut to_resource = SingleResourceStoreImpl::retrieve(
                            ref world, to_id, resource_type, ref to_weight, resource_weight_grams, true,
                        );
                        to_resource.add(resource_amount, ref to_weight, resource_weight_grams);
                        to_resource.store(ref world);

                        // spend from from_resource balance
                        let mut from_resource = SingleResourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, true,
                        );
                        from_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_resource.store(ref world);
                    }
                },
                Option::None => { break; },
            }
        };

        // update from_resource weight
        from_weight.store(ref world, from_id);

        // update to_resource weight
        to_weight.store(ref world, to_id);
    }

    fn _instant_arrivals_transfer(
        ref world: WorldStorage,
        from_id: ID,
        ref from_weight: Weight,
        to_id: ID,
        mut resources: Span<(u8, u128)>,
        mint: bool,
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
                    if mint == false {
                        let mut from_resource = SingleResourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, true,
                        );
                        from_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_resource.store(ref world);
                    }

                    // add resource to balance to the last open slot so it arrives immediately
                    let (arrival_day, arrival_slot) = ResourceArrivalImpl::previous_arrival_slot(ref world);
                    let mut realm_resources_array = ResourceArrivalImpl::read_slot(
                        ref world, to_id, arrival_day, arrival_slot,
                    );
                    let mut realm_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                        ref world, to_id, arrival_day,
                    );
                    ResourceArrivalImpl::slot_increase_balances(
                        ref realm_resources_array,
                        array![(resource_type, resource_amount)].span(),
                        ref realm_arrival_total_amount,
                    );
                    ResourceArrivalImpl::write_slot(ref world, to_id, arrival_day, arrival_slot, realm_resources_array);
                    ResourceArrivalImpl::write_day_total(ref world, to_id, arrival_day, realm_arrival_total_amount);
                },
                Option::None => { break; },
            }
        };

        if mint == false {
            // update from_resource weight
            from_weight.store(ref world, from_id);
        }
    }


    fn _delayed_transfer(
        ref world: WorldStorage,
        from_structure: bool,
        from_id: ID,
        from_owner: starknet::ContractAddress,
        from_structure_base: StructureBase,
        ref from_weight: Weight,
        to_id: ID,
        to_owner: starknet::ContractAddress,
        to_structure_base: StructureBase,
        ref to_weight: Weight,
        mut resources: Span<(u8, u128)>,
        mint: bool,
        pickup: bool,
    ) {
        assert!(from_id != 0, "from entity does not exist");
        assert!(to_id != 0, "to_structure does not exist");
        assert!(to_id != from_id, "from_structure and to_structure are the same");

        let from_coord = from_structure_base.coord();
        let to_coord = to_structure_base.coord();
        assert!(from_coord.is_non_zero(), "from_entity is not stationary");
        assert!(to_coord.is_non_zero(), "to_entity is not stationary");
        assert!(from_coord != to_coord, "from_entity and to_entity are in the same location");

        let donkey_speed = SpeedImpl::for_donkey(ref world);
        let travel_time = iDistanceKmImpl::time_required(ref world, from_coord, to_coord, donkey_speed, pickup);
        let (arrival_day, arrival_slot) = ResourceArrivalImpl::arrival_slot(ref world, travel_time);

        let mut to_structure_resources_array = ResourceArrivalImpl::read_slot(
            ref world, to_id, arrival_day, arrival_slot,
        );
        let mut to_structure_resource_arrival_day_total = ResourceArrivalImpl::read_day_total(
            ref world, to_id, arrival_day,
        );
        let mut total_resources_weight: u128 = 0;
        let mut index_count: u32 = 0;
        loop {
            if index_count >= resources.len() {
                break;
            }
            let (resource_type, resource_amount) = resources.at(index_count);
            let (resource_type, resource_amount) = (*resource_type, *resource_amount);

            // if the recipient is a village, and troops are being transferred,
            //  ensure the sender realm owner is the connected realm owner
            if to_structure_base.category == StructureCategory::Village.into() {
                // hack to check if it is from lp position.
                // todo: fix this
                let is_lp_position = is_bank(from_id) && mint == true && pickup == true && resources.len() == 2;
                if TroopResourceImpl::is_troop(resource_type) && !is_lp_position {
                    let village_structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
                        ref world, to_id,
                    );
                    iVillageImpl::ensure_village_realm(ref world, village_structure_metadata, from_id);
                }
            }

            // spend from from_structure balance
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let resource_weight: u128 = resource_amount * resource_weight_grams;
            total_resources_weight += resource_weight;

            if mint == false {
                let mut from_entity_resource = SingleResourceStoreImpl::retrieve(
                    ref world, from_id, resource_type, ref from_weight, resource_weight_grams, from_structure,
                );
                from_entity_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                from_entity_resource.store(ref world);
            }
            index_count += 1;
        };

        // add resource to to_structure resource arrivals
        ResourceArrivalImpl::slot_increase_balances(
            ref to_structure_resources_array, resources, ref to_structure_resource_arrival_day_total,
        );
        ResourceArrivalImpl::write_slot(ref world, to_id, arrival_day, arrival_slot, to_structure_resources_array);
        ResourceArrivalImpl::write_day_total(ref world, to_id, arrival_day, to_structure_resource_arrival_day_total);

        // determine which entity is providing the donkeys
        let mut donkey_provider_id = from_id;
        let mut donkey_provider_weight = from_weight;
        let mut donkey_provider_owner = from_owner;
        if pickup {
            donkey_provider_id = to_id;
            donkey_provider_weight = to_weight;
            donkey_provider_owner = to_owner;
        }

        // burn enough donkeys to carry resources from A to B
        let donkey_amount = iDonkeyImpl::needed_amount(ref world, total_resources_weight);
        iDonkeyImpl::burn(ref world, donkey_provider_id, ref donkey_provider_weight, donkey_amount);
        iDonkeyImpl::burn_finialize(ref world, donkey_provider_id, donkey_amount, donkey_provider_owner);

        if donkey_provider_id == from_id {
            from_weight = donkey_provider_weight;
        } else {
            to_weight = donkey_provider_weight;
        }

        // update both structures weights
        from_weight.store(ref world, from_id);
        to_weight.store(ref world, to_id);
    }

    fn _instant_burn(ref world: WorldStorage, from_id: ID, ref from_weight: Weight, mut resources: Span<(u8, u128)>) {
        let mut resources_clone = resources.clone();
        loop {
            match resources_clone.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // spend from from entity resource balance
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);

                    // false means dont check production for either troops or structures
                    let mut from_resource = SingleResourceStoreImpl::retrieve(
                        ref world, from_id, resource_type, ref from_weight, resource_weight_grams, false,
                    );
                    from_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                    from_resource.store(ref world);
                },
                Option::None => { break; },
            }
        };

        // update from entity resource weight
        from_weight.store(ref world, from_id);
    }

    fn deliver_arrivals(
        ref world: WorldStorage,
        to_structure_id: ID,
        ref to_structure_weight: Weight,
        mut day: u64,
        mut slot: u8,
        mut index_count: u8,
    ) {
        assert!(index_count.is_non_zero(), "index count is 0");

        let mut to_structure_resources_array = ResourceArrivalImpl::read_slot(ref world, to_structure_id, day, slot);
        let mut to_structure_resource_arrival_day_total = ResourceArrivalImpl::read_day_total(
            ref world, to_structure_id, day,
        );

        let arrived = ResourceArrivalImpl::slot_time_has_passed(ref world, day, slot);
        assert!(arrived, "The items have not arrived yet");

        // todo: delay delivery by day and slot
        let mut index_counted: u8 = 0;
        let mut total_amount_deposited: u128 = 0;
        loop {
            match to_structure_resources_array.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // add resource to to_structure balance
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                    let mut to_structure_resource = SingleResourceStoreImpl::retrieve(
                        ref world, to_structure_id, resource_type, ref to_structure_weight, resource_weight_grams, true,
                    );
                    to_structure_resource.add(resource_amount, ref to_structure_weight, resource_weight_grams);
                    to_structure_resource.store(ref world);
                    total_amount_deposited += resource_amount;
                    // stop when necessary
                    index_counted += 1;
                    if index_counted >= index_count {
                        break;
                    }
                },
                Option::None => { break; },
            }
        };

        // update to_structure weight
        to_structure_weight.store(ref world, to_structure_id);

        // update resource arrival day total
        to_structure_resource_arrival_day_total -= total_amount_deposited;
        if to_structure_resource_arrival_day_total.is_zero() {
            // delete to_structure resource arrivals
            ResourceArrivalImpl::delete(ref world, to_structure_id, day);
        } else {
            // update to_structure resource arrivals
            ResourceArrivalImpl::write_slot(ref world, to_structure_id, day, slot, to_structure_resources_array);

            ResourceArrivalImpl::write_day_total(
                ref world, to_structure_id, day, to_structure_resource_arrival_day_total,
            );
        }
    }

    fn ensure_no_troop_resource(mut resources: Span<(u8, u128)>) {
        for i in 0..resources.len() {
            let (resource_type, _) = resources.at(i);
            if TroopResourceImpl::is_troop(*resource_type) {
                panic!("troop resource can't be transferred");
            }
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
