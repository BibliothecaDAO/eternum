use starknet::storage::StoragePointerReadAccess;
use games_storage::release::LogicClasses;

pub fn initialize_gameplay(classes: LogicClasses, game_id: u32, mode_rules: u32) {
    if crate::logic::preset_record::for_game(game_id).bane_rules.read().is_some() {
        let mut context = crate::commands::action_context(crate::commands::load_context(game_id, 0, 0));
        context.timestamp = context.game.start_main_at;
        crate::banes::IWorldBanesDispatcherTrait::prepare_bane_day(
            crate::banes::IWorldBanesLibraryDispatcher { class_hash: classes.bridge }, game_id, context,
        );
    }
    crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
        crate::deep::IDeepSitesLibraryDispatcher { class_hash: classes.map }, game_id,
    );
    if mode_rules & crate::rules::RESERVED_HYPERSTRUCTURES != 0 {
        crate::settlement::IBlitzReservationsDispatcherTrait::initialize_reservations(
            crate::settlement::IBlitzReservationsLibraryDispatcher { class_hash: classes.placement }, game_id,
        );
    }
    if mode_rules & crate::rules::SPIRES != 0 {
        crate::spires::ISpiresDispatcherTrait::initialize_spires(
            crate::spires::ISpiresLibraryDispatcher { class_hash: classes.placement }, game_id,
        );
    }
}
