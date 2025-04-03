use core::num::traits::Bounded;
use s1_eternum::alias::ID;


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

// Note: Please update this list whenever ResourceTypes are updated
pub fn all_resource_ids() -> Array<u8> {
    array![
        //
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
    ]
}

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
    } else {
        format!("{} (unknown resource name)", resource_type)
    }
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
        ResourceTypes::WOOD,
        ResourceTypes::STONE,
        ResourceTypes::COAL,
        ResourceTypes::COPPER,
        ResourceTypes::OBSIDIAN,
        ResourceTypes::SILVER,
        ResourceTypes::IRONWOOD,
        ResourceTypes::COLD_IRON,
        ResourceTypes::GOLD,
        ResourceTypes::HARTWOOD,
        ResourceTypes::DIAMONDS,
        ResourceTypes::SAPPHIRE,
        ResourceTypes::RUBY,
        ResourceTypes::DEEP_CRYSTAL,
        ResourceTypes::IGNIUM,
        ResourceTypes::ETHEREAL_SILICA,
        ResourceTypes::TRUE_ICE,
        ResourceTypes::TWILIGHT_QUARTZ,
        ResourceTypes::ALCHEMICAL_SILVER,
        ResourceTypes::ADAMANTINE,
        ResourceTypes::MITHRAL,
        ResourceTypes::DRAGONHIDE,
        ResourceTypes::LABOR,
        ResourceTypes::DONKEY,
        ResourceTypes::KNIGHT_T1,
        ResourceTypes::KNIGHT_T2,
        ResourceTypes::KNIGHT_T3,
        ResourceTypes::CROSSBOWMAN_T1,
        ResourceTypes::CROSSBOWMAN_T2,
        ResourceTypes::CROSSBOWMAN_T3,
        ResourceTypes::PALADIN_T1,
        ResourceTypes::PALADIN_T2,
        ResourceTypes::PALADIN_T3,
        ResourceTypes::LORDS,
        ResourceTypes::WHEAT,
        ResourceTypes::FISH,
    ]
        .span();
}

pub fn get_hyperstructure_construction_resources() -> Span<u8> {
    return array![
        ResourceTypes::WOOD,
        ResourceTypes::STONE,
        ResourceTypes::COAL,
        ResourceTypes::COPPER,
        ResourceTypes::OBSIDIAN,
        ResourceTypes::SILVER,
        ResourceTypes::IRONWOOD,
        ResourceTypes::COLD_IRON,
        ResourceTypes::GOLD,
        ResourceTypes::HARTWOOD,
        ResourceTypes::DIAMONDS,
        ResourceTypes::SAPPHIRE,
        ResourceTypes::RUBY,
        ResourceTypes::DEEP_CRYSTAL,
        ResourceTypes::IGNIUM,
        ResourceTypes::ETHEREAL_SILICA,
        ResourceTypes::TRUE_ICE,
        ResourceTypes::TWILIGHT_QUARTZ,
        ResourceTypes::ALCHEMICAL_SILVER,
        ResourceTypes::ADAMANTINE,
        ResourceTypes::MITHRAL,
        ResourceTypes::DRAGONHIDE,
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
        (ResourceTypes::WOOD, 2018108),
        (ResourceTypes::STONE, 1585915),
        (ResourceTypes::COAL, 1542455),
        (ResourceTypes::COPPER, 1063581),
        (ResourceTypes::OBSIDIAN, 891750),
        (ResourceTypes::SILVER, 700604),
        (ResourceTypes::IRONWOOD, 474447),
        (ResourceTypes::COLD_IRON, 385111),
        (ResourceTypes::GOLD, 367807),
        (ResourceTypes::HARTWOOD, 239034),
        (ResourceTypes::DIAMONDS, 120724),
        (ResourceTypes::SAPPHIRE, 99396),
        (ResourceTypes::RUBY, 96177),
        (ResourceTypes::DEEP_CRYSTAL, 96177),
        (ResourceTypes::IGNIUM, 69215),
        (ResourceTypes::ETHEREAL_SILICA, 65191),
        (ResourceTypes::TRUE_ICE, 55936),
        (ResourceTypes::TWILIGHT_QUARTZ, 44668),
        (ResourceTypes::ALCHEMICAL_SILVER, 37425),
        (ResourceTypes::ADAMANTINE, 22133),
        (ResourceTypes::MITHRAL, 14889),
        (ResourceTypes::DRAGONHIDE, 9256),
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
    };

    return (resource_types.span(), resource_probabilities.span());
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
