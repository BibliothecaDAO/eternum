use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::models::config::{MapConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::Coord;
use s1_eternum::models::quest::{Quest, QuestDetails, QuestGame, QuestGameRegistry};
use s1_eternum::systems::quest::constants::{QUEST_REWARD_BASE_MULTIPLIER, VERSION};
use s1_eternum::systems::utils::map::IMapImpl;
use s1_eternum::systems::utils::troop::{iExplorerImpl};
use s1_eternum::utils::map::biomes::{Biome, get_biome};
use s1_eternum::utils::random;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IQuestSystems<T> {
    fn start_quest(
        ref self: T, details_id: u32, explorer_id: ID, player_name: felt252, to_address: ContractAddress,
    ) -> u32;
    fn claim_reward(ref self: T, quest_id: u32);
    fn get_quest_details(ref self: T, details_id: u32) -> QuestDetails;
    fn get_quest(ref self: T, quest_id: u32) -> Quest;
}


#[dojo::contract]
pub mod quest_systems {
    use core::array::ArrayTrait;
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::quest::{
        LevelConfig, Quest, QuestCounter, QuestDetails, QuestGame, QuestGameRegistry, RealmRegistrations,
    };
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{StructureMetadataStoreImpl, StructureOwnerStoreImpl};
    use s1_eternum::models::troop::ExplorerTroops;
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::quest::constants::{VERSION};
    use starknet::ContractAddress;
    use tournaments::components::interfaces::{
        IGameDetailsDispatcher, IGameDetailsDispatcherTrait, IGameTokenDispatcher, IGameTokenDispatcherTrait,
    };

    fn dojo_init(self: @ContractState, game_list: Span<QuestGame>) {
        let mut world = self.world(DEFAULT_NS());

        // TODO: Add validation
        // - Check that provided games exist and implement required src5 interfaces
        // - Check that settings_id is valid for each game

        // Now game_list is already the correct type, no need to deserialize here.
        let game_registry = QuestGameRegistry { key: VERSION, game_list };
        world.write_model(@game_registry);
    }


    #[abi(embed_v0)]
    pub impl QuestSystemsImpl of super::IQuestSystems<ContractState> {
        fn start_quest(
            ref self: ContractState,
            details_id: u32,
            explorer_id: ID,
            player_name: felt252,
            to_address: ContractAddress,
        ) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            let mut quest_details: QuestDetails = world.read_model(details_id);
            assert(quest_details.id > 0, 'Quest details not found');
            assert(quest_details.participant_count < quest_details.capacity, 'Quest is at capacity');

            let explorer: ExplorerTroops = world.read_model(explorer_id);
            assert(explorer.coord == quest_details.coord, 'Explorer is not on quest tile');

            // verify caller is owner of explorer
            StructureOwnerStoreImpl::retrieve(ref world, explorer.owner).assert_caller_owner();

            // Get the realm ID from the explorer's owner structure
            let structure_metadata = StructureMetadataStoreImpl::retrieve(ref world, explorer.owner);
            let realm_id = structure_metadata.realm_id;

            // Check if this realm already has a participant in this quest
            // This is now a simple model query instead of iteration
            let realm_participation: RealmRegistrations = world.read_model((details_id, realm_id));
            assert!(realm_participation.quest_id == 0, "Realm has already attempted this quest");

            let mut quest_counter: QuestCounter = world.read_model(VERSION);
            quest_counter.count += 1;
            world.write_model(@quest_counter);

            let game_index_id: u8 = quest_details.game_index_id;
            let game_registry: QuestGameRegistry = world.read_model(VERSION);

            let game: QuestGame = *game_registry.game_list.at(game_index_id.into());
            let config: LevelConfig = *game.levels.at(quest_details.level.into());

            // we don't currently use start delay but could be used as part of future, multi-player raid feature
            let game_start_delay: Option<u64> = Option::None;

            // use optional expiration if set on level config
            let game_expiration: Option<u64> = if config.time_limit > 0 {
                let current_time = starknet::get_block_timestamp();
                Option::Some(current_time + config.time_limit)
            } else {
                Option::None
            };

            let game_address: ContractAddress = game.game_address;
            let game_dispatcher = IGameTokenDispatcher { contract_address: game_address };
            let game_token_id: u64 = game_dispatcher
                .mint(player_name, config.settings_id, game_start_delay, game_expiration, to_address);

            let quest = Quest { id: quest_counter.count, details_id, explorer_id, game_token_id, completed: false };
            world.write_model(@quest);

            // increment participant count
            quest_details.participant_count += 1;
            world.write_model(@quest_details);

            // Record realm participation with this quest
            let realm_participation = RealmRegistrations { details_id, realm_id, quest_id: quest.id };
            world.write_model(@realm_participation);

            quest.id
        }

        fn claim_reward(ref self: ContractState, quest_id: u32) {
            let mut world = self.world(DEFAULT_NS());
            let mut quest: Quest = world.read_model(quest_id);
            let quest_details: QuestDetails = world.read_model(quest.details_id);

            // get score for the token id
            let game_registry: QuestGameRegistry = world.read_model(VERSION);
            let game_list: Span<QuestGame> = game_registry.game_list;
            let game: QuestGame = *game_list.at(quest_details.game_index_id.into());
            let config: LevelConfig = *game.levels.at(quest_details.level.into());

            let game_dispatcher = IGameDetailsDispatcher { contract_address: game.game_address };
            let score: u32 = game_dispatcher.score(quest.game_token_id);

            // check if the score is greater than or equal to the target score
            assert!(
                score >= config.target_score,
                "Quest {} is not completed. Target score: {}, Current score: {}",
                quest_id,
                config.target_score,
                score,
            );

            // set quest as completed
            quest.completed = true;
            world.write_model(@quest);

            // grant resource reward for completing quest
            let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, quest.explorer_id);
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_details.resource_type);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world,
                quest.explorer_id,
                quest_details.resource_type,
                ref explorer_weight,
                resource_weight_grams,
                false,
            );
            resource.add(quest_details.amount, ref explorer_weight, resource_weight_grams);
            resource.store(ref world);
            explorer_weight.store(ref world, quest.explorer_id);
        }

        fn get_quest(ref self: ContractState, quest_id: u32) -> Quest {
            let mut world = self.world(DEFAULT_NS());
            world.read_model(quest_id)
        }

        fn get_quest_details(ref self: ContractState, details_id: u32) -> QuestDetails {
            let mut world = self.world(DEFAULT_NS());
            world.read_model(details_id)
        }
    }
}

#[generate_trait]
pub impl iQuestDiscoveryImpl of iQuestDiscoveryTrait {
    fn create(ref world: WorldStorage, ref tile: Tile, seed: u256) -> @QuestDetails {
        assert!(tile.not_occupied(), "Can't create quest on occupied tile");

        // explore the tile if biome is not set
        if tile.biome == Biome::None.into() {
            let biome: Biome = get_biome(tile.col.into(), tile.row.into());
            IMapImpl::explore(ref world, ref tile, biome);
        }

        // get game registry
        let game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_list: Span<QuestGame> = game_registry.game_list;

        // get a random game from the list
        let game_selector_salt: u128 = 125;
        let random_index: u8 = random::random(seed.clone(), game_selector_salt, game_list.len().into())
            .try_into()
            .unwrap();
        let random_game: QuestGame = *game_list.at(random_index.into());

        // get a random level from the game
        let level_selector_salt: u128 = 126;
        let random_level: u8 = random::random(seed.clone(), level_selector_salt, random_game.levels.len().into())
            .try_into()
            .unwrap();

        // get a random capacity between 100 and 1000
        let capacity_selector_salt: u128 = 127;
        let minimum_capacity: u16 = 100;
        let maximum_capacity: u16 = 1000;
        let random_capacity: u16 = (random::random(
            seed.clone(), capacity_selector_salt, (maximum_capacity - minimum_capacity).into(),
        )
            + minimum_capacity.into())
            .try_into()
            .unwrap();

        // use exploration reward system to get a random resource type and amount
        let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
        let (reward_type, base_reward_amount) = iExplorerImpl::exploration_reward(ref world, map_config, seed.clone());

        // take the base reward amount from explorer code and then multiply by a base multiplier and then the quest
        // level
        let quest_reward_amount: u128 = base_reward_amount
            * QUEST_REWARD_BASE_MULTIPLIER.into()
            * (random_level.into() + 1);

        let id = world.dispatcher.uuid();

        let quest_details = @QuestDetails {
            id,
            coord: Coord { x: tile.col, y: tile.row },
            game_index_id: random_index,
            level: random_level,
            resource_type: reward_type,
            amount: quest_reward_amount,
            capacity: random_capacity,
            participant_count: 0,
        };

        // set tile occupier
        IMapImpl::occupy(ref world, ref tile, TileOccupier::Quest, id);

        world.write_model(quest_details);

        quest_details
    }


    fn lottery(map_config: MapConfig, vrf_seed: u256) -> bool {
        let success: bool = *random::choices(
            array![true, false].span(),
            array![map_config.quest_discovery_prob.into(), map_config.quest_discovery_fail_prob.into()].span(),
            array![].span(),
            1,
            true,
            vrf_seed,
        )[0];
        return success;
    }
}

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait};
    use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};

    use openzeppelin_token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use s1_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use s1_eternum::models::config::{WorldConfigUtilImpl};
    use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
    use s1_eternum::models::position::{Coord, Direction};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureTroopExplorerStoreImpl,
    };
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, TroopTier, TroopType};
    use s1_eternum::models::{
        config::{m_WeightConfig, m_WorldConfig}, map::{m_Tile},
        quest::{
            LevelConfig, Quest, QuestDetails, QuestGame, QuestGameRegistry, m_Quest, m_QuestCounter, m_QuestDetails,
            m_QuestGameRegistry, m_RealmRegistrations,
        },
        resource::production::building::{m_Building, m_StructureBuildings}, resource::resource::{m_Resource},
        structure::{m_Structure}, troop::{m_ExplorerTroops}, weight::{Weight},
    };
    use s1_eternum::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
    };
    use s1_eternum::systems::combat::contracts::troop_movement::{troop_movement_systems};
    use s1_eternum::systems::quest::constants::{VERSION};
    use s1_eternum::systems::quest::contracts::{
        IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait, iQuestDiscoveryImpl, quest_systems,
    };
    use s1_eternum::systems::resources::contracts::resource_systems::{resource_systems};
    use s1_eternum::utils::testing::helpers::{
        MOCK_CAPACITY_CONFIG, MOCK_MAP_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_DAMAGE_CONFIG, MOCK_TROOP_LIMIT_CONFIG,
        MOCK_TROOP_STAMINA_CONFIG, MOCK_WEIGHT_CONFIG, tgrant_resources, tspawn_simple_realm, tspawn_world,
        tstore_capacity_config, tstore_map_config, tstore_tick_config, tstore_troop_damage_config,
        tstore_troop_limit_config, tstore_troop_stamina_config, tstore_weight_config,
    };
    use tournaments::components::models::game::{
        m_GameCounter, m_GameMetadata, m_Score, m_Settings, m_SettingsCounter, m_SettingsDetails, m_TokenMetadata,
    };
    use tournaments::components::tests::mocks::game_mock::{
        IGameTokenMockDispatcher, IGameTokenMockDispatcherTrait, IGameTokenMockInitDispatcher,
        IGameTokenMockInitDispatcherTrait, game_mock,
    };

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // world config
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_WeightConfig::TEST_CLASS_HASH), // structure, realm and buildings
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
                TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
                TestResource::Model(m_Resource::TEST_CLASS_HASH),
                // other models
                TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
                // quest models
                TestResource::Model(m_QuestDetails::TEST_CLASS_HASH), TestResource::Model(m_Quest::TEST_CLASS_HASH),
                TestResource::Model(m_QuestCounter::TEST_CLASS_HASH),
                TestResource::Model(m_RealmRegistrations::TEST_CLASS_HASH),
                TestResource::Model(m_QuestGameRegistry::TEST_CLASS_HASH),
                // game mock models
                TestResource::Model(m_GameMetadata::TEST_CLASS_HASH),
                TestResource::Model(m_GameCounter::TEST_CLASS_HASH),
                TestResource::Model(m_TokenMetadata::TEST_CLASS_HASH), TestResource::Model(m_Score::TEST_CLASS_HASH),
                TestResource::Model(m_Settings::TEST_CLASS_HASH),
                TestResource::Model(m_SettingsCounter::TEST_CLASS_HASH),
                TestResource::Model(m_SettingsDetails::TEST_CLASS_HASH),
                // contracts
                TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
                TestResource::Contract(troop_movement_systems::TEST_CLASS_HASH),
                TestResource::Contract(resource_systems::TEST_CLASS_HASH),
                TestResource::Contract(quest_systems::TEST_CLASS_HASH),
                TestResource::Contract(game_mock::TEST_CLASS_HASH),
                // TestResource::Model(m_SettingsDetails::TEST_CLASS_HASH),
            ]
                .span(),
        };

        ndef
    }

    fn get_quest_systems_init_calldata() -> Span<felt252> {
        let level1 = LevelConfig { target_score: 100, settings_id: 1, time_limit: 600 };
        let level2 = LevelConfig { target_score: 200, settings_id: 2, time_limit: 1200 };

        let game1 = QuestGame {
            game_address: starknet::contract_address_const::<0x1>(), levels: array![level1, level2].span(),
        };
        let game2 = QuestGame {
            game_address: starknet::contract_address_const::<0x2>(), levels: array![level1].span(),
        };

        let game_list_array = array![game1, game2];
        let game_list_span: Span<QuestGame> = game_list_array.span();

        // Create an empty array to store the serialized data
        let mut serialized_data: Array<felt252> = array![];

        // Serialize the Span<QuestGame> into the Array<felt252>
        game_list_span.serialize(ref serialized_data);

        // Now get the span from the populated array
        serialized_data.span()
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"quest_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span())
                .with_init_calldata(get_quest_systems_init_calldata()),
            ContractDefTrait::new(DEFAULT_NS(), @"game_mock")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    #[test]
    fn complete_quest_simple() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // create a realm
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        // grant basic resources to the realm
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        let wheat_amount: u128 = 1000000000000000;
        let fish_amount: u128 = 500000000000000;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::FISH, fish_amount)].span());

        // set current tick
        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // create an explorer for the realm
        starknet::testing::set_contract_address(realm_owner);
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

        // create quest
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        // place quest to the 1 tile east of the Realm which is where explorer spawns
        let quest_coord = Coord { x: 81, y: 80 };

        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));

        // Use a mock seed for testing
        let seed: u256 = 0x12345;
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;

        // start quest
        let quest_id = quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);

        // verify game was minted to quester
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert(quest_owner == realm_owner, 'Game was not minted to quester');

        // end game with high enough score to claim reward
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        let quest: Quest = quest_system.get_quest(quest_id);
        let quest_details_data: QuestDetails = quest_system.get_quest_details(quest.details_id);
        let game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game_list: Span<QuestGame> = game_registry.game_list;
        let game: QuestGame = *game_list.at(quest_details_data.game_index_id.into());
        let config: LevelConfig = *game.levels.at(quest_details_data.level.into());
        let target_score = config.target_score;

        game_mock_dispatcher.end_game(quest_id.into(), target_score);

        // get resource amount prior to claiming quest reward
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        let mut resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_details_data.resource_type);
        let resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer_id, quest_details_data.resource_type, ref explorer_weight, resource_weight_grams, false,
        );
        let resource_balance_before_claim = resource.balance;

        // claim reward
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.claim_reward(quest_id);

        // assert quest is completed
        let quest: Quest = quest_system.get_quest(quest_id);
        assert(quest.completed == true, 'Quest should be completed');

        // get updated resource amount
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, quest.explorer_id);
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, quest_details_data.resource_type);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world,
            quest.explorer_id,
            quest_details_data.resource_type,
            ref explorer_weight,
            resource_weight_grams,
            false,
        );

        // assert explorer received reward
        assert(
            resource.balance == quest_details_data.amount + resource_balance_before_claim,
            'Explorer did not receive reward',
        );
    }

    #[test]
    #[should_panic(expected: ("Quest 1 is not completed. Target score: 300, Current score: 200", 'ENTRYPOINT_FAILED'))]
    fn fail_quest_simple() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
        let (resource_system_addr, _) = world.dns(@"resource_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // create a realm
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);
        // // grant basic resources to the realm
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        let wheat_amount: u128 = 1000000000000000;
        let fish_amount: u128 = 500000000000000;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::FISH, fish_amount)].span());

        // set current tick
        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // create an explorer for the realm
        starknet::testing::set_contract_address(realm_owner);
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

        // create quest using internal function
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 };
        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));
        let seed: u256 = 0x12345; // Use a mock seed
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;

        // start quest
        let quest_id = quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);

        // verify game was minted to quester
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert(quest_owner == realm_owner, 'Game was not minted to quester');

        // end game with a score LOWER than the target
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        let low_score: u32 = 200; // Initial low score guess

        // Fetch actual target score to adjust low_score and expected panic message
        let quest: Quest = quest_system.get_quest(quest_id);
        let quest_details_data: QuestDetails = quest_system.get_quest_details(quest.details_id);
        let game_registry: QuestGameRegistry = world.read_model(VERSION);
        let game: QuestGame = *game_registry.game_list.at(quest_details_data.game_index_id.into());
        let config: LevelConfig = *game.levels.at(quest_details_data.level.into());
        let target_score = config.target_score;

        // Ensure low_score is actually lower than target_score
        let actual_low_score = if target_score > 0 {
            target_score - 1
        } else {
            0 // Handle edge case where target score might be 0
        };

        game_mock_dispatcher.end_game(quest_id.into(), actual_low_score); // Use adjusted low score

        // attempt to claim reward - this should panic
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        quest_system.claim_reward(quest_id); // This will panic
    }

    #[test]
    #[should_panic(expected: ('Explorer is not on quest tile', 'ENTRYPOINT_FAILED'))]
    fn fail_not_on_tile() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // create a realm
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());

        // Set current tick
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Create an explorer for the realm
        starknet::testing::set_contract_address(realm_owner);
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let troop_spawn_direction = Direction::East;
        let explorer_id = troop_management_systems
            .explorer_create(
                realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
            );

        // Set up game mock
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at a DIFFERENT location than where the explorer is using internal function
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 90, y: 90 }; // Different from realm_coord (80, 80)
        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));
        let seed: u256 = 0x6789a; // Use a mock seed
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;

        // Try to start quest - this should fail because explorer is not on the quest tile
        quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn fail_not_explorer_owner() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // create a realm with a specific owner
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());

        // Set current tick
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Create an explorer for the realm (set contract address to realm owner)
        starknet::testing::set_contract_address(realm_owner);
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let troop_spawn_direction = Direction::East;
        let explorer_id = troop_management_systems
            .explorer_create(
                realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
            );

        // Set up game mock
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at the same location as the explorer using internal function
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // East of realm, where explorer spawns
        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));
        let seed: u256 = 0xabcdef; // Use a mock seed
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;

        // Set contract address to a DIFFERENT address (not the realm owner)
        let different_address = starknet::contract_address_const::<'different_address'>();
        starknet::testing::set_contract_address(different_address);

        // Try to start quest with the non-owner address - this should fail
        quest_system.start_quest(details_id, explorer_id, 'player1', different_address);
    }

    #[test]
    #[should_panic(expected: ('Quest is at capacity', 'ENTRYPOINT_FAILED'))]
    fn fail_quest_at_capacity() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // Create the first realm
        let realm1_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm1_coord = Coord { x: 80, y: 80 };
        let realm1_entity_id = tspawn_simple_realm(ref world, 1, realm1_owner, realm1_coord);

        // Create a second realm with different owner
        let realm2_owner = starknet::contract_address_const::<'realm2_owner'>();
        let realm2_coord = Coord { x: 84, y: 80 };
        let realm2_entity_id = tspawn_simple_realm(ref world, 2, realm2_owner, realm2_coord);

        // Grant resources to both realms
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm1_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());
        tgrant_resources(ref world, realm2_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());

        // Add wheat for food costs during movement
        let wheat_amount: u128 = 1000000000000000;
        tgrant_resources(ref world, realm1_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());
        tgrant_resources(ref world, realm2_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());

        // Set current tick
        let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Create explorer for first realm
        starknet::testing::set_contract_address(realm1_owner);
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        // Create first explorer at the quest location for simplicity
        // (We'll say the quest is at 81,80, where explorer1 naturally spawns)
        let explorer1_id = troop_management_systems
            .explorer_create(realm1_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, Direction::East);

        // Create second explorer for second realm, positioned at the quest location
        // for simplicity (avoids movement mechanics)
        starknet::testing::set_contract_address(realm2_owner);
        let explorer2_id = troop_management_systems
            .explorer_create(realm2_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, Direction::East);

        // Move the explorer2's position manually to match explorer1 (both at the quest location)
        let mut explorer2: ExplorerTroops = world.read_model(explorer2_id);
        explorer2.coord = Coord { x: 81, y: 80 }; // Same as explorer1
        world.write_model_test(@explorer2);

        // Set up game mock
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at the explorers' location using internal function
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // Where both explorers are
        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));
        let seed: u256 = 0x13579; // Use a mock seed
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;

        // Manually set capacity to 1 after creation for this specific test
        let mut created_quest_details: QuestDetails = world.read_model(details_id);
        created_quest_details.capacity = 1;
        world.write_model_test(@created_quest_details);

        // Start quest with first realm's explorer
        starknet::testing::set_contract_address(realm1_owner);
        let quest_id = quest_system.start_quest(details_id, explorer1_id, 'player1', realm1_owner);

        // Verify the game was minted to the first player
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert!(quest_owner == realm1_owner, "Game was not minted to first quester");

        // Try to start quest with second realm's explorer - this should fail because capacity is 1
        starknet::testing::set_contract_address(realm2_owner);
        quest_system.start_quest(details_id, explorer2_id, 'player2', realm2_owner);
    }

    #[test]
    #[should_panic(expected: ("Realm has already attempted this quest", 'ENTRYPOINT_FAILED'))]
    fn fail_attempt_quest_from_same_realm_twice() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
        tstore_weight_config(
            ref world,
            array![
                MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
                MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
                MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
                MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            ]
                .span(),
        );
        tstore_map_config(ref world, MOCK_MAP_CONFIG());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
        let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

        // Create a realm
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { x: 80, y: 80 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources to realm for the explorer
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());

        // Add wheat for food costs
        let wheat_amount: u128 = 1000000000000000;
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());

        // Set current tick
        let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
        starknet::testing::set_block_timestamp(current_tick);

        // Create explorer for the realm
        starknet::testing::set_contract_address(realm_owner);
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let explorer_id = troop_management_systems
            .explorer_create(realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, Direction::East);

        // Set up game mock
        let game_mock_init_dispatcher = IGameTokenMockInitDispatcher { contract_address: game_mock_addr };
        game_mock_init_dispatcher.initializer(DEFAULT_NS_STR());

        // Create quest at the explorer's location using internal function
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // Where the explorer is
        let mut tile: Tile = world.read_model((quest_coord.x, quest_coord.y));
        let seed: u256 = 0x24680; // Use a mock seed
        let quest_details: @QuestDetails = iQuestDiscoveryImpl::create(ref world, ref tile, seed);
        let details_id = *quest_details.id;
        // Note: capacity is now random (100-1000), which is fine for this test.

        // Start quest with the explorer
        let quest_id = quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);

        // Verify the game was minted to the player
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert(quest_owner == realm_owner, 'Game was not minted to quester');

        // Try to start the same quest with the same explorer
        // This should fail because a realm can only have one participant per quest
        quest_system.start_quest(details_id, explorer_id, 'player2', realm_owner);
    }
}
