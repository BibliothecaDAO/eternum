use starknet::ContractAddress;
use crate::discovery::Discovery;
use crate::resources::ResourceKey;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct StructureBase {
    pub troop_max_guard_count: u8,
    pub troop_max_explorer_count: u16,
    pub created_at: u32,
    pub category: u8,
    pub level: u8,
    // This lets delayed provisioning know whether the one-time troop start was already applied.
    pub starting_troops_granted: bool,
}

pub fn structure_coord(key: ResourceKey) -> Coord {
    crate::logic::map::entity_coord(key).expect('missing structure position')
}

const EXPLORER_LIMIT_SCALE: u128 = 0x1000000;
const CREATED_AT_SCALE: u128 = 0x10000000000;
const LEVEL_SCALE: u128 = 0x1000000000000000000;
const CATEGORY_SCALE: u128 = 0x100000000000000000000;
const TROOPS_GRANTED_SCALE: u128 = 0x10000000000000000000000;
const U32_RANGE: u128 = 0x100000000;

// Limits, time and flags fit in one limb; position is owned by TileOccupancy.
pub impl StructureBasePacking of starknet::storage_access::StorePacking<StructureBase, felt252> {
    fn pack(value: StructureBase) -> felt252 {
        let granted = if value.starting_troops_granted {
            1_u128
        } else {
            0
        };
        let low: u128 = value.troop_max_guard_count.into()
            + value.troop_max_explorer_count.into() * EXPLORER_LIMIT_SCALE
            + value.created_at.into() * CREATED_AT_SCALE
            + value.level.into() * LEVEL_SCALE
            + value.category.into() * CATEGORY_SCALE
            + granted * TROOPS_GRANTED_SCALE;
        low.into()
    }
    fn unpack(value: felt252) -> StructureBase {
        let value: u128 = value.try_into().unwrap();
        StructureBase {
            troop_max_guard_count: (value % 256).try_into().unwrap(),
            troop_max_explorer_count: (value / EXPLORER_LIMIT_SCALE % 0x10000).try_into().unwrap(),
            created_at: (value / CREATED_AT_SCALE % U32_RANGE).try_into().unwrap(),
            level: (value / LEVEL_SCALE % 256).try_into().unwrap(),
            category: (value / CATEGORY_SCALE % 256).try_into().unwrap(),
            starting_troops_granted: value / TROOPS_GRANTED_SCALE % 2 != 0,
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct StructureMetadata {
    // associated with realm
    pub realm_id: u16,
    pub order: u8,
    pub has_wonder: bool,
    // associated with village
    pub village_realm: u32,
    pub mine_kind: u8,
    pub attunement: u8,
    pub barracks_tier: u8,
}
const ORDER_SCALE: u128 = 0x10000;
const WONDER_SCALE: u128 = 0x1000000;
const CONNECTED_REALM_SCALE: u128 = 0x100000000;
const MINE_KIND_SCALE: u128 = 0x10000000000000000;
pub impl StructureMetadataPacking of starknet::storage_access::StorePacking<StructureMetadata, u128> {
    fn pack(value: StructureMetadata) -> u128 {
        let wonder = if value.has_wonder {
            1_u128
        } else {
            0
        };
        value.realm_id.into()
            + value.order.into() * ORDER_SCALE
            + wonder * WONDER_SCALE
            + value.village_realm.into() * CONNECTED_REALM_SCALE
            + value.mine_kind.into() * MINE_KIND_SCALE
            + value.attunement.into() * 0x1000000000000000000
            + value.barracks_tier.into() * 0x100000000000000000000
    }
    fn unpack(value: u128) -> StructureMetadata {
        StructureMetadata {
            realm_id: (value % ORDER_SCALE).try_into().unwrap(),
            order: (value / ORDER_SCALE % 256).try_into().unwrap(),
            has_wonder: value / WONDER_SCALE % 2 != 0,
            village_realm: (value / CONNECTED_REALM_SCALE % U32_RANGE).try_into().unwrap(),
            mine_kind: (value / MINE_KIND_SCALE % 256).try_into().unwrap(),
            attunement: (value / 0x1000000000000000000 % 256).try_into().unwrap(),
            barracks_tier: (value / 0x100000000000000000000).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Structure {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct StructureRecord {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
}


#[starknet::interface]
pub trait IStructureOperations<T> {
    fn create_discovery(
        ref self: T,
        game_id: u32,
        coord: Coord,
        discovery: crate::discovery::Discovery,
        seed: u256,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    ) -> u32;
    #[cfg(test)]
    fn provision_realm(
        ref self: T, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
    ) -> u32;
    fn pay_for_explorer(
        ref self: T,
        key: ResourceKey,
        actor: ContractAddress,
        resource_type: u8,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}

pub(crate) fn discovered_structure(
    coord: Coord,
    discovery: crate::discovery::Discovery,
    capacities: crate::rules::StructureCapacityConfig,
    camp_armies: u16,
    timestamp: u64,
) -> (StructureRecord, u8, u128) {
    let (category, occupier, level, capacity) = match discovery {
        Discovery::Mine => (4_u8, 12_u8, 0_u8, capacities.fragment_mine_capacity),
        Discovery::Hyperstructure => (2, 9, 3, capacities.hyperstructure_capacity),
        Discovery::BitcoinMine => (8, 38, 3, capacities.bitcoin_mine_capacity),
        Discovery::Camp => (crate::camps::CAMP_CATEGORY, crate::camps::CAMP_OCCUPIER, 0, capacities.camp_capacity),
        Discovery::None => panic!("discovery is not a structure"),
    };
    assert!(
        discovery == Discovery::Mine || coord.alt == (discovery == Discovery::BitcoinMine), "invalid discovery layer",
    );
    let max_guards = if discovery == Discovery::Mine || discovery == Discovery::Camp {
        1
    } else {
        4
    };
    let base = StructureBase {
        troop_max_guard_count: max_guards,
        troop_max_explorer_count: if discovery == Discovery::Camp {
            camp_armies
        } else {
            0
        },
        created_at: timestamp.try_into().unwrap(),
        category,
        level,
        starting_troops_granted: false,
    };
    (
        StructureRecord { owner: 0.try_into().unwrap(), base, resources_packed: 0, metadata: Default::default() },
        occupier,
        capacity.into(),
    )
}
