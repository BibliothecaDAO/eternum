use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::troops::Coord;

pub const CANONICAL_REALM_COUNT: u32 = 8000;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmTraits {
    pub wonder: u8,
    pub order: u8,
    pub resources: Span<u8>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmCatalogue {
    pub initialized: u32,
    pub digest: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettleSeason {
    pub name: felt252,
    pub selected_realm: Option<u32>,
}

#[starknet::interface]
pub trait ISeasonRealms<T> {
    fn initialize_realm_traits(ref self: T, first_realm: u32, packed_traits: Span<u32>);
    #[cfg(test)]
    fn realm_catalogue(self: @T) -> RealmCatalogue;
    #[cfg(test)]
    fn realm_traits(self: @T, realm_id: u32) -> RealmTraits;
    #[cfg(test)]
    fn available_realm(self: @T, game_id: u32, index: u32) -> u32;
    fn settle_season(
        ref self: T, game_id: u32, actor: ContractAddress, command: SettleSeason, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait ISeasonPlacement<T> {
    fn claim_season_settlement(ref self: T, game_id: u32, settled_count: u16, seed: u256) -> Coord;
}

pub fn decode_traits(packed: u32) -> RealmTraits {
    let wonder = (packed / 0x4000000).try_into().unwrap();
    assert!(wonder >= 1 && wonder <= 51, "invalid realm wonder");
    let order = ((packed / 0x400000) % 16 + 1).try_into().unwrap();
    let mut mask = packed % 0x400000;
    let mut resources = array![];
    for resource in 1_u8..23 {
        if mask % 2 != 0 {
            resources.append(resource);
        }
        mask /= 2;
    }
    assert!(!resources.is_empty(), "realm has no production traits");
    RealmTraits { wonder, order, resources: resources.span() }
}

pub fn decode_entitlement(metadata: felt252) -> RealmTraits {
    let metadata: u256 = metadata.into();
    let length: u32 = (metadata % 256).try_into().unwrap();
    assert!(length <= 31, "invalid realm metadata length");
    let mut scale = 1_u256;
    for _ in 0..length {
        scale *= 256;
    }
    let mut value = (metadata / 65536) % scale;
    let mut attrs = array![];
    for _ in 0..length {
        if value == 0 {
            break;
        }
        attrs.append((value % 256).try_into().unwrap());
        value /= 256;
    }
    // The pinned encoding has four geographic attributes before resources, then Order and wonder.
    assert!(attrs.len() >= 7, "realm has no production traits");
    let wonder: u8 = *attrs.at(attrs.len() - 1);
    let order: u8 = *attrs.at(attrs.len() - 2);
    assert!(wonder >= 1 && wonder <= 51, "invalid realm wonder");
    assert!(order >= 1 && order <= 16, "invalid realm Order");
    RealmTraits { wonder, order, resources: attrs.span().slice(4, attrs.len() - 6) }
}
