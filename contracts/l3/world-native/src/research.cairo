use crate::resources::ResourceKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmKnowledge {
    pub learned: u64,
}

pub const ROW_FARM: u8 = 0;
pub const ROW_WORKSHOP: u8 = 1;
pub const ROW_CONSCRIPTION: u8 = 2;
pub const ROW_RATIONS: u8 = 4;
pub const ROW_SUPPLY_YARD: u8 = 5;
pub const ROW_KNIGHT_OATHS: u8 = 6;
pub const ROW_SCOUT_OATHS: u8 = 7;
pub const ROW_CROSSBOW_OATHS: u8 = 11;
pub const OATH_SLOTS_BASE: u8 = 2;
pub const OATH_SLOTS_STEPS: u8 = 3;
pub const ROW_LORE: u8 = 10;
pub const LORE_WELLS: u8 = 1;
pub const LORE_SHRINES: u8 = 2;
pub const LORE_SPIRES: u8 = 3;
pub const LORE_SHRINES_LEVEL: u8 = 1;
pub const LORE_SPIRES_LEVEL: u8 = 2;


// Building categories used by construction and research.
pub const STOREROOM: u8 = 2;
pub const STOREROOM_LEVEL: u8 = 1;
pub const WORKSHOP: u8 = 25;
pub const BARRACKS: u8 = 28;
pub const RANGE: u8 = 31;
pub const RATIONS_DEPOT: u8 = 41;
pub const CONSCRIPTION_CAMP: u8 = 44;
pub const RANGE_LEVEL: u8 = 1;
pub const CONSCRIPTION_CAMP_LEVEL: u8 = 1;
pub const RATIONS_DEPOT_LEVEL: u8 = 2;
pub const FARM: u8 = 37;
pub const SUPPLY_YARD: u8 = 42;
pub const SUPPLY_YARD_LEVEL: u8 = 2;
pub const SCOUTS_LODGE: u8 = 43;
pub const SCOUTS_LODGE_LEVEL: u8 = 1;

// A tier's price at the castle. Building rows charge Essence and labor; castle rows charge Essence only.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResearchPrice {
    pub essence: u128,
    pub labor: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Research {
    pub structure_id: u64,
    pub row: u8,
}

pub fn row_category(row: u8) -> u8 {
    if row == ROW_FARM {
        FARM
    } else if row == ROW_WORKSHOP {
        WORKSHOP
    } else if row == ROW_CONSCRIPTION {
        CONSCRIPTION_CAMP
    } else if row == ROW_RATIONS {
        RATIONS_DEPOT
    } else if row == ROW_SUPPLY_YARD {
        SUPPLY_YARD
    } else if row == ROW_KNIGHT_OATHS {
        BARRACKS
    } else if row == ROW_SCOUT_OATHS {
        SCOUTS_LODGE
    } else if row == ROW_CROSSBOW_OATHS {
        RANGE
    } else if row == ROW_LORE {
        0
    } else {
        panic!("invalid research row")
    }
}

pub fn is_training(category: u8) -> bool {
    category == SUPPLY_YARD || category == CONSCRIPTION_CAMP || category == RATIONS_DEPOT
}

pub fn one_per_realm(category: u8) -> bool {
    is_training(category) || category == STOREROOM
}

pub fn lore_opens_at_level(tier: u8) -> u8 {
    if tier >= LORE_SPIRES {
        LORE_SPIRES_LEVEL
    } else if tier == LORE_SHRINES {
        LORE_SHRINES_LEVEL
    } else {
        0
    }
}

pub fn opens_at_level(category: u8) -> u8 {
    if category == SCOUTS_LODGE {
        SCOUTS_LODGE_LEVEL
    } else if category == RANGE {
        RANGE_LEVEL
    } else if category == CONSCRIPTION_CAMP {
        CONSCRIPTION_CAMP_LEVEL
    } else if category == STOREROOM {
        STOREROOM_LEVEL
    } else if category == RATIONS_DEPOT {
        RATIONS_DEPOT_LEVEL
    } else if category == SUPPLY_YARD {
        SUPPLY_YARD_LEVEL
    } else {
        0
    }
}

pub const ROWS: [u8; 9] = [
    ROW_FARM, ROW_WORKSHOP, ROW_CONSCRIPTION, ROW_RATIONS, ROW_SUPPLY_YARD, ROW_KNIGHT_OATHS, ROW_SCOUT_OATHS,
    ROW_CROSSBOW_OATHS, ROW_LORE,
];

pub fn is_oath_row(row: u8) -> bool {
    row == ROW_KNIGHT_OATHS || row == ROW_SCOUT_OATHS || row == ROW_CROSSBOW_OATHS
}

pub fn oath_slots(learned: u64, category: crate::troops::TroopType) -> u8 {
    let row = match category {
        crate::troops::TroopType::Knight => ROW_KNIGHT_OATHS,
        crate::troops::TroopType::Crossbowman => ROW_CROSSBOW_OATHS,
        crate::troops::TroopType::Paladin => ROW_SCOUT_OATHS,
    };
    OATH_SLOTS_BASE + tier(learned, row)
}

pub fn max_tier(row: u8) -> u8 {
    if row == ROW_FARM
        || row == ROW_WORKSHOP
        || row == ROW_SUPPLY_YARD
        || row == ROW_CONSCRIPTION
        || row == ROW_RATIONS {
        5
    } else if is_oath_row(row) {
        OATH_SLOTS_STEPS
    } else if row == ROW_LORE {
        LORE_SPIRES
    } else {
        panic!("invalid research row")
    }
}

// Where a row's tier sits in `learned`: its scale and its field size.
fn tier_slot(row: u8) -> (u64, u64) {
    match row {
        0 => (0x1, 8),
        1 => (0x80, 8),
        2 => (0x4000, 8),
        4 => (0x1000000, 8),
        5 => (0x8000000, 8),
        6 => (0x40000000, 4),
        7 => (0x100000000, 4),
        11 => (0x400000000, 4),
        10 => (0x1000000000000, 4),
        _ => panic!("invalid research row"),
    }
}

pub fn tier(learned: u64, row: u8) -> u8 {
    let (scale, size) = tier_slot(row);
    (learned / scale % size).try_into().unwrap()
}

pub fn make_picks(learned: u64, category: u8) -> u8 {
    if category == FARM {
        tier(learned, ROW_FARM)
    } else if category == WORKSHOP {
        tier(learned, ROW_WORKSHOP)
    } else if category == BARRACKS || category == RANGE || category == SCOUTS_LODGE {
        tier(learned, ROW_CONSCRIPTION)
    } else {
        0
    }
}

pub fn learn(learned: u64, row: u8) -> u64 {
    assert!(tier(learned, row) < max_tier(row), "research row is complete");
    let (scale, _) = tier_slot(row);
    learned + scale
}

#[starknet::interface]
pub trait IResearch<T> {
    fn research(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: Research,
        context: crate::commands::ActionContext,
    );
    fn realm_knowledge(self: @T, key: ResourceKey) -> Option<RealmKnowledge>;
}
