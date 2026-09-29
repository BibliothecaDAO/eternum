use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::artificer::{
    IArtificerDispatcher, IArtificerDispatcherTrait, IArtificerSafeDispatcher, IArtificerSafeDispatcherTrait, RESEARCH,
};
use crate::commands::Command;
use crate::game::IGameDispatcherTrait;
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture};
fn view(d: super::Deployment) -> IArtificerDispatcher {
    IArtificerDispatcher { contract_address: d.games }
}
fn setup(blitz: bool) -> (super::Deployment, ResourceKey) {
    let mut rules = super::recorded::rules();
    rules.mode_rules = if blitz {
        super::recorded::BLITZ_RULES
    } else {
        super::recorded::ETERNUM_RULES
    };
    rules
        .command_mask = if blitz {
            super::recorded::BLITZ_COMMAND_MASK
        } else {
            super::recorded::ETERNUM_COMMAND_MASK
        };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.economy.research_cost = 10 * RESOURCE_PRECISION;
    preset.economy.relics = super::relics::rules();
    preset.economy.chests = None;
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    grant(d, home, RESEARCH, 20 * RESOURCE_PRECISION);
    (d, home)
}
fn balance(d: super::Deployment, home: ResourceKey, id: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: id })
}
fn structure(d: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress, category: u8) {
    let value = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        StructureRecord {
            owner,
            base: crate::structures::StructureBase { category, ..value.base },
            resources_packed: value.resources_packed,
            metadata: value.metadata,
        },
    );
}
#[test]
fn crafting_spends_precise_research_and_grants_the_seeded_relic_in_both_modes() {
    for blitz in array![false, true] {
        let (d, home) = setup(blitz);
        assert!(execute(d, Command::CraftRelic(home.entity_id), 30));
        assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, 40), RESOURCE_PRECISION);
        for id in 39_u8..57 {
            if id != 40 {
                assert_eq!(balance(d, home, id), 0);
            }
        }
    }
}
#[test]
fn villages_craft_with_the_same_cost_and_have_no_connected_realm_requirement() {
    let (d, home) = setup(false);
    structure(d, home, d.actor, 5);
    assert!(execute(d, Command::CraftRelic(home.entity_id), 30));
    assert_eq!(balance(d, home, 40), RESOURCE_PRECISION);
    assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
}
#[test]
fn delayed_crafting_uses_recorded_time_and_root_after_the_game_has_ended() {
    let (d, home) = setup(true);
    assert!(execute_recorded_at(d, Command::CraftRelic(home.entity_id), 30, 5000));
    assert_eq!(balance(d, home, 40), RESOURCE_PRECISION);
    assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
}
#[test]
fn rejected_crafting_preserves_balances_and_consumes_the_ticket() {
    let (d, home) = setup(false);
    let command = Command::CraftRelic(home.entity_id);
    assert_terminal_rejection(d, command, 19);
    structure(d, home, 987.try_into().unwrap(), 1);
    assert_terminal_rejection(d, command, 30);
    structure(d, home, d.actor, 4);
    assert_terminal_rejection(d, command, 30);
    structure(d, home, d.actor, 1);
    assert_eq!(balance(d, home, RESEARCH), 20 * RESOURCE_PRECISION);
    assert!(execute(d, command, 30));
    assert!(execute(d, command, 30));
    assert_terminal_rejection(d, command, 30);
    assert_eq!(balance(d, home, RESEARCH), 0);
    assert_eq!(balance(d, home, 40), 2 * RESOURCE_PRECISION);
    assert_terminal_rejection(d, command, 200);
}
#[test]
#[feature("safe_dispatcher")]
fn crafting_configuration_is_authorized_immutable_and_game_scoped() {
    let (d, _) = setup(false);
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    let mut preset = super::resource_commands::fixture_preset(super::recorded::rules());
    preset.economy.research_cost = 5;
    start_cheat_caller_address(d.games, d.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(d.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: d.games };
    assert!(registrar.register_preset(games.game(3).preset_id, preset).is_err());
    stop_cheat_caller_address(d.games);
    super::recorded::seed_game_with_preset(d.games, 4, games.game(3), preset);
    assert_eq!(view(d).artificer_cost(4), 5);
    assert_eq!(view(d).artificer_cost(3), 10 * RESOURCE_PRECISION);
    assert!(IArtificerSafeDispatcher { contract_address: d.games }.artificer_cost(999).is_err());
}
