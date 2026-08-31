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

pub mod village {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

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
    pub mod season {
        pub mod contracts;
    }
    pub mod utils {
        pub mod contracts;
    }
}
pub mod trade {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
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
pub mod entry {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
pub mod production {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

pub mod dev {
    pub mod contracts;
}
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
        pub mod troop_raid;
    }
}
pub mod bank {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
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
pub mod season {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

pub mod utils {
    pub mod auth;
    pub mod bitcoin_mine;
    pub mod blitz_exploration;
    pub mod blitz_profile;
    pub mod bridge;
    pub mod camp;
    pub mod distance;
    pub mod donkey;
    pub mod erc20;
    pub mod holysite;
    pub mod hyperstructure;
    pub mod map;
    pub mod mine;
    pub mod ranking;
    pub mod realm;
    pub mod relic;
    pub mod resource;
    pub mod series_chest_reward;
    pub mod structure;
    pub mod troop;
    pub mod village;
}

pub mod quest {
    pub mod constants;
    pub mod contracts;
}

pub mod prize_distribution {
    pub mod contracts;
}

pub mod points {
    pub mod contracts;
}

pub mod relic {
    pub mod contracts;
}

pub mod faith {
    pub mod contracts;
    pub mod prize_contracts;
    #[cfg(test)]
    mod tests;
}

pub mod bitcoin_mine {
    pub mod contracts;
    pub mod discovery_systems;
    #[cfg(test)]
    mod tests;
}

pub mod spire {
    pub mod contracts;
}

pub mod alt_movement {
    pub mod contracts;
}
