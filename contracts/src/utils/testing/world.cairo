use core::array::{ArrayTrait, SpanTrait};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo_cairo_test::{
    spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef, WorldStorageTestTrait
};
use s0_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR};
use s0_eternum::models::bank::bank::{m_Bank};
use s0_eternum::models::bank::liquidity::m_Liquidity;
use s0_eternum::models::bank::market::m_Market;
use s0_eternum::models::buildings::m_BuildingQuantityv2;
use s0_eternum::models::buildings::{m_Building};
use s0_eternum::models::capacity::{m_CapacityCategory};
use s0_eternum::models::combat::m_Army;
use s0_eternum::models::combat::m_Battle;
use s0_eternum::models::combat::m_Health;
use s0_eternum::models::combat::m_Protectee;
use s0_eternum::models::combat::m_Protector;
use s0_eternum::models::config::{
    m_WorldConfig, m_SpeedConfig, m_CapacityConfig, m_WeightConfig, m_HyperstructureResourceConfig, m_StaminaConfig,
    m_StaminaRefillConfig, m_TickConfig, m_MapConfig, m_MercenariesConfig, m_LevelingConfig, m_ProductionConfig,
    m_BankConfig, m_BuildingConfig, m_TroopConfig, m_BattleConfig, m_BuildingCategoryPopConfig, m_PopulationConfig,
    m_HyperstructureConfig, m_TravelStaminaCostConfig, m_ResourceBridgeConfig, m_ResourceBridgeFeeSplitConfig,
    m_ResourceBridgeWhitelistConfig, m_SettlementConfig, m_RealmLevelConfig, m_RealmMaxLevelConfig,
    m_TravelFoodCostConfig, m_QuestRewardConfig, m_QuestConfig
};
use s0_eternum::models::guild::{m_Guild, m_GuildMember, m_GuildWhitelist};
use s0_eternum::models::hyperstructure::{m_Progress, m_Contribution, m_Hyperstructure, m_Epoch};
use s0_eternum::models::map::m_Tile;
use s0_eternum::models::movable::{m_Movable, m_ArrivalTime};
use s0_eternum::models::name::{m_AddressName};
use s0_eternum::models::name::{m_EntityName};
use s0_eternum::models::order::m_Orders;
use s0_eternum::models::owner::m_EntityOwner;
use s0_eternum::models::owner::{m_Owner};
use s0_eternum::models::population::m_Population;
use s0_eternum::models::position::{m_Position};
use s0_eternum::models::production::{m_Production, m_ProductionInput, m_ProductionOutput, m_ProductionDeadline};
use s0_eternum::models::quantity::{m_Quantity, m_QuantityTracker};
use s0_eternum::models::quest::{m_Quest, m_QuestBonus};
use s0_eternum::models::realm::{m_Realm};
use s0_eternum::models::resources::m_DetachedResource;
use s0_eternum::models::resources::m_OwnedResourcesTracker;
use s0_eternum::models::resources::m_ResourceAllowance;
use s0_eternum::models::resources::m_ResourceTransferLock;
use s0_eternum::models::resources::{m_ResourceCost};
use s0_eternum::models::resources::{m_Resource};
use s0_eternum::models::season::m_Leaderboard;
use s0_eternum::models::season::m_LeaderboardEntry;
use s0_eternum::models::season::m_LeaderboardRegisterContribution;
use s0_eternum::models::season::m_LeaderboardRegisterShare;
use s0_eternum::models::season::m_LeaderboardRegistered;
use s0_eternum::models::season::m_LeaderboardRewardClaimed;
use s0_eternum::models::season::m_Season;
use s0_eternum::models::stamina::m_Stamina;
use s0_eternum::models::structure::m_Structure;
use s0_eternum::models::structure::m_StructureCount;
use s0_eternum::models::trade::{m_Status, m_Trade};
use s0_eternum::models::weight::m_Weight;

use s0_eternum::systems::bank::contracts::bank::bank_systems;
use s0_eternum::systems::bank::contracts::liquidity::liquidity_systems;
use s0_eternum::systems::bank::contracts::swap::swap_systems;


use s0_eternum::systems::buildings::contracts::building_systems;
use s0_eternum::systems::combat::contracts::battle_systems::{
    battle_systems, battle_pillage_systems, battle_utils_systems
};
use s0_eternum::systems::combat::contracts::troop_systems::troop_systems;

use s0_eternum::systems::config::contracts::config_systems;
use s0_eternum::systems::dev::contracts::bank::dev_bank_systems;
use s0_eternum::systems::dev::contracts::realm::dev_realm_systems;
use s0_eternum::systems::dev::contracts::resource::dev_resource_systems;

use s0_eternum::systems::guild::contracts::guild_systems;
use s0_eternum::systems::hyperstructure::contracts::hyperstructure_systems;
use s0_eternum::systems::map::contracts::{map_systems};
use s0_eternum::systems::map::map_generation::map_generation_systems;
use s0_eternum::systems::name::contracts::name_systems;
use s0_eternum::systems::ownership::contracts::ownership_systems;
use s0_eternum::systems::realm::contracts::realm_systems;
use s0_eternum::systems::resources::contracts::{
    resource_bridge_systems::resource_bridge_systems, resource_systems::resource_systems
};
use s0_eternum::systems::season::contracts::season_systems;
use s0_eternum::systems::trade::contracts::trade_systems::trade_systems;
use s0_eternum::systems::transport::contracts::donkey_systems::donkey_systems;
use s0_eternum::systems::transport::contracts::travel_systems::travel_systems;
use starknet::ContractAddress;

use starknet::contract_address_const;

fn namespace_def() -> NamespaceDef {
    let ndef = NamespaceDef {
        namespace: DEFAULT_NS_STR(), resources: [
            TestResource::Model(m_Bank::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Liquidity::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Market::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_BuildingQuantityv2::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Building::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_CapacityCategory::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Army::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Battle::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Health::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Protectee::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Protector::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_WorldConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_SpeedConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_CapacityConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_WeightConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_HyperstructureResourceConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_StaminaConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_StaminaRefillConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_TickConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_MapConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_MercenariesConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LevelingConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ProductionConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_BankConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_BuildingConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_TroopConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_BattleConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_BuildingCategoryPopConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_PopulationConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_HyperstructureConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_TravelStaminaCostConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceBridgeConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceBridgeFeeSplitConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceBridgeWhitelistConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_SettlementConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_RealmLevelConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_RealmMaxLevelConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_TravelFoodCostConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_QuestRewardConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_QuestConfig::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Guild::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_GuildMember::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_GuildWhitelist::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Progress::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Contribution::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Hyperstructure::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Epoch::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Tile::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Movable::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ArrivalTime::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_AddressName::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_EntityName::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Orders::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_EntityOwner::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Owner::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Population::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Position::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Production::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ProductionInput::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ProductionOutput::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ProductionDeadline::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Quantity::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_QuantityTracker::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Quest::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_QuestBonus::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Realm::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_DetachedResource::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_OwnedResourcesTracker::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceAllowance::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceTransferLock::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Resource::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_ResourceCost::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Season::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Stamina::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Structure::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_StructureCount::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Status::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Trade::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Weight::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Leaderboard::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LeaderboardEntry::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LeaderboardRegistered::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LeaderboardRegisterContribution::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LeaderboardRegisterShare::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_LeaderboardRewardClaimed::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(liquidity_systems::e_LiquidityEvent::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(swap_systems::e_SwapEvent::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(hyperstructure_systems::e_HyperstructureFinished::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(
                hyperstructure_systems::e_HyperstructureCoOwnersChange::TEST_CLASS_HASH.try_into().unwrap()
            ),
            TestResource::Event(
                hyperstructure_systems::e_HyperstructureContribution::TEST_CLASS_HASH.try_into().unwrap()
            ),
            TestResource::Event(hyperstructure_systems::e_GameEnded::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(map_generation_systems::e_MapExplored::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(map_generation_systems::e_FragmentMineDiscovered::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(resource_systems::e_Transfer::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(trade_systems::e_CreateOrder::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(trade_systems::e_AcceptOrder::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(trade_systems::e_AcceptPartialOrder::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(trade_systems::e_CancelOrder::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(donkey_systems::e_BurnDonkey::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(travel_systems::e_Travel::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_BattleStartData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_BattleJoinData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_BattleLeaveData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_BattleClaimData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_BattlePillageData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_SettleRealmData::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_CreateGuild::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(s0_eternum::models::event::e_JoinGuild::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(achievement::events::index::e_TrophyCreation::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(achievement::events::index::e_TrophyProgression::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Contract(bank_systems::TEST_CLASS_HASH),
            TestResource::Contract(liquidity_systems::TEST_CLASS_HASH),
            TestResource::Contract(swap_systems::TEST_CLASS_HASH),
            TestResource::Contract(building_systems::TEST_CLASS_HASH),
            TestResource::Contract(battle_systems::TEST_CLASS_HASH),
            TestResource::Contract(battle_utils_systems::TEST_CLASS_HASH),
            TestResource::Contract(battle_pillage_systems::TEST_CLASS_HASH),
            TestResource::Contract(troop_systems::TEST_CLASS_HASH),
            TestResource::Contract(config_systems::TEST_CLASS_HASH),
            TestResource::Contract(dev_bank_systems::TEST_CLASS_HASH),
            TestResource::Contract(dev_realm_systems::TEST_CLASS_HASH),
            TestResource::Contract(dev_resource_systems::TEST_CLASS_HASH),
            TestResource::Contract(guild_systems::TEST_CLASS_HASH),
            TestResource::Contract(hyperstructure_systems::TEST_CLASS_HASH),
            TestResource::Contract(map_systems::TEST_CLASS_HASH),
            TestResource::Contract(map_generation_systems::TEST_CLASS_HASH),
            TestResource::Contract(name_systems::TEST_CLASS_HASH),
            TestResource::Contract(ownership_systems::TEST_CLASS_HASH),
            TestResource::Contract(realm_systems::TEST_CLASS_HASH),
            TestResource::Contract(resource_bridge_systems::TEST_CLASS_HASH),
            TestResource::Contract(resource_systems::TEST_CLASS_HASH),
            TestResource::Contract(trade_systems::TEST_CLASS_HASH),
            TestResource::Contract(travel_systems::TEST_CLASS_HASH),
            TestResource::Contract(donkey_systems::TEST_CLASS_HASH),
            TestResource::Contract(season_systems::TEST_CLASS_HASH),
        ].span()
    };

    ndef
}

fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(DEFAULT_NS(), @"bank_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"liquidity_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"swap_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"building_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"battle_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"battle_utils_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"battle_pillage_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"troop_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"config_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"dev_bank_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"dev_realm_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"dev_resource_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"guild_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"hyperstructure_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"map_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"map_generation_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"name_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"ownership_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"realm_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"resource_bridge_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"trade_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"travel_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"donkey_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"season_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
    ].span()
}


// used to spawn a test world with all the models and systems registered
fn spawn_eternum() -> dojo::world::WorldStorage {
    let ndef = namespace_def();
    let mut world = spawn_test_world([ndef].span());
    world.sync_perms_and_inits(contract_defs());

    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player1'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player2'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player3'>());
    world
        .dispatcher
        .grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player_1_realm_owner'>());
    world
        .dispatcher
        .grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player_2_realm_owner'>());
    world
        .dispatcher
        .grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'player_3_realm_owner'>());

    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'realms_owner'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'realm_owner'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'caller'>());

    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'maker'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'taker'>());
    world.dispatcher.grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'0'>());
    world
        .dispatcher
        .grant_owner(dojo::utils::bytearray_hash(DEFAULT_NS()), contract_address_const::<'takers_other_realm'>());

    world.dispatcher.uuid();

    world
}
