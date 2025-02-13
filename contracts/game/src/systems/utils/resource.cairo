use core::array::ArrayTrait;
use core::array::SpanTrait;
use core::num::traits::Bounded;
use core::zeroable::Zeroable;
use dojo::event::EventStorage;
use dojo::model::ModelStorage;

use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use s1_eternum::alias::ID;

use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
use s1_eternum::models::config::{
     CapacityConfig, WeightConfig, WeightConfigImpl, SpeedImpl
};
use s1_eternum::models::owner::{EntityOwner, EntityOwnerTrait, Owner, OwnerTrait};
use s1_eternum::models::position::{Coord, Position};
use s1_eternum::models::quantity::{Quantity};
use s1_eternum::models::realm::Realm;
use s1_eternum::models::resource::resource::{ResourceAllowance};
use s1_eternum::models::season::SeasonImpl;
use s1_eternum::models::structure::{Structure, StructureCategory, StructureTrait};
use s1_eternum::models::weight::{W3eight, W3eightTrait};
use s1_eternum::models::resource::r3esource::{SingleR33esourceStoreImpl, SingleR33esourceImpl, WeightUnitImpl, WeightStoreImpl};
use s1_eternum::models::troop::{ExplorerTroops};
use s1_eternum::models::resource::arrivals::{ResourceArrival, ResourceArrivalImpl};
use s1_eternum::systems::utils::donkey::{iDonkeyImpl};
use s1_eternum::systems::utils::distance::{iDistanceImpl};

#[generate_trait]
pub impl iResourceImpl of iResourceTrait {

    #[inline(always)]
    fn structure_to_structure_instant(
        ref world: WorldStorage,
        ref from_structure: Structure,
        ref from_structure_weight: W3eight,
        ref to_structure: Structure,
        ref to_structure_weight: W3eight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_transfer(
            ref world, ref from_structure.entity_id, ref from_structure_weight, 
            ref to_structure.entity_id, ref to_structure_weight, resources, false);
    }


    #[inline(always)]
    fn structure_to_structure_delayed(
        ref world: WorldStorage,
        ref from_structure: Structure,
        ref from_structure_weight: W3eight,
        ref to_structure: Structure,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
        free: bool,
    ) {
        Self::_delayed_transfer(
            ref world, true, ref from_structure.entity_id, ref from_structure.owner, ref from_structure.coord, ref from_structure_weight, 
            ref to_structure, to_structure_resource_indexes, resources, free);
    }


    #[inline(always)]
    fn troop_to_troop_instant(
        ref world: WorldStorage,
        ref from_troop: ExplorerTroops,
        ref from_troop_weight: W3eight,
        ref to_troop: ExplorerTroops,
        ref to_troop_weight: W3eight,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_instant_transfer(
            ref world, ref from_troop.explorer_id, ref from_troop_weight, 
            ref to_troop.explorer_id, ref to_troop_weight, resources, false);
    }

    #[inline(always)]
    fn troop_to_structure_delayed(
        ref world: WorldStorage,
        ref from_troop: ExplorerTroops,
        ref from_troop_owner: Owner,
        ref from_troop_weight: W3eight,
        ref to_structure: Structure,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
    ) {
        Self::_delayed_transfer(
            ref world, true, ref from_troop.explorer_id, ref from_troop_owner, ref from_troop.coord, ref from_troop_weight, 
            ref to_structure, to_structure_resource_indexes, resources, false);
    }



    fn _instant_transfer(
        ref world: WorldStorage,
        ref from_id: ID,
        ref from_weight: W3eight,
        ref to_id: ID,
        ref to_weight: W3eight,
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
                    let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
                    if free == false {
                        let mut from_resource = SingleR33esourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, true,
                        );
                        from_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_resource.store(ref world);
                    }

                    // add resource to balance
                    let mut to_resource = SingleR33esourceStoreImpl::retrieve(
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
        ref from_id: ID,
        ref from_owner: Owner,
        ref from_coord: Coord,
        ref from_weight: W3eight,
        ref to_structure: Structure,
        mut to_structure_resource_indexes: Span<u8>,
        mut resources: Span<(u8, u128)>,
        free: bool, 
    ) {

        assert!(from_id != 0, "from entity does not exist");
        assert!(to_structure.entity_id != 0, "to_structure does not exist");
        assert!(to_structure.entity_id != from_id, "from_structure and to_structure are the same");
        
        assert!(from_coord.is_non_zero(), "from_entity is not stationary");
        assert!(to_structure.coord.is_non_zero(), "to_entity is not stationary");
        assert!(from_coord != to_structure.coord, "from_entity and to_entity are in the same location");


        let mut resources_clone = resources.clone();
        let to_structure_id = to_structure.entity_id;
        let donkey_speed = SpeedImpl::for_donkey(ref world);
        let travel_time 
            = starknet::get_block_timestamp() 
                + iDistanceImpl::time_required(
                    ref world, from_coord, to_structure.coord, donkey_speed, false);
        let (arrival_day, arrival_slot) 
            = ResourceArrivalImpl::arrival_slot(ref world, travel_time);

        let (mut to_structure_resources_array, mut to_structure_resources_tracker, mut to_structure_resource_arrival_total_amount) 
            = ResourceArrivalImpl::read_resources(ref world, to_structure_id, arrival_day, arrival_slot);
        let mut total_resources_weight: u128 = 0;
        loop {
            match resources_clone.pop_front() {
                Option::Some((
                    resource_type, resource_amount,
                )) => {
                    // spend from from_structure balance
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
                    let resource_weight: u128 = resource_amount * resource_weight_grams;
                    total_resources_weight += resource_weight;

                    if free == false {
                        let mut from_entity_resource = SingleR33esourceStoreImpl::retrieve(
                            ref world, from_id, resource_type, ref from_weight, resource_weight_grams, from_structure,
                        );
                        from_entity_resource.spend(resource_amount, ref from_weight, resource_weight_grams);
                        from_entity_resource.store(ref world);    
                    }

                    // add resource to to_structure resource arrivals
                    let to_structure_resource_index = *(to_structure_resource_indexes.pop_front().unwrap());
                    ResourceArrivalImpl::increase_balance(
                        ref to_structure_resource_arrival_total_amount,
                        ref to_structure_resources_array, to_structure_resource_index, 
                        ref to_structure_resources_tracker, resource_type, resource_amount,
                    );
        
                },
                Option::None => { break; },
            }
        };

        // update to_structure resource arrivals
        ResourceArrivalImpl::write_resources(
            ref world, to_structure_id, arrival_day, arrival_slot, 
            to_structure_resources_array, to_structure_resources_tracker,
            to_structure_resource_arrival_total_amount,
        );

        if free == false {
            // burn enough donkeys to carry resources from from_structure to to_structure
            let from_entity_donkey_amount = iDonkeyImpl::needed_amount(ref world, total_resources_weight);
            iDonkeyImpl::burn(ref world, from_id, ref from_weight, from_entity_donkey_amount);
            iDonkeyImpl::burn_finialize(ref world, from_id, from_entity_donkey_amount, from_owner.address);

            // update from_structure weight
            from_weight.store(ref world, from_id);
        }
    }

    fn deliver_arrivals(
        ref world: WorldStorage,
        ref to_structure: Structure,
        ref to_structure_weight: W3eight,
        mut day: u64,
        mut slot: u8,
        mut resource_count: u8,
    ) {

        assert!(resource_count.is_non_zero(), "resource count is 0");
        

        let ( mut to_structure_resources_array, mut to_structure_resources_tracker, mut to_structure_resource_arrival_total_amount) 
            = ResourceArrivalImpl::read_resources(ref world, to_structure.entity_id, day, slot);
        let mut resource_index: u8 = 0;
        loop {
            match to_structure_resources_array.pop_front() {
                Option::Some((resource_type, resource_amount)) => {

                    // stop if we've reached the end of the resources specified
                    if resource_index + 1 > resource_count {break;}

                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                    // add resource to to_structure balance
                    let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
                    let mut to_structure_resource = SingleR33esourceStoreImpl::retrieve(
                        ref world, to_structure.entity_id, resource_type, ref to_structure_weight, resource_weight_grams, true,
                    );
                    to_structure_resource.spend(resource_amount, ref to_structure_weight, resource_weight_grams);
                    to_structure_resource.store(ref world);


                    // update to_structure resource arrivals
                    ResourceArrivalImpl::increase_balance(
                        ref to_structure_resource_arrival_total_amount,
                        ref to_structure_resources_array, resource_index, 
                        ref to_structure_resources_tracker, resource_type, resource_amount,
                    );

                    resource_index += 1;
                },
                Option::None => { break; },
            }
        };

        // update to_structure weight
        to_structure_weight.store(ref world, to_structure.entity_id);

        if to_structure_resource_arrival_total_amount.is_zero() {
            // delete to_structure resource arrivals
            ResourceArrivalImpl::delete(ref world, to_structure.entity_id, day);
        } else {
            // update to_structure resource arrivals
            ResourceArrivalImpl::write_resources(
                ref world, to_structure.entity_id, day, slot, 
                to_structure_resources_array, to_structure_resources_tracker,
                to_structure_resource_arrival_total_amount,
            );
        }
    }





    fn _emit_event(
        ref world: WorldStorage, sender_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>,
    ) {
        let mut sending_realm_id = 0;

        let sending_realm: Realm = world.read_model(sender_structure_id);
        if sending_realm.realm_id != 0 {
            sending_realm_id = sending_realm.realm_id;
        } else {
            let sending_entity_owner: EntityOwner = world.read_model(sender_structure_id);
            sending_realm_id = sending_entity_owner.get_realm_id(world);
        }

        world
            .emit_event(
                @Transfer {
                    recipient_structure_id,
                    sending_realm_id,
                    sender_structure_id,
                    resources,
                    timestamp: starknet::get_block_timestamp(),
                },
            );
    }
}