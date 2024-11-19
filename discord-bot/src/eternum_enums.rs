use num_enum::FromPrimitive;

#[derive(FromPrimitive, Debug, Clone, Copy, strum_macros::Display)]
#[repr(u8)]
pub enum ResourceIds {
    #[num_enum(default)]
    Unknown,
    Stone = 1,
    Coal = 2,
    Wood = 3,
    Copper = 4,
    Ironwood = 5,
    Obsidian = 6,
    Gold = 7,
    Silver = 8,
    Mithral = 9,
    #[strum(serialize = "Alchemical Silver")]
    AlchemicalSilver = 10,
    #[strum(serialize = "Cold Iron")]
    ColdIron = 11,
    #[strum(serialize = "Deep Crystal")]
    DeepCrystal = 12,
    Ruby = 13,
    Diamonds = 14,
    Hartwood = 15,
    Ignium = 16,
    #[strum(serialize = "Twilight Quartz")]
    TwilightQuartz = 17,
    #[strum(serialize = "True Ice")]
    TrueIce = 18,
    Adamantine = 19,
    Sapphire = 20,
    #[strum(serialize = "Ethereal Silica")]
    EtherealSilica = 21,
    Dragonhide = 22,
    #[strum(serialize = "Ancient Fragment")]
    AncientFragment = 29,
    Donkey = 249,
    Knight = 250,
    Crossbowman = 251,
    Paladin = 252,
    Lords = 253,
    Wheat = 254,
    Fish = 255,
}

#[derive(FromPrimitive, Debug, Clone, Copy, strum_macros::Display)]
#[repr(u8)]
pub enum StructureCategory {
    #[num_enum(default)]
    NoValue,
    Realm,
    Hyperstructure,
    Bank,
    #[strum(serialize = "Fragment mine")]
    FragmentMine,
}

#[derive(FromPrimitive, Debug, Clone, Copy, strum_macros::Display)]
#[repr(u8)]
pub enum BuildingCategory {
    #[num_enum(default)]
    NoValue,
    Castle,
    Resource,
    Farm,
    #[strum(serialize = "Fishing Village")]
    FishingVillage,
    Barracks,
    Market,
    #[strum(serialize = "Archery Range")]
    ArcheryRange,
    Stable,
    #[strum(serialize = "Trading Post")]
    TradingPost,
    #[strum(serialize = "Workers Hut")]
    WorkersHut,
    #[strum(serialize = "Watch Tower")]
    WatchTower,
    Walls,
    Storehouse,
}

#[derive(FromPrimitive, Debug, Clone, Copy, strum_macros::Display)]
#[repr(u8)]
pub enum BattleSide {
    #[num_enum(default)]
    NoValue,
    Attack,
    Defence,
}
