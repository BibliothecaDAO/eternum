
use achievement::store::{Store, StoreTrait};
use dojo::world::WorldStorage;

use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{WorldConfigUtilImpl};
use s1_eternum::models::position::{Coord, CoordTrait};
use s1_eternum::models::owner::{Owner};
use s1_eternum::models::weight::{W3eight};
use s1_eternum::models::resource::r3esource::{
    SingleR33esourceImpl,
    SingleR33esourceStoreImpl, WeightUnitImpl
};

use starknet::ContractAddress;


#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
struct BurnDonkey {
    #[key]
    player_address: ContractAddress,
    #[key]
    entity_id: ID,
    amount: u128,
    timestamp: u64,
}



#[generate_trait]
pub impl iDonkeyImpl of iDonkeyTrait {
    fn burn(ref world: WorldStorage, structure_id: ID, structure_owner: Owner, ref structure_weight: W3eight, resources_weight: u128, include_achievement: bool) {
        // get number of donkeys needed to carry resources
        let donkey_amount = Self::needed_amount(ref world, resources_weight);

        // burn amount of donkey needed
        let donkey_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.spend(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);


        // todo: fix: this event is not accurate all the time, e.g when donkey is returned
        
        // emit burn donkey event
        let time = starknet::get_block_timestamp();
        world
            .emit_event(
                @BurnDonkey {
                    entity_id: payer_id,
                    player_address: starknet::get_caller_address(),
                    amount: donkey_amount,
                    timestamp: time,
                },
            );

        if include_achievement {
            // [Achievement] Consume donkeys
            Self::_grant_achievement(
                ref world, donkey_amount, structure_owner.address);
        }
    }

    fn return(ref world: WorldStorage, payer_id: ID, resources_weight: u128, ref structure_weight: Weight) {
        // get number of donkeys needed
        let donkey_amount = Self::needed_amount(ref world, resources_weight);

        // return amount of donkey needed
        let donkey_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.add(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);
    }



    fn needed_amount(ref world: WorldStorage, resources_weight: u128) -> u128 {
        let capacity_config: CapacityConfig 
            = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));

        let donkey_capacity_grams = capacity_config.donkey_capacity;
        let mut donkeys = resources_weight / donkey_capacity_grams;
        if resources_weight % donkey_capacity_grams != 0 {
            donkeys += 1;
        };
        donkeys * RESOURCE_PRECISION
    }

    // let arrives_at: u64 = starknet::get_block_timestamp()
    // + Self::get_donkey_travel_time(
    //     ref world,
    //     start_coord,
    //     intermediate_coord,
    //     MovableImpl::sec_per_km(ref world, DONKEY_ENTITY_TYPE),
    //     is_round_trip,
    // );

    fn time_required(
        ref world: WorldStorage,
        resources_coord: Coord,
        destination_coord: Coord,
        sec_per_km: u16, // MovableImpl::sec_per_km(ref world, DONKEY_ENTITY_TYPE)
        round_trip: bool,
    ) -> u64 {
        let mut travel_time = resources_coord.calculate_travel_time(destination_coord, sec_per_km);
        if round_trip {travel_time *= 2;};

        travel_time
    }


    fn _grant_achievement(ref world: WorldStorage, donkey_amount: u128, player_address: ContractAddress) {
        if donkey_amount != 0 {
            let count = ((donkey_amount / RESOURCE_PRECISION) % Bounded::MAX.into())
                .try_into()
                .unwrap();
            let player_id: felt252 = player_address.into();
            let task_id = Task::Breeder.identifier();
            let mut store = StoreTrait::new(world);
            store.progress(player_id, task_id, count, time: starknet::get_block_timestamp());
        }
    }
}

