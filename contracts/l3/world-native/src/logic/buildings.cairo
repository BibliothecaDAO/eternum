use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::buildings::Building;
use crate::resources::IResourceOperationsDispatcherTrait;

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

pub fn assert_building_command(
    key: crate::resources::ResourceKey,
    actor: starknet::ContractAddress,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) -> crate::structures::StructureBase {
    crate::game::assert_playing(game_context.game.unbox(), timestamp);
    assert!(crate::logic::structures::owner(key) == actor, "actor does not own structure");
    let base = crate::state::read().structures.structures.entry((key.game_id, key.entity_id)).base.read();
    assert!(
        base.category == crate::taxonomy::REALM_CATEGORY
            || base.category == crate::taxonomy::VILLAGE_CATEGORY
            || base.category == crate::taxonomy::CAMP_CATEGORY,
        "structure does not support production",
    );
    base
}

pub fn resolve_building_coord(base: crate::structures::StructureBase, directions: Span<u8>) -> Coord {
    let limits = crate::logic::upgrades::limits();
    let maximum = if base.category == crate::taxonomy::REALM_CATEGORY {
        limits.realm_max
    } else if base.category == crate::taxonomy::VILLAGE_CATEGORY {
        limits.village_max
    } else {
        0
    };
    assert!(!directions.is_empty(), "building path is empty");
    assert!(directions.len() <= Into::<u8, u32>::into(maximum) + 1, "building outside maximum level");
    assert!(directions.len() <= Into::<u8, u32>::into(base.level) + 1, "building outside current level");
    let mut coord = Coord { alt: false, x: 10, y: 10 };
    for direction in directions {
        coord = crate::geometry::neighbor(coord, *direction);
    }
    coord
}

pub fn emit_building_change(
    key: crate::resources::ResourceKey,
    actor: starknet::ContractAddress,
    coord: Coord,
    category: u8,
    change: crate::ownership::BuildingChange,
    timestamp: u64,
) {
    crate::logic::stories::emit_entity_story(
        key,
        actor,
        crate::ownership::Story::BuildingPlacementStory(
            crate::ownership::BuildingPlacementStory { coord, category, change },
        ),
        timestamp,
    );
}

pub fn pay_building_costs(
    key: crate::resources::ResourceKey,
    actor: starknet::ContractAddress,
    coord: Coord,
    category: u8,
    count: u8,
    costs: Span<crate::resources::ResourceAmount>,
    increase: u16,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) -> u128 {
    assert!(!costs.is_empty(), "missing building erection cost");
    let resources = crate::logic::structure_actions::resources_dispatcher(key.game_id);
    let scale: u128 = (count - 1).into();
    let mut paid = array![];
    let mut labor_paid = 0;
    for cost in costs {
        let amount = *cost.amount + scale * scale * crate::math::PercentageImpl::get(*cost.amount, increase.into());
        assert!(amount != 0, "zero building erection cost");
        resources
            .spend_resource(
                key, *cost.resource_type, amount, timestamp, crate::commands::resource_context(game_context),
            );
        if *cost.resource_type == crate::resources::LABOR {
            labor_paid += amount;
        }
        paid.append(crate::resources::ResourceAmount { resource_type: *cost.resource_type, amount });
    }
    crate::logic::stories::emit_entity_story(
        key,
        actor,
        crate::ownership::Story::BuildingPaymentStory(
            crate::ownership::BuildingPaymentStory { coord, category, cost: paid.span() },
        ),
        timestamp,
    );
    labor_paid
}

#[cfg(feature: "blitz")]
pub fn board() -> crate::buildings::BoardRules {
    panic!("Blitz has no realm board")
}

#[cfg(not(feature: "blitz"))]
pub fn board() -> crate::buildings::BoardRules {
    crate::balance::structures::BOARD
}

#[starknet::component]
pub mod BuildingState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::buildings::{Building, BuildingKey, BuildingRule, BuildingRuleKey, StructureBuildings, change_count};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::ResourceKey;
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
                let rule = crate::logic::resources::rule(resource_type);
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
        fn rule(self: @ComponentState<TContractState>, key: BuildingRuleKey) -> BuildingRule {
            assert!(
                key.category > 0 && key.category <= crate::buildings::BUILDING_CATEGORY_COUNT,
                "invalid building category",
            );
            let row = *crate::balance::structures::BUILDINGS.span().at(key.category.into() - 1);
            let costs = crate::balance::structures::BUILDING_COSTS.span();
            BuildingRule {
                population_cost: row.population_cost,
                capacity_grant: row.capacity_grant,
                simple_cost: costs.slice(row.first_cost, row.simple_count),
                complex_cost: costs.slice(row.first_cost + row.simple_count, row.complex_count),
            }
        }
        fn building(self: @ComponentState<TContractState>, key: BuildingKey) -> Option<Building> {
            super::building(key)
        }
        fn create(ref self: ComponentState<TContractState>, key: BuildingKey, building: Building) {
            assert!(self.building(key).is_none(), "building location occupied");
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.structure_id));
            change_count(ref counts, building.category, true);
            self.write_building(key, building);
            self.write_counts(key.game_id, key.structure_id, counts);
        }
        fn remove(ref self: ComponentState<TContractState>, key: BuildingKey, building: Building) {
            let mut counts = self.data.buildings.structure_buildings.read((key.game_id, key.structure_id));
            change_count(ref counts, building.category, false);
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
            ref self: ComponentState<TContractState>, game_id: u32, entity_id: u64, counts: StructureBuildings,
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
