#[starknet::contract]
pub mod SettlementLogic {
    use core::num::traits::Zero;
    use starknet::storage::StorageMapReadAccess;
    use starknet::{ContractAddress, get_caller_address};
    use crate::aspects::IAspectsDispatcherTrait;
    use crate::commands::ExecutionContext as DomainContext;
    use crate::logic::release::ReleaseState;
    use crate::logic::settlement::SettlementState;
    use crate::logic::upgrades::UpgradeState;
    use crate::logic::village::VillageState;
    use crate::settlement::{
        EntryKey, ISettlementCreationDispatcherTrait, ISettlementCreationLibraryDispatcher, RealmCreation,
        SettlementCreation,
    };
    #[cfg(feature: "test_support")]
    use crate::settlement::{PlayerEntry, RealmGrants, SettlementProgress, SettlementRules};
    use crate::village::VillagePassKey;
    #[cfg(feature: "test_support")]
    use crate::village::{VillagePass, VillageRules};
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: crate::logic::realms::RealmState, storage: realms, event: RealmEvent);
    impl RealmInternal = crate::logic::realms::RealmState::InternalImpl<ContractState>;
    component!(path: SettlementState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementState::InternalImpl<ContractState>;
    component!(path: UpgradeState, storage: upgrades, event: UpgradeEvent);
    component!(path: VillageState, storage: villages, event: VillageEvent);
    impl VillageInternal = VillageState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl VillagePasses of crate::village::IVillagePasses<ContractState> {
        #[cfg(feature: "test_support")]
        fn village_rules(self: @ContractState, game_id: u32) -> VillageRules {
            self.villages.rules(game_id)
        }
        #[cfg(feature: "test_support")]
        fn village_pass(self: @ContractState, key: VillagePassKey) -> Option<VillagePass> {
            self.villages.pass(key)
        }
        fn register_village_pass(ref self: ContractState, key: VillagePassKey, owner: ContractAddress) {
            assert!(key.game_id != 0, "game id zero is reserved");
            crate::logic::entry::assert_ledger_operator();
            self.villages.register(key, owner);
        }
    }
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        villages: VillageState::Storage,
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        upgrades: UpgradeState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        realms: crate::logic::realms::RealmState::Storage,
        #[substorage(v0)]
        settlements: SettlementState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        VillageEvent: VillageState::Event,
        UpgradeEvent: UpgradeState::Event,
        RowSet: crate::events::RowSet,
        ReleaseEvent: ReleaseState::Event,
        RealmEvent: crate::logic::realms::RealmState::Event,
        SettlementEvent: SettlementState::Event,
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
            self: @ContractState, game_id: u32, region_id: u32, timestamp: u64,
        ) -> Span<(crate::troops::Coord, u8)> {
            crate::logic::terrain::expedition_home_ring(game_id, region_id, timestamp)
        }
    }

    #[abi(embed_v0)]
    impl ExpeditionRules of crate::expeditions::IExpeditionRules<ContractState> {
        #[cfg(feature: "test_support")]
        fn depth_rules(self: @ContractState, game_id: u32, depth: u8) -> crate::expeditions::DepthRules {
            crate::logic::expeditions::depth_rules(depth)
        }
    }
    #[abi(embed_v0)]
    impl SeasonRealms of crate::realms::ISeasonRealms<ContractState> {
        fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
            assert!(get_caller_address() == self.release.authority(), "only domain authority");
            self.realms.initialize(first_realm, packed_traits);
        }
        #[cfg(feature: "test_support")]
        fn realm_catalogue(self: @ContractState) -> crate::realms::RealmCatalogue {
            crate::realms::RealmCatalogue {
                initialized: starknet::storage::StoragePointerReadAccess::read(
                    @self.realms.data.realms.catalogue_count,
                ),
                digest: starknet::storage::StoragePointerReadAccess::read(@self.realms.data.realms.catalogue_digest),
            }
        }
        #[cfg(feature: "test_support")]
        fn realm_traits(self: @ContractState, realm_id: u32) -> crate::realms::RealmTraits {
            self.realms.traits(realm_id)
        }
        #[cfg(feature: "test_support")]
        fn available_realm(self: @ContractState, game_id: u32, index: u32) -> u32 {
            self.realms.available(game_id, index, self.settlements.data.settlements.progress.read(game_id).realm_count)
        }
        fn settle_season(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::realms::SettleSeason,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let game = context.game.unbox();
            assert!(game.dev_mode_on || context.timestamp >= game.start_settling_at, "settling not started");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            self.settle_open_frontier(game_id, actor, command, context);
        }
    }

    #[abi(embed_v0)]
    impl SettlementViews of crate::settlement::ISettlementViews<ContractState> {
        #[cfg(feature: "test_support")]
        fn realm_grants(self: @ContractState, game_id: u32) -> RealmGrants {
            crate::logic::settlement::grants()
        }
        #[cfg(feature: "test_support")]
        fn settlement_rules(self: @ContractState, game_id: u32) -> SettlementRules {
            crate::logic::settlement::rules(game_id)
        }
        #[cfg(feature: "test_support")]
        fn settlement_progress(self: @ContractState, game_id: u32) -> SettlementProgress {
            self.settlements.data.settlements.progress.read(game_id)
        }
        #[cfg(feature: "test_support")]
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
            assert!(crate::logic::game::game_exists(key.game_id), "prepare an existing game");
            crate::logic::entry::assert_ledger_operator();
            assert!(key.owner.is_non_zero(), "invalid entitlement owner");
            self.settlements.register_entitlement(key, entitlement);
        }
        fn settled_realm(self: @ContractState, game_id: u32, realm_id: u32) -> u64 {
            self.settlements.data.settlements.held_realm_homes.read((game_id, realm_id))
        }
        fn entry_entitlement(self: @ContractState, key: EntryKey) -> Option<crate::settlement::EntryEntitlement> {
            self.settlements.data.settlements.entitlements.read((key.game_id, key.owner))
        }
    }
    #[cfg(feature: "blitz")]
    #[abi(embed_v0)]
    impl RosterRecords of crate::logic::release::ISlotAuthority<ContractState> {
        fn slot_authority(ref self: ContractState, family: u8, calldata: Span<felt252>) -> Span<felt252> {
            let mut fields = calldata;
            let (game_id, players): (u32, Span<ContractAddress>) = Serde::deserialize(ref fields)
                .expect('INVALID_ROSTER');
            assert!(fields.is_empty(), "invalid roster");
            crate::logic::blitz::roster::record(game_id, players);
            array![].span()
        }
    }
    #[cfg(feature: "blitz")]
    #[abi(embed_v0)]
    impl RosterSeating of crate::settlement::IRosterSeating<ContractState> {
        fn seat_blitz_roster(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::execution_context(game_id, context);
            assert!(context.timestamp >= context.game.unbox().start_settling_at, "settling not started");
            let size = crate::logic::blitz::roster::size(game_id);
            assert!(size != 0, "game has no roster");
            let mut progress = self.settlements.data.settlements.progress.read(game_id);
            let seat: u32 = progress.registered.into();
            assert!(seat < size, "roster already seated");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            let player = crate::logic::blitz::roster::draw_player(game_id, seat, seed);
            self.settlements.record_entry(EntryKey { game_id, owner: player }, player);
            let sites = crate::settlement_grid::triple_settlement_locations(
                crate::settlement_grid::map_center(context.rules.unbox().map_center_offset),
                crate::logic::settlement::spacing(),
                seat,
            );
            let structures = ISettlementCreationLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::STRUCTURES),
            };
            let resources = crate::logic::settlement::grants().realm_resources;
            for (site, troop) in sites.into_iter().zip(crate::logic::blitz::roster::deal(seed)) {
                progress.realm_count += 1;
                crate::logic::blitz::roster::write_dealt(
                    crate::resources::ResourceKey { game_id, entity_id: progress.realm_count.into() }, *troop,
                );
                structures
                    .create_settlement(
                        game_id,
                        player,
                        *site,
                        SettlementCreation::Realm(
                            RealmCreation {
                                realm_id: progress.realm_count,
                                traits: crate::realms::RealmTraits { wonder: 1, order: 0, resources },
                                troops: crate::settlement::StartingTroops::Biome,
                                activate_economy: true,
                            },
                        ),
                        crate::commands::action_context(context),
                    );
            }
            progress.registered += 1;
            self.settlements.write_progress(game_id, progress);
            (size - seat - 1).into()
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        // Frontier homes are private boards. Realm ids select immutable traits, rather than scarce catalogue seats.
        fn settle_open_frontier(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::realms::SettleSeason,
            context: DomainContext,
        ) {
            let key = EntryKey { game_id, owner: actor };
            self.settlements.reserve_entry(key, actor, false);
            let home = crate::state::read().games.open_homes.read((game_id, actor));
            assert!(home != 0, "open home must be assigned before the roll");
            let entitlement = self.settlements.data.settlements.entitlements.read((game_id, actor));
            let selected_realm = if let Some(entitlement) = entitlement {
                assert!(command.selected_realm.is_none(), "home source already selected");
                self.claim_frontier_source(key, home, entitlement)
            } else if let Some(selected) = command.selected_realm {
                assert!(context.game.unbox().dev_mode_on, "development mode required");
                Some(selected)
            } else {
                None
            };
            let realm_id = self.resolve_open_realm(selected_realm, command.order, context);
            let traits = self.realms.traits(realm_id);
            crate::logic::aspects::dispatcher(game_id)
                .join(crate::resources::ResourceKey { game_id, entity_id: home }, traits.order);
            ISettlementCreationLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::STRUCTURES),
            }
                .create_settlement(
                    game_id,
                    actor,
                    crate::settlement::off_map_realm_reference(realm_id),
                    SettlementCreation::Realm(
                        RealmCreation {
                            realm_id: realm_id.try_into().unwrap(),
                            traits,
                            troops: crate::settlement::StartingTroops::Biome,
                            activate_economy: true,
                        },
                    ),
                    crate::commands::action_context(context),
                );
        }

        fn resolve_open_realm(
            self: @ContractState, selected: Option<u32>, order: Option<u8>, context: DomainContext,
        ) -> u32 {
            if let Some(realm) = selected {
                assert!(order.is_none(), "a held Realm plays its own Order");
                return realm;
            }
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, context.game_id);
            crate::logic::aspects::dispatcher(context.game_id).draw_realm(order.expect('choose an Order'), seed)
        }

        fn claim_frontier_source(
            ref self: ContractState, key: EntryKey, home: u64, entitlement: crate::settlement::EntryEntitlement,
        ) -> Option<u32> {
            assert!(entitlement.pass_kind == crate::settlement::HELD_REALM_KIND, "Frontier home source required");
            let realm_id = entitlement.realm_id.try_into().expect('invalid canonical realm');
            self.settlements.claim_held_realm(key, realm_id, home);
            Some(realm_id)
        }
    }
}
