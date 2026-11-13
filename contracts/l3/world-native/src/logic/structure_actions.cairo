use starknet::storage::StoragePointerReadAccess;
use crate::map::IMapLogicLibraryDispatcher;
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).map.read() }
}

pub fn resources_dispatcher(game_id: u32) -> IResourceOperationsLibraryDispatcher {
    IResourceOperationsLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).resources.read() }
}

pub fn spend(
    key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64, game_context: crate::commands::ResourceContext,
) {
    resources_dispatcher(key.game_id).spend_resource(key, resource_type, amount, timestamp, game_context);
}
