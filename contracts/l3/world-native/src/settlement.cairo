use starknet::ContractAddress;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum SettlementMode {
    Single,
    Triple,
    Duel,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SettlementRules {
    pub registration_start: u32,
    pub registration_limit: u16,
    pub mode: SettlementMode,
    pub spacing: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementLocation {
    pub coords: Span<Coord>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementPool {
    pub opened: u32,
    pub available: Span<SettlementLocation>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SettlementProgress {
    pub registered: u16,
    pub realm_count: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EntryKey {
    pub game_id: u32,
    pub owner: ContractAddress,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerEntry {
    pub player: ContractAddress,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct EntryEntitlement {
    pub realm_id: u256,
    pub metadata_1: felt252,
    pub metadata_2: felt252,
    pub metadata_3: felt252,
    pub pass_kind: u8,
}

#[starknet::interface]
pub trait ISettlementCommands<T> {
    fn settle_blitz_roster(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u64, crate::ownership::StoryCursor);
}

#[starknet::interface]
pub trait ISettlementEntry<T> {
    fn register_entitlement(ref self: T, key: EntryKey, entitlement: EntryEntitlement);
    fn entry_entitlement(self: @T, key: EntryKey) -> Option<EntryEntitlement>;
}

#[starknet::interface]
pub trait ISettlementViews<T> {
    #[cfg(test)]
    fn blitz_settlement_order(self: @T, game_id: u32) -> Span<u8>;
    #[cfg(test)]
    fn player_has_settled(self: @T, game_id: u32, player: ContractAddress) -> bool;
    #[cfg(test)]
    fn settlement_rules(self: @T, game_id: u32) -> SettlementRules;
    #[cfg(test)]
    fn realm_grants(self: @T, game_id: u32) -> RealmGrants;
    #[cfg(test)]
    fn settlement_progress(self: @T, game_id: u32) -> SettlementProgress;
    #[cfg(test)]
    fn player_entry(self: @T, key: EntryKey) -> Option<PlayerEntry>;
}

#[starknet::interface]
pub trait ISettlementPool<T> {
    #[cfg(test)]
    fn settlement_pool(self: @T, game_id: u32, game_context: crate::commands::ActionContext) -> SettlementPool;
    fn village_pool(self: @T, game_id: u32, game_context: crate::commands::ActionContext) -> SettlementPool;
    fn claim_village(
        ref self: T, game_id: u32, registered: u16, seed: u256, game_context: crate::commands::ActionContext,
    ) -> Coord;
    #[cfg(test)]
    fn reserved_hyperstructures(self: @T, game_id: u32) -> u32;
}

#[starknet::interface]
pub trait IBlitzReservations<T> {
    fn initialize_reservations(ref self: T, game_id: u32);
    fn release_hyperstructure(ref self: T, game_id: u32, coord: Coord);
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmGrants {
    pub resources: Span<crate::resources::ResourceAmount>,
    pub starting_troops: Span<crate::troops::TroopType>,
    pub realm_resources: Span<u8>,
}

#[starknet::interface]
pub trait IRealmCreation<T> {
    fn provision_and_upgrade_realm(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn activate_realm_economy(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

#[starknet::interface]
pub trait ISettlementDisplacement<T> {
    fn displace_explorer(ref self: T, game_id: u32, explorer_id: u32, game_context: crate::commands::ActionContext);
}

#[starknet::interface]
pub trait IBlitzHyperstructures<T> {
    fn create_reserved_hyperstructure(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        coord: Coord,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmCreation {
    pub realm_id: u16,
    pub traits: crate::realms::RealmTraits,
    pub grant_troops: bool,
    pub activate_economy: bool,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct VillageCreation {
    pub connected_realm: u32,
    pub resource: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum SettlementCreation {
    Realm: RealmCreation,
    Village: VillageCreation,
}
#[starknet::interface]
pub trait ISettlementCreation<T> {
    fn create_settlement(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        coord: Coord,
        creation: SettlementCreation,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u32, crate::ownership::StoryCursor);
}

// Fisher-Yates selection fixes each roster position once from the first recorded batch root.
pub fn shuffle_roster(count: u32, root: u256) -> Span<u8> {
    assert!(count > 0 && count <= 24, "invalid Blitz roster size");
    let mut remaining: core::dict::Felt252Dict<u32> = Default::default();
    for index in 0..count {
        remaining.insert(index.into(), index);
    }
    let mut players = array![];
    for index in 0..count {
        let size = count - index;
        let choice: u32 = crate::random::range(root, 98139 + index.into(), size.into()).try_into().unwrap();
        players.append(remaining.get(choice.into()).try_into().unwrap());
        let last = remaining.get((size - 1).into());
        remaining.insert(choice.into(), last);
    }
    players.span()
}

// Off-map realms retain their launch reference for the starting troop biome and immutable creation story.
pub fn off_map_realm_reference(realm_id: u32) -> crate::troops::Coord {
    crate::troops::Coord { alt: false, x: 0xffffffff - realm_id, y: 0xffffffff }
}

#[starknet::interface]
pub trait ITerrainDerivation<T> {
    fn biome(self: @T, key: crate::map::TileKey, context: crate::commands::BiomeContext) -> u8;
    fn expedition_home_ring(self: @T, game_id: u32, realm_id: u16, timestamp: u64) -> Span<(Coord, u8)>;
}
