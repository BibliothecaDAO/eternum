use starknet::ContractAddress;
use crate::commands::ExecutionContext;
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
    fn upgrade_limits(self: @T, game_id: u32) -> UpgradeLimits;
    fn upgrade_recipe(self: @T, game_id: u32, level: u8) -> UpgradeRecipe;
}

#[starknet::interface]
pub trait IStructureUpgrades<T> {
    fn level_up(ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext);
}

#[starknet::component]
pub mod UpgradeState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{ResourceAmount, UpgradeLimits, UpgradeRecipe};

    #[storage]
    pub struct Storage {
        pub limits: Map<u32, Option<UpgradeLimits>>,
        pub cost_counts: Map<(u32, u8), u32>,
        pub costs: Map<(u32, u8, u32), ResourceAmount>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn limits(self: @ComponentState<TContractState>, game_id: u32) -> UpgradeLimits {
            self.limits.read(game_id).expect('missing upgrade rules')
        }

        fn recipe(self: @ComponentState<TContractState>, game_id: u32, level: u8) -> UpgradeRecipe {
            let limits = self.limits(game_id);
            assert!(level > 0 && (level <= limits.realm_max || level <= limits.village_max), "invalid upgrade level");
            let mut costs = array![];
            for index in 0..self.cost_counts.read((game_id, level)) {
                costs.append(self.costs.read((game_id, level, index)));
            }
            UpgradeRecipe { costs: costs.span() }
        }

        fn configure(
            ref self: ComponentState<TContractState>, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>,
        ) {
            assert!(self.limits.read(game_id).is_none(), "immutable upgrade rules");
            assert!(limits.realm_max <= 3 && limits.village_max <= 3, "unsupported troop limit level");
            assert!(
                recipes.len() == core::cmp::max(limits.realm_max, limits.village_max).into(),
                "incomplete upgrade recipes",
            );
            self.limits.write(game_id, Some(limits));
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
                self.cost_counts.write((game_id, level), recipe.costs.len());
                let mut index = 0;
                for cost in recipe.costs {
                    assert!(*cost.resource_type > 0 && *cost.resource_type <= 58, "invalid resource type");
                    self.costs.write((game_id, level, index), *cost);
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

pub fn troop_limits(config: crate::rules::TroopLimitConfig, level: u8) -> (u16, u8) {
    match level {
        0 => (config.settlement_armies, config.settlement_guard_slots),
        1 => (config.city_armies, config.city_guard_slots),
        2 => (config.kingdom_armies, config.kingdom_guard_slots),
        3 => (config.empire_armies, config.empire_guard_slots),
        _ => panic!("unsupported troop limit level"),
    }
}
