use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::settlement::{EntryKey, PlayerEntry, RealmGrants, SettlementRules};

pub fn rules(game_id: u32) -> SettlementRules {
    let state = crate::state::read();
    SettlementRules {
        registration_start: state.games.overrides.entry(game_id).registration_start.read(),
        registration_limit: 0,
        mode: crate::settlement::SettlementMode::Single,
        spacing: spacing(),
    }
}

pub fn spacing() -> u32 {
    crate::balance::settlement::SETTLEMENT_SPACING_STEPS
}

pub fn grants() -> RealmGrants {
    RealmGrants {
        resources: crate::balance::settlement::REALM_GRANTS.span(),
        starting_troops: crate::balance::settlement::STARTING_TROOPS.span(),
        realm_resources: crate::balance::settlement::REALM_RESOURCES.span(),
    }
}

pub fn biome_troop(biome: u8) -> crate::troops::TroopType {
    *crate::balance::settlement::STARTING_TROOPS.span().at(biome.into() - 1)
}

pub fn entry(key: EntryKey) -> Option<PlayerEntry> {
    let state = crate::state::read();
    state.settlements.entries.read((key.game_id, key.owner))
}

#[starknet::component]
pub mod SettlementPoolState {
    use core::num::traits::CheckedAdd;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::settlement::{SettlementLocation, SettlementPool, SettlementRules};
    use crate::settlement_grid::settlement_location;
    use crate::troops::Coord;

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
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn pool(
            self: @ComponentState<TContractState>, game_id: u32, center: Coord, rules: SettlementRules,
        ) -> SettlementPool {
            self.project_pool(game_id, false, center, rules)
        }
        fn village_pool(
            self: @ComponentState<TContractState>, game_id: u32, center: Coord, rules: SettlementRules,
        ) -> SettlementPool {
            self.project_pool(game_id, true, center, rules)
        }
        fn project_pool(
            self: @ComponentState<TContractState>, game_id: u32, village: bool, center: Coord, rules: SettlementRules,
        ) -> SettlementPool {
            let mut available = array![];
            for index in 0..self.data.settlement_pool.available_count.read((game_id, village)) {
                available
                    .append(
                        SettlementLocation {
                            coords: array![
                                settlement_location(
                                    center,
                                    rules.spacing,
                                    self.data.settlement_pool.candidates.read((game_id, village, index)),
                                ),
                            ]
                                .span(),
                        },
                    );
            }
            SettlementPool {
                opened: self.data.settlement_pool.opened.read((game_id, village)), available: available.span(),
            }
        }
        fn claim_village(
            ref self: ComponentState<TContractState>, game_id: u32, center: Coord, rules: SettlementRules, seed: u256,
        ) -> Coord {
            // Village passes have no registration quota. Six candidates is the planner's initial window.
            self.prepare_pool(game_id, true, center, rules, 6);
            self.take_candidate(game_id, true, center, rules, seed)
        }
        fn prepare_pool(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            village: bool,
            center: Coord,
            rules: SettlementRules,
            target: u16,
        ) -> bool {
            let key = (game_id, village);
            let mut count = self.data.settlement_pool.available_count.read(key);
            let previous = count;
            let mut opened = self.data.settlement_pool.opened.read(key);
            while count < target {
                let coord = settlement_location(center, rules.spacing, opened);
                opened = opened.checked_add(1).expect('settlement geometry exhausted');
                if !self.reserve_location(game_id, coord) {
                    continue;
                }
                self.data.settlement_pool.candidates.write((game_id, village, count), opened - 1);
                count += 1;
            }
            if count == previous {
                return false;
            }
            self.data.settlement_pool.available_count.write(key, count);
            self.data.settlement_pool.opened.write(key, opened);
            true
        }
        fn reserve_location(ref self: ComponentState<TContractState>, game_id: u32, coord: Coord) -> bool {
            if self.data.settlement_pool.reserved.read((game_id, coord.x, coord.y)) {
                return false;
            }
            self.data.settlement_pool.reserved.write((game_id, coord.x, coord.y), true);
            true
        }
        fn take_candidate(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            village: bool,
            center: Coord,
            rules: SettlementRules,
            seed: u256,
        ) -> Coord {
            let count = self.data.settlement_pool.available_count.read((game_id, village));
            assert!(count != 0, "no open settlements");
            let selected: u16 = crate::random::range(seed, 98139, count.into()).try_into().unwrap();
            let candidate = self.data.settlement_pool.candidates.read((game_id, village, selected));
            let remaining = count - 1;
            if selected != remaining {
                self
                    .data
                    .settlement_pool
                    .candidates
                    .write(
                        (game_id, village, selected),
                        self.data.settlement_pool.candidates.read((game_id, village, remaining)),
                    );
            }
            self.data.settlement_pool.available_count.write((game_id, village), remaining);
            self.emit_pool(game_id, village, center, rules);
            settlement_location(center, rules.spacing, candidate)
        }
        fn emit_pool(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            village: bool,
            center: Coord,
            rules: SettlementRules,
        ) {
            let mut values = array![];
            self.project_pool(game_id, village, center, rules).serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: if village {
                            'VillagePool'
                        } else {
                            'SettlementPool'
                        },
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}

#[starknet::component]
pub mod SettlementState {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::events::RowSet;
    use crate::settlement::{EntryEntitlement, EntryKey, PlayerEntry, SettlementProgress};

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
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn register_entitlement(
            ref self: ComponentState<TContractState>, key: EntryKey, entitlement: EntryEntitlement,
        ) {
            let previous = self.data.settlements.entitlements.read((key.game_id, key.owner));
            if let Some(previous) = previous {
                assert!(previous == entitlement, "conflicting entry entitlement");
                return;
            } else if self.data.settlements.entries.read((key.game_id, key.owner)).is_some() {
                self.attach_source_to_founded_home(key, entitlement);
            } else if entitlement.pass_kind == crate::settlement::HELD_REALM_KIND {
                self.reserve_held_realm(key, entitlement);
            }
            self.data.settlements.entitlements.write((key.game_id, key.owner), Some(entitlement));
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
        fn owned_open_home(self: @ComponentState<TContractState>, key: EntryKey) -> u64 {
            let home = self.data.games.open_homes.read((key.game_id, key.owner));
            assert!(home != 0, "owner has no open home");
            let owner = self.data.structures.structures.entry((key.game_id, home)).owner.read();
            assert!(owner == key.owner, "home owner changed");
            home
        }
        fn attach_source_to_founded_home(
            ref self: ComponentState<TContractState>, key: EntryKey, entitlement: EntryEntitlement,
        ) {
            let home = self.owned_open_home(key);
            assert!(entitlement.pass_kind == crate::settlement::HELD_REALM_KIND, "invalid home source");
            self.reserve_held_realm(key, entitlement);
            self.claim_held_realm(key, entitlement.realm_id.try_into().unwrap(), home);
        }

        fn reserve_held_realm(ref self: ComponentState<TContractState>, key: EntryKey, entitlement: EntryEntitlement) {
            assert!(entitlement.realm_id > 0 && entitlement.realm_id <= 8000, "invalid canonical realm");
            assert!(
                entitlement.metadata_1 == 0 && entitlement.metadata_2 == 0 && entitlement.metadata_3 == 0,
                "held Realm uses catalogue",
            );
            let realm_id: u32 = entitlement.realm_id.try_into().unwrap();
            assert!(
                self.data.settlements.held_realm_owners.read((key.game_id, realm_id)).is_zero(),
                "Realm already registered",
            );
            assert!(self.data.settlements.held_realm_homes.read((key.game_id, realm_id)) == 0, "Realm already settled");
            self.data.settlements.held_realm_owners.write((key.game_id, realm_id), key.owner);
        }
        fn claim_held_realm(ref self: ComponentState<TContractState>, key: EntryKey, realm_id: u32, home: u64) {
            let game_id = key.game_id;
            let joined = self.data.settlements.home_aspects.read((game_id, home));
            if joined != 0 {
                let orders = crate::logic::aspects::rules();
                let traits = crate::realms::decode_traits(self.data.realms.traits.read(realm_id));
                assert!(
                    crate::aspects::order_aspect(orders, traits.order) == joined, "Realm belongs to another Aspect",
                );
            }
            assert!(
                self.data.settlements.held_realm_owners.read((game_id, realm_id)) == key.owner,
                "Realm reserved for another owner",
            );
            assert!(self.data.settlements.held_realm_homes.read((game_id, realm_id)) == 0, "Realm already settled");
            self.data.settlements.held_realm_homes.write((game_id, realm_id), home);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SettledRealm',
                        keys: array![game_id.into(), realm_id.into()].span(),
                        values: array![home.into()].span(),
                    },
                );
        }
        fn reserve_entry(
            ref self: ComponentState<TContractState>,
            key: EntryKey,
            player: starknet::ContractAddress,
            requires_entitlement: bool,
        ) {
            assert!(key.owner.is_non_zero(), "gameplay account is not bound");
            assert!(self.data.settlements.entries.read((key.game_id, key.owner)).is_none(), "owner already settled");
            if requires_entitlement {
                assert!(
                    self.data.settlements.entitlements.read((key.game_id, key.owner)).is_some(),
                    "entry entitlement required",
                );
            }
            self.record_entry(key, player);
        }
        fn record_entry(ref self: ComponentState<TContractState>, key: EntryKey, player: starknet::ContractAddress) {
            assert!(key.owner.is_non_zero(), "gameplay account is not bound");
            self.data.settlements.entries.write((key.game_id, key.owner), Some(PlayerEntry { player }));
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
        fn write_progress(ref self: ComponentState<TContractState>, game_id: u32, progress: SettlementProgress) {
            self.data.settlements.progress.write(game_id, progress);
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
    }
}
