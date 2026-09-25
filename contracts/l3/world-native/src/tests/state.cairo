// Storage observations replace the six fixture-only contract ABIs. Gameplay assertions use recorded commands.
use snforge_std::interact_with_state;
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
#[derive(Copy, Drop)]
pub struct GameState {
    pub contract_address: ContractAddress,
}

#[generate_trait]
pub impl MapObservation of MapObservationTrait {
    fn tile(self: crate::map::IMapLogicDispatcher, key: crate::map::TileKey) -> Option<crate::map::TileOpt> {
        interact_with_state(self.contract_address, || {
            crate::logic::map::tile(key)
        })
    }
    fn reveal(self: crate::map::IMapLogicDispatcher, key: crate::map::TileKey, biome: u8) {
        interact_with_state(self.contract_address, || {
            crate::logic::map::MapState::reveal(key, biome)
        })
    }
    fn occupy(
        self: crate::map::IMapLogicDispatcher,
        key: crate::map::TileKey,
        entity_id: u32,
        category: u8,
        is_structure: bool,
    ) {
        interact_with_state(
            self.contract_address, || {
                crate::logic::map::MapState::occupy(key, entity_id, category, is_structure)
            },
        )
    }

    fn vacate(self: crate::map::IMapLogicDispatcher, key: crate::map::TileKey, entity_id: u32) {
        interact_with_state(self.contract_address, || {
            crate::logic::map::MapState::vacate(key, entity_id)
        })
    }
}

#[generate_trait]
pub impl ResourceObservation of ResourceObservationTrait {
    fn resource_arrival(
        self: crate::resources::IResourceOperationsDispatcher, key: crate::arrivals::ArrivalKey,
    ) -> crate::arrivals::Arrival {
        interact_with_state(self.contract_address, || {
            crate::logic::arrivals::read(key)
        })
    }
    fn has_resource(self: crate::resources::IResourceOperationsDispatcher, key: crate::resources::ResourceKey) -> bool {
        interact_with_state(
            self.contract_address,
            || {
                crate::state::read().resources.resource_exists.read((key.game_id, key.entity_id))
            },
        )
    }
    fn resource_balance(
        self: crate::resources::IResourceOperationsDispatcher, key: crate::resources::ResourceSlot,
    ) -> u128 {
        interact_with_state(
            self.contract_address,
            || {
                crate::logic::resources::balance(
                    crate::resources::ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type,
                )
            },
        )
    }
    fn resource_production(
        self: crate::resources::IResourceOperationsDispatcher, key: crate::resources::ResourceSlot,
    ) -> crate::resources::Production {
        interact_with_state(
            self.contract_address,
            || {
                crate::logic::resources::production(
                    crate::resources::ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type,
                )
            },
        )
    }
    fn resource_weight(
        self: crate::resources::IResourceOperationsDispatcher, key: crate::resources::ResourceKey,
    ) -> crate::resources::Weight {
        interact_with_state(self.contract_address, || {
            crate::logic::resources::weight(key)
        })
    }
    fn resource_rule(
        self: crate::resources::IResourceOperationsDispatcher, game_id: u32, resource_type: u8,
    ) -> crate::resources::ResourceRule {
        interact_with_state(self.contract_address, || {
            crate::logic::resources::rule(game_id, resource_type)
        })
    }
}

#[generate_trait]
pub impl StructureObservation of StructureObservationTrait {
    fn building(
        self: crate::structures::IStructureOperationsDispatcher, key: crate::buildings::BuildingKey,
    ) -> Option<crate::buildings::Building> {
        interact_with_state(self.contract_address, || {
            crate::logic::buildings::building(key)
        })
    }
    fn structure_buildings(
        self: crate::structures::IStructureOperationsDispatcher, key: crate::resources::ResourceKey,
    ) -> crate::buildings::StructureBuildings {
        interact_with_state(
            self.contract_address,
            || {
                crate::state::read().buildings.structure_buildings.read((key.game_id, key.entity_id))
            },
        )
    }
    fn home_armies(
        self: crate::structures::IStructureOperationsDispatcher, key: crate::resources::ResourceKey,
    ) -> Span<u32> {
        interact_with_state(self.contract_address, || crate::logic::troops::home_armies(key))
    }

    fn position(
        self: crate::structures::IStructureOperationsDispatcher, key: crate::resources::ResourceKey,
    ) -> Option<crate::troops::Coord> {
        interact_with_state(self.contract_address, || crate::logic::map::entity_coord(key))
    }

    fn structure(
        self: crate::structures::IStructureOperationsDispatcher, key: crate::resources::ResourceKey,
    ) -> Option<crate::structures::Structure> {
        interact_with_state(self.contract_address, || {
            crate::logic::structures::structure(key)
        })
    }
}

#[generate_trait]
pub impl TroopObservation of TroopObservationTrait {
    fn resolved_explorer(self: GameState, key: crate::troops::ExplorerKey) -> Option<crate::troops::ExplorerTroops> {
        interact_with_state(
            self.contract_address,
            || {
                crate::logic::troops::explorer(key)
                    .map(|explorer| crate::logic::army_slots::resolve(key, explorer, None))
            },
        )
    }

    fn explorer(self: GameState, key: crate::troops::ExplorerKey) -> Option<crate::troops::ExplorerTroops> {
        interact_with_state(self.contract_address, || {
            crate::logic::troops::explorer(key)
        })
    }

    fn authorized_explorer(
        self: GameState, key: crate::troops::ExplorerKey, actor: starknet::ContractAddress, timestamp: u64,
    ) -> crate::troops::ExplorerTroops {
        interact_with_state(
            self.contract_address,
            || {
                crate::logic::troops::authorized_explorer(
                    key,
                    actor,
                    timestamp,
                    crate::commands::ExecutionContext {
                        raw_root: 0,
                        timestamp: timestamp,
                        game: BoxTrait::new(crate::logic::game::game((key).game_id)),
                        rules: BoxTrait::new(crate::logic::game::rules((key).game_id)),
                    },
                )
            },
        )
    }
}

#[generate_trait]
pub impl CombatObservation of CombatObservationTrait {
    fn village_last_raided(self: GameState, key: crate::resources::ResourceKey) -> u64 {
        interact_with_state(self.contract_address, || {
            crate::logic::combat::village_last_raided(key)
        })
    }
}

// Check both directions, including tiles an action vacated and entities it destroyed.
pub fn assert_spatial_indexes(
    address: ContractAddress, game_id: u32, entities: Span<u32>, tiles: Span<crate::troops::Coord>,
) {
    interact_with_state(
        address,
        || {
            let state = crate::state::read();
            for entity_id in entities {
                let key = crate::resources::ResourceKey { game_id, entity_id: *entity_id };
                let owner = state.troops.explorers.entry((game_id, *entity_id)).owner.read();
                let position = crate::logic::map::entity_coord(key);
                if owner != 0 {
                    let coord = position.expect('army index missing');
                    let occupancy = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)).unwrap();
                    assert_eq!(occupancy.entity_id, *entity_id);
                    assert!(!occupancy.is_structure);
                    let home = crate::logic::troops::home_armies(
                        crate::resources::ResourceKey { game_id, entity_id: owner },
                    );
                    let mut count = 0;
                    for id in home {
                        if *id == *entity_id {
                            count += 1;
                        }
                    }
                    assert_eq!(count, 1);
                } else if !crate::logic::structures::exists(key) {
                    assert!(position.is_none(), "absent entity retained spatial index");
                }
                if crate::logic::structures::exists(key) {
                    if let Some(coord) = position {
                        let occupancy = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord))
                            .unwrap();
                        assert_eq!(occupancy.entity_id, *entity_id);
                        assert!(occupancy.is_structure);
                    }
                    let home = crate::logic::troops::home_armies(key);
                    assert!(home.len() <= crate::logic::structures::record(key).base.troop_max_explorer_count.into());
                    for id in home {
                        assert_eq!(state.troops.explorers.entry((game_id, *id)).owner.read(), *entity_id);
                        assert!(
                            crate::logic::map::entity_coord(crate::resources::ResourceKey { game_id, entity_id: *id })
                                .is_some(),
                        );
                    }
                    assert_eq!(state.troops.home_armies.read((game_id, *entity_id, home.len().try_into().unwrap())), 0);
                }
            }
            for coord in tiles {
                if let Some(occupancy) = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, *coord)) {
                    let key = crate::resources::ResourceKey { game_id, entity_id: occupancy.entity_id };
                    let position = crate::logic::map::entity_coord(key);
                    if occupancy.entity_id == 0 || occupancy.category == 34 || occupancy.category == 35 {
                        assert!(position.is_none(), "tile-only fact entered entity index");
                    } else {
                        assert_eq!(position, Some(*coord));
                        if occupancy.is_structure {
                            assert!(crate::logic::structures::exists(key));
                        } else {
                            assert!(state.troops.explorers.entry((game_id, occupancy.entity_id)).owner.read() != 0);
                        }
                    }
                }
            }
        },
    );
}

pub fn assert_inline_armies_have_no_progress(address: ContractAddress, game_id: u32, entities: Span<u32>) {
    for explorer_id in entities {
        interact_with_state(
            address,
            || {
                let key = crate::troops::ExplorerKey { game_id, explorer_id: *explorer_id };
                assert!(crate::logic::progression::read(key).is_none());
                if let Some(explorer) = crate::logic::troops::explorer(key) {
                    assert!(
                        match explorer.troops.stamina {
                            crate::troops::StaminaSource::Inline(_) => true,
                            crate::troops::StaminaSource::Slot(_) => false,
                        },
                    );
                }
            },
        );
    }
}
