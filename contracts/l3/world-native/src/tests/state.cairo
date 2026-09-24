// Storage observations replace the six fixture-only contract ABIs. Gameplay assertions use recorded commands.
use snforge_std::interact_with_state;
use starknet::ContractAddress;
use starknet::storage::StorageMapReadAccess;
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
    fn production_receiver(
        self: crate::resources::IResourceOperationsDispatcher, key: crate::resources::ResourceSlot,
    ) -> Option<crate::resources::ProductionReceiver> {
        interact_with_state(
            self.contract_address,
            || {
                crate::state::read()
                    .resources
                    .production_receivers
                    .read((key.game_id, key.entity_id, key.resource_type))
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
