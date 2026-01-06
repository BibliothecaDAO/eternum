use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::models::config::{MapConfig, QuestConfig, TickImpl, TickTrait, WorldConfigUtilImpl};
use crate::models::map::{Tile, TileImpl, TileOccupier};
use crate::models::position::Coord;
use crate::models::quest::{Level, Quest, QuestDetails, QuestGameRegistry, QuestLevels, QuestTile};
use crate::systems::quest::constants::{
    CAPACITY_SELECTOR_SALT, GAME_SELECTOR_SALT, LEVEL_SELECTOR_SALT, MAXIMUM_QUEST_CAPACITY, MINIMUM_QUEST_CAPACITY,
    QUEST_REWARD_BASE_MULTIPLIER, VERSION, VRF_OFFSET,
};
use crate::systems::utils::map::IMapImpl;
use crate::systems::utils::troop::iExplorerImpl;
use crate::utils::map::biomes::Biome;
use starknet::ContractAddress;
use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

#[starknet::interface]
pub trait IQuestSystems<T> {
    fn add_game(ref self: T, address: ContractAddress, levels: Span<Level>, overwrite: bool);
    fn remove_game(ref self: T, address: ContractAddress);
    fn create_quest(ref self: T, tile: Tile, vrf_seed: u256);
    fn start_quest(
        ref self: T, quest_tile_id: u32, explorer_id: ID, player_name: felt252, to_address: ContractAddress,
    ) -> u64;
    fn claim_reward(ref self: T, game_token_id: u64, game_address: ContractAddress);
    fn enable_quests(ref self: T);
    fn disable_quests(ref self: T);
    fn get_quest(self: @T, game_token_id: u64, game_address: ContractAddress) -> Quest;
    fn get_quest_details(self: @T, game_token_id: u64, game_address: ContractAddress) -> QuestDetails;
    fn get_quest_tile(self: @T, quest_tile_id: u32) -> QuestTile;
    fn get_target_score(self: @T, game_token_id: u64, game_address: ContractAddress) -> u32;
    fn is_quest_feature_enabled(self: @T) -> bool;
}

#[starknet::interface]
pub trait IBudokanGame<T> {
    fn score(self: @T, token_id: u64) -> u32;
    // fn mint_game(
//     self: @T,
//     player_name: Option<felt252>,
//     settings_id: Option<u32>,
//     start: Option<u64>,
//     end: Option<u64>,
//     objective_ids: Option<Span<u32>>,
//     context: Option<GameContextDetails>,
//     client_url: Option<ByteArray>,
//     renderer_address: Option<ContractAddress>,
//     to: ContractAddress,
//     soulbound: bool,
// ) -> u64;
}

#[dojo::contract]
pub mod quest_systems {
    use core::array::ArrayTrait;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, ErrorMessages, resource_type_name};
    use crate::models::map::Tile;
    use crate::models::position::TravelTrait;
    use crate::models::quest::{
        Level, Quest, QuestDetails, QuestFeatureFlag, QuestGameRegistry, QuestLevels, QuestTile,
    };
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureMetadataStoreImpl, StructureOwnerStoreImpl};
    use crate::models::troop::ExplorerTroops;
    use crate::models::weight::Weight;
    use crate::systems::quest::constants::VERSION;
    use starknet::ContractAddress;
    use super::{IBudokanGameDispatcher, IBudokanGameDispatcherTrait, iQuestDiscoveryImpl};

    fn dojo_init(self: @ContractState) {
        // initialize quest feature flag to enabled
        let mut world: WorldStorage = self.world(DEFAULT_NS());
        let mut quest_feature_flag: QuestFeatureFlag = QuestFeatureFlag { key: VERSION, enabled: true };
        world.write_model(@quest_feature_flag);
    }

    #[abi(embed_v0)]
    pub impl QuestSystemsImpl of super::IQuestSystems<ContractState> {
        fn add_game(ref self: ContractState, address: ContractAddress, levels: Span<Level>, overwrite: bool) {
            let mut world = self.world(DEFAULT_NS());

            // Check that at least one level is provided
            assert!(levels.len() > 0, "must provided at least one level");

            // only owner can add new quest games
            assert(
                world
                    .dispatcher
                    .is_owner(selector_from_tag!("s1_eternum-quest_systems"), starknet::get_caller_address()) == true,
                ErrorMessages::NOT_OWNER,
            );

            // if overwrite is not true
            if !overwrite {
                // ensure game is not already in registry
                let quest_levels: QuestLevels = world.read_model(address);
                assert!(quest_levels.levels.len() == 0, "Game already exists and overwrite is not true");
            }

            // Store the game configuration
            let game_config = QuestLevels { game_address: address, levels };
            world.write_model(@game_config);

            // Add the game to the registry
            let registry: QuestGameRegistry = world.read_model(VERSION);

            // Create a mutable array from the current games span
            let mut games_array: Array<ContractAddress> = registry.games.into();

            // Append the new game address directly
            games_array.append(address);

            // Update the registry with the new array span
            let updated_registry = QuestGameRegistry { key: VERSION, games: games_array.span() };
            world.write_model(@updated_registry);
        }

        fn remove_game(ref self: ContractState, address: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());

            // only owner can remove quest games
            assert(
                world
                    .dispatcher
                    .is_owner(selector_from_tag!("s1_eternum-quest_systems"), starknet::get_caller_address()) == true,
                ErrorMessages::NOT_OWNER,
            );

            // Verify the game exists in config
            let quest_levels: QuestLevels = world.read_model(address);
            assert!(quest_levels.levels.len() == 0, "Game is not in registry");

            // Get current registry
            let registry: QuestGameRegistry = world.read_model(VERSION);
            let current_games = registry.games;
            let original_length = current_games.len();

            // Create a new array without the removed game
            let mut new_games = ArrayTrait::new();

            // Go through each game
            let mut i = 0;
            loop {
                if i >= current_games.len() {
                    break;
                }
                let game_address = *current_games.at(i);
                if game_address != address {
                    new_games.append(game_address);
                }
                i += 1;
            }

            // Assert the game exists in the registry by checking if the length changed
            assert!(new_games.len() < original_length, "Game is not in registry");

            // Update the registry
            let updated_registry = QuestGameRegistry { key: VERSION, games: new_games.span() };
            world.write_model(@updated_registry);
        }

        fn create_quest(ref self: ContractState, tile: Tile, vrf_seed: u256) {
            let mut world = self.world(DEFAULT_NS());
            let mut tile = tile;

            // ensure caller is the troop movement util systems
            let (troop_movement_util_systems_address, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems_address,
                "caller must be the troop movement util systems",
            );

            let feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            assert!(feature_toggle.enabled, "Quest feature is disabled");

            iQuestDiscoveryImpl::create(ref world, ref tile, vrf_seed);
        }

        fn start_quest(
            ref self: ContractState,
            quest_tile_id: u32,
            explorer_id: ID,
            player_name: felt252,
            to_address: ContractAddress,
        ) -> u64 {
            // let mut world = self.world(DEFAULT_NS());

            // let feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            // assert!(feature_toggle.enabled, "Quest feature is disabled");

            // let mut quest_tile: QuestTile = world.read_model(quest_tile_id);
            // assert!(quest_tile.game_address.is_non_zero(), "Quest tile not found for id: {}", quest_tile_id);
            // assert!(
            //     quest_tile.participant_count < quest_tile.capacity, "Quest is at capacity for id: {}", quest_tile_id,
            // );

            // let explorer: ExplorerTroops = world.read_model(explorer_id);
            // assert!(explorer.coord.is_adjacent(quest_tile.coord), "Explorer is not adjacent to quest tile");

            // // verify caller is owner of explorer
            // StructureOwnerStoreImpl::retrieve(ref world, explorer.owner).assert_caller_owner();

            // // Get the realm ID from the explorer's owner structure
            // let structure_metadata = StructureMetadataStoreImpl::retrieve(ref world, explorer.owner);

            // // if the structure is a village
            // let realm_or_village_id = if structure_metadata.village_realm != 0 {
            //     //  use the owner (structure id) of explorer
            //     explorer.owner
            // } else {
            //     // otherwise use realm id
            //     structure_metadata.realm_id.into()
            // };

            // // Check if this realm already has a participant in this quest
            // let realm_or_village_participant: QuestRegistrations = world
            //     .read_model((quest_tile_id, realm_or_village_id));
            // assert!(
            //     realm_or_village_participant.game_token_id == 0, "Realm or Village has already attempted this quest",
            // );

            // // TODO: Consider scenario in which game has been removed from registry
            // let game: QuestLevels = world.read_model(quest_tile.game_address);
            // let config: Level = *game.levels.at(quest_tile.level.into());

            // // we don't currently use start delay but could be used as part of future, multi-player
            // // raid feature
            // let game_start_delay: Option<u64> = Option::None;

            // // use optional expiration if set on level config
            // let game_expiration: Option<u64> = if config.time_limit > 0 {
            //     Option::Some(starknet::get_block_timestamp() + config.time_limit)
            // } else {
            //     Option::None
            // };

            // let game_dispatcher = IBudokanGameDispatcher { contract_address: quest_tile.game_address };
            // let game_token_id: u64 = game_dispatcher
            //     .mint(
            //         player_name,
            //         config.settings_id,
            //         game_start_delay,
            //         game_expiration,
            //         to_address
            //     );

            // let quest = Quest {
            //     game_token_id, game_address: quest_tile.game_address, quest_tile_id, explorer_id, completed: false,
            // };
            // world.write_model(@quest);

            // // increment participant count
            // quest_tile.participant_count += 1;
            // world.write_model(@quest_tile);

            // // Record realm participation with this quest
            // let realm_or_village_participant = QuestRegistrations { quest_tile_id, realm_or_village_id, game_token_id
            // };
            // world.write_model(@realm_or_village_participant);

            // game_token_id

            1
        }

        fn claim_reward(ref self: ContractState, game_token_id: u64, game_address: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());

            let feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            assert!(feature_toggle.enabled, "Quest feature is disabled");

            let mut quest: Quest = world.read_model((game_token_id, game_address));
            let quest_tile: QuestTile = world.read_model(quest.quest_tile_id);

            // Explorer must be adjacent to quest tile to claim reward
            let explorer: ExplorerTroops = world.read_model(quest.explorer_id);
            assert!(explorer.coord.is_adjacent(quest_tile.coord), "Explorer is not adjacent to quest tile");

            // TODO: Capacity Check (if we're using a resource that has a weight)

            // get score for the token id
            let quest_levels: QuestLevels = world.read_model(quest_tile.game_address);
            let level: Level = *quest_levels.levels.at(quest_tile.level.into());

            let game_dispatcher = IBudokanGameDispatcher { contract_address: quest_tile.game_address };
            let score: u32 = game_dispatcher.score(quest.game_token_id);

            // check if the score is greater than or equal to the target score
            assert!(
                score >= level.target_score,
                "Quest for game token id {} is not completed. Target score: {}, Current score: {}",
                quest.game_token_id,
                level.target_score,
                score,
            );

            // set quest as completed
            quest.completed = true;
            world.write_model(@quest);

            // grant resource reward for completing quest
            let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, quest.explorer_id);
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_tile.resource_type);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world,
                quest.explorer_id,
                quest_tile.resource_type,
                ref explorer_weight,
                resource_weight_grams,
                false,
            );
            resource.add(quest_tile.amount, ref explorer_weight, resource_weight_grams);
            resource.store(ref world);
            explorer_weight.store(ref world, quest.explorer_id);
        }

        fn enable_quests(ref self: ContractState) {
            let mut world = self.world(DEFAULT_NS());
            assert(
                world
                    .dispatcher
                    .is_owner(selector_from_tag!("s1_eternum-quest_systems"), starknet::get_caller_address()) == true,
                ErrorMessages::NOT_OWNER,
            );

            let mut feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            assert!(!feature_toggle.enabled, "Quest feature is already enabled");

            feature_toggle.enabled = true;
            world.write_model(@feature_toggle);
        }

        fn disable_quests(ref self: ContractState) {
            let mut world = self.world(DEFAULT_NS());
            assert(
                world
                    .dispatcher
                    .is_owner(selector_from_tag!("s1_eternum-quest_systems"), starknet::get_caller_address()) == true,
                ErrorMessages::NOT_OWNER,
            );

            let mut feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            assert!(feature_toggle.enabled, "Quest feature is already disabled");

            feature_toggle.enabled = false;
            world.write_model(@feature_toggle);
        }

        fn get_quest(self: @ContractState, game_token_id: u64, game_address: ContractAddress) -> Quest {
            let mut world = self.world(DEFAULT_NS());
            world.read_model((game_token_id, game_address))
        }

        fn get_quest_details(self: @ContractState, game_token_id: u64, game_address: ContractAddress) -> QuestDetails {
            let mut world = self.world(DEFAULT_NS());
            let quest: Quest = world.read_model((game_token_id, game_address));
            let quest_tile: QuestTile = world.read_model(quest.quest_tile_id);
            let quest_levels: QuestLevels = world.read_model(quest_tile.game_address);
            let target_score: u32 = *quest_levels.levels.at(quest_tile.level.into()).target_score;
            let resource_name: ByteArray = resource_type_name(quest_tile.resource_type);
            QuestDetails {
                quest_tile_id: quest.quest_tile_id,
                game_address,
                coord: quest_tile.coord,
                target_score,
                reward_name: resource_name,
                reward_amount: quest_tile.amount,
            }
        }

        fn get_target_score(self: @ContractState, game_token_id: u64, game_address: ContractAddress) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            let quest: Quest = world.read_model((game_token_id, game_address));
            let quest_tile: QuestTile = world.read_model(quest.quest_tile_id);
            let quest_levels: QuestLevels = world.read_model(quest_tile.game_address);
            *quest_levels.levels.at(quest_tile.level.into()).target_score
        }

        fn get_quest_tile(self: @ContractState, quest_tile_id: u32) -> QuestTile {
            let mut world = self.world(DEFAULT_NS());
            world.read_model(quest_tile_id)
        }

        fn is_quest_feature_enabled(self: @ContractState) -> bool {
            let mut world = self.world(DEFAULT_NS());
            let feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
            feature_toggle.enabled
        }
    }
}

#[generate_trait]
pub impl iQuestDiscoveryImpl of iQuestDiscoveryTrait {
    fn create(ref world: WorldStorage, ref tile: Tile, seed: u256) -> @QuestTile {
        assert!(tile.not_occupied(), "Can't create quest on occupied tile");

        // explore the tile if biome is not set
        if tile.biome == Biome::None.into() {
            let biome_library = biome_library::get_dispatcher(@world);
            let biome: Biome = biome_library.get_biome(tile.alt, tile.col.into(), tile.row.into());
            IMapImpl::explore(ref world, ref tile, biome);
        }

        // get game registry
        let quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_count: u128 = quest_game_registry.games.len().into();

        // select random game from game registry
        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let game_selector: u32 = rng_library_dispatcher
            .get_random_in_range(seed, GAME_SELECTOR_SALT, game_count)
            .try_into()
            .unwrap();
        let game_address: ContractAddress = *quest_game_registry.games.at(game_selector);
        let quest_levels: QuestLevels = world.read_model(game_address);

        // select random level for the selected game
        let level: u8 = rng_library_dispatcher
            .get_random_in_range(seed, LEVEL_SELECTOR_SALT, quest_levels.levels.len().into())
            .try_into()
            .unwrap();

        // select random capacity for the quest
        let capacity: u16 = (rng_library_dispatcher
            .get_random_in_range(seed, CAPACITY_SELECTOR_SALT, (MAXIMUM_QUEST_CAPACITY - MINIMUM_QUEST_CAPACITY).into())
            + MINIMUM_QUEST_CAPACITY.into())
            .try_into()
            .unwrap();

        // use exploration reward system to get a random resource type and amount
        let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
        let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
        let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
        let (resource_type, base_reward_amount) = iExplorerImpl::exploration_reward(
            ref world, Option::None, current_tick, map_config, seed, blitz_mode_on,
        );

        // apply quest reward multiplier and level multiplier to base exploration reward
        let amount: u128 = base_reward_amount * QUEST_REWARD_BASE_MULTIPLIER.into() * (level.into() + 1);

        let id = world.dispatcher.uuid();
        let coord = Coord { alt: false, x: tile.col, y: tile.row };

        let quest_tile = @QuestTile {
            id, game_address, coord, level, resource_type, amount, capacity, participant_count: 0,
        };

        // set tile occupier
        IMapImpl::occupy(ref world, ref tile, TileOccupier::Quest, id);
        world.write_model(quest_tile);

        quest_tile
    }


    fn lottery(quest_config: QuestConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        let quest_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher
            .get_weighted_choice_bool_simple(
                quest_config.quest_discovery_prob.into(), quest_config.quest_discovery_fail_prob.into(), quest_vrf_seed,
            );
        return success;
    }
}

#[cfg(test)]
mod tests {
    use achievement::events::index::{e_TrophyCreation, e_TrophyProgression};
    use budokan::components::models::game::{
        TokenMetadata, m_GameCounter, m_GameMetadata, m_Score, m_Settings, m_SettingsCounter, m_SettingsDetails,
        m_TokenMetadata,
    };
    use budokan::components::tests::mocks::game_mock::{
        IGameTokenMockDispatcher, IGameTokenMockDispatcherTrait, IGameTokenMockInitDispatcher,
        IGameTokenMockInitDispatcherTrait, game_mock,
    };
    use core::num::traits::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcherTrait, WorldStorageTrait};
    use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};
    use openzeppelin_token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{CombatConfigImpl, WorldConfigUtilImpl, m_WeightConfig, m_WorldConfig};
    use crate::models::map::{Tile, TileImpl, TileOccupier, m_BiomeDiscovered, m_Tile};
    use crate::models::position::{Coord, Direction, TravelTrait};
    use crate::models::quest::{
        Level, Quest, QuestGameRegistry, QuestLevels, QuestTile, m_Quest, m_QuestFeatureFlag, m_QuestGameRegistry,
        m_QuestLevels, m_QuestRegistrations, m_QuestTile,
    };
    use crate::models::resource::production::building::{m_Building, m_StructureBuildings};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl, m_Resource,
    };
    use crate::models::map2::{TileOpt};
    use crate::models::stamina::StaminaImpl;
    use crate::models::structure::{
        StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureTroopExplorerStoreImpl, m_Structure,
        m_StructureOwnerStats, m_StructureVillageSlots,
    };
    use crate::models::troop::{ExplorerTroops, GuardImpl, TroopTier, TroopType, m_ExplorerTroops};
    use crate::models::weight::Weight;
    use crate::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
    };
    use crate::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait, agent_discovery_systems,
        hyperstructure_discovery_systems, mine_discovery_systems, troop_movement_systems, troop_movement_util_systems,
    };
    use crate::systems::quest::constants::{
        MAXIMUM_QUEST_CAPACITY, MINIMUM_QUEST_CAPACITY, QUEST_REWARD_BASE_MULTIPLIER, VERSION,
    };
    use crate::systems::quest::contracts::{
        IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait, iQuestDiscoveryImpl, quest_systems,
    };
    use crate::systems::resources::contracts::resource_systems::resource_systems;
    use crate::systems::village::contracts::village_systems;
    use crate::utils::map::biomes::Biome;
    use crate::utils::testing::helpers::{
        MOCK_MAP_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_LIMIT_CONFIG, init_config, tgrant_resources, tspawn_explorer,
        tspawn_quest_tile, tspawn_realm_with_resources, tspawn_simple_realm, tspawn_village, tspawn_village_explorer,
        tspawn_world,
    };
    use starknet::ContractAddress;


    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // world config
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_WeightConfig::TEST_CLASS_HASH), // structure, realm and buildings
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
                TestResource::Model(m_StructureOwnerStats::TEST_CLASS_HASH),
                TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
                TestResource::Model(m_Resource::TEST_CLASS_HASH),
                // other models
                TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
                TestResource::Model(m_BiomeDiscovered::TEST_CLASS_HASH),
                // quest models
                TestResource::Model(m_QuestTile::TEST_CLASS_HASH), TestResource::Model(m_Quest::TEST_CLASS_HASH),
                TestResource::Model(m_QuestRegistrations::TEST_CLASS_HASH),
                TestResource::Model(m_QuestLevels::TEST_CLASS_HASH),
                TestResource::Model(m_QuestGameRegistry::TEST_CLASS_HASH),
                TestResource::Model(m_QuestFeatureFlag::TEST_CLASS_HASH),
                // game mock models
                TestResource::Model(m_GameMetadata::TEST_CLASS_HASH),
                TestResource::Model(m_GameCounter::TEST_CLASS_HASH),
                TestResource::Model(m_TokenMetadata::TEST_CLASS_HASH), TestResource::Model(m_Score::TEST_CLASS_HASH),
                TestResource::Model(m_Settings::TEST_CLASS_HASH),
                TestResource::Model(m_SettingsCounter::TEST_CLASS_HASH),
                TestResource::Model(m_SettingsDetails::TEST_CLASS_HASH),
                TestResource::Model(m_StructureVillageSlots::TEST_CLASS_HASH),
                // achievements
                TestResource::Event(e_TrophyCreation::TEST_CLASS_HASH),
                TestResource::Event(e_TrophyProgression::TEST_CLASS_HASH),
                // contracts
                TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
                TestResource::Contract(troop_movement_systems::TEST_CLASS_HASH),
                TestResource::Contract(troop_movement_util_systems::TEST_CLASS_HASH),
                TestResource::Contract(agent_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(hyperstructure_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(mine_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(resource_systems::TEST_CLASS_HASH),
                TestResource::Contract(quest_systems::TEST_CLASS_HASH),
                TestResource::Contract(game_mock::TEST_CLASS_HASH),
                TestResource::Contract(village_systems::TEST_CLASS_HASH),
                // events
                TestResource::Event(troop_movement_systems::e_ExplorerMoveEvent::TEST_CLASS_HASH),
            ]
                .span(),
        };

        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_util_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"agent_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"hyperstructure_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"mine_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"game_mock")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"quest_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"village_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    #[test]
    fn full_integration() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        init_config(ref world);

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // create a realm
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        // grant basic resources to the realm
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        let wheat_amount: u128 = 100000000000000000;
        let fish_amount: u128 = 50000000000000000;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::FISH, fish_amount)].span());

        // set current tick
        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);
        starknet::testing::set_contract_address(realm_owner);

        // create an explorer for the realm
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let troop_spawn_direction = Direction::East;
        let explorer_id = troop_management_systems
            .explorer_create(
                realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
            );

        // add settings to our game mock
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr };

        let mut found_quest = false;
        let mut quest_coord: Coord = Coord { alt: false, x: 0, y: 0 };
        let mut tiles_explored = 0;

        let mut troop_movement_directions = array![Direction::East].span();
        // Move to the edge of the explored tiles
        troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, false);

        let mut explore = true;

        // wander around the map looking for a quest tile
        while !found_quest {
            // set a transaction hash so the vrf seed is not empty
            starknet::testing::set_transaction_hash(6 * (2 + tiles_explored));

            // Move east
            let discovered_tiles = troop_movement_systems
                .explorer_move(explorer_id, troop_movement_directions, explore);
            explore = true;

            if discovered_tiles.len() > 0 {
                let tile = *discovered_tiles.at(0);
                // println!("Discovered tile {:?}", tile);

                if tile.occupier_type > 0 && tile.occupier_type != TileOccupier::ExplorerCrossbowmanT2Regular.into() {
                    // if we find a quest tile, we're done
                    if tile.occupier_type == TileOccupier::Quest.into() {
                        found_quest = true;
                        quest_coord = Coord { alt: false, x: tile.col, y: tile.row };
                    } else {
                        // if we find something else that occupies the tile, change direction
                        if *troop_movement_directions.at(0) == Direction::East {
                            troop_movement_directions = array![Direction::NorthEast].span();
                            explore = false;
                        } else {
                            troop_movement_directions = array![Direction::East].span();
                            explore = false;
                        }
                    }
                }
            }

            // advance time
            let current_time = starknet::get_block_timestamp();
            starknet::testing::set_block_timestamp(current_time + 100);

            tiles_explored += 1;
        }

        // assert explorer is adjacent to the quest tile
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.is_adjacent(quest_coord), "Explorer is not adjacent to the quest tile");

        // get tile at quest coord
        let tile_opt: TileOpt = world.read_model((quest_coord.alt, quest_coord.x, quest_coord.y));
        let tile: Tile = tile_opt.into();
        assert!(tile.occupier_type == TileOccupier::Quest.into(), "Tile is not a quest tile");
        assert!(tile.occupier_id != 0, "Tile occupier id should not be 0");
        assert!(tile.occupier_is_structure == true, "Quest considered a structure");
        assert!(tile.biome != Biome::None.into(), "Tile biome should not be None");

        let quest_tile: QuestTile = world.read_model(tile.occupier_id);
        let quest_levels: QuestLevels = world.read_model(quest_tile.game_address);

        let expected_reward_amount = MOCK_MAP_CONFIG().reward_resource_amount.into()
            * QUEST_REWARD_BASE_MULTIPLIER.into()
            * (quest_tile.level.into() + 1)
            * RESOURCE_PRECISION;
        assert!(quest_tile.coord == quest_coord, "Quest details coord does not match quest tile coord");
        assert!(quest_tile.id == tile.occupier_id, "Quest details id does not match quest tile occupier id");
        assert!(
            quest_tile.game_address == game_mock_addr,
            "Quest tile game address is wrong. Expected: {:?}, Got: {:?}",
            game_mock_addr,
            quest_tile.game_address,
        );
        assert!(
            quest_tile.level.into() <= quest_levels.levels.len(),
            "Quest details level should be less than or equal to the number of levels in the quest game",
        );
        assert!(quest_tile.resource_type != 0, "Quest details resource type should be valid");
        assert!(
            quest_tile.amount.into() == expected_reward_amount,
            "Wrong reward amount. Expected: {}, Got: {}",
            expected_reward_amount,
            quest_tile.amount,
        );
        assert!(quest_tile.capacity != 0, "Quest details capacity should be greater than 0");
        assert!(quest_tile.participant_count == 0, "Quest details participant count should be 0");

        // start quest
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(quest_tile.id, explorer_id, 'player1', realm_owner);

        // // verify game was minted to quester
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(game_token_id.into());
        assert!(quest_owner == realm_owner, "Game was not minted to quester");

        // // end game with high enough score to claim reward
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        let target_score = quest_system.get_target_score(game_token_id, game_mock_addr);
        game_mock_dispatcher.end_game(game_token_id.into(), target_score);

        // get resource amount prior to claiming quest reward
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        let mut resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_tile.resource_type);
        let resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer_id, quest_tile.resource_type, ref explorer_weight, resource_weight_grams, false,
        );
        let resource_balance_before_claim = resource.balance;

        // claim reward
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.claim_reward(game_token_id, game_mock_addr);

        // assert quest is completed
        let quest: Quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(quest.completed == true, "Quest should be completed");

        // get updated resource amount
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, quest.explorer_id);
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_tile.resource_type);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world, quest.explorer_id, quest_tile.resource_type, ref explorer_weight, resource_weight_grams, false,
        );

        // assert explorer received reward
        assert!(
            resource.balance == quest_tile.amount + resource_balance_before_claim, "Explorer did not receive reward",
        );
    }

    #[test]
    fn add_game_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data
        let game_address = starknet::contract_address_const::<'game_mock'>();
        let level1 = Level { target_score: 100, settings_id: 0, time_limit: 600 };
        let levels = array![level1].span();

        // Since tspawn_world already adds a game, let's get the current count
        let quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_count: u32 = quest_game_registry.games.len().into();

        // Add game as owner (should succeed)
        quest_systems.add_game(game_address, levels, false);

        // Verify game was added
        let updated_quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        assert!(updated_quest_game_registry.games.len() == game_count + 1, "Owner should be able to add game");
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn add_game_not_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data
        let game_address = starknet::contract_address_const::<'game_mock'>();
        let level1 = Level { target_score: 100, settings_id: 0, time_limit: 600 };
        let levels = array![level1].span();

        // Set caller to non-owner
        let non_owner = starknet::contract_address_const::<'non_owner'>();
        starknet::testing::set_contract_address(non_owner);

        // Attempt to add game - should fail as caller is not system owner
        quest_systems.add_game(game_address, levels, false);
    }

    #[test]
    fn add_game_check_registry_increment() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Get the initial game counter value
        let quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_count: u32 = quest_game_registry.games.len().into();

        // Set up test data for first game
        let game_address1 = starknet::contract_address_const::<'game_mock_1'>();
        let level1 = Level { target_score: 100, settings_id: 0, time_limit: 600 };
        let levels1 = array![level1].span();

        // Add first game
        quest_systems.add_game(game_address1, levels1, false);

        // Check registry count incremented
        let updated_quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        assert!(updated_quest_game_registry.games.len() == game_count + 1, "Registry count should be 1");

        // Add second game
        let game_address2 = starknet::contract_address_const::<'game_mock_2'>();
        let level2 = Level { target_score: 200, settings_id: 1, time_limit: 1200 };
        let levels2 = array![level2].span();

        quest_systems.add_game(game_address2, levels2, false);

        // Check registry count incremented again
        let updated_quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        assert!(updated_quest_game_registry.games.len() == game_count + 2, "Registry count should be 2");
    }

    #[test]
    fn add_game_check_storage_retrieval() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data
        let game_address = starknet::contract_address_const::<'custom_game'>();

        // Create multiple levels with different configurations
        let level1 = Level { target_score: 100, settings_id: 1, time_limit: 600 };
        let level2 = Level { target_score: 200, settings_id: 2, time_limit: 1200 };
        let level3 = Level { target_score: 300, settings_id: 3, time_limit: 1800 };
        let levels = array![level1, level2, level3].span();

        // get the initial game count
        let quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_count_before: u32 = quest_game_registry.games.len().into();

        // Add the game
        quest_systems.add_game(game_address, levels, false);

        // Get the game counter to determine the ID
        let updated_quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_count_after: u32 = updated_quest_game_registry.games.len().into();
        assert!(game_count_after == game_count_before + 1, "Game count should increment by 1");

        // verify the game address was added
        let game_address_added = *updated_quest_game_registry.games.at(game_count_after - 1);
        assert!(
            game_address_added == game_address,
            "Game address mismatch. Expected: {:?}, Got: {:?}",
            game_address,
            game_address_added,
        );

        // Retrieve the game from storage
        let quest_levels: QuestLevels = world.read_model(game_address);

        // Verify levels were stored correctly
        assert!(quest_levels.levels.len() == 3, "Wrong number of levels");

        // Check level 1 data
        let level1 = *quest_levels.levels.at(0);
        assert!(level1.target_score == 100, "Level 1 target score mismatch");
        assert!(level1.settings_id == 1, "Level 1 settings ID mismatch");
        assert!(level1.time_limit == 600, "Level 1 time limit mismatch");

        // Check level 2 data
        let level2 = *quest_levels.levels.at(1);
        assert!(level2.target_score == 200, "Level 2 target score mismatch");
        assert!(level2.settings_id == 2, "Level 2 settings ID mismatch");
        assert!(level2.time_limit == 1200, "Level 2 time limit mismatch");

        // Check level 3 data
        let level3 = *quest_levels.levels.at(2);
        assert!(level3.target_score == 300, "Level 3 target score mismatch");
        assert!(level3.settings_id == 3, "Level 3 settings ID mismatch");
        assert!(level3.time_limit == 1800, "Level 3 time limit mismatch");
    }

    #[test]
    #[should_panic(expected: ("must provided at least one level", 'ENTRYPOINT_FAILED'))]
    fn add_game_zero_levels() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data with zero levels
        let game_address = starknet::contract_address_const::<'game_mock_zero_levels'>();
        let levels = array![].span();

        // Attempt to add game with zero levels - should fail
        quest_systems.add_game(game_address, levels, false);
    }

    #[test]
    #[should_panic(expected: ("Explorer is not adjacent to quest tile", 'ENTRYPOINT_FAILED'))]
    fn start_quest_not_adjacent_to_tile() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at (80, 80)
        let quest_coord = Coord { alt: false, x: 80, y: 80 };

        // Place explorer at (83, 83) - not adjacent to quest
        let explorer_coord = Coord { alt: false, x: 83, y: 83 };

        // Create realm some distance away
        let realm_coord = Coord { alt: false, x: 85, y: 85 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_entity_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);
        starknet::testing::set_contract_address(realm_owner);

        // Create explorer
        let explorer_id = tspawn_explorer(ref world, realm_entity_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Verify explorer is NOT adjacent to quest
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(!explorer.coord.is_adjacent(quest_coord), "Explorer should not be adjacent to quest tile");

        // Attempt to start quest - should fail because explorer is not adjacent
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);
    }

    // test trying to start a quest using an explorer that the caller does not own
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn start_quest_not_explorer_owner() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest at adjacent positions
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let quest_coord = Coord { alt: false, x: 82, y: 80 };

        // Set up the realm owner
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_entity_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Set the contract address to the realm owner to create the explorer
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_entity_id, explorer_coord);

        // Create a quest tile next to the explorer
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Verify explorer is adjacent to quest
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.is_adjacent(quest_coord), "Explorer should be adjacent to quest tile");

        // Set the contract address to a DIFFERENT account (not the realm owner)
        let different_owner = starknet::contract_address_const::<'different_owner'>();
        starknet::testing::set_contract_address(different_owner);

        // Attempt to start quest with a different owner - should fail with "Not Owner" error
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', different_owner);
    }

    #[test]
    #[should_panic(expected: ("Quest is at capacity for id: 1", 'ENTRYPOINT_FAILED'))]
    fn start_quest_at_capacity() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at specific location
        let quest_coord = Coord { alt: false, x: 80, y: 80 };

        // Set up game parameters
        let level = 1;
        let capacity = 2; // Set a small capacity to make testing easier
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create first realm and explorer
        let realm1_coord = Coord { alt: false, x: 79, y: 79 };
        let explorer1_coord = Coord { alt: false, x: 80, y: 79 }; // Adjacent to quest
        let realm1_owner = starknet::contract_address_const::<'realm_owner1'>();
        let realm1_id = tspawn_realm_with_resources(ref world, 1, realm1_owner, realm1_coord);

        // Create second realm and explorer
        let realm2_coord = Coord { alt: false, x: 81, y: 81 };
        let explorer2_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let realm2_owner = starknet::contract_address_const::<'realm_owner2'>();
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm2_owner, realm2_coord);

        // Create third realm and explorer (this will exceed capacity)
        let realm3_coord = Coord { alt: false, x: 78, y: 78 };
        let explorer3_coord = Coord { alt: false, x: 79, y: 80 }; // Adjacent to quest
        let realm3_owner = starknet::contract_address_const::<'realm_owner3'>();
        let realm3_id = tspawn_realm_with_resources(ref world, 3, realm3_owner, realm3_coord);

        // Set timestamp
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Spawn explorers
        starknet::testing::set_contract_address(realm1_owner);
        let explorer1_id = tspawn_explorer(ref world, realm1_id, explorer1_coord);

        starknet::testing::set_contract_address(realm2_owner);
        let explorer2_id = tspawn_explorer(ref world, realm2_id, explorer2_coord);

        starknet::testing::set_contract_address(realm3_owner);
        let explorer3_id = tspawn_explorer(ref world, realm3_id, explorer3_coord);

        // Verify explorers are adjacent to quest
        let explorer1: ExplorerTroops = world.read_model(explorer1_id);
        assert!(explorer1.coord.is_adjacent(quest_coord), "Explorer1 is not adjacent to quest tile");

        let explorer2: ExplorerTroops = world.read_model(explorer2_id);
        assert!(explorer2.coord.is_adjacent(quest_coord), "Explorer2 is not adjacent to quest tile");

        let explorer3: ExplorerTroops = world.read_model(explorer3_id);
        assert!(explorer3.coord.is_adjacent(quest_coord), "Explorer3 is not adjacent to quest tile");

        // Get quest system
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quests until capacity is reached
        starknet::testing::set_contract_address(realm1_owner);
        quest_system.start_quest(*quest_tile.id, explorer1_id, 'player1', realm1_owner);

        starknet::testing::set_contract_address(realm2_owner);
        quest_system.start_quest(*quest_tile.id, explorer2_id, 'player2', realm2_owner);

        // Verify quest is at capacity
        let quest_tile: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile.participant_count == quest_tile.capacity, "Quest should be at capacity");

        // Attempt to start quest again - should fail with 'Quest is at capacity'
        starknet::testing::set_contract_address(realm3_owner);
        quest_system.start_quest(quest_tile.id, explorer3_id, 'player3', realm3_owner);
    }

    #[test]
    #[should_panic(expected: ("Realm or Village has already attempted this quest", 'ENTRYPOINT_FAILED'))]
    fn start_quest_twice_from_realm_different_explorers() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at specific location
        let quest_coord = Coord { alt: false, x: 80, y: 80 };

        // Set up game parameters
        let level = 1;
        let capacity = 10; // Plenty of capacity for this test
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm with a single owner
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Set timestamp
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);
        starknet::testing::set_contract_address(realm_owner);

        // Create two explorers from the same realm, positioned adjacent to the quest
        let explorer1_coord = Coord { alt: false, x: 80, y: 79 }; // Adjacent to quest
        let explorer1_id = tspawn_explorer(ref world, realm_id, explorer1_coord);

        let explorer2_coord = Coord { alt: false, x: 79, y: 80 }; // Also adjacent to quest
        let explorer2_id = tspawn_explorer(ref world, realm_id, explorer2_coord);

        // Verify both explorers are adjacent to quest
        let explorer1: ExplorerTroops = world.read_model(explorer1_id);
        assert!(explorer1.coord.is_adjacent(quest_coord), "Explorer1 is not adjacent to quest tile");

        let explorer2: ExplorerTroops = world.read_model(explorer2_id);
        assert!(explorer2.coord.is_adjacent(quest_coord), "Explorer2 is not adjacent to quest tile");

        // Get quest system
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with first explorer
        quest_system.start_quest(*quest_tile.id, explorer1_id, 'player1', realm_owner);

        // Verify quest was started
        let quest_tile: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile.participant_count == 1, "Quest should have 1 participant");

        // Try to start the same quest with a different explorer from the same realm
        // This should fail with "Realm or Village has already attempted this quest"
        quest_system.start_quest(quest_tile.id, explorer2_id, 'player2', realm_owner);
    }

    // tests trying to start a quest with the same explorer twice
    #[test]
    #[should_panic(expected: ("Realm or Village has already attempted this quest", 'ENTRYPOINT_FAILED'))]
    fn start_quest_twice_same_explorer() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at specific location
        let quest_coord = Coord { alt: false, x: 80, y: 80 };

        // Set up game parameters
        let level = 1;
        let capacity = 10; // Plenty of capacity for this test
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Set timestamp
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);
        starknet::testing::set_contract_address(realm_owner);

        // Create an explorer positioned adjacent to the quest
        let explorer_coord = Coord { alt: false, x: 80, y: 79 }; // Adjacent to quest
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Verify explorer is adjacent to quest
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.is_adjacent(quest_coord), "Explorer is not adjacent to quest tile");

        // Get quest system
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with the explorer
        quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify quest was started
        let quest_tile: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile.participant_count == 1, "Quest should have 1 participant");

        // Try to start the same quest with the same explorer a second time
        // This should fail with "Realm or Village has already attempted this quest" since the
        // explorer belongs to the same realm
        quest_system.start_quest(quest_tile.id, explorer_id, 'player1', realm_owner);
    }

    #[test]
    #[should_panic(expected: ("Quest tile not found for id: 999999", 'ENTRYPOINT_FAILED'))]
    fn start_quest_non_existent_tile() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm and explorer
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Get quest system and attempt to start quest with non-existent quest details id
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.start_quest(999999, explorer_id, 'player1', realm_owner); // Non-existent quest id
    }

    #[test]
    fn start_quest_check_game_token_minting() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify token was minted to correct address
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let token_owner = erc721_dispatcher.owner_of(game_token_id.into());
        assert!(token_owner == realm_owner, "Token not minted to correct address");

        // verify quest details are correct
        let quest_details = quest_system.get_quest_details(game_token_id, game_mock_addr);
        assert!(quest_details.quest_tile_id == *quest_tile.id, "Quest tile ID mismatch");
        assert!(quest_details.game_address == game_mock_addr, "Game address mismatch");
        assert!(quest_details.coord == quest_coord, "Quest coordinate mismatch");
        assert!(
            quest_details.target_score == 200,
            "Target score mismatch. Expected: 200, Actual: {}",
            quest_details.target_score,
        );
    }

    #[test]
    fn start_quest_check_time_limit() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create custom quest game with time limit
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Create custom game with specific time limit
        let time_limit = 3600; // 1 hour
        let custom_level = Level { target_score: 100, settings_id: 0, time_limit: time_limit };
        let custom_levels = array![custom_level].span();

        // overwrite the stock game with a custom one
        quest_systems.add_game(game_mock_addr, custom_levels, true);

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Set current block timestamp
        let current_time = 1000;
        starknet::testing::set_block_timestamp(current_time);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile with the custom game
        let level = 0; // First level
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let game_token_id = quest_systems.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Get the game token metadata to verify expiration
        let token_metadata: TokenMetadata = world.read_model(game_token_id);
        let expected_expiration = current_time + time_limit;
        match token_metadata.lifecycle.end {
            Option::Some(end) => assert!(
                end == expected_expiration,
                "Game token expiration not set correctly. Expected: {}, Actual: {}",
                expected_expiration,
                end,
            ),
            Option::None => assert!(
                false, "Game token expiration not set correctly. Expected: {}, Actual: None", expected_expiration,
            ),
        }
    }

    #[test]
    fn start_quest_check_participant_count() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Verify initial participant count
        let initial_details: QuestTile = world.read_model(*quest_tile.id);
        assert!(initial_details.participant_count == 0, "Initial participant count should be 0");

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify participant count incremented
        let updated_details: QuestTile = world.read_model(*quest_tile.id);
        assert!(updated_details.participant_count == 1, "Participant count should increment to 1");
    }

    #[test]
    fn start_quest_check_return_value() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 };
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify returned quest ID matches expected value
        assert!(game_token_id > 0, "Game token ID should be non-zero");

        // Also verify we can retrieve the quest with this ID
        let quest_details = quest_system.get_quest_details(game_token_id, game_mock_addr);
        assert!(quest_details.quest_tile_id == *quest_tile.id, "Quest tile ID mismatch");
        assert!(quest_details.game_address == game_mock_addr, "Game address mismatch");
        assert!(quest_details.coord == quest_coord, "Quest coordinate mismatch");
        assert!(
            quest_details.target_score == 200,
            "Target score mismatch. Expected: 200, Actual: {}",
            quest_details.target_score,
        );
    }

    #[test]
    #[should_panic(
        expected: (
            "Quest for game token id 1 is not completed. Target score: 200, Current score: 199", 'ENTRYPOINT_FAILED',
        ),
    )]
    fn claim_reward_score_too_low() {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        init_config(ref world);

        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: realm_coord.x + 1, y: realm_coord.y };
        let quest_coord = Coord { alt: false, x: realm_coord.x + 2, y: realm_coord.y };

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let realm_entity_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);
        starknet::testing::set_contract_address(realm_owner);

        let explorer_id = tspawn_explorer(ref world, realm_entity_id, explorer_coord);

        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.is_adjacent(quest_coord), "Explorer is not adjacent to the quest tile");

        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        let quest_levels: QuestLevels = world.read_model(*quest_tile.game_address);
        let one_below_target_score = *quest_levels.levels.at(level.into()).target_score - 1;
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, one_below_target_score);

        // attempt to claim reward with too low of score - this should fail
        quest_system.claim_reward(game_token_id, game_mock_addr);
    }

    #[test]
    #[should_panic(expected: ("Explorer is not adjacent to quest tile", 'ENTRYPOINT_FAILED'))]
    fn claim_reward_explorer_not_adjacent() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest initially
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Complete quest with sufficient score
        let quest_levels: QuestLevels = world.read_model(*quest_tile.game_address);
        let target_score = *quest_levels.levels.at(level.into()).target_score;
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, target_score);

        // Move explorer away from quest tile (no longer adjacent)
        let mut explorer: ExplorerTroops = world.read_model(explorer_id);
        explorer.coord = Coord { alt: false, x: 78, y: 78 }; // Not adjacent to quest
        world.write_model_test(@explorer);

        // Verify explorer is no longer adjacent
        let updated_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(!updated_explorer.coord.is_adjacent(quest_coord), "Explorer should not be adjacent to quest tile");

        // Attempt to claim reward - should fail because explorer is not adjacent
        quest_system.claim_reward(game_token_id, game_mock_addr);
    }

    #[test]
    #[should_panic(
        expected: (
            "Quest for game token id 1 is not completed. Target score: 200, Current score: 100", 'ENTRYPOINT_FAILED',
        ),
    )]
    fn claim_reward_score_verification() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile for level 1 (which requires 200 points based on test data)
        let level = 1; // Level 1 has 200 target score in test data
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // End game with INSUFFICIENT score (only 100 points, but 200 required)
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, 100); // Level 1 requires 200

        // Attempt to claim reward - should fail due to insufficient score
        quest_system.claim_reward(game_token_id, game_mock_addr);
    }

    #[test]
    fn claim_reward_quest_completion() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify quest is not completed initially
        let quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(!quest.completed, "Quest should not be completed initially");

        // Complete quest with sufficient score
        let quest_levels: QuestLevels = world.read_model(*quest_tile.game_address);
        let target_score = *quest_levels.levels.at(level.into()).target_score;
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, target_score);

        // Claim reward
        quest_system.claim_reward(game_token_id, game_mock_addr);

        // Verify quest is marked as completed
        let updated_quest: Quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(updated_quest.completed, "Quest should be marked as completed after claiming reward");
    }

    #[test]
    fn quest_tile_data_retrieval() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile with specific parameters
        let level = 1_u8; // Level 1 has 200 target score in mock data
        let capacity = 10_u16;
        let resource_type = ResourceTypes::WHEAT;
        let expected_target_score = 200_u32; // from test data

        let quest_tile_id = world.dispatcher.uuid();
        let expected_reward = MOCK_MAP_CONFIG().reward_resource_amount.into()
            * QUEST_REWARD_BASE_MULTIPLIER.into()
            * (level.into() + 1)
            * RESOURCE_PRECISION;

        let quest_tile = @QuestTile {
            id: quest_tile_id,
            coord: quest_coord,
            game_address: game_mock_addr,
            level,
            resource_type,
            amount: expected_reward,
            capacity,
            participant_count: 0,
        };
        world.write_model_test(quest_tile);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // --- Test get_quest_tile ---
        let retrieved_quest_tile = quest_system.get_quest_tile(*quest_tile.id);
        assert!(retrieved_quest_tile.id == quest_tile_id, "Quest tile ID mismatch");
        assert!(retrieved_quest_tile.coord.x == quest_coord.x, "Quest tile x coordinate mismatch");
        assert!(retrieved_quest_tile.coord.y == quest_coord.y, "Quest tile y coordinate mismatch");
        assert!(retrieved_quest_tile.game_address == game_mock_addr, "Game address mismatch");
        assert!(retrieved_quest_tile.level == level, "Level mismatch");
        assert!(retrieved_quest_tile.resource_type == resource_type, "Resource type mismatch");
        assert!(retrieved_quest_tile.amount == expected_reward, "Reward amount mismatch");
        assert!(retrieved_quest_tile.capacity == capacity, "Capacity mismatch");
        assert!(
            retrieved_quest_tile.participant_count == 1, "Participant count mismatch",
        ); // Should be 1 after starting quest

        // --- Test get_quest (before completion) ---
        let retrieved_quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(retrieved_quest.game_token_id == game_token_id, "Game token ID mismatch");
        assert!(retrieved_quest.game_address == game_mock_addr, "Game address mismatch");
        assert!(retrieved_quest.quest_tile_id == quest_tile_id, "Quest tile ID mismatch");
        assert!(retrieved_quest.explorer_id == explorer_id, "Explorer ID mismatch");
        assert!(!retrieved_quest.completed, "Quest should not be completed initially");

        // --- Test get_quest_details ---
        let retrieved_details = quest_system.get_quest_details(game_token_id, game_mock_addr);
        let expected_resource_name = crate::constants::resource_type_name(resource_type);
        assert!(retrieved_details.quest_tile_id == quest_tile_id, "Details: Quest tile ID mismatch");
        assert!(retrieved_details.game_address == game_mock_addr, "Details: Game address mismatch");
        assert!(retrieved_details.coord == quest_coord, "Details: Coordinate mismatch");
        assert!(
            retrieved_details.target_score == expected_target_score,
            "Details: Target score mismatch. Expected: {}, Got: {}",
            expected_target_score,
            retrieved_details.target_score,
        );
        assert!(
            retrieved_details.reward_name == expected_resource_name,
            "Details: Reward name mismatch. Expected: {:?}, Got: {:?}",
            expected_resource_name,
            retrieved_details.reward_name,
        );
        assert!(retrieved_details.reward_amount == expected_reward, "Details: Reward amount mismatch");

        // --- Test get_target_score ---
        let retrieved_target_score = quest_system.get_target_score(game_token_id, game_mock_addr);
        assert!(
            retrieved_target_score == expected_target_score,
            "Target score mismatch. Expected: {}, Got: {}",
            expected_target_score,
            retrieved_target_score,
        );

        // Complete quest and check that completed status is updated
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, expected_target_score); // Use the retrieved target score
        quest_system.claim_reward(game_token_id, game_mock_addr);

        // --- Test get_quest (after completion) ---
        let updated_quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(updated_quest.completed, "Quest should be marked as completed after claiming reward");
    }

    #[test]
    fn remove_game_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data - create a game address
        let game_address = starknet::contract_address_const::<'game_to_remove'>();

        // Manually add an entry to the registry without adding levels
        // This works around the bug in the implementation that checks levels.len() == 0
        let registry: QuestGameRegistry = world.read_model(VERSION);
        let mut games_array: Array<ContractAddress> = registry.games.into();
        games_array.append(game_address);
        let updated_registry = QuestGameRegistry { key: VERSION, games: games_array.span() };
        world.write_model_test(@updated_registry);

        // Write an empty QuestLevels for this game address to pass the check in remove_game
        let empty_levels = array![].span();
        let quest_levels = QuestLevels { game_address: game_address, levels: empty_levels };
        world.write_model_test(@quest_levels);

        // Get the current registry state after our manual modification
        let registry_before: QuestGameRegistry = world.read_model(VERSION);
        let game_count_before = registry_before.games.len();

        // Verify game was added to the registry
        let mut found = false;
        let mut i = 0;
        while i < game_count_before {
            if *registry_before.games.at(i) == game_address {
                found = true;
                break;
            }
            i += 1;
        }

        assert!(found, "Game should be in registry before removal");

        // Remove the game as owner (should succeed)
        quest_systems.remove_game(game_address);

        // Verify game was removed
        let registry_after: QuestGameRegistry = world.read_model(VERSION);
        assert!(registry_after.games.len() == game_count_before - 1, "Game count should decrease by 1");

        // Verify the specific game is no longer in the registry
        let mut found_after = false;
        let mut j = 0;
        while j < registry_after.games.len() {
            if *registry_after.games.at(j) == game_address {
                found_after = true;
                break;
            }
            j += 1;
        }
        assert!(!found_after, "Game should not be in registry after removal");
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn remove_game_not_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data - create a game address
        let game_address = starknet::contract_address_const::<'game_to_remove'>();

        // Manually add entry to the registry
        let registry: QuestGameRegistry = world.read_model(VERSION);
        let mut games_array: Array<ContractAddress> = registry.games.into();
        games_array.append(game_address);
        let updated_registry = QuestGameRegistry { key: VERSION, games: games_array.span() };
        world.write_model_test(@updated_registry);

        // Write empty QuestLevels for this game address
        let empty_levels = array![].span();
        let quest_levels = QuestLevels { game_address: game_address, levels: empty_levels };
        world.write_model_test(@quest_levels);

        // Set caller to non-owner
        let non_owner = starknet::contract_address_const::<'non_owner'>();
        starknet::testing::set_contract_address(non_owner);

        // Attempt to remove game - should fail as caller is not system owner
        quest_systems.remove_game(game_address);
    }

    #[test]
    #[should_panic(expected: ("Game is not in registry", 'ENTRYPOINT_FAILED'))]
    fn remove_game_nonexistent() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Create a mock game address that we know doesn't exist in the registry
        let nonexistent_game_address = starknet::contract_address_const::<'nonexistent_game'>();

        // Write a QuestLevels model with empty levels to simulate a game not in registry
        // Note: This seems backwards, but the actual implementation checks levels.len() == 0
        let empty_levels = array![].span();
        let quest_levels = QuestLevels { game_address: nonexistent_game_address, levels: empty_levels };
        world.write_model_test(@quest_levels);

        // Attempt to remove this "non-existent" game - should fail with "Game is not in registry"
        quest_systems.remove_game(nonexistent_game_address);
    }

    #[test]
    fn remove_game_multiple_games() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data - create multiple game addresses
        let game_address1 = starknet::contract_address_const::<'game1'>();
        let game_address2 = starknet::contract_address_const::<'game2'>();
        let game_address3 = starknet::contract_address_const::<'game3'>();

        // Manually add entries to the registry
        let registry: QuestGameRegistry = world.read_model(VERSION);
        let mut games_array: Array<ContractAddress> = registry.games.into();
        games_array.append(game_address1);
        games_array.append(game_address2);
        games_array.append(game_address3);
        let updated_registry = QuestGameRegistry { key: VERSION, games: games_array.span() };
        world.write_model_test(@updated_registry);

        // Write empty QuestLevels for each game address
        let empty_levels = array![].span();

        let quest_levels1 = QuestLevels { game_address: game_address1, levels: empty_levels };
        world.write_model_test(@quest_levels1);

        let quest_levels2 = QuestLevels { game_address: game_address2, levels: empty_levels };
        world.write_model_test(@quest_levels2);

        let quest_levels3 = QuestLevels { game_address: game_address3, levels: empty_levels };
        world.write_model_test(@quest_levels3);

        // Get the current registry state
        let registry_before: QuestGameRegistry = world.read_model(VERSION);
        let game_count_before = registry_before.games.len();

        // Remove the middle game
        quest_systems.remove_game(game_address2);

        // Verify game count decreased
        let registry_after: QuestGameRegistry = world.read_model(VERSION);
        assert!(registry_after.games.len() == game_count_before - 1, "Game count should decrease by 1");

        // Verify game2 is removed but game1 and game3 remain
        let mut found_game1 = false;
        let mut found_game2 = false;
        let mut found_game3 = false;

        let mut i = 0;
        while i < registry_after.games.len() {
            let addr = *registry_after.games.at(i);
            if addr == game_address1 {
                found_game1 = true;
            } else if addr == game_address2 {
                found_game2 = true;
            } else if addr == game_address3 {
                found_game3 = true;
            }
            i += 1;
        }

        assert!(found_game1, "Game1 should still be in registry");
        assert!(!found_game2, "Game2 should be removed from registry");
        assert!(found_game3, "Game3 should still be in registry");
    }

    #[test]
    fn remove_game_first_and_last() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set up test data - create multiple game addresses
        let game_address1 = starknet::contract_address_const::<'game1'>();
        let game_address2 = starknet::contract_address_const::<'game2'>();
        let game_address3 = starknet::contract_address_const::<'game3'>();

        // Manually add entries to the registry
        let registry: QuestGameRegistry = world.read_model(VERSION);
        let mut games_array: Array<ContractAddress> = registry.games.into();
        games_array.append(game_address1);
        games_array.append(game_address2);
        games_array.append(game_address3);
        let updated_registry = QuestGameRegistry { key: VERSION, games: games_array.span() };
        world.write_model_test(@updated_registry);

        // Write empty QuestLevels for each game address
        let empty_levels = array![].span();

        let quest_levels1 = QuestLevels { game_address: game_address1, levels: empty_levels };
        world.write_model_test(@quest_levels1);

        let quest_levels2 = QuestLevels { game_address: game_address2, levels: empty_levels };
        world.write_model_test(@quest_levels2);

        let quest_levels3 = QuestLevels { game_address: game_address3, levels: empty_levels };
        world.write_model_test(@quest_levels3);

        // Get initial registry state
        let registry_initial: QuestGameRegistry = world.read_model(VERSION);
        let game_count_initial = registry_initial.games.len();

        // Remove first game
        quest_systems.remove_game(game_address1);

        // Verify game count and contents
        let registry_after_first: QuestGameRegistry = world.read_model(VERSION);
        assert!(registry_after_first.games.len() == game_count_initial - 1, "Game count should decrease by 1");

        // Verify first element is no longer game1
        assert!(*registry_after_first.games.at(0) != game_address1, "First game should be removed");

        // Remove last game
        quest_systems.remove_game(game_address3);

        // Verify final state
        let registry_final: QuestGameRegistry = world.read_model(VERSION);
        assert!(registry_final.games.len() == game_count_initial - 2, "Game count should decrease by 2");

        assert!(registry_final.games.len() == 2, "Only two games should remain");
        assert!(*registry_final.games.at(1) == game_address2, "Game2 should be the second game");
    }

    #[test]
    fn remove_game_empty_registry() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Get current registry
        let current_registry: QuestGameRegistry = world.read_model(VERSION);
        let games = current_registry.games;
        let games_count = games.len();

        if games_count > 0 {
            // For each game in the registry, ensure it has empty levels for removal
            let mut i = 0;
            while i < games_count {
                let game_address = *games.at(i);

                // Write empty QuestLevels for this game to allow removal
                let empty_levels = array![].span();
                let quest_levels = QuestLevels { game_address: game_address, levels: empty_levels };
                world.write_model_test(@quest_levels);

                i += 1;
            }

            // Remove all games from registry
            let mut j = 0;
            while j < games_count {
                let game_address = *games.at(j);
                quest_systems.remove_game(game_address);
                j += 1;
            }
        }

        // Verify registry is empty
        let empty_registry: QuestGameRegistry = world.read_model(VERSION);
        assert!(empty_registry.games.len() == 0, "Registry should be empty");
    }

    #[test]
    fn quests_default_enabled() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Verify quests are disabled by default
        assert!(quest_systems.is_quest_feature_enabled(), "Quests should be enabled initially");
    }

    #[test]
    #[should_panic(expected: ("Quest feature is already enabled", 'ENTRYPOINT_FAILED'))]
    fn enable_quests_already_enabled() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Enable quests - should panic as quests is already enabled by default
        quest_systems.enable_quests();
    }

    #[test]
    fn disable_quests_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Disable quests as owner (should succeed)
        quest_systems.disable_quests();

        // Verify quests are now disabled
        assert!(!quest_systems.is_quest_feature_enabled(), "Quests should be disabled after call");
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn disable_quests_not_authorized() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Set caller to non-owner
        let non_owner = starknet::contract_address_const::<'non_owner'>();
        starknet::testing::set_contract_address(non_owner);

        // Attempt to disable quests - should fail
        quest_systems.disable_quests();
    }

    #[test]
    #[should_panic(expected: ("Quest feature is already disabled", 'ENTRYPOINT_FAILED'))]
    fn disable_quests_already_disabled() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // disable quests
        quest_systems.disable_quests();

        // disable quests again - should panic as quests are already disabled
        quest_systems.disable_quests();
    }

    fn toggle_quests_off_on_off() {
        // Spawn test world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Set necessary configurations
        init_config(ref world);

        // Get quest systems address
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // verify initial state is enabled
        assert!(quest_systems.is_quest_feature_enabled(), "Quests should be enabled initially");

        // disable quests
        quest_systems.disable_quests();
        assert!(!quest_systems.is_quest_feature_enabled(), "Quests should be disabled");

        // enable quests
        quest_systems.enable_quests();
        assert!(quest_systems.is_quest_feature_enabled(), "Quests should be enabled");

        // disable quests again
        quest_systems.disable_quests();
        assert!(!quest_systems.is_quest_feature_enabled(), "Quests should be disabled");
    }

    #[test]
    #[should_panic(expected: ("Quest feature is disabled", 'ENTRYPOINT_FAILED'))]
    fn start_quest_with_feature_disabled() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest tile
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::get_caller_address();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Verify explorer is adjacent
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.is_adjacent(quest_coord), "Explorer should be adjacent");

        // Get quest system dispatcher
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Disable the quest feature
        quest_system.disable_quests();

        // Verify feature is disabled
        let feature_toggle = quest_system.is_quest_feature_enabled();
        assert!(!feature_toggle, "Quest feature should be disabled");

        // Attempt to start quest - should fail
        quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);
    }

    #[test]
    #[should_panic(expected: ("Quest feature is disabled", 'ENTRYPOINT_FAILED'))]
    fn claim_reward_quests_disabled() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);
        let deployer_address = starknet::get_caller_address();

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create realm, explorer, and quest
        let realm_coord = Coord { alt: false, x: 80, y: 80 };
        let explorer_coord = Coord { alt: false, x: 81, y: 80 }; // Adjacent to quest
        let quest_coord = Coord { alt: false, x: 82, y: 80 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(realm_owner);
        let explorer_id = tspawn_explorer(ref world, realm_id, explorer_coord);

        // Create quest tile
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Start quest
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let game_token_id = quest_system.start_quest(*quest_tile.id, explorer_id, 'player1', realm_owner);

        // Verify quest is not completed initially
        let quest: Quest = quest_system.get_quest(game_token_id, game_mock_addr);
        assert!(!quest.completed, "Quest should not be completed initially");

        // Complete quest with sufficient score
        let quest_levels: QuestLevels = world.read_model(*quest_tile.game_address);
        let target_score = *quest_levels.levels.at(level.into()).target_score;
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(game_token_id, target_score);

        // change to deployer address
        starknet::testing::set_contract_address(deployer_address);

        // disable quest feature
        quest_system.disable_quests();

        // change to player address
        starknet::testing::set_contract_address(realm_owner);

        // attempt to claim reward - should panic because quests are disabled
        quest_system.claim_reward(game_token_id, game_mock_addr);
    }

    #[test]
    fn create_quest_basic() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        let (troop_movement_util_addr, _) = world.dns(@"troop_movement_util_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Create an unoccupied tile
        let coord = Coord { alt: false, x: 10, y: 10 };
        let mut tile = Tile {
            col: coord.x,
            row: coord.y,
            biome: Biome::None.into(),
            occupier_type: TileOccupier::None.into(),
            occupier_id: 0,
            occupier_is_structure: false,
        };
        world.write_model_test(@tile);

        // Set caller to authorized contract
        starknet::testing::set_contract_address(troop_movement_util_addr);

        // VRF Seed
        let vrf_seed = 12345_u256;

        // Call create_quest
        quest_system.create_quest(tile, vrf_seed);

        // Assertions
        // 1. Tile is now occupied by a Quest
        let updated_tile: Tile = world.read_model((coord.x, coord.y));
        assert!(updated_tile.occupier_type == TileOccupier::Quest.into(), "Tile should be occupied by Quest");
        assert!(updated_tile.occupier_id != 0, "Occupier ID should be set");
        assert!(
            updated_tile.occupier_is_structure == true, "Occupier should be structure",
        ); // Internal iQuestDiscoveryImpl sets this
        assert!(
            updated_tile.biome != Biome::None.into(), "Biome should be explored",
        ); // Internal iQuestDiscoveryImpl explores

        // 2. QuestTile model exists for the occupier_id
        let quest_tile: QuestTile = world.read_model(updated_tile.occupier_id);
        assert!(quest_tile.id == updated_tile.occupier_id, "QuestTile ID mismatch");
        assert!(quest_tile.coord == coord, "QuestTile coord mismatch");
        assert!(quest_tile.game_address.is_non_zero(), "QuestTile game address should be set");
        assert!(quest_tile.resource_type > 0, "QuestTile resource type should be set");
        assert!(quest_tile.amount > 0, "QuestTile amount should be set");
        assert!(quest_tile.capacity > 0, "QuestTile capacity should be set");
        assert!(quest_tile.participant_count == 0, "QuestTile participant count should be set");
    }

    #[test]
    #[should_panic(expected: ("caller must be the troop movement util systems", 'ENTRYPOINT_FAILED'))]
    fn create_quest_unauthorized_caller() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Create an unoccupied tile
        let coord = Coord { alt: false, x: 10, y: 10 };
        let tile = Tile {
            col: coord.x,
            row: coord.y,
            biome: Biome::None.into(),
            occupier_type: TileOccupier::None.into(),
            occupier_id: 0,
            occupier_is_structure: false,
        };
        world.write_model_test(@tile);

        // Set caller to an unauthorized address
        let unauthorized_caller = starknet::contract_address_const::<'unauthorized'>();
        starknet::testing::set_contract_address(unauthorized_caller);

        // VRF Seed
        let vrf_seed = 12345_u256;

        // Call create_quest - should panic
        quest_system.create_quest(tile, vrf_seed);
    }

    #[test]
    #[should_panic(expected: ("Quest feature is disabled", 'ENTRYPOINT_FAILED'))]
    fn create_quest_feature_disabled() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        let (troop_movement_util_addr, _) = world.dns(@"troop_movement_util_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let deployer_address = starknet::get_caller_address(); // Assuming deployer can disable

        // Create an unoccupied tile
        let coord = Coord { alt: false, x: 10, y: 10 };
        let tile = Tile {
            col: coord.x,
            row: coord.y,
            biome: Biome::None.into(),
            occupier_type: TileOccupier::None.into(),
            occupier_id: 0,
            occupier_is_structure: false,
        };
        world.write_model_test(@tile);

        // Disable the feature (as deployer/owner)
        starknet::testing::set_contract_address(deployer_address);
        quest_system.disable_quests();
        assert!(!quest_system.is_quest_feature_enabled(), "Feature should be disabled");

        // Set caller back to authorized contract
        starknet::testing::set_contract_address(troop_movement_util_addr);

        // VRF Seed
        let vrf_seed = 12345_u256;

        // Call create_quest - should panic
        quest_system.create_quest(tile, vrf_seed);
    }

    #[test]
    #[should_panic(expected: ("Can't create quest on occupied tile",))]
    fn internal_create_quest_occupied_tile() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Create an already occupied tile
        let coord = Coord { alt: false, x: 10, y: 10 };
        let mut tile = Tile {
            col: coord.x,
            row: coord.y,
            biome: Biome::Ocean.into(),
            occupier_type: TileOccupier::RealmRegularLevel1.into(),
            occupier_id: 99,
            occupier_is_structure: true,
        };
        world.write_model_test(@tile);

        // VRF Seed
        let vrf_seed = 12345_u256;

        // Call internal create directly (simulating call from create_quest)
        iQuestDiscoveryImpl::create(ref world, ref tile, vrf_seed);
    }

    #[test]
    fn internal_create_quest_success() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Create a tile with Biome::None
        let coord = Coord { alt: false, x: 10, y: 10 };
        let mut tile = Tile {
            col: coord.x,
            row: coord.y,
            biome: Biome::None.into(),
            occupier_type: TileOccupier::None.into(),
            occupier_id: 0,
            occupier_is_structure: false,
        };
        world.write_model_test(@tile);

        // VRF Seed
        let vrf_seed = 12345_u256;

        // Call internal create
        iQuestDiscoveryImpl::create(ref world, ref tile, vrf_seed);

        // Verify updated Tile model
        let updated_tile: Tile = world.read_model((coord.x, coord.y));
        assert!(updated_tile.biome != Biome::None.into(), "Biome should have been explored");
        assert!(updated_tile.occupier_type == TileOccupier::Quest.into(), "Tile should be occupied by Quest");
        assert!(
            updated_tile.occupier_is_structure == true, "Occupier should be structure",
        ); // Internal iQuestDiscoveryImpl sets this

        // Verify QuestTile was created with correct values
        let quest_tile: QuestTile = world.read_model(updated_tile.occupier_id);
        assert!(quest_tile.id == updated_tile.occupier_id, "QuestTile ID mismatch");
        assert!(quest_tile.coord == coord, "QuestTile coord mismatch");
        assert!(quest_tile.game_address.is_non_zero(), "QuestTile game address should be set");
        assert!(quest_tile.resource_type > 0, "QuestTile resource type should be set");
        assert!(quest_tile.amount > 0, "QuestTile amount should be set");
        assert!(quest_tile.capacity >= MINIMUM_QUEST_CAPACITY, "QuestTile capacity should be above minimum");
        assert!(quest_tile.capacity <= MAXIMUM_QUEST_CAPACITY, "QuestTile capacity should be below maximum");
        assert!(quest_tile.participant_count == 0, "QuestTile participant count should be set");
    }

    #[test]
    fn test_start_quest_realm_then_village_success() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at specific location
        let quest_coord = Coord { alt: false, x: 80, y: 80 };
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Create village associated with the realm
        let village_coord = Coord { alt: false, x: 78, y: 78 };
        let village_owner = starknet::contract_address_const::<
            'village_owner',
        >(); // Use same owner for simplicity, could be different
        let village_id = tspawn_village(ref world, realm_id, village_owner, village_coord);

        // Set timestamp
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Create explorer for the realm
        let realm_explorer_coord = Coord { alt: false, x: 80, y: 79 }; // Adjacent to quest
        starknet::testing::set_contract_address(realm_owner);
        let realm_explorer_id = tspawn_explorer(ref world, realm_id, realm_explorer_coord);

        // Create explorer for the village
        let village_explorer_coord = Coord { alt: false, x: 79, y: 80 }; // Adjacent to quest
        starknet::testing::set_contract_address(village_owner);
        let village_explorer_id = tspawn_village_explorer(ref world, village_id, village_explorer_coord);

        // Get quest system
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with realm explorer
        starknet::testing::set_contract_address(realm_owner);
        let realm_game_token_id = quest_system
            .start_quest(*quest_tile.id, realm_explorer_id, 'realm_player', realm_owner);
        assert!(realm_game_token_id > 0, "Realm failed to start quest");

        // Verify participant count incremented
        let quest_tile_after_realm: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_realm.participant_count == 1, "Participant count should be 1 after realm");

        // Start quest with village explorer (should succeed)
        starknet::testing::set_contract_address(village_owner);
        let village_game_token_id = quest_system
            .start_quest(*quest_tile.id, village_explorer_id, 'village_player', village_owner);
        assert!(village_game_token_id > 0, "Village failed to start quest after realm");
        assert!(village_game_token_id != realm_game_token_id, "Village and realm tokens should be different");

        // Verify participant count incremented again
        let quest_tile_after_village: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_village.participant_count == 2, "Participant count should be 2 after village");
    }

    #[test]
    fn test_start_quest_village_then_realm_success() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest
        let quest_coord = Coord { alt: false, x: 80, y: 80 };
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm and village
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let village_coord = Coord { alt: false, x: 78, y: 78 };
        let village_owner = starknet::contract_address_const::<'village_owner'>();
        let village_id = tspawn_village(ref world, realm_id, village_owner, village_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);

        // Create explorers
        let realm_explorer_coord = Coord { alt: false, x: 80, y: 79 };
        starknet::testing::set_contract_address(realm_owner);
        let realm_explorer_id = tspawn_explorer(ref world, realm_id, realm_explorer_coord);
        let village_explorer_coord = Coord { alt: false, x: 79, y: 80 };
        starknet::testing::set_contract_address(village_owner);
        let village_explorer_id = tspawn_village_explorer(ref world, village_id, village_explorer_coord);

        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with village explorer first
        starknet::testing::set_contract_address(village_owner);
        let village_game_token_id = quest_system
            .start_quest(*quest_tile.id, village_explorer_id, 'village_player', village_owner);
        assert!(village_game_token_id > 0, "Village failed to start quest first");

        let quest_tile_after_village: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_village.participant_count == 1, "Participant count should be 1 after village");

        // Start quest with realm explorer (should succeed)
        starknet::testing::set_contract_address(realm_owner);
        let realm_game_token_id = quest_system
            .start_quest(*quest_tile.id, realm_explorer_id, 'realm_player', realm_owner);
        assert!(realm_game_token_id > 0, "Realm failed to start quest after village");
        assert!(realm_game_token_id != village_game_token_id, "Realm and village tokens should be different");

        let quest_tile_after_realm: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_realm.participant_count == 2, "Participant count should be 2 after realm");
    }

    #[test]
    fn test_start_quest_two_villages_success() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest
        let quest_coord = Coord { alt: false, x: 80, y: 80 };
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Create village 1
        let village1_coord = Coord { alt: false, x: 78, y: 78 };
        let village1_owner = starknet::contract_address_const::<'village_owner1'>();
        let village1_id = tspawn_village(ref world, realm_id, village1_owner, village1_coord);

        // Create village 2
        let village2_coord = Coord { alt: false, x: 77, y: 77 };
        let village2_owner = starknet::contract_address_const::<'village_owner2'>();
        let village2_id = tspawn_village(ref world, realm_id, village2_owner, village2_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);

        // Create explorer for village 1
        let village1_explorer_coord = Coord { alt: false, x: 80, y: 79 };
        starknet::testing::set_contract_address(village1_owner);
        let village1_explorer_id = tspawn_village_explorer(ref world, village1_id, village1_explorer_coord);

        // Create explorer for village 2
        let village2_explorer_coord = Coord { alt: false, x: 79, y: 80 };
        starknet::testing::set_contract_address(village2_owner);
        let village2_explorer_id = tspawn_village_explorer(ref world, village2_id, village2_explorer_coord);

        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with village 1 explorer
        starknet::testing::set_contract_address(village1_owner);
        let village1_game_token_id = quest_system
            .start_quest(*quest_tile.id, village1_explorer_id, 'village_player1', village1_owner);
        assert!(village1_game_token_id > 0, "Village 1 failed to start quest");

        let quest_tile_after_v1: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_v1.participant_count == 1, "Participant count should be 1 after village 1");

        // Start quest with village 2 explorer (should succeed)
        starknet::testing::set_contract_address(village2_owner);
        let village2_game_token_id = quest_system
            .start_quest(*quest_tile.id, village2_explorer_id, 'village_player2', village2_owner);
        assert!(village2_game_token_id > 0, "Village 2 failed to start quest after village 1");
        assert!(village2_game_token_id != village1_game_token_id, "Village 1 and 2 tokens should be different");

        let quest_tile_after_v2: QuestTile = world.read_model(*quest_tile.id);
        assert!(quest_tile_after_v2.participant_count == 2, "Participant count should be 2 after village 2");
    }

    #[test]
    #[should_panic(expected: ("Realm or Village has already attempted this quest", 'ENTRYPOINT_FAILED'))]
    fn test_start_quest_village_twice_different_explorers() {
        let mut world = tspawn_world(namespace_def(), contract_defs());
        init_config(ref world);

        // Initialize game mock
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest
        let quest_coord = Coord { alt: false, x: 80, y: 80 };
        let level = 1;
        let capacity = 10;
        let quest_tile = tspawn_quest_tile(ref world, game_mock_addr, level, capacity, quest_coord);

        // Create realm and village
        let realm_coord = Coord { alt: false, x: 79, y: 79 };
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let village_coord = Coord { alt: false, x: 78, y: 78 };
        let village_owner = starknet::contract_address_const::<'village_owner'>();
        let village_id = tspawn_village(ref world, realm_id, village_owner, village_coord);

        starknet::testing::set_block_timestamp(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        starknet::testing::set_contract_address(village_owner);

        // Create two explorers for the same village
        let explorer1_coord = Coord { alt: false, x: 80, y: 79 };
        let explorer1_id = tspawn_village_explorer(ref world, village_id, explorer1_coord);
        let explorer2_coord = Coord { alt: false, x: 79, y: 80 };
        let explorer2_id = tspawn_village_explorer(ref world, village_id, explorer2_coord);

        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };

        // Start quest with the first explorer
        quest_system.start_quest(*quest_tile.id, explorer1_id, 'village_player1', village_owner);

        // Attempt to start the same quest with the second explorer from the same village
        // This should fail.
        quest_system.start_quest(*quest_tile.id, explorer2_id, 'village_player2', village_owner);
    }
}
