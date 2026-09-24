use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::combat::{CombatContext, TroopsTrait};
use crate::combat_actions::battle_side;
use crate::commands::{Battle, ExecutionContext};
use crate::game::assert_playing;
use crate::geometry::{distance, spire_neighbor, tile_key};
use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
use crate::rules::SliceRules;
use crate::stamina::StaminaTrait;
use crate::structures::Structure;
use crate::troops::{
    Coord, ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher, Troops,
};

pub fn battle_guard(game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext) {
    let rules = authorize(game_id, context);
    let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    let mut attacker = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
    let target_key = ResourceKey { game_id, entity_id: command.defender_id };
    let target = crate::logic::structures::structure(target_key).expect('missing guarded structure');
    if crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS) {
        assert!(target.owner == 0.try_into().unwrap(), "target must be unowned");
    }
    assert!(target.owner != actor, "actor owns defender");
    assert!(attacker.troops.count != 0, "aggressor has no troops");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
    assert_battle_immunity(game_id, command.defender_id, rules, context.timestamp);
    let destination = crate::structures::structure_coord(target.base);
    let stride: u128 = if destination.alt {
        15
    } else {
        1
    };
    let separation = distance(attacker.coord, destination);
    assert!(
        attacker.coord.alt == destination.alt && separation > 0 && separation <= attacker.troops.attack_range().into()
            * stride,
        "structure is out of range",
    );
    let adjacent = separation == stride;
    let slot = crate::logic::guards::GuardState::next(target_key, target.base.troop_max_guard_count);
    let tick = context.timestamp / rules.tick_config.armies_tick_in_seconds;
    let mut guard: Troops = Default::default();
    let attacker_before = attacker.troops.count;
    let mut defender_before = 0;
    let mut rolls = (0_u8, 0_u8);
    if let Some(slot) = slot {
        guard = crate::logic::guards::guard(slot).troops;
        defender_before = guard.count;
        let before = attacker.troops.count;
        let defender = ExplorerTroops { owner: command.defender_id, coord: destination, troops: guard };
        let combat = CombatContext {
            defender_is_structure_guard: true, ..combat_context(game_id, attacker, defender, context),
        };
        rolls = (combat.attacker_roll, combat.defender_roll);
        let (attacker_after, guard_after) = resolve_battle(game_id, attacker.troops, guard, combat);
        attacker.troops = attacker_after;
        guard = guard_after;
        combat_troops(game_id).finish_battle(key, attacker, before);
        let mut row = crate::logic::guards::guard(slot);
        if guard.count == 0 {
            guard.stamina.reset();
            row.destroyed_tick = tick.try_into().unwrap();
        }
        row.troops = guard;
        crate::logic::guards::GuardState::save(slot, row);
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
                tick,
                true,
            );
        crate::logic::troops::TroopState::save(key, attacker);
    }
    try_capture(key, attacker, target_key, target, rules, context);
    if slot.is_some() {
        let (attacker_roll, defender_roll) = rolls;
        let winner = if attacker.troops.count == 0 && guard.count != 0 {
            command.defender_id
        } else if guard.count == 0 && attacker.troops.count != 0 {
            attacker.owner
        } else {
            0
        };
        emit(
            crate::troops::BattleEvent {
                version: 1,
                game_id,
                attacker_id: command.attacker_id,
                defender_id: command.defender_id,
                attacker_owner: attacker.owner,
                defender_owner: 0,
                winner_id: winner,
                coord: destination,
                max_reward: array![].span(),
                attacker: battle_side(actor, attacker_before, attacker.troops, attacker_roll),
                defender: battle_side(target.owner, defender_before, guard, defender_roll),
                timestamp: context.timestamp,
            },
        );
        crate::logic::game::allocate_entity(game_id);
        crate::logic::game::allocate_entity(game_id);
    }
}

pub fn battle(
    game_id: u32, actor: ContractAddress, command: crate::combat_actions::AttackExplorer, context: ExecutionContext,
) {
    let rules = authorize(game_id, context);
    crate::resources::assert_unique_resources(command.steal_resources);
    let attacker_key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    let defender_key = ExplorerKey { game_id, explorer_id: command.defender_id };
    let mut attacker = crate::logic::troops::authorized_explorer(attacker_key, actor, context.timestamp);
    let mut defender = crate::logic::troops::active_explorer(defender_key, context.timestamp);
    let defender_owner = explorer_owner(defender_key, defender);
    assert!(defender_owner != actor, "actor owns defender");
    assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
    assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
    assert_battle_range(game_id, attacker, defender);
    let attacker_before = attacker.troops.count;
    let defender_before = defender.troops.count;
    let combat = combat_context(game_id, attacker, defender, context);
    let (attacker_after, defender_after) = resolve_battle(game_id, attacker.troops, defender.troops, combat);
    attacker.troops = attacker_after;
    defender.troops = defender_after;
    combat_troops(game_id).finish_battle(attacker_key, attacker, attacker_before);
    if defender.troops.count == 0 && attacker.troops.count != 0 {
        take_loot(game_id, command.defender_id, command.attacker_id, command.steal_resources, false, context.timestamp);
    }
    combat_troops(game_id).finish_battle(defender_key, defender, defender_before);
    emit(
        crate::troops::BattleEvent {
            version: 1,
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
    crate::logic::game::allocate_entity(game_id);
    crate::logic::game::allocate_entity(game_id);
}

pub fn village_last_raided(key: ResourceKey) -> u64 {
    crate::state::write().combat_domain.village_raids.read((key.game_id, key.entity_id))
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
    let mut defender = crate::logic::troops::active_explorer(defender_key, context.timestamp);
    let defender_owner = explorer_owner(defender_key, defender);
    assert!(guard.troops.count != 0 && defender.troops.count != 0, "dead combatant");
    let coord = crate::structures::structure_coord(home.base);
    assert_structure_range(coord, defender.coord, guard.troops.attack_range());
    assert_battle_immunity(game_id, command.guard.structure_id, rules, context.timestamp);
    assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
    let attacker = ExplorerTroops { owner: command.guard.structure_id, coord, troops: guard.troops };
    let combat = CombatContext {
        attacker_is_structure_guard: true, ..combat_context(game_id, attacker, defender, context),
    };
    let (attacker_after, defender_after) = resolve_battle(game_id, guard.troops, defender.troops, combat);
    let before = defender.troops.count;
    defender.troops = defender_after;
    combat_troops(game_id).finish_battle(defender_key, defender, before);
    guard.troops = attacker_after;
    if guard.troops.count == 0 {
        guard.troops.stamina.reset();
        guard.destroyed_tick = (context.timestamp / rules.tick_config.armies_tick_in_seconds).try_into().unwrap();
    }
    crate::logic::guards::GuardState::save(guard_key, guard);
    try_capture(
        defender_key, defender, ResourceKey { game_id, entity_id: command.guard.structure_id }, home, rules, context,
    );
    emit(
        crate::troops::BattleEvent {
            version: 1,
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
    crate::logic::game::allocate_entity(game_id);
    crate::logic::game::allocate_entity(game_id);
}

pub fn raid(game_id: u32, actor: ContractAddress, command: crate::combat_actions::Raid, context: ExecutionContext) {
    let rules = authorize(game_id, context);
    crate::resources::assert_unique_resources(command.steal_resources);
    let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
    let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
    let target_key = ResourceKey { game_id, entity_id: command.structure_id };
    let target = crate::logic::structures::structure(target_key).expect('missing raid target');
    assert!(target.owner != actor, "actor owns defender");
    assert!(explorer.troops.count != 0, "aggressor has no troops");
    let destination = crate::structures::structure_coord(target.base);
    assert!(crate::geometry::adjacent(explorer.coord, destination), "raid requires adjacency");
    assert_battle_immunity(game_id, explorer.owner, rules, context.timestamp);
    assert_battle_immunity(game_id, command.structure_id, rules, context.timestamp);
    let result = resolve_raid(game_id, explorer, target_key, target.base.troop_max_guard_count, destination, context);
    let troops_before = explorer.troops.count;
    apply_raid_losses(key, explorer, target_key, result);
    let success = raid_success(game_id, result, context);
    if success && result.explorer.count != 0 {
        collect_raid_loot(game_id, command, target, rules, context.timestamp);
    }
    emit(
        crate::combat_actions::RaidEvent {
            version: 1,
            game_id,
            explorer_id: command.explorer_id,
            structure_id: command.structure_id,
            success,
            player: actor,
            target_owner: target.owner,
            troops_before,
            troops_after: result.explorer.count,
            requested_loot: command.steal_resources,
            timestamp: context.timestamp,
        },
    );
}

pub fn apply_raid_losses(
    key: ExplorerKey, explorer: ExplorerTroops, target: ResourceKey, result: crate::raid::RaidResolution,
) {
    if !result.guarded {
        return;
    }
    combat_troops(key.game_id)
        .finish_battle(key, ExplorerTroops { troops: result.explorer, ..explorer }, explorer.troops.count);
    for index in 0..result.guards.len() {
        crate::logic::guards::GuardState::save(
            crate::guards::GuardKey {
                game_id: key.game_id,
                structure_id: target.entity_id,
                slot: (result.guards.len() - 1 - index).try_into().unwrap(),
            },
            *result.guards.at(index),
        );
    }
}

pub fn explorer_owner(key: ExplorerKey, explorer: ExplorerTroops) -> ContractAddress {
    crate::logic::structures::owner(ResourceKey { game_id: key.game_id, entity_id: explorer.owner })
}

pub fn resolve_raid(
    game_id: u32,
    explorer: ExplorerTroops,
    target: ResourceKey,
    maximum: u8,
    destination: Coord,
    context: ExecutionContext,
) -> crate::raid::RaidResolution {
    let mut guards = array![];
    // Resolve outer guards first, preserving damage and cooldown evaluation order.
    assert!(maximum <= 4, "invalid guard slot limit");
    let mut slot = maximum;
    while slot != 0 {
        slot -= 1;
        guards
            .append(
                crate::logic::guards::guard(crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot }),
            );
    }
    let biome = map_dispatcher(game_id).biome(tile_key(game_id, destination)).into();
    calculate_raid(game_id, explorer.troops, guards.span(), biome, context.timestamp)
}

pub fn raid_success(game_id: u32, result: crate::raid::RaidResolution, context: ExecutionContext) -> bool {
    let mut raw_root = context.raw_root;
    let seed = crate::random::game_root(ref raw_root, game_id, crate::logic::game::game(game_id).seed);
    crate::raid::success(result, seed, context.timestamp)
}

pub fn collect_raid_loot(
    game_id: u32, command: crate::combat_actions::Raid, target: Structure, rules: SliceRules, timestamp: u64,
) {
    let village = target.base.category == 5;
    let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
    if village {
        let last = crate::state::write().combat_domain.village_raids.read((game_id, command.structure_id));
        if last != 0 && tick < last + rules.battle_config.village_raid_immunity_ticks.into() {
            for resource in command.steal_resources {
                assert!(crate::resources::is_troop_resource(*resource.resource_type), "village raid resource immunity");
            }
        }
    }
    take_loot(game_id, command.structure_id, command.explorer_id, command.steal_resources, true, timestamp);
    if village {
        crate::state::write().combat_domain.village_raids.write((game_id, command.structure_id), tick);
        emit(
            crate::events::RowSet {
                version: 1,
                model: 'VillageRaid',
                keys: array![game_id.into(), command.structure_id.into()].span(),
                values: array![tick.into()].span(),
            },
        );
    }
}

pub fn take_loot(
    game_id: u32,
    from: u32,
    to: u32,
    resources: Span<crate::resources::ResourceAmount>,
    storable_only: bool,
    timestamp: u64,
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
            dispatcher.spend_resource(from, *resource.resource_type, amount, timestamp);
            dispatcher.grant_resource(to, *resource.resource_type, amount, timestamp);
        }
    }
}

pub fn try_capture(
    explorer_key: ExplorerKey,
    explorer: ExplorerTroops,
    key: ResourceKey,
    target: Structure,
    rules: SliceRules,
    context: ExecutionContext,
) {
    if explorer.troops.count == 0
        || (crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS) && target.owner != 0.try_into().unwrap())
        || (target.base.category == 5 && !crate::rules::rule_enabled(rules, crate::rules::CAPTURE_VILLAGES)) {
        return;
    }
    if !crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(target.base))
        || crate::logic::guards::GuardState::next(key, target.base.troop_max_guard_count).is_some() {
        return;
    }
    crate::logic::guards::GuardState::reset(key);
    crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
        crate::guards::IStructureCaptureLibraryDispatcher { class_hash: classes(key.game_id).structures.read() },
        key,
        explorer.owner,
        context.timestamp,
    );
    if target.owner == 0.try_into().unwrap() {
        grant_capture_rewards(explorer_key, explorer, key, target, rules, context);
    }
}

pub fn grant_capture_rewards(
    explorer_key: ExplorerKey,
    mut explorer: ExplorerTroops,
    key: ResourceKey,
    target: Structure,
    rules: SliceRules,
    context: ExecutionContext,
) {
    let refund = rules.troop_stamina_config.capture_stamina_refund;
    if refund != 0 {
        explorer
            .troops
            .stamina
            .add(
                ref explorer.troops.boosts,
                explorer.troops.category,
                explorer.troops.tier,
                rules.troop_stamina_config,
                refund.into(),
                context.timestamp / rules.tick_config.armies_tick_in_seconds,
            );
        crate::logic::troops::TroopState::save(explorer_key, explorer);
    }
    let camp = target.base.category == crate::camps::CAMP_CATEGORY;
    let home_rewards = camp && crate::rules::rule_enabled(rules, crate::rules::HOME_CAMP_REWARDS);
    let chests = crate::rules::rule_enabled(rules, crate::rules::CAPTURE_CHESTS);
    if !home_rewards && !chests {
        return;
    }
    let classes = classes(key.game_id);
    let coord = crate::structures::structure_coord(target.base);
    let depth = if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
        Some(crate::logic::expeditions::depth_rules_at(key.game_id, coord))
    } else {
        None
    };
    let home = ResourceKey { game_id: key.game_id, entity_id: explorer.owner };
    if home_rewards {
        for reward in crate::camps::ICampRulesDispatcherTrait::camp_resources(
            crate::camps::ICampRulesLibraryDispatcher { class_hash: classes.structures.read() }, key.game_id,
        ) {
            resources_dispatcher(key.game_id)
                .grant_resource(home, *reward.resource_type, *reward.amount, context.timestamp);
        }
    }
    let mine_chest = target.base.category == 4 && depth.map(|value| value.mine_chest).unwrap_or(false);
    if chests && (camp || mine_chest) {
        let actor = crate::logic::structures::structure(home).expect('missing home structure').owner;
        crate::relics::IRelicsDispatcherTrait::grant_site_chest(
            crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics.read() },
            key.game_id,
            actor,
            crate::relics::OpenChest { explorer_id: explorer_key.explorer_id, coord },
            context,
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

pub fn battle_winner(attacker: ExplorerTroops, defender: ExplorerTroops) -> u32 {
    if attacker.troops.count == 0 && defender.troops.count > 0 {
        return defender.owner;
    }
    if defender.troops.count == 0 && attacker.troops.count > 0 {
        return attacker.owner;
    }
    0
}

pub fn authorize(game_id: u32, context: ExecutionContext) -> SliceRules {
    crate::commands::assert_context_time(context.timestamp);
    assert_playing(crate::logic::game::game(game_id), context.timestamp);
    crate::logic::game::rules(game_id)
}

pub fn resources_dispatcher(game_id: u32) -> IResourceOperationsLibraryDispatcher {
    IResourceOperationsLibraryDispatcher { class_hash: classes(game_id).resources.read() }
}

pub fn map_dispatcher(game_id: u32) -> IMapLogicLibraryDispatcher {
    IMapLogicLibraryDispatcher { class_hash: classes(game_id).map.read() }
}

pub fn owned_structure(game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('missing home structure');
    assert!(home.owner == actor, "actor does not own structure");
    home
}

pub fn assert_battle_immunity(game_id: u32, home_id: u32, rules: SliceRules, timestamp: u64) {
    let game = crate::logic::game::game(game_id);
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id: home_id }).unwrap();
    let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
    assert!(
        tick >= game.start_main_at / rules.tick_config.armies_tick_in_seconds
            + rules.battle_config.regular_immunity_ticks.into(),
        "season immunity",
    );
    if home.base.category == 5 {
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
        if crate::logic::map::tile(key).map(|tile| (tile.data / 2) % 256 == 35).unwrap_or(false) {
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
    let biome: crate::biome::Biome = map_dispatcher(game_id).biome(tile_key(game_id, defender.coord)).into();
    let (attacker_roll, defender_roll) = if defender.coord.alt
        || crate::rules::rule_enabled(crate::logic::game::rules(game_id), crate::rules::COMBAT_DICE) {
        let mut raw_root = context.raw_root;
        let seed = crate::random::game_root(ref raw_root, game_id, crate::logic::game::game(game_id).seed);
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
        attacker_roll,
        defender_roll,
        attacker_biome: biome,
        defender_biome: biome,
        attack_distance,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    }
}

pub fn calculate_raid(
    game_id: u32, explorer: Troops, guards: Span<crate::guards::Guard>, biome: crate::biome::Biome, timestamp: u64,
) -> crate::raid::RaidResolution {
    let rules = crate::logic::game::rules(game_id);
    crate::raid::resolve(explorer, guards, biome, rules, timestamp)
}

pub fn resolve_battle(
    game_id: u32, mut attacker: Troops, mut defender: Troops, context: CombatContext,
) -> (Troops, Troops) {
    let rules = crate::logic::game::rules(game_id);
    attacker
        .attack_with_context(
            ref defender,
            context,
            rules.troop_stamina_config,
            rules.troop_damage_config,
            context.timestamp / rules.tick_config.armies_tick_in_seconds,
            rules.tick_config.armies_tick_in_seconds,
        );
    (attacker, defender)
}

pub fn combat_troops(game_id: u32) -> IBattleResolutionLibraryDispatcher {
    IBattleResolutionLibraryDispatcher { class_hash: classes(game_id).troops.read() }
}
fn classes(game_id: u32) -> starknet::storage::StoragePath<games_storage::release::LogicClasses> {
    let state = crate::state::read();
    let release_id = state.game_releases.read(game_id);
    assert!(release_id != 0, "game has no release");
    state.releases.entry(release_id)
}
fn emit<T, +starknet::event::Event<T>, +Into<T, crate::logic::combat_domain::CombatLogic::Event>>(event: T) {
    let event: crate::logic::combat_domain::CombatLogic::Event = event.into();
    let mut keys = array![];
    let mut data = array![];
    starknet::event::Event::append_keys_and_data(@event, ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}
