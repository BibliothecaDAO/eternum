pub use starknet::storage::StorageMapWriteAccess;
pub use crate::progression::ArmyProgress;
pub use crate::resources::IResourceOperationsDispatcherTrait;
pub use crate::stamina::{StaminaSourceTrait, StaminaTrait};
pub use crate::tests::state::{MapObservationTrait, ResourceObservationTrait, TroopObservationTrait};


pub fn read_progress(d: super::Deployment, key: crate::troops::ExplorerKey) -> ArmyProgress {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key))
}
pub fn write_progress(d: super::Deployment, key: crate::troops::ExplorerKey, progress: ArmyProgress) {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, progress));
}

pub fn bar(d: super::Deployment, key: crate::troops::ExplorerKey, game_id: u32) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let now = super::play_fixture::FIXTURE_START;
            let context = crate::commands::load_context(game_id, 123, now);
            crate::logic::troops::active_explorer(key, now, context).troops.stamina.inline().amount
        },
    )
}
pub /// Sets the slot army's bar to `amount` at the current second, through the troop write every action uses.
 fn set_bar(d: super::Deployment, key: crate::troops::ExplorerKey, amount: u64, timestamp: u64) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut troops = crate::logic::troops::explorer(key).unwrap().troops;
            troops
                .stamina = crate::troops::Stamina { amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 }
                .into();
            crate::logic::troops::TroopState::update_troops(key, troops);
        },
    );
}
pub fn deploy(
    d: super::Deployment, home: crate::resources::ResourceKey, category: u8, slot: u8, timestamp: u64,
) -> crate::troops::ExplorerKey {
    let command = super::registrar::muster_command(home, category, slot, slot);
    super::resource_commands::assert_executes(d, home.game_id, command, timestamp);
    let armies = crate::tests::state::StructureObservationTrait::home_armies(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
    );
    crate::troops::ExplorerKey { game_id: home.game_id, explorer_id: *armies.at(armies.len() - 1) }
}


pub fn place_army_at_depth(d: super::Deployment, key: crate::troops::ExplorerKey, depth: u8) {
    if depth == 0 {
        return;
    }
    let game_id = key.game_id;
    let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
    let troops = super::state::GameState { contract_address: d.games };
    let mut army = troops.resolved_explorer(key).unwrap();
    let spacing = snforge_std::interact_with_state(d.games, || crate::logic::settlement::rules(game_id).spacing);
    army.coord.y += Into::<u8, u32>::into(depth) * spacing;
    let tile = crate::geometry::tile_key(game_id, army.coord);
    map.reveal(tile, 2);
    super::resource_commands::set_explorer_fixture(d.games, key, army);
}

pub fn exploration_destination(d: super::Deployment, key: crate::troops::ExplorerKey) -> crate::troops::Coord {
    crate::geometry::neighbor(
        super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, 0,
    )
}
pub fn explore(d: super::Deployment, key: crate::troops::ExplorerKey, root: u256, timestamp: u64) {
    assert!(super::registrar::explore_with_root(d, key.game_id, key.explorer_id, root, timestamp));
}
