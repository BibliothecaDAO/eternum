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
    pub reward_profile: u8,
    pub cosmetic_limit: u8,
    pub cosmetic_collection: ContractAddress,
    pub cosmetic_timelock: ContractAddress,
    pub ledger_operator: ContractAddress,
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

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CosmeticsKey {
    pub game_id: u32,
    pub player: ContractAddress,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PlayerCosmetics {
    pub attributes: Span<u128>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AcceptedCosmetic {
    pub token_id: u128,
    pub owner: ContractAddress,
    pub attributes: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettleBlitz {
    pub name: felt252,
    pub owner: ContractAddress,
    pub cosmetics_block_hash: felt252,
    pub cosmetics_block_number: u64,
    pub cosmetics: Span<AcceptedCosmetic>,
    pub grant_starting_troops: bool,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct EntryEntitlement {
    pub realm_id: u256,
    pub metadata_1: felt252,
    pub metadata_2: felt252,
    pub metadata_3: felt252,
    pub pass_kind: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementAdmission {
    pub owner: ContractAddress,
    pub collection: ContractAddress,
    pub timelock: ContractAddress,
    pub cosmetic_limit: u8,
    pub game_end: u64,
}

#[starknet::interface]
pub trait ISettlementCommands<T> {
    fn settle_blitz(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: SettleBlitz,
        context: crate::commands::ExecutionContext,
    );
}

#[starknet::interface]
pub trait ISettlementEntry<T> {
    fn register_entitlement(ref self: T, key: EntryKey, entitlement: EntryEntitlement);
    fn entry_entitlement(self: @T, key: EntryKey) -> Option<EntryEntitlement>;
    fn settlement_admission(self: @T, game_id: u32, actor: ContractAddress) -> SettlementAdmission;
}

#[starknet::interface]
pub trait ISettlementViews<T> {
    fn settlement_rules(self: @T, game_id: u32) -> SettlementRules;
    fn realm_grants(self: @T, game_id: u32) -> RealmGrants;
    fn settlement_progress(self: @T, game_id: u32) -> SettlementProgress;
    fn player_entry(self: @T, key: EntryKey) -> Option<PlayerEntry>;
    fn player_cosmetics(self: @T, key: CosmeticsKey) -> PlayerCosmetics;
}

#[starknet::interface]
pub trait ISettlementPool<T> {
    fn settlement_pool(self: @T, game_id: u32) -> SettlementPool;
    fn reserved_hyperstructures(self: @T, game_id: u32) -> u32;
    fn claim_settlement(ref self: T, game_id: u32, registered: u16, seed: u256) -> Span<Coord>;
}

#[starknet::component]
pub mod SettlementPoolState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::settlement_grid::{settlement_location, target_pool_size};
    use crate::troops::Coord;
    use super::{SettlementLocation, SettlementPool, SettlementRules};

    #[storage]
    pub struct Storage {
        pub reserved_hyperstructures: Map<u32, u32>,
        pub opened: Map<u32, u32>,
        pub available_count: Map<u32, u16>,
        pub candidates: Map<(u32, u16), u32>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn pool(
            self: @ComponentState<TContractState>, game_id: u32, center: Coord, rules: SettlementRules,
        ) -> SettlementPool {
            let mut available = array![];
            for index in 0..self.available_count.read(game_id) {
                available
                    .append(
                        SettlementLocation {
                            coords: settlement_location(
                                center, rules.mode, rules.reward_profile, self.candidates.read((game_id, index)),
                            ),
                        },
                    );
            }
            SettlementPool { opened: self.opened.read(game_id), available: available.span() }
        }
        fn claim(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            center: Coord,
            rules: SettlementRules,
            registered: u16,
            seed: u256,
        ) -> Span<Coord> {
            let target = target_pool_size(registered, rules.registration_limit, rules.mode);
            let mut count = self.available_count.read(game_id);
            let mut opened = self.opened.read(game_id);
            while count < target {
                self.candidates.write((game_id, count), opened);
                count += 1;
                opened += 1;
            }
            assert!(count != 0, "no open settlements");
            let selected: u16 = crate::random::range(seed, 98139, count.into()).try_into().unwrap();
            let candidate = self.candidates.read((game_id, selected));
            let remaining = count - 1;
            if selected != remaining {
                self.candidates.write((game_id, selected), self.candidates.read((game_id, remaining)));
            }
            self.available_count.write(game_id, remaining);
            if opened != self.opened.read(game_id) {
                self.opened.write(game_id, opened);
            }
            let mut values = array![];
            self.pool(game_id, center, rules).serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'SettlementPool', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
            settlement_location(center, rules.mode, rules.reward_profile, candidate)
        }
    }
}

#[starknet::component]
pub mod SettlementState {
    use core::num::traits::Zero;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{
        AcceptedCosmetic, CosmeticsKey, EntryEntitlement, EntryKey, PlayerCosmetics, PlayerEntry, RealmGrants,
        SettlementProgress, SettlementRules,
    };
    #[storage]
    pub struct Storage {
        pub settlement_rules: Map<u32, Option<SettlementRules>>,
        pub grant_counts: Map<u32, u32>,
        pub realm_grants: Map<(u32, u32), crate::resources::ResourceAmount>,
        pub progress: Map<u32, SettlementProgress>,
        pub entries: Map<(u32, starknet::ContractAddress), Option<PlayerEntry>>,
        pub cosmetic_counts: Map<(u32, starknet::ContractAddress), u32>,
        pub cosmetics: Map<(u32, starknet::ContractAddress, u32), u128>,
        pub starting_troops: Map<(u32, u8), crate::troops::TroopType>,
        pub realm_resource_counts: Map<u32, u8>,
        pub realm_resources: Map<(u32, u8), u8>,
        pub entitlements: Map<(u32, starknet::ContractAddress), Option<EntryEntitlement>>,
        pub entered_players: Map<(u32, starknet::ContractAddress), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> SettlementRules {
            self.settlement_rules.read(game_id).expect('missing settlement rules')
        }
        fn configure(
            ref self: ComponentState<TContractState>, game_id: u32, rules: SettlementRules, grants: RealmGrants,
        ) {
            assert!(self.settlement_rules.read(game_id).is_none(), "immutable settlement rules");
            assert!(rules.registration_limit <= 96, "registration capacity exceeds limit");
            assert!(grants.starting_troops.len() == 17, "incomplete biome starting troops");
            for index in 0_u32..17 {
                self
                    .starting_troops
                    .write((game_id, (index + 1).try_into().unwrap()), *grants.starting_troops.at(index));
            }
            assert!(grants.realm_resources.len() <= 16, "realm resources exceed packed capacity");
            self.realm_resource_counts.write(game_id, grants.realm_resources.len().try_into().unwrap());
            for index in 0..grants.realm_resources.len() {
                let resource = *grants.realm_resources.at(index);
                assert!(resource >= 1 && resource <= 58, "invalid realm resource");
                self.realm_resources.write((game_id, index.try_into().unwrap()), resource);
            }
            self.grant_counts.write(game_id, grants.resources.len());
            let mut index = 0;
            for grant in grants.resources {
                self.realm_grants.write((game_id, index), *grant);
                index += 1;
            }
            let mut values = array![];
            grants.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'RealmGrants', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
            self.settlement_rules.write(game_id, Some(rules));
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SettlementRules',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn grants(self: @ComponentState<TContractState>, game_id: u32) -> RealmGrants {
            let _ = self.rules(game_id);
            let mut resources = array![];
            for index in 0..self.grant_counts.read(game_id) {
                resources.append(self.realm_grants.read((game_id, index)));
            }
            let mut starting_troops = array![];
            for biome in 1_u8..18 {
                starting_troops.append(self.starting_troops.read((game_id, biome)));
            }
            let mut realm_resources = array![];
            for index in 0..self.realm_resource_counts.read(game_id) {
                realm_resources.append(self.realm_resources.read((game_id, index)));
            }
            RealmGrants {
                resources: resources.span(),
                starting_troops: starting_troops.span(),
                realm_resources: realm_resources.span(),
            }
        }
        fn entry(self: @ComponentState<TContractState>, key: EntryKey) -> Option<PlayerEntry> {
            self.entries.read((key.game_id, key.owner))
        }
        fn register_entitlement(
            ref self: ComponentState<TContractState>, key: EntryKey, entitlement: EntryEntitlement,
        ) {
            let previous = self.entitlements.read((key.game_id, key.owner));
            if let Some(previous) = previous {
                assert!(previous == entitlement, "conflicting entry entitlement");
                return;
            }
            self.entitlements.write((key.game_id, key.owner), Some(entitlement));
            let mut values = array![];
            entitlement.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'EntryEntitlement',
                        keys: array![key.game_id.into(), key.owner.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn reserve_entry(ref self: ComponentState<TContractState>, key: EntryKey, player: starknet::ContractAddress) {
            assert!(key.owner.is_non_zero(), "gameplay account is not bound");
            assert!(self.entries.read((key.game_id, key.owner)).is_none(), "owner already settled");
            if self.rules(key.game_id).ledger_operator.is_non_zero() {
                assert!(self.entitlements.read((key.game_id, key.owner)).is_some(), "entry entitlement required");
            }
            self.record_entry(key, player);
        }
        fn record_entry(ref self: ComponentState<TContractState>, key: EntryKey, player: starknet::ContractAddress) {
            assert!(key.owner.is_non_zero(), "gameplay account is not bound");
            self.entries.write((key.game_id, key.owner), Some(PlayerEntry { player }));
            self.entered_players.write((key.game_id, player), true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerEntry',
                        keys: array![key.game_id.into(), key.owner.into()].span(),
                        values: array![player.into()].span(),
                    },
                );
        }
        fn store_cosmetics(
            ref self: ComponentState<TContractState>,
            key: CosmeticsKey,
            owner: starknet::ContractAddress,
            block_hash: felt252,
            cosmetics: Span<AcceptedCosmetic>,
        ) {
            let rules = self.rules(key.game_id);
            if cosmetics.is_empty() || rules.cosmetic_collection.is_zero() || rules.cosmetic_timelock.is_zero() {
                return;
            }
            assert!(block_hash != 0, "missing cosmetic block identity");
            assert!(cosmetics.len() <= rules.cosmetic_limit.into(), "exceeded maximum cosmetics");
            let mut attributes = array![];
            for cosmetic in cosmetics {
                assert!(*cosmetic.owner == owner, "wallet does not own cosmetic");
                assert!(*cosmetic.attributes != 0, "cosmetic attributes cannot be zero");
                self.cosmetics.write((key.game_id, key.player, attributes.len()), *cosmetic.attributes);
                attributes.append(*cosmetic.attributes);
            }
            self.cosmetic_counts.write((key.game_id, key.player), attributes.len());
            let mut values = array![];
            PlayerCosmetics { attributes: attributes.span() }.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerCosmetics',
                        keys: array![key.game_id.into(), key.player.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn write_progress(ref self: ComponentState<TContractState>, game_id: u32, progress: SettlementProgress) {
            self.progress.write(game_id, progress);
            let mut values = array![];
            progress.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SettlementProgress',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn cosmetics(self: @ComponentState<TContractState>, key: CosmeticsKey) -> PlayerCosmetics {
            let mut attributes = array![];
            for index in 0..self.cosmetic_counts.read((key.game_id, key.player)) {
                attributes.append(self.cosmetics.read((key.game_id, key.player, index)));
            }
            PlayerCosmetics { attributes: attributes.span() }
        }
    }
}

#[starknet::interface]
pub trait ISettlementConfiguration<T> {
    fn configure_settlement(ref self: T, game_id: u32, rules: SettlementRules, grants: RealmGrants);
}

#[starknet::interface]
pub trait IBlitzReservations<T> {
    fn reserve_hyperstructures(
        ref self: T, game_id: u32, actor: ContractAddress, count: u8, context: crate::commands::ExecutionContext,
    );
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
    fn create_blitz_realm(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        realm_id: u16,
        coord: Coord,
        grant_troops: bool,
        context: crate::commands::ExecutionContext,
    ) -> u32;
    fn activate_realm_economy(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ExecutionContext,
    );
}

#[starknet::interface]
pub trait ISettlementDisplacement<T> {
    fn displace_explorer(ref self: T, game_id: u32, explorer_id: u32);
}

#[starknet::interface]
pub trait IBlitzHyperstructures<T> {
    fn create_reserved_hyperstructure(
        ref self: T, game_id: u32, actor: ContractAddress, coord: Coord, context: crate::commands::ExecutionContext,
    );
}
