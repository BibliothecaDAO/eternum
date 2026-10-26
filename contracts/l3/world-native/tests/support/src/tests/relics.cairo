pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use starknet::storage::StorageMapReadAccess;
pub use crate::commands::{Command, ExecutionContext};
pub use crate::exploration_rewards::{ExplorationReward, IExtractionSafeDispatcher, IExtractionSafeDispatcherTrait};
pub use crate::game::IGameDispatcherTrait;
pub use crate::map::IMapLogicDispatcher;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::relics::{
    ApplyRelic, IRelicMapDispatcher, IRelicMapDispatcherTrait, IRelicMapSafeDispatcher, IRelicsDispatcher,
    IRelicsSafeDispatcher, IRelicsSafeDispatcherTrait, OpenChest, Recipient, RelicChest, RelicPack, RelicRule,
};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::tests::state::{GameState, MapObservationTrait, ResourceObservationTrait, TroopObservationTrait};
pub use crate::troops::{Coord, ExplorerKey};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub fn rules() -> Span<RelicRule> {
    let rates = array![
        5000_u16, 10000, 2000, 4000, 2000, 4000, 0, 0, 10000, 20000, 1500, 3000, 2000, 4000, 2000, 2000, 1500, 3000,
    ];
    let mut rules = array![];
    for index in 0..18_u32 {
        let uses = match index {
            0 | 1 => 3,
            6 => 1,
            7 => 2,
            _ => 0,
        };
        let draw_weight = match index {
            14 | 15 => 0,
            16 => 600,
            17 => 200,
            _ => if index % 2 == 0 {
                750
            } else {
                400
            },
        };
        rules
            .append(
                RelicRule {
                    rate_bps: *rates.at(index),
                    uses,
                    duration: if uses == 0 {
                        3
                    } else {
                        0
                    },
                    essence_cost: if index % 2 == 0 {
                        250
                    } else {
                        500
                    },
                    draw_weight,
                },
            );
    }
    rules.span()
}
pub fn setup(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey) {
    setup_with_reward(blitz, 2, 10)
}
pub fn setup_with_reward(
    blitz: bool, resource_type: u8, amount: u128,
) -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut config = super::play_fixture::rules();
    config.mode_rules = if blitz {
        super::play_fixture::BLITZ_RULES
    } else {
        super::play_fixture::ETERNUM_RULES
    };
    config
        .command_mask =
            if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            };
    config.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    config.map_config.relic_discovery_interval_sec = 10;
    config.map_config.relic_hex_dist_from_center = 12;
    config.tick_config.armies_tick_in_seconds = 10;
    config.victory_points_grant_config.relic_open_points = 77;
    let mut preset = super::resource_commands::fixture_preset(config);
    preset.economy.relics = rules();
    preset.economy.chests = None;
    // The fixture army is one T1 troop, so a row of `amount` hundred percent pays it `amount` whole units.
    let percent = amount * 100;
    preset.exploration = array![ExplorationReward { resource_type, percent, percent_max: percent, weight: 1 }].span();
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    grant(deployment, home, 26, 10 * RESOURCE_PRECISION);
    grant(deployment, home, 38, 10000 * RESOURCE_PRECISION);
    assert!(
        execute(
            deployment,
            Command::CreateExplorer(
                crate::commands::CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            30,
        ),
    );
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let id = crate::tests::state::StructureObservationTrait::home_armies(structures, home).at(0);
    let explorer = ResourceKey { game_id: 3, entity_id: *id };
    for id in 39_u8..57 {
        grant(deployment, explorer, id, 3 * RESOURCE_PRECISION);
        grant(deployment, home, id, 3 * RESOURCE_PRECISION);
    }
    (deployment, home, explorer)
}
pub fn view(deployment: super::Deployment) -> IRelicsDispatcher {
    IRelicsDispatcher { contract_address: deployment.games }
}
pub fn troop(deployment: super::Deployment, key: ResourceKey) -> crate::troops::ExplorerTroops {
    GameState { contract_address: deployment.games }
        .explorer(ExplorerKey { game_id: key.game_id, explorer_id: key.entity_id })
        .unwrap()
}
pub fn balance(deployment: super::Deployment, key: ResourceKey, id: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: id })
}
pub fn apply(key: ResourceKey, id: u8, recipient: Recipient) -> Command {
    Command::ApplyRelic(ApplyRelic { entity_id: key.entity_id, relic_id: id, recipient })
}
pub fn map_relics(deployment: super::Deployment) -> IRelicMapDispatcher {
    IRelicMapDispatcher { contract_address: deployment.games }
}
pub fn activations(
    ref spy: snforge_std::EventSpy, address: starknet::ContractAddress,
) -> Array<crate::ownership::StoryEvent> {
    let mut stories = array![];
    for (_, event) in spy.get_events().emitted_by(address).events.span() {
        let mut keys = event.keys.span();
        while let Some(key) = keys.pop_front() {
            if *key == selector!("StoryEvent") {
                let mut data = event.data.span();
                let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
                if let crate::ownership::Story::RelicActivated(_) = story.story {
                    stories.append(story);
                }
                break;
            }
        }
    }
    stories
}
pub fn chest(deployment: super::Deployment, origin: Coord, seed: u256, time: u64) -> Coord {
    let coord = crate::relics::chest_destination(origin, seed, 12);
    start_cheat_block_timestamp_global(time);
    start_cheat_caller_address(deployment.games, deployment.games);
    map_relics(deployment)
        .discover_relic_chest(
            3,
            1,
            origin,
            origin,
            seed,
            time,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: time, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    coord
}
pub fn move_fixture(deployment: super::Deployment, key: ResourceKey, coord: Coord) {
    let explorer = troop(deployment, key);
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games,
        crate::troops::ExplorerKey { game_id: key.game_id.into(), explorer_id: key.entity_id },
        crate::troops::ExplorerTroops { coord, ..explorer },
    );
}
pub /// Opens the chest a seed places beside the army, then replays the opening: both times the army and its home hold
/// exactly the relics named, on top of the fixture's three of each.
fn assert_opening_pays(seed: u256, expected: RelicChest, army: Array<u8>, home: Array<u8>) {
    assert_eq!(crate::relics::draw_chest(seed), expected);
    let (deployment, realm, explorer) = setup(true);
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, seed, 40);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    let command = Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord });
    assert!(execute(deployment, command, 50));
    assert_relics_granted(deployment, explorer, army.span());
    assert_relics_granted(deployment, realm, home.span());
    assert_terminal_rejection(deployment, command, 51);
    assert_relics_granted(deployment, explorer, army.span());
    assert_relics_granted(deployment, realm, home.span());
}
pub fn assert_relics_granted(deployment: super::Deployment, key: ResourceKey, granted: Span<u8>) {
    for id in 39_u8..57 {
        let mut count = 0_u128;
        for relic in granted {
            if *relic == id {
                count += 1;
            }
        }
        assert_eq!(balance(deployment, key, id), (3 + count) * RESOURCE_PRECISION);
    }
}
pub fn stored_chest(deployment: super::Deployment, chest_id: u64) -> Option<RelicChest> {
    snforge_std::interact_with_state(deployment.games, || crate::state::read().relics.relic_chests.read((3, chest_id)))
}
#[feature("safe_dispatcher")]
pub fn extract_reward(deployment: super::Deployment, explorer_id: u64, timestamp: u64) -> bool {
    start_cheat_block_timestamp_global(timestamp);
    start_cheat_caller_address(deployment.games, deployment.games);
    let result = IExtractionSafeDispatcher { contract_address: deployment.games }
        .extract_exploration_reward(
            3,
            deployment.actor,
            explorer_id,
            None,
            crate::commands::action_context(ExecutionContext { timestamp, ..super::context(deployment.games, 3) }),
        );
    stop_cheat_caller_address(deployment.games);
    result.is_ok()
}
pub fn opened_contents_with_launch_seed(seed: felt252) -> Array<u128> {
    let (deployment, _, explorer) = setup(true);
    snforge_std::interact_with_state(
        deployment.games,
        || {
            let game = crate::logic::game::game(3);
            crate::logic::game::write_game(3, crate::game::GameRegistry { seed, ..game });
        },
    );
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    assert!(execute(deployment, Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord }), 50));
    let mut contents = array![];
    for id in 39_u8..57 {
        contents.append(balance(deployment, explorer, id));
    }
    contents
}
