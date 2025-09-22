use dojo::event::EventStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{CapacityConfig, WorldConfigUtilImpl};
use s1_eternum::models::resource::resource::{ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl};
use s1_eternum::models::weight::Weight;
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
    fn burn(ref world: WorldStorage, structure_id: ID, ref structure_weight: Weight, donkey_amount: u128) {
        // burn amount of donkey needed
        let donkey_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.spend(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);
    }

    fn create(ref world: WorldStorage, structure_id: ID, ref structure_weight: Weight, donkey_amount: u128) {
        // return amount of donkey needed
        let donkey_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.add(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);
    }


    fn needed_amount(ref world: WorldStorage, resources_weight: u128) -> u128 {
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));

        let donkey_capacity_grams = capacity_config.donkey_capacity.into();
        let mut donkeys = resources_weight / (donkey_capacity_grams * RESOURCE_PRECISION);
        if resources_weight % (donkey_capacity_grams * RESOURCE_PRECISION) != 0 {
            donkeys += 1;
        }
        donkeys * RESOURCE_PRECISION
    }


    fn burn_finialize(ref world: WorldStorage, structure_id: ID, donkey_amount: u128, player_address: ContractAddress) {
        if donkey_amount != 0 {
            // emit burn donkey event
            let time = starknet::get_block_timestamp();
            world
                .emit_event(
                    @BurnDonkey {
                        entity_id: structure_id,
                        player_address: starknet::get_caller_address(),
                        amount: donkey_amount,
                        timestamp: time,
                    },
                );
        }
    }
}

