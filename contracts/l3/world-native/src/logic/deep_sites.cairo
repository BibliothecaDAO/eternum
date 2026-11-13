use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::commands::{Battle, ExecutionContext};
use crate::deep::{DeepRules, DeepSite};
use crate::guards::{Guard, GuardKey};
use crate::resources::ResourceKey;
use crate::troops::{ExplorerKey, ExplorerTroops, IBattleResolutionDispatcherTrait};

pub fn rules(game_id: u32) -> Option<DeepRules> {
    crate::logic::preset_record::for_game(game_id).deep_rules.read()
}

pub fn site(key: ResourceKey) -> Option<DeepSite> {
    crate::state::read().deep.sites.read((key.game_id, key.entity_id))
}

pub fn dispatcher(game_id: u32) -> crate::deep::IDeepSitesLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    assert!(release != 0, "game has no release");
    crate::deep::IDeepSitesLibraryDispatcher { class_hash: state.releases.entry(release).classes.combat.read() }
}

pub fn battle_beast(game_id: u32, actor: starknet::ContractAddress, command: Battle, context: ExecutionContext) {
    crate::logic::combat::authorize(game_id, context);
    let target = ResourceKey { game_id, entity_id: command.defender_id };
    let site = site(target).expect('missing Deep site');
    let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
    crate::logic::deep_guards::assert_field(key);
    let mut attacker = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, context);
    let destination = crate::logic::map::entity_coord(target).expect('missing Deep site position');
    assert!(crate::geometry::adjacent(attacker.coord, destination), "Deep site requires adjacency");
    let day = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, context.timestamp);
    assert!(site.day == day.index, "Deep day not settled");
    let guard_key = GuardKey { game_id, structure_id: target.entity_id, slot: 0 };
    let mut guard = crate::logic::guards::guard(guard_key);
    assert!(guard.troops.count != 0, "Deep beast already defeated");
    let defender = ExplorerTroops { owner: 0, coord: destination, troops: guard.troops };
    let combat = crate::combat::CombatContext {
        defender_is_structure_guard: true, ..crate::logic::combat::combat_context(game_id, attacker, defender, context),
    };
    let attacker_before = attacker.troops.count;
    let defender_before = guard.troops.count;
    let (attacker_after, defender_after) = crate::logic::combat::resolve_battle(
        game_id, attacker.troops, guard.troops, combat, context,
    );
    attacker.troops = attacker_after;
    guard.troops = defender_after;
    if guard.troops.count == 0 {
        guard
            .destroyed_tick = (context.timestamp / context.rules.unbox().tick_config.armies_tick_in_seconds)
            .try_into()
            .unwrap();
    }
    crate::logic::guards::GuardState::save(guard_key, guard);
    crate::logic::combat::combat_troops(game_id)
        .finish_battle(key, attacker, attacker_before, crate::commands::action_context(context));
    if attacker.troops.count != 0 && guard.troops.count == 0 {
        crate::logic::deep_guards::join(key, attacker, target);
    }
    emit_beast_battle(
        game_id,
        actor,
        command,
        attacker,
        ExplorerTroops { troops: guard.troops, ..defender },
        (attacker_before, defender_before),
        combat,
    );
}

fn emit_beast_battle(
    game_id: u32,
    actor: starknet::ContractAddress,
    command: Battle,
    attacker: ExplorerTroops,
    defender: ExplorerTroops,
    before: (u128, u128),
    combat: crate::combat::CombatContext,
) {
    let (attacker_before, defender_before) = before;
    crate::logic::combat::emit(
        crate::troops::BattleEvent {
            version: 2,
            game_id,
            attacker_id: command.attacker_id,
            defender_id: command.defender_id,
            attacker_owner: attacker.owner,
            defender_owner: 0,
            winner_id: if defender.troops.count == 0 && attacker.troops.count != 0 {
                attacker.owner
            } else {
                0
            },
            coord: defender.coord,
            max_reward: array![].span(),
            attacker: crate::combat_actions::battle_side(actor, attacker_before, attacker.troops, combat.attacker_roll),
            defender: crate::combat_actions::battle_side(
                0.try_into().unwrap(), defender_before, defender.troops, combat.defender_roll,
            ),
            timestamp: combat.timestamp,
        },
    );
}

fn initialize(game_id: u32) {
    let Some(rules) = rules(game_id) else {
        return;
    };
    let state = crate::state::write();
    let start = state.games.games.entry(game_id).start_main_at.read();
    let spacing = crate::logic::preset_record::for_game(game_id).settlement_spacing.read();
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        if state.deep.site_ids.read((game_id, kind)) != 0 {
            continue;
        }
        let entity_id: u64 = crate::logic::game::allocate_setup_entity(game_id).into();
        let key = ResourceKey { game_id, entity_id };
        state.deep.site_ids.write((game_id, kind), entity_id);
        crate::logic::map::MapState::occupy(
            crate::geometry::tile_key(game_id, crate::deep::site_coord(rules, kind, spacing)),
            entity_id,
            crate::taxonomy::DEEP_SITE_OCCUPIER,
            false,
        );
        reset_beast(key, kind, 0, rules.beast_count, start);
    }
    crate::logic::deep_ticks::initialize(game_id);
}

pub fn rollover(game_id: u32, context: ExecutionContext) {
    let Some(rules) = rules(game_id) else {
        return;
    };
    let game = context.game.unbox();
    if context.timestamp < game.start_main_at || (game.end_at != 0 && context.timestamp >= game.end_at) {
        return;
    }
    let day = crate::days::day_of(game, context.rules.unbox().day_unit_seconds, context.timestamp);
    let state = crate::state::read();
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let key = ResourceKey { game_id, entity_id: state.deep.site_ids.read((game_id, kind)) };
        let previous = site(key).expect('missing initialized Deep site');
        if previous.day != day.index {
            crate::logic::deep_guards::expire(key, context);
            reset_beast(key, kind, day.index, rules.beast_count, day.start);
        }
    }
}

fn reset_beast(key: ResourceKey, kind: u8, day: u64, count: u128, timestamp: u64) {
    let value = DeepSite { kind, day };
    crate::state::write().deep.sites.write((key.game_id, key.entity_id), Some(value));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    value.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'DeepSite', keys: keys.span(), values: values.span() },
        ),
    );
    crate::logic::guards::GuardState::save(
        GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot: 0 },
        Guard {
            troops: crate::troops::Troops {
                count,
                stamina: crate::troops::Stamina { amount: 0, settled_at: timestamp.try_into().unwrap(), remainder: 0 }
                    .into(),
                ..Default::default(),
            },
            destroyed_tick: 0,
        },
    );
}

#[starknet::component]
pub mod DeepSites {
    #[storage]
    pub struct Storage {}
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}
    #[embeddable_as(DeepSitesImpl)]
    pub impl Sites<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::deep::IDeepSites<ComponentState<TContractState>> {
        fn join_deep_site(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::relics::InteractSite,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            crate::logic::combat::authorize(game_id, context);
            let key = crate::troops::ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, context);
            let occupied = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, command.coord))
                .expect('missing Deep site tile');
            crate::logic::deep_guards::join(
                key, explorer, crate::resources::ResourceKey { game_id, entity_id: occupied.entity_id },
            );
        }
        fn initialize_deep(ref self: ComponentState<TContractState>, game_id: u32) {
            super::initialize(game_id);
        }
        fn settle_deep(
            ref self: ComponentState<TContractState>, game_id: u32, context: crate::commands::ActionContext,
        ) {
            crate::logic::deep_ticks::settle(game_id, crate::commands::execution_context(game_id, context));
        }
    }
    #[embeddable_as(HeightBaneImpl)]
    pub impl HeightBane<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::race::IHeightBane<ComponentState<TContractState>> {
        fn height_blocked(self: @ComponentState<TContractState>, game_id: u32, aspect: u8, timestamp: u64) -> bool {
            crate::logic::deep_banes::height_blocked(game_id, aspect, timestamp)
        }
    }
}
