use crate::upgrades::*;

pub fn limits() -> UpgradeLimits {
    UpgradeLimits {
        realm_max: crate::balance::structures::REALM_UPGRADE_MAX,
        village_max: crate::balance::structures::VILLAGE_UPGRADE_MAX,
    }
}

pub fn recipe(level: u8) -> UpgradeRecipe {
    let limits = limits();
    assert!(level > 0 && (level <= limits.realm_max || level <= limits.village_max), "invalid upgrade level");
    let row = *crate::balance::structures::UPGRADES.span().at(level.into() - 1);
    UpgradeRecipe { costs: crate::balance::structures::UPGRADE_COSTS.span().slice(row.first_cost, row.cost_count) }
}
#[starknet::component]
pub mod UpgradeState {
    use crate::events::RowSet;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
}
