use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;


/// Represents a tile on the map where a quest can be discovered and initiated.
/// Contains metadata about the quest available at this location.
#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestTile {
    /// Unique identifier for the quest tile.
    #[key]
    pub id: u32,
    /// The address of the game contract associated with this quest.
    pub game_address: ContractAddress,
    /// The map coordinates (x, y) of the quest tile.
    pub coord: Coord,
    /// The difficulty level of the quest.
    pub level: u8,
    /// The type of resource awarded upon completion.
    pub resource_type: u8,
    /// The amount of the resource awarded upon completion.
    pub amount: u128,
    /// The maximum number of participants allowed for this quest.
    pub capacity: u16,
    /// The current number of participants who have started this quest.
    pub participant_count: u16,
}

/// Represents an active quest instance undertaken by an explorer.
/// Links a specific game attempt (token) to a quest tile and the participating explorer.
#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct Quest {
    /// The unique identifier of the game token minted when the quest was started.
    #[key]
    pub game_token_id: u64,
    /// The address of the game contract associated with this quest attempt.
    #[key]
    pub game_address: ContractAddress,
    /// The ID of the QuestTile where this quest was initiated.
    pub quest_tile_id: u32,
    /// The ID of the explorer undertaking the quest.
    pub explorer_id: ID,
    /// Flag indicating whether the quest has been successfully completed and claimed.
    pub completed: bool,
}

/// A struct used to return aggregated details about a specific quest instance.
/// This is used for view functions, not stored as a model.
#[derive(Drop, Serde)]
pub struct QuestDetails {
    /// The ID of the QuestTile.
    pub quest_tile_id: u32,
    /// The address of the game contract.
    pub game_address: ContractAddress,
    /// The map coordinates of the quest tile.
    pub coord: Coord,
    /// The score required to complete the quest.
    pub target_score: u32,
    /// The name of the resource awarded upon completion.
    pub reward_name: ByteArray,
    /// The amount of the resource awarded upon completion.
    pub reward_amount: u128,
}

/// Tracks which realm or village has participated in a specific quest tile.
/// Used to prevent multiple participations from the same originating structure (realm or village).
#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestRegistrations {
    /// The ID of the QuestTile.
    #[key]
    pub quest_tile_id: u32,
    /// The ID of the realm or village that initiated the quest.
    #[key]
    pub realm_or_village_id: u32,
    /// The game token ID associated with this specific participation.
    pub game_token_id: u64,
}

/// Stores the registry of all valid quest game contracts.
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestGameRegistry {
    /// A key, often representing a version or identifier for the registry.
    #[key]
    pub key: felt252,
    /// A list of contract addresses for registered quest games.
    pub games: Span<ContractAddress>,
}

/// Stores the level configurations associated with a specific quest game contract.
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestLevels {
    /// The address of the quest game contract.
    #[key]
    pub game_address: ContractAddress,
    /// A list of level configurations for this game.
    pub levels: Span<Level>,
}

/// Defines the parameters for a single difficulty level within a quest game.
#[derive(Introspect, Copy, Drop, Serde)]
pub struct Level {
    /// The score required to successfully complete this level.
    pub target_score: u32,
    /// An identifier for specific settings or configurations within the game contract for this level.
    pub settings_id: u32,
    /// The time limit (in seconds) allowed to complete the quest attempt for this level. 0 means no limit.
    pub time_limit: u64,
}

/// A simple feature flag to enable or disable the quest system globally.
#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestFeatureFlag {
    /// A key, often representing a version or identifier for the flag.
    #[key]
    pub key: felt252,
    /// Boolean flag indicating if the quest feature is currently enabled.
    pub enabled: bool,
}

