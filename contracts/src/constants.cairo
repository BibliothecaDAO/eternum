use eternum::alias::ID;

// Config ID to fetch global configs
const WORLD_CONFIG_ID: u128 = 999999999999999999;
const BUILDING_CONFIG_ID: u128 = 999999999999999998;
// DISCUSS: these config IDs are used to query a global config for a set of systems (like labor systems)
// and are not linked to a specific entity_type, 
// e.g. LaborConfig holds a set of configuration values 
// that are used for all labor, regardless of the resource
// - base_labor_units
// - base_resources_per_cycle
const LABOR_CONFIG_ID: u128 = 999999999999999997;
const TRANSPORT_CONFIG_ID: u128 = 999999999999999996;
const ROAD_CONFIG_ID: u128 = 999999999999999995;

// 8 bits
const RESOURCE_IDS_PACKED_SIZE: usize = 8_usize;
const REALMS_DATA_PACKED_SIZE: usize = 8_usize;

// LORDS
const LORDS_ID: u128 = 999999999999999996;

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
    const DESERT_GLASS: u8 = 23;
    const DIVINE_CLOTH: u8 = 24;
    const CURIOUS_SPORE: u8 = 25;
    const UNREFINED_ORE: u8 = 26;
    const SUNKEN_SHEKEL: u8 = 27;
    const DEMONHIDE: u8 = 28;
    const SHEKELS: u8 = 253;
    const WHEAT: u8 = 254;
    const FISH: u8 = 255;
}

// DISCUSS: instead of using constants for entity_type, store the entity_type in the storage
// DISCUSS: register each new entity_type to the system by creating an entity containing the config components
// Using FREE_TRANSPORT_ENTITY_TYPE I can look up the speed and capacity of that entity when creating it
const FREE_TRANSPORT_ENTITY_TYPE: u128 = 256;
const REALM_ENTITY_TYPE: u128 = 257;

// TODO: change to consts
enum BuildingTypes {
    HOUSE: u8,
    STORE_HOUSE: u8,
    GRANARY: u8,
    FARM: u8,
    FISHING_VILLAGE: u8,
    BARACKS: u8,
    MAGE_TOWER: u8,
    ARCHER_TOWER: u8,
    CASTLE: u8,
}
