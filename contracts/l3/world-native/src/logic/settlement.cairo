use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::settlement::{EntryKey, PlayerEntry, RealmGrants, SettlementRules};

pub fn rules(game_id: u32) -> SettlementRules {
    let state = crate::state::read();
    let preset = crate::logic::preset_record::for_game(game_id);
    SettlementRules {
        registration_start: state.games.overrides.read(game_id).registration_start,
        registration_limit: state.registrar.roster_sizes.read(game_id).try_into().unwrap(),
        mode: preset.settlement_mode.read(),
        spacing: preset.settlement_spacing.read(),
    }
}

pub fn grants(game_id: u32) -> RealmGrants {
    let preset = crate::logic::preset_record::for_game(game_id);
    let mut resources = array![];
    for index in 0..preset.realm_grant_count.read() {
        resources.append(preset.realm_grants.read(index));
    }
    let mut starting_troops = array![];
    for biome in 1_u8..18 {
        starting_troops.append(preset.starting_troops.read(biome));
    }
    let mut realm_resources = array![];
    for index in 0..preset.realm_resource_count.read() {
        realm_resources.append(preset.realm_resources.read(index));
    }
    RealmGrants {
        resources: resources.span(), starting_troops: starting_troops.span(), realm_resources: realm_resources.span(),
    }
}

pub fn entry(key: EntryKey) -> Option<PlayerEntry> {
    let state = crate::state::read();
    state.settlements.entries.read((key.game_id, key.owner))
}

pub fn blitz_order(game_id: u32) -> Span<u8> {
    let state = crate::state::read();
    let mut players = array![];
    for index in 0..state.settlements.blitz_order_size.read(game_id) {
        players.append(state.settlements.blitz_order.read((game_id, index)));
    }
    players.span()
}

#[starknet::component]
pub mod SettlementPoolState {
    use core::num::traits::CheckedAdd;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::settlement::{SettlementLocation, SettlementMode, SettlementPool, SettlementRules};
    use crate::settlement_grid::{settlement_location, target_pool_size};
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
            self.project_pool(game_id, true, center, SettlementRules { mode: SettlementMode::Single, ..rules })
        }
        fn project_pool(
            self: @ComponentState<TContractState>, game_id: u32, village: bool, center: Coord, rules: SettlementRules,
        ) -> SettlementPool {
            let mut available = array![];
            for index in 0..self.data.settlement_pool.available_count.read((game_id, village)) {
                available
                    .append(
                        SettlementLocation {
                            coords: settlement_location(
                                center,
                                rules.mode,
                                rules.spacing,
                                self.data.settlement_pool.candidates.read((game_id, village, index)),
                            ),
                        },
                    );
            }
            SettlementPool {
                opened: self.data.settlement_pool.opened.read((game_id, village)), available: available.span(),
            }
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
            assert!(target != 0, "no open settlements");
            self.prepare_pool(game_id, false, center, rules, target);
            self.take_candidate(game_id, false, center, rules, seed)
        }
        fn claim_village(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            center: Coord,
            rules: SettlementRules,
            registered: u16,
            seed: u256,
        ) -> Coord {
            // Fixed Blitz spots were reserved at creation; only Eternum entries open a rolling window.
            let target = if rules.mode == SettlementMode::Triple {
                0
            } else {
                target_pool_size(registered, rules.registration_limit, rules.mode)
            };
            if self.prepare_pool(game_id, false, center, rules, target) {
                self.emit_pool(game_id, false, center, rules);
            }
            let single = SettlementRules { mode: SettlementMode::Single, ..rules };
            // Village passes have no registration quota. Six candidates is the planner's initial window.
            self.prepare_pool(game_id, true, center, single, 6);
            *self.take_candidate(game_id, true, center, single, seed).at(0)
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
                let coords = settlement_location(center, rules.mode, rules.spacing, opened);
                opened = opened.checked_add(1).expect('settlement geometry exhausted');
                if !self.reserve_location(game_id, coords) {
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
        fn reserve_blitz_locations(
            ref self: ComponentState<TContractState>, game_id: u32, center: Coord, rules: SettlementRules,
        ) {
            assert!(rules.mode == SettlementMode::Triple, "Regular Blitz required");
            for index in 0_u32..rules.registration_limit.into() {
                assert!(
                    self.reserve_location(game_id, settlement_location(center, rules.mode, rules.spacing, index)),
                    "overlapping Blitz settlement",
                );
            }
        }
        fn reserve_location(ref self: ComponentState<TContractState>, game_id: u32, coords: Span<Coord>) -> bool {
            for coord in coords {
                if self.data.settlement_pool.reserved.read((game_id, *coord.x, *coord.y)) {
                    return false;
                }
            }
            for coord in coords {
                self.data.settlement_pool.reserved.write((game_id, *coord.x, *coord.y), true);
            }
            true
        }
        fn take_candidate(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            village: bool,
            center: Coord,
            rules: SettlementRules,
            seed: u256,
        ) -> Span<Coord> {
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
            settlement_location(center, rules.mode, rules.spacing, candidate)
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
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
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
            self.data.settlements.entered_players.write((key.game_id, player), true);
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

        fn initialize_blitz_order(ref self: ComponentState<TContractState>, game_id: u32, count: u32, root: u256) {
            assert!(self.data.settlements.blitz_order_size.read(game_id) == 0, "settlement order already fixed");
            let players = crate::settlement::shuffle_roster(count, root);
            for index in 0..players.len() {
                self.data.settlements.blitz_order.write((game_id, index), *players.at(index));
            }
            self.data.settlements.blitz_order_size.write(game_id, count);
            let mut values = array![];
            players.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BlitzSettlementOrder',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
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
