#[starknet::contract]
pub mod SettlementDomain {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::commands::ExecutionContext as DomainContext;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::names::{INamesDispatcher, INamesDispatcherTrait, SetAddressName};
    use crate::realms::{ISeasonPlacementDispatcher, ISeasonPlacementDispatcherTrait};
    use crate::settlement::{
        CosmeticsKey, EntryKey, ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait,
        ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait, PlayerCosmetics, PlayerEntry, RealmCreation,
        RealmGrants, SettlementCreation, SettlementProgress, SettlementRules, SettlementState, VillageCreation,
    };
    use crate::village::{SettleVillage, VillagePass, VillagePassKey, VillageRules, VillageState};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    component!(path: crate::realms::RealmState, storage: realms, event: RealmEvent);
    impl RealmInternal = crate::realms::RealmState::InternalImpl<ContractState>;
    component!(path: SettlementState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementState::InternalImpl<ContractState>;
    component!(path: VillageState, storage: villages, event: VillageEvent);
    impl VillageInternal = VillageState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        realms: crate::realms::RealmState::Storage,
        #[substorage(v0)]
        settlements: SettlementState::Storage,
        #[substorage(v0)]
        villages: VillageState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        RealmEvent: crate::realms::RealmState::Event,
        SettlementEvent: SettlementState::Event,
        VillageEvent: VillageState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl SeasonRealms of crate::realms::ISeasonRealms<ContractState> {
        fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            self.realms.initialize(first_realm, packed_traits);
        }
        fn realm_catalogue(self: @ContractState) -> crate::realms::RealmCatalogue {
            crate::realms::RealmCatalogue {
                initialized: self.realms.catalogue_count.read(), digest: self.realms.catalogue_digest.read(),
            }
        }
        fn realm_traits(self: @ContractState, realm_id: u32) -> crate::realms::RealmTraits {
            self.realms.traits(realm_id)
        }
        fn available_realm(self: @ContractState, game_id: u32, index: u32) -> u32 {
            self.realms.available(game_id, index, self.settlements.progress.read(game_id).realm_count)
        }
        fn settle_season(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::realms::SettleSeason,
            context: DomainContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            let game = self.games().game(game_id);
            assert!(!self.games().rules(game_id).blitz_mode_on, "not a season game");
            assert!(command.name != 0, "name cannot be empty");
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let key = EntryKey { game_id, owner: command.owner };
            if command.selected_realm.is_some() {
                assert!(game.dev_mode_on, "development mode required");
                self.settlements.record_entry(key, actor);
            } else {
                self.settlements.reserve_entry(key, actor);
            }
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            let mut progress = self.settlements.progress.read(game_id);
            let (realm_id, traits) = self.resolve_season_realm(key, command.selected_realm, progress.realm_count, seed);
            self.realms.reserve(game_id, realm_id, progress.realm_count);
            let coord = ISeasonPlacementDispatcher { contract_address: peers.map }
                .claim_season_settlement(game_id, progress.realm_count, seed);
            let structure_id = ISettlementCreationDispatcher { contract_address: peers.structures }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Realm(
                        RealmCreation {
                            realm_id: realm_id.try_into().unwrap(), traits, grant_troops: true, activate_economy: true,
                        },
                    ),
                    context,
                );
            progress.realm_count += 1;
            self.settlements.write_progress(game_id, progress);
            INamesDispatcher { contract_address: peers.structures }
                .set_address_name(
                    game_id, actor, SetAddressName { name: command.name, owned_structure_id: structure_id }, context,
                );
        }
    }

    #[abi(embed_v0)]
    impl Villages of crate::village::IVillages<ContractState> {
        fn configure_villages(ref self: ContractState, game_id: u32, rules: VillageRules) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            let _ = self.games().game(game_id);
            self.villages.configure(game_id, rules);
        }
        fn village_rules(self: @ContractState, game_id: u32) -> VillageRules {
            self.villages.rules(game_id)
        }
        fn village_pass(self: @ContractState, key: VillagePassKey) -> Option<VillagePass> {
            self.villages.pass(key)
        }
        fn register_village_pass(ref self: ContractState, key: VillagePassKey, owner: ContractAddress) {
            let operator = self.settlements.rules(key.game_id).ledger_operator;
            assert!(operator.is_non_zero() && get_caller_address() == operator, "only ledger operator");
            self.villages.register(key, owner);
        }
        fn settle_village(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: SettleVillage,
            context: DomainContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            let game = self.games().game(game_id);
            let rules = self.games().rules(game_id);
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let dev_entry = game.dev_mode_on && !rules.blitz_mode_on;
            let pass = VillagePassKey { game_id, pass_id: command.pass_id };
            if !dev_entry {
                self.villages.require_pass(pass, command.owner);
            }
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id, game.seed);
            let village_rules = self.villages.rules(game_id);
            let resource = crate::village::select_resource(village_rules.resource_pool, seed, context.timestamp);
            let progress = self.settlements.progress.read(game_id);
            let coord = ISettlementPoolDispatcher { contract_address: peers.map }
                .claim_village(game_id, progress.registered, seed);
            let village_id = ISettlementCreationDispatcher { contract_address: peers.structures }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Village(
                        VillageCreation { connected_realm: command.connected_realm_entity_id, resource },
                    ),
                    context,
                );
            if !dev_entry {
                self.villages.consume(pass, command.owner, village_id);
            }
        }
    }
    #[abi(embed_v0)]
    impl SettlementConfiguration of crate::settlement::ISettlementConfiguration<ContractState> {
        fn configure_settlement(ref self: ContractState, game_id: u32, rules: SettlementRules, grants: RealmGrants) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            let _ = self.games().game(game_id);
            self.settlements.configure(game_id, rules, grants);
        }
    }
    #[abi(embed_v0)]
    impl SettlementViews of crate::settlement::ISettlementViews<ContractState> {
        fn realm_grants(self: @ContractState, game_id: u32) -> RealmGrants {
            self.settlements.grants(game_id)
        }
        fn settlement_rules(self: @ContractState, game_id: u32) -> SettlementRules {
            self.settlements.rules(game_id)
        }
        fn settlement_progress(self: @ContractState, game_id: u32) -> SettlementProgress {
            self.settlements.progress.read(game_id)
        }
        fn player_has_settled(self: @ContractState, game_id: u32, player: ContractAddress) -> bool {
            self.settlements.entered_players.read((game_id, player))
        }
        fn player_entry(self: @ContractState, key: EntryKey) -> Option<PlayerEntry> {
            self.settlements.entry(key)
        }
        fn player_cosmetics(self: @ContractState, key: CosmeticsKey) -> PlayerCosmetics {
            self.settlements.cosmetics(key)
        }
    }
    #[abi(embed_v0)]
    impl SettlementEntry of crate::settlement::ISettlementEntry<ContractState> {
        fn register_entitlement(
            ref self: ContractState, key: EntryKey, entitlement: crate::settlement::EntryEntitlement,
        ) {
            let operator = self.settlements.rules(key.game_id).ledger_operator;
            assert!(operator.is_non_zero() && get_caller_address() == operator, "only ledger operator");
            assert!(key.owner.is_non_zero(), "invalid entitlement owner");
            self.settlements.register_entitlement(key, entitlement);
        }
        fn entry_entitlement(self: @ContractState, key: EntryKey) -> Option<crate::settlement::EntryEntitlement> {
            self.settlements.entitlements.read((key.game_id, key.owner))
        }
    }
    #[abi(embed_v0)]
    impl SettlementCommands of crate::settlement::ISettlementCommands<ContractState> {
        fn settle_blitz(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::settlement::SettleBlitz,
            context: DomainContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only recorded settlement dispatch");
            self.validate_registration(game_id, command.name, context.timestamp);
            assert!(!self.settlements.entered_players.read((game_id, actor)), "player already settled");
            self.settlements.reserve_entry(EntryKey { game_id, owner: command.owner }, actor);
            self
                .settlements
                .store_cosmetics(
                    CosmeticsKey { game_id, player: actor },
                    command.owner,
                    command.cosmetics_block_hash,
                    command.cosmetics,
                );
            let coords = self.claim_realm_locations(game_id, context);
            let first_realm = self
                .create_settlement_realms(game_id, actor, coords, command.grant_starting_troops, context);
            INamesDispatcher { contract_address: peers.structures }
                .set_address_name(
                    game_id, actor, SetAddressName { owned_structure_id: first_realm, name: command.name }, context,
                );
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn games(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn resolve_season_realm(
            self: @ContractState, key: EntryKey, selected: Option<u32>, settled: u16, seed: u256,
        ) -> (u32, crate::realms::RealmTraits) {
            if let Some(realm_id) = selected {
                return (realm_id, self.realms.traits(realm_id));
            }
            if self.settlements.rules(key.game_id).ledger_operator.is_zero() {
                let remaining = crate::realms::CANONICAL_REALM_COUNT - settled.into();
                assert!(remaining > 0, "all canonical realms allocated");
                let index = crate::random::range(seed, 71419, remaining.into()).try_into().unwrap();
                let realm_id = self.realms.available(key.game_id, index, settled);
                return (realm_id, self.realms.traits(realm_id));
            }
            let entitlement = self
                .settlements
                .entitlements
                .read((key.game_id, key.owner))
                .expect('missing entitlement');
            assert!(entitlement.pass_kind == 1, "season pass required");
            let realm_id = entitlement.realm_id.try_into().expect('realm id exceeds u32');
            (realm_id, crate::realms::decode_entitlement(entitlement.metadata_1))
        }
        fn validate_registration(self: @ContractState, game_id: u32, name: felt252, timestamp: u64) {
            let game = self.games().game(game_id);
            let rules = self.settlements.rules(game_id);
            assert!(name != 0, "name cannot be empty");
            assert!(game.dev_mode_on || timestamp >= rules.registration_start.into(), "registration not started");
            assert!(game.dev_mode_on || timestamp < game.start_main_at, "registration time is over");
            assert!(self.settlements.progress.read(game_id).registered < rules.registration_limit, "registration full");
        }
        fn claim_realm_locations(
            self: @ContractState, game_id: u32, context: DomainContext,
        ) -> Span<crate::troops::Coord> {
            let pool = ISettlementPoolDispatcher { contract_address: self.lifecycle.require_active().map };
            let rules = self.settlements.rules(game_id);
            let required = crate::settlement_grid::reservation_count(rules.registration_limit, rules.mode);
            assert!(pool.reserved_hyperstructures(game_id) == required, "incomplete hyperstructure reservations");
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id, self.games().game(game_id).seed);
            pool.claim_settlement(game_id, self.settlements.progress.read(game_id).registered, seed)
        }
        fn create_settlement_realms(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            coords: Span<crate::troops::Coord>,
            grant_troops: bool,
            context: DomainContext,
        ) -> u32 {
            let structures = ISettlementCreationDispatcher {
                contract_address: self.lifecycle.require_active().structures,
            };
            let mut progress = self.settlements.progress.read(game_id);
            let mut first_realm = 0;
            for coord in coords {
                progress.realm_count += 1;
                let realm = structures
                    .create_settlement(
                        game_id,
                        actor,
                        *coord,
                        SettlementCreation::Realm(
                            RealmCreation {
                                realm_id: progress.realm_count,
                                traits: crate::realms::RealmTraits {
                                    wonder: 1, order: 0, resources: self.settlements.grants(game_id).realm_resources,
                                },
                                grant_troops,
                                activate_economy: false,
                            },
                        ),
                        context,
                    );
                if first_realm == 0 {
                    first_realm = realm;
                }
            }
            progress.registered += 1;
            self.settlements.write_progress(game_id, progress);
            first_realm
        }
    }
}
