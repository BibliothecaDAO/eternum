use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use crate::alias::ID;
use crate::constants::DAYDREAMS_AGENT_ID;
use crate::models::map::{Tile, TileOccupier};
use crate::models::map2::{TileOpt};
use crate::models::position::{Coord, CoordTrait};
use crate::models::troop::{TroopTier, TroopType};
use crate::utils::map::biomes::Biome;
use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};

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

    fn get_troop_occupier(owner_id: ID, troop_type: TroopType, troop_tier: TroopTier) -> TileOccupier {
        if owner_id != DAYDREAMS_AGENT_ID {
            if troop_type == TroopType::Knight {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerKnightT1Regular;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerKnightT2Regular;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerKnightT3Regular;
                } else {
                    panic!("invalid troop tier")
                }
            } else if troop_type == TroopType::Paladin {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerPaladinT1Regular;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerPaladinT2Regular;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerPaladinT3Regular;
                } else {
                    panic!("invalid troop tier")
                }
            } else if troop_type == TroopType::Crossbowman {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerCrossbowmanT1Regular;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerCrossbowmanT2Regular;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerCrossbowmanT3Regular;
                } else {
                    panic!("invalid troop tier")
                }
            } else {
                panic!("invalid troop type")
            }
        } else {
            if troop_type == TroopType::Knight {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerKnightT1Daydreams;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerKnightT2Daydreams;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerKnightT3Daydreams;
                } else {
                    panic!("invalid troop tier")
                }
            } else if troop_type == TroopType::Paladin {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerPaladinT1Daydreams;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerPaladinT2Daydreams;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerPaladinT3Daydreams;
                } else {
                    panic!("invalid troop tier")
                }
            } else if troop_type == TroopType::Crossbowman {
                if troop_tier == TroopTier::T1 {
                    return TileOccupier::ExplorerCrossbowmanT1Daydreams;
                } else if troop_tier == TroopTier::T2 {
                    return TileOccupier::ExplorerCrossbowmanT2Daydreams;
                } else if troop_tier == TroopTier::T3 {
                    return TileOccupier::ExplorerCrossbowmanT3Daydreams;
                } else {
                    panic!("invalid troop tier")
                }
            } else {
                panic!("invalid troop type")
            }
        }
    }

    fn get_realm_occupier(realm_has_wonder: bool, realm_receives_wonder_bonus: bool, realm_level: u8) -> TileOccupier {
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

        let tile_opt: TileOpt = tile.into();
        world.write_model(@tile_opt);
        // todo add event {if not already explored}
    }
    
    fn mark_reward_extracted(ref world: WorldStorage, ref tile: Tile) {

        tile.reward_extracted = true;
        let tile_opt: TileOpt = tile.into();
        world.write_model(@tile_opt);
        // todo add event {if not already extracted}
    }

    fn explore_ring(ref world: WorldStorage, start_coord: Coord, mut radius: u32) {
        let biome_library = biome_library::get_dispatcher(@world);
        while radius > 0 {
            let coord_ring: Array<Coord> = start_coord.ring(radius);
            for coord in coord_ring {
                // Coord { alt: false
                let tile_opt: TileOpt = world.read_model((start_coord.alt, coord.x, coord.y));
                let mut tile: Tile = tile_opt.into();
                let biome: Biome = biome_library.get_biome(start_coord.alt, coord.x.into(), coord.y.into());
                Self::explore(ref world, ref tile, biome);
            }
            radius -= 1;
        }
    }

    fn occupy(ref world: WorldStorage, ref tile: Tile, category: TileOccupier, id: ID) {
        tile.occupier_type = category.into();
        tile.occupier_id = id;
        tile.occupier_is_structure = match category {
            TileOccupier::None => false,
            TileOccupier::ExplorerKnightT1Regular => false,
            TileOccupier::ExplorerKnightT2Regular => false,
            TileOccupier::ExplorerKnightT3Regular => false,
            TileOccupier::ExplorerPaladinT1Regular => false,
            TileOccupier::ExplorerPaladinT2Regular => false,
            TileOccupier::ExplorerPaladinT3Regular => false,
            TileOccupier::ExplorerCrossbowmanT1Regular => false,
            TileOccupier::ExplorerCrossbowmanT2Regular => false,
            TileOccupier::ExplorerCrossbowmanT3Regular => false,
            //
            TileOccupier::ExplorerKnightT1Daydreams => false,
            TileOccupier::ExplorerKnightT2Daydreams => false,
            TileOccupier::ExplorerKnightT3Daydreams => false,
            TileOccupier::ExplorerPaladinT1Daydreams => false,
            TileOccupier::ExplorerPaladinT2Daydreams => false,
            TileOccupier::ExplorerPaladinT3Daydreams => false,
            TileOccupier::ExplorerCrossbowmanT1Daydreams => false,
            TileOccupier::ExplorerCrossbowmanT2Daydreams => false,
            TileOccupier::ExplorerCrossbowmanT3Daydreams => false,
            _ => true,
        };
        let tile_opt: TileOpt = tile.into();
        world.write_model(@tile_opt);
        // todo add event {if not already explored}
    }

    fn unoccupy(ref world: WorldStorage, ref tile: Tile) {
        Self::occupy(ref world, ref tile, TileOccupier::None, 0);
    }
}

