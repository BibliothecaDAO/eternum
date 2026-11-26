use starknet::ContractAddress;
use crate::combat::{CombatContext, TroopsTrait};
use crate::combat_actions::battle_side;
use crate::commands::{Battle, ExecutionContext};
use crate::game::assert_playing;
use crate::geometry::{distance, spire_neighbor, tile_key};
#[cfg(feature: "blitz")]
use crate::logic::blitz::combat as family;
#[cfg(not(feature: "blitz"))]
use crate::logic::frontier_combat as family;
use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::rules::SliceRules;
use crate::stamina::StaminaSourceTrait;
use crate::structures::Structure;
use crate::troops::{
    Coord, ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher, Troops,
};

#[derive(Copy, Drop)]
struct GuardTarget {
    key: ResourceKey,
    coord: Coord,
    structure: Option<Structure>,
}

#[derive(Copy, Drop)]
enum GuardSource {
    Guard: (crate::guards::GuardKey, u32),
    Empty,
}

#[derive(Copy, Drop)]
struct GuardDefender {
    source: GuardSource,
    army: ExplorerTroops,
    actor: ContractAddress,
    home: u64,
}

pub fn battle_guard(game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext) {
    let rules = authorize(game_id, context);
    let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    let mut attacker = authorized_explorer(key, actor, context);
    let target = guard_target(ResourceKey { game_id, entity_id: command.defender_id }, actor, attacker, context);
    assert!(attacker.troops.count != 0, "aggressor has no troops");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp, context);
    assert_structure_range(attacker.coord, target.coord);
    let mut defender = guard_defender(target, actor, attacker, context);
    let attacker_before = attacker.troops.count;
    let defender_before = defender.army.troops.count;
    let fought = match defender.source {
        GuardSource::Empty => false,
        _ => true,
    };
    if fought {
        fight_guard(key, ref attacker, ref defender, context);
    } else {
        assert_claimable(target);
        attacker = combat_troops(game_id)
            .spend_claim(key, attacker, target.coord, crate::commands::action_context(context));
    }
    let clean = crate::oaths::clean_win(attacker_before, attacker.troops.count);
    complete_guard_capture(key, attacker, target, defender, defender_before, command.relic_slot, clean, context);
    if fought {
        emit_guard_battle(key, actor, attacker, attacker_before, target, defender, defender_before, context);
    }
}

fn assert_claimable(target: GuardTarget) {
    assert!(
        crate::logic::expeditions::expedition_site(target.key).is_none(),
        "a site goes to the army that beats its last guard",
    );
}

fn guard_target(
    key: ResourceKey, actor: ContractAddress, attacker: ExplorerTroops, context: ExecutionContext,
) -> GuardTarget {
    let rules = context.rules.unbox();
    if crate::rules::DEEP_IN_PLAY {
        if let Some(site) = crate::logic::deep_sites::site(key) {
            let day = crate::days::day_of(
                context.game.unbox(), crate::clock::day_unit_seconds(context.game.unbox()), context.timestamp,
            );
            assert!(site.day == day.index, "Deep is settling, try again");
            crate::logic::deep_sites::assert_open(key.game_id, site);
            assert!(
                site.aspect == 0
                    || crate::logic::aspects::home_aspect(
                        ResourceKey { game_id: key.game_id, entity_id: attacker.owner },
                    ) != site
                        .aspect,
                "your Aspect holds this site",
            );
            let coord = crate::logic::map::entity_coord(key).expect('missing Deep site position');
            return GuardTarget { key, coord, structure: None };
        }
    }
    let structure = crate::logic::structures::structure(key).expect('missing guarded structure');
    if crate::rules::ONLY_UNOWNED_TARGETS {
        assert!(structure.owner == 0.try_into().unwrap(), "target must be unowned");
    } else {
        assert!(structure.owner != actor, "actor owns defender");
    }
    assert_battle_immunity(key.game_id, key.entity_id, rules, context.timestamp, context);
    GuardTarget { key, coord: crate::structures::structure_coord(key), structure: Some(structure) }
}

fn guard_defender(
    target: GuardTarget, actor: ContractAddress, attacker: ExplorerTroops, context: ExecutionContext,
) -> GuardDefender {
    let (owner, maximum) = match target.structure {
        Some(structure) => (structure.owner, structure.base.troop_max_guard_count),
        None => (0.try_into().unwrap(), crate::rules::DEEP_GUARD_SLOTS),
    };
    let Some(key) = crate::logic::guards::GuardState::next(target.key, maximum) else {
        return GuardDefender {
            source: GuardSource::Empty,
            actor: owner,
            army: ExplorerTroops { owner: target.key.entity_id, coord: target.coord, troops: Default::default() },
            home: 0,
        };
    };
    let home = if target.structure.is_none() {
        crate::logic::deep_garrisons::home(key)
    } else {
        0
    };
    let mut troops = crate::logic::guards::guard(key).troops;
    if home != 0 {
        let player = crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: home });
        assert!(player != actor, "actor owns defender");
        return GuardDefender {
            source: GuardSource::Guard((key, 10000)),
            actor: player,
            army: ExplorerTroops { owner: target.key.entity_id, coord: target.coord, troops },
            home,
        };
    }
    let bps = beast_bps(target, attacker.owner, context.timestamp);
    troops.count = (troops.count * bps.into() + 9999) / 10000;
    GuardDefender {
        source: GuardSource::Guard((key, bps)),
        actor: owner,
        army: ExplorerTroops { owner: target.key.entity_id, coord: target.coord, troops },
        home: 0,
    }
}

fn beast_bps(target: GuardTarget, home: u64, timestamp: u64) -> u32 {
    if crate::rules::DEEP_IN_PLAY {
        crate::race::IRaceDispatcherTrait::site_beast_bps(
            crate::race::IRaceLibraryDispatcher {
                class_hash: crate::logic::release::class_of(target.key.game_id, crate::slots::ECONOMY),
            },
            target.key,
            home,
            timestamp,
        )
    } else {
        10000
    }
}

fn fight_guard(key: ExplorerKey, ref attacker: ExplorerTroops, ref defender: GuardDefender, context: ExecutionContext) {
    let target = match defender.source {
        GuardSource::Guard((key, _)) => key.structure_id,
        GuardSource::Empty => panic!("missing fought guard"),
    };
    record_target(key, target, context);
    let combat = CombatContext {
        attacker_oaths: crate::logic::progression::held_oaths(key, context),
        defender_oaths: 0,
        defender_is_structure_guard: if crate::rules::ONLY_UNOWNED_TARGETS {
            defender.actor != 0.try_into().unwrap()
        } else {
            true
        },
        ..combat_context(key.game_id, attacker, defender.army, context),
    };
    let combat = CombatContext {
        attacker_twin_damage: twin_damage(key, attacker, defender.army.troops, combat, context), ..combat,
    };
    let attacker_before = attacker.troops.count;
    let defender_before = defender.army.troops.count;
    let (attacker_after, defender_after) = resolve_battle(
        key.game_id, attacker.troops, defender.army.troops, combat, context,
    );
    attacker.troops = attacker_after;
    defender.army.troops = defender_after;
    combat_troops(key.game_id).finish_battle(key, attacker, attacker_before, crate::commands::action_context(context));
    save_guard_defender(defender, defender_before, context);
}

fn save_guard_defender(defender: GuardDefender, before: u128, context: ExecutionContext) {
    match defender.source {
        GuardSource::Guard((
            key, bps,
        )) => {
            let mut row = crate::logic::guards::guard(key);
            let base_before = row.troops.count;
            row.troops = defender.army.troops;
            row
                .troops
                .count =
                    core::cmp::min(
                        base_before, (row.troops.count * 10000 + Into::<u32, u128>::into(bps) - 1) / bps.into(),
                    );
            if row.troops.count == 0 {
                row.troops.stamina.reset();
                row
                    .destroyed_tick = (context.timestamp / context.rules.unbox().tick_config.armies_tick_in_seconds)
                    .try_into()
                    .unwrap();
            }
            crate::logic::guards::GuardState::save(key, row);
        },
        GuardSource::Empty => panic!("missing fought guard"),
    }
}

fn complete_guard_capture(
    key: ExplorerKey,
    attacker: ExplorerTroops,
    target: GuardTarget,
    defender: GuardDefender,
    defender_before: u128,
    relic_slot: Option<u8>,
    clean: bool,
    context: ExecutionContext,
) {
    if let Some(structure) = target.structure {
        try_capture(key, attacker, target.key, structure, relic_slot, clean, context);
        return;
    }
    if defender.army.troops.count != 0 {
        return;
    }
    let home = ResourceKey { game_id: key.game_id, entity_id: attacker.owner };
    if let GuardSource::Guard((slot, _)) = defender.source {
        crate::logic::deep_garrisons::record(slot, defender.home);
        if attacker.troops.count == 0 {
            return;
        }
        let size = if defender.home == 0 {
            crate::logic::deep_sites::beast_size(target.key)
        } else {
            defender_before
        };
        crate::logic::quest_progress::guard_beaten(home, size, context.timestamp);
        if crate::logic::guards::GuardState::next(target.key, crate::rules::DEEP_GUARD_SLOTS).is_some() {
            return;
        }
        crate::logic::quest_progress::site_cleared(home, context.timestamp);
    }
    if attacker.troops.count != 0 {
        claim_deep_site(target.key, attacker.owner, context.timestamp);
    }
}

fn claim_deep_site(site: ResourceKey, home: u64, timestamp: u64) {
    let previous_owner = crate::logic::structures::owner(site);
    let new_owner = crate::logic::deep_garrisons::claim(site, home);
    crate::logic::stories::emit_entity_story(
        site,
        new_owner,
        crate::ownership::Story::StructureCapturedStory(
            crate::ownership::StructureCapturedStory { previous_owner, new_owner },
        ),
        timestamp,
    );
}

fn emit_guard_battle(
    key: ExplorerKey,
    actor: ContractAddress,
    attacker: ExplorerTroops,
    attacker_before: u128,
    target: GuardTarget,
    defender: GuardDefender,
    defender_before: u128,
    context: ExecutionContext,
) {
    let winner = if attacker.troops.count == 0 && defender.army.troops.count != 0 {
        target.key.entity_id
    } else if defender.army.troops.count == 0 && attacker.troops.count != 0 {
        attacker.owner
    } else {
        0
    };
    emit(
        crate::troops::BattleEvent {
            version: 2,
            game_id: key.game_id,
            attacker_id: key.explorer_id,
            defender_id: target.key.entity_id,
            attacker_owner: attacker.owner,
            defender_owner: defender.home,
            winner_id: winner,
            coord: target.coord,
            max_reward: array![].span(),
            attacker: battle_side(actor, attacker_before, attacker.troops),
            defender: battle_side(defender.actor, defender_before, defender.army.troops),
            timestamp: context.timestamp,
        },
    );
}

pub fn battle(
    game_id: u32, actor: ContractAddress, command: crate::combat_actions::AttackExplorer, context: ExecutionContext,
) {
    let rules = authorize(game_id, context);
    crate::resources::assert_unique_resources(command.steal_resources);
    let attacker_key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    let defender_key = ExplorerKey { game_id, explorer_id: command.defender_id };
    let mut attacker = authorized_explorer(attacker_key, actor, context);
    let mut defender = active_explorer(defender_key, context);
    let defender_owner = explorer_owner(defender_key, defender);
    assert!(defender_owner != actor, "actor owns defender");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp, context);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp, context);
    assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
    assert_battle_range(game_id, attacker, defender);
    resources_dispatcher(game_id)
        .assert_loot_available(
            ResourceKey { game_id, entity_id: command.defender_id },
            command.steal_resources,
            context.timestamp,
            crate::commands::resource_context(context),
        );
    let attacker_before = attacker.troops.count;
    let defender_before = defender.troops.count;
    record_target(attacker_key, command.defender_id, context);
    let combat = CombatContext {
        attacker_oaths: crate::logic::progression::held_oaths(attacker_key, context),
        defender_oaths: crate::logic::progression::held_oaths(defender_key, context),
        ..combat_context(game_id, attacker, defender, context),
    };
    let combat = CombatContext {
        attacker_twin_damage: twin_damage(attacker_key, attacker, defender.troops, combat, context), ..combat,
    };
    let (attacker_after, defender_after) = resolve_battle(game_id, attacker.troops, defender.troops, combat, context);
    attacker.troops = attacker_after;
    defender.troops = defender_after;
    combat_troops(game_id)
        .finish_battle(attacker_key, attacker, attacker_before, crate::commands::action_context(context));
    if defender.troops.count == 0 && attacker.troops.count != 0 {
        resources_dispatcher(game_id)
            .take_loot(
                ResourceKey { game_id, entity_id: command.defender_id },
                ResourceKey { game_id, entity_id: command.attacker_id },
                command.steal_resources,
                context.timestamp,
                crate::commands::resource_context(context),
            );
    }
    combat_troops(game_id)
        .finish_battle(defender_key, defender, defender_before, crate::commands::action_context(context));
    emit(
        crate::troops::BattleEvent {
            version: 2,
            game_id,
            attacker_id: command.attacker_id,
            defender_id: command.defender_id,
            attacker_owner: attacker.owner,
            defender_owner: defender.owner,
            winner_id: battle_winner(attacker, defender),
            coord: defender.coord,
            max_reward: command.steal_resources,
            attacker: battle_side(actor, attacker_before, attacker.troops),
            defender: battle_side(defender_owner, defender_before, defender.troops),
            timestamp: context.timestamp,
        },
    );
}

pub fn guard_attack(
    game_id: u32, actor: ContractAddress, command: crate::combat_actions::GuardAttack, context: ExecutionContext,
) {
    let rules = authorize(game_id, context);
    let home = owned_structure(game_id, command.guard.structure_id, actor);
    assert!(command.guard.slot < home.base.troop_max_guard_count, "invalid guard slot");
    let guard_key = crate::guards::GuardKey {
        game_id, structure_id: command.guard.structure_id, slot: command.guard.slot,
    };
    let mut guard = crate::logic::guards::guard(guard_key);
    let defender_key = ExplorerKey { game_id, explorer_id: command.explorer_id };
    let mut defender = active_explorer(defender_key, context);
    let defender_owner = explorer_owner(defender_key, defender);
    assert!(guard.troops.count != 0 && defender.troops.count != 0, "dead combatant");
    let coord = crate::structures::structure_coord(ResourceKey { game_id, entity_id: command.guard.structure_id });
    assert_structure_range(coord, defender.coord);
    assert_battle_immunity(game_id, command.guard.structure_id, rules, context.timestamp, context);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp, context);
    let attacker = ExplorerTroops { owner: command.guard.structure_id, coord, troops: guard.troops };
    let combat = CombatContext {
        attacker_is_structure_guard: true,
        defender_oaths: crate::logic::progression::held_oaths(defender_key, context),
        ..combat_context(game_id, attacker, defender, context),
    };
    let (attacker_after, defender_after) = resolve_battle(game_id, guard.troops, defender.troops, combat, context);
    let before = defender.troops.count;
    defender.troops = defender_after;
    combat_troops(game_id).finish_battle(defender_key, defender, before, crate::commands::action_context(context));
    guard.troops = attacker_after;
    if guard.troops.count == 0 {
        guard.troops.stamina.reset();
        guard.destroyed_tick = (context.timestamp / rules.tick_config.armies_tick_in_seconds).try_into().unwrap();
    }
    crate::logic::guards::GuardState::save(guard_key, guard);
    try_capture(
        defender_key,
        defender,
        ResourceKey { game_id, entity_id: command.guard.structure_id },
        home,
        None,
        false,
        context,
    );
    emit(
        crate::troops::BattleEvent {
            version: 2,
            game_id,
            attacker_id: command.guard.structure_id,
            defender_id: command.explorer_id,
            attacker_owner: 0,
            defender_owner: defender.owner,
            winner_id: battle_winner(ExplorerTroops { troops: guard.troops, ..attacker }, defender),
            coord: defender.coord,
            max_reward: array![].span(),
            attacker: battle_side(actor, attacker.troops.count, guard.troops),
            defender: battle_side(defender_owner, before, defender.troops),
            timestamp: context.timestamp,
        },
    );
}

pub fn explorer_owner(key: ExplorerKey, explorer: ExplorerTroops) -> ContractAddress {
    crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: explorer.owner })
}


pub fn try_capture(
    explorer_key: ExplorerKey,
    explorer: ExplorerTroops,
    key: ResourceKey,
    target: Structure,
    relic_slot: Option<u8>,
    clean: bool,
    context: ExecutionContext,
) {
    if explorer.troops.count == 0 {
        clear_site_left_unguarded(key, target);
        return;
    }
    if (crate::rules::ONLY_UNOWNED_TARGETS && target.owner != 0.try_into().unwrap())
        || (crate::rules::NO_VILLAGE_CAPTURE && target.base.category == crate::taxonomy::VILLAGE_CATEGORY) {
        return;
    }
    if !crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(key))
        || crate::logic::guards::GuardState::next(key, target.base.troop_max_guard_count).is_some() {
        return;
    }
    family::capture(explorer_key, explorer, key, target, relic_slot, clean, context);
}

fn clear_site_left_unguarded(key: ResourceKey, target: Structure) {
    if crate::logic::expeditions::expedition_site(key).is_none()
        || crate::logic::guards::GuardState::next(key, target.base.troop_max_guard_count).is_some() {
        return;
    }
    crate::logic::expeditions::clear_site(
        key, crate::expeditions::SiteClear { explorer_id: 0, home_id: 0, reward: None },
    );
}

pub fn assert_structure_range(attacker: Coord, defender: Coord) {
    let stride: u128 = if attacker.alt {
        15
    } else {
        1
    };
    let separation = distance(attacker, defender);
    assert!(attacker.alt == defender.alt && separation > 0 && separation <= stride, "structure is out of range");
}

pub fn battle_winner(attacker: ExplorerTroops, defender: ExplorerTroops) -> u64 {
    if attacker.troops.count == 0 && defender.troops.count > 0 {
        return defender.owner;
    }
    if defender.troops.count == 0 && attacker.troops.count > 0 {
        return attacker.owner;
    }
    0
}

pub fn authorize(game_id: u32, context: ExecutionContext) -> SliceRules {
    assert_playing(context.game.unbox(), context.timestamp);
    context.rules.unbox()
}

pub fn resources_dispatcher(game_id: u32) -> IResourceOperationsLibraryDispatcher {
    IResourceOperationsLibraryDispatcher {
        class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
    }
}

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP) }
}

pub fn owned_structure(game_id: u32, entity_id: u64, actor: ContractAddress) -> Structure {
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('missing home structure');
    assert!(home.owner == actor, "actor does not own structure");
    home
}

pub fn assert_battle_immunity(
    game_id: u32, home_id: u64, rules: SliceRules, timestamp: u64, game_context: crate::commands::ExecutionContext,
) {
    let game = game_context.game.unbox();
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id: home_id }).unwrap();
    let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
    assert!(
        tick >= game.start_main_at / rules.tick_config.armies_tick_in_seconds
            + rules.battle_config.regular_immunity_ticks.into(),
        "season immunity",
    );
    if home.base.category == crate::taxonomy::VILLAGE_CATEGORY {
        assert!(
            tick >= home.base.created_at.into() / rules.tick_config.armies_tick_in_seconds
                + rules.battle_config.village_immunity_ticks.into(),
            "village immunity",
        );
    }
}

pub fn adjacent_to_spire(game_id: u32, coord: Coord) -> bool {
    for direction in 0_u8..6 {
        let key = tile_key(game_id, spire_neighbor(coord, direction));
        if crate::logic::map::occupancy(key)
            .map(|occupier| occupier.category == crate::taxonomy::SPIRE_OCCUPIER)
            .unwrap_or(false) {
            return true;
        }
    }
    false
}

pub fn assert_battle_range(game_id: u32, mut attacker: ExplorerTroops, defender: ExplorerTroops) {
    let within = if attacker.coord.alt != defender.coord.alt {
        attacker.coord.x == defender.coord.x
            && attacker.coord.y == defender.coord.y
            && adjacent_to_spire(game_id, attacker.coord)
    } else {
        let separation = distance(attacker.coord, defender.coord);
        let stride: u128 = if attacker.coord.alt {
            15
        } else {
            1
        };
        separation > 0 && separation <= stride
    };
    assert!(within, "explorers out of range");
}

pub fn combat_context(
    game_id: u32, attacker: ExplorerTroops, defender: ExplorerTroops, context: ExecutionContext,
) -> CombatContext {
    let biome: crate::biome::Biome = map_dispatcher(game_id)
        .biome(tile_key(game_id, defender.coord), crate::commands::biome_context(context))
        .into();
    let combat = CombatContext {
        timestamp: context.timestamp, attacker_biome: biome, defender_biome: biome, ..Default::default(),
    };
    family::at_range(combat, attacker.coord, defender.coord)
}

fn twin_damage(
    key: ExplorerKey, attacker: ExplorerTroops, defender: Troops, combat: CombatContext, context: ExecutionContext,
) -> u128 {
    if !crate::oaths::held(combat.attacker_oaths, crate::oaths::TWINS) {
        return 0;
    }
    let Some(twin) = combat_troops(key.game_id)
        .twins_companion(key, attacker, crate::commands::action_context(context)) else {
        return 0;
    };
    let rules = context.rules.unbox();
    crate::oaths::twin_damage(
        combat.attacker_oaths,
        twin,
        defender,
        combat,
        rules.troop_stamina_config,
        rules.troop_damage_config,
        rules.tick_config.armies_tick_in_seconds,
        rules.battle_config.cooldown_seconds,
    )
}

pub fn resolve_battle(
    game_id: u32,
    mut attacker: Troops,
    mut defender: Troops,
    context: CombatContext,
    game_context: crate::commands::ExecutionContext,
) -> (Troops, Troops) {
    let rules = game_context.rules.unbox();
    if crate::rules::DAYS_IN_PLAY && context.attacker_is_structure_guard {
        attacker
            .stamina
            .refill(
                ref attacker.boosts,
                attacker.category,
                crate::troops::TroopTier::T1,
                rules.troop_stamina_config,
                rules.tick_config.armies_tick_in_seconds,
                context.timestamp,
            );
    }
    if crate::rules::DAYS_IN_PLAY && context.defender_is_structure_guard {
        defender
            .stamina
            .refill(
                ref defender.boosts,
                defender.category,
                crate::troops::TroopTier::T1,
                rules.troop_stamina_config,
                rules.tick_config.armies_tick_in_seconds,
                context.timestamp,
            );
    }
    attacker
        .attack_with_context(
            ref defender,
            context,
            rules.troop_stamina_config,
            rules.troop_damage_config,
            rules.tick_config.armies_tick_in_seconds,
            rules.battle_config.cooldown_seconds,
        );
    (attacker, defender)
}

// Troops owns explorer authorisation; Combat calls it rather than inlining it, to keep its class small.
fn authorized_explorer(key: ExplorerKey, actor: ContractAddress, context: ExecutionContext) -> ExplorerTroops {
    combat_troops(key.game_id).command_explorer(key, Some(actor), crate::commands::action_context(context))
}

fn active_explorer(key: ExplorerKey, context: ExecutionContext) -> ExplorerTroops {
    combat_troops(key.game_id).command_explorer(key, None, crate::commands::action_context(context))
}

pub fn combat_troops(game_id: u32) -> IBattleResolutionLibraryDispatcher {
    IBattleResolutionLibraryDispatcher { class_hash: crate::logic::release::class_of(game_id, crate::slots::TROOPS) }
}
fn emit<T, +starknet::event::Event<T>, +Into<T, crate::logic::combat_domain::CombatLogic::Event>>(event: T) {
    let event: crate::logic::combat_domain::CombatLogic::Event = event.into();
    let mut keys = array![];
    let mut data = array![];
    starknet::event::Event::append_keys_and_data(@event, ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

fn record_target(key: ExplorerKey, target: u64, context: ExecutionContext) {
    if crate::rules::DEEP_IN_PLAY {
        crate::logic::army_combat::record_target(key, target);
    }
}
