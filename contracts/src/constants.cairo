use s0_eternum::alias::ID;


// Config ID to fetch global configs
const WORLD_CONFIG_ID: ID = 999999999;
const BUILDING_CONFIG_ID: ID = 999999998;
const TRANSPORT_CONFIG_ID: ID = 999999996;
const ROAD_CONFIG_ID: ID = 999999995;
const COMBAT_CONFIG_ID: ID = 999999994;
const REALM_LEVELING_CONFIG_ID: ID = 999999993;
const HYPERSTRUCTURE_CONFIG_ID: ID = 999999992;
const REALM_FREE_MINT_CONFIG_ID: ID = 999999991;
const BUILDING_CATEGORY_POPULATION_CONFIG_ID: ID = 999999990;
const POPULATION_CONFIG_ID: ID = 999999989;

// 8 bits
const RESOURCE_IDS_PACKED_SIZE: usize = 8_usize;
const REALMS_DATA_PACKED_SIZE: usize = 8_usize;

// leveling tiers
const HYPERSTRUCTURE_LEVELING_START_TIER: u64 = 0;
const REALM_LEVELING_START_TIER: u64 = 1;

const GRAMS_PER_KG: u128 = 1_000;

// max realms per user
const MAX_REALMS_PER_ADDRESS: u16 = 8_000;

// resource precision
const RESOURCE_PRECISION: u128 = 1_000_000_000;


// WONDER QUEST REWARD BOOST
const WONDER_QUEST_REWARD_BOOST: u128 = 3;

// pillage config
// TODO: Move to Onchain config
const MAX_PILLAGE_TRIAL_COUNT: u8 = 7;

// Note: Please update this list whenever ResourceTypes are updated
fn all_resource_ids() -> Array<u8> {
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
        //
        28,
        29,
        //
        249,
        250,
        251,
        252,
        253,
        254,
        255
    ]
}

// Note: Please update the all_resources_ids list whenever ResourceTypes are updated
mod ResourceTypes {
    const STONE: u8 = 1;
    const COAL: u8 = 2;
    const WOOD: u8 = 3;
    const COPPER: u8 = 4;
    const IRONWOOD: u8 = 5;
    const OBSIDIAN: u8 = 6;
    const GOLD: u8 = 7;
    const SILVER: u8 = 8;
    const MITHRAL: u8 = 9;
    const ALCHEMICAL_SILVER: u8 = 10;
    const COLD_IRON: u8 = 11;
    const DEEP_CRYSTAL: u8 = 12;
    const RUBY: u8 = 13;
    const DIAMONDS: u8 = 14;
    const HARTWOOD: u8 = 15;
    const IGNIUM: u8 = 16;
    const TWILIGHT_QUARTZ: u8 = 17;
    const TRUE_ICE: u8 = 18;
    const ADAMANTINE: u8 = 19;
    const SAPPHIRE: u8 = 20;
    const ETHEREAL_SILICA: u8 = 21;
    const DRAGONHIDE: u8 = 22;

    const DEMONHIDE: u8 = 28;
    const EARTHEN_SHARD: u8 = 29;

    // TRANSPORT
    const DONKEY: u8 = 249;

    // TROOPS // @dev: troops are not resources, but they are stored in the same data structure
    const KNIGHT: u8 = 250;
    const CROSSBOWMAN: u8 = 251;
    const PALADIN: u8 = 252;

    const LORDS: u8 = 253;
    const WHEAT: u8 = 254;
    const FISH: u8 = 255;
    // note: update _resource_type_to_position
//  function is any new resources are added
}

fn resource_type_name(resource_type: u8) -> ByteArray {
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
    } else if resource_type == 28 {
        "DEMONHIDE"
    } else if resource_type == 29 {
        "EARTHEN SHARD"
    } else if resource_type == 249 {
        "DONKEY"
    } else if resource_type == 250 {
        "KNIGHT"
    } else if resource_type == 251 {
        "CROSSBOWMAN"
    } else if resource_type == 252 {
        "PALADIN"
    } else if resource_type == 253 {
        "LORDS"
    } else if resource_type == 254 {
        "WHEAT"
    } else if resource_type == 255 {
        "FISH"
    } else {
        format!("{} (unknown resource name)", resource_type)
    }
}


mod ResourceTiers {
    const LORDS: u8 = 1;
    const MILITARY: u8 = 2;
    const TRANSPORT: u8 = 3;
    const FOOD: u8 = 4;
    const COMMON: u8 = 5;
    const UNCOMMON: u8 = 6;
    const RARE: u8 = 7;
    const UNIQUE: u8 = 8;
    const MYTHIC: u8 = 9;
}

fn get_resource_tier(resource_type: u8) -> u8 {
    if resource_type == ResourceTypes::LORDS || resource_type == ResourceTypes::EARTHEN_SHARD {
        ResourceTiers::LORDS
    } else if resource_type == ResourceTypes::KNIGHT
        || resource_type == ResourceTypes::CROSSBOWMAN
        || resource_type == ResourceTypes::PALADIN {
        ResourceTiers::MILITARY
    } else if resource_type == ResourceTypes::DONKEY {
        ResourceTiers::TRANSPORT
    } else if resource_type == ResourceTypes::WHEAT || resource_type == ResourceTypes::FISH {
        ResourceTiers::FOOD
    } else if resource_type == ResourceTypes::WOOD
        || resource_type == ResourceTypes::STONE
        || resource_type == ResourceTypes::COAL
        || resource_type == ResourceTypes::COPPER
        || resource_type == ResourceTypes::OBSIDIAN {
        ResourceTiers::COMMON
    } else if resource_type == ResourceTypes::SILVER
        || resource_type == ResourceTypes::IRONWOOD
        || resource_type == ResourceTypes::COLD_IRON
        || resource_type == ResourceTypes::GOLD {
        ResourceTiers::UNCOMMON
    } else if resource_type == ResourceTypes::HARTWOOD
        || resource_type == ResourceTypes::DIAMONDS
        || resource_type == ResourceTypes::SAPPHIRE
        || resource_type == ResourceTypes::RUBY {
        ResourceTiers::RARE
    } else if resource_type == ResourceTypes::DEEP_CRYSTAL
        || resource_type == ResourceTypes::IGNIUM
        || resource_type == ResourceTypes::ETHEREAL_SILICA
        || resource_type == ResourceTypes::TRUE_ICE
        || resource_type == ResourceTypes::TWILIGHT_QUARTZ
        || resource_type == ResourceTypes::ALCHEMICAL_SILVER {
        ResourceTiers::UNIQUE
    } else if resource_type == ResourceTypes::ADAMANTINE
        || resource_type == ResourceTypes::MITHRAL
        || resource_type == ResourceTypes::DRAGONHIDE {
        ResourceTiers::MYTHIC
    } else {
        panic!("Unknown resource tier for resource id {}", resource_type);
        0
    }
}


fn get_resources_without_earthenshards() -> Span<u8> {
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
        ResourceTypes::DEMONHIDE,
        ResourceTypes::DONKEY,
        ResourceTypes::KNIGHT,
        ResourceTypes::CROSSBOWMAN,
        ResourceTypes::PALADIN,
        ResourceTypes::LORDS,
        ResourceTypes::WHEAT,
        ResourceTypes::FISH,
    ]
        .span();
}

fn get_hyperstructure_construction_resources() -> Span<u8> {
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
        ResourceTypes::DRAGONHIDE
    ]
        .span();
}

fn get_contributable_resources_with_rarity() -> Span<(u8, u128)> {
    return array![
        (ResourceTypes::WOOD, 100),
        (ResourceTypes::STONE, 127),
        (ResourceTypes::COAL, 131),
        (ResourceTypes::COPPER, 190),
        (ResourceTypes::OBSIDIAN, 226),
        (ResourceTypes::SILVER, 288),
        (ResourceTypes::IRONWOOD, 425),
        (ResourceTypes::COLD_IRON, 524),
        (ResourceTypes::GOLD, 549),
        (ResourceTypes::HARTWOOD, 844),
        (ResourceTypes::DIAMONDS, 1672),
        (ResourceTypes::SAPPHIRE, 2030),
        (ResourceTypes::RUBY, 2098),
        (ResourceTypes::DEEP_CRYSTAL, 2098),
        (ResourceTypes::IGNIUM, 2915),
        (ResourceTypes::ETHEREAL_SILICA, 3095),
        (ResourceTypes::TRUE_ICE, 3606),
        (ResourceTypes::TWILIGHT_QUARTZ, 4518),
        (ResourceTypes::ALCHEMICAL_SILVER, 5392),
        (ResourceTypes::ADAMANTINE, 9120),
        (ResourceTypes::MITHRAL, 13553),
        (ResourceTypes::DRAGONHIDE, 21792),
        (ResourceTypes::EARTHEN_SHARD, 2098)
    ]
        .span();
}

fn get_resources_without_earthenshards_probs() -> Span<u128> {
    // 35
    return array![1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].span();
}


/// Get resource occurence probabilities
fn get_resource_probabilities() -> Span<(u8, u128)> {
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
        (ResourceTypes::EARTHEN_SHARD, 22133), // SHARDS
    ]
        .span();
}


fn split_resources_and_probs() -> (Span<u8>, Span<u128>) {
    let mut zipped = get_resource_probabilities();
    let mut resource_types = array![];
    let mut resource_probabilities = array![];
    loop {
        match zipped.pop_front() {
            Option::Some((
                resource_type, probability
            )) => {
                resource_types.append(*resource_type);
                resource_probabilities.append(*probability);
            },
            Option::None => { break; },
        }
    };

    return (resource_types.span(), resource_probabilities.span());
}


// DISCUSS: instead of using constants for entity_type, store the entity_type in the storage
// DISCUSS: register each new entity_type to the system by creating an entity containing the config
// components Using DONKEY_ENTITY_TYPE I can look up the speed and capacity of that entity when
// creating it
const DONKEY_ENTITY_TYPE: u32 = 256;
const REALM_ENTITY_TYPE: u32 = 257;
const ARMY_ENTITY_TYPE: u32 = 258;

mod LevelIndex {
    const FOOD: u8 = 1;
    const RESOURCE: u8 = 2;
    const TRAVEL: u8 = 3;
    const COMBAT: u8 = 4;
}

mod ErrorMessages {
    const NOT_OWNER: felt252 = 'Not Owner';
}

mod TickIds {
    const DEFAULT: u8 = 0;
    const ARMIES: u8 = 1;
}

mod TravelTypes {
    const EXPLORE: u8 = 0;
    const TRAVEL: u8 = 1;
}


fn DEFAULT_NS() -> @ByteArray {
    @"s0_eternum"
}

fn DEFAULT_NS_STR() -> ByteArray {
    "s0_eternum"
}
