use starknet::ContractAddress;
use crate::discovery::Discovery;
use crate::resources::ResourceKey;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct StructureBase {
    pub troop_explorer_count: u16,
    pub troop_max_guard_count: u8,
    pub troop_max_explorer_count: u16,
    pub created_at: u32,
    pub category: u8,
    pub coord_x: u32,
    pub coord_y: u32,
    pub level: u8,
    // This lets delayed provisioning know whether the one-time troop start was already applied.
    pub starting_troops_granted: bool,
    pub alt: bool,
}

pub fn structure_coord(base: StructureBase) -> Coord {
    Coord { alt: base.alt, x: base.coord_x, y: base.coord_y }
}

const EXPLORER_COUNT_SCALE: u128 = 0x100;
const EXPLORER_LIMIT_SCALE: u128 = 0x1000000;
const CREATED_AT_SCALE: u128 = 0x10000000000;
const LEVEL_SCALE: u128 = 0x1000000000000000000;
const CATEGORY_SCALE: u128 = 0x100000000000000000000;
const TROOPS_GRANTED_SCALE: u128 = 0x10000000000000000000000;
const LAYER_SCALE: u128 = 0x20000000000000000000000;
const COORDINATE_SCALE: u128 = 0x100000000;

// The low limb holds counts, limits, time and flags; the high limb holds the two coordinates.
// Separate limbs keep both packing and decoding within u128 arithmetic.
pub impl StructureBasePacking of starknet::storage_access::StorePacking<StructureBase, felt252> {
    fn pack(value: StructureBase) -> felt252 {
        let granted = if value.starting_troops_granted {
            1_u128
        } else {
            0
        };
        let low: u128 = value.troop_max_guard_count.into()
            + value.troop_explorer_count.into() * EXPLORER_COUNT_SCALE
            + value.troop_max_explorer_count.into() * EXPLORER_LIMIT_SCALE
            + value.created_at.into() * CREATED_AT_SCALE
            + value.level.into() * LEVEL_SCALE
            + value.category.into() * CATEGORY_SCALE
            + granted * TROOPS_GRANTED_SCALE
            + (if value.alt {
                1_u128
            } else {
                0
            }) * LAYER_SCALE;
        let high = value.coord_x.into() + value.coord_y.into() * COORDINATE_SCALE;
        u256 { low, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> StructureBase {
        let value: u256 = value.into();
        StructureBase {
            troop_max_guard_count: (value.low % 256).try_into().unwrap(),
            troop_explorer_count: (value.low / EXPLORER_COUNT_SCALE % 0x10000).try_into().unwrap(),
            troop_max_explorer_count: (value.low / EXPLORER_LIMIT_SCALE % 0x10000).try_into().unwrap(),
            created_at: (value.low / CREATED_AT_SCALE % COORDINATE_SCALE).try_into().unwrap(),
            level: (value.low / LEVEL_SCALE % 256).try_into().unwrap(),
            category: (value.low / CATEGORY_SCALE % 256).try_into().unwrap(),
            starting_troops_granted: value.low / TROOPS_GRANTED_SCALE % 2 != 0,
            alt: value.low / LAYER_SCALE % 2 != 0,
            coord_x: (value.high % COORDINATE_SCALE).try_into().unwrap(),
            coord_y: (value.high / COORDINATE_SCALE).try_into().unwrap(),
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
            village_realm: (value / CONNECTED_REALM_SCALE % COORDINATE_SCALE).try_into().unwrap(),
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
    pub troop_explorers: Span<u32>,
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
        ref self: T, game_id: u32, coord: Coord, discovery: crate::discovery::Discovery, seed: u256, timestamp: u64,
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
        explorer_id: u32,
        timestamp: u64,
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
        troop_explorer_count: 0,
        troop_max_guard_count: max_guards,
        troop_max_explorer_count: if discovery == Discovery::Camp {
            camp_armies
        } else {
            0
        },
        created_at: timestamp.try_into().unwrap(),
        category,
        coord_x: coord.x,
        coord_y: coord.y,
        level,
        starting_troops_granted: false,
        alt: coord.alt,
    };
    (
        StructureRecord { owner: 0.try_into().unwrap(), base, resources_packed: 0, metadata: Default::default() },
        occupier,
        capacity.into(),
    )
}
