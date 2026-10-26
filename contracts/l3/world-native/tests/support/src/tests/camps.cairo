pub use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::camps::{ICampRulesSafeDispatcher, ICampRulesSafeDispatcherTrait};
pub use crate::commands::{Command, CreateExplorer, Explore};
pub use crate::discovery::{Discovery, surface};
pub use crate::game::{IGameDispatcherTrait, IPointsDispatcherTrait};
pub use crate::geometry::{neighbor, tile_key};
pub use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troops::{Coord, ExplorerKey, TroopTier, TroopType};
pub use super::resource_commands::{execute, grant, setup_with_rules};
pub fn rules(blitz: bool) -> crate::rules::SliceRules {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = if blitz {
        super::play_fixture::BLITZ_RULES
    } else {
        super::play_fixture::ETERNUM_RULES
    };
    rules
        .command_mask =
            if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    rules.map_config.hyps_win_prob = 0;
    rules.map_config.hyps_fail_prob = 1;
    rules.map_config.shards_mines_win_probability = 0;
    rules.map_config.shards_mines_fail_probability = 1;
    rules.map_config.camp_win_probability = 1;
    rules.map_config.camp_fail_probability = 0;
    rules.map_config.relic_discovery_interval_sec = 60000;
    rules
}
pub fn setup(blitz: bool) -> (super::Deployment, ResourceKey) {
    let (d, home, _) = super::resource_commands::setup_with_preset(camp_preset(blitz));
    (d, home)
}
pub fn camp_preset(blitz: bool) -> crate::presets::PresetDefinition {
    let mut preset = super::resource_commands::fixture_preset(rules(blitz));
    preset.structures.buildings = super::building_commands::rules();
    preset.structures.board = None;
    preset
        .structures
        .camps
        .resources =
            array![ResourceAmount { resource_type: 1, amount: 100 }, ResourceAmount { resource_type: 2, amount: 20 }]
        .span();
    preset
        .exploration =
            array![
                crate::exploration_rewards::ExplorationReward {
                    resource_type: 2, percent: 10, percent_max: 10, weight: 1,
                },
            ]
        .span();
    preset
}
pub fn coord() -> Coord {
    Coord { alt: false, x: 2000100, y: 2000100 }
}
pub fn create(d: super::Deployment, coord: Coord) -> ResourceKey {
    start_cheat_block_timestamp_global(30);
    start_cheat_caller_address(d.games, d.games);
    let id = IStructureOperationsDispatcher { contract_address: d.games }
        .create_discovery(
            3,
            1,
            coord,
            Discovery::Camp,
            101,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(d.games, 3) },
            ),
        );
    stop_cheat_caller_address(d.games);
    ResourceKey { game_id: 3, entity_id: id }
}
