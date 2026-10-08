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
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::buildings::{Building, BuildingKey, BuildingRule, BuildingRuleKey, StructureBuildings, change_count};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::{ResourceAmount, ResourceKey};
    use crate::structures::StructureBase;

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
        // One standing building's output on a realm board. Tiers apply to every building of a type, so the output is
        // the same on every plot: Fields, Tools and Drill each add a share of the type's base rate.
        fn board_output(
            self: @ComponentState<TContractState>,
            key: ResourceKey,
            base: StructureBase,
            category: u8,
            board: crate::buildings::BoardRules,
            learned: u64,
        ) -> (u8, u64) {
            let resource_type = crate::buildings::produced_resource(category);
            if resource_type == 0 {
                return (0, 0);
            }
            let base_rate: u64 = if category == crate::research::WORKSHOP {
                board.workshop_rate
            } else {
                let rule = crate::logic::resources::rule(key.game_id, resource_type);
                if base.category == crate::taxonomy::REALM_CATEGORY {
                    rule.realm_rate
                } else {
                    rule.village_rate
                }
            };
            let makes: u128 = crate::research::make_picks(learned, category).into();
            let base_rate: u128 = base_rate.into();
            let rate = base_rate * (10000 + makes * board.output_step_bps.into()) / 10000;
            (resource_type, rate.try_into().unwrap())
        }
        // The population a realm's huts give beyond their base grant: each hut tier adds a share of every hut's.
        fn hut_bonus(
            self: @ComponentState<TContractState>,
            game_id: u32,
            huts: u8,
            board: crate::buildings::BoardRules,
            learned: u64,
        ) -> u32 {
            let grant: u32 = self
                .rule(BuildingRuleKey { game_id, category: crate::research::HUT })
                .capacity_grant
                .into();
            let tiers: u32 = crate::research::tier(learned, crate::research::ROW_HUT).into();
            Into::<u8, u32>::into(huts) * grant * tiers * board.population_step_bps.into() / 10000
        }
        fn change_population_max(
            ref self: ComponentState<TContractState>, key: ResourceKey, before: u32, after: u32, base_population: u32,
        ) {
            if before == after {
                return;
            }
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.entity_id));
            counts.population.max = counts.population.max + after - before;
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            self.write_counts(key.game_id, key.entity_id, counts);
        }
        fn board(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::buildings::BoardRules> {
            crate::logic::preset_record::for_game(game_id).board_terms.read()
        }

        fn rule(self: @ComponentState<TContractState>, key: BuildingRuleKey) -> BuildingRule {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            assert!(
                key.category > 0 && key.category <= crate::buildings::BUILDING_CATEGORY_COUNT,
                "invalid building category",
            );
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
