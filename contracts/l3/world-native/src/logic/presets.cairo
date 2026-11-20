pub fn initialize_gameplay(game_id: u32, mode_rules: u32) {
    crate::banes::IWorldBanesDispatcherTrait::initialize_bane_calendar(
        crate::banes::IWorldBanesLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
        },
        game_id,
    );
    crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
        crate::deep::IDeepSitesLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP),
        },
        game_id,
    );
    crate::race::IRaceDispatcherTrait::initialize_race(
        crate::race::IRaceLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
        },
        game_id,
    );
    if mode_rules & crate::rules::SPIRES != 0 {
        crate::spires::ISpiresDispatcherTrait::initialize_spires(
            crate::spires::ISpiresLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::PLACEMENT),
            },
            game_id,
        );
    }
}
