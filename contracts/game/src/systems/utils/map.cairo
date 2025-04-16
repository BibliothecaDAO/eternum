use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::models::map::{Tile, TileOccupier};
use s1_eternum::models::troop::{TroopTier, TroopType};
use s1_eternum::utils::map::biomes::Biome;

#[generate_trait]
pub impl IMapImpl of IMapTrait {
    fn get_hyperstructure_occupier(level: u8) -> TileOccupier {
        if level == 0 {
            return TileOccupier::HyperstructureLevel1;
        } else if level == 1 {
            return TileOccupier::HyperstructureLevel2;
        } else if level == 2 {
            return TileOccupier::HyperstructureLevel3;
        } else {
            panic!("wrong level")
        }
    }

    fn get_troop_occupier(troop_type: TroopType, troop_tier: TroopTier) -> TileOccupier {
        if troop_type == TroopType::Knight {
            if troop_tier == TroopTier::T1 {
                return TileOccupier::ExplorerKnightT1;
            } else if troop_tier == TroopTier::T2 {
                return TileOccupier::ExplorerKnightT2;
            } else if troop_tier == TroopTier::T3 {
                return TileOccupier::ExplorerKnightT3;
            } else {
                panic!("invalid troop tier")
            }
        } else if troop_type == TroopType::Paladin {
            if troop_tier == TroopTier::T1 {
                return TileOccupier::ExplorerPaladinT1;
            } else if troop_tier == TroopTier::T2 {
                return TileOccupier::ExplorerPaladinT2;
            } else if troop_tier == TroopTier::T3 {
                return TileOccupier::ExplorerPaladinT3;
            } else {
                panic!("invalid troop tier")
            }
        } else if troop_type == TroopType::Crossbowman {
            if troop_tier == TroopTier::T1 {
                return TileOccupier::ExplorerCrossbowmanT1;
            } else if troop_tier == TroopTier::T2 {
                return TileOccupier::ExplorerCrossbowmanT2;
            } else if troop_tier == TroopTier::T3 {
                return TileOccupier::ExplorerCrossbowmanT3;
            } else {
                panic!("invalid troop tier")
            }
        } else {
            panic!("invalid troop type")
        }
    }

    fn get_realm_occupier(realm_has_wonder: bool, realm_level: u8) -> TileOccupier {
        if realm_has_wonder {
            if realm_level == 0 {
                return TileOccupier::RealmWonderLevel1;
            } else if realm_level == 1 {
                return TileOccupier::RealmWonderLevel2;
            } else if realm_level == 2 {
                return TileOccupier::RealmWonderLevel3;
            } else if realm_level == 3 {
                return TileOccupier::RealmWonderLevel4;
            } else {
                panic!("invalid level")
            }
        } else {
            if realm_level == 0 {
                return TileOccupier::RealmRegularLevel1;
            } else if realm_level == 1 {
                return TileOccupier::RealmRegularLevel2;
            } else if realm_level == 2 {
                return TileOccupier::RealmRegularLevel3;
            } else if realm_level == 3 {
                return TileOccupier::RealmRegularLevel4;
            } else {
                panic!("invalid level")
            }
        }
    }


    fn explore(ref world: WorldStorage, ref tile: Tile, biome: Biome) {
        tile.biome = biome.into();
        world.write_model(@tile);
        // todo add event {if not already explored}
    }

    fn occupy(ref world: WorldStorage, ref tile: Tile, category: TileOccupier, id: ID) {
        tile.occupier_type = category.into();
        tile.occupier_id = id;
        tile.occupier_is_structure = match category {
            TileOccupier::None => false,
            TileOccupier::ExplorerKnightT1 => false,
            TileOccupier::ExplorerKnightT2 => false,
            TileOccupier::ExplorerKnightT3 => false,
            TileOccupier::ExplorerPaladinT1 => false,
            TileOccupier::ExplorerPaladinT2 => false,
            TileOccupier::ExplorerPaladinT3 => false,
            TileOccupier::ExplorerCrossbowmanT1 => false,
            TileOccupier::ExplorerCrossbowmanT2 => false,
            TileOccupier::ExplorerCrossbowmanT3 => false,
            _ => true,
        };
        world.write_model(@tile);
        // todo add event {if not already explored}
    }
}

