pub mod arrivals;
pub mod biome;
pub mod bitcoin;

pub mod combat;
pub mod commands;
pub mod events;
pub mod lifecycle;
pub mod map;
pub mod math;
pub mod mines;

pub mod realms;
pub mod recording;
pub mod rules;
pub mod season;
pub mod settlement;
pub mod settlement_domain;
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

pub mod agents;

pub mod artificer;

pub mod blitz_prizes;
pub mod buildings;

pub mod camps;

pub mod dev;
pub mod discovery;
pub mod economy;
pub mod entry;

pub mod exploration_rewards;

pub mod faith;

pub mod faith_prizes;
pub mod fixed_constants;
pub mod game;
pub mod geometry;

pub mod guards;

pub mod guilds;

pub mod hyperstructures;

pub mod market;

pub mod names;
pub mod ownership;

pub mod prizes;

pub mod production;
pub mod random;

pub mod registry;

pub mod relics;
pub mod resources;
pub mod resources_domain;
pub mod series_chests;
pub mod structures;

pub mod trade;

pub mod transport;

pub mod upgrades;

pub mod village;

pub mod withdrawals;
