#[starknet::contract]
pub mod SettlementLogic {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::commands::ExecutionContext as DomainContext;
    use crate::logic::entry::EntryAdministration;
    use crate::logic::release::ReleaseState;
    use crate::logic::settlement::SettlementState;
    use crate::logic::upgrades::UpgradeState;
    use crate::logic::village::VillageState;
    use crate::ownership::StoryResultTrait;
    use crate::realms::{ISeasonPlacementDispatcherTrait, ISeasonPlacementLibraryDispatcher};
    use crate::settlement::{
        EntryKey, ISettlementCreationDispatcherTrait, ISettlementCreationLibraryDispatcher,
        ISettlementPoolDispatcherTrait, ISettlementPoolLibraryDispatcher, RealmCreation, SettlementCreation,
        VillageCreation,
    };
    #[cfg(test)]
    use crate::settlement::{PlayerEntry, RealmGrants, SettlementProgress, SettlementRules};
    #[cfg(test)]
    use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
    use crate::village::{SettleVillage, VillagePassKey};
    #[cfg(test)]
    use crate::village::{VillagePass, VillageRules};
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: crate::logic::realms::RealmState, storage: realms, event: RealmEvent);
    impl RealmInternal = crate::logic::realms::RealmState::InternalImpl<ContractState>;
    component!(path: SettlementState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementState::InternalImpl<ContractState>;
    component!(path: VillageState, storage: villages, event: VillageEvent);
    impl VillageInternal = VillageState::InternalImpl<ContractState>;
    component!(path: EntryAdministration, storage: entry, event: EntryEvent);
    #[abi(embed_v0)]
    impl Entry = EntryAdministration::LedgerOperatorImpl<ContractState>;
    component!(path: UpgradeState, storage: upgrades, event: UpgradeEvent);
    impl UpgradeInternal = UpgradeState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        entry: EntryAdministration::Storage,
        #[substorage(v0)]
        upgrades: UpgradeState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        realms: crate::logic::realms::RealmState::Storage,
        #[substorage(v0)]
        settlements: SettlementState::Storage,
        #[substorage(v0)]
        villages: VillageState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EntryEvent: EntryAdministration::Event,
        UpgradeEvent: UpgradeState::Event,
        RowSet: crate::events::RowSet,
        ReleaseEvent: ReleaseState::Event,
        RealmEvent: crate::logic::realms::RealmState::Event,
        SettlementEvent: SettlementState::Event,
        VillageEvent: VillageState::Event,
    }
    #[abi(embed_v0)]
    impl TerrainDerivation of crate::settlement::ITerrainDerivation<ContractState> {
        fn raise_expedition_home(
            ref self: ContractState, key: crate::map::TileKey, context: crate::commands::BiomeContext,
        ) {
            crate::logic::terrain::raise_expedition_home(key, context);
        }
        fn biome(self: @ContractState, key: crate::map::TileKey, context: crate::commands::BiomeContext) -> u8 {
            crate::logic::terrain::biome(key, context)
        }
        fn expedition_home_ring(
            self: @ContractState, game_id: u32, realm_id: u16, timestamp: u64,
        ) -> Span<(crate::troops::Coord, u8)> {
            crate::logic::terrain::expedition_home_ring(game_id, realm_id, timestamp)
        }
    }

    #[abi(embed_v0)]
    impl UpgradeRules of crate::upgrades::IUpgradeRules<ContractState> {
        #[cfg(test)]
        fn upgrade_limits(self: @ContractState, game_id: u32) -> UpgradeLimits {
            self.upgrades.limits(game_id)
        }
        #[cfg(test)]
        fn upgrade_recipe(self: @ContractState, game_id: u32, level: u8) -> UpgradeRecipe {
            self.upgrades.recipe(game_id, level)
        }
    }

    #[abi(embed_v0)]
    impl ExpeditionRules of crate::expeditions::IExpeditionRules<ContractState> {
        #[cfg(test)]
        fn depth_rules(self: @ContractState, game_id: u32, depth: u8) -> crate::expeditions::DepthRules {
            crate::logic::expeditions::depth_rules(game_id, depth)
        }
    }
    #[abi(embed_v0)]
    impl SeasonRealms of crate::realms::ISeasonRealms<ContractState> {
        fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
            assert!(get_caller_address() == self.release.authority(), "only domain authority");
            self.realms.initialize(first_realm, packed_traits);
        }
        #[cfg(test)]
        fn realm_catalogue(self: @ContractState) -> crate::realms::RealmCatalogue {
            crate::realms::RealmCatalogue {
                initialized: self.realms.data.realms.catalogue_count.read(),
                digest: self.realms.data.realms.catalogue_digest.read(),
            }
        }
        #[cfg(test)]
        fn realm_traits(self: @ContractState, realm_id: u32) -> crate::realms::RealmTraits {
            self.realms.traits(realm_id)
        }
        #[cfg(test)]
        fn available_realm(self: @ContractState, game_id: u32, index: u32) -> u32 {
            self.realms.available(game_id, index, self.settlements.data.settlements.progress.read(game_id).realm_count)
        }
        fn settle_season(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::realms::SettleSeason,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let classes = self.release.classes(game_id);
            let owner = actor;
            let game = context.game.unbox();
            let rules = context.rules.unbox();
            assert!(rules.entry_rule != crate::rules::ENTRY_ROSTER, "not a season game");
            assert!(command.name != 0, "name cannot be empty");
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let key = EntryKey { game_id, owner: owner };
            if command.selected_realm.is_some() {
                assert!(game.dev_mode_on, "development mode required");
                self.settlements.record_entry(key, actor);
            } else {
                let requires_entitlement = !context.game.unbox().dev_mode_on
                    && rules.entry_rule == crate::rules::ENTRY_ENTITLEMENT;
                self.settlements.reserve_entry(key, actor, requires_entitlement);
            }
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            let mut progress = self.settlements.data.settlements.progress.read(game_id);
            let (realm_id, traits) = self
                .resolve_season_realm(key, command.selected_realm, progress.realm_count, seed, context);
            self.realms.reserve(game_id, realm_id, progress.realm_count);
            let coord = if rules.epoch_seconds == 0 {
                ISeasonPlacementLibraryDispatcher { class_hash: classes.placement.read() }
                    .claim_season_settlement(
                        game_id, progress.realm_count, seed, crate::commands::action_context(context),
                    )
            } else {
                crate::settlement::off_map_realm_reference(realm_id)
            };
            ISettlementCreationLibraryDispatcher { class_hash: classes.structures.read() }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Realm(
                        RealmCreation {
                            realm_id: realm_id.try_into().unwrap(), traits, grant_troops: true, activate_economy: true,
                        },
                    ),
                    crate::commands::action_context(context),
                    story_cursor,
                )
                .resume_story(ref story_cursor);
            progress.realm_count += 1;
            self.settlements.write_progress(game_id, progress);
            ((), story_cursor)
        }
    }

    #[abi(embed_v0)]
    impl Villages of crate::village::IVillages<ContractState> {
        #[cfg(test)]
        fn village_rules(self: @ContractState, game_id: u32) -> VillageRules {
            self.villages.rules(game_id)
        }
        #[cfg(test)]
        fn village_pass(self: @ContractState, key: VillagePassKey) -> Option<VillagePass> {
            self.villages.pass(key)
        }
        fn register_village_pass(ref self: ContractState, key: VillagePassKey, owner: ContractAddress) {
            assert!(key.game_id != 0, "game id zero is reserved");
            let operator = self.entry.data.entry.operator.read();
            assert!(operator.is_non_zero() && get_caller_address() == operator, "only ledger operator");
            self.villages.register(key, owner);
        }
        fn settle_village(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: SettleVillage,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let classes = self.release.classes(game_id);
            let owner = actor;
            let game = context.game.unbox();
            let rules = context.rules.unbox();
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
            let progress = self.settlements.data.settlements.progress.read(game_id);
            let coord = ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() }
                .claim_village(game_id, progress.registered, seed, crate::commands::action_context(context));
            let village_id = ISettlementCreationLibraryDispatcher { class_hash: classes.structures.read() }
                .create_settlement(
                    game_id,
                    actor,
                    coord,
                    SettlementCreation::Village(
                        VillageCreation { connected_realm: command.connected_realm_entity_id, resource },
                    ),
                    crate::commands::action_context(context),
                    story_cursor,
                )
                .resume_story(ref story_cursor);
            if !dev_entry {
                self.villages.consume(pass, owner, village_id);
            }
            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl SettlementViews of crate::settlement::ISettlementViews<ContractState> {
        #[cfg(test)]
        fn blitz_settlement_order(self: @ContractState, game_id: u32) -> Span<u8> {
            crate::logic::settlement::blitz_order(game_id)
        }
        #[cfg(test)]
        fn realm_grants(self: @ContractState, game_id: u32) -> RealmGrants {
            crate::logic::settlement::grants(game_id)
        }
        #[cfg(test)]
        fn settlement_rules(self: @ContractState, game_id: u32) -> SettlementRules {
            crate::logic::settlement::rules(game_id)
        }
        #[cfg(test)]
        fn settlement_progress(self: @ContractState, game_id: u32) -> SettlementProgress {
            self.settlements.data.settlements.progress.read(game_id)
        }
        #[cfg(test)]
        fn player_has_settled(self: @ContractState, game_id: u32, player: ContractAddress) -> bool {
            self.settlements.data.settlements.entered_players.read((game_id, player))
        }
        #[cfg(test)]
        fn player_entry(self: @ContractState, key: EntryKey) -> Option<PlayerEntry> {
            crate::logic::settlement::entry(key)
        }
    }
    #[abi(embed_v0)]
    impl SettlementEntry of crate::settlement::ISettlementEntry<ContractState> {
        fn register_entitlement(
            ref self: ContractState, key: EntryKey, entitlement: crate::settlement::EntryEntitlement,
        ) {
            assert!(key.game_id != 0, "game id zero is reserved");
            if crate::logic::game::game_exists(key.game_id) {
                assert!(
                    crate::logic::game::rules(key.game_id).entry_rule != crate::rules::ENTRY_ROSTER,
                    "Blitz uses a fixed roster",
                );
            }
            let operator = self.entry.data.entry.operator.read();
            assert!(operator.is_non_zero() && get_caller_address() == operator, "only ledger operator");
            assert!(key.owner.is_non_zero(), "invalid entitlement owner");
            self.settlements.register_entitlement(key, entitlement);
        }
        fn entry_entitlement(self: @ContractState, key: EntryKey) -> Option<crate::settlement::EntryEntitlement> {
            self.settlements.data.settlements.entitlements.read((key.game_id, key.owner))
        }
    }
    #[abi(embed_v0)]
    impl SettlementCommands of crate::settlement::ISettlementCommands<ContractState> {
        fn settle_blitz_roster(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> (u64, crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);
            let game = context.game.unbox();
            assert!(context.rules.unbox().entry_rule == crate::rules::ENTRY_ROSTER, "not a Blitz game");
            assert!(context.timestamp >= game.start_settling_at, "settling not started");
            let roster = crate::logic::registrar::blitz_roster(game_id);
            let progress = self.settlements.data.settlements.progress.read(game_id);
            if progress.registered.into() == roster.len() {
                return (0, story_cursor);
            }
            if progress.registered == 0 {
                let mut root = context.raw_root;
                let seed = crate::random::game_root(ref root, game_id, game.seed);
                self.settlements.initialize_blitz_order(game_id, roster.len(), seed);
            }
            let order = crate::logic::settlement::blitz_order(game_id);
            let player = *roster.at((*order.at(progress.registered.into())).into());
            self.settlements.record_entry(EntryKey { game_id, owner: player.account }, player.account);
            let rules = crate::logic::settlement::rules(game_id);
            let center = 2147483646 - context.rules.unbox().map_center_offset;
            let coords = crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: center, y: center },
                rules.mode,
                rules.spacing,
                progress.registered.into(),
            );
            self.create_settlement_realms(game_id, player.account, coords, context, ref story_cursor);
            let remaining: u64 = (roster.len() - Into::<u16, u32>::into(progress.registered) - 1).into();
            if remaining == 0 {
                crate::logic::game::start_blitz(game_id, context);
            }
            (remaining, story_cursor)
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn resolve_season_realm(
            self: @ContractState,
            key: EntryKey,
            selected: Option<u32>,
            settled: u16,
            seed: u256,
            game_context: crate::commands::ExecutionContext,
        ) -> (u32, crate::realms::RealmTraits) {
            if let Some(realm_id) = selected {
                return (realm_id, self.realms.traits(realm_id));
            }
            let rules = game_context.rules.unbox();
            if game_context.game.unbox().dev_mode_on || rules.entry_rule == crate::rules::ENTRY_OPEN {
                let remaining = crate::realms::CANONICAL_REALM_COUNT - settled.into();
                assert!(remaining > 0, "all canonical realms allocated");
                let index = crate::random::range(seed, 71419, remaining.into()).try_into().unwrap();
                let realm_id = self.realms.available(key.game_id, index, settled);
                return (realm_id, self.realms.traits(realm_id));
            }
            let entitlement = self
                .settlements
                .data
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
            ref story_cursor: crate::ownership::StoryCursor,
        ) -> u32 {
            let structures = ISettlementCreationLibraryDispatcher {
                class_hash: self.release.classes(game_id).structures.read(),
            };
            let mut progress = self.settlements.data.settlements.progress.read(game_id);
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
                                    wonder: 1,
                                    order: 0,
                                    resources: crate::logic::settlement::grants(game_id).realm_resources,
                                },
                                grant_troops: true,
                                activate_economy: true,
                            },
                        ),
                        crate::commands::action_context(context),
                        story_cursor,
                    )
                    .resume_story(ref story_cursor);
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
