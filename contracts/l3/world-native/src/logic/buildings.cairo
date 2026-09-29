use starknet::storage::StorageMapReadAccess;
use crate::buildings::Building;

pub fn building(key: BuildingKey) -> Option<Building> {
    let storage_key = (key.game_id, key.structure_id, key.inner_col, key.inner_row);
    let building = crate::state::read().buildings.buildings.read(storage_key);
    if building.category != 0 {
        Some(building)
    } else {
        None
    }
}
use crate::buildings::BuildingKey;
use crate::troops::Coord;

pub fn building_key(key: crate::resources::ResourceKey, coord: Coord) -> BuildingKey {
    BuildingKey { game_id: key.game_id, structure_id: key.entity_id, inner_col: coord.x, inner_row: coord.y }
}

#[starknet::component]
pub mod BuildingState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::buildings::{Building, BuildingKey, BuildingRule, BuildingRuleKey, StructureBuildings, change_count};
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
            game_context: crate::commands::ExecutionContext,
        ) -> crate::buildings::BuildingEffect {
            let Some(building) = self.building(building_key(key, coord)) else {
                return Default::default();
            };
            let rules = game_context.rules.unbox();
            let mut resource_type = crate::buildings::produced_resource(building.category);
            if resource_type == 26 || resource_type == 29 || resource_type == 32 {
                resource_type += building.tier - 1;
            }
            let castle = coord.x == 10 && coord.y == 10;
            let category = if castle {
                0
            } else {
                building.category
            };
            let realm_id = crate::logic::structures::record(key).metadata.realm_id;
            let marked = crate::building_ring::is_marked_plot(realm_id, coord);
            let multiplier: u64 = if marked {
                2
            } else {
                1
            };
            let tier_rule = if building.tier > 1 {
                Some(crate::logic::research::tier_rule(key.game_id, building.category, building.tier))
            } else {
                None
            };
            let output_bps = tier_rule.map(|rule| rule.output_multiplier_bps).unwrap_or(10000);
            let capacity_bps = tier_rule.map(|rule| rule.capacity_multiplier_bps).unwrap_or(10000);
            let population_bps = tier_rule.map(|rule| rule.population_multiplier_bps).unwrap_or(10000);
            let base_population: u32 = self
                .rule(BuildingRuleKey { game_id: key.game_id, category: building.category })
                .capacity_grant
                .into();
            // Creation/removal already accounts for the base grant; board effects own only its excess.
            let population = base_population * population_bps / 10000 * multiplier.try_into().unwrap()
                - base_population;
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
                rate: (Into::<u64, u128>::into(rate) * output_bps.into() / 10000 * multiplier.into())
                    .try_into()
                    .unwrap(),
                capacity: capacity * capacity_bps.into() / 10000 * multiplier.into(),
                population,
            }
        }
        fn apply_board_effects(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            before: Span<crate::buildings::BuildingEffect>,
            after: Span<crate::buildings::BuildingEffect>,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let classes = self.data.releases.entry(self.data.game_releases.read(key.game_id)).classes;
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
                        resources
                            .stop_production(
                                key,
                                old.resource_type,
                                old.rate,
                                timestamp,
                                crate::commands::resource_context(game_context),
                            );
                    }
                    if new.rate != 0 {
                        resources
                            .start_production(
                                key,
                                new.resource_type,
                                new.rate,
                                crate::resources::UNLIMITED_OUTPUT,
                                timestamp,
                                crate::commands::resource_context(game_context),
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
                        + game_context.rules.unbox().building_config.base_population,
                    "population exceeds capacity",
                );
                self.write_counts(key.game_id, key.entity_id, counts);
            }
        }
        fn board(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::buildings::BoardRules> {
            crate::logic::preset_record::for_game(game_id).board_terms.read()
        }

        fn rule(self: @ComponentState<TContractState>, key: BuildingRuleKey) -> BuildingRule {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            assert!(key.category > 0 && key.category <= 40, "invalid building category");
            let terms = preset.building_terms.read(key.category);
            BuildingRule {
                population_cost: terms.population_cost,
                capacity_grant: terms.capacity_grant,
                simple_cost: self.read_costs(key, false, terms.simple_count),
                complex_cost: self.read_costs(key, true, terms.complex_count),
            }
        }
        fn read_costs(
            self: @ComponentState<TContractState>, key: BuildingRuleKey, complex: bool, count: u8,
        ) -> Span<ResourceAmount> {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            let mut costs = array![];
            for index in 0..count {
                costs.append(preset.building_costs.read((key.category, complex, index)));
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
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.structure_id));
            change_count(ref counts, building.category, true);
            counts.population.current += population_cost.into();
            counts.population.max += capacity_grant.into();
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            self.write_building(key, building);
            self.write_counts(key.game_id, key.structure_id, counts);
        }
        fn remove(
            ref self: ComponentState<TContractState>,
            key: BuildingKey,
            building: Building,
            rule: BuildingRule,
            base_population: u32,
        ) {
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.structure_id));
            change_count(ref counts, building.category, false);
            counts.population.current -= rule.population_cost.into();
            counts.population.max -= rule.capacity_grant.into();
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            self.write_counts(key.game_id, key.structure_id, counts);
            self
                .data
                .buildings
                .buildings
                .write((key.game_id, key.structure_id, key.inner_col, key.inner_row), Default::default());
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'Building', keys: keys.span() });
        }
        fn write_building(ref self: ComponentState<TContractState>, key: BuildingKey, building: Building) {
            self
                .data
                .buildings
                .buildings
                .write((key.game_id, key.structure_id, key.inner_col, key.inner_row), building);
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
