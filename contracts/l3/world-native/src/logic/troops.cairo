use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::structures::Structure;

pub fn active_explorer(key: ExplorerKey, timestamp: u64) -> ExplorerTroops {
    let explorer = crate::logic::troops::explorer(key).expect('missing explorer');
    let rules = crate::logic::game::rules(key.game_id);
    if rules.epoch_seconds != 0 {
        assert!(
            crate::expeditions::is_current(
                explorer.coord,
                crate::logic::game::game(key.game_id).start_main_at,
                rules.epoch_seconds,
                crate::logic::settlement::rules(key.game_id).spacing,
                timestamp,
            ),
            "EXPIRED_ARMY",
        );
    }
    explorer
}

pub fn owned_structure(game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('missing home structure');
    assert!(home.owner == actor, "actor does not own structure");
    home
}

pub fn authorized_explorer(key: ExplorerKey, actor: ContractAddress, timestamp: u64) -> ExplorerTroops {
    let explorer = active_explorer(key, timestamp);
    owned_structure(key.game_id, explorer.owner, actor);
    explorer
}
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::troops::{ExplorerKey, ExplorerTroops};

pub fn explorer(key: ExplorerKey) -> Option<ExplorerTroops> {
    let state = crate::state::read();
    if state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read() != 0 {
        Some(state.troops.explorers.read((key.game_id, key.explorer_id)))
    } else {
        None
    }
}

pub mod TroopState {
    use starknet::Event as EventTrait;
    use starknet::storage::{StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use crate::troops::{ExplorerKey, ExplorerTroops, Troops};

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }

    pub fn create(key: ExplorerKey, explorer: ExplorerTroops) {
        let state = crate::state::write();
        assert!(key.game_id != 0 && key.explorer_id != 0, "reserved explorer key");
        assert!(crate::logic::troops::explorer(key).is_none(), "explorer already exists");
        assert!(explorer.owner != 0, "missing explorer owner");
        state.troops.explorers.write((key.game_id, key.explorer_id), explorer);

        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        explorer.serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() }));
    }
    pub fn save(key: ExplorerKey, explorer: ExplorerTroops) {
        let state = crate::state::write();
        assert!(crate::logic::troops::explorer(key).is_some(), "missing explorer");
        state.troops.explorers.write((key.game_id, key.explorer_id), explorer);
        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        explorer.serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() }));
    }
    pub fn update_troops(key: ExplorerKey, troops: Troops) {
        let state = crate::state::write();
        let mut explorer = crate::logic::troops::explorer(key).expect('missing explorer');
        explorer.troops = troops;
        state.troops.explorers.write((key.game_id, key.explorer_id), explorer);
        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        troops.serialize(ref values);
        emit(
            Event::RowMemberSet(
                RowMemberSet {
                    version: 1, model: 'ExplorerTroops', member: 'troops', keys: keys.span(), values: values.span(),
                },
            ),
        );
    }
    pub fn destroy(key: ExplorerKey) {
        let state = crate::state::write();
        crate::logic::troops::explorer(key).expect('missing explorer');

        // Owner zero marks absence; recreation overwrites the complete explorer.
        state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.write(0);
        let mut keys = array![];
        key.serialize(ref keys);
        emit(Event::RowDeleted(RowDeleted { version: 1, model: 'ExplorerTroops', keys: keys.span() }));
    }

    pub fn emit(event: Event) {
        let mut keys = array![selector!("TroopEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
}

#[starknet::contract]
pub mod TroopsLogic {
    use starknet::ContractAddress;
    use starknet::storage::StoragePointerReadAccess;
    use crate::commands::{CreateExplorer, ExecutionContext, Explore};
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher, assert_playing};
    use crate::geometry::{neighbor, spire_neighbor, tile_key};
    use crate::logic::release::ReleaseState;
    use crate::logic::troops::TroopState;
    use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::stamina::StaminaTrait;
    use crate::structures::{IStructureOperationsDispatcherTrait, IStructureOperationsLibraryDispatcher, Structure};
    use crate::troops::{Coord, ExplorerKey, ExplorerTroops, TroopTier, TroopType, Troops};
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GuardEvent: crate::logic::guards::GuardState::Event,
        ReleaseEvent: ReleaseState::Event,
        TroopEvent: TroopState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        OwnershipRow: crate::events::RowSet,
        OwnershipDeleted: crate::events::RowDeleted,
    }

    #[abi(embed_v0)]
    impl RelicTroops of crate::relics::IRelicTroops<ContractState> {
        fn apply_troop_relic(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            timestamp: u64,
        ) {
            crate::commands::assert_context_time(timestamp);
            assert_playing(crate::logic::game::game(game_id), timestamp);
            let rules = crate::logic::game::rules(game_id);
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            match command.recipient {
                crate::relics::Recipient::Explorer => self
                    .boost_explorer(game_id, actor, command, rule, rules, tick, timestamp),
                crate::relics::Recipient::StructureGuard => self
                    .boost_guards(game_id, actor, command, rule, rules, tick),
                crate::relics::Recipient::StructureProduction => panic!("production relic requires resources domain"),
            }
        }
    }
    #[abi(embed_v0)]
    impl Guards of crate::guards::IGuards<ContractState> {
        fn guard(self: @ContractState, key: crate::guards::GuardKey) -> crate::guards::Guard {
            crate::logic::guards::guard(key)
        }
        fn initialize_structure_guards(ref self: ContractState, key: ResourceKey, seed: u256, timestamp: u64) {
            let base = crate::logic::structures::structure(key).expect('missing guarded structure').base;
            let category = base.category;
            assert!(
                category == 2
                    || category == 3
                    || category == 4
                    || category == crate::camps::CAMP_CATEGORY
                    || category == 8,
                "invalid guarded structure category",
            );
            let mut rules = crate::logic::game::rules(key.game_id);
            if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
                let depth = crate::logic::expeditions::depth_rules_at(
                    key.game_id, crate::structures::structure_coord(base),
                );
                rules.troop_limit_config.mercenaries_troop_lower_bound = depth.guard_lower;
                rules.troop_limit_config.mercenaries_troop_upper_bound = depth.guard_upper;
            }
            let guards = crate::troops::discovery_guards(category, seed, rules, timestamp);
            assert!(base.troop_max_guard_count <= 4, "invalid guard slot limit");
            assert!(guards.len() <= base.troop_max_guard_count.into(), "guards exceed structure limit");
            for slot in 0..guards.len() {
                let troops = *guards.at(slot);
                let slot: u8 = slot.try_into().unwrap();
                let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot };
                assert!(crate::logic::guards::guard(guard_key) == Default::default(), "guards already initialized");
                crate::logic::guards::GuardState::save(guard_key, crate::guards::Guard { troops, destroyed_tick: 0 });
            }
        }
        fn add_starting_guard(
            ref self: ContractState, key: ResourceKey, category: TroopType, amount: u128, timestamp: u64,
        ) {
            let home = crate::logic::structures::structure(key).expect('missing guard structure');
            let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot: 0 };
            let mut guard = crate::logic::guards::guard(guard_key);
            let rules = crate::logic::game::rules(key.game_id);
            self
                .add_guard_troops(
                    guard_key,
                    ref guard,
                    Troops { category, tier: TroopTier::T1, ..Default::default() },
                    amount,
                    home,
                    rules,
                    timestamp,
                    true,
                );
            crate::logic::guards::GuardState::save(guard_key, guard);
        }
    }

    #[abi(embed_v0)]
    impl SettlementDisplacement of crate::settlement::ISettlementDisplacement<ContractState> {
        fn displace_explorer(ref self: ContractState, game_id: u32, explorer_id: u32) {
            let key = ExplorerKey { game_id, explorer_id };
            let mut explorer = crate::logic::troops::explorer(key).expect('missing blocking explorer');
            assert!(explorer.owner != 0, "blocking explorer has no owner");
            let origin = tile_key(game_id, explorer.coord);
            for direction in 0_u8..6 {
                let destination = neighbor(explorer.coord, direction);
                let tile = tile_key(game_id, destination);
                let data = crate::logic::map::tile(tile).map(|tile| tile.data).unwrap_or(0);
                if (data / 2) % 256 != 0 {
                    continue;
                }
                if (data / 0x20000000000) % 256 == 0 {
                    crate::logic::map::MapState::reveal(tile, self.map_dispatcher(game_id).biome(tile));
                }
                let category = crate::troops::explorer_occupier(explorer);
                crate::logic::map::MapState::occupy(tile, explorer_id, category, false);
                explorer.coord = destination;
                crate::logic::troops::TroopState::save(key, explorer);
                crate::logic::map::MapState::vacate(origin, explorer_id);
                return;
            }
            self.destroy_explorer(key, explorer);
        }
    }

    #[abi(embed_v0)]
    impl Management of crate::troop_management::ITroopManagement<ContractState> {
        fn manage_troops(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::ManageTroops,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            match command {
                crate::troop_management::ManageTroops::RecruitGuard(value) => self
                    .recruit_guard(game_id, actor, value, rules, context.timestamp),
                crate::troop_management::ManageTroops::RemoveGuard(value) => self
                    .remove_managed_guard(game_id, actor, value),
                crate::troop_management::ManageTroops::RecruitExplorer(value) => self
                    .recruit_explorer(game_id, actor, value, rules, context.timestamp),
                crate::troop_management::ManageTroops::RemoveExplorer(id) => self
                    .remove_managed_explorer(game_id, actor, id, context.timestamp),
                crate::troop_management::ManageTroops::Transfer(value) => self
                    .transfer_troops(game_id, actor, value, rules, context.timestamp),
            }
            let (entity_id, story) = crate::troop_management::management_story(command);
            self.emit_troop_story(game_id, actor, entity_id, story, context.timestamp);
        }
    }

    #[derive(Copy, Drop)]
    struct ManagedArmy {
        troops: Troops,
        home: u32,
        coord: Coord,
        level: u8,
    }
    #[generate_trait]
    impl ManagementInternal of ManagementInternalTrait {
        fn emit_troop_story(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            entity_id: u32,
            story: crate::ownership::Story,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: crate::logic::game::allocate_entity(game_id),
                        owner: Some(actor),
                        entity_id: Some(entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                        timestamp,
                    },
                );
        }

        fn remove_managed_guard(
            ref self: ContractState, game_id: u32, actor: ContractAddress, slot: crate::troop_management::GuardSlot,
        ) {
            let home = crate::logic::troops::owned_structure(game_id, slot.structure_id, actor);
            assert!(slot.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
            let mut guard = crate::logic::guards::guard(key);
            assert!(guard.troops.count != 0, "guard is empty");
            guard.troops.count = 0;
            guard.troops.stamina.reset();
            crate::logic::guards::GuardState::save(key, guard);
        }
        fn remove_managed_explorer(
            ref self: ContractState, game_id: u32, actor: ContractAddress, id: u32, timestamp: u64,
        ) {
            let key = ExplorerKey { game_id, explorer_id: id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp);
            assert!(explorer.troops.count != 0, "explorer is dead");
            self.destroy_explorer(key, explorer);
        }

        fn pay_troops(
            ref self: ContractState,
            game_id: u32,
            home: u32,
            category: TroopType,
            tier: TroopTier,
            amount: u128,
            timestamp: u64,
        ) {
            crate::troop_management::assert_amount(amount);
            let tier = match tier {
                TroopTier::T1 => 0,
                TroopTier::T2 => 1,
                TroopTier::T3 => 2,
            };
            self
                .resources_dispatcher(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: home },
                    crate::troops::troop_resource(category, tier),
                    amount,
                    timestamp,
                );
        }
        fn recruit_guard(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::RecruitGuard,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let home = crate::logic::troops::owned_structure(game_id, command.guard.structure_id, actor);
            self
                .pay_troops(
                    game_id, command.guard.structure_id, command.category, command.tier, command.amount, timestamp,
                );
            let key = crate::guards::GuardKey {
                game_id, structure_id: command.guard.structure_id, slot: command.guard.slot,
            };
            let mut guard = crate::logic::guards::guard(key);
            let incoming = Troops { category: command.category, tier: command.tier, ..Default::default() };
            self.add_guard_troops(key, ref guard, incoming, command.amount, home, rules, timestamp, true);
            crate::logic::guards::GuardState::save(key, guard);
        }
        fn recruit_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::RecruitExplorer,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp);
            let home = crate::logic::troops::owned_structure(game_id, explorer.owner, actor);
            assert!(
                crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(home.base)),
                "explorer not adjacent to home",
            );
            self
                .pay_troops(
                    game_id, explorer.owner, explorer.troops.category, explorer.troops.tier, command.amount, timestamp,
                );
            explorer.troops.count += command.amount;
            crate::troop_management::refill(ref explorer.troops, rules, timestamp);
            explorer
                .troops
                .stamina
                .revert_initial_amount(
                    rules.troop_stamina_config, timestamp / rules.tick_config.armies_tick_in_seconds,
                );
            crate::troop_management::assert_size(explorer.troops, home.base.level, rules);
            self
                .resources_dispatcher(game_id)
                .change_explorer_capacity(
                    ResourceKey { game_id, entity_id: command.explorer_id }, command.amount, true,
                );
            crate::logic::troops::TroopState::update_troops(key, explorer.troops);
        }
        fn read_managed_army(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            army: crate::troop_management::Army,
            timestamp: u64,
        ) -> ManagedArmy {
            match army {
                crate::troop_management::Army::Explorer(id) => {
                    let explorer = crate::logic::troops::authorized_explorer(
                        ExplorerKey { game_id, explorer_id: id }, actor, timestamp,
                    );
                    let home = crate::logic::troops::owned_structure(game_id, explorer.owner, actor);
                    ManagedArmy {
                        troops: explorer.troops, home: explorer.owner, coord: explorer.coord, level: home.base.level,
                    }
                },
                crate::troop_management::Army::Guard(slot) => {
                    let home = crate::logic::troops::owned_structure(game_id, slot.structure_id, actor);
                    assert!(slot.slot < home.base.troop_max_guard_count, "invalid guard slot");
                    let guard = crate::logic::guards::guard(
                        crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot },
                    );
                    ManagedArmy {
                        troops: guard.troops,
                        home: slot.structure_id,
                        coord: crate::structures::structure_coord(home.base),
                        level: home.base.level,
                    }
                },
            }
        }
        fn transfer_troops(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::TransferTroops,
            rules: SliceRules,
            timestamp: u64,
        ) {
            crate::troop_management::assert_amount(command.amount);
            let mut source = self.read_managed_army(game_id, actor, command.source, timestamp);
            let mut target = self.read_managed_army(game_id, actor, command.target, timestamp);
            assert!(crate::geometry::adjacent(source.coord, target.coord), "armies are not adjacent");
            assert!(command.amount <= source.troops.count, "insufficient source troops");
            let target_is_explorer = match command.target {
                crate::troop_management::Army::Explorer(_) => {
                    assert!(source.home == target.home, "armies must share a home");
                    assert!(target.troops.count != 0, "target explorer is dead");
                    true
                },
                crate::troop_management::Army::Guard(_) => {
                    assert!(
                        match command.source {
                            crate::troop_management::Army::Explorer(_) => true,
                            _ => false,
                        },
                        "guard to guard transfer is unsupported",
                    );
                    false
                },
            };
            if target.troops.count != 0 {
                crate::troop_management::assert_matching(source.troops, target.troops);
            }
            source.troops.count -= command.amount;
            crate::troop_management::merge_timers(ref source.troops, ref target.troops, rules, timestamp);
            self.apply_transfer_source(game_id, command.source, source.troops, command.amount, target_is_explorer);
            match command.target {
                crate::troop_management::Army::Explorer(id) => {
                    target.troops.count += command.amount;
                    crate::troop_management::assert_size(target.troops, target.level, rules);
                    self
                        .resources_dispatcher(game_id)
                        .change_explorer_capacity(ResourceKey { game_id, entity_id: id }, command.amount, true);
                    crate::logic::troops::TroopState::update_troops(
                        ExplorerKey { game_id, explorer_id: id }, target.troops,
                    );
                },
                crate::troop_management::Army::Guard(slot) => {
                    let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
                    let mut guard = crate::guards::Guard { troops: target.troops, ..crate::logic::guards::guard(key) };
                    let home = crate::logic::troops::owned_structure(game_id, slot.structure_id, actor);
                    self.add_guard_troops(key, ref guard, source.troops, command.amount, home, rules, timestamp, false);
                    crate::logic::guards::GuardState::save(key, guard);
                },
            }
        }
        fn apply_transfer_source(
            ref self: ContractState,
            game_id: u32,
            source: crate::troop_management::Army,
            mut troops: Troops,
            amount: u128,
            check_weight: bool,
        ) {
            match source {
                crate::troop_management::Army::Explorer(id) => {
                    let key = ResourceKey { game_id, entity_id: id };
                    self.resources_dispatcher(game_id).change_explorer_capacity(key, amount, false);
                    if check_weight {
                        let weight = crate::logic::resources::weight(key);
                        assert!(weight.weight <= weight.capacity, "source explorer would be overweight");
                    }
                    let explorer_key = ExplorerKey { game_id, explorer_id: id };
                    if troops.count == 0 {
                        self.destroy_explorer(explorer_key, crate::logic::troops::explorer(explorer_key).unwrap());
                    } else {
                        crate::logic::troops::TroopState::update_troops(explorer_key, troops);
                    }
                },
                crate::troop_management::Army::Guard(slot) => {
                    let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
                    if troops.count == 0 {
                        troops.stamina.reset();
                    }
                    crate::logic::guards::GuardState::save(
                        key, crate::guards::Guard { troops, ..crate::logic::guards::guard(key) },
                    );
                },
            }
        }
        fn add_guard_troops(
            self: @ContractState,
            key: crate::guards::GuardKey,
            ref guard: crate::guards::Guard,
            incoming: Troops,
            amount: u128,
            home: Structure,
            rules: SliceRules,
            timestamp: u64,
            reset_stamina: bool,
        ) {
            assert!(key.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let empty = guard.troops.count == 0;
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            if empty {
                if guard.destroyed_tick != 0 {
                    let seconds: u64 = rules.troop_limit_config.guard_resurrection_delay.into();
                    let duration = rules.tick_config.armies_tick_in_seconds;
                    let delay = seconds / duration + if seconds % duration == 0 {
                        0
                    } else {
                        1
                    };
                    assert!(tick >= Into::<u32, u64>::into(guard.destroyed_tick) + delay, "guard resurrection delay");
                }
                guard.troops.category = incoming.category;
                guard.troops.tier = incoming.tier;
            } else {
                crate::troop_management::assert_matching(incoming, guard.troops);
            }
            crate::troop_management::refill(ref guard.troops, rules, timestamp);
            if empty {
                guard.troops.stamina.amount = 0;
            }
            if reset_stamina {
                guard.troops.stamina.revert_initial_amount(rules.troop_stamina_config, tick);
            }
            guard.troops.count += amount;
            crate::troop_management::assert_size(guard.troops, home.base.level, rules);
        }
    }

    #[abi(embed_v0)]
    impl Actions of crate::commands::ITroopCommands<ContractState> {
        fn create_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateExplorer,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let home = crate::logic::troops::owned_structure(game_id, command.structure_id, actor);
            if rules.epoch_seconds != 0 {
                self.expire_home_armies(game_id, home, rules, context.timestamp);
            }
            let category = troop_type(command.category);
            let tier = troop_tier(command.tier);
            let id = crate::logic::game::allocate_entity(game_id);
            let resource_type = crate::troops::troop_resource(category, command.tier);
            self
                .structures_dispatcher(game_id)
                .pay_for_explorer(
                    ResourceKey { game_id, entity_id: command.structure_id },
                    actor,
                    resource_type,
                    command.amount,
                    id,
                    context.timestamp,
                );
            let origin = if rules.epoch_seconds == 0 {
                crate::structures::structure_coord(home.base)
            } else {
                crate::expeditions::site(
                    crate::logic::game::game(game_id).start_main_at,
                    rules.epoch_seconds,
                    self.expedition_spacing(game_id),
                    home.metadata.realm_id,
                    context.timestamp,
                    0,
                )
            };
            let coord = neighbor(origin, command.direction);
            if rules.epoch_seconds != 0 {
                self.reveal_expedition_tile(game_id, origin);
                self.reveal_expedition_tile(game_id, coord);
            }
            assert!(
                command.amount <= crate::troops::max_army_size(rules.troop_limit_config, home.base.level, tier).into()
                    * RESOURCE_PRECISION,
                "army size limit",
            );
            let troops = initial_troops(category, tier, command.amount, rules, context.timestamp);
            crate::logic::map::MapState::occupy(
                tile_key(game_id, coord), id, crate::troops::troop_occupier(troops), false,
            );
            crate::logic::troops::TroopState::create(
                ExplorerKey { game_id, explorer_id: id }, ExplorerTroops { owner: command.structure_id, troops, coord },
            );
            self
                .resources_dispatcher(game_id)
                .initialize_explorer_resources(ResourceKey { game_id, entity_id: id }, command.amount);
            self
                .emit_troop_story(
                    game_id,
                    actor,
                    id,
                    crate::ownership::Story::ExplorerCreateStory(
                        crate::troop_management::ExplorerCreated {
                            explorer_id: id,
                            structure_id: command.structure_id,
                            category,
                            tier,
                            amount: command.amount,
                            spawn_direction: command.direction.try_into().expect('invalid direction'),
                        },
                    ),
                    context.timestamp,
                );
        }
        fn explore(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
            assert!(explorer.troops.count != 0, "explorer is dead");
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            let destination = neighbor(explorer.coord, command.direction);
            if rules.epoch_seconds != 0 {
                crate::expeditions::assert_same_region(explorer.coord, destination, self.expedition_spacing(game_id));
            }
            let tile = tile_key(game_id, destination);
            let data = self.map_dispatcher(game_id).reveal_destination_tile(tile).map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "destination occupied");
            let biome: crate::biome::Biome = self.map_dispatcher(game_id).biome(tile).into();
            let exploring = (data / 0x20000000000) % 0x100 == 0;
            let mut raw_root = context.raw_root;
            let game = crate::logic::game::game(game_id);
            let seed = crate::random::game_root(ref raw_root, game_id, game.seed);
            let mut discovery = crate::discovery::Discovery::None;
            if exploring {
                crate::logic::map::MapState::reveal(tile, biome.into());
                IPointsLibraryDispatcher { class_hash: self.release.classes(game_id).season.read() }
                    .register_exploration(game_id, actor);
                if !destination.alt {
                    crate::relics::IRelicMapDispatcherTrait::discover_relic_chest(
                        crate::relics::IRelicMapLibraryDispatcher {
                            class_hash: self.release.classes(game_id).map.read(),
                        },
                        game_id,
                        destination,
                        explorer.coord,
                        seed,
                        context.timestamp,
                    );
                }
                discovery = self
                    .map_dispatcher(game_id)
                    .discovery(
                        tile,
                        seed,
                        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_count(
                            crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                                class_hash: self.release.classes(game_id).economy.read(),
                            },
                            game_id,
                        ),
                        context.timestamp,
                    );
                if discovery != crate::discovery::Discovery::None {
                    self
                        .structures_dispatcher(game_id)
                        .create_discovery(game_id, destination, discovery, seed, context.timestamp);
                }
            }
            if discovery == crate::discovery::Discovery::None {
                explorer.coord = destination;
            }
            crate::logic::map::MapState::occupy(
                tile_key(game_id, explorer.coord),
                command.explorer_id,
                crate::troops::explorer_occupier(explorer),
                false,
            );
            self.pay_movement(game_id, ref explorer, rules, biome, exploring, context.timestamp);
            crate::logic::troops::TroopState::save(key, explorer);
            crate::logic::game::allocate_entity(game_id);
            if exploring {
                crate::logic::game::allocate_entity(game_id);
            }
            if !explorer.coord.alt {
                crate::exploration_rewards::IExtractionDispatcherTrait::extract_exploration_reward(
                    crate::exploration_rewards::IExtractionLibraryDispatcher {
                        class_hash: self.release.classes(game_id).map.read(),
                    },
                    game_id,
                    actor,
                    command.explorer_id,
                    if exploring {
                        Some(destination)
                    } else {
                        None
                    },
                    ExecutionContext { raw_root, timestamp: context.timestamp },
                );
            }
        }
    }

    #[abi(embed_v0)]
    impl Travel of crate::commands::ITravelCommands<ContractState> {
        fn enter_depth(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::EnterDepth,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            assert!(rules.epoch_seconds != 0, "depth entry requires expeditions");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let home = crate::logic::troops::owned_structure(game_id, explorer.owner, actor);
            assert!(command.depth != 0 && command.depth <= home.metadata.attunement, "depth is not unlocked");
            let spacing = self.expedition_spacing(game_id);
            let spire = crate::expeditions::spire(
                crate::logic::game::game(game_id).start_main_at,
                rules.epoch_seconds,
                spacing,
                home.metadata.realm_id,
                context.timestamp,
            );
            assert!(
                explorer.coord == spire || crate::geometry::adjacent(explorer.coord, spire),
                "army must be at its realm's spire",
            );
            let depth = crate::logic::expeditions::depth_rules(game_id, command.depth);
            explorer
                .troops
                .stamina
                .spend(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    rules.troop_stamina_config,
                    depth.entry_stamina.into(),
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                    true,
                );
            let destination = Coord {
                y: explorer.coord.y + Into::<u8, u32>::into(command.depth) * spacing, ..explorer.coord,
            };
            let location = tile_key(game_id, destination);
            self.reveal_expedition_tile(game_id, destination);
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            crate::logic::map::MapState::occupy(
                location, command.explorer_id, crate::troops::explorer_occupier(explorer), false,
            );
            explorer.coord = destination;
            crate::logic::troops::TroopState::save(key, explorer);
        }
        fn move_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::Move,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            assert!(!command.directions.is_empty(), "empty movement path");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
            assert!(explorer.troops.count != 0, "explorer is dead");
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            for direction in command.directions {
                let destination = neighbor(explorer.coord, *direction);
                if rules.epoch_seconds != 0 {
                    crate::expeditions::assert_same_region(
                        explorer.coord, destination, self.expedition_spacing(game_id),
                    );
                }
                let tile = tile_key(game_id, destination);
                let data = self
                    .map_dispatcher(game_id)
                    .reveal_destination_tile(tile)
                    .expect('undiscovered movement tile')
                    .data;
                assert!(data % 0x20000000000 == 0, "movement tile occupied");
                assert!((data / 0x20000000000) % 256 != 0, "undiscovered movement tile");
                let biome = self.map_dispatcher(game_id).biome(tile).into();
                crate::troops::spend_stamina(ref explorer, rules, biome, false, context.timestamp);
                explorer.coord = destination;
            }
            crate::logic::map::MapState::occupy(
                tile_key(game_id, explorer.coord),
                command.explorer_id,
                crate::troops::explorer_occupier(explorer),
                false,
            );
            self.pay_food(game_id, explorer, rules, false, context.timestamp);
            crate::logic::troops::TroopState::save(key, explorer);
            crate::logic::game::allocate_entity(game_id);
        }
        fn toggle_alternate(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::ToggleAlternate,
            context: ExecutionContext,
        ) {
            self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let spire = crate::logic::map::tile(
                tile_key(game_id, spire_neighbor(explorer.coord, command.spire_direction)),
            )
                .expect('missing spire');
            assert!((spire.data / 2) % 256 == 35, "explorer must be adjacent to spire");
            let destination = Coord { alt: !explorer.coord.alt, ..explorer.coord };
            let destination_key = tile_key(game_id, destination);
            let data = crate::logic::map::tile(destination_key).map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "portal landing occupied");
            self
                .resources_dispatcher(game_id)
                .spend_spire_fee(ResourceKey { game_id, entity_id: explorer.owner }, context.timestamp);
            if (data / 0x20000000000) % 256 == 0 {
                crate::logic::map::MapState::reveal(
                    destination_key, self.map_dispatcher(game_id).biome(destination_key),
                );
            }
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            crate::logic::map::MapState::occupy(
                destination_key, command.explorer_id, crate::troops::explorer_occupier(explorer), false,
            );
            explorer.coord = destination;
            crate::logic::troops::TroopState::save(key, explorer);
            crate::logic::game::allocate_entity(game_id);
        }
    }

    fn troop_type(value: u8) -> TroopType {
        match value {
            0 => TroopType::Knight,
            1 => TroopType::Paladin,
            2 => TroopType::Crossbowman,
            _ => panic!("invalid troop type"),
        }
    }
    fn troop_tier(value: u8) -> TroopTier {
        match value {
            0 => TroopTier::T1,
            1 => TroopTier::T2,
            2 => TroopTier::T3,
            _ => panic!("invalid troop tier"),
        }
    }
    fn initial_troops(category: TroopType, tier: TroopTier, count: u128, rules: SliceRules, timestamp: u64) -> Troops {
        let mut troops = Troops { category, tier, count, ..Default::default() };
        troops
            .stamina
            .refill(
                ref troops.boosts,
                category,
                tier,
                rules.troop_stamina_config,
                timestamp / rules.tick_config.armies_tick_in_seconds,
            );
        troops
    }
    #[abi(embed_v0)]
    impl BattleResolution of crate::troops::IBattleResolution<ContractState> {
        fn finish_battle(ref self: ContractState, key: ExplorerKey, explorer: ExplorerTroops, before: u128) {
            self
                .resources_dispatcher(key.game_id)
                .change_explorer_capacity(
                    ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
                    before - explorer.troops.count,
                    false,
                );
            if explorer.troops.count == 0 {
                self.destroy_explorer(key, explorer);
            } else {
                crate::logic::troops::TroopState::save(key, explorer);
            }
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn expedition_spacing(self: @ContractState, game_id: u32) -> u32 {
            crate::logic::settlement::rules(game_id).spacing
        }

        fn expire_home_armies(
            ref self: ContractState, game_id: u32, home: Structure, rules: SliceRules, timestamp: u64,
        ) {
            let start = crate::logic::game::game(game_id).start_main_at;
            let spacing = self.expedition_spacing(game_id);
            for id in home.troop_explorers {
                let key = ExplorerKey { game_id, explorer_id: *id };
                let explorer = crate::logic::troops::explorer(key).expect('missing home army');
                if !crate::expeditions::is_current(explorer.coord, start, rules.epoch_seconds, spacing, timestamp) {
                    self.destroy_explorer(key, explorer);
                }
            }
        }
        fn reveal_expedition_tile(ref self: ContractState, game_id: u32, coord: Coord) {
            let key = tile_key(game_id, coord);
            if crate::logic::map::tile(key).is_none() {
                crate::logic::map::MapState::reveal(key, self.map_dispatcher(game_id).biome(key));
            }
        }

        fn authorize(self: @ContractState, game_id: u32, context: ExecutionContext) -> SliceRules {
            crate::commands::assert_context_time(context.timestamp);
            assert_playing(crate::logic::game::game(game_id), context.timestamp);
            crate::logic::game::rules(game_id)
        }
        fn resources_dispatcher(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
        }
        fn structures_dispatcher(self: @ContractState, game_id: u32) -> IStructureOperationsLibraryDispatcher {
            IStructureOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).structures.read() }
        }
        fn map_dispatcher(self: @ContractState, game_id: u32) -> IMapLogicLibraryDispatcher {
            IMapLogicLibraryDispatcher { class_hash: self.release.classes(game_id).map.read() }
        }

        fn boost_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            rules: SliceRules,
            tick: u64,
            timestamp: u64,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.entity_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp);
            assert!(!explorer.coord.alt, "relic explorer must be on surface");
            explorer
                .troops
                .stamina
                .refill(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    rules.troop_stamina_config,
                    tick,
                );
            crate::relics::boost_explorer(ref explorer.troops.boosts, command.relic_id, rule, tick.try_into().unwrap());
            if command.relic_id == 45 || command.relic_id == 46 {
                crate::relics::IRelicMapDispatcherTrait::reveal_relic_ring(
                    crate::relics::IRelicMapLibraryDispatcher { class_hash: self.release.classes(game_id).map.read() },
                    game_id,
                    explorer.coord,
                    rule.uses,
                );
            }
            crate::logic::troops::TroopState::save(key, explorer);
        }
        fn boost_guards(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            rules: SliceRules,
            tick: u64,
        ) {
            crate::logic::troops::owned_structure(game_id, command.entity_id, actor);
            assert!(command.relic_id == 49 || command.relic_id == 50, "invalid guard relic");
            for slot in 0_u8..4 {
                let key = crate::guards::GuardKey { game_id, structure_id: command.entity_id, slot };
                let mut guard = crate::logic::guards::guard(key);
                guard
                    .troops
                    .stamina
                    .refill(
                        ref guard.troops.boosts,
                        guard.troops.category,
                        guard.troops.tier,
                        rules.troop_stamina_config,
                        tick,
                    );
                guard.troops.boosts.decr_damage_gotten_percent_num = rule.rate_bps;
                guard.troops.boosts.decr_damage_gotten_end_tick = TryInto::<u64, u32>::try_into(tick).unwrap()
                    + rule.duration;
                crate::logic::guards::GuardState::save(key, guard);
            }
        }
        fn pay_movement(
            ref self: ContractState,
            game_id: u32,
            ref explorer: ExplorerTroops,
            rules: SliceRules,
            biome: crate::biome::Biome,
            exploring: bool,
            timestamp: u64,
        ) {
            crate::troops::spend_stamina(ref explorer, rules, biome, exploring, timestamp);
            self.pay_food(game_id, explorer, rules, exploring, timestamp);
        }
        fn pay_food(
            ref self: ContractState,
            game_id: u32,
            explorer: ExplorerTroops,
            rules: SliceRules,
            exploring: bool,
            timestamp: u64,
        ) {
            let stamina = rules.troop_stamina_config;
            let (wheat, fish) = if exploring {
                (stamina.stamina_explore_wheat_cost, stamina.stamina_explore_fish_cost)
            } else {
                (stamina.stamina_travel_wheat_cost, stamina.stamina_travel_fish_cost)
            };
            let units = explorer.troops.count / RESOURCE_PRECISION;
            self
                .resources_dispatcher(game_id)
                .spend_food(
                    ResourceKey { game_id, entity_id: explorer.owner },
                    wheat.into() * units,
                    fish.into() * units,
                    timestamp,
                );
        }

        fn destroy_explorer(ref self: ContractState, key: ExplorerKey, explorer: ExplorerTroops) {
            crate::logic::structures::remove_explorer(
                ResourceKey { game_id: key.game_id, entity_id: explorer.owner }, key.explorer_id,
            );
            crate::logic::map::MapState::vacate(tile_key(key.game_id, explorer.coord), key.explorer_id);
            crate::logic::troops::TroopState::destroy(key);
        }
    }
}
