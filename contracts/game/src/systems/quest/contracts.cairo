use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use s1_eternum::models::quest::{Quest, QuestDetails};
use starknet::ContractAddress;

#[starknet::interface]
pub trait IQuestSystems<T> {
    fn create_quest(
        ref self: T,
        game_address: ContractAddress,
        coord: Coord,
        reward_resource_type: u8,
        reward_amount: u128,
        settings_id: u32,
        target_score: u32,
        capacity: u16,
        expires_at: u64,
    ) -> u64;
    fn start_quest(
        ref self: T, details_id: u64, explorer_id: ID, player_name: felt252, to_address: ContractAddress,
    ) -> u64;
    fn claim_reward(ref self: T, quest_id: u64);
    fn get_quest_details(ref self: T, details_id: u64) -> QuestDetails;
    fn get_quest(ref self: T, quest_id: u64) -> Quest;
}


#[dojo::contract]
pub mod quest_systems {
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::position::Coord;
    use s1_eternum::models::quest::{Quest, QuestCounter, QuestDetails, QuestDetailsCounter, RealmRegistrations, Reward};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{StructureMetadataStoreImpl, StructureOwnerStoreImpl};
    use s1_eternum::models::troop::ExplorerTroops;
    use s1_eternum::models::weight::Weight;
    use starknet::ContractAddress;
    use tournaments::components::interfaces::{
        IGameDetailsDispatcher, IGameDetailsDispatcherTrait, IGameTokenDispatcher, IGameTokenDispatcherTrait,
        ISettingsDispatcher, ISettingsDispatcherTrait,
    };


    const VERSION: felt252 = '0.0.1';


    #[abi(embed_v0)]
    pub impl QuestSystemsImpl of super::IQuestSystems<ContractState> {
        fn create_quest(
            ref self: ContractState,
            game_address: ContractAddress,
            coord: Coord,
            reward_resource_type: u8,
            reward_amount: u128,
            settings_id: u32,
            target_score: u32,
            capacity: u16,
            expires_at: u64,
        ) -> u64 {
            let mut world = self.world(DEFAULT_NS());

            let settings_dispatcher = ISettingsDispatcher { contract_address: game_address };
            let settings_exist = settings_dispatcher.setting_exists(settings_id);
            let game_address_felt: felt252 = game_address.into();
            assert!(
                settings_exist, "Quests: game address {} does not have settings id {}", game_address_felt, settings_id,
            );

            // TODO: Add additional validation such as resource type exist, etc

            let mut quest_details_counter: QuestDetailsCounter = world.read_model(VERSION);
            quest_details_counter.count += 1;

            let quest_details = @QuestDetails {
                id: quest_details_counter.count,
                coord,
                game_address,
                reward: Reward { resource_type: reward_resource_type, amount: reward_amount },
                settings_id,
                target_score,
                capacity,
                participant_count: 0,
                expires_at,
            };

            world.write_model(@quest_details_counter);
            world.write_model(quest_details);
            *quest_details.id
        }

        fn start_quest(
            ref self: ContractState,
            details_id: u64,
            explorer_id: ID,
            player_name: felt252,
            to_address: ContractAddress,
        ) -> u64 {
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

            let game_dispatcher = IGameTokenDispatcher { contract_address: quest_details.game_address };
            let game_token_id: u64 = game_dispatcher
                .mint(
                    player_name,
                    quest_details.settings_id,
                    Option::None,
                    Option::Some(quest_details.expires_at),
                    to_address,
                );

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

        fn claim_reward(ref self: ContractState, quest_id: u64) {
            let mut world = self.world(DEFAULT_NS());
            let mut quest: Quest = world.read_model(quest_id);
            let quest_details: QuestDetails = world.read_model(quest.details_id);

            // get score for the token id
            let game_dispatcher = IGameDetailsDispatcher { contract_address: quest_details.game_address };
            let score: u32 = game_dispatcher.score(quest.game_token_id);

            // check if the score is greater than or equal to the target score
            assert!(
                score >= quest_details.target_score,
                "Quest {} is not completed. Target score: {}, Current score: {}",
                quest_id,
                quest_details.target_score,
                score,
            );

            // set quest as completed
            quest.completed = true;
            world.write_model(@quest);

            // issue reward

            // grant resource reward for exploration
            let explore_reward_id: u8 = quest_details.reward.resource_type;
            let explore_reward_amount: u128 = quest_details.reward.amount;
            let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, quest.explorer_id);
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_id);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world, quest.explorer_id, explore_reward_id, ref explorer_weight, resource_weight_grams, false,
            );
            resource.add(explore_reward_amount, ref explorer_weight, resource_weight_grams);
            resource.store(ref world);
            explorer_weight.store(ref world, quest.explorer_id);
        }

        fn get_quest(ref self: ContractState, quest_id: u64) -> Quest {
            let mut world = self.world(DEFAULT_NS());
            world.read_model(quest_id)
        }

        fn get_quest_details(ref self: ContractState, details_id: u64) -> QuestDetails {
            let mut world = self.world(DEFAULT_NS());
            world.read_model(details_id)
        }
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
    use s1_eternum::models::map::{TileImpl};
    use s1_eternum::models::position::{Coord, Direction};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureTroopExplorerStoreImpl,
    };
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, TroopTier, TroopType};
    use s1_eternum::models::{
        config::{m_ProductionConfig, m_WeightConfig, m_WorldConfig}, map::{m_Tile},
        quest::{Quest, m_Quest, m_QuestCounter, m_QuestDetails, m_QuestDetailsCounter, m_RealmRegistrations},
        resource::production::building::{m_Building, m_StructureBuildings}, resource::resource::{m_Resource},
        structure::{m_Structure}, troop::{m_ExplorerTroops}, weight::{Weight},
    };
    use s1_eternum::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
    };
    use s1_eternum::systems::combat::contracts::troop_movement::{troop_movement_systems};
    use s1_eternum::systems::quest::contracts::{IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait, quest_systems};
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
                TestResource::Model(m_WeightConfig::TEST_CLASS_HASH),
                TestResource::Model(m_ProductionConfig::TEST_CLASS_HASH),
                // structure, realm and buildings
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
                TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
                TestResource::Model(m_Resource::TEST_CLASS_HASH),
                // other models
                TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
                // quest models
                TestResource::Model(m_QuestDetails::TEST_CLASS_HASH),
                TestResource::Model(m_QuestDetailsCounter::TEST_CLASS_HASH),
                TestResource::Model(m_Quest::TEST_CLASS_HASH), TestResource::Model(m_QuestCounter::TEST_CLASS_HASH),
                TestResource::Model(m_RealmRegistrations::TEST_CLASS_HASH),
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

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"quest_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
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
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300;
        let capacity = 100;
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

        // start quest
        let quest_id = quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);

        // verify game was minted to quester
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert(quest_owner == realm_owner, 'Game was not minted to quester');

        // end game with high enough score to claim reward
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        game_mock_dispatcher.end_game(quest_id, target_score);

        // get resource amount prior to claiming quest reward
        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
        let mut resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, reward_resource_type);
        let resource = SingleResourceStoreImpl::retrieve(
            ref world, explorer_id, reward_resource_type, ref explorer_weight, resource_weight_grams, false,
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
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, reward_resource_type);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world, quest.explorer_id, reward_resource_type, ref explorer_weight, resource_weight_grams, false,
        );

        // assert explorer received reward
        assert(resource.balance == reward_amount + resource_balance_before_claim, 'Explorer did not receive reward');
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
        // let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
        // let (resource_system_addr, _) = world.dns(@"resource_systems").unwrap();
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
        let quest_coord = Coord { x: 81, y: 80 };
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300; // Target score is 300
        let capacity = 100;
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

        // start quest
        let quest_id = quest_system.start_quest(details_id, explorer_id, 'player1', realm_owner);

        // verify game was minted to quester
        let erc721_dispatcher = IERC721Dispatcher { contract_address: game_mock_addr };
        let quest_owner = erc721_dispatcher.owner_of(quest_id.into());
        assert(quest_owner == realm_owner, 'Game was not minted to quester');

        // end game with a score LOWER than the target
        let game_mock_dispatcher = IGameTokenMockDispatcher { contract_address: game_mock_addr };
        let low_score: u32 = 200; // Score is 200, less than target of 300
        game_mock_dispatcher.end_game(quest_id, low_score);

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

        // Create quest at a DIFFERENT location than where the explorer is
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 90, y: 90 }; // Different from realm_coord (80, 80)
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300;
        let capacity = 100;
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

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

        // Create quest at the same location as the explorer
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // East of realm, where explorer spawns
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300;
        let capacity = 100;
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

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

        // Create quest at the explorers' location
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // Where both explorers are
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300;
        let capacity: u16 = 1; // Set capacity to 1
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

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

        // Create quest at the explorer's location
        let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_addr };
        let quest_coord = Coord { x: 81, y: 80 }; // Where the explorer is
        let reward_resource_type: u8 = ResourceTypes::WHEAT;
        let reward_amount: u128 = 1000000000000000;
        let settings_id = 0;
        let target_score = 300;
        let capacity: u16 = 2; // Set capacity to 2 to ensure the failure is due to same realm constraint, not capacity
        let expires_at = 0;
        let details_id = quest_system
            .create_quest(
                game_mock_addr,
                quest_coord,
                reward_resource_type,
                reward_amount,
                settings_id,
                target_score,
                capacity,
                expires_at,
            );

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
