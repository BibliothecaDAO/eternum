pub mod config {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}

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
    pub mod contracts;
    #[cfg(test)]
    mod tests;
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
    pub mod bridge;
    pub mod distance;
    pub mod donkey;
    pub mod erc20;
    pub mod hyperstructure;
    pub mod map;
    pub mod mine;
    pub mod realm;
    pub mod resource;
    pub mod structure;
    pub mod troop;
    pub mod village;
}

pub mod quest {
    pub mod constants;
    pub mod contracts;
}
