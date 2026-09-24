use starknet::ContractAddress;
use crate::resources::ResourceAmount;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct UpgradeLimits {
    pub realm_max: u8,
    pub village_max: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct UpgradeRecipe {
    pub costs: Span<ResourceAmount>,
}

#[starknet::interface]
pub trait IUpgradeRules<T> {
    fn configure_upgrades(ref self: T, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>);
    #[cfg(test)]
    fn upgrade_limits(self: @T, game_id: u32) -> UpgradeLimits;
    #[cfg(test)]
    fn upgrade_recipe(self: @T, game_id: u32, level: u8) -> UpgradeRecipe;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RealmUpgradeLane {
    Attunement,
    Barracks,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuyRealmUpgrade {
    pub structure_id: u32,
    pub lane: RealmUpgradeLane,
}

#[starknet::interface]
pub trait IStructureUpgrades<T> {
    fn buy_realm_upgrade(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: BuyRealmUpgrade,
        context: crate::commands::ActionContext,
    );
    fn level_up(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: crate::commands::ActionContext,
    );
}

pub fn troop_limits(config: crate::rules::TroopLimitConfig, level: u8) -> (u16, u8) {
    match level {
        0 => (config.settlement_armies, config.settlement_guard_slots),
        1 => (config.city_armies, config.city_guard_slots),
        2 => (config.kingdom_armies, config.kingdom_guard_slots),
        3 => (config.empire_armies, config.empire_guard_slots),
        _ => panic!("unsupported troop limit level"),
    }
}
