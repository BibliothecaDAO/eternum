#[starknet::interface]
pub trait ICapture<T> {
    fn destroy(ref self: T, key: crate::troops::ExplorerKey);
    fn update_troops(ref self: T, key: crate::troops::ExplorerKey, troops: crate::troops::Troops);
    fn received_actor(self: @T) -> starknet::ContractAddress;
    fn received_root(self: @T) -> u256;
    fn received_timestamp(self: @T) -> u64;
}
pub mod GamesFixture {
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::tests::fixtures::{IFixtureDispatcherTrait, IFixtureLibraryDispatcher};

    // Uncreated-game regressions used the deployed domain before a release pin existed.
    fn fixture_class(game_id: u32, slot: u8) -> starknet::ClassHash {
        let state = crate::state::read();
        let pin = state.game_releases.read(game_id);
        let release_id = if pin == 0 {
            state.open_releases.read(crate::game::FRONTIER)
        } else {
            pin
        };
        crate::logic::release::release_class(release_id, slot)
    }

    #[starknet::embeddable]
    pub impl ExpeditionRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::expeditions::IExpeditionRules<TContractState> {
        fn depth_rules(self: @TContractState, game_id: u32, depth: u8) -> crate::expeditions::DepthRules {
            crate::logic::expeditions::depth_rules(depth)
        }
    }

    #[starknet::embeddable]
    pub impl SettlementPoolFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementPool<TContractState> {
        fn settlement_pool(
            self: @TContractState, game_id: u32, center: crate::troops::Coord,
        ) -> crate::settlement::SettlementPool {
            crate::settlement::ISettlementPoolDispatcherTrait::settlement_pool(
                crate::settlement::ISettlementPoolLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PLACEMENT),
                },
                game_id,
                center,
            )
        }
        fn village_pool(
            self: @TContractState, game_id: u32, center: crate::troops::Coord,
        ) -> crate::settlement::SettlementPool {
            crate::settlement::ISettlementPoolDispatcherTrait::village_pool(
                crate::settlement::ISettlementPoolLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PLACEMENT),
                },
                game_id,
                center,
            )
        }
        fn claim_village(
            ref self: TContractState, game_id: u32, registered: u16, seed: u256, center: crate::troops::Coord,
        ) -> crate::troops::Coord {
            crate::settlement::ISettlementPoolDispatcherTrait::claim_village(
                crate::settlement::ISettlementPoolLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PLACEMENT),
                },
                game_id,
                registered,
                seed,
                center,
            )
        }
    }
    #[starknet::embeddable]
    pub impl MapFixture<TContractState, +Drop<TContractState>> of crate::map::IMapLogic<TContractState> {
        fn biome(self: @TContractState, key: crate::map::TileKey, game_context: crate::commands::BiomeContext) -> u8 {
            crate::map::IMapLogicDispatcherTrait::biome(
                crate::map::IMapLogicLibraryDispatcher { class_hash: fixture_class(key.game_id, crate::slots::MAP) },
                key,
                game_context,
            )
        }
        fn reveal_structure_surroundings(
            ref self: TContractState,
            game_id: u32,
            coord: crate::troops::Coord,
            game_context: crate::commands::BiomeContext,
        ) {
            crate::map::IMapLogicDispatcherTrait::reveal_structure_surroundings(
                crate::map::IMapLogicLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::MAP) },
                game_id,
                coord,
                game_context,
            )
        }
        fn reveal_destination_tile(
            ref self: TContractState, key: crate::map::TileKey, game_context: crate::commands::BiomeContext,
        ) -> Option<crate::map::TileOpt> {
            crate::map::IMapLogicDispatcherTrait::reveal_destination_tile(
                crate::map::IMapLogicLibraryDispatcher { class_hash: fixture_class(key.game_id, crate::slots::MAP) },
                key,
                game_context,
            )
        }
        fn expedition_home_ring(
            self: @TContractState, game_id: u32, region_id: u32, timestamp: u64,
        ) -> Span<(crate::troops::Coord, u8)> {
            crate::map::IMapLogicDispatcherTrait::expedition_home_ring(
                crate::map::IMapLogicLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::MAP) },
                game_id,
                region_id,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ExtractionFixture<
        TContractState, +Drop<TContractState>,
    > of crate::exploration_rewards::IExtraction<TContractState> {
        fn extract_exploration_reward(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            explorer_id: u64,
            coord: crate::troops::Coord,
            context: crate::commands::ActionContext,
        ) {
            crate::exploration_rewards::IExtractionDispatcherTrait::extract_exploration_reward(
                crate::exploration_rewards::IExtractionLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRIZES),
                },
                game_id,
                actor,
                explorer_id,
                coord,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl RelicMapFixture<TContractState, +Drop<TContractState>> of crate::relics::IRelicMap<TContractState> {
        fn reveal_relic_tiles(
            ref self: TContractState,
            key: crate::troops::ExplorerKey,
            coord: crate::troops::Coord,
            count: u8,
            game_context: crate::commands::ActionContext,
        ) {
            crate::relics::IRelicMapDispatcherTrait::reveal_relic_tiles(
                crate::relics::IRelicMapLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::ECONOMY),
                },
                key,
                coord,
                count,
                game_context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GuardInitializationFixture<
        TContractState, +Drop<TContractState>,
    > of crate::guards::IGuardInitialization<TContractState> {
        fn initialize_structure_guards(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            seed: u256,
            timestamp: u64,
            rules: crate::rules::SliceRules,
        ) {
            crate::guards::IGuardInitializationDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardInitializationLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::MAP),
                },
                key,
                seed,
                timestamp,
                rules,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GuardsFixture<TContractState, +Drop<TContractState>> of crate::guards::IGuards<TContractState> {
        fn guard(self: @TContractState, key: crate::guards::GuardKey) -> crate::guards::Guard {
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::TROOPS),
                },
                key,
            )
        }
        fn add_starting_guard(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            category: crate::troops::TroopType,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            crate::guards::IGuardsDispatcherTrait::add_starting_guard(
                crate::guards::IGuardsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::TROOPS),
                },
                key,
                category,
                amount,
                timestamp,
                game_context,
            )
        }
    }

    #[starknet::embeddable]
    pub impl TroopManagementFixture<
        TContractState, +Drop<TContractState>,
    > of crate::troop_management::ITroopManagement<TContractState> {
        fn manage_troops(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::troop_management::ManageTroops,
            context: crate::commands::ActionContext,
        ) {
            crate::troop_management::ITroopManagementDispatcherTrait::manage_troops(
                crate::troop_management::ITroopManagementLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::TROOPS),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl TroopCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::commands::ICreateExplorer<TContractState> {
        fn create_explorer(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::commands::CreateExplorer,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::ICreateExplorerDispatcherTrait::create_explorer(
                crate::commands::ICreateExplorerLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::TROOPS),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ExploreFixture<TContractState, +Drop<TContractState>> of crate::commands::IExplore<TContractState> {
        fn explore(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::commands::Explore,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IExploreDispatcherTrait::explore(
                crate::commands::IExploreLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::MOVEMENT),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }

    #[starknet::embeddable]
    pub impl BuildingRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::buildings::IBuildingRules<TContractState> {
        fn building_rule(
            self: @TContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            crate::buildings::IBuildingRulesDispatcherTrait::building_rule(
                crate::buildings::IBuildingRulesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::CONSTRUCTION),
                },
                key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl StructuresFixture<
        TContractState, +Drop<TContractState>,
    > of crate::structures::IStructureOperations<TContractState> {
        fn create_discovery(
            ref self: TContractState,
            game_id: u32,
            home_id: u64,
            coord: crate::troops::Coord,
            discovery: crate::discovery::Discovery,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> u64 {
            crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
                crate::structures::IStructureOperationsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::STRUCTURES),
                },
                game_id,
                home_id,
                coord,
                discovery,
                seed,
                timestamp,
                game_context,
            )
        }
        fn provision_realm(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            coord: crate::troops::Coord,
            grants: Span<(u8, u128)>,
        ) -> u64 {
            crate::structures::IStructureOperationsDispatcherTrait::provision_realm(
                crate::structures::IStructureOperationsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::STRUCTURES),
                },
                game_id,
                actor,
                coord,
                grants,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementCreationFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementCreation<TContractState> {
        fn create_settlement(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            coord: crate::troops::Coord,
            creation: crate::settlement::SettlementCreation,
            context: crate::commands::ActionContext,
        ) -> u64 {
            crate::settlement::ISettlementCreationDispatcherTrait::create_settlement(
                crate::settlement::ISettlementCreationLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::STRUCTURES),
                },
                game_id,
                actor,
                coord,
                creation,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BuildingCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::buildings::IBuildingCommands<TContractState> {
        fn create_building(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::buildings::CreateBuilding,
            context: crate::commands::ActionContext,
        ) {
            crate::buildings::IBuildingCommandsDispatcherTrait::create_building(
                crate::buildings::IBuildingCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::CONSTRUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn destroy_building(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) {
            crate::buildings::IBuildingCommandsDispatcherTrait::destroy_building(
                crate::buildings::IBuildingCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::CONSTRUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn pause_building_production(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) {
            crate::buildings::IBuildingCommandsDispatcherTrait::pause_building_production(
                crate::buildings::IBuildingCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::CONSTRUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn resume_building_production(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) {
            crate::buildings::IBuildingCommandsDispatcherTrait::resume_building_production(
                crate::buildings::IBuildingCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::CONSTRUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl NamesFixture<TContractState, +Drop<TContractState>> of crate::names::INames<TContractState> {
        fn entity_name(self: @TContractState, key: crate::resources::ResourceKey) -> crate::names::EntityName {
            crate::names::INamesDispatcherTrait::entity_name(
                crate::names::INamesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::STRUCTURES),
                },
                key,
            )
        }
        fn set_entity_name(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::names::SetEntityName,
            context: crate::commands::ActionContext,
        ) {
            crate::names::INamesDispatcherTrait::set_entity_name(
                crate::names::INamesLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::STRUCTURES) },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SeasonRealmsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::realms::ISeasonRealms<TContractState> {
        fn initialize_realm_traits(ref self: TContractState, first_realm: u32, packed_traits: Span<u32>) {
            let state = crate::state::read();
            crate::realms::ISeasonRealmsDispatcherTrait::initialize_realm_traits(
                crate::realms::ISeasonRealmsLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::SETTLEMENT,
                    ),
                },
                first_realm,
                packed_traits,
            )
        }
        fn realm_catalogue(self: @TContractState) -> crate::realms::RealmCatalogue {
            let state = crate::state::read();
            crate::realms::ISeasonRealmsDispatcherTrait::realm_catalogue(
                crate::realms::ISeasonRealmsLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::SETTLEMENT,
                    ),
                },
            )
        }
        fn realm_traits(self: @TContractState, realm_id: u32) -> crate::realms::RealmTraits {
            let state = crate::state::read();
            crate::realms::ISeasonRealmsDispatcherTrait::realm_traits(
                crate::realms::ISeasonRealmsLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::SETTLEMENT,
                    ),
                },
                realm_id,
            )
        }
        fn available_realm(self: @TContractState, game_id: u32, index: u32) -> u32 {
            crate::realms::ISeasonRealmsDispatcherTrait::available_realm(
                crate::realms::ISeasonRealmsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
                index,
            )
        }
        fn settle_season(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::realms::SettleSeason,
            context: crate::commands::ActionContext,
        ) {
            crate::realms::ISeasonRealmsDispatcherTrait::settle_season(
                crate::realms::ISeasonRealmsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl VillagePassesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::village::IVillagePasses<TContractState> {
        fn village_rules(self: @TContractState, game_id: u32) -> crate::village::VillageRules {
            crate::village::IVillagePassesDispatcherTrait::village_rules(
                crate::village::IVillagePassesLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
            )
        }
        fn village_pass(
            self: @TContractState, key: crate::village::VillagePassKey,
        ) -> Option<crate::village::VillagePass> {
            crate::village::IVillagePassesDispatcherTrait::village_pass(
                crate::village::IVillagePassesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::SETTLEMENT),
                },
                key,
            )
        }
        fn register_village_pass(
            ref self: TContractState, key: crate::village::VillagePassKey, owner: starknet::ContractAddress,
        ) {
            crate::village::IVillagePassesDispatcherTrait::register_village_pass(
                crate::village::IVillagePassesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::SETTLEMENT),
                },
                key,
                owner,
            )
        }
    }
    #[starknet::embeddable]
    pub impl VillagesFixture<TContractState, +Drop<TContractState>> of crate::village::IVillages<TContractState> {
        fn settle_village(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::village::SettleVillage,
            context: crate::commands::ActionContext,
        ) {
            crate::village::IVillagesDispatcherTrait::settle_village(
                crate::village::IVillagesLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::SEASON) },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementViewsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementViews<TContractState> {
        fn settlement_rules(self: @TContractState, game_id: u32) -> crate::settlement::SettlementRules {
            crate::settlement::ISettlementViewsDispatcherTrait::settlement_rules(
                crate::settlement::ISettlementViewsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
            )
        }
        fn realm_grants(self: @TContractState, game_id: u32) -> crate::settlement::RealmGrants {
            crate::settlement::ISettlementViewsDispatcherTrait::realm_grants(
                crate::settlement::ISettlementViewsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
            )
        }
        fn settlement_progress(self: @TContractState, game_id: u32) -> crate::settlement::SettlementProgress {
            crate::settlement::ISettlementViewsDispatcherTrait::settlement_progress(
                crate::settlement::ISettlementViewsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SETTLEMENT),
                },
                game_id,
            )
        }
        fn player_entry(
            self: @TContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::PlayerEntry> {
            crate::settlement::ISettlementViewsDispatcherTrait::player_entry(
                crate::settlement::ISettlementViewsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::SETTLEMENT),
                },
                key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementEntryFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementEntry<TContractState> {
        fn register_entitlement(
            ref self: TContractState,
            key: crate::settlement::EntryKey,
            entitlement: crate::settlement::EntryEntitlement,
        ) {
            let state = crate::state::read();
            crate::settlement::ISettlementEntryDispatcherTrait::register_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::SETTLEMENT,
                    ),
                },
                key,
                entitlement,
            )
        }
        fn settled_realm(self: @TContractState, game_id: u32, realm_id: u32) -> u64 {
            crate::state::read().settlements.held_realm_homes.read((game_id, realm_id))
        }
        fn entry_entitlement(
            self: @TContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::EntryEntitlement> {
            let state = crate::state::read();
            crate::settlement::ISettlementEntryDispatcherTrait::entry_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::SETTLEMENT,
                    ),
                },
                key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ResourcesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::resources::IResourceOperations<TContractState> {
        fn initialize_resources(ref self: TContractState, key: crate::resources::ResourceKey, capacity: u128) {
            crate::resources::IResourceOperationsDispatcherTrait::initialize_resources(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                capacity,
            )
        }
        fn initialize_explorer_resources(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            amount: u128,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::initialize_explorer_resources(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                amount,
                game_context,
            )
        }
        fn destroy_resources(ref self: TContractState, key: crate::resources::ResourceKey) {
            crate::resources::IResourceOperationsDispatcherTrait::destroy_resources(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
            )
        }
        fn change_explorer_capacity(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            amount: u128,
            increase: bool,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::change_explorer_capacity(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                amount,
                increase,
                game_context,
            )
        }
        fn grant_resource(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) -> u128 {
            crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                amount,
                timestamp,
                game_context,
            )
        }
        fn spend_resource(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                amount,
                timestamp,
                game_context,
            )
        }
        fn start_production(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::start_production(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                rate,
                output,
                timestamp,
                game_context,
            )
        }
        fn stop_production(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            rate: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::stop_production(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                rate,
                timestamp,
                game_context,
            )
        }
        fn raise_troops(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::raise_troops(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                amount,
                timestamp,
                game_context,
            )
        }
        fn assert_loot_available(
            ref self: TContractState,
            from: crate::resources::ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::assert_loot_available(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(from.game_id, crate::slots::RESOURCES),
                },
                from,
                resources,
                timestamp,
                game_context,
            )
        }
        fn take_loot(
            ref self: TContractState,
            from: crate::resources::ResourceKey,
            to: crate::resources::ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::take_loot(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(from.game_id, crate::slots::RESOURCES),
                },
                from,
                to,
                resources,
                timestamp,
                game_context,
            )
        }
        fn settle_production(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::settle_production(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                timestamp,
                game_context,
            )
        }
        fn change_structure_capacity(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            amount: u128,
            adding: bool,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::change_structure_capacity(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                amount,
                adding,
                timestamp,
                game_context,
            )
        }
        fn spend_food(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            wheat: u128,
            fish: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::spend_food(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                wheat,
                fish,
                timestamp,
                game_context,
            )
        }
        fn spend_spire_fee(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceOperationsDispatcherTrait::spend_spire_fee(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                timestamp,
                game_context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ResourceDeliveryFixture<
        TContractState, +Drop<TContractState>,
    > of crate::resources::IResourceDelivery<TContractState> {
        fn queue_resource_delivery(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource: crate::resources::ResourceAmount,
            travel_time: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::resources::IResourceDeliveryDispatcherTrait::queue_resource_delivery(
                crate::resources::IResourceDeliveryLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource,
                travel_time,
                timestamp,
                game_context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl MineRulesFixture<TContractState, +Drop<TContractState>> of crate::mines::IMineRules<TContractState> {
        fn mine_kind(self: @TContractState, key: crate::mines::MineKindKey) -> crate::mines::MineKindConfig {
            crate::mines::IMineRulesDispatcherTrait::mine_kind(
                crate::mines::IMineRulesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::PRODUCTION),
                },
                key,
            )
        }
        fn mine_pool(self: @TContractState, key: crate::mines::MinePoolKey) -> Span<crate::mines::MineWeight> {
            crate::mines::IMineRulesDispatcherTrait::mine_pool(
                crate::mines::IMineRulesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::PRODUCTION),
                },
                key,
            )
        }
        fn mine_draw(
            self: @TContractState, key: crate::mines::MinePoolKey, seed: u256,
        ) -> (u8, crate::mines::MineKindConfig, u128) {
            crate::mines::IMineRulesDispatcherTrait::mine_draw(
                crate::mines::IMineRulesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::PRODUCTION),
                },
                key,
                seed,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ExplorationGrantFixture<
        TContractState, +Drop<TContractState>,
    > of crate::exploration_rewards::IExplorationGrant<TContractState> {
        fn grant_exploration_reward(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::RESOURCES),
                },
                key,
                resource_type,
                amount,
                timestamp,
                game_context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ProductionRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::production::IProductionRules<TContractState> {
        fn production_recipe(
            self: @TContractState, key: crate::production::RecipeKey,
        ) -> crate::production::ProductionRecipe {
            crate::production::IProductionRulesDispatcherTrait::production_recipe(
                crate::production::IProductionRulesLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::PRODUCTION),
                },
                key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ProductionCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::production::IProductionCommands<TContractState> {
        fn burn_resource_for_resource_production(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::production::RefillProduction,
            context: crate::commands::ActionContext,
        ) {
            crate::production::IProductionCommandsDispatcherTrait::burn_resource_for_resource_production(
                crate::production::IProductionCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ResourceCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::commands::IResourceCommands<TContractState> {
        fn send_resources(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IResourceCommandsDispatcherTrait::send_resources(
                crate::commands::IResourceCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn transfer_explorer_resources_to_structure(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IResourceCommandsDispatcherTrait::transfer_explorer_resources_to_structure(
                crate::commands::IResourceCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn offload_arrival(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::arrivals::OffloadArrival,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IResourceCommandsDispatcherTrait::offload_arrival(
                crate::commands::IResourceCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn burn_structure_resources(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::resources::ResourceBurn,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IResourceCommandsDispatcherTrait::burn_structure_resources(
                crate::commands::IResourceCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn transfer_explorer_resources(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) {
            crate::commands::IResourceCommandsDispatcherTrait::transfer_explorer_resources(
                crate::commands::IResourceCommandsLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::PRODUCTION),
                },
                game_id,
                actor,
                command,
                context,
            )
        }
    }


    #[starknet::embeddable]
    pub impl GameFixture<TContractState, +Drop<TContractState>> of crate::game::IGame<TContractState> {
        fn game(self: @TContractState, game_id: u32) -> crate::game::GameRegistry {
            crate::game::IGameDispatcherTrait::game(
                crate::game::IGameLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::REGISTRY) },
                game_id,
            )
        }
        fn rules(self: @TContractState, game_id: u32) -> crate::rules::SliceRules {
            crate::game::IGameDispatcherTrait::rules(
                crate::game::IGameLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::REGISTRY) },
                game_id,
            )
        }
        fn write_game(ref self: TContractState, game_id: u32, game: crate::game::GameRegistry) {
            crate::game::IGameDispatcherTrait::write_game(
                crate::game::IGameLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::REGISTRY) },
                game_id,
                game,
            )
        }
    }

    #[starknet::embeddable]
    pub impl GameSettlementFixture<
        TContractState, +Drop<TContractState>,
    > of crate::registrar::IGameSettlement<TContractState> {
        fn mark_game_settled(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            context: crate::commands::ActionContext,
        ) -> u64 {
            crate::registrar::IGameSettlementDispatcherTrait::mark_game_settled(
                crate::registrar::IGameSettlementLibraryDispatcher {
                    class_hash: fixture_class(game_id, crate::slots::SEASON),
                },
                game_id,
                actor,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GuildsFixture<TContractState, +Drop<TContractState>> of crate::guilds::IGuilds<TContractState> {
        fn guild_member(
            self: @TContractState, game_id: u32, actor: starknet::ContractAddress,
        ) -> starknet::ContractAddress {
            crate::guilds::IGuildsDispatcherTrait::guild_member(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
            )
        }
        fn guild(
            self: @TContractState, game_id: u32, guild_id: starknet::ContractAddress,
        ) -> Option<crate::guilds::Guild> {
            crate::guilds::IGuildsDispatcherTrait::guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                guild_id,
            )
        }
        fn guild_whitelisted(self: @TContractState, key: crate::guilds::WhitelistKey) -> bool {
            crate::guilds::IGuildsDispatcherTrait::guild_whitelisted(
                crate::guilds::IGuildsLibraryDispatcher {
                    class_hash: fixture_class(key.game_id, crate::slots::BRIDGE),
                },
                key,
            )
        }
        fn create_guild(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::guilds::CreateGuild,
            context: crate::commands::ActionContext,
        ) {
            crate::guilds::IGuildsDispatcherTrait::create_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn join_guild(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::guilds::JoinGuild,
            context: crate::commands::ActionContext,
        ) {
            crate::guilds::IGuildsDispatcherTrait::join_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn leave_guild(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            context: crate::commands::ActionContext,
        ) {
            crate::guilds::IGuildsDispatcherTrait::leave_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
                context,
            )
        }
        fn set_guild_whitelist(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::guilds::SetWhitelist,
            context: crate::commands::ActionContext,
        ) {
            crate::guilds::IGuildsDispatcherTrait::set_guild_whitelist(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn remove_guild_member(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            member: starknet::ContractAddress,
            context: crate::commands::ActionContext,
        ) {
            crate::guilds::IGuildsDispatcherTrait::remove_guild_member(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::BRIDGE) },
                game_id,
                actor,
                member,
                context,
            )
        }
    }
    fn current_ledger_operator_dispatcher() -> crate::entry::ILedgerOperatorLibraryDispatcher {
        let state = crate::state::read();
        let release_id = state.open_releases.read(crate::game::FRONTIER);
        assert!(release_id != 0, "shard has no release");
        crate::entry::ILedgerOperatorLibraryDispatcher {
            class_hash: crate::logic::release::release_class(release_id, crate::slots::BRIDGE),
        }
    }

    fn ledger_operator_dispatcher(game_id: u32) -> crate::entry::ILedgerOperatorLibraryDispatcher {
        crate::entry::ILedgerOperatorLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
        }
    }

    #[starknet::embeddable]
    pub impl LedgerOperatorFixture<
        TContractState, +Drop<TContractState>,
    > of crate::entry::ILedgerOperator<TContractState> {
        fn deposit_source(self: @TContractState, game_id: u32) -> Option<crate::deposits::DepositSource> {
            crate::entry::ILedgerOperatorDispatcherTrait::deposit_source(ledger_operator_dispatcher(game_id), game_id)
        }
        fn deliver_deposit(
            ref self: TContractState,
            game_id: u32,
            deposit: crate::deposits::LordsDeposit,
            r: felt252,
            s: felt252,
            cancel: bool,
        ) {
            crate::entry::ILedgerOperatorDispatcherTrait::deliver_deposit(
                ledger_operator_dispatcher(game_id), game_id, deposit, r, s, cancel,
            )
        }
        fn deposit_receipt(self: @TContractState, game_id: u32, id: u64) -> Option<crate::deposits::DepositReceipt> {
            crate::entry::ILedgerOperatorDispatcherTrait::deposit_receipt(
                ledger_operator_dispatcher(game_id), game_id, id,
            )
        }
        fn spend_lords(
            self: @TContractState, game_id: u32, account: starknet::ContractAddress,
        ) -> crate::deposits::SpendLords {
            crate::entry::ILedgerOperatorDispatcherTrait::spend_lords(
                ledger_operator_dispatcher(game_id), game_id, account,
            )
        }
        fn principal_withdrawal(
            self: @TContractState, game_id: u32, account: starknet::ContractAddress,
        ) -> Option<crate::deposits::PrincipalWithdrawal> {
            crate::entry::ILedgerOperatorDispatcherTrait::principal_withdrawal(
                ledger_operator_dispatcher(game_id), game_id, account,
            )
        }
        fn ledger_operator(self: @TContractState) -> starknet::ContractAddress {
            crate::entry::ILedgerOperatorDispatcherTrait::ledger_operator(current_ledger_operator_dispatcher())
        }
        fn set_ledger_operator(ref self: TContractState, operator: starknet::ContractAddress) {
            crate::entry::ILedgerOperatorDispatcherTrait::set_ledger_operator(
                current_ledger_operator_dispatcher(), operator,
            );
        }

        fn frontier_prize(self: @TContractState, game_id: u32) -> crate::entry::FrontierPrize {
            crate::entry::ILedgerOperatorDispatcherTrait::frontier_prize(ledger_operator_dispatcher(game_id), game_id)
        }

        fn sweep_lords(ref self: TContractState, game_id: u32, structure_id: u64) {
            crate::entry::ILedgerOperatorDispatcherTrait::sweep_lords(
                ledger_operator_dispatcher(game_id), game_id, structure_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl HomeGrantsFixture<TContractState, +Drop<TContractState>> of crate::entry::IHomeGrants<TContractState> {
        fn grant_seal(ref self: TContractState, game_id: u32, account: starknet::ContractAddress) {
            crate::entry::IHomeGrantsDispatcherTrait::grant_seal(
                crate::entry::IHomeGrantsLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                account,
            )
        }
    }

    #[starknet::embeddable]
    pub impl RelicsFixture<TContractState, +Drop<TContractState>> of crate::relics::IRelics<TContractState> {
        fn apply_relic(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::ApplyRelic,
            context: crate::commands::ActionContext,
        ) {
            crate::relics::IRelicsDispatcherTrait::apply_relic(
                crate::relics::IRelicsLibraryDispatcher { class_hash: fixture_class(game_id, crate::slots::RELICS) },
                game_id,
                actor,
                command,
                context,
            )
        }
    }

    #[starknet::embeddable]
    pub impl CaptureFixture<TContractState, +Drop<TContractState>> of super::ICapture<TContractState> {
        fn destroy(ref self: TContractState, key: crate::troops::ExplorerKey) {
            let state = crate::state::read();
            IFixtureDispatcherTrait::destroy(
                IFixtureLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::TROOPS,
                    ),
                },
                key,
            )
        }
        fn update_troops(ref self: TContractState, key: crate::troops::ExplorerKey, troops: crate::troops::Troops) {
            let state = crate::state::read();
            IFixtureDispatcherTrait::update_troops(
                IFixtureLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::TROOPS,
                    ),
                },
                key,
                troops,
            )
        }
        fn received_actor(self: @TContractState) -> starknet::ContractAddress {
            let state = crate::state::read();
            IFixtureDispatcherTrait::received_actor(
                IFixtureLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::TROOPS,
                    ),
                },
            )
        }
        fn received_root(self: @TContractState) -> u256 {
            let state = crate::state::read();
            IFixtureDispatcherTrait::received_root(
                IFixtureLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::TROOPS,
                    ),
                },
            )
        }
        fn received_timestamp(self: @TContractState) -> u64 {
            let state = crate::state::read();
            IFixtureDispatcherTrait::received_timestamp(
                IFixtureLibraryDispatcher {
                    class_hash: crate::logic::release::release_class(
                        state.open_releases.read(crate::game::FRONTIER), crate::slots::TROOPS,
                    ),
                },
            )
        }
    }
}
