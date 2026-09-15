pub mod biome;

pub mod combat;
pub mod commands;
pub mod events;
pub mod lifecycle;
pub mod map;
pub mod math;

#[cfg(test)]
mod parity_vectors;
pub mod recording;
pub mod rules;
pub mod season;
pub mod settlement;
pub mod settlement_grid;
pub mod stamina;

#[cfg(test)]
mod tests;
pub mod troops;
#[cfg(test)]
pub mod parity_types {
    pub use crate::biome::Biome;
    pub use crate::combat::{CombatContext, TroopsTrait};
    pub use crate::rules::{TroopDamageConfig, TroopStaminaConfig};
    pub use crate::troops::{Stamina, TroopBoosts, TroopTier, TroopType, Troops};
}
pub mod buildings;
pub mod discovery;
pub mod fixed_constants;
pub mod game;
pub mod geometry;

pub mod names;
pub mod ownership;
pub mod random;

pub mod resources;
pub mod structures;

pub mod upgrades;
