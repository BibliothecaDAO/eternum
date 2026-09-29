use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::upgrades::*;

pub fn limits(game_id: u32) -> UpgradeLimits {
    crate::logic::preset_record::for_game(game_id).upgrade_limits.read()
}

pub fn recipe(game_id: u32, level: u8) -> UpgradeRecipe {
    let preset = crate::logic::preset_record::for_game(game_id);
    let limits = preset.upgrade_limits.read();
    assert!(level > 0 && (level <= limits.realm_max || level <= limits.village_max), "invalid upgrade level");
    let mut costs = array![];
    for index in 0..preset.upgrade_cost_counts.read(level) {
        costs.append(preset.upgrade_costs.read((level, index)));
    }
    UpgradeRecipe { costs: costs.span() }
}
#[starknet::component]
pub mod UpgradeState {
    use crate::events::RowSet;
    use crate::upgrades::{UpgradeLimits, UpgradeRecipe};

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

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn limits(self: @ComponentState<TContractState>, game_id: u32) -> UpgradeLimits {
            crate::logic::upgrades::limits(game_id)
        }

        fn recipe(self: @ComponentState<TContractState>, game_id: u32, level: u8) -> UpgradeRecipe {
            crate::logic::upgrades::recipe(game_id, level)
        }
    }
}
