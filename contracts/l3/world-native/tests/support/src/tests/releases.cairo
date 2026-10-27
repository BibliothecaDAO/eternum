pub use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events, start_cheat_caller_address};
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
pub use crate::logic::release::{
    IReleasesDispatcher, IReleasesDispatcherTrait, IReleasesSafeDispatcher, IReleasesSafeDispatcherTrait, Release,
};
pub use crate::registrar::{CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait};
pub use crate::resources::{ResourceKey, ResourceSlot};
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troops::ExplorerKey;
pub use super::{authority, declare_logic};

#[starknet::contract]
pub mod ReleaseMigrationFixture {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            assert!(release_id == previous_release + 1, "unexpected migration route");
            let mut game = crate::logic::game::game(game_id);
            game.seed += if release_id == 2 {
                1
            } else {
                10
            };
            crate::logic::game::write_game(game_id, game);
        }
    }
}

#[starknet::contract]
pub mod FailingReleaseMigrationFixture {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            let mut game = crate::logic::game::game(game_id);
            game.seed += 1;
            crate::logic::game::write_game(game_id, game);
            panic!("migration failed");
        }
    }
}
pub fn populated_facts(
    d: super::Deployment, game_id: u32, homes: Span<ResourceKey>, armies: Span<ExplorerKey>,
) -> Array<felt252> {
    let state = GameState { contract_address: d.games };
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    let resources = crate::resources::IResourceOperationsDispatcher { contract_address: d.games };
    let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
    let mut facts = array![];
    let mut game = IGameDispatcher { contract_address: d.games }.game(game_id);
    game.seed = 0;
    game.serialize(ref facts);
    let mut entities = array![];
    for home in homes {
        let realm = structures.structure(*home).unwrap();
        realm.serialize(ref facts);
        structures.structure_buildings(*home).serialize(ref facts);
        let labor = structures
            .building(
                crate::buildings::BuildingKey { game_id, structure_id: *home.entity_id, inner_col: 10, inner_row: 10 },
            )
            .unwrap();
        assert_eq!(labor.category, 25);
        labor.serialize(ref facts);
        for slot in 0_u8..4 {
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: d.games },
                crate::guards::GuardKey { game_id, structure_id: *home.entity_id, slot },
            )
                .serialize(ref facts);
        }
        entities.append(*home.entity_id);
    }
    for army in armies {
        let explorer = state.explorer(*army).unwrap();
        explorer.serialize(ref facts);
        map.tile(crate::geometry::tile_key(game_id, explorer.coord)).serialize(ref facts);
        entities.append(*army.explorer_id);
    }
    for entity_id in entities {
        for resource_type in 1_u8..59 {
            let slot = ResourceSlot { game_id, entity_id, resource_type };
            resources.resource_balance(slot).serialize(ref facts);
            resources.resource_production(slot).serialize(ref facts);
        }
    }
    facts
}
pub fn stored_release_fact(address: starknet::ContractAddress, game_id: u32) -> (u32, felt252) {
    interact_with_state(
        address,
        || {
            let state = crate::state::read();
            let game = crate::logic::game::game(game_id);
            (state.game_releases.read(game_id), state.registrar.presets.read(game.preset_id))
        },
    )
}
pub fn gameplay_facts(address: starknet::ContractAddress) -> Array<felt252> {
    interact_with_state(
        address,
        || {
            let state = crate::state::read();
            let mut facts = array![];
            state.games.games.read(1).serialize(ref facts);
            crate::logic::game::rules(1).serialize(ref facts);
            state.games.next_entity.read(1).serialize(ref facts);
            for explorer_id in array![7, 8] {
                crate::logic::troops::explorer(ExplorerKey { game_id: 1, explorer_id }).serialize(ref facts);
            }
            facts
        },
    )
}
