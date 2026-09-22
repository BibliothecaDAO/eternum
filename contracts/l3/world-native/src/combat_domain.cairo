#[starknet::contract]
pub mod CombatDomain {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::combat::{CombatContext, TroopsTrait};
    use crate::combat_actions::battle_side;
    use crate::commands::{Battle, ExecutionContext};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::{distance, spire_neighbor, tile_key};
    use crate::guards::{IGuardsDispatcher, IGuardsDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey};
    use crate::rules::SliceRules;
    use crate::stamina::StaminaTrait;
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure};
    use crate::troops::{
        Coord, ExplorerKey, ExplorerTroops, ICombatTroopsDispatcher, ICombatTroopsDispatcherTrait, ITroopsDispatcher,
        ITroopsDispatcherTrait, Troops,
    };
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        village_raids: starknet::storage::Map<(u32, u32), u64>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        BattleEvent: crate::troops::BattleEvent,
        RaidEvent: crate::combat_actions::RaidEvent,
        OwnershipRow: crate::events::RowSet,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl GuardCombat of crate::guards::IGuardCombat<ContractState> {
        fn battle_guard(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
            let mut attacker = self.troops_dispatcher().authorized_explorer(key, actor, context.timestamp);
            let target_key = ResourceKey { game_id, entity_id: command.defender_id };
            let target = self.structures_dispatcher().structure(target_key).expect('missing guarded structure');
            if crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS) {
                assert!(target.owner == 0.try_into().unwrap(), "target must be unowned");
            }
            assert!(target.owner != actor, "actor owns defender");
            assert!(attacker.troops.count != 0, "aggressor has no troops");
            self.assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, command.defender_id, rules, context.timestamp);
            let destination = crate::structures::structure_coord(target.base);
            let stride: u128 = if destination.alt {
                15
            } else {
                1
            };
            let separation = distance(attacker.coord, destination);
            assert!(
                attacker.coord.alt == destination.alt
                    && separation > 0
                    && separation <= attacker.troops.attack_range().into()
                    * stride,
                "structure is out of range",
            );
            let adjacent = separation == stride;
            let slot = self.combat_troops().next_guard(target_key, target.base.troop_max_guard_count);
            let tick = context.timestamp / rules.tick_config.armies_tick_in_seconds;
            let mut guard: Troops = Default::default();
            let attacker_before = attacker.troops.count;
            let mut defender_before = 0;
            let mut rolls = (0_u8, 0_u8);
            if let Some(slot) = slot {
                guard = self.guards_dispatcher().guard(slot).troops;
                defender_before = guard.count;
                let before = attacker.troops.count;
                let defender = ExplorerTroops { owner: command.defender_id, coord: destination, troops: guard };
                let combat = CombatContext {
                    defender_is_structure_guard: true, ..self.combat_context(game_id, attacker, defender, context),
                };
                rolls = (combat.attacker_roll, combat.defender_roll);
                let (attacker_after, guard_after) = self.resolve_battle(game_id, attacker.troops, guard, combat);
                attacker.troops = attacker_after;
                guard = guard_after;
                self.combat_troops().finish_battle(key, attacker, before);
                let mut row = self.guards_dispatcher().guard(slot);
                if guard.count == 0 {
                    guard.stamina.reset();
                    row.destroyed_tick = tick.try_into().unwrap();
                }
                row.troops = guard;
                self.combat_troops().save_guard(slot, row);
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
                self.combat_troops().save_explorer(key, attacker);
            }
            self.try_capture(attacker, target_key, target, rules, context.timestamp);
            if slot.is_some() {
                let (attacker_roll, defender_roll) = rolls;
                let winner = if attacker.troops.count == 0 && guard.count != 0 {
                    command.defender_id
                } else if guard.count == 0 && attacker.troops.count != 0 {
                    attacker.owner
                } else {
                    0
                };
                self
                    .emit(
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
                self.game_dispatcher().allocate_entity(game_id);
                self.game_dispatcher().allocate_entity(game_id);
            }
        }
    }
    #[abi(embed_v0)]
    impl CombatActions of crate::combat_actions::ICombatActions<ContractState> {
        fn battle(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::AttackExplorer,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            crate::resources::assert_unique_resources(command.steal_resources);
            let attacker_key = ExplorerKey { game_id, explorer_id: command.attacker_id };
            let defender_key = ExplorerKey { game_id, explorer_id: command.defender_id };
            let mut attacker = self.troops_dispatcher().authorized_explorer(attacker_key, actor, context.timestamp);
            let mut defender = self.troops_dispatcher().active_explorer(defender_key, context.timestamp);
            let defender_owner = self.explorer_owner(defender_key, defender);
            assert!(defender_owner != actor, "actor owns defender");
            self.assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
            assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
            self.assert_battle_range(game_id, attacker, defender);
            let attacker_before = attacker.troops.count;
            let defender_before = defender.troops.count;
            let combat = self.combat_context(game_id, attacker, defender, context);
            let (attacker_after, defender_after) = self
                .resolve_battle(game_id, attacker.troops, defender.troops, combat);
            attacker.troops = attacker_after;
            defender.troops = defender_after;
            self.combat_troops().finish_battle(attacker_key, attacker, attacker_before);
            if defender.troops.count == 0 && attacker.troops.count != 0 {
                self
                    .take_loot(
                        game_id,
                        command.defender_id,
                        command.attacker_id,
                        command.steal_resources,
                        false,
                        context.timestamp,
                    );
            }
            self.combat_troops().finish_battle(defender_key, defender, defender_before);
            self
                .emit(
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
            self.game_dispatcher().allocate_entity(game_id);
            self.game_dispatcher().allocate_entity(game_id);
        }
        fn village_last_raided(self: @ContractState, key: ResourceKey) -> u64 {
            self.village_raids.read((key.game_id, key.entity_id))
        }
        fn guard_attack(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::GuardAttack,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let home = self.owned_structure(game_id, command.guard.structure_id, actor);
            assert!(command.guard.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let guard_key = crate::guards::GuardKey {
                game_id, structure_id: command.guard.structure_id, slot: command.guard.slot,
            };
            let mut guard = self.guards_dispatcher().guard(guard_key);
            let defender_key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut defender = self.troops_dispatcher().active_explorer(defender_key, context.timestamp);
            let defender_owner = self.explorer_owner(defender_key, defender);
            assert!(guard.troops.count != 0 && defender.troops.count != 0, "dead combatant");
            let coord = crate::structures::structure_coord(home.base);
            assert_structure_range(coord, defender.coord, guard.troops.attack_range());
            self.assert_battle_immunity(game_id, command.guard.structure_id, rules, context.timestamp);
            self.assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
            let attacker = ExplorerTroops { owner: command.guard.structure_id, coord, troops: guard.troops };
            let combat = CombatContext {
                attacker_is_structure_guard: true, ..self.combat_context(game_id, attacker, defender, context),
            };
            let (attacker_after, defender_after) = self.resolve_battle(game_id, guard.troops, defender.troops, combat);
            let before = defender.troops.count;
            defender.troops = defender_after;
            self.combat_troops().finish_battle(defender_key, defender, before);
            guard.troops = attacker_after;
            if guard.troops.count == 0 {
                guard.troops.stamina.reset();
                guard
                    .destroyed_tick = (context.timestamp / rules.tick_config.armies_tick_in_seconds)
                    .try_into()
                    .unwrap();
            }
            self.combat_troops().save_guard(guard_key, guard);
            self
                .try_capture(
                    defender,
                    ResourceKey { game_id, entity_id: command.guard.structure_id },
                    home,
                    rules,
                    context.timestamp,
                );
            self
                .emit(
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
            self.game_dispatcher().allocate_entity(game_id);
            self.game_dispatcher().allocate_entity(game_id);
        }
        fn raid(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::Raid,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            crate::resources::assert_unique_resources(command.steal_resources);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = self.troops_dispatcher().authorized_explorer(key, actor, context.timestamp);
            let target_key = ResourceKey { game_id, entity_id: command.structure_id };
            let target = self.structures_dispatcher().structure(target_key).expect('missing raid target');
            assert!(target.owner != actor, "actor owns defender");
            assert!(explorer.troops.count != 0, "aggressor has no troops");
            let destination = crate::structures::structure_coord(target.base);
            assert!(crate::geometry::adjacent(explorer.coord, destination), "raid requires adjacency");
            self.assert_battle_immunity(game_id, explorer.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, command.structure_id, rules, context.timestamp);
            let result = self
                .resolve_raid(game_id, explorer, target_key, target.base.troop_max_guard_count, destination, context);
            let troops_before = explorer.troops.count;
            self.apply_raid_losses(key, explorer, target_key, result);
            let success = self.raid_success(game_id, result, context);
            if success && result.explorer.count != 0 {
                self.collect_raid_loot(game_id, command, target, rules, context.timestamp);
            }
            self
                .emit(
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
    }
    #[generate_trait]
    impl CombatActionsInternal of CombatActionsInternalTrait {
        fn apply_raid_losses(
            ref self: ContractState,
            key: ExplorerKey,
            explorer: ExplorerTroops,
            target: ResourceKey,
            result: crate::raid::RaidResolution,
        ) {
            if !result.guarded {
                return;
            }
            self
                .combat_troops()
                .finish_battle(key, ExplorerTroops { troops: result.explorer, ..explorer }, explorer.troops.count);
            for index in 0..result.guards.len() {
                self
                    .combat_troops()
                    .save_guard(
                        crate::guards::GuardKey {
                            game_id: key.game_id,
                            structure_id: target.entity_id,
                            slot: (result.guards.len() - 1 - index).try_into().unwrap(),
                        },
                        *result.guards.at(index),
                    );
            }
        }
        fn explorer_owner(self: @ContractState, key: ExplorerKey, explorer: ExplorerTroops) -> ContractAddress {
            self
                .structures_dispatcher()
                .structure_owner(ResourceKey { game_id: key.game_id, entity_id: explorer.owner })
        }

        fn resolve_raid(
            self: @ContractState,
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
                        self
                            .guards_dispatcher()
                            .guard(crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot }),
                    );
            }
            let biome = self.map_dispatcher().biome(tile_key(game_id, destination)).into();
            self.calculate_raid(game_id, explorer.troops, guards.span(), biome, context.timestamp)
        }
        fn raid_success(
            self: @ContractState, game_id: u32, result: crate::raid::RaidResolution, context: ExecutionContext,
        ) -> bool {
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id, self.game_dispatcher().game(game_id).seed);
            crate::raid::success(result, seed, context.timestamp)
        }
        fn collect_raid_loot(
            ref self: ContractState,
            game_id: u32,
            command: crate::combat_actions::Raid,
            target: Structure,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let village = target.base.category == 5;
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            if village {
                let last = self.village_raids.read((game_id, command.structure_id));
                if last != 0 && tick < last + rules.battle_config.village_raid_immunity_ticks.into() {
                    for resource in command.steal_resources {
                        assert!(
                            crate::resources::is_troop_resource(*resource.resource_type),
                            "village raid resource immunity",
                        );
                    }
                }
            }
            self
                .take_loot(
                    game_id, command.structure_id, command.explorer_id, command.steal_resources, true, timestamp,
                );
            if village {
                self.village_raids.write((game_id, command.structure_id), tick);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'VillageRaid',
                            keys: array![game_id.into(), command.structure_id.into()].span(),
                            values: array![tick.into()].span(),
                        },
                    );
            }
        }
        fn take_loot(
            ref self: ContractState,
            game_id: u32,
            from: u32,
            to: u32,
            resources: Span<crate::resources::ResourceAmount>,
            storable_only: bool,
            timestamp: u64,
        ) {
            let dispatcher = self.resources_dispatcher();
            let from = ResourceKey { game_id, entity_id: from };
            let to = ResourceKey { game_id, entity_id: to };
            for resource in resources {
                let mut amount = *resource.amount;
                if storable_only {
                    let weight = dispatcher.resource_weight(to);
                    let unit = dispatcher.resource_rule(game_id, *resource.resource_type).unit_weight;
                    if unit != 0 && weight.capacity != 0xffffffffffffffffffffffffffffffff {
                        amount =
                            core::cmp::min(
                                amount, (weight.capacity - core::cmp::min(weight.capacity, weight.weight)) / unit,
                            );
                    }
                }
                if amount != 0 {
                    dispatcher.spend_resource(from, *resource.resource_type, amount, timestamp);
                    dispatcher.grant_resource(to, *resource.resource_type, amount, timestamp);
                }
            }
        }
        fn try_capture(
            ref self: ContractState,
            explorer: ExplorerTroops,
            key: ResourceKey,
            target: Structure,
            rules: SliceRules,
            timestamp: u64,
        ) {
            if explorer.troops.count == 0
                || (crate::rules::rule_enabled(rules, crate::rules::UNOWNED_TARGETS)
                    && target.owner != 0.try_into().unwrap())
                || (target.base.category == 5 && !crate::rules::rule_enabled(rules, crate::rules::CAPTURE_VILLAGES)) {
                return;
            }
            if !crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(target.base))
                || self.combat_troops().next_guard(key, target.base.troop_max_guard_count).is_some() {
                return;
            }
            self.combat_troops().reset_guards(key);
            crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
                crate::guards::IStructureCaptureDispatcher {
                    contract_address: self.lifecycle.require_active().structures,
                },
                key,
                explorer.owner,
                timestamp,
            );
        }
    }
    fn assert_structure_range(attacker: Coord, defender: Coord, range: u32) {
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
    fn battle_winner(attacker: ExplorerTroops, defender: ExplorerTroops) -> u32 {
        if attacker.troops.count == 0 && defender.troops.count > 0 {
            return defender.owner;
        }
        if defender.troops.count == 0 && attacker.troops.count > 0 {
            return attacker.owner;
        }
        0
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn authorize(self: @ContractState, game_id: u32, context: ExecutionContext) -> SliceRules {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            self.game_dispatcher().rules(game_id)
        }
        fn game_dispatcher(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().registry }
        }
        fn resources_dispatcher(self: @ContractState) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.lifecycle.require_active().resources }
        }
        fn structures_dispatcher(self: @ContractState) -> IStructuresDispatcher {
            IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
        }
        fn map_dispatcher(self: @ContractState) -> IMapDispatcher {
            IMapDispatcher { contract_address: self.lifecycle.require_active().map }
        }
        fn owned_structure(self: @ContractState, game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
            let home = self
                .structures_dispatcher()
                .structure(ResourceKey { game_id, entity_id })
                .expect('missing home structure');
            assert!(home.owner == actor, "actor does not own structure");
            home
        }
        fn assert_battle_immunity(self: @ContractState, game_id: u32, home_id: u32, rules: SliceRules, timestamp: u64) {
            let game = self.game_dispatcher().game(game_id);
            let home = self.structures_dispatcher().structure(ResourceKey { game_id, entity_id: home_id }).unwrap();
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
        fn adjacent_to_spire(self: @ContractState, game_id: u32, coord: Coord) -> bool {
            for direction in 0_u8..6 {
                let key = tile_key(game_id, spire_neighbor(coord, direction));
                if self.map_dispatcher().tile(key).map(|tile| (tile.data / 2) % 256 == 35).unwrap_or(false) {
                    return true;
                }
            }
            false
        }
        fn assert_battle_range(
            self: @ContractState, game_id: u32, mut attacker: ExplorerTroops, defender: ExplorerTroops,
        ) {
            let within = if attacker.coord.alt != defender.coord.alt {
                attacker.coord.x == defender.coord.x
                    && attacker.coord.y == defender.coord.y
                    && self.adjacent_to_spire(game_id, attacker.coord)
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
        fn combat_context(
            self: @ContractState,
            game_id: u32,
            attacker: ExplorerTroops,
            defender: ExplorerTroops,
            context: ExecutionContext,
        ) -> CombatContext {
            let biome: crate::biome::Biome = self.map_dispatcher().biome(tile_key(game_id, defender.coord)).into();
            let (attacker_roll, defender_roll) = if defender.coord.alt {
                let mut raw_root = context.raw_root;
                let seed = crate::random::game_root(ref raw_root, game_id, self.game_dispatcher().game(game_id).seed);
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
        fn calculate_raid(
            self: @ContractState,
            game_id: u32,
            explorer: Troops,
            guards: Span<crate::guards::Guard>,
            biome: crate::biome::Biome,
            timestamp: u64,
        ) -> crate::raid::RaidResolution {
            let rules = self.game_dispatcher().rules(game_id);
            crate::raid::resolve(explorer, guards, biome, rules, timestamp)
        }
        fn resolve_battle(
            self: @ContractState, game_id: u32, mut attacker: Troops, mut defender: Troops, context: CombatContext,
        ) -> (Troops, Troops) {
            let rules = self.game_dispatcher().rules(game_id);
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
        fn troops_dispatcher(self: @ContractState) -> ITroopsDispatcher {
            ITroopsDispatcher { contract_address: self.lifecycle.require_active().troops }
        }
        fn guards_dispatcher(self: @ContractState) -> IGuardsDispatcher {
            IGuardsDispatcher { contract_address: self.lifecycle.require_active().troops }
        }
        fn combat_troops(self: @ContractState) -> ICombatTroopsDispatcher {
            ICombatTroopsDispatcher { contract_address: self.lifecycle.require_active().troops }
        }
    }
}
