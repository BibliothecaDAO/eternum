use starknet::storage::StorageMapReadAccess;
use crate::buildings::Building;

pub fn building(key: BuildingKey) -> Option<Building> {
    let storage_key = (key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row);
    let building = crate::state::read().buildings.buildings.read(storage_key);
    if building.category != 0 {
        Some(building)
    } else {
        None
    }
}
use crate::buildings::BuildingKey;
use crate::structures::StructureBase;
use crate::troops::Coord;

pub fn building_key(game_id: u32, base: StructureBase, coord: Coord) -> BuildingKey {
    let outer = crate::structures::structure_coord(base);
    BuildingKey {
        game_id, alt: outer.alt, outer_col: outer.x, outer_row: outer.y, inner_col: coord.x, inner_row: coord.y,
    }
}

#[starknet::component]
pub mod BuildingState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::buildings::{
        Building, BuildingKey, BuildingRule, BuildingRuleConfig, BuildingRuleKey, BuildingTerms, StructureBuildings,
        change_count,
    };
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::{
        IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceAmount, ResourceKey,
    };
    use crate::rules::RESOURCE_PRECISION;
    use crate::structures::StructureBase;
    use crate::troops::Coord;
    use super::building_key;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn building_effect(
            self: @ComponentState<TContractState>,
            key: ResourceKey,
            base: StructureBase,
            coord: Coord,
            board: crate::buildings::BoardRules,
            tier: u8,
        ) -> crate::buildings::BuildingEffect {
            let Some(building) = self.building(building_key(key.game_id, base, coord)) else {
                return Default::default();
            };
            let rules = crate::logic::game::rules(key.game_id);
            let mut resource_type = crate::buildings::produced_resource(building.category);
            if resource_type == 26 || resource_type == 29 || resource_type == 32 {
                resource_type += tier;
            }
            let castle = coord.x == 10 && coord.y == 10;
            let category = if castle {
                0
            } else {
                building.category
            };
            let mut production_bps = 0_u32;
            let mut capacity_bps = 0_u32;
            let mut population = 0_u32;
            for direction in 0_u8..6 {
                let neighbor_coord = crate::geometry::neighbor(coord, direction);
                if let Some(neighbor) = self.building(building_key(key.game_id, base, neighbor_coord)) {
                    let neighbor_category = if neighbor_coord.x == 10 && neighbor_coord.y == 10 {
                        0
                    } else {
                        neighbor.category
                    };
                    for bonus in board.neighbors {
                        if *bonus.building == category && *bonus.neighbor == neighbor_category {
                            production_bps += Into::<u16, u32>::into(*bonus.production_bps);
                            capacity_bps += Into::<u16, u32>::into(*bonus.capacity_bps);
                            population += Into::<u8, u32>::into(*bonus.population);
                        }
                    }
                }
            }
            let rate = if resource_type == 0 || building.paused {
                0
            } else if category == 25 {
                board.workshop_rate
            } else {
                let rule = crate::logic::resources::rule(key.game_id, resource_type);
                if base.category == 1 {
                    rule.realm_rate
                } else {
                    rule.village_rate
                }
            };
            let capacity = if building.category == 2 {
                Into::<u32, u128>::into(rules.capacity_config.storehouse_boost_capacity) * RESOURCE_PRECISION
            } else {
                0
            };
            crate::buildings::BuildingEffect {
                resource_type,
                rate: (Into::<u64, u128>::into(rate) * (10000 + production_bps).into() / 10000).try_into().unwrap(),
                capacity: capacity * (10000 + capacity_bps).into() / 10000,
                population,
            }
        }
        fn apply_board_effects(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            before: Span<crate::buildings::BuildingEffect>,
            after: Span<crate::buildings::BuildingEffect>,
            timestamp: u64,
        ) {
            let classes = self.data.releases.entry(self.data.game_releases.read(key.game_id));
            let resources = IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() };
            let mut old_capacity = 0_u128;
            let mut new_capacity = 0_u128;
            let mut old_population = 0_u32;
            let mut new_population = 0_u32;
            for index in 0..before.len() {
                let old = *before.at(index);
                let new = *after.at(index);
                old_capacity += old.capacity;
                new_capacity += new.capacity;
                old_population += old.population;
                new_population += new.population;
                if old.resource_type != new.resource_type || old.rate != new.rate {
                    if old.rate != 0 {
                        resources.stop_production(key, old.resource_type, old.rate, timestamp);
                    }
                    if new.rate != 0 {
                        resources
                            .start_production(
                                key, new.resource_type, new.rate, crate::resources::UNLIMITED_OUTPUT, timestamp,
                            );
                    }
                }
            }
            if new_capacity != old_capacity {
                resources
                    .change_structure_capacity(
                        key,
                        core::cmp::max(old_capacity, new_capacity) - core::cmp::min(old_capacity, new_capacity),
                        new_capacity > old_capacity,
                    );
            }
            if new_population != old_population {
                let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.entity_id));
                counts.population.max = counts.population.max + new_population - old_population;
                assert!(
                    counts.population.current <= counts.population.max
                        + crate::logic::game::rules(key.game_id).building_config.base_population,
                    "population exceeds capacity",
                );
                self.write_counts(key.game_id, key.entity_id, counts);
            }
        }
        fn configure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            rules: Span<BuildingRuleConfig>,
            board: Option<crate::buildings::BoardRules>,
        ) {
            assert!(!self.data.buildings.configured.read(game_id), "immutable building rules");
            assert!(rules.len() == 40, "incomplete building rules");
            let mut expected = 1_u8;
            for config in rules {
                assert!(*config.category == expected, "building rules must be ordered");
                let rule = *config.rule;
                self
                    .data
                    .buildings
                    .terms
                    .write(
                        (game_id, expected),
                        BuildingTerms {
                            population_cost: rule.population_cost,
                            capacity_grant: rule.capacity_grant,
                            simple_count: rule.simple_cost.len().try_into().unwrap(),
                            complex_count: rule.complex_cost.len().try_into().unwrap(),
                        },
                    );
                self.write_costs(game_id, expected, false, rule.simple_cost);
                self.write_costs(game_id, expected, true, rule.complex_cost);
                let mut values = array![];
                rule.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'BuildingRule',
                            keys: array![game_id.into(), expected.into()].span(),
                            values: values.span(),
                        },
                    );
                expected += 1;
            }
            if let Some(board) = board {
                assert!(board.demolition_refund_bps <= 10000, "invalid demolition refund");
                assert!(board.workshop_rate != 0, "zero workshop rate");
                assert!(board.barracks_ii_cost != 0 && board.barracks_iii_cost != 0, "zero barracks cost");
                let count: u8 = board.neighbors.len().try_into().unwrap();
                for index in 0..count {
                    let bonus = *board.neighbors.at(index.into());
                    assert!(
                        bonus.building > 0 && bonus.building <= 40 && bonus.neighbor <= 40, "invalid neighbor category",
                    );
                    self.data.buildings.board_neighbors.write((game_id, index), bonus);
                }
                self
                    .data
                    .buildings
                    .board_terms
                    .write(
                        game_id,
                        Some(
                            crate::buildings::BoardTerms {
                                demolition_refund_bps: board.demolition_refund_bps,
                                workshop_rate: board.workshop_rate,
                                barracks_ii_cost: board.barracks_ii_cost,
                                barracks_iii_cost: board.barracks_iii_cost,
                                neighbor_count: count,
                            },
                        ),
                    );
                let mut values = array![];
                board.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1, model: 'BoardRules', keys: array![game_id.into()].span(), values: values.span(),
                        },
                    );
            }
            self.data.buildings.configured.write(game_id, true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BuildingRulesReady',
                        keys: array![game_id.into()].span(),
                        values: array![1].span(),
                    },
                );
        }
        fn board(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::buildings::BoardRules> {
            assert!(self.data.buildings.configured.read(game_id), "missing building rules");
            let Some(terms) = self.data.buildings.board_terms.read(game_id) else {
                return None;
            };
            let mut neighbors = array![];
            for index in 0..terms.neighbor_count {
                neighbors.append(self.data.buildings.board_neighbors.read((game_id, index)));
            }
            Some(
                crate::buildings::BoardRules {
                    demolition_refund_bps: terms.demolition_refund_bps,
                    workshop_rate: terms.workshop_rate,
                    barracks_ii_cost: terms.barracks_ii_cost,
                    barracks_iii_cost: terms.barracks_iii_cost,
                    neighbors: neighbors.span(),
                },
            )
        }
        fn rule(self: @ComponentState<TContractState>, key: BuildingRuleKey) -> BuildingRule {
            assert!(self.data.buildings.configured.read(key.game_id), "missing building rules");
            assert!(key.category > 0 && key.category <= 40, "invalid building category");
            let terms = self.data.buildings.terms.read((key.game_id, key.category));
            BuildingRule {
                population_cost: terms.population_cost,
                capacity_grant: terms.capacity_grant,
                simple_cost: self.read_costs(key, false, terms.simple_count),
                complex_cost: self.read_costs(key, true, terms.complex_count),
            }
        }
        fn write_costs(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            category: u8,
            complex: bool,
            costs: Span<ResourceAmount>,
        ) {
            for index in 0..costs.len() {
                let cost = *costs.at(index);
                assert!(cost.resource_type > 0 && cost.resource_type <= 58, "invalid building cost resource");
                self.data.buildings.costs.write((game_id, category, complex, index.try_into().unwrap()), cost);
            }
        }
        fn read_costs(
            self: @ComponentState<TContractState>, key: BuildingRuleKey, complex: bool, count: u8,
        ) -> Span<ResourceAmount> {
            let mut costs = array![];
            for index in 0..count {
                costs.append(self.data.buildings.costs.read((key.game_id, key.category, complex, index)));
            }
            costs.span()
        }
        fn building(self: @ComponentState<TContractState>, key: BuildingKey) -> Option<Building> {
            super::building(key)
        }
        fn create(
            ref self: ComponentState<TContractState>,
            key: BuildingKey,
            building: Building,
            population_cost: u8,
            capacity_grant: u8,
            base_population: u32,
        ) {
            assert!(self.building(key).is_none(), "building location occupied");
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, building.outer_entity_id));
            change_count(ref counts, building.category, true);
            counts.population.current += population_cost.into();
            counts.population.max += capacity_grant.into();
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            self.write_building(key, building);
            self.write_counts(key.game_id, building.outer_entity_id, counts);
        }
        fn remove(
            ref self: ComponentState<TContractState>,
            key: BuildingKey,
            building: Building,
            rule: BuildingRule,
            base_population: u32,
        ) {
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, building.outer_entity_id));
            change_count(ref counts, building.category, false);
            counts.population.current -= rule.population_cost.into();
            counts.population.max -= rule.capacity_grant.into();
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            self.write_counts(key.game_id, building.outer_entity_id, counts);
            self
                .data
                .buildings
                .buildings
                .write(
                    (key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row),
                    Default::default(),
                );
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'Building', keys: keys.span() });
        }
        fn write_building(ref self: ComponentState<TContractState>, key: BuildingKey, building: Building) {
            self
                .data
                .buildings
                .buildings
                .write((key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row), building);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            building.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Building', keys: keys.span(), values: values.span() });
        }
        fn write_counts(
            ref self: ComponentState<TContractState>, game_id: u32, entity_id: u32, counts: StructureBuildings,
        ) {
            self.data.buildings.structure_buildings.write((game_id, entity_id), counts);
            let mut values = array![];
            counts.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'StructureBuildings',
                        keys: array![game_id.into(), entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
