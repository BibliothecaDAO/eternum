use crate::map::IMapLogicLibraryDispatcher;
use crate::ownership::Story;
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP) }
}

pub fn resources_dispatcher(game_id: u32) -> IResourceOperationsLibraryDispatcher {
    IResourceOperationsLibraryDispatcher {
        class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
    }
}

#[cfg(feature: "blitz")]
pub fn biome_troop(key: ResourceKey, _game_context: crate::commands::ExecutionContext) -> crate::troops::TroopType {
    crate::logic::blitz::roster::dealt(key)
}

#[cfg(not(feature: "blitz"))]
pub fn biome_troop(key: ResourceKey, game_context: crate::commands::ExecutionContext) -> crate::troops::TroopType {
    let record = crate::logic::structures::record(key);
    let coord = if record.base.category == crate::taxonomy::REALM_CATEGORY {
        crate::settlement::off_map_realm_reference(record.metadata.realm_id.into())
    } else {
        crate::structures::structure_coord(key)
    };
    let biome = crate::map::IMapLogicDispatcherTrait::biome(
        map_dispatcher(key.game_id),
        crate::geometry::tile_key(key.game_id, coord),
        crate::commands::biome_context(game_context),
    );
    assert!(biome > 0 && biome <= 17, "starting troops require a biome");
    crate::logic::settlement::biome_troop(biome)
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
            grant_starting_guard(key, category, guards, timestamp, game_context);
        }
    }
}

pub fn spend(
    key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64, game_context: crate::commands::ResourceContext,
) {
    resources_dispatcher(key.game_id).spend_resource(key, resource_type, amount, timestamp, game_context);
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
            class_hash: crate::logic::release::class_of(key.game_id, crate::slots::TROOPS),
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
