use snforge_std::start_cheat_caller_address;
use crate::commands::Command;
use crate::faith::{
    ClaimPlayer, FaithRules, IFaithOwnershipViewsDispatcher, IFaithOwnershipViewsDispatcherTrait, IFaithSafeDispatcher,
    IFaithSafeDispatcherTrait, PlayerFaithKey, Pledge,
};
use crate::game::IGameDispatcherTrait;
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::ResourceKey;
use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
use crate::tests::state::StructureObservationTrait;
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, set_fixture, setup_with_rules};

pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::recorded::rules();
    rules.faith_enabled = true;
    rules.mode_rules = super::recorded::ETERNUM_RULES;
    rules.command_mask = super::recorded::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.structures.faith = config();
    let (deployment, wonder, realm) = super::resource_commands::setup_with_preset(preset);
    set_wonder(deployment, wonder, true);
    set_wonder(deployment, realm, false);
    (deployment, wonder, realm)
}
fn config() -> FaithRules {
    FaithRules { wonder_rate: 500, realm_rate: 100, village_rate: 10, owner_share_bps: 3000 }
}
pub fn set_wonder(deployment: super::Deployment, key: ResourceKey, enabled: bool) {
    let value = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        StructureRecord {
            owner: value.owner,
            base: value.base,
            resources_packed: value.resources_packed,
            metadata: crate::structures::StructureMetadata { has_wonder: enabled, ..value.metadata },
        },
    );
}
fn view(deployment: super::Deployment) -> IFaithOwnershipViewsDispatcher {
    IFaithOwnershipViewsDispatcher { contract_address: deployment.games }
}
fn pledge(structure: ResourceKey, wonder: ResourceKey) -> Command {
    Command::PledgeFaith(Pledge { structure_id: structure.entity_id, wonder_id: wonder.entity_id })
}
fn claim(player: starknet::ContractAddress, wonder: ResourceKey) -> Command {
    Command::ClaimPlayerFaithPoints(ClaimPlayer { player, wonder_id: wonder.entity_id })
}
fn points(
    deployment: super::Deployment, player: starknet::ContractAddress, wonder: ResourceKey,
) -> crate::faith::PlayerFaithPoints {
    view(deployment).player_faith_points(PlayerFaithKey { game_id: 3, player, wonder_id: wonder.entity_id })
}
fn transfer(key: ResourceKey, owner: starknet::ContractAddress) -> Command {
    Command::TransferStructureOwnership(
        crate::ownership::TransferOwnership { entity_id: key.entity_id, new_owner: owner },
    )
}
#[test]
fn pledges_accrue_rates_and_claims_cap_at_season_end_without_double_counting() {
    let (deployment, wonder, realm) = setup();
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(realm, wonder), 50));
    let state = view(deployment).wonder_faith(wonder);
    assert_eq!(state.claimed_points, 5000);
    assert_eq!(state.claim_per_sec, 600);
    assert_eq!(state.owner_claim_per_sec, 180);
    assert_eq!(state.num_structures_pledged, 2);
    assert!(execute_recorded_at(deployment, Command::ClaimWonderPoints(wonder.entity_id), 100, 5000));
    assert_eq!(view(deployment).wonder_faith(wonder).claimed_points, 35000);
    assert!(execute(deployment, claim(deployment.actor, wonder), 100));
    assert_eq!(points(deployment, deployment.actor, wonder).points_claimed, 35000);
    assert!(execute(deployment, Command::ClaimWonderPoints(wonder.entity_id), 500));
    assert!(execute(deployment, claim(deployment.actor, wonder), 500));
    assert_eq!(view(deployment).wonder_faith(wonder).claimed_points, 95000);
    assert_eq!(points(deployment, deployment.actor, wonder).points_claimed, 95000);
    assert!(execute(deployment, Command::ClaimWonderPoints(wonder.entity_id), 600));
    assert!(execute(deployment, claim(deployment.actor, wonder), 600));
    assert_eq!(points(deployment, deployment.actor, wonder).points_claimed, 95000);
    assert_eq!(view(deployment).wonder_faith_winners(3).wonder_ids, array![wonder.entity_id].span());
}
#[test]
fn ownership_transfers_settle_old_entitlements_and_assign_only_future_rates() {
    let (deployment, wonder, realm) = setup();
    let other: starknet::ContractAddress = 987.try_into().unwrap();
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(realm, wonder), 50));
    assert!(execute(deployment, transfer(realm, other), 70));
    assert_eq!(points(deployment, deployment.actor, wonder).points_claimed, 17000);
    assert_eq!(points(deployment, other, wonder).points_per_sec_as_pledger, 70);
    assert!(execute(deployment, transfer(wonder, other), 80));
    assert_eq!(points(deployment, deployment.actor, wonder).points_claimed, 22300);
    let old = points(deployment, deployment.actor, wonder);
    assert_eq!(old.points_per_sec_as_owner + old.points_per_sec_as_pledger, 0);
    assert!(execute(deployment, claim(other, wonder), 100));
    assert_eq!(points(deployment, other, wonder).points_claimed, 12700);
    assert_eq!(view(deployment).faithful_structure(realm).last_recorded_owner, other);
    assert_eq!(view(deployment).wonder_faith(wonder).last_recorded_owner, other);
}
#[test]
fn pledge_requires_owner_active_wonder_and_valid_target_and_rejections_leave_facts_unchanged() {
    let (deployment, wonder, realm) = setup();
    assert_terminal_rejection(deployment, pledge(realm, wonder), 40);
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert_terminal_rejection(deployment, pledge(wonder, wonder), 50);
    assert_terminal_rejection(deployment, pledge(realm, realm), 50);
    assert!(execute(deployment, transfer(realm, 987.try_into().unwrap()), 50));
    assert_terminal_rejection(deployment, pledge(realm, wonder), 60);
    assert_eq!(view(deployment).faithful_structure(realm).wonder_id, 0);
    assert_eq!(view(deployment).wonder_faith(wonder).num_structures_pledged, 1);
    assert_terminal_rejection(deployment, pledge(ResourceKey { entity_id: 999, ..realm }, wonder), 60);
}
#[test]
fn removing_pledges_requires_an_owner_and_updates_rates_before_deleting_allegiance() {
    let (deployment, wonder, realm) = setup();
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(realm, wonder), 50));
    assert_terminal_rejection(deployment, Command::RemoveFaith(wonder.entity_id), 60);
    assert!(execute(deployment, transfer(realm, 987.try_into().unwrap()), 60));
    assert!(execute(deployment, Command::RemoveFaith(realm.entity_id), 70));
    assert_eq!(view(deployment).faithful_structure(realm).wonder_id, 0);
    assert_eq!(view(deployment).wonder_faith(wonder).claim_per_sec, 500);
    assert_eq!(points(deployment, 987.try_into().unwrap(), wonder).points_per_sec_as_pledger, 0);
    assert_terminal_rejection(deployment, Command::RemoveFaith(realm.entity_id), 70);
    assert!(execute(deployment, Command::RemoveFaith(wonder.entity_id), 80));
    assert_eq!(view(deployment).wonder_faith(wonder).claim_per_sec, 0);
}
#[test]
fn subservient_wonders_cannot_receive_pledges_and_submission_requires_no_followers() {
    let (deployment, first, second) = setup();
    set_wonder(deployment, second, true);
    assert!(execute(deployment, pledge(first, first), 40));
    assert!(execute(deployment, pledge(second, second), 40));
    assert_terminal_rejection(deployment, pledge(second, first), 50);
    assert!(execute(deployment, Command::RemoveFaith(second.entity_id), 50));
    assert!(execute(deployment, pledge(second, first), 50));
    assert_eq!(view(deployment).wonder_faith(first).claim_per_sec, 1000);
    assert_terminal_rejection(deployment, Command::RemoveFaith(first.entity_id), 60);
    assert_terminal_rejection(deployment, pledge(first, second), 60);
}
#[test]
#[feature("safe_dispatcher")]
fn faith_configuration_requires_authority_and_isolates_games() {
    let (deployment, _, _) = setup();
    let registry = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = super::resource_commands::fixture_preset(super::recorded::rules());
    assert!(registry.register_preset(20000, preset).is_err());
    start_cheat_caller_address(deployment.games, super::authority());
    assert!(registry.register_preset(10003, preset).is_err());
    preset.structures.faith = FaithRules { owner_share_bps: 10001, ..config() };
    assert!(registry.register_preset(20000, preset).is_err());
    preset.structures.faith = FaithRules { realm_rate: 101, ..config() };
    super::recorded::seed_game_with_preset(
        deployment.games, 4, crate::game::IGameDispatcher { contract_address: deployment.games }.game(3), preset,
    );
    let safe = IFaithSafeDispatcher { contract_address: deployment.games };
    assert_eq!(safe.faith_rules(3).unwrap(), config());
    assert_eq!(safe.faith_rules(4).unwrap().realm_rate, 101);
    assert!(safe.faith_rules(999).is_err());
}

#[test]
fn village_pledges_use_the_village_rate_and_integer_owner_split() {
    let (deployment, wonder, village) = setup();
    let record = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(village).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, village.entity_id.into()].span(),
        StructureRecord {
            owner: record.owner,
            base: crate::structures::StructureBase { category: 5, ..record.base },
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(village, wonder), 50));
    let state = view(deployment).faithful_structure(village);
    assert_eq!(state.fp_to_wonder_owner_per_sec, 3);
    assert_eq!(state.fp_to_struct_owner_per_sec, 7);
    assert_eq!(view(deployment).wonder_faith(wonder).claim_per_sec, 510);
}
#[test]
fn equal_scoring_wonders_remain_tied_without_duplicate_winner_entries() {
    let (deployment, first, second) = setup();
    set_wonder(deployment, second, true);
    assert!(execute(deployment, pledge(first, first), 40));
    assert!(execute(deployment, pledge(second, second), 40));
    for id in array![first.entity_id, second.entity_id, first.entity_id] {
        assert!(execute(deployment, Command::ClaimWonderPoints(id), 100));
    }
    let winners = view(deployment).wonder_faith_winners(3);
    assert_eq!(winners.high_score, 30000);
    assert_eq!(winners.wonder_ids, array![first.entity_id, second.entity_id].span());
}
#[test]
fn faith_requires_eternum_and_enabled_pledges_and_obeys_each_time_boundary() {
    let (deployment, wonder, realm) = setup();
    assert_terminal_rejection(deployment, pledge(wonder, wonder), 19);
    assert_terminal_rejection(deployment, claim(0.try_into().unwrap(), wonder), 40);
    assert_terminal_rejection(deployment, Command::ClaimWonderPoints(realm.entity_id), 40);
    assert_terminal_rejection(deployment, pledge(wonder, wonder), 200);
    let config = crate::rules::SliceRules {
        faith_enabled: false,
        mode_rules: super::recorded::ETERNUM_RULES,
        entry_rule: crate::rules::ENTRY_ENTITLEMENT,
        command_mask: super::recorded::ETERNUM_COMMAND_MASK,
        ..super::recorded::rules(),
    };
    let (disabled, wonder, _) = setup_with_rules(config);
    assert_terminal_rejection(disabled, pledge(wonder, wonder), 40);
    let config = crate::rules::SliceRules {
        faith_enabled: true,
        mode_rules: super::recorded::BLITZ_RULES,
        entry_rule: crate::rules::ENTRY_ROSTER,
        command_mask: super::recorded::BLITZ_COMMAND_MASK,
        ..super::recorded::rules(),
    };
    let (blitz, wonder, _) = setup_with_rules(config);
    assert_terminal_rejection(blitz, pledge(wonder, wonder), 40);
}
