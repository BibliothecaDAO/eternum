use starknet::ContractAddress;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use dojo::model::ModelStorage;
use s1_eternum::alias::ID;
use s1_eternum::models::config::{MapConfig, VRFConfig, VRFConfigImpl, CombatConfig};
use s1_eternum::models::resource::production::building::{BuildingCategory, Building, BuildingImpl};
use s1_eternum::models::resource::production::production::{ProductionImpl};
use s1_eternum::models::structure::{Structure, StructureImpl, StructureCategory};
use s1_eternum::models::owner::{Owner};
use s1_eternum::models::position::{Coord, Occupier, OccupiedBy};
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
use s1_eternum::models::resource::r3esource::{
    SingleR33esourceImpl,
    SingleR33esourceStoreImpl,
    WeightStoreImpl,
    WeightUnitImpl,
    Production
};
use s1_eternum::models::weight::W3eight;
use s1_eternum::constants::{ResourceTypes, RESOURCE_PRECISION, WORLD_CONFIG_ID};
use s1_eternum::utils::random::{VRFImpl};
use s1_eternum::models::config::TickImpl;
use s1_eternum::utils::random;
use s1_eternum::systems::utils::troop::iMercenariesImpl;

#[generate_trait]
pub impl iMineDiscoveryImpl of iMineDiscoveryTrait {

    fn lottery(ref world: WorldStorage, owner: starknet::ContractAddress, coord: Coord, config: MapConfig) -> bool {

        let vrf_provider: ContractAddress = VRFConfigImpl::get_provider_address(ref world);
        let vrf_seed: u256 = VRFImpl::seed(owner, vrf_provider);
        let success: bool = *random::choices(
            array![true, false].span(),
            array![1000, config.shards_mines_fail_probability].span(),
            array![].span(),
            1,
            true,
            vrf_seed
        )[0];
        
        // return false if lottery fails
        if !success {return false;}


        // make structure
        let structure_id = Self::_make_structure(ref world, coord, owner);

        // add guards to structure
        let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
        // slot must start from delta, to charlie, to beta, to alpha
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T2, TroopType::Paladin)].span();
        let tick = TickImpl::retrieve(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, combat_config, tick.current());

        // allow fragment mine to produce limited amount of shards
        let shards_reward_amount = Self::_reward_amount(ref world, vrf_seed);
        let mut structure_weight: W3eight = WeightStoreImpl::retrieve(ref world, structure_id);
        let shards_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::EARTHEN_SHARD);
        let mut shards_resource
            = SingleR33esourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::EARTHEN_SHARD, ref structure_weight, shards_weight_grams, true
        );
        let mut shards_resource_production: Production = shards_resource.production;
        shards_resource_production.increase_output_amout_left(shards_reward_amount);
        shards_resource.production = shards_resource_production;
        shards_resource.store(ref world);


        // grant wheat to structure     
        let wheat_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::WHEAT);
        let mut wheat_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::WHEAT, ref structure_weight, wheat_weight_grams, true
        );
        wheat_resource.add(config.mine_wheat_grant_amount, ref structure_weight, wheat_weight_grams);
        wheat_resource.store(ref world);

        // grant fish to structure
        let fish_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::FISH);
        let mut fish_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::FISH, ref structure_weight, fish_weight_grams, true
        );
        fish_resource.add(config.mine_fish_grant_amount, ref structure_weight, fish_weight_grams);
        fish_resource.store(ref world);

        // update structure weight
        structure_weight.store(ref world, structure_id);

        // create shards production building
        BuildingImpl::create(
            ref world,
            structure_id,
            BuildingCategory::Resource,
            Option::Some(ResourceTypes::EARTHEN_SHARD),
            BuildingImpl::center(),
        );

        return true;
    }

    fn _make_structure(ref world: WorldStorage, coord: Coord, owner: starknet::ContractAddress) -> ID {
        // make structure model 
        let structure_id: ID = world.dispatcher.uuid();
        let owner: Owner = Owner { entity_id: structure_id, address: owner };
        let structure: Structure = StructureImpl::new(structure_id, StructureCategory::FragmentMine, coord, owner);
        world.write_model(@structure);

        // make occupier model
        let occupier: Occupier = Occupier { x: coord.x, y: coord.y, entity: OccupiedBy::Structure(structure_id) };
        world.write_model(@occupier);

        structure_id
    }


    fn _reward_amount(ref world: WorldStorage, randomness: u256) -> u128 {
        let random_multiplier: u128 = *random::choices(
            array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].span(),
            array![1, 1, 1, 1, 1, 1, 1, 1, 1, 1].span(),
            array![].span(),
            1,
            true,
            randomness
        )[0];
        let minimum_amount: u128 = 100_000 * RESOURCE_PRECISION;
        let actual_amount: u128 = minimum_amount * random_multiplier;
        return actual_amount;
    }
}
