use games_storage::release::LogicClasses;

pub fn initialize_gameplay(classes: LogicClasses, game_id: u32, mode_rules: u32) {
    crate::banes::IWorldBanesDispatcherTrait::initialize_bane_calendar(
        crate::banes::IWorldBanesLibraryDispatcher { class_hash: classes.bridge }, game_id,
    );
    crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
        crate::deep::IDeepSitesLibraryDispatcher { class_hash: classes.map }, game_id,
    );
    crate::race::IRaceDispatcherTrait::initialize_race(
        crate::race::IRaceLibraryDispatcher { class_hash: classes.economy }, game_id,
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
