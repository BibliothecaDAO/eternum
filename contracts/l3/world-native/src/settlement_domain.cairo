#[starknet::contract]
pub mod SettlementDomain {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::commands::ExecutionContext as DomainContext;
    use crate::entry::{ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::names::{INamesDispatcher, INamesDispatcherTrait, SetAddressName};
    use crate::realms::{ISeasonPlacementDispatcher, ISeasonPlacementDispatcherTrait};
    use crate::settlement::{
        EntryKey, ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait, ISettlementPoolDispatcher,
        ISettlementPoolDispatcherTrait, PlayerEntry, RealmCreation, RealmGrants, SettlementCreation, SettlementProgress,
        SettlementRules, SettlementState, VillageCreation,
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
            let owner = self.bound_owner(actor);
            let game = self.games().game(game_id);
            let rules = self.games().rules(game_id);
            assert!(rules.entry_rule != 2, "not a season game");
            assert!(command.name != 0, "name cannot be empty");
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let key = EntryKey { game_id, owner: owner };
            if command.selected_realm.is_some() {
                assert!(game.dev_mode_on, "development mode required");
                self.settlements.record_entry(key, actor);
            } else {
                let requires_entitlement = !self.games().game(game_id).dev_mode_on && rules.entry_rule == 0;
                self.settlements.reserve_entry(key, actor, requires_entitlement);
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
            self.lifecycle.assert_configurator();
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
            assert!(key.game_id != 0, "game id zero is reserved");
            let operator = self.ledger_operator();
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
            let owner = self.bound_owner(actor);
            let game = self.games().game(game_id);
            let rules = self.games().rules(game_id);
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let dev_entry = game.dev_mode_on && crate::rules::rule_enabled(rules, crate::rules::DEV_VILLAGE_ENTRY);
            let pass = VillagePassKey { game_id, pass_id: command.pass_id };
            if !dev_entry {
                self.villages.require_pass(pass, owner);
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
                self.villages.consume(pass, owner, village_id);
            }
        }
    }
    #[abi(embed_v0)]
    impl SettlementConfiguration of crate::settlement::ISettlementConfiguration<ContractState> {
        fn configure_settlement(ref self: ContractState, game_id: u32, rules: SettlementRules, grants: RealmGrants) {
            self.lifecycle.assert_configurator();
            let _ = self.games().game(game_id);
            self.settlements.configure(game_id, rules, grants);
        }
    }
    #[abi(embed_v0)]
    impl SettlementViews of crate::settlement::ISettlementViews<ContractState> {
        fn blitz_settlement_order(self: @ContractState, game_id: u32) -> Span<u8> {
            self.settlements.blitz_order(game_id)
        }
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
    }
    #[abi(embed_v0)]
    impl SettlementEntry of crate::settlement::ISettlementEntry<ContractState> {
        fn register_entitlement(
            ref self: ContractState, key: EntryKey, entitlement: crate::settlement::EntryEntitlement,
        ) {
            assert!(key.game_id != 0, "game id zero is reserved");
            let games = self.games();
            if games.ownership_rules_ready(key.game_id) {
                assert!(games.rules(key.game_id).entry_rule != 2, "Blitz uses a fixed roster");
            }
            let operator = self.ledger_operator();
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
        fn settle_blitz_roster(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: DomainContext,
        ) -> u64 {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only recorded settlement dispatch");
            assert!(actor == self.lifecycle.domain_state().authority, "only launch authority");
            let game = self.games().game(game_id);
            assert!(self.games().rules(game_id).entry_rule == 2, "not a Blitz game");
            assert!(context.timestamp >= game.start_settling_at, "settling not started");
            let roster = crate::registrar::IRegistrarDispatcherTrait::blitz_roster(
                crate::registrar::IRegistrarDispatcher { contract_address: peers.registry }, game_id,
            );
            let progress = self.settlements.progress.read(game_id);
            if progress.registered.into() == roster.len() {
                return 0;
            }
            if progress.registered == 0 {
                let mut root = context.raw_root;
                let seed = crate::random::game_root(ref root, game_id, game.seed);
                self.settlements.initialize_blitz_order(game_id, roster.len(), seed);
            }
            let order = self.settlements.blitz_order(game_id);
            let player = *roster.at((*order.at(progress.registered.into())).into());
            self.settlements.record_entry(EntryKey { game_id, owner: player.owner }, player.account);
            let rules = self.settlements.rules(game_id);
            let center = 2147483646 - self.games().rules(game_id).map_center_offset;
            let coords = crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: center, y: center },
                rules.mode,
                rules.reward_profile,
                progress.registered.into(),
            );
            self.create_settlement_realms(game_id, player.account, coords, context);
            let remaining: u64 = (roster.len() - Into::<u16, u32>::into(progress.registered) - 1).into();
            if remaining == 0 {
                self.games().start_blitz(game_id, context.timestamp);
            }
            remaining
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn bound_owner(self: @ContractState, actor: ContractAddress) -> ContractAddress {
            let season = crate::season::ISeasonDispatcher { contract_address: self.lifecycle.require_active().season };
            let registry = crate::season::IPlayerRegistryDispatcher {
                contract_address: crate::season::ISeasonDispatcherTrait::authentication(season).registry,
            };
            let owner = crate::season::IPlayerRegistryDispatcherTrait::owner_of(registry, actor);
            assert!(
                owner.is_non_zero()
                    && crate::season::IPlayerRegistryDispatcherTrait::account_of(registry, owner) == actor,
                "unregistered actor",
            );
            owner
        }
        fn ledger_operator(self: @ContractState) -> ContractAddress {
            ILedgerOperatorDispatcher { contract_address: self.lifecycle.require_active().registry }.ledger_operator()
        }
        fn games(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn resolve_season_realm(
            self: @ContractState, key: EntryKey, selected: Option<u32>, settled: u16, seed: u256,
        ) -> (u32, crate::realms::RealmTraits) {
            if let Some(realm_id) = selected {
                return (realm_id, self.realms.traits(realm_id));
            }
            let rules = self.games().rules(key.game_id);
            if self.games().game(key.game_id).dev_mode_on || rules.entry_rule == 1 {
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
        fn create_settlement_realms(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            coords: Span<crate::troops::Coord>,
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
                                grant_troops: true,
                                activate_economy: true,
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
