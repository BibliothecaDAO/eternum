#[cfg(not(feature: "blitz"))]
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Discovery {
    None,
    Camp,
    Rift,
    Ruin: crate::army_relics::ArmyRelic,
    Beasts,
    Shrine,
    Well,
    Spire,
}

#[cfg(feature: "blitz")]
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Discovery {
    None,
    Camp,
    Rift,
    Ruin: crate::army_relics::ArmyRelic,
    Beasts,
    Shrine,
    Well,
    Spire,
    Mine,
    Hyperstructure,
}

// One categorical draw per reveal. After `empty_reveal_limit` empty reveals in a row the draw covers only the kinds
// still allowed. Each ruin carries its relic from discovery until the winning army clears it.
pub fn frontier(
    rules: crate::expeditions::FrontierDiscoveryRules,
    find_percent: u16,
    empty_reveals: u8,
    ruin: Option<crate::army_relics::ArmyRelic>,
    seed: u256,
) -> Discovery {
    let camp: u128 = rules.camp_bps.into();
    let rift: u128 = rules.rift_bps.into();
    let shrine: u128 = rules.shrine_bps.into();
    let well: u128 = rules.well_bps.into();
    let (ruin_kind, ruin_weight): (Discovery, u128) = match ruin {
        Some(reward) => (Discovery::Ruin(reward), rules.ruin_bps.into()),
        None => (Discovery::None, 0),
    };
    let kinds = array![
        (Discovery::Beasts, rules.beasts_bps.into()), (Discovery::Camp, camp), (Discovery::Rift, rift),
        (ruin_kind, ruin_weight), (Discovery::Shrine, shrine), (Discovery::Well, well),
    ];
    let mut total: u128 = 0;
    for (_, weight) in kinds.span() {
        total += *weight * find_percent.into() / 100;
    }
    let floor = empty_reveals >= rules.empty_reveal_limit;
    let mut draw = crate::random::range(seed, 29, if floor {
        total
    } else {
        10000
    });
    for (kind, base) in kinds {
        let weight = base * find_percent.into() / 100;
        if draw < weight {
            return kind;
        }
        draw -= weight;
    }
    Discovery::None
}

pub fn is_frontier_site(occupancy: Option<crate::map::TileOccupancy>) -> bool {
    match occupancy {
        Option::Some(site) => !site.is_structure
            && (site.category == crate::taxonomy::SHRINE_OCCUPIER || site.category == crate::taxonomy::WELL_OCCUPIER),
        Option::None => false,
    }
}

pub fn tile_occupier(discovery: Discovery) -> Option<u8> {
    match discovery {
        Discovery::Shrine => Some(crate::taxonomy::SHRINE_OCCUPIER),
        Discovery::Well => Some(crate::taxonomy::WELL_OCCUPIER),
        Discovery::Spire => Some(crate::taxonomy::DORMANT_SPIRE_OCCUPIER),
        _ => None,
    }
}


#[starknet::interface]
pub trait IExpeditionReveal<T> {
    fn reveal_expedition_tile(
        ref self: T, key: crate::map::TileKey, explorer_id: u64, seed: u256, context: crate::commands::ActionContext,
    ) -> Discovery;
}
