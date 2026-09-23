use starknet::storage::StorageMapReadAccess;
use crate::upgrades::*;

pub fn limits(game_id: u32) -> UpgradeLimits {
    crate::state::read().upgrades.limits.read(game_id).expect('missing upgrade rules')
}

pub fn recipe(game_id: u32, level: u8) -> UpgradeRecipe {
    let limits = limits(game_id);
    assert!(level > 0 && (level <= limits.realm_max || level <= limits.village_max), "invalid upgrade level");
    let mut costs = array![];
    for index in 0..crate::state::read().upgrades.cost_counts.read((game_id, level)) {
        costs.append(crate::state::read().upgrades.upgrade_costs.read((game_id, level, index)));
    }
    UpgradeRecipe { costs: costs.span() }
}
#[starknet::component]
pub mod UpgradeState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
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

        fn configure(
            ref self: ComponentState<TContractState>, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>,
        ) {
            assert!(self.data.upgrades.limits.read(game_id).is_none(), "immutable upgrade rules");
            assert!(limits.realm_max <= 3 && limits.village_max <= 3, "unsupported troop limit level");
            assert!(
                recipes.len() == core::cmp::max(limits.realm_max, limits.village_max).into(),
                "incomplete upgrade recipes",
            );
            self.data.upgrades.limits.write(game_id, Some(limits));
            let mut values = array![];
            limits.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'UpgradeLimits', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
            let mut level = 1_u8;
            for recipe in recipes {
                self.data.upgrades.cost_counts.write((game_id, level), recipe.costs.len());
                let mut index = 0;
                for cost in recipe.costs {
                    assert!(*cost.resource_type > 0 && *cost.resource_type <= 58, "invalid resource type");
                    self.data.upgrades.upgrade_costs.write((game_id, level, index), *cost);
                    index += 1;
                }
                let mut values = array![];
                recipe.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'UpgradeRecipe',
                            keys: array![game_id.into(), level.into()].span(),
                            values: values.span(),
                        },
                    );
                level += 1;
            }
        }
    }
}
