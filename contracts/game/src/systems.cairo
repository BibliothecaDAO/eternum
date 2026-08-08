pub mod artificer {
    pub mod contracts;

    #[cfg(test)]
    mod tests;
}

pub mod registrar {
    pub mod contracts;

    #[cfg(test)]
    mod tests;
}

// Legacy per-world config replay retired in favor of registrar-owned presets (D2/D12).
// pub mod config {
//     pub mod contracts;
//     #[cfg(test)]
//     mod tests;
// }

// Excluded from the Blitz-core world (single-world migration, D15 in
// docs/plans/appchain-single-world-a0-audit.md) — restore for the Eternum port (Phase 3).
// pub mod village {
//     pub mod contracts;
//     #[cfg(test)]
//     mod tests;
// }

pub mod structure {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
pub mod realm {
    pub mod blitz {
        pub mod contracts;
        pub mod hyperstructure_create {
            pub mod contracts;
        }
    }
    // Excluded from the Blitz-core world (D15) — season-pass settling path.
    // pub mod season {
    //     pub mod contracts;
    // }
    pub mod utils {
        pub mod contracts;
    }
}
// Excluded from the Blitz-core world (D15) — trade is disabled in Blitz presets.
// pub mod trade {
//     pub mod contracts;
//     #[cfg(test)]
//     mod tests;
// }
pub mod resources {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

pub mod name {
    pub mod contracts;
}
pub mod hyperstructure {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
pub mod production {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

// Excluded from the production Blitz-core world (D15) — unrestricted developer
// minting remains available only in the legacy Eternum deployment.
// pub mod dev {
//     pub mod contracts;
// }
pub mod combat {
    #[cfg(test)]
    mod tests {
        mod test_troop_battle;
        mod test_troop_management;
        mod test_troop_movement;
    }
    pub mod contracts {
        pub mod troop_battle;
        pub mod troop_management;
        pub mod troop_movement;
        // Raids are rejected by Blitz mode and excluded from the Blitz-core world (D15).
    // pub mod troop_raid;
    }
}
// Excluded from the Blitz-core world (D15) — Blitz never creates banks.
// pub mod bank {
//     pub mod contracts;
//     #[cfg(test)]
//     mod tests;
// }
pub mod guild {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

pub mod ownership {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
// Excluded from the Blitz-core world (D15) — Blitz games end by timestamp; season_close
// writes the singleton clock and is Eternum-season-only.
// pub mod season {
//     pub mod contracts;
//     #[cfg(test)]
//     mod tests;
// }

pub mod utils {
    pub mod blitz_exploration;
    pub mod blitz_profile;
    pub mod camp;
    pub mod distance;
    pub mod donkey;
    pub mod erc20;
    pub mod hyperstructure;
    pub mod map;
    pub mod mmr;
    pub mod prize;
    pub mod realm;
    pub mod relic;
    pub mod resource;
    pub mod series_chest_reward;
    pub mod structure;
    pub mod troop;
    // Season-only helpers excluded from the Blitz-core build (D15).
// pub mod bitcoin_mine;
// pub mod bridge;
// pub mod holysite;
// pub mod mine;
// pub mod village;
}

// pub mod quest {
//     pub mod constants;
//     pub mod contracts;
// }

pub mod prize_distribution {
    pub mod contracts;
}

pub mod points {
    pub mod contracts;
}

pub mod relic {
    pub mod contracts;
}

pub mod mmr {
    pub mod contracts;
    #[cfg(test)]
    mod tests {
        mod test_mmr_systems;
    }
}

// Excluded from the Blitz-core world (D15) — faith/holy sites are season-only.
// pub mod faith {
//     pub mod contracts;
//     pub mod prize_contracts;
//     #[cfg(test)]
//     mod tests;
// }

// Excluded from the Blitz-core world (D15) — bitcoin mines are season-only discoveries.
// pub mod bitcoin_mine {
//     pub mod contracts;
//     pub mod discovery_systems;
//     #[cfg(test)]
//     mod tests;
// }

// Excluded from the Blitz-core world (D15) — spires belong to the season settling path.
// pub mod spire {
//     pub mod contracts;
// }

pub mod alt_movement {
    pub mod contracts;
}
