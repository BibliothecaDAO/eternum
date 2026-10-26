pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::geometry::{neighbor, spire_neighbor, tile_key};
pub use crate::map::IMapLogicDispatcher;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::spires::{
    ISpiresDispatcher, ISpiresDispatcherTrait, ISpiresSafeDispatcher, ISpiresSafeDispatcherTrait, SpireLayout, location,
};
pub use crate::tests::state::MapObservationTrait;
pub use crate::troops::Coord;
pub use super::{Deployment, authority, setup};
pub fn deployment() -> Deployment {
    let d = setup(true);
    d
}
pub fn layout(count: u16) -> SpireLayout {
    SpireLayout { count, base_distance: 15, layer_distance: 2, max_layer: 4 }
}
pub fn spires(d: Deployment) -> ISpiresDispatcher {
    ISpiresDispatcher { contract_address: d.games }
}
pub fn map(d: Deployment) -> IMapLogicDispatcher {
    IMapLogicDispatcher { contract_address: d.games }
}
pub fn center(d: Deployment, game_id: u32) -> Coord {
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    Coord { alt: false, x: 2147483646 - rules.map_center_offset, y: 2147483646 - rules.map_center_offset }
}
pub fn seed_layout(d: Deployment, game_id: u32, config: SpireLayout) {
    let games = IGameDispatcher { contract_address: d.games };
    let mut preset = super::play_fixture::fixture_preset(games.rules(game_id));
    preset.settlement.spires = Some(config);
    super::play_fixture::seed_game_with_preset(d.games, game_id, games.game(game_id), preset);
}
pub fn initialize(d: Deployment, game_id: u32) {
    start_cheat_caller_address(d.games, authority());
    spires(d).initialize_spires(game_id);
    stop_cheat_caller_address(d.games);
}
