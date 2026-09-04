use dojo::event::EventStorage;
use dojo::world::WorldStorage;
use starknet::ContractAddress;
use crate::alias::ID;
use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
use crate::models::config::{CapacityConfig, WorldConfigUtilImpl};
use crate::models::position::Coord;
use crate::models::resource::resource::{ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl};
use crate::models::weight::Weight;

#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
struct BurnDonkey {
    #[key]
    game_id: u32,
    #[key]
    player_address: ContractAddress,
    #[key]
    entity_id: ID,
    amount: u128,
    timestamp: u64,
}


#[generate_trait]
pub impl iDonkeyImpl of iDonkeyTrait {
    #[inline]
    fn assert_can_transport(ref world: WorldStorage, game_id: u32, from_coord: Coord, dest_coord: Coord) {
        assert!(from_coord.alt == false && dest_coord.alt == false, "transportation only allowed in regular layer");
    }

    fn burn(
        ref world: WorldStorage, game_id: u32, structure_id: ID, ref structure_weight: Weight, donkey_amount: u128,
    ) {
        // burn amount of donkey needed
        let donkey_weight_grams: u128 = ResourceWeightImpl::grams(ref world, game_id, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleResourceStoreImpl::retrieve(
            ref world, game_id, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.spend(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);
    }

    fn create(
        ref world: WorldStorage, game_id: u32, structure_id: ID, ref structure_weight: Weight, donkey_amount: u128,
    ) {
        // return amount of donkey needed
        let donkey_weight_grams: u128 = ResourceWeightImpl::grams(ref world, game_id, ResourceTypes::DONKEY);
        let mut donkey_resource = SingleResourceStoreImpl::retrieve(
            ref world, game_id, structure_id, ResourceTypes::DONKEY, ref structure_weight, donkey_weight_grams, true,
        );
        donkey_resource.add(donkey_amount, ref structure_weight, donkey_weight_grams);
        donkey_resource.store(ref world);
    }


    fn needed_amount(ref world: WorldStorage, game_id: u32, resources_weight: u128) -> u128 {
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(
            world, game_id, selector!("capacity_config"),
        );

        let donkey_capacity_grams = capacity_config.donkey_capacity.into();
        let mut donkeys = resources_weight / (donkey_capacity_grams * RESOURCE_PRECISION);
        if resources_weight % (donkey_capacity_grams * RESOURCE_PRECISION) != 0 {
            donkeys += 1;
        }
        donkeys * RESOURCE_PRECISION
    }


    fn burn_finialize(
        ref world: WorldStorage, game_id: u32, structure_id: ID, donkey_amount: u128, player_address: ContractAddress,
    ) {
        if donkey_amount != 0 {
            // emit burn donkey event
            let time = starknet::get_block_timestamp();
            world
                .emit_event(
                    @BurnDonkey {
                        game_id,
                        entity_id: structure_id,
                        player_address: starknet::get_caller_address(),
                        amount: donkey_amount,
                        timestamp: time,
                    },
                );
        }
    }
}
