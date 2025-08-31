use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{
    RELICS_RESOURCE_END_ID, RELICS_RESOURCE_START_ID, RESOURCE_PRECISION, ResourceTypes, relic_level,
};
use s1_eternum::models::config::{MapConfig, TickImpl, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction, DirectionImpl, TravelImpl};
use s1_eternum::models::record::RelicRecord;
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{StructureImpl, StructureReservation};
use s1_eternum::models::weight::Weight;
use s1_eternum::systems::utils::map::IMapImpl;
use s1_eternum::systems::utils::structure::iStructureImpl;
use s1_eternum::systems::utils::troop::iMercenariesImpl;
use s1_eternum::utils::map::biomes::{Biome, get_biome};
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl};
use s1_eternum::utils::random;
use s1_eternum::utils::random::VRFImpl;

#[generate_trait]
pub impl iRelicChestDiscoveryImpl of iRelicChestDiscoveryTrait {
    fn should_discover(world: WorldStorage, relic_record: RelicRecord, map_config: MapConfig) -> bool {
        let last_discovered_at = relic_record.last_discovered_at;
        let next_discovery_at = last_discovered_at + map_config.relic_discovery_interval_sec.into();
        next_discovery_at <= starknet::get_block_timestamp()
    }

    fn discover(ref world: WorldStorage, start_coord: Coord, map_config: MapConfig, vrf_seed: u256) {
        // make sure seed is different for each discovery system to prevent same outcome for same
        // probability
        let VRF_OFFSET: u256 = 12;
        let relic_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        // calculate final probabilities
        let num_directions_choices: u32 = 3;
        let mut directions: Span<Direction> = random::choices(
            DirectionImpl::all().span(),
            array![1, 1, 1, 1, 1, 1].span(),
            array![].span(),
            num_directions_choices.into(),
            false,
            relic_vrf_seed,
        );

        let mut destination_coord: Coord = start_coord;
        let mut i = 1;
        while i <= num_directions_choices {
            let direction = directions.pop_front().unwrap();
            destination_coord = destination_coord
                .neighbor_after_distance(*direction, map_config.relic_hex_dist_from_center.into() / i);
            i += 1;
        }

        loop {
            let mut tile: Tile = world.read_model((destination_coord.x, destination_coord.y));
            let mut structure_reservation: StructureReservation = world.read_model(destination_coord);
            if tile.occupied() || structure_reservation.reserved {
                destination_coord = destination_coord.neighbor(Direction::East);
            } else {
                if tile.not_discovered() {
                    let biome: Biome = get_biome(destination_coord.x.into(), destination_coord.y.into());
                    IMapImpl::explore(ref world, ref tile, biome);
                }
                IMapImpl::occupy(ref world, ref tile, TileOccupier::Chest.into(), world.dispatcher.uuid());
                break;
            }
        };
    }
}


#[generate_trait]
pub impl iRelicChestResourceFactoryImpl of iRelicChestResourceFactoryTrait {
    fn _chances(relic_start_id: u8, relic_end_id: u8) -> (Span<u8>, Span<u128>) {
        let mut chances = array![];
        let mut relic_ids = array![];
        for relic_id in relic_start_id..relic_end_id + 1 {
            relic_ids.append(relic_id);
            if relic_id == ResourceTypes::RELIC_E18 {
                chances.append(200);
            } else if relic_id == ResourceTypes::RELIC_E17 {
                chances.append(600);
            } else if relic_level(relic_id) == 2 {
                chances.append(400);
            } else if relic_level(relic_id) == 1 {
                chances.append(750);
            } else {
                panic!("Eternum: Invalid relic id for chance calculation");
            }
        }
        (relic_ids.span(), chances.span())
    }

    // todo: note: same relic may appear multiple times in the array
    fn grant_relics(
        ref world: WorldStorage,
        to_explorer_id: ID,
        ref to_explorer_weight: Weight,
        map_config: MapConfig,
        vrf_seed: u256,
    ) -> Span<u8> {
        let (relic_ids, chances) = Self::_chances(RELICS_RESOURCE_START_ID, RELICS_RESOURCE_END_ID);
        let mut number_of_relics: u128 = map_config.relic_chest_relics_per_chest.into();
        let mut chosen_relic_ids: Span<u8> = random::choices(
            relic_ids, chances, array![].span(), number_of_relics, true, vrf_seed,
        );

        for i in 0..chosen_relic_ids.len() {
            let relic_resource_id: u8 = *chosen_relic_ids.at(i);
            let relic_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, relic_resource_id);
            let mut relic_resource = SingleResourceStoreImpl::retrieve(
                ref world, to_explorer_id, relic_resource_id, ref to_explorer_weight, relic_resource_weight_grams, true,
            );
            relic_resource.add(1 * RESOURCE_PRECISION, ref to_explorer_weight, relic_resource_weight_grams);
            relic_resource.store(ref world);
        }

        to_explorer_weight.store(ref world, to_explorer_id);

        return chosen_relic_ids;
    }
}
