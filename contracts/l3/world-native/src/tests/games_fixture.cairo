#[starknet::interface]
pub trait ICapture<T> {
    fn destroy(ref self: T, key: crate::troops::ExplorerKey);
    fn update_troops(ref self: T, key: crate::troops::ExplorerKey, troops: crate::troops::Troops);
    fn received_actor(self: @T) -> starknet::ContractAddress;
    fn received_root(self: @T) -> u256;
    fn received_timestamp(self: @T) -> u64;
}

// Fixture entrypoints replace the separately deployed domain fixtures.
// They exist only in test builds; gameplay still enters through Games.execute.
pub mod GamesFixture {
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::tests::fixtures::{IFixtureDispatcherTrait, IFixtureLibraryDispatcher};

    // Uncreated-game regressions used the deployed domain before a release pin existed.
    fn fixture_classes(game_id: u32) -> starknet::storage::StoragePath<games_storage::release::LogicClasses> {
        let state = crate::state::read();
        let pin = state.game_releases.read(game_id);
        let release_id = if pin == 0 {
            state.current_release.read()
        } else {
            pin
        };
        state.releases.entry(release_id)
    }

    #[starknet::embeddable]
    pub impl ExpeditionRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::expeditions::IExpeditionRules<TContractState> {
        fn configure_depths(ref self: TContractState, game_id: u32, depths: Span<crate::expeditions::DepthRules>) {
            let classes = fixture_classes(game_id);
            crate::expeditions::IExpeditionRulesDispatcherTrait::configure_depths(
                crate::expeditions::IExpeditionRulesLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                depths,
            )
        }
        fn depth_rules(self: @TContractState, game_id: u32, depth: u8) -> crate::expeditions::DepthRules {
            crate::logic::expeditions::depth_rules(game_id, depth)
        }
    }

    #[starknet::embeddable]
    pub impl SpiresFixture<TContractState, +Drop<TContractState>> of crate::spires::ISpires<TContractState> {
        fn initialize_spires(ref self: TContractState, game_id: u32, layout: crate::spires::SpireLayout) {
            let classes = fixture_classes(game_id);
            crate::spires::ISpiresDispatcherTrait::initialize_spires(
                crate::spires::ISpiresLibraryDispatcher { class_hash: classes.placement.read() }, game_id, layout,
            )
        }
        fn spire_layout(self: @TContractState, game_id: u32) -> Option<crate::spires::SpireLayout> {
            let classes = fixture_classes(game_id);
            crate::spires::ISpiresDispatcherTrait::spire_layout(
                crate::spires::ISpiresLibraryDispatcher { class_hash: classes.placement.read() }, game_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SeasonPlacementFixture<
        TContractState, +Drop<TContractState>,
    > of crate::realms::ISeasonPlacement<TContractState> {
        fn claim_season_settlement(
            ref self: TContractState, game_id: u32, settled_count: u16, seed: u256,
        ) -> crate::troops::Coord {
            let classes = fixture_classes(game_id);
            crate::realms::ISeasonPlacementDispatcherTrait::claim_season_settlement(
                crate::realms::ISeasonPlacementLibraryDispatcher { class_hash: classes.placement.read() },
                game_id,
                settled_count,
                seed,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementPoolFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementPool<TContractState> {
        fn settlement_pool(self: @TContractState, game_id: u32) -> crate::settlement::SettlementPool {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementPoolDispatcherTrait::settlement_pool(
                crate::settlement::ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() }, game_id,
            )
        }
        fn village_pool(self: @TContractState, game_id: u32) -> crate::settlement::SettlementPool {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementPoolDispatcherTrait::village_pool(
                crate::settlement::ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() }, game_id,
            )
        }
        fn claim_village(ref self: TContractState, game_id: u32, registered: u16, seed: u256) -> crate::troops::Coord {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementPoolDispatcherTrait::claim_village(
                crate::settlement::ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() },
                game_id,
                registered,
                seed,
            )
        }
        fn reserved_hyperstructures(self: @TContractState, game_id: u32) -> u32 {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementPoolDispatcherTrait::reserved_hyperstructures(
                crate::settlement::ISettlementPoolLibraryDispatcher { class_hash: classes.placement.read() }, game_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BlitzReservationsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::IBlitzReservations<TContractState> {
        fn initialize_reservations(ref self: TContractState, game_id: u32) {
            let classes = fixture_classes(game_id);
            crate::settlement::IBlitzReservationsDispatcherTrait::initialize_reservations(
                crate::settlement::IBlitzReservationsLibraryDispatcher { class_hash: classes.placement.read() },
                game_id,
            )
        }
        fn release_hyperstructure(ref self: TContractState, game_id: u32, coord: crate::troops::Coord) {
            let classes = fixture_classes(game_id);
            crate::settlement::IBlitzReservationsDispatcherTrait::release_hyperstructure(
                crate::settlement::IBlitzReservationsLibraryDispatcher { class_hash: classes.placement.read() },
                game_id,
                coord,
            )
        }
    }
    #[starknet::embeddable]
    pub impl MapFixture<TContractState, +Drop<TContractState>> of crate::map::IMapLogic<TContractState> {
        fn biome(self: @TContractState, key: crate::map::TileKey) -> u8 {
            let classes = fixture_classes(key.game_id);
            crate::map::IMapLogicDispatcherTrait::biome(
                crate::map::IMapLogicLibraryDispatcher { class_hash: classes.map.read() }, key,
            )
        }
        fn discovery(
            self: @TContractState, key: crate::map::TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
        ) -> crate::discovery::Discovery {
            let classes = fixture_classes(key.game_id);
            crate::map::IMapLogicDispatcherTrait::discovery(
                crate::map::IMapLogicLibraryDispatcher { class_hash: classes.map.read() },
                key,
                seed,
                hyperstructures,
                timestamp,
            )
        }
        fn reveal_structure_surroundings(ref self: TContractState, game_id: u32, coord: crate::troops::Coord) {
            let classes = fixture_classes(game_id);
            crate::map::IMapLogicDispatcherTrait::reveal_structure_surroundings(
                crate::map::IMapLogicLibraryDispatcher { class_hash: classes.map.read() }, game_id, coord,
            )
        }
        fn reveal_destination_tile(ref self: TContractState, key: crate::map::TileKey) -> Option<crate::map::TileOpt> {
            let classes = fixture_classes(key.game_id);
            crate::map::IMapLogicDispatcherTrait::reveal_destination_tile(
                crate::map::IMapLogicLibraryDispatcher { class_hash: classes.map.read() }, key,
            )
        }
        fn expedition_home_ring(
            self: @TContractState, game_id: u32, realm_id: u16, timestamp: u64,
        ) -> Span<(crate::troops::Coord, u8)> {
            let classes = fixture_classes(game_id);
            crate::map::IMapLogicDispatcherTrait::expedition_home_ring(
                crate::map::IMapLogicLibraryDispatcher { class_hash: classes.map.read() }, game_id, realm_id, timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ExtractionFixture<
        TContractState, +Drop<TContractState>,
    > of crate::exploration_rewards::IExtraction<TContractState> {
        fn configure_extraction(
            ref self: TContractState, game_id: u32, rewards: Span<crate::exploration_rewards::ExplorationReward>,
        ) {
            let classes = fixture_classes(game_id);
            crate::exploration_rewards::IExtractionDispatcherTrait::configure_extraction(
                crate::exploration_rewards::IExtractionLibraryDispatcher { class_hash: classes.map.read() },
                game_id,
                rewards,
            )
        }
        fn extraction_rewards(
            self: @TContractState, game_id: u32,
        ) -> Span<crate::exploration_rewards::ExplorationReward> {
            let classes = fixture_classes(game_id);
            crate::exploration_rewards::IExtractionDispatcherTrait::extraction_rewards(
                crate::exploration_rewards::IExtractionLibraryDispatcher { class_hash: classes.map.read() }, game_id,
            )
        }
        fn extract_exploration_reward(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            explorer_id: u32,
            revealed: Option<crate::troops::Coord>,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::exploration_rewards::IExtractionDispatcherTrait::extract_exploration_reward(
                crate::exploration_rewards::IExtractionLibraryDispatcher { class_hash: classes.map.read() },
                game_id,
                actor,
                explorer_id,
                revealed,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl RelicMapFixture<TContractState, +Drop<TContractState>> of crate::relics::IRelicMap<TContractState> {
        fn relic_discovery_time(self: @TContractState, game_id: u32) -> u64 {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicMapDispatcherTrait::relic_discovery_time(
                crate::relics::IRelicMapLibraryDispatcher { class_hash: classes.map.read() }, game_id,
            )
        }
        fn discover_relic_chest(
            ref self: TContractState,
            game_id: u32,
            coord: crate::troops::Coord,
            excluded: crate::troops::Coord,
            seed: u256,
            timestamp: u64,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicMapDispatcherTrait::discover_relic_chest(
                crate::relics::IRelicMapLibraryDispatcher { class_hash: classes.map.read() },
                game_id,
                coord,
                excluded,
                seed,
                timestamp,
            )
        }
        fn consume_relic_chest(ref self: TContractState, game_id: u32, coord: crate::troops::Coord) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicMapDispatcherTrait::consume_relic_chest(
                crate::relics::IRelicMapLibraryDispatcher { class_hash: classes.map.read() }, game_id, coord,
            )
        }
        fn reveal_relic_ring(ref self: TContractState, game_id: u32, coord: crate::troops::Coord, radius: u8) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicMapDispatcherTrait::reveal_relic_ring(
                crate::relics::IRelicMapLibraryDispatcher { class_hash: classes.map.read() }, game_id, coord, radius,
            )
        }
    }
    #[starknet::embeddable]
    pub impl RelicTroopsFixture<TContractState, +Drop<TContractState>> of crate::relics::IRelicTroops<TContractState> {
        fn apply_troop_relic(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            timestamp: u64,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicTroopsDispatcherTrait::apply_troop_relic(
                crate::relics::IRelicTroopsLibraryDispatcher { class_hash: classes.troops.read() },
                game_id,
                actor,
                command,
                rule,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GuardsFixture<TContractState, +Drop<TContractState>> of crate::guards::IGuards<TContractState> {
        fn guard(self: @TContractState, key: crate::guards::GuardKey) -> crate::guards::Guard {
            let classes = fixture_classes(key.game_id);
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsLibraryDispatcher { class_hash: classes.troops.read() }, key,
            )
        }
        fn initialize_structure_guards(
            ref self: TContractState, key: crate::resources::ResourceKey, seed: u256, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::guards::IGuardsDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardsLibraryDispatcher { class_hash: classes.troops.read() }, key, seed, timestamp,
            )
        }
        fn add_starting_guard(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            category: crate::troops::TroopType,
            amount: u128,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::guards::IGuardsDispatcherTrait::add_starting_guard(
                crate::guards::IGuardsLibraryDispatcher { class_hash: classes.troops.read() },
                key,
                category,
                amount,
                timestamp,
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::troop_management::ITroopManagementDispatcherTrait::manage_troops(
                crate::troop_management::ITroopManagementLibraryDispatcher { class_hash: classes.troops.read() },
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
    > of crate::commands::ITroopCommands<TContractState> {
        fn create_explorer(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::commands::CreateExplorer,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::ITroopCommandsDispatcherTrait::create_explorer(
                crate::commands::ITroopCommandsLibraryDispatcher { class_hash: classes.troops.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn explore(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::commands::Explore,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::ITroopCommandsDispatcherTrait::explore(
                crate::commands::ITroopCommandsLibraryDispatcher { class_hash: classes.troops.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }

    #[starknet::embeddable]
    pub impl CampRulesFixture<TContractState, +Drop<TContractState>> of crate::camps::ICampRules<TContractState> {
        fn configure_camps(ref self: TContractState, game_id: u32, resources: Span<crate::resources::ResourceAmount>) {
            let classes = fixture_classes(game_id);
            crate::camps::ICampRulesDispatcherTrait::configure_camps(
                crate::camps::ICampRulesLibraryDispatcher { class_hash: classes.structures.read() }, game_id, resources,
            )
        }
        fn camp_resources(self: @TContractState, game_id: u32) -> Span<crate::resources::ResourceAmount> {
            let classes = fixture_classes(game_id);
            crate::camps::ICampRulesDispatcherTrait::camp_resources(
                crate::camps::ICampRulesLibraryDispatcher { class_hash: classes.structures.read() }, game_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BankCreationFixture<
        TContractState, +Drop<TContractState>,
    > of crate::market::IBankCreation<TContractState> {
        fn create_bank(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            owner: starknet::ContractAddress,
            coord: crate::troops::Coord,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::market::IBankCreationDispatcherTrait::create_bank(
                crate::market::IBankCreationLibraryDispatcher { class_hash: classes.structures.read() },
                key,
                owner,
                coord,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BuildingRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::buildings::IBuildingRules<TContractState> {
        fn configure_buildings(
            ref self: TContractState,
            game_id: u32,
            rules: Span<crate::buildings::BuildingRuleConfig>,
            board: Option<crate::buildings::BoardRules>,
        ) {
            let classes = fixture_classes(game_id);
            crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
                crate::buildings::IBuildingRulesLibraryDispatcher { class_hash: classes.construction.read() },
                game_id,
                rules,
                board,
            )
        }
        fn building_rule(
            self: @TContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            let classes = fixture_classes(key.game_id);
            crate::buildings::IBuildingRulesDispatcherTrait::building_rule(
                crate::buildings::IBuildingRulesLibraryDispatcher { class_hash: classes.construction.read() }, key,
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
            coord: crate::troops::Coord,
            discovery: crate::discovery::Discovery,
            seed: u256,
            timestamp: u64,
        ) -> u32 {
            let classes = fixture_classes(game_id);
            crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
                crate::structures::IStructureOperationsLibraryDispatcher { class_hash: classes.structures.read() },
                game_id,
                coord,
                discovery,
                seed,
                timestamp,
            )
        }
        fn provision_realm(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            coord: crate::troops::Coord,
            grants: Span<(u8, u128)>,
        ) -> u32 {
            let classes = fixture_classes(game_id);
            crate::structures::IStructureOperationsDispatcherTrait::provision_realm(
                crate::structures::IStructureOperationsLibraryDispatcher { class_hash: classes.structures.read() },
                game_id,
                actor,
                coord,
                grants,
            )
        }
        fn pay_for_explorer(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            actor: starknet::ContractAddress,
            resource_type: u8,
            amount: u128,
            explorer_id: u32,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::structures::IStructureOperationsDispatcherTrait::pay_for_explorer(
                crate::structures::IStructureOperationsLibraryDispatcher { class_hash: classes.structures.read() },
                key,
                actor,
                resource_type,
                amount,
                explorer_id,
                timestamp,
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
            context: crate::commands::ExecutionContext,
        ) -> u32 {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementCreationDispatcherTrait::create_settlement(
                crate::settlement::ISettlementCreationLibraryDispatcher { class_hash: classes.structures.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::buildings::IBuildingCommandsDispatcherTrait::create_building(
                crate::buildings::IBuildingCommandsLibraryDispatcher { class_hash: classes.construction.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::buildings::IBuildingCommandsDispatcherTrait::destroy_building(
                crate::buildings::IBuildingCommandsLibraryDispatcher { class_hash: classes.construction.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::buildings::IBuildingCommandsDispatcherTrait::pause_building_production(
                crate::buildings::IBuildingCommandsLibraryDispatcher { class_hash: classes.construction.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::buildings::IBuildingCommandsDispatcherTrait::resume_building_production(
                crate::buildings::IBuildingCommandsLibraryDispatcher { class_hash: classes.construction.read() },
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
            let classes = fixture_classes(key.game_id);
            crate::names::INamesDispatcherTrait::entity_name(
                crate::names::INamesLibraryDispatcher { class_hash: classes.structures.read() }, key,
            )
        }
        fn set_entity_name(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::names::SetEntityName,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::names::INamesDispatcherTrait::set_entity_name(
                crate::names::INamesLibraryDispatcher { class_hash: classes.structures.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl StructureCaptureFixture<
        TContractState, +Drop<TContractState>,
    > of crate::guards::IStructureCapture<TContractState> {
        fn capture_structure(
            ref self: TContractState, key: crate::resources::ResourceKey, capturing_home: u32, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
                crate::guards::IStructureCaptureLibraryDispatcher { class_hash: classes.structures.read() },
                key,
                capturing_home,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl UpgradeRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::upgrades::IUpgradeRules<TContractState> {
        fn configure_upgrades(
            ref self: TContractState,
            game_id: u32,
            limits: crate::upgrades::UpgradeLimits,
            recipes: Span<crate::upgrades::UpgradeRecipe>,
        ) {
            let classes = fixture_classes(game_id);
            crate::upgrades::IUpgradeRulesDispatcherTrait::configure_upgrades(
                crate::upgrades::IUpgradeRulesLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                limits,
                recipes,
            )
        }
        fn upgrade_limits(self: @TContractState, game_id: u32) -> crate::upgrades::UpgradeLimits {
            let classes = fixture_classes(game_id);
            crate::upgrades::IUpgradeRulesDispatcherTrait::upgrade_limits(
                crate::upgrades::IUpgradeRulesLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn upgrade_recipe(self: @TContractState, game_id: u32, level: u8) -> crate::upgrades::UpgradeRecipe {
            let classes = fixture_classes(game_id);
            crate::upgrades::IUpgradeRulesDispatcherTrait::upgrade_recipe(
                crate::upgrades::IUpgradeRulesLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                level,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SeasonRealmsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::realms::ISeasonRealms<TContractState> {
        fn initialize_realm_traits(ref self: TContractState, first_realm: u32, packed_traits: Span<u32>) {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::realms::ISeasonRealmsDispatcherTrait::initialize_realm_traits(
                crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement.read() },
                first_realm,
                packed_traits,
            )
        }
        fn realm_catalogue(self: @TContractState) -> crate::realms::RealmCatalogue {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::realms::ISeasonRealmsDispatcherTrait::realm_catalogue(
                crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement.read() },
            )
        }
        fn realm_traits(self: @TContractState, realm_id: u32) -> crate::realms::RealmTraits {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::realms::ISeasonRealmsDispatcherTrait::realm_traits(
                crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement.read() }, realm_id,
            )
        }
        fn available_realm(self: @TContractState, game_id: u32, index: u32) -> u32 {
            let classes = fixture_classes(game_id);
            crate::realms::ISeasonRealmsDispatcherTrait::available_realm(
                crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement.read() }, game_id, index,
            )
        }
        fn settle_season(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::realms::SettleSeason,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::realms::ISeasonRealmsDispatcherTrait::settle_season(
                crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl VillagesFixture<TContractState, +Drop<TContractState>> of crate::village::IVillages<TContractState> {
        fn configure_villages(ref self: TContractState, game_id: u32, rules: crate::village::VillageRules) {
            let classes = fixture_classes(game_id);
            crate::village::IVillagesDispatcherTrait::configure_villages(
                crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() }, game_id, rules,
            )
        }
        fn village_rules(self: @TContractState, game_id: u32) -> crate::village::VillageRules {
            let classes = fixture_classes(game_id);
            crate::village::IVillagesDispatcherTrait::village_rules(
                crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn register_village_pass(
            ref self: TContractState, key: crate::village::VillagePassKey, owner: starknet::ContractAddress,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::village::IVillagesDispatcherTrait::register_village_pass(
                crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() }, key, owner,
            )
        }
        fn village_pass(
            self: @TContractState, key: crate::village::VillagePassKey,
        ) -> Option<crate::village::VillagePass> {
            let classes = fixture_classes(key.game_id);
            crate::village::IVillagesDispatcherTrait::village_pass(
                crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() }, key,
            )
        }
        fn settle_village(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::village::SettleVillage,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::village::IVillagesDispatcherTrait::settle_village(
                crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementConfigurationFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementConfiguration<TContractState> {
        fn configure_settlement(
            ref self: TContractState,
            game_id: u32,
            rules: crate::settlement::SettlementRules,
            grants: crate::settlement::RealmGrants,
        ) {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementConfigurationDispatcherTrait::configure_settlement(
                crate::settlement::ISettlementConfigurationLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                rules,
                grants,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementViewsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementViews<TContractState> {
        fn blitz_settlement_order(self: @TContractState, game_id: u32) -> Span<u8> {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::blitz_settlement_order(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn player_has_settled(self: @TContractState, game_id: u32, player: starknet::ContractAddress) -> bool {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::player_has_settled(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                player,
            )
        }
        fn settlement_rules(self: @TContractState, game_id: u32) -> crate::settlement::SettlementRules {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::settlement_rules(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn realm_grants(self: @TContractState, game_id: u32) -> crate::settlement::RealmGrants {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::realm_grants(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn settlement_progress(self: @TContractState, game_id: u32) -> crate::settlement::SettlementProgress {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::settlement_progress(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() }, game_id,
            )
        }
        fn player_entry(
            self: @TContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::PlayerEntry> {
            let classes = fixture_classes(key.game_id);
            crate::settlement::ISettlementViewsDispatcherTrait::player_entry(
                crate::settlement::ISettlementViewsLibraryDispatcher { class_hash: classes.settlement.read() }, key,
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
            let classes = state.releases.entry(state.current_release.read());
            crate::settlement::ISettlementEntryDispatcherTrait::register_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher { class_hash: classes.settlement.read() },
                key,
                entitlement,
            )
        }
        fn entry_entitlement(
            self: @TContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::EntryEntitlement> {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::settlement::ISettlementEntryDispatcherTrait::entry_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher { class_hash: classes.settlement.read() }, key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SettlementCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::settlement::ISettlementCommands<TContractState> {
        fn settle_blitz_roster(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            context: crate::commands::ExecutionContext,
        ) -> u64 {
            let classes = fixture_classes(game_id);
            crate::settlement::ISettlementCommandsDispatcherTrait::settle_blitz_roster(
                crate::settlement::ISettlementCommandsLibraryDispatcher { class_hash: classes.settlement.read() },
                game_id,
                actor,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ResourcesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::resources::IResourceOperations<TContractState> {
        fn redirect_production(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            receiver: crate::resources::ProductionReceiver,
            rate: u64,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::redirect_production(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                receiver,
                rate,
                timestamp,
            )
        }
        fn configure_resources(ref self: TContractState, game_id: u32, rules: Span<crate::resources::ResourceRule>) {
            let classes = fixture_classes(game_id);
            crate::resources::IResourceOperationsDispatcherTrait::configure_resources(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                game_id,
                rules,
            )
        }
        fn initialize_resources(
            ref self: TContractState, key: crate::resources::ResourceKey, capacity: u128, category: u8, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::initialize_resources(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                capacity,
                category,
                timestamp,
            )
        }
        fn initialize_explorer_resources(ref self: TContractState, key: crate::resources::ResourceKey, amount: u128) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::initialize_explorer_resources(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                amount,
            )
        }
        fn destroy_resources(ref self: TContractState, key: crate::resources::ResourceKey) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::destroy_resources(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() }, key,
            )
        }
        fn change_explorer_capacity(
            ref self: TContractState, key: crate::resources::ResourceKey, amount: u128, increase: bool,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::change_explorer_capacity(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                amount,
                increase,
            )
        }
        fn grant_resource(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
        ) -> u128 {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                amount,
                timestamp,
            )
        }
        fn spend_resource(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                amount,
                timestamp,
            )
        }
        fn start_production(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::start_production(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                rate,
                output,
                timestamp,
            )
        }
        fn stop_production(
            ref self: TContractState, key: crate::resources::ResourceKey, resource_type: u8, rate: u64, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::stop_production(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                rate,
                timestamp,
            )
        }
        fn change_structure_capacity(
            ref self: TContractState, key: crate::resources::ResourceKey, amount: u128, adding: bool,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::change_structure_capacity(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                amount,
                adding,
            )
        }
        fn spend_food(
            ref self: TContractState, key: crate::resources::ResourceKey, wheat: u128, fish: u128, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::spend_food(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                wheat,
                fish,
                timestamp,
            )
        }
        fn spend_spire_fee(ref self: TContractState, key: crate::resources::ResourceKey, timestamp: u64) {
            let classes = fixture_classes(key.game_id);
            crate::resources::IResourceOperationsDispatcherTrait::spend_spire_fee(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl EconomyDeliveryFixture<
        TContractState, +Drop<TContractState>,
    > of crate::trade::IEconomyDelivery<TContractState> {
        fn queue_economy_delivery(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            resource: crate::resources::ResourceAmount,
            travel_time: u64,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::trade::IEconomyDeliveryDispatcherTrait::queue_economy_delivery(
                crate::trade::IEconomyDeliveryLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource,
                travel_time,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl MineRulesFixture<TContractState, +Drop<TContractState>> of crate::mines::IMineRules<TContractState> {
        fn configure_mines(
            ref self: TContractState,
            game_id: u32,
            kinds: Span<crate::mines::MineKindEntry>,
            surface: Span<crate::mines::MineWeight>,
        ) {
            let classes = fixture_classes(game_id);
            crate::mines::IMineRulesDispatcherTrait::configure_mines(
                crate::mines::IMineRulesLibraryDispatcher { class_hash: classes.production.read() },
                game_id,
                kinds,
                surface,
            )
        }
        fn mine_kind(self: @TContractState, key: crate::mines::MineKindKey) -> crate::mines::MineKindConfig {
            let classes = fixture_classes(key.game_id);
            crate::mines::IMineRulesDispatcherTrait::mine_kind(
                crate::mines::IMineRulesLibraryDispatcher { class_hash: classes.production.read() }, key,
            )
        }
        fn mine_pool(self: @TContractState, key: crate::mines::MinePoolKey) -> Span<crate::mines::MineWeight> {
            let classes = fixture_classes(key.game_id);
            crate::mines::IMineRulesDispatcherTrait::mine_pool(
                crate::mines::IMineRulesLibraryDispatcher { class_hash: classes.production.read() }, key,
            )
        }
        fn mine_draw(
            self: @TContractState, key: crate::mines::MinePoolKey, seed: u256,
        ) -> (u8, crate::mines::MineKindConfig, u128) {
            let classes = fixture_classes(key.game_id);
            crate::mines::IMineRulesDispatcherTrait::mine_draw(
                crate::mines::IMineRulesLibraryDispatcher { class_hash: classes.production.read() }, key, seed,
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
        ) {
            let classes = fixture_classes(key.game_id);
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantLibraryDispatcher { class_hash: classes.resources.read() },
                key,
                resource_type,
                amount,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl RelicProductionFixture<
        TContractState, +Drop<TContractState>,
    > of crate::relics::IRelicProduction<TContractState> {
        fn apply_production_relic(
            ref self: TContractState,
            key: crate::resources::ResourceKey,
            relic_id: u8,
            rule: crate::relics::RelicRule,
            timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::relics::IRelicProductionDispatcherTrait::apply_production_relic(
                crate::relics::IRelicProductionLibraryDispatcher { class_hash: classes.production.read() },
                key,
                relic_id,
                rule,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ProductionRulesFixture<
        TContractState, +Drop<TContractState>,
    > of crate::production::IProductionRules<TContractState> {
        fn configure_production(
            ref self: TContractState, game_id: u32, recipes: Span<crate::production::RecipeConfig>,
        ) {
            let classes = fixture_classes(game_id);
            crate::production::IProductionRulesDispatcherTrait::configure_production(
                crate::production::IProductionRulesLibraryDispatcher { class_hash: classes.production.read() },
                game_id,
                recipes,
            )
        }
        fn production_recipe(
            self: @TContractState, key: crate::production::RecipeKey,
        ) -> crate::production::ProductionRecipe {
            let classes = fixture_classes(key.game_id);
            crate::production::IProductionRulesDispatcherTrait::production_recipe(
                crate::production::IProductionRulesLibraryDispatcher { class_hash: classes.production.read() }, key,
            )
        }
        fn production_bonus(
            self: @TContractState, key: crate::resources::ResourceKey,
        ) -> crate::production::ProductionBonus {
            let classes = fixture_classes(key.game_id);
            crate::production::IProductionRulesDispatcherTrait::production_bonus(
                crate::production::IProductionRulesLibraryDispatcher { class_hash: classes.production.read() }, key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ProductionCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::production::IProductionCommands<TContractState> {
        fn burn_labor_for_resource_production(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::production::RefillProduction,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::production::IProductionCommandsDispatcherTrait::burn_labor_for_resource_production(
                crate::production::IProductionCommandsLibraryDispatcher { class_hash: classes.production.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn burn_resource_for_resource_production(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::production::RefillProduction,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::production::IProductionCommandsDispatcherTrait::burn_resource_for_resource_production(
                crate::production::IProductionCommandsLibraryDispatcher { class_hash: classes.production.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::send_resources(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::transfer_explorer_resources_to_structure(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::offload_arrival(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::burn_structure_resources(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::transfer_explorer_resources(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn transfer_structure_resources_to_explorer(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::commands::IResourceCommandsDispatcherTrait::transfer_structure_resources_to_explorer(
                crate::commands::IResourceCommandsLibraryDispatcher { class_hash: classes.resources.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl TradeFixture<TContractState, +Drop<TContractState>> of crate::trade::ITrade<TContractState> {
        fn configure_trade(ref self: TContractState, game_id: u32, rules: crate::trade::TradeRules) {
            let classes = fixture_classes(game_id);
            crate::trade::ITradeDispatcherTrait::configure_trade(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() }, game_id, rules,
            )
        }
        fn trade_rules(self: @TContractState, game_id: u32) -> crate::trade::TradeRules {
            let classes = fixture_classes(game_id);
            crate::trade::ITradeDispatcherTrait::trade_rules(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() }, game_id,
            )
        }
        fn trade_order(self: @TContractState, key: crate::trade::TradeKey) -> Option<crate::trade::TradeOrder> {
            let classes = fixture_classes(key.game_id);
            crate::trade::ITradeDispatcherTrait::trade_order(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn create_trade_order(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::trade::CreateOrder,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::trade::ITradeDispatcherTrait::create_trade_order(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn accept_trade_order(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::trade::AcceptOrder,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::trade::ITradeDispatcherTrait::accept_trade_order(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn cancel_trade_order(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            trade_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::trade::ITradeDispatcherTrait::cancel_trade_order(
                crate::trade::ITradeLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                trade_id,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BankFixture<TContractState, +Drop<TContractState>> of crate::market::IBank<TContractState> {
        fn configure_banks(ref self: TContractState, game_id: u32, rules: crate::market::BankRules) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::configure_banks(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() }, game_id, rules,
            )
        }
        fn bank_rules(self: @TContractState, game_id: u32) -> crate::market::BankRules {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::bank_rules(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() }, game_id,
            )
        }
        fn bank_name(self: @TContractState, key: crate::resources::ResourceKey) -> felt252 {
            let classes = fixture_classes(key.game_id);
            crate::market::IBankDispatcherTrait::bank_name(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn market(self: @TContractState, key: crate::market::MarketKey) -> crate::market::Market {
            let classes = fixture_classes(key.game_id);
            crate::market::IBankDispatcherTrait::market(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn liquidity(self: @TContractState, key: crate::market::LiquidityKey) -> u128 {
            let classes = fixture_classes(key.game_id);
            crate::market::IBankDispatcherTrait::liquidity(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn create_banks(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            banks: Span<crate::market::BankPlacement>,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::create_banks(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                banks,
                context,
            )
        }
        fn buy_from_bank(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::market::Swap,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::buy_from_bank(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn sell_to_bank(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::market::Swap,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::sell_to_bank(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn add_bank_liquidity(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::market::AddLiquidity,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::add_bank_liquidity(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn remove_bank_liquidity(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::market::RemoveLiquidity,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::market::IBankDispatcherTrait::remove_bank_liquidity(
                crate::market::IBankLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl FaithOwnershipViewsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::faith::IFaithOwnershipViews<TContractState> {
        fn wonder_faith(self: @TContractState, key: crate::resources::ResourceKey) -> crate::faith::WonderFaith {
            let classes = fixture_classes(key.game_id);
            crate::faith::IFaithOwnershipViewsDispatcherTrait::wonder_faith(
                crate::faith::IFaithOwnershipViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn faithful_structure(
            self: @TContractState, key: crate::resources::ResourceKey,
        ) -> crate::faith::FaithfulStructure {
            let classes = fixture_classes(key.game_id);
            crate::faith::IFaithOwnershipViewsDispatcherTrait::faithful_structure(
                crate::faith::IFaithOwnershipViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn player_faith_points(
            self: @TContractState, key: crate::faith::PlayerFaithKey,
        ) -> crate::faith::PlayerFaithPoints {
            let classes = fixture_classes(key.game_id);
            crate::faith::IFaithOwnershipViewsDispatcherTrait::player_faith_points(
                crate::faith::IFaithOwnershipViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn wonder_faith_winners(self: @TContractState, game_id: u32) -> crate::faith::WonderFaithWinners {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithOwnershipViewsDispatcherTrait::wonder_faith_winners(
                crate::faith::IFaithOwnershipViewsLibraryDispatcher { class_hash: classes.prizes.read() }, game_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BitcoinViewsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::bitcoin::IBitcoinViews<TContractState> {
        fn bitcoin_mine(self: @TContractState, key: crate::resources::ResourceKey) -> crate::bitcoin::MineFunding {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinViewsDispatcherTrait::bitcoin_mine(
                crate::bitcoin::IBitcoinViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn bitcoin_claimed(self: @TContractState, key: crate::bitcoin::ClaimKey) -> bool {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinViewsDispatcherTrait::bitcoin_claimed(
                crate::bitcoin::IBitcoinViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn bitcoin_phase(self: @TContractState, key: crate::bitcoin::PhaseKey) -> crate::bitcoin::Phase {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinViewsDispatcherTrait::bitcoin_phase(
                crate::bitcoin::IBitcoinViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn bitcoin_contribution(
            self: @TContractState, key: crate::bitcoin::ContributionKey,
        ) -> crate::bitcoin::Contribution {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinViewsDispatcherTrait::bitcoin_contribution(
                crate::bitcoin::IBitcoinViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key,
            )
        }
        fn bitcoin_contributor(
            self: @TContractState, key: crate::bitcoin::PhaseKey, index: u32,
        ) -> starknet::ContractAddress {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinViewsDispatcherTrait::bitcoin_contributor(
                crate::bitcoin::IBitcoinViewsLibraryDispatcher { class_hash: classes.prizes.read() }, key, index,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BitcoinFundingFixture<
        TContractState, +Drop<TContractState>,
    > of crate::bitcoin::IBitcoinFunding<TContractState> {
        fn register_bitcoin_structure(
            ref self: TContractState, key: crate::resources::ResourceKey, category: u8, timestamp: u64,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinFundingDispatcherTrait::register_bitcoin_structure(
                crate::bitcoin::IBitcoinFundingLibraryDispatcher { class_hash: classes.prizes.read() },
                key,
                category,
                timestamp,
            )
        }
        fn bitcoin_mine_captured(ref self: TContractState, key: crate::resources::ResourceKey, timestamp: u64) {
            let classes = fixture_classes(key.game_id);
            crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
                crate::bitcoin::IBitcoinFundingLibraryDispatcher { class_hash: classes.prizes.read() }, key, timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BitcoinCommandsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::bitcoin::IBitcoinCommands<TContractState> {
        fn claim_bitcoin_phase(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::bitcoin::ClaimPhase,
            context: crate::commands::ExecutionContext,
        ) -> u64 {
            let classes = fixture_classes(game_id);
            crate::bitcoin::IBitcoinCommandsDispatcherTrait::claim_bitcoin_phase(
                crate::bitcoin::IBitcoinCommandsLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn contribute_bitcoin_labor(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::bitcoin::ContributeLabor,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::bitcoin::IBitcoinCommandsDispatcherTrait::contribute_bitcoin_labor(
                crate::bitcoin::IBitcoinCommandsLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn close_bitcoin_phase(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            phase: u64,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::bitcoin::IBitcoinCommandsDispatcherTrait::close_bitcoin_phase(
                crate::bitcoin::IBitcoinCommandsLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                phase,
                context,
            )
        }
        fn bind_bitcoin_phase(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            phase: u64,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::bitcoin::IBitcoinCommandsDispatcherTrait::bind_bitcoin_phase(
                crate::bitcoin::IBitcoinCommandsLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                phase,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GameFixture<TContractState, +Drop<TContractState>> of crate::game::IGame<TContractState> {
        fn game(self: @TContractState, game_id: u32) -> crate::game::GameRegistry {
            let classes = fixture_classes(game_id);
            crate::game::IGameDispatcherTrait::game(
                crate::game::IGameLibraryDispatcher { class_hash: classes.registry.read() }, game_id,
            )
        }
        fn rules(self: @TContractState, game_id: u32) -> crate::rules::SliceRules {
            let classes = fixture_classes(game_id);
            crate::game::IGameDispatcherTrait::rules(
                crate::game::IGameLibraryDispatcher { class_hash: classes.registry.read() }, game_id,
            )
        }
        fn write_game(ref self: TContractState, game_id: u32, game: crate::game::GameRegistry) {
            let classes = fixture_classes(game_id);
            crate::game::IGameDispatcherTrait::write_game(
                crate::game::IGameLibraryDispatcher { class_hash: classes.registry.read() }, game_id, game,
            )
        }
        fn start_blitz(ref self: TContractState, game_id: u32, timestamp: u64) {
            let classes = fixture_classes(game_id);
            crate::game::IGameDispatcherTrait::start_blitz(
                crate::game::IGameLibraryDispatcher { class_hash: classes.registry.read() }, game_id, timestamp,
            )
        }
        fn allocate_entity(ref self: TContractState, game_id: u32) -> u32 {
            let classes = fixture_classes(game_id);
            crate::game::IGameDispatcherTrait::allocate_entity(
                crate::game::IGameLibraryDispatcher { class_hash: classes.registry.read() }, game_id,
            )
        }
    }

    #[starknet::embeddable]
    pub impl WithdrawalsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::withdrawals::IWithdrawals<TContractState> {
        fn configure_withdrawals(
            ref self: TContractState,
            game_id: u32,
            rules: crate::withdrawals::WithdrawalRules,
            tokens: Span<crate::withdrawals::ResourceToken>,
        ) {
            let classes = fixture_classes(game_id);
            crate::withdrawals::IWithdrawalsDispatcherTrait::configure_withdrawals(
                crate::withdrawals::IWithdrawalsLibraryDispatcher { class_hash: classes.bridge.read() },
                game_id,
                rules,
                tokens,
            )
        }
        fn withdrawal_rules(self: @TContractState, game_id: u32) -> crate::withdrawals::WithdrawalRules {
            let classes = fixture_classes(game_id);
            crate::withdrawals::IWithdrawalsDispatcherTrait::withdrawal_rules(
                crate::withdrawals::IWithdrawalsLibraryDispatcher { class_hash: classes.bridge.read() }, game_id,
            )
        }
        fn resource_token(self: @TContractState, key: crate::market::MarketKey) -> starknet::ContractAddress {
            let classes = fixture_classes(key.game_id);
            crate::withdrawals::IWithdrawalsDispatcherTrait::resource_token(
                crate::withdrawals::IWithdrawalsLibraryDispatcher { class_hash: classes.bridge.read() }, key,
            )
        }
    }
    #[starknet::embeddable]
    pub impl SeasonLifecycleFixture<
        TContractState, +Drop<TContractState>,
    > of crate::game::ISeasonLifecycle<TContractState> {
        fn configure_season_win(ref self: TContractState, game_id: u32, points: u128) {
            let classes = fixture_classes(game_id);
            crate::game::ISeasonLifecycleDispatcherTrait::configure_season_win(
                crate::game::ISeasonLifecycleLibraryDispatcher { class_hash: classes.season.read() }, game_id, points,
            )
        }
        fn season_win_threshold(self: @TContractState, game_id: u32) -> u128 {
            let classes = fixture_classes(game_id);
            crate::game::ISeasonLifecycleDispatcherTrait::season_win_threshold(
                crate::game::ISeasonLifecycleLibraryDispatcher { class_hash: classes.season.read() }, game_id,
            )
        }
        fn close_season(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            context: crate::commands::ExecutionContext,
        ) -> u64 {
            let classes = fixture_classes(game_id);
            crate::game::ISeasonLifecycleDispatcherTrait::close_season(
                crate::game::ISeasonLifecycleLibraryDispatcher { class_hash: classes.season.read() },
                game_id,
                actor,
                context,
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
            context: crate::commands::ExecutionContext,
        ) -> u64 {
            let classes = fixture_classes(game_id);
            crate::registrar::IGameSettlementDispatcherTrait::mark_game_settled(
                crate::registrar::IGameSettlementLibraryDispatcher { class_hash: classes.season.read() },
                game_id,
                actor,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl PointsFixture<TContractState, +Drop<TContractState>> of crate::game::IPoints<TContractState> {
        fn register_exploration(ref self: TContractState, game_id: u32, actor: starknet::ContractAddress) {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::register_exploration(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id, actor,
            )
        }
        fn register_capture(
            ref self: TContractState, game_id: u32, actor: starknet::ContractAddress, category: u8,
        ) -> u128 {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::register_capture(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id, actor, category,
            )
        }
        fn register_relic_points(ref self: TContractState, game_id: u32, actor: starknet::ContractAddress) {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::register_relic_points(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id, actor,
            )
        }
        fn register_hyperstructure_points(
            ref self: TContractState, game_id: u32, actor: starknet::ContractAddress, amount: u128,
        ) {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::register_hyperstructure_points(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id, actor, amount,
            )
        }
        fn player_points(self: @TContractState, game_id: u32, actor: starknet::ContractAddress) -> u128 {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::player_points(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id, actor,
            )
        }
        fn season_points(self: @TContractState, game_id: u32) -> u128 {
            let classes = fixture_classes(game_id);
            crate::game::IPointsDispatcherTrait::season_points(
                crate::game::IPointsLibraryDispatcher { class_hash: classes.season.read() }, game_id,
            )
        }
    }
    #[starknet::embeddable]
    pub impl HyperstructuresFixture<
        TContractState, +Drop<TContractState>,
    > of crate::hyperstructures::IHyperstructures<TContractState> {
        fn configure_hyperstructures(
            ref self: TContractState, game_id: u32, rules: crate::hyperstructures::HyperstructureRules,
        ) {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::configure_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                rules,
            )
        }
        fn hyperstructure_rules(self: @TContractState, game_id: u32) -> crate::hyperstructures::HyperstructureRules {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_rules(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
            )
        }
        fn hyperstructure(
            self: @TContractState, key: crate::resources::ResourceKey,
        ) -> Option<crate::hyperstructures::Hyperstructure> {
            let classes = fixture_classes(key.game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn hyperstructure_progress(self: @TContractState, key: crate::resources::ResourceSlot) -> u128 {
            let classes = fixture_classes(key.game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_progress(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn hyperstructure_requirement(self: @TContractState, key: crate::resources::ResourceSlot) -> u128 {
            let classes = fixture_classes(key.game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_requirement(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn hyperstructure_shares(
            self: @TContractState, key: crate::resources::ResourceKey,
        ) -> crate::hyperstructures::ShareAllocation {
            let classes = fixture_classes(key.game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_shares(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() }, key,
            )
        }
        fn hyperstructure_count(self: @TContractState, game_id: u32) -> u32 {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_count(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
            )
        }
        fn completed_hyperstructure_count(self: @TContractState, game_id: u32) -> u32 {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::completed_hyperstructure_count(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
            )
        }
        fn settle_completed_hyperstructures(ref self: TContractState, game_id: u32, timestamp: u64) -> u32 {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_completed_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                timestamp,
            )
        }
        fn settle_final_hyperstructures(ref self: TContractState, game_id: u32, timestamp: u64) -> u32 {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_final_hyperstructures(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                timestamp,
            )
        }
        fn record_hyperstructure(
            ref self: TContractState, key: crate::resources::ResourceKey, seed: felt252, completed: bool,
        ) {
            let classes = fixture_classes(key.game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::record_hyperstructure(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                key,
                seed,
                completed,
            )
        }
        fn initialize_hyperstructure(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::initialize_hyperstructure(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                id,
                context,
            )
        }
        fn contribute_hyperstructure(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            contribution: crate::hyperstructures::Contribution,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::contribute_hyperstructure(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                contribution,
                context,
            )
        }
        fn allocate_hyperstructure_shares(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::hyperstructures::AllocateShares,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::allocate_hyperstructure_shares(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn set_construction_access(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::hyperstructures::SetConstructionAccess,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::hyperstructures::IHyperstructuresDispatcherTrait::set_construction_access(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: classes.economy.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl GuildsFixture<TContractState, +Drop<TContractState>> of crate::guilds::IGuilds<TContractState> {
        fn guild_member(
            self: @TContractState, game_id: u32, actor: starknet::ContractAddress,
        ) -> starknet::ContractAddress {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::guild_member(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() }, game_id, actor,
            )
        }
        fn guild(
            self: @TContractState, game_id: u32, guild_id: starknet::ContractAddress,
        ) -> Option<crate::guilds::Guild> {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() }, game_id, guild_id,
            )
        }
        fn guild_whitelisted(self: @TContractState, key: crate::guilds::WhitelistKey) -> bool {
            let classes = fixture_classes(key.game_id);
            crate::guilds::IGuildsDispatcherTrait::guild_whitelisted(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() }, key,
            )
        }
        fn create_guild(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::guilds::CreateGuild,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::create_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::join_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::leave_guild(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::set_guild_whitelist(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() },
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
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::guilds::IGuildsDispatcherTrait::remove_guild_member(
                crate::guilds::IGuildsLibraryDispatcher { class_hash: classes.structures.read() },
                game_id,
                actor,
                member,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BridgeFixture<TContractState, +Drop<TContractState>> of crate::bridge::IBridge<TContractState> {
        fn configure_deposits(ref self: TContractState, game_id: u32, rules: crate::bridge::DepositRules) {
            let classes = fixture_classes(game_id);
            crate::bridge::IBridgeDispatcherTrait::configure_deposits(
                crate::bridge::IBridgeLibraryDispatcher { class_hash: classes.bridge.read() }, game_id, rules,
            )
        }
        fn deposit_rules(self: @TContractState, game_id: u32) -> crate::bridge::DepositRules {
            let classes = fixture_classes(game_id);
            crate::bridge::IBridgeDispatcherTrait::deposit_rules(
                crate::bridge::IBridgeLibraryDispatcher { class_hash: classes.bridge.read() }, game_id,
            )
        }
        fn deposit_resource(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::bridge::Deposit,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::bridge::IBridgeDispatcherTrait::deposit_resource(
                crate::bridge::IBridgeLibraryDispatcher { class_hash: classes.bridge.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn withdraw_resource(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::bridge::Withdraw,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::bridge::IBridgeDispatcherTrait::withdraw_resource(
                crate::bridge::IBridgeLibraryDispatcher { class_hash: classes.bridge.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BankWithdrawalFixture<
        TContractState, +Drop<TContractState>,
    > of crate::bridge::IBankWithdrawal<TContractState> {
        fn withdraw_bank_resources(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            bank_id: u32,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
        ) {
            let classes = fixture_classes(game_id);
            crate::bridge::IBankWithdrawalDispatcherTrait::withdraw_bank_resources(
                crate::bridge::IBankWithdrawalLibraryDispatcher { class_hash: classes.bridge.read() },
                game_id,
                actor,
                bank_id,
                resource_type,
                amount,
                timestamp,
            )
        }
    }
    #[starknet::embeddable]
    pub impl LedgerOperatorFixture<
        TContractState, +Drop<TContractState>,
    > of crate::entry::ILedgerOperator<TContractState> {
        fn ledger_operator(self: @TContractState) -> starknet::ContractAddress {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::entry::ILedgerOperatorDispatcherTrait::ledger_operator(
                crate::entry::ILedgerOperatorLibraryDispatcher { class_hash: classes.settlement.read() },
            )
        }
        fn set_ledger_operator(ref self: TContractState, operator: starknet::ContractAddress) {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            crate::entry::ILedgerOperatorDispatcherTrait::set_ledger_operator(
                crate::entry::ILedgerOperatorLibraryDispatcher { class_hash: classes.settlement.read() }, operator,
            )
        }
    }
    #[starknet::embeddable]
    pub impl BlitzResultsFixture<
        TContractState, +Drop<TContractState>,
    > of crate::blitz_results::IBlitzResults<TContractState> {
        fn blitz_result(self: @TContractState, game_id: u32) -> crate::blitz_results::BlitzResult {
            let classes = fixture_classes(game_id);
            crate::blitz_results::IBlitzResultsDispatcherTrait::blitz_result(
                crate::blitz_results::IBlitzResultsLibraryDispatcher { class_hash: classes.prizes.read() }, game_id,
            )
        }
        fn record_blitz_results(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::blitz_results::RecordBlitzResults,
            context: crate::commands::ExecutionContext,
        ) -> u64 {
            let classes = fixture_classes(game_id);
            crate::blitz_results::IBlitzResultsDispatcherTrait::record_blitz_results(
                crate::blitz_results::IBlitzResultsLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl FaithFixture<TContractState, +Drop<TContractState>> of crate::faith::IFaith<TContractState> {
        fn configure_faith(ref self: TContractState, game_id: u32, rules: crate::faith::FaithRules) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::configure_faith(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() }, game_id, rules,
            )
        }
        fn faith_rules(self: @TContractState, game_id: u32) -> crate::faith::FaithRules {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::faith_rules(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() }, game_id,
            )
        }
        fn pledge_faith(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::faith::Pledge,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::pledge_faith(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn remove_faith(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            structure_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::remove_faith(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                structure_id,
                context,
            )
        }
        fn update_wonder_ownership(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            wonder_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::update_wonder_ownership(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                wonder_id,
                context,
            )
        }
        fn update_faithful_ownership(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            structure_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::update_faithful_ownership(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                structure_id,
                context,
            )
        }
        fn claim_wonder_points(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            wonder_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::claim_wonder_points(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                wonder_id,
                context,
            )
        }
        fn claim_player_faith_points(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::faith::ClaimPlayer,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::faith::IFaithDispatcherTrait::claim_player_faith_points(
                crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl RelicsFixture<TContractState, +Drop<TContractState>> of crate::relics::IRelics<TContractState> {
        fn configure_relics(
            ref self: TContractState,
            game_id: u32,
            rules: Span<crate::relics::RelicRule>,
            chests: Option<crate::relics::ChestRules>,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::configure_relics(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id, rules, chests,
            )
        }
        fn chest_rules(self: @TContractState, game_id: u32) -> Option<crate::relics::ChestRules> {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::chest_rules(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id,
            )
        }
        fn chest_pity(self: @TContractState, game_id: u32, player: starknet::ContractAddress, depth: u8) -> u16 {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::chest_pity(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id, player, depth,
            )
        }
        fn chest_tokens(self: @TContractState, game_id: u32, player: starknet::ContractAddress, epoch: u64) -> u16 {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::chest_tokens(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id, player, epoch,
            )
        }
        fn chest_reward(self: @TContractState, game_id: u32, result_id: u32) -> Option<crate::relics::ChestReward> {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::chest_reward(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id, result_id,
            )
        }
        fn grant_reveal_chest(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::OpenChest,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::grant_reveal_chest(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn relic_rules(self: @TContractState, game_id: u32) -> Span<crate::relics::RelicRule> {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::relic_rules(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() }, game_id,
            )
        }
        fn open_relic_chest(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::OpenChest,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::open_relic_chest(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn grant_site_chest(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::OpenChest,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::grant_site_chest(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
        fn apply_relic(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::ApplyRelic,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::relics::IRelicsDispatcherTrait::apply_relic(
                crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                actor,
                command,
                context,
            )
        }
    }
    #[starknet::embeddable]
    pub impl ArtificerFixture<TContractState, +Drop<TContractState>> of crate::artificer::IArtificer<TContractState> {
        fn configure_artificer(ref self: TContractState, game_id: u32, research_cost: u128) {
            let classes = fixture_classes(game_id);
            crate::artificer::IArtificerDispatcherTrait::configure_artificer(
                crate::artificer::IArtificerLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                research_cost,
            )
        }
        fn artificer_cost(self: @TContractState, game_id: u32) -> u128 {
            let classes = fixture_classes(game_id);
            crate::artificer::IArtificerDispatcherTrait::artificer_cost(
                crate::artificer::IArtificerLibraryDispatcher { class_hash: classes.relics.read() }, game_id,
            )
        }
        fn craft_relic(
            ref self: TContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            structure_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let classes = fixture_classes(game_id);
            crate::artificer::IArtificerDispatcherTrait::craft_relic(
                crate::artificer::IArtificerLibraryDispatcher { class_hash: classes.relics.read() },
                game_id,
                actor,
                structure_id,
                context,
            )
        }
    }

    #[starknet::embeddable]
    pub impl CaptureFixture<TContractState, +Drop<TContractState>> of super::ICapture<TContractState> {
        fn destroy(ref self: TContractState, key: crate::troops::ExplorerKey) {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            IFixtureDispatcherTrait::destroy(IFixtureLibraryDispatcher { class_hash: classes.troops.read() }, key)
        }
        fn update_troops(ref self: TContractState, key: crate::troops::ExplorerKey, troops: crate::troops::Troops) {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            IFixtureDispatcherTrait::update_troops(
                IFixtureLibraryDispatcher { class_hash: classes.troops.read() }, key, troops,
            )
        }
        fn received_actor(self: @TContractState) -> starknet::ContractAddress {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            IFixtureDispatcherTrait::received_actor(IFixtureLibraryDispatcher { class_hash: classes.troops.read() })
        }
        fn received_root(self: @TContractState) -> u256 {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            IFixtureDispatcherTrait::received_root(IFixtureLibraryDispatcher { class_hash: classes.troops.read() })
        }
        fn received_timestamp(self: @TContractState) -> u64 {
            let state = crate::state::read();
            let classes = state.releases.entry(state.current_release.read());
            IFixtureDispatcherTrait::received_timestamp(IFixtureLibraryDispatcher { class_hash: classes.troops.read() })
        }
    }
}
