use snforge_std::interact_with_state;
use starknet::storage::{
    StorageAsPointer, StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
};
use crate::resources::ResourceKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PreTownBoard {
    pub demolition_refund_bps: u16,
    pub workshop_rate: u64,
    // What one tier pick adds, for every building of its type: Fields, Tools and Drill a share of the base output,
    // Granary and Storeroom a share of the castle's base limit, a hut tier a share of a hut's population, and
    // Rations a cut in the wheat each deployed troop costs.
    pub output_step_bps: u16,
    pub storage_step_bps: u16,
    pub population_step_bps: u16,
    pub ration_step: u128,
    // The number of Barracks purchases needed before building training.
    pub training_gate_tier: u8,
    // Troop storage stays tied to deployment capacity; wheat and labor have their own per-level caps.
    pub troop_store_deploys: u8,
    pub settlement_resource_cap: u32,
    pub city_resource_cap: u32,
    pub kingdom_resource_cap: u32,
    pub empire_resource_cap: u32,
}


#[starknet::interface]
trait IBoardPrefix<T> {
    fn read_board(self: @T, game_id: u32) -> Option<PreTownBoard>;
}

#[starknet::contract]
mod PreTownBoardReader {
    use starknet::storage::StorageAsPointer;
    use super::PreTownBoard;
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Reader of super::IBoardPrefix<ContractState> {
        fn read_board(self: @ContractState, game_id: u32) -> Option<PreTownBoard> {
            let base = crate::logic::preset_record::for_game(game_id).board_terms.as_ptr().__storage_pointer_address__;
            starknet::storage_access::Store::<Option<PreTownBoard>>::read(0, base).unwrap()
        }
    }
}

#[test]
fn existing_board_prefix_survives_new_and_old_pinned_readers() {
    let (_, mut definition) = world_test_support::tests::preset_projection::current_definition("season-one");
    let mut board = definition.structures.board.unwrap();
    board.town = None;
    definition.structures.board = Some(board);
    let (d, game_id) = super::aspects::setup_aspect_preset(42, definition);
    assert!(
        world_test_support::tests::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::SettleSeason(
                crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) },
            ),
            360,
        ),
    );
    let old_reader = world_test_support::tests::declare_logic("PreTownBoardReader");
    interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let preset = crate::logic::preset_record::for_game(game_id);
            let base = preset.board_terms.as_ptr().__storage_pointer_address__;
            let old = PreTownBoard {
                demolition_refund_bps: 5000,
                workshop_rate: 27777778,
                output_step_bps: 2500,
                storage_step_bps: 5000,
                population_step_bps: 2500,
                ration_step: 250000000,
                training_gate_tier: 2,
                troop_store_deploys: 2,
                settlement_resource_cap: 6000,
                city_resource_cap: 18000,
                kingdom_resource_cap: 40000,
                empire_resource_cap: 80000,
            };
            starknet::storage_access::Store::<Option<PreTownBoard>>::write(0, base, None).unwrap();
            assert!(preset.board_terms.read().is_none());
            // The original writer touches exactly the historical Option<BoardRules> prefix.
            starknet::storage_access::Store::<Option<PreTownBoard>>::write(0, base, Some(old)).unwrap();
            let before = preset.board_terms.read().unwrap();
            assert!(before.town.is_none());
            let mut expected = array![];
            old.serialize(ref expected);
            Option::<crate::buildings::TownRules>::None.serialize(ref expected);
            let mut actual = array![];
            before.serialize(ref actual);
            assert_eq!(actual, expected);
            let home = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
            assert_eq!(
                crate::logic::resources::store_limit(home, crate::resources::LABOR),
                Some(6000 * crate::rules::RESOURCE_PRECISION),
            );
            let release = state.game_releases.read(game_id);
            state.releases.entry(release).classes.resources.write(old_reader);
            let pinned = IBoardPrefixLibraryDispatcher {
                class_hash: state.releases.entry(state.game_releases.read(game_id)).classes.resources.read(),
            };
            assert_eq!(pinned.read_board(game_id), Some(old));
            let town = crate::buildings::TownRules {
                settlement_labor_cap: 5000, city_labor_cap: 15000, kingdom_labor_cap: 50000, empire_labor_cap: 100000,
            };
            starknet::storage_access::Store::<
                Option<crate::buildings::BoardRules>,
            >::write(0, base, Some(crate::buildings::BoardRules { town: Some(town), ..before }))
                .unwrap();
            assert_eq!(pinned.read_board(game_id), Some(old));
            assert_eq!(preset.board_terms.read().unwrap().town, Some(town));
            assert_eq!(
                crate::logic::resources::store_limit(home, crate::resources::LABOR),
                Some(5000 * crate::rules::RESOURCE_PRECISION),
            );
        },
    );
}
