use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::combat::{CombatContext, TroopsTrait};
use crate::combat_actions::battle_side;
use crate::commands::{Battle, ExecutionContext};
use crate::game::assert_playing;
use crate::geometry::{distance, spire_neighbor, tile_key};
use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::rules::SliceRules;
use crate::stamina::StaminaSourceTrait;
use crate::structures::Structure;
use crate::troops::{
    Coord, ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher, Troops,
};

pub fn battle_guard(game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext) {
    let rules = authorize(game_id, context);
    let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    let mut attacker = authorized_explorer(key, actor, context);
    let target_key = ResourceKey { game_id, entity_id: command.defender_id };
    let deep = crate::logic::deep_sites::site(target_key);
    let target = if deep.is_some() {
        None
    } else {
        Some(crate::logic::structures::structure(target_key).expect('missing guarded structure'))
    };
    let (destination, target_owner, maximum) = if let Some(target) = target {
        if crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS) {
            assert!(target.owner == 0.try_into().unwrap(), "target must be unowned");
        }
        assert!(target.owner != actor, "actor owns defender");
        assert_battle_immunity(game_id, command.defender_id, rules, context.timestamp, context);
        (crate::structures::structure_coord(target_key), target.owner, target.base.troop_max_guard_count)
    } else {
        let day = crate::days::day_of(context.game.unbox(), rules.day_unit_seconds, context.timestamp);
        assert!(deep.unwrap().day == day.index, "Deep day not settled");
        let destination = crate::logic::map::entity_coord(target_key).expect('missing Deep site position');
        assert!(crate::geometry::adjacent(attacker.coord, destination), "Deep site requires adjacency");
        (destination, 0.try_into().unwrap(), 1_u8)
    };
    assert!(attacker.troops.count != 0, "aggressor has no troops");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp, context);
    assert_structure_range(attacker.coord, destination, attacker.troops.attack_range());
    let adjacent = crate::geometry::adjacent(attacker.coord, destination);
    let army_key = if deep.is_some() {
        crate::logic::deep_guards::next(target_key)
    } else {
        None
    };
    let slot = if army_key.is_some() {
        None
    } else {
        crate::logic::guards::GuardState::next(target_key, maximum)
    };
    let (mut defender, defender_actor) = if let Some(army_key) = army_key {
        let army = combat_troops(game_id).command_explorer(army_key, None, crate::commands::action_context(context));
        let defender = ExplorerTroops { coord: destination, ..army };
        assert_army_opponents(game_id, attacker, defender, rules);
        let owner = explorer_owner(army_key, army);
        assert!(owner != actor, "actor owns defender");
        assert_battle_immunity(game_id, army.owner, rules, context.timestamp, context);
        (defender, owner)
    } else {
        let troops = if let Some(slot) = slot {
            crate::logic::guards::guard(slot).troops
        } else {
            Default::default()
        };
        (ExplorerTroops { owner: command.defender_id, coord: destination, troops }, target_owner)
    };
    let attacker_before = attacker.troops.count;
    let defender_before = defender.troops.count;
    let mut rolls = (0_u8, 0_u8);
    let fought = army_key.is_some() || slot.is_some();
    if fought {
        let combat = CombatContext {
            defender_is_structure_guard: true, ..combat_context(game_id, attacker, defender, context),
        };
        rolls = (combat.attacker_roll, combat.defender_roll);
        let (attacker_after, guard_after) = resolve_battle(game_id, attacker.troops, defender.troops, combat, context);
        attacker.troops = attacker_after;
        defender.troops = guard_after;
        if (deep.is_some() && army_key.is_none()) || crate::logic::expeditions::expedition_site(target_key).is_some() {
            crate::logic::quests::record(
                ResourceKey { game_id, entity_id: attacker.owner },
                crate::quests::CULL,
                defender_before - defender.troops.count,
                context.timestamp,
            );
        }
        let troops = combat_troops(game_id);
        troops.finish_battle(key, attacker, attacker_before, crate::commands::action_context(context));
        if let Some(army_key) = army_key {
            let army = crate::logic::troops::explorer(army_key).expect('missing Deep guard army');
            troops
                .finish_battle(
                    army_key,
                    ExplorerTroops { troops: defender.troops, ..army },
                    defender_before,
                    crate::commands::action_context(context),
                );
        } else {
            let slot = slot.unwrap();
            let mut row = crate::logic::guards::guard(slot);
            if defender.troops.count == 0 {
                defender.troops.stamina.reset();
                row.destroyed_tick = (context.timestamp / rules.tick_config.armies_tick_in_seconds).try_into().unwrap();
            }
            row.troops = defender.troops;
            crate::logic::guards::GuardState::save(slot, row);
        }
    } else {
        assert!(adjacent, "structure claim requires adjacency");
        attacker
            .troops
            .stamina
            .spend(
                ref attacker.troops.boosts,
                attacker.troops.category,
                attacker.troops.tier,
                rules.troop_stamina_config,
                rules.troop_stamina_config.stamina_attack_req.into(),
                rules.tick_config.armies_tick_in_seconds,
                context.timestamp,
                true,
            );
        crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(attacker));
    }
    if let Some(target) = target {
        try_capture(key, attacker, target_key, target, rules, command.relic_slot, context);
    } else if attacker.troops.count != 0
        && defender.troops.count == 0
        && crate::logic::deep_guards::next(target_key).is_none() {
        crate::logic::deep_guards::join(key, attacker, target_key);
        if slot.is_some() {
            crate::logic::deep_sites::grant_beast_xp(key, destination, context.timestamp);
        }
    }
    if fought {
        let (attacker_roll, defender_roll) = rolls;
        let winner = if attacker.troops.count == 0 && defender.troops.count != 0 {
            command.defender_id
        } else if defender.troops.count == 0 && attacker.troops.count != 0 {
            attacker.owner
        } else {
            0
        };
        emit(
            crate::troops::BattleEvent {
                version: 2,
                game_id,
                attacker_id: command.attacker_id,
                defender_id: command.defender_id,
                attacker_owner: attacker.owner,
                defender_owner: if army_key.is_some() {
                    defender.owner
                } else {
                    0
                },
                winner_id: winner,
                coord: destination,
                max_reward: array![].span(),
                attacker: battle_side(actor, attacker_before, attacker.troops, attacker_roll),
                defender: battle_side(defender_actor, defender_before, defender.troops, defender_roll),
                timestamp: context.timestamp,
            },
        );
    }
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
    assert_army_opponents(game_id, attacker, defender, rules);
    let defender_owner = explorer_owner(defender_key, defender);
    assert!(defender_owner != actor, "actor owns defender");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp, context);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp, context);
    assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
    assert_battle_range(game_id, attacker, defender);
    assert_loot_available(game_id, command.defender_id, command.steal_resources, context);
    let attacker_before = attacker.troops.count;
    let defender_before = defender.troops.count;
    let combat = combat_context(game_id, attacker, defender, context);
    let (attacker_after, defender_after) = resolve_battle(game_id, attacker.troops, defender.troops, combat, context);
    attacker.troops = attacker_after;
    defender.troops = defender_after;
    combat_troops(game_id)
        .finish_battle(attacker_key, attacker, attacker_before, crate::commands::action_context(context));
    if defender.troops.count == 0 && attacker.troops.count != 0 {
        take_loot(
            game_id,
            command.defender_id,
            command.attacker_id,
            command.steal_resources,
            false,
            context.timestamp,
            context,
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
            attacker: battle_side(actor, attacker_before, attacker.troops, combat.attacker_roll),
            defender: battle_side(defender_owner, defender_before, defender.troops, combat.defender_roll),
            timestamp: context.timestamp,
        },
    );
}

fn assert_army_opponents(game_id: u32, attacker: ExplorerTroops, defender: ExplorerTroops, rules: SliceRules) {
    if rules.day_unit_seconds == 0 {
        return;
    }
    assert!(
        crate::logic::deep::contains(game_id, attacker.coord) && crate::logic::deep::contains(game_id, defender.coord),
        "army combat requires Deep",
    );
    let attacker_aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: attacker.owner });
    let defender_aspect = crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: defender.owner });
    assert!(attacker_aspect != defender_aspect, "cannot attack an allied army");
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
    assert_structure_range(coord, defender.coord, guard.troops.attack_range());
    assert_battle_immunity(game_id, command.guard.structure_id, rules, context.timestamp, context);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp, context);
    let attacker = ExplorerTroops { owner: command.guard.structure_id, coord, troops: guard.troops };
    let combat = CombatContext {
        attacker_is_structure_guard: true, ..combat_context(game_id, attacker, defender, context),
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
        rules,
        None,
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
            attacker: battle_side(actor, attacker.troops.count, guard.troops, combat.attacker_roll),
            defender: battle_side(defender_owner, before, defender.troops, combat.defender_roll),
            timestamp: context.timestamp,
        },
    );
}

pub fn explorer_owner(key: ExplorerKey, explorer: ExplorerTroops) -> ContractAddress {
    crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: explorer.owner })
}

// Requested loot is a deterministic refusal, independent of whether the combat roll wins.
fn assert_loot_available(
    game_id: u32, from: u64, resources: Span<crate::resources::ResourceAmount>, context: ExecutionContext,
) {
    if resources.is_empty() {
        return;
    }
    let key = ResourceKey { game_id, entity_id: from };
    resources_dispatcher(game_id).settle_production(key, context.timestamp, crate::commands::resource_context(context));
    for resource in resources {
        assert!(
            crate::logic::resources::balance(key, *resource.resource_type) >= *resource.amount,
            "insufficient requested loot",
        );
    }
}

pub fn take_loot(
    game_id: u32,
    from: u64,
    to: u64,
    resources: Span<crate::resources::ResourceAmount>,
    storable_only: bool,
    timestamp: u64,
    game_context: crate::commands::ExecutionContext,
) {
    let dispatcher = resources_dispatcher(game_id);
    let from = ResourceKey { game_id, entity_id: from };
    let to = ResourceKey { game_id, entity_id: to };
    for resource in resources {
        let mut amount = *resource.amount;
        if storable_only {
            let weight = crate::logic::resources::weight(to);
            let unit = crate::logic::resources::rule(game_id, *resource.resource_type).unit_weight;
            if unit != 0 && weight.capacity != 0xffffffffffffffffffffffffffffffff {
                amount =
                    core::cmp::min(amount, (weight.capacity - core::cmp::min(weight.capacity, weight.weight)) / unit);
            }
        }
        if amount != 0 {
            dispatcher
                .spend_resource(
                    from, *resource.resource_type, amount, timestamp, crate::commands::resource_context(game_context),
                );
            dispatcher
                .grant_resource(
                    to, *resource.resource_type, amount, timestamp, crate::commands::resource_context(game_context),
                );
        }
    }
}

pub fn try_capture(
    explorer_key: ExplorerKey,
    explorer: ExplorerTroops,
    key: ResourceKey,
    target: Structure,
    rules: SliceRules,
    relic_slot: Option<u8>,
    context: ExecutionContext,
) {
    if explorer.troops.count == 0
        || (crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS) && target.owner != 0.try_into().unwrap())
        || (target.base.category == crate::taxonomy::VILLAGE_CATEGORY
            && !crate::rules::rule_enabled(rules, crate::rules::CAPTURE_VILLAGES)) {
        return;
    }
    if !crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(key))
        || crate::logic::guards::GuardState::next(key, target.base.troop_max_guard_count).is_some() {
        return;
    }
    if rules.day_unit_seconds == 0 {
        crate::logic::guards::GuardState::reset(key);
        crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
            crate::guards::IStructureCaptureLibraryDispatcher { class_hash: classes(key.game_id).structures.read() },
            key,
            explorer.owner,
            context.timestamp,
            crate::commands::action_context(context),
        );
    }
    if target.owner == 0.try_into().unwrap() {
        crate::relics::ICaptureRewardsDispatcherTrait::grant_capture_rewards(
            crate::relics::ICaptureRewardsLibraryDispatcher { class_hash: classes(key.game_id).relics.read() },
            key,
            explorer_key.explorer_id,
            relic_slot,
            crate::commands::action_context(context),
        );
    }
}

pub fn assert_structure_range(attacker: Coord, defender: Coord, range: u32) {
    let stride: u128 = if attacker.alt {
        15
    } else {
        1
    };
    let separation = distance(attacker, defender);
    assert!(
        attacker.alt == defender.alt && separation > 0 && separation <= range.into() * stride,
        "structure is out of range",
    );
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
    IResourceOperationsLibraryDispatcher { class_hash: classes(game_id).resources.read() }
}

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: classes(game_id).map.read() }
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
        separation > 0 && separation <= attacker.troops.attack_range().into() * stride
    };
    assert!(within, "explorers out of range");
}

pub fn combat_context(
    game_id: u32, attacker: ExplorerTroops, defender: ExplorerTroops, context: ExecutionContext,
) -> CombatContext {
    let biome: crate::biome::Biome = map_dispatcher(game_id)
        .biome(tile_key(game_id, defender.coord), crate::commands::biome_context(context))
        .into();
    let mode_rules = context.rules.unbox().mode_rules;
    let ethereal_dice = defender.coord.alt && mode_rules & crate::rules::COMBAT_DICE_ETHEREAL != 0;
    let (attacker_roll, defender_roll) = if ethereal_dice || mode_rules & crate::rules::COMBAT_DICE != 0 {
        let mut raw_root = context.raw_root;
        let seed = crate::random::game_root(ref raw_root, game_id);
        (
            1_u8 + crate::random::range(seed, 1, 20).try_into().unwrap(),
            1_u8 + crate::random::range(seed, 2, 20).try_into().unwrap(),
        )
    } else {
        (0_u8, 0_u8)
    };
    let attack_distance = if attacker.coord.alt != defender.coord.alt {
        1
    } else {
        let stride = if attacker.coord.alt {
            15
        } else {
            1
        };
        (distance(attacker.coord, defender.coord) / stride).try_into().unwrap()
    };
    CombatContext {
        timestamp: context.timestamp,
        day_unit_seconds: context.rules.unbox().day_unit_seconds,
        attacker_roll,
        defender_roll,
        attacker_biome: biome,
        defender_biome: biome,
        attack_distance,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    }
}

pub fn resolve_battle(
    game_id: u32,
    mut attacker: Troops,
    mut defender: Troops,
    context: CombatContext,
    game_context: crate::commands::ExecutionContext,
) -> (Troops, Troops) {
    let rules = game_context.rules.unbox();
    if rules.day_unit_seconds != 0 {
        if context.attacker_is_structure_guard {
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
        if context.defender_is_structure_guard {
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
    crate::logic::deep_guards::assert_field(key);
    combat_troops(key.game_id).command_explorer(key, Some(actor), crate::commands::action_context(context))
}

fn active_explorer(key: ExplorerKey, context: ExecutionContext) -> ExplorerTroops {
    crate::logic::deep_guards::assert_field(key);
    combat_troops(key.game_id).command_explorer(key, None, crate::commands::action_context(context))
}

pub fn combat_troops(game_id: u32) -> IBattleResolutionLibraryDispatcher {
    IBattleResolutionLibraryDispatcher { class_hash: classes(game_id).troops.read() }
}
fn classes(game_id: u32) -> starknet::storage::StoragePointer<games_storage::release::LogicClasses> {
    let state = crate::state::read();
    let release_id = state.game_releases.read(game_id);
    assert!(release_id != 0, "game has no release");
    state.releases.entry(release_id).classes
}
pub fn emit<T, +starknet::event::Event<T>, +Into<T, crate::logic::combat_domain::CombatLogic::Event>>(event: T) {
    let event: crate::logic::combat_domain::CombatLogic::Event = event.into();
    let mut keys = array![];
    let mut data = array![];
    starknet::event::Event::append_keys_and_data(@event, ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}
