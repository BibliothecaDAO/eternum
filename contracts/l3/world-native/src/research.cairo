use crate::resources::ResourceKey;

// Everything a realm has researched, in one word: each row's tier and the choice made at each tier (see `tier_slot`
// and `choice_slot` for the layout).
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmKnowledge {
    pub learned: u64,
}

// The rows of the castle's tree. A building row climbs from common to legendary for every building of its type; the
// castle rows unlock shrines, wells and the three depths.
pub const ROW_FARM: u8 = 0;
pub const ROW_WORKSHOP: u8 = 1;
pub const ROW_BARRACKS: u8 = 2;
pub const ROW_HUT: u8 = 3;
pub const ROW_WAR_HALL: u8 = 4;
pub const ROW_SUPPLY_YARD: u8 = 5;
pub const ROW_SCOUTS_LODGE: u8 = 6;
pub const ROW_HEARTH: u8 = 7;
pub const ROW_SHRINE: u8 = 8;
pub const ROW_WELL: u8 = 9;
pub const ROW_DEPTH: u8 = 10;
pub const ROW_COUNT: u8 = 11;

// Farm and Workshop tiers make more (Fields, Tools) or store more (Granary, Storeroom); Barracks tiers make more troops
// (Drill) or deploy them for less wheat (Rations).
pub const CHOICE_MAKE: u8 = 0;
pub const CHOICE_STORE: u8 = 1;
pub const CHOICE_DRILL: u8 = 0;
pub const CHOICE_RATIONS: u8 = 1;
// The kind each Scouts' lodge tier finds more of.
pub const KIND_CAMPS: u8 = 0;
pub const KIND_RIFTS: u8 = 1;
pub const KIND_STRAGGLERS: u8 = 2;

// Building categories with a row; the four training buildings are unique on a realm board.
pub const HUT: u8 = 1;
pub const WORKSHOP: u8 = 25;
pub const BARRACKS: u8 = 28;
pub const FARM: u8 = 37;
pub const WAR_HALL: u8 = 41;
pub const SUPPLY_YARD: u8 = 42;
pub const SCOUTS_LODGE: u8 = 43;
pub const HEARTH: u8 = 44;

// A tier's price at the castle. Building rows charge Essence and labor; castle rows charge Essence only.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResearchPrice {
    pub essence: u128,
    pub labor: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResearchPriceConfig {
    pub row: u8,
    pub tier: u8,
    pub price: ResearchPrice,
}

// Buys the next tier of a row. `choice` picks the tier's side on Farm, Workshop and Barracks rows and the kind on the
// Scouts' lodge row; every other row takes 0.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Research {
    pub structure_id: u64,
    pub row: u8,
    pub choice: u8,
}

pub fn row_category(row: u8) -> u8 {
    match row {
        0 => FARM,
        1 => WORKSHOP,
        2 => BARRACKS,
        3 => HUT,
        4 => WAR_HALL,
        5 => SUPPLY_YARD,
        6 => SCOUTS_LODGE,
        7 => HEARTH,
        _ => {
            assert!(row < ROW_COUNT, "invalid research row");
            0
        },
    }
}

pub fn is_training(category: u8) -> bool {
    category >= WAR_HALL && category <= HEARTH
}

pub fn max_tier(row: u8) -> u8 {
    match row {
        8 | 9 => 1,
        10 => 3,
        _ => {
            assert!(row < ROW_COUNT, "invalid research row");
            4
        },
    }
}

// How many sides a row's choice has: two for Farm, Workshop and Barracks, three kinds for the Scouts' lodge.
pub fn choice_count(row: u8) -> u8 {
    match row {
        0 | 1 | 2 => 2,
        6 => 3,
        _ => 1,
    }
}

// Where a row's tier sits in `learned`: its scale and its field size.
fn tier_slot(row: u8) -> (u64, u64) {
    match row {
        0 => (0x1, 8),
        1 => (0x80, 8),
        2 => (0x4000, 8),
        3 => (0x200000, 8),
        4 => (0x1000000, 8),
        5 => (0x8000000, 8),
        6 => (0x40000000, 8),
        7 => (0x200000000, 8),
        8 => (0x100000000000, 2),
        9 => (0x200000000000, 2),
        10 => (0x400000000000, 4),
        _ => panic!("invalid research row"),
    }
}

// Where a row's choices sit: the first tier's scale and the field size of one choice. Later tiers follow in order.
fn choice_slot(row: u8) -> (u64, u64) {
    match row {
        0 => (0x8, 2),
        1 => (0x400, 2),
        2 => (0x20000, 2),
        6 => (0x1000000000, 4),
        _ => panic!("research row has no choice"),
    }
}

pub fn tier(learned: u64, row: u8) -> u8 {
    let (scale, size) = tier_slot(row);
    (learned / scale % size).try_into().unwrap()
}

// The choice made at a tier, from 1 (uncommon) up to the row's tier.
pub fn choice(learned: u64, row: u8, at: u8) -> u8 {
    assert!(at > 0 && at <= tier(learned, row), "tier is not learned");
    let (mut scale, size) = choice_slot(row);
    for _ in 1..at {
        scale *= size;
    }
    (learned / scale % size).try_into().unwrap()
}

// How many of a row's learned tiers took `side`.
pub fn picks(learned: u64, row: u8, side: u8) -> u8 {
    let mut count = 0;
    for at in 1..tier(learned, row) + 1 {
        if choice(learned, row, at) == side {
            count += 1;
        }
    }
    count
}

// The Fields, Tools or Drill picks of a building type; a type without a make-or-store row has none.
pub fn make_picks(learned: u64, category: u8) -> u8 {
    if category == FARM {
        picks(learned, ROW_FARM, CHOICE_MAKE)
    } else if category == WORKSHOP {
        picks(learned, ROW_WORKSHOP, CHOICE_MAKE)
    } else if category == BARRACKS {
        picks(learned, ROW_BARRACKS, CHOICE_DRILL)
    } else {
        0
    }
}

// Adds a row's next tier with its choice.
pub fn learn(learned: u64, row: u8, side: u8) -> u64 {
    let next = tier(learned, row) + 1;
    assert!(next <= max_tier(row), "research row is complete");
    assert!(side < choice_count(row), "invalid research choice");
    let (scale, _) = tier_slot(row);
    let mut learned = learned + scale;
    if choice_count(row) > 1 {
        let (mut scale, size) = choice_slot(row);
        for _ in 1..next {
            scale *= size;
        }
        learned += Into::<u8, u64>::into(side) * scale;
    }
    learned
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
    #[cfg(test)]
    fn research_price(self: @T, game_id: u32, row: u8, tier: u8) -> ResearchPrice;
}
