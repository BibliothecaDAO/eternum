use core::num::traits::Bounded;
use s1_eternum::alias::ID;

// take an address of a real network contract
pub const UNIVERSAL_DEPLOYER_ADDRESS: felt252 =
    0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf;

// todo: ensure there are no clashes with other ids
// Config ID to fetch global configs

pub const WORLD_CONFIG_ID: ID = Bounded::MAX;
pub const REGIONAL_BANK_ONE_ID: ID = Bounded::MAX - 1;
pub const REGIONAL_BANK_TWO_ID: ID = Bounded::MAX - 2;
pub const REGIONAL_BANK_THREE_ID: ID = Bounded::MAX - 3;
pub const REGIONAL_BANK_FOUR_ID: ID = Bounded::MAX - 4;
pub const REGIONAL_BANK_FIVE_ID: ID = Bounded::MAX - 5;
pub const REGIONAL_BANK_SIX_ID: ID = Bounded::MAX - 6;
pub const DAYDREAMS_AGENT_ID: ID = Bounded::MAX - 7;

pub const GRAMS_PER_KG: u128 = 1_000;

// max realms per user
pub const MAX_REALMS_PER_ADDRESS: u16 = 8_000;

// resource precision
pub const RESOURCE_PRECISION: u128 = 1_000_000_000;

// WONDER STARTING RESOURCES BOOST
pub const WONDER_STARTING_RESOURCES_BOOST: u128 = 3;

// pillage config
// TODO: Move to Onchain config
pub const MAX_PILLAGE_TRIAL_COUNT: u8 = 7;

pub fn is_bank(entity_id: ID) -> bool {
    return entity_id == REGIONAL_BANK_ONE_ID
        || entity_id == REGIONAL_BANK_TWO_ID
        || entity_id == REGIONAL_BANK_THREE_ID
        || entity_id == REGIONAL_BANK_FOUR_ID
        || entity_id == REGIONAL_BANK_FIVE_ID
        || entity_id == REGIONAL_BANK_SIX_ID;
}

// Note: Please update this list whenever ResourceTypes are updated
pub fn all_resource_ids() -> Array<u8> {
    array![
        //
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, // Essence
        38, // Relics
        39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
        54, 55, 56,
    ]
}

pub const RELICS_RESOURCE_START_ID: u8 = 39;
pub const RELICS_RESOURCE_END_ID: u8 = 56;

// Note: Please update the all_resources_ids list whenever ResourceTypes are updated
pub mod ResourceTypes {
    pub const STONE: u8 = 1;
    pub const COAL: u8 = 2;
    pub const WOOD: u8 = 3;
    pub const COPPER: u8 = 4;
    pub const IRONWOOD: u8 = 5;
    pub const OBSIDIAN: u8 = 6;
    pub const GOLD: u8 = 7;
    pub const SILVER: u8 = 8;
    pub const MITHRAL: u8 = 9;
    pub const ALCHEMICAL_SILVER: u8 = 10;
    pub const COLD_IRON: u8 = 11;
    pub const DEEP_CRYSTAL: u8 = 12;
    pub const RUBY: u8 = 13;
    pub const DIAMONDS: u8 = 14;
    pub const HARTWOOD: u8 = 15;
    pub const IGNIUM: u8 = 16;
    pub const TWILIGHT_QUARTZ: u8 = 17;
    pub const TRUE_ICE: u8 = 18;
    pub const ADAMANTINE: u8 = 19;
    pub const SAPPHIRE: u8 = 20;
    pub const ETHEREAL_SILICA: u8 = 21;
    pub const DRAGONHIDE: u8 = 22;

    // THE RESOURCE IDS ABOVE MUST MATCH THE
    // RESOURCE IDS IN THE SEASON PASS

    //todo: should labor be bridgeable?
    pub const LABOR: u8 = 23;
    pub const EARTHEN_SHARD: u8 = 24;
    pub const DONKEY: u8 = 25;
    pub const KNIGHT_T1: u8 = 26;
    pub const KNIGHT_T2: u8 = 27;
    pub const KNIGHT_T3: u8 = 28;
    pub const CROSSBOWMAN_T1: u8 = 29;
    pub const CROSSBOWMAN_T2: u8 = 30;
    pub const CROSSBOWMAN_T3: u8 = 31;
    pub const PALADIN_T1: u8 = 32;
    pub const PALADIN_T2: u8 = 33;
    pub const PALADIN_T3: u8 = 34;
    pub const WHEAT: u8 = 35;
    pub const FISH: u8 = 36;
    pub const LORDS: u8 = 37;

    // Essence
    pub const ESSENCE: u8 = 38;
    // Relics
    pub const RELIC_E1: u8 = 39;
    pub const RELIC_E2: u8 = 40;
    pub const RELIC_E3: u8 = 41;
    pub const RELIC_E4: u8 = 42;
    pub const RELIC_E5: u8 = 43;
    pub const RELIC_E6: u8 = 44;
    pub const RELIC_E7: u8 = 45;
    pub const RELIC_E8: u8 = 46;
    pub const RELIC_E9: u8 = 47;
    pub const RELIC_E10: u8 = 48;
    pub const RELIC_E11: u8 = 49;
    pub const RELIC_E12: u8 = 50;
    pub const RELIC_E13: u8 = 51;
    pub const RELIC_E14: u8 = 52;
    pub const RELIC_E15: u8 = 53;
    pub const RELIC_E16: u8 = 54;
    pub const RELIC_E17: u8 = 55;
    pub const RELIC_E18: u8 = 56;
}


pub fn resource_type_name(resource_type: u8) -> ByteArray {
    if resource_type == 1 {
        "STONE"
    } else if resource_type == 2 {
        "COAL"
    } else if resource_type == 3 {
        "WOOD"
    } else if resource_type == 4 {
        "COPPER"
    } else if resource_type == 5 {
        "IRONWOOD"
    } else if resource_type == 6 {
        "OBSIDIAN"
    } else if resource_type == 7 {
        "GOLD"
    } else if resource_type == 8 {
        "SILVER"
    } else if resource_type == 9 {
        "MITHRAL"
    } else if resource_type == 10 {
        "ALCHEMICAL SILVER"
    } else if resource_type == 11 {
        "COLD IRON"
    } else if resource_type == 12 {
        "DEEP CRYSTAL"
    } else if resource_type == 13 {
        "RUBY"
    } else if resource_type == 14 {
        "DIAMONDS"
    } else if resource_type == 15 {
        "HARTWOOD"
    } else if resource_type == 16 {
        "IGNIUM"
    } else if resource_type == 17 {
        "TWILIGHT QUARTZ"
    } else if resource_type == 18 {
        "TRUE ICE"
    } else if resource_type == 19 {
        "ADAMANTINE"
    } else if resource_type == 20 {
        "SAPPHIRE"
    } else if resource_type == 21 {
        "ETHEREAL SILICA"
    } else if resource_type == 22 {
        "DRAGONHIDE"
    } else if resource_type == 23 {
        "LABOR"
    } else if resource_type == 24 {
        "EARTHEN SHARD"
    } else if resource_type == 25 {
        "DONKEY"
    } else if resource_type == 26 {
        "T1 KNIGHT"
    } else if resource_type == 27 {
        "T2 KNIGHT"
    } else if resource_type == 28 {
        "T3 KNIGHT"
    } else if resource_type == 29 {
        "T1 CROSSBOWMAN"
    } else if resource_type == 30 {
        "T2 CROSSBOWMAN"
    } else if resource_type == 31 {
        "T3 CROSSBOWMAN"
    } else if resource_type == 32 {
        "T1 PALADIN"
    } else if resource_type == 33 {
        "T2 PALADIN"
    } else if resource_type == 34 {
        "T3 PALADIN"
    } else if resource_type == 35 {
        "WHEAT"
    } else if resource_type == 36 {
        "FISH"
    } else if resource_type == 37 {
        "LORDS"
    } else if resource_type == 38 {
        "ESSENCE"
    } else if resource_type == 39 {
        "RELIC E1"
    } else if resource_type == 40 {
        "RELIC E2"
    } else if resource_type == 41 {
        "RELIC E3"
    } else if resource_type == 42 {
        "RELIC E4"
    } else if resource_type == 43 {
        "RELIC E5"
    } else if resource_type == 44 {
        "RELIC E6"
    } else if resource_type == 45 {
        "RELIC E7"
    } else if resource_type == 46 {
        "RELIC E8"
    } else if resource_type == 47 {
        "RELIC E9"
    } else if resource_type == 48 {
        "RELIC E10"
    } else if resource_type == 49 {
        "RELIC E11"
    } else if resource_type == 50 {
        "RELIC E12"
    } else if resource_type == 51 {
        "RELIC E13"
    } else if resource_type == 52 {
        "RELIC E14"
    } else if resource_type == 53 {
        "RELIC E15"
    } else if resource_type == 54 {
        "RELIC E16"
    } else if resource_type == 55 {
        "RELIC E17"
    } else if resource_type == 56 {
        "RELIC E18"
    } else {
        format!("{} (unknown resource name)", resource_type)
    }
}

pub fn relic_level(resource_type: u8) -> u8 {
    if resource_type == 39 {
        1
    } else if resource_type == 40 {
        2
    } else if resource_type == 41 {
        1
    } else if resource_type == 42 {
        2
    } else if resource_type == 43 {
        1
    } else if resource_type == 44 {
        2
    } else if resource_type == 45 {
        1
    } else if resource_type == 46 {
        2
    } else if resource_type == 47 {
        1
    } else if resource_type == 48 {
        2
    } else if resource_type == 49 {
        1
    } else if resource_type == 50 {
        2
    } else if resource_type == 51 {
        1
    } else if resource_type == 52 {
        2
    } else if resource_type == 53 {
        1
    } else if resource_type == 54 {
        2
    } else if resource_type == 55 {
        1
    } else if resource_type == 56 {
        2
    } else {
        panic!("Eternum: not a relic");
    }
}

pub fn relic_essence_cost(resource_type: u8) -> u128 {
    let level = relic_level(resource_type);
    if level == 1 {
        250
    } else if level == 2 {
        500
    } else {
        panic!("Eternum: invalid relic level");
    }
}

pub fn blitz_produceable_resources() -> Array<u8> {
    array![
        ResourceTypes::WOOD, ResourceTypes::COAL, ResourceTypes::COPPER, ResourceTypes::IRONWOOD,
        ResourceTypes::COLD_IRON, ResourceTypes::GOLD, ResourceTypes::ADAMANTINE, ResourceTypes::MITHRAL,
        ResourceTypes::DRAGONHIDE,
    ]
}


pub mod ResourceTiers {
    pub const LORDS: u8 = 1;
    pub const MILITARY: u8 = 2;
    pub const TRANSPORT: u8 = 3;
    pub const FOOD: u8 = 4;
    pub const COMMON: u8 = 5;
    pub const UNCOMMON: u8 = 6;
    pub const RARE: u8 = 7;
    pub const UNIQUE: u8 = 8;
    pub const MYTHIC: u8 = 9;
}


pub fn get_resources_without_earthenshards() -> Span<u8> {
    return array![
        ResourceTypes::WOOD, ResourceTypes::STONE, ResourceTypes::COAL, ResourceTypes::COPPER, ResourceTypes::OBSIDIAN,
        ResourceTypes::SILVER, ResourceTypes::IRONWOOD, ResourceTypes::COLD_IRON, ResourceTypes::GOLD,
        ResourceTypes::HARTWOOD, ResourceTypes::DIAMONDS, ResourceTypes::SAPPHIRE, ResourceTypes::RUBY,
        ResourceTypes::DEEP_CRYSTAL, ResourceTypes::IGNIUM, ResourceTypes::ETHEREAL_SILICA, ResourceTypes::TRUE_ICE,
        ResourceTypes::TWILIGHT_QUARTZ, ResourceTypes::ALCHEMICAL_SILVER, ResourceTypes::ADAMANTINE,
        ResourceTypes::MITHRAL, ResourceTypes::DRAGONHIDE, ResourceTypes::LABOR, ResourceTypes::DONKEY,
        ResourceTypes::KNIGHT_T1, ResourceTypes::KNIGHT_T2, ResourceTypes::KNIGHT_T3, ResourceTypes::CROSSBOWMAN_T1,
        ResourceTypes::CROSSBOWMAN_T2, ResourceTypes::CROSSBOWMAN_T3, ResourceTypes::PALADIN_T1,
        ResourceTypes::PALADIN_T2, ResourceTypes::PALADIN_T3, ResourceTypes::LORDS, ResourceTypes::WHEAT,
        ResourceTypes::FISH,
    ]
        .span();
}

pub fn get_hyperstructure_construction_resources() -> Span<u8> {
    return array![
        ResourceTypes::WOOD, ResourceTypes::STONE, ResourceTypes::COAL, ResourceTypes::COPPER, ResourceTypes::OBSIDIAN,
        ResourceTypes::SILVER, ResourceTypes::IRONWOOD, ResourceTypes::COLD_IRON, ResourceTypes::GOLD,
        ResourceTypes::HARTWOOD, ResourceTypes::DIAMONDS, ResourceTypes::SAPPHIRE, ResourceTypes::RUBY,
        ResourceTypes::DEEP_CRYSTAL, ResourceTypes::IGNIUM, ResourceTypes::ETHEREAL_SILICA, ResourceTypes::TRUE_ICE,
        ResourceTypes::TWILIGHT_QUARTZ, ResourceTypes::ALCHEMICAL_SILVER, ResourceTypes::ADAMANTINE,
        ResourceTypes::MITHRAL, ResourceTypes::DRAGONHIDE,
    ]
        .span();
}

pub fn get_resources_without_earthenshards_probs() -> Span<u128> {
    // 36
    return array![
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]
        .span();
}


// todo: confrm probabilities. esp earthen shards

/// Get resource occurence probabilities
pub fn get_resource_probabilities() -> Span<(u8, u128)> {
    return array![
        (ResourceTypes::WOOD, 2018108), (ResourceTypes::STONE, 1585915), (ResourceTypes::COAL, 1542455),
        (ResourceTypes::COPPER, 1063581), (ResourceTypes::OBSIDIAN, 891750), (ResourceTypes::SILVER, 700604),
        (ResourceTypes::IRONWOOD, 474447), (ResourceTypes::COLD_IRON, 385111), (ResourceTypes::GOLD, 367807),
        (ResourceTypes::HARTWOOD, 239034), (ResourceTypes::DIAMONDS, 120724), (ResourceTypes::SAPPHIRE, 99396),
        (ResourceTypes::RUBY, 96177), (ResourceTypes::DEEP_CRYSTAL, 96177), (ResourceTypes::IGNIUM, 69215),
        (ResourceTypes::ETHEREAL_SILICA, 65191), (ResourceTypes::TRUE_ICE, 55936),
        (ResourceTypes::TWILIGHT_QUARTZ, 44668), (ResourceTypes::ALCHEMICAL_SILVER, 37425),
        (ResourceTypes::ADAMANTINE, 22133), (ResourceTypes::MITHRAL, 14889), (ResourceTypes::DRAGONHIDE, 9256),
        (ResourceTypes::EARTHEN_SHARD, 22133) // SHARDS
    ]
        .span();
}


pub fn split_resources_and_probs() -> (Span<u8>, Span<u128>) {
    let mut zipped = get_resource_probabilities();
    let mut resource_types = array![];
    let mut resource_probabilities = array![];
    loop {
        match zipped.pop_front() {
            Option::Some((
                resource_type, probability,
            )) => {
                resource_types.append(*resource_type);
                resource_probabilities.append(*probability);
            },
            Option::None => { break; },
        }
    }

    return (resource_types.span(), resource_probabilities.span());
}


pub fn get_blitz_exploration_reward() -> Span<(u8, u128, u128)> {
    return array![
        (ResourceTypes::ESSENCE, 100, 3_000), (ResourceTypes::ESSENCE, 250, 2_000),
        (ResourceTypes::ESSENCE, 500, 1_500), (ResourceTypes::LABOR, 250, 1_500), (ResourceTypes::LABOR, 500, 800),
        (ResourceTypes::DONKEY, 100, 600), (ResourceTypes::KNIGHT_T1, 2_500, 200),
        (ResourceTypes::CROSSBOWMAN_T1, 2_500, 200), (ResourceTypes::PALADIN_T1, 2_500, 200),
    ]
        .span();
}

pub fn split_blitz_exploration_reward_and_probs() -> (Span<(u8, u128)>, Span<u128>) {
    let mut zipped = get_blitz_exploration_reward();
    let mut resources = array![];
    let mut resource_probabilities = array![];
    loop {
        match zipped.pop_front() {
            Option::Some((
                resource_type, resource_amount, probability,
            )) => {
                resources.append((*resource_type, *resource_amount));
                resource_probabilities.append(*probability);
            },
            Option::None => { break; },
        }
    }

    return (resources.span(), resource_probabilities.span());
}

pub mod LevelIndex {
    pub const FOOD: u8 = 1;
    pub const RESOURCE: u8 = 2;
    pub const TRAVEL: u8 = 3;
    pub const COMBAT: u8 = 4;
}

pub mod ErrorMessages {
    pub const NOT_OWNER: felt252 = 'Not Owner';
}

pub mod TravelTypes {
    pub const EXPLORE: u8 = 0;
    pub const TRAVEL: u8 = 1;
}


pub fn DEFAULT_NS() -> @ByteArray {
    @"s1_eternum"
}

pub fn DEFAULT_NS_STR() -> ByteArray {
    "s1_eternum"
}
