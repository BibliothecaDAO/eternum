use eternum::alias::ID;


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

// max realms per user
const MAX_REALMS_PER_ADDRESS: u8 = 5;

// resource precision
const RESOURCE_PRECISION: u128 = 1_000;

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
    const WOOD: u8 = 1;
    const STONE: u8 = 2;
    const COAL: u8 = 3;
    const COPPER: u8 = 4;
    const OBSIDIAN: u8 = 5;
    const SILVER: u8 = 6;
    const IRONWOOD: u8 = 7;
    const COLD_IRON: u8 = 8;
    const GOLD: u8 = 9;
    const HARTWOOD: u8 = 10;
    const DIAMONDS: u8 = 11;
    const SAPPHIRE: u8 = 12;
    const RUBY: u8 = 13;
    const DEEP_CRYSTAL: u8 = 14;
    const IGNIUM: u8 = 15;
    const ETHEREAL_SILICA: u8 = 16;
    const TRUE_ICE: u8 = 17;
    const TWILIGHT_QUARTZ: u8 = 18;
    const ALCHEMICAL_SILVER: u8 = 19;
    const ADAMANTINE: u8 = 20;
    const MITHRAL: u8 = 21;
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
        "WOOD"
    } else if resource_type == 2 {
        "STONE"
    } else if resource_type == 3 {
        "COAL"
    } else if resource_type == 4 {
        "COPPER"
    } else if resource_type == 5 {
        "OBSIDIAN"
    } else if resource_type == 6 {
        "SILVER"
    } else if resource_type == 7 {
        "IRONWOOD"
    } else if resource_type == 8 {
        "COLD IRON"
    } else if resource_type == 9 {
        "GOLD"
    } else if resource_type == 10 {
        "HARTWOOD"
    } else if resource_type == 11 {
        "DIAMONDS"
    } else if resource_type == 12 {
        "SAPPHIRE"
    } else if resource_type == 13 {
        "RUBY"
    } else if resource_type == 14 {
        "DEEP CRYSTAL"
    } else if resource_type == 15 {
        "IGNIUM"
    } else if resource_type == 16 {
        "ETHEREAL SILICA"
    } else if resource_type == 17 {
        "TRUE ICE"
    } else if resource_type == 18 {
        "TWILIGHT QUARTZ"
    } else if resource_type == 19 {
        "ALCHEMICAL SILVER"
    } else if resource_type == 20 {
        "ADAMANTINE"
    } else if resource_type == 21 {
        "MITHRAL"
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
// DISCUSS: register each new entity_type to the system by creating an entity containing the config components
// Using DONKEY_ENTITY_TYPE I can look up the speed and capacity of that entity when creating it
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
