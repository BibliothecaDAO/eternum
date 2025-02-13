pub mod config {
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
    mod tests;
    pub mod contracts {
        pub mod battle_systems;
        pub mod troop_systems;
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
    pub mod map;
    pub mod mine;
    pub mod troop;
    pub mod donkey;
    pub mod distance;
    pub mod resource;
}
