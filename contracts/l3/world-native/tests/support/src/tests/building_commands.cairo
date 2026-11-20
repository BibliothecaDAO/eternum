pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::buildings::{BuildingKey, BuildingRule, BuildingRuleConfig, ChangeBuilding, CreateBuilding};
pub use crate::commands::Command;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use crate::troops::Coord;
pub use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
pub use super::resource_commands::{assert_terminal_rejection, execute, resource_facts, set_fixture, setup};
pub fn rules() -> Span<BuildingRuleConfig> {
    let mut values = array![];
    for category in 1_u8..crate::buildings::BUILDING_CATEGORY_COUNT + 1 {
        values
            .append(
                BuildingRuleConfig {
                    category,
                    rule: BuildingRule {
                        population_cost: if category > 2 {
                            1
                        } else {
                            0
                        },
                        capacity_grant: if category == 1 {
                            4
                        } else {
                            0
                        },
                        simple_cost: array![ResourceAmount { resource_type: 1, amount: 10 }].span(),
                        complex_cost: array![ResourceAmount { resource_type: 2, amount: 20 }].span(),
                    },
                },
            );
    }
    values.span()
}
pub fn building_preset(board: Option<crate::buildings::BoardRules>) -> crate::presets::PresetDefinition {
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    let mut configured = array![];
    for rule in rules() {
        configured
            .append(
                if board.is_some() {
                    BuildingRuleConfig {
                        category: *rule.category,
                        rule: BuildingRule {
                            capacity_grant: if *rule.category == 1 {
                                6
                            } else {
                                0
                            },
                            simple_cost: array![ResourceAmount { resource_type: 23, amount: 100 }].span(),
                            ..*rule.rule,
                        },
                    }
                } else {
                    *rule
                },
            );
    }
    preset.structures.buildings = configured.span();
    preset.structures.board = board;
    if board.is_some() {
        let (_, frontier) = super::preset_projection::current_definition("frontier-check");
        preset.structures.research = frontier.structures.research;
    }
    let recipe = UpgradeRecipe { costs: array![].span() };
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 3, village_max: 2 };
    preset.structures.upgrades = array![recipe, recipe, recipe].span();
    preset
}
pub fn building_world_with_preset(preset: crate::presets::PresetDefinition) -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    if preset.structures.board.is_some() {
        snforge_std::interact_with_state(
            deployment.games,
            || {
                crate::logic::research::write(home, crate::research::RealmKnowledge { learned: 0 });
            },
        );
    }
    (deployment, home)
}
pub fn board_rules() -> crate::buildings::BoardRules {
    crate::buildings::BoardRules {
        demolition_refund_bps: 5000,
        workshop_rate: 20,
        output_step_bps: 2500,
        storage_step_bps: 5000,
        population_step_bps: 2500,
        ration_step: crate::rules::RESOURCE_PRECISION / 4,
        troop_store_deploys: 2,
        settlement_resource_cap: 6000,
        city_resource_cap: 30000,
        kingdom_resource_cap: 90000,
        empire_resource_cap: 180000,
    }
}
pub fn research_price(
    prices: Span<crate::research::ResearchPriceConfig>, row: u8, tier: u8,
) -> crate::research::ResearchPrice {
    for entry in prices {
        if *entry.row == row && *entry.tier == tier {
            return *entry.price;
        }
    }
    panic!("missing research price")
}
pub fn building_world(board: Option<crate::buildings::BoardRules>) -> (super::Deployment, ResourceKey) {
    building_world_with_preset(building_preset(board))
}
pub fn create(home: ResourceKey, category: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding { structure_id: home.entity_id, directions: array![0_u8].span(), category, use_simple: true },
    )
}
pub fn east() -> BuildingKey {
    BuildingKey { game_id: 3, structure_id: 1, inner_col: 11, inner_row: 10 }
}
pub fn change(home: ResourceKey) -> ChangeBuilding {
    ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 11, y: 10 } }
}
pub fn replay_buildings(record: bool) {
    let (d, home, _) = research_world();
    let entities = array![home.entity_id].span();
    let tiles = array![IStructureOperationsDispatcher { contract_address: d.games }.position(home).unwrap()].span();
    let mut frames = array![super::spatial_replay::initial(d.games, 3, entities, tiles)];
    let mut spy = snforge_std::spy_events();
    for (command, timestamp) in array![(create(home, 37), 40_u64), (Command::DestroyBuilding(change(home)), 130)] {
        assert!(execute(d, command, timestamp));
        super::state::assert_spatial_indexes(d.games, 3, entities, tiles);
        frames.append(super::spatial_replay::capture(d.games, 3, entities, tiles, ref spy));
    }
    super::spatial_replay::compare("buildings", frames, record);
}
pub fn seed_board_castle(deployment: super::Deployment, home: ResourceKey, producing_from: u64) {
    // Workshop copy pricing excludes the castle provisioned at settlement.
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("buildings"),
        array![home.game_id.into(), home.entity_id.into(), 10, 10].span(),
        crate::buildings::Building { category: 25, paused: false, labor_paid: 0 },
    );
    let mut counts = IStructureOperationsDispatcher { contract_address: deployment.games }.structure_buildings(home);
    crate::buildings::change_count(ref counts, 25, true);
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("structure_buildings"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        counts,
    );
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let level = IStructureOperationsDispatcher { contract_address: deployment.games }
        .structure(home)
        .unwrap()
        .base
        .level;
    let timestamp = producing_from;
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::resources::IResourceOperationsDispatcherTrait::start_production(
        resources,
        home,
        crate::resources::LABOR,
        crate::logic::resources::castle_labor_rate(level),
        crate::resources::UNLIMITED_OUTPUT,
        timestamp,
        crate::commands::resource_context(
            crate::commands::ExecutionContext { timestamp, ..super::context(deployment.games, home.game_id) },
        ),
    );
    stop_cheat_caller_address(deployment.games);
}
pub fn grant_population(deployment: super::Deployment, home: ResourceKey, extra: u32) {
    let mut counts = IStructureOperationsDispatcher { contract_address: deployment.games }.structure_buildings(home);
    counts.population.max += extra;
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("structure_buildings"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        counts,
    );
}
pub fn board_output(deployment: super::Deployment, home: ResourceKey, category: u8) -> u128 {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    match category {
        37 => resources
            .resource_production(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 35 })
            .production_rate
            .into(),
        1 => IStructureOperationsDispatcher { contract_address: deployment.games }
            .structure_buildings(home)
            .population
            .max
            .into(),
        _ => panic!("unsupported board effect fixture"),
    }
}
pub /// A board realm with its castle, every command open, room for many buildings and plenty of Essence and labor.
 fn research_world() -> (super::Deployment, ResourceKey, crate::presets::PresetDefinition) {
    let mut preset = building_preset(Some(board_rules()));
    preset.rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    let (d, home) = building_world_with_preset(preset);
    grant_population(d, home, 40);
    let limits = preset.rules.troop_limit_config;
    // Research needs the empire's ruled labor limit; a grant cannot bypass the level-0 store's cap.
    snforge_std::interact_with_state(
        d.games,
        || {
            for _ in 0_u8..3 {
                let base = crate::logic::structures::structure(home).unwrap().base;
                crate::logic::structures::StructureState::upgrade(home, base, limits);
            }
        },
    );
    seed_board_castle(d, home, 40);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 10000000 * crate::rules::RESOURCE_PRECISION);
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, 10000000 * crate::rules::RESOURCE_PRECISION);
    (d, home, preset)
}
pub fn research(home: ResourceKey, row: u8, choice: u8) -> Command {
    Command::Research(crate::research::Research { structure_id: home.entity_id, row, choice })
}
pub fn build_toward(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding {
            structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true,
        },
    )
}
pub fn learned(d: super::Deployment, home: ResourceKey) -> u64 {
    snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned
}
pub fn rate(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u64 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_production(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
        .production_rate
}
pub fn balance(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
}
pub fn stepped(rate: u64, steps: u64) -> u64 {
    rate * (10000 + steps * crate::balance::structures::BOARD.output_step_bps.into()) / 10000
}
pub fn level_up(d: super::Deployment, home: ResourceKey) {
    let level = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().base.level;
    for cost in crate::logic::upgrades::recipe(level + 1).costs {
        super::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
    }
    assert!(execute(d, Command::LevelUp(home.entity_id), 40));
}
