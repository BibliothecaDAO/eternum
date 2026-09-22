#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingKey {
    pub game_id: u32,
    pub alt: bool,
    pub outer_col: u32,
    pub outer_row: u32,
    pub inner_col: u32,
    pub inner_row: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Building {
    pub category: u8,
    pub outer_entity_id: u32,
    pub paused: bool,
    pub labor_paid: u128,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Population {
    pub current: u32,
    pub max: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct StructureBuildings {
    pub packed_counts_1: u128,
    pub packed_counts_2: u128,
    pub packed_counts_3: u128,
    pub population: Population,
}

const BYTE_SCALE: u128 = 256;
const PAUSED_SCALE: u64 = 0x10000000000;

pub impl BuildingPacking of starknet::storage_access::StorePacking<Building, felt252> {
    fn pack(value: Building) -> felt252 {
        let identity: u64 = value.category.into()
            + Into::<u32, u64>::into(value.outer_entity_id) * 256
            + if value.paused {
                PAUSED_SCALE
            } else {
                0
            };
        identity.into() + Into::<u128, felt252>::into(value.labor_paid) * 0x10000000000000000
    }
    fn unpack(value: felt252) -> Building {
        let value: u256 = value.into();
        Building {
            category: (value.low % 256).try_into().unwrap(),
            outer_entity_id: (value.low / 256 % 0x100000000).try_into().unwrap(),
            paused: value.low / Into::<u64, u128>::into(PAUSED_SCALE) % 2 != 0,
            labor_paid: value.low / 0x10000000000000000 + value.high * 0x10000000000000000,
        }
    }
}

pub impl PopulationPacking of starknet::storage_access::StorePacking<Population, u64> {
    fn pack(value: Population) -> u64 {
        value.current.into() + Into::<u32, u64>::into(value.max) * 0x100000000
    }
    fn unpack(value: u64) -> Population {
        Population {
            current: (value % 0x100000000).try_into().unwrap(), max: (value / 0x100000000).try_into().unwrap(),
        }
    }
}

fn count_position(category: u8) -> (u8, u128) {
    assert!(category > 0 && category <= 40, "invalid production building");
    let mut scale = 1_u128;
    for _ in 0..(category - 1) % 16 {
        scale *= BYTE_SCALE;
    }
    ((category - 1) / 16, scale)
}

pub fn category_count(counts: StructureBuildings, category: u8) -> u8 {
    let (index, scale) = count_position(category);
    let packed = match index {
        0 => counts.packed_counts_1,
        1 => counts.packed_counts_2,
        _ => counts.packed_counts_3,
    };
    (packed / scale % BYTE_SCALE).try_into().unwrap()
}

fn change_count(ref counts: StructureBuildings, category: u8, adding: bool) {
    let (index, scale) = count_position(category);
    let old = category_count(counts, category);
    let count = if adding {
        old + 1
    } else {
        old - 1
    };
    let packed = match index {
        0 => counts.packed_counts_1,
        1 => counts.packed_counts_2,
        _ => counts.packed_counts_3,
    };
    let packed = packed - Into::<u8, u128>::into(old) * scale + Into::<u8, u128>::into(count) * scale;
    match index {
        0 => counts.packed_counts_1 = packed,
        1 => counts.packed_counts_2 = packed,
        _ => counts.packed_counts_3 = packed,
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingRuleKey {
    pub game_id: u32,
    pub category: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingRule {
    pub population_cost: u8,
    pub capacity_grant: u8,
    pub simple_cost: Span<crate::resources::ResourceAmount>,
    pub complex_cost: Span<crate::resources::ResourceAmount>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingRuleConfig {
    pub category: u8,
    pub rule: BuildingRule,
}
#[derive(Copy, Drop, Default, starknet::Store)]
pub struct BuildingTerms {
    pub population_cost: u8,
    pub capacity_grant: u8,
    pub simple_count: u8,
    pub complex_count: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct NeighborBonus {
    pub building: u8,
    pub neighbor: u8,
    pub production_bps: u16,
    pub capacity_bps: u16,
    pub population: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BoardRules {
    pub demolition_refund_bps: u16,
    pub workshop_rate: u64,
    pub barracks_ii_cost: u128,
    pub barracks_iii_cost: u128,
    pub neighbors: Span<NeighborBonus>,
}

#[derive(Copy, Drop, starknet::Store)]
pub struct BoardTerms {
    pub demolition_refund_bps: u16,
    pub workshop_rate: u64,
    pub barracks_ii_cost: u128,
    pub barracks_iii_cost: u128,
    pub neighbor_count: u8,
}

#[derive(Copy, Drop, Default, Debug, PartialEq)]
pub struct BuildingEffect {
    pub resource_type: u8,
    pub rate: u64,
    pub capacity: u128,
    pub population: u32,
}

#[starknet::interface]
pub trait IBuildingRules<T> {
    fn configure_buildings(ref self: T, game_id: u32, rules: Span<BuildingRuleConfig>, board: Option<BoardRules>);
    fn building_rule(self: @T, key: BuildingRuleKey) -> BuildingRule;
}

#[starknet::component]
pub mod BuildingState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::ResourceAmount;
    use super::{
        Building, BuildingKey, BuildingRule, BuildingRuleConfig, BuildingRuleKey, BuildingTerms, StructureBuildings,
        change_count,
    };
    #[storage]
    pub struct Storage {
        #[flat]
        pub data: games_storage::buildings::BuildingStateStorage<
            Building, StructureBuildings, super::BoardTerms, super::NeighborBonus, BuildingTerms, ResourceAmount,
        >,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn configure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            rules: Span<BuildingRuleConfig>,
            board: Option<super::BoardRules>,
        ) {
            assert!(!self.data.configured.read(game_id), "immutable building rules");
            assert!(rules.len() == 40, "incomplete building rules");
            let mut expected = 1_u8;
            for config in rules {
                assert!(*config.category == expected, "building rules must be ordered");
                let rule = *config.rule;
                self
                    .data
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
                    self.data.board_neighbors.write((game_id, index), bonus);
                }
                self
                    .data
                    .board_terms
                    .write(
                        game_id,
                        Some(
                            super::BoardTerms {
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
            self.data.configured.write(game_id, true);
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
        fn board(self: @ComponentState<TContractState>, game_id: u32) -> Option<super::BoardRules> {
            assert!(self.data.configured.read(game_id), "missing building rules");
            let Some(terms) = self.data.board_terms.read(game_id) else {
                return None;
            };
            let mut neighbors = array![];
            for index in 0..terms.neighbor_count {
                neighbors.append(self.data.board_neighbors.read((game_id, index)));
            }
            Some(
                super::BoardRules {
                    demolition_refund_bps: terms.demolition_refund_bps,
                    workshop_rate: terms.workshop_rate,
                    barracks_ii_cost: terms.barracks_ii_cost,
                    barracks_iii_cost: terms.barracks_iii_cost,
                    neighbors: neighbors.span(),
                },
            )
        }
        fn rule(self: @ComponentState<TContractState>, key: BuildingRuleKey) -> BuildingRule {
            assert!(self.data.configured.read(key.game_id), "missing building rules");
            assert!(key.category > 0 && key.category <= 40, "invalid building category");
            let terms = self.data.terms.read((key.game_id, key.category));
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
                self.data.costs.write((game_id, category, complex, index.try_into().unwrap()), cost);
            }
        }
        fn read_costs(
            self: @ComponentState<TContractState>, key: BuildingRuleKey, complex: bool, count: u8,
        ) -> Span<ResourceAmount> {
            let mut costs = array![];
            for index in 0..count {
                costs.append(self.data.costs.read((key.game_id, key.category, complex, index)));
            }
            costs.span()
        }
        fn building(self: @ComponentState<TContractState>, key: BuildingKey) -> Option<Building> {
            let storage_key = (key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row);
            let building = self.data.buildings.read(storage_key);
            if building.category != 0 {
                Some(building)
            } else {
                None
            }
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
            let mut counts = self.data.structure_buildings.read((key.game_id, building.outer_entity_id));
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
            let mut counts = self.data.structure_buildings.read((key.game_id, building.outer_entity_id));
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
            self.data.structure_buildings.write((game_id, entity_id), counts);
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

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateBuilding {
    pub structure_id: u32,
    pub directions: Span<u8>,
    pub category: u8,
    pub use_simple: bool,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChangeBuilding {
    pub structure_id: u32,
    pub coord: crate::troops::Coord,
}
#[starknet::interface]
pub trait IBuildingCommands<T> {
    fn create_building(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: CreateBuilding,
        context: crate::commands::ExecutionContext,
    );
    fn destroy_building(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ChangeBuilding,
        context: crate::commands::ExecutionContext,
    );
    fn pause_building_production(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ChangeBuilding,
        context: crate::commands::ExecutionContext,
    );
    fn resume_building_production(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ChangeBuilding,
        context: crate::commands::ExecutionContext,
    );
}

pub fn produced_resource(category: u8) -> u8 {
    match category {
        1 | 2 => 0,
        39 => 38,
        40 => 57,
        _ => {
            assert!(category > 2 && category < 39, "invalid production building");
            category - 2
        },
    }
}

pub fn can_produce(category: u8, mut resources: u128) -> bool {
    if category <= 2 || category >= 27 {
        return true;
    }
    let resource = produced_resource(category);
    for _ in 0_u8..16 {
        if resources % 256 == resource.into() {
            return true;
        }
        resources /= 256;
    }
    false
}
