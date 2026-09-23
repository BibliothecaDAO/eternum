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

pub(crate) fn change_count(ref counts: StructureBuildings, category: u8, adding: bool) {
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
    #[cfg(test)]
    fn building_rule(self: @T, key: BuildingRuleKey) -> BuildingRule;
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
