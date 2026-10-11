pub mod chests;
pub mod contract;

mod days;
pub mod mmr;

pub mod test_lords;

#[cfg(test)]
mod tests;
pub mod types;

// Adapt the shared shard calendar without linking the world package or its contracts.
mod game {
    pub use crate::types::FrontierClock as GameRegistry;
}
