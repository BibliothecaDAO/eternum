use starknet::storage::StoragePointerReadAccess;
use crate::geometry::tile_key;
use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
use crate::ownership::Story;
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).map.read() }
}

pub fn resources_dispatcher(game_id: u32) -> IResourceOperationsLibraryDispatcher {
    IResourceOperationsLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).resources.read() }
}

pub fn biome_troop(key: ResourceKey, game_context: crate::commands::ExecutionContext) -> crate::troops::TroopType {
    let record = crate::logic::structures::record(key);
    let coord = if game_context.rules.unbox().day_unit_seconds != 0
        && record.base.category == crate::taxonomy::REALM_CATEGORY {
        crate::settlement::off_map_realm_reference(record.metadata.realm_id.into())
    } else {
        crate::structures::structure_coord(key)
    };
    let biome = map_dispatcher(key.game_id)
        .biome(tile_key(key.game_id, coord), crate::commands::biome_context(game_context));
    assert!(biome > 0 && biome <= 17, "starting troops require a biome");
    crate::logic::settlement::biome_troop(key.game_id, biome)
}

pub fn grant_starting_troops(
    key: ResourceKey,
    category: crate::troops::TroopType,
    resources: Span<crate::resources::ResourceAmount>,
    guards: u128,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) {
    let record = crate::logic::structures::record(key);
    if record.base.starting_troops_granted {
        return;
    }
    crate::logic::structures::StructureState::mark_starting_troops(key);
    let resource_type = crate::troops::troop_resource(category, 0);
    for grant in resources {
        let kind = *grant.resource_type;
        let amount = *grant.amount;
        if kind == resource_type {
            resources_dispatcher(key.game_id)
                .grant_resource(key, kind, amount + guards, timestamp, crate::commands::resource_context(game_context));
            if record.base.category == crate::taxonomy::REALM_CATEGORY
                && crate::logic::aspects::rules(key.game_id).is_some() {
                deploy_starting_armies(key, category, amount, timestamp, game_context);
            }
            grant_starting_guard(key, category, guards, timestamp, game_context);
        }
    }
}

pub fn spend(
    key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64, game_context: crate::commands::ResourceContext,
) {
    resources_dispatcher(key.game_id).spend_resource(key, resource_type, amount, timestamp, game_context);
}

fn deploy_starting_armies(
    key: ResourceKey,
    category: crate::troops::TroopType,
    amount: u128,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) {
    assert!(amount > 0 && amount % (2 * crate::rules::RESOURCE_PRECISION) == 0, "unequal starting armies");
    spend(
        key,
        crate::troops::troop_resource(category, 0),
        amount,
        timestamp,
        crate::commands::resource_context(game_context),
    );
    let context = crate::commands::action_context(game_context);
    let context = crate::commands::ActionContext {
        timestamp: core::cmp::max(timestamp, context.game.start_main_at), ..context,
    };
    let allocator = crate::troops::IArmyAllocationLibraryDispatcher {
        class_hash: crate::logic::release::classes(key.game_id).troops.read(),
    };
    let actor = crate::logic::structures::record(key).owner;
    for slot in 0_u8..2 {
        crate::troops::IArmyAllocationDispatcherTrait::allocate_army(
            allocator,
            key.game_id,
            actor,
            crate::commands::CreateExplorer {
                slot,
                structure_id: key.entity_id,
                category: category.into(),
                tier: 0,
                amount: amount / 2,
                direction: slot,
            },
            context,
        );
    }
}

fn grant_starting_guard(
    key: ResourceKey,
    category: crate::troops::TroopType,
    amount: u128,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) {
    if amount == 0 {
        return;
    }
    spend(
        key,
        crate::troops::troop_resource(category, 0),
        amount,
        timestamp,
        crate::commands::resource_context(game_context),
    );
    crate::guards::IGuardsDispatcherTrait::add_starting_guard(
        crate::guards::IGuardsLibraryDispatcher {
            class_hash: crate::logic::release::classes(key.game_id).troops.read(),
        },
        key,
        category,
        amount,
        timestamp,
        crate::commands::action_context(game_context),
    );
    crate::logic::stories::emit_entity_story(
        key,
        crate::logic::structures::record(key).owner,
        Story::GuardAddStory(
            crate::ownership::GuardAddStory {
                structure_id: key.entity_id, slot: 0, category, tier: crate::troops::TroopTier::T1, amount,
            },
        ),
        timestamp,
    );
}
