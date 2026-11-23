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
pub fn next_level(record: crate::structures::StructureRecord, actor: starknet::ContractAddress) -> u8 {
    assert!(record.owner == actor, "actor does not own structure");
    let realm = record.base.category == crate::taxonomy::REALM_CATEGORY;
    assert!(realm || record.base.category == crate::taxonomy::VILLAGE_CATEGORY, "structure is not a realm or village");
    let limits = limits();
    let maximum = if realm {
        limits.realm_max
    } else {
        limits.village_max
    };
    assert!(record.base.level < maximum, "structure is already at max level");
    record.base.level + 1
}

pub fn pay(key: crate::resources::ResourceKey, level: u8, context: crate::commands::ExecutionContext) {
    let resources = crate::logic::structure_actions::resources_dispatcher(key.game_id);
    for cost in recipe(level).costs {
        crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
            resources,
            key,
            *cost.resource_type,
            *cost.amount,
            context.timestamp,
            crate::commands::resource_context(context),
        );
    }
}

pub fn emit_level_up(key: crate::resources::ResourceKey, actor: starknet::ContractAddress, level: u8, timestamp: u64) {
    crate::logic::stories::emit_entity_story(
        key,
        actor,
        crate::ownership::Story::StructureLevelUpStory(crate::ownership::StructureLevelUpStory { new_level: level }),
        timestamp,
    );
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
