use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::structures::Structure;

pub fn active_explorer(
    key: ExplorerKey, timestamp: u64, game_context: crate::commands::ExecutionContext,
) -> ExplorerTroops {
    let explorer = crate::logic::troops::explorer(key).expect('missing explorer');
    let rules = game_context.rules.unbox();
    if rules.epoch_seconds != 0 {
        assert!(
            crate::expeditions::is_current(
                explorer.coord,
                game_context.game.unbox().start_main_at,
                rules.epoch_seconds,
                crate::logic::settlement::rules(key.game_id).spacing,
                timestamp,
            ),
            "EXPIRED_ARMY",
        );
    }
    crate::logic::army_slots::resolve(key, explorer, Some(timestamp))
}

pub fn owned_structure(game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
    let home = crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('missing home structure');
    assert!(home.owner == actor, "actor does not own structure");
    home
}

pub fn authorized_explorer(
    key: ExplorerKey, actor: ContractAddress, timestamp: u64, game_context: crate::commands::ExecutionContext,
) -> ExplorerTroops {
    let explorer = active_explorer(key, timestamp, game_context);
    owned_structure(key.game_id, explorer.owner, actor);
    explorer
}
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::troops::{ExplorerKey, ExplorerTroops};

pub fn explorer(key: ExplorerKey) -> Option<ExplorerTroops> {
    let state = crate::state::read();
    if state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read() != 0 {
        let record = state.troops.explorers.read((key.game_id, key.explorer_id));
        Some(
            ExplorerTroops {
                owner: record.owner,
                troops: record.troops,
                coord: crate::logic::map::entity_coord(ResourceKey { game_id: key.game_id, entity_id: key.explorer_id })
                    .expect('missing explorer position'),
            },
        )
    } else {
        None
    }
}

// This bounded reverse index is private; ExplorerTroops.owner is the emitted membership fact.
pub fn home_armies(key: ResourceKey) -> Span<u32> {
    let state = crate::state::read();
    let mut armies = array![];
    for slot in 0..state.troops.home_counts.read((key.game_id, key.entity_id)) {
        armies.append(state.troops.home_armies.read((key.game_id, key.entity_id, slot)));
    }
    armies.span()
}

pub mod TroopState {
    use starknet::Event as EventTrait;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use crate::troops::{ExplorerKey, ExplorerRecord, Troops};

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }

    pub fn create(key: ExplorerKey, explorer: ExplorerRecord) {
        let state = crate::state::write();
        assert!(key.game_id != 0 && key.explorer_id != 0, "reserved explorer key");
        assert!(
            state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read() == 0, "explorer already exists",
        );
        assert!(explorer.owner != 0, "missing explorer owner");
        write_home_membership(key, 0, explorer.owner);
        state.troops.explorers.write((key.game_id, key.explorer_id), explorer);

        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        explorer.serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() }));
    }
    pub fn save(key: ExplorerKey, mut explorer: ExplorerRecord) {
        let state = crate::state::write();
        let previous = state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read();
        assert!(previous != 0, "missing explorer");
        assert!(explorer.owner != 0, "missing explorer owner");
        let prior = state.troops.explorers.read((key.game_id, key.explorer_id));
        if let crate::troops::StaminaSource::Slot(_) = prior.troops.stamina {
            assert!(previous == explorer.owner, "slot army cannot change home");
        }
        explorer.troops = crate::logic::army_slots::persist(key, prior, explorer.troops);
        write_home_membership(key, previous, explorer.owner);
        state.troops.explorers.write((key.game_id, key.explorer_id), explorer);
        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        explorer.serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() }));
    }
    pub fn update_troops(key: ExplorerKey, troops: Troops) {
        let state = crate::state::write();
        assert!(state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read() != 0, "missing explorer");
        let troops = crate::logic::army_slots::persist(
            key, state.troops.explorers.read((key.game_id, key.explorer_id)), troops,
        );
        state.troops.explorers.entry((key.game_id, key.explorer_id)).troops.write(troops);
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
        let previous = state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.read();
        assert!(previous != 0, "missing explorer");
        write_home_membership(key, previous, 0);

        // Owner zero marks absence; recreation overwrites the complete explorer.
        state.troops.explorers.entry((key.game_id, key.explorer_id)).owner.write(0);
        let mut keys = array![];
        key.serialize(ref keys);
        emit(Event::RowDeleted(RowDeleted { version: 1, model: 'ExplorerTroops', keys: keys.span() }));
    }

    fn write_home_membership(key: ExplorerKey, previous: u32, owner: u32) {
        if previous == owner {
            return;
        }
        let state = crate::state::write();
        if previous != 0 {
            let count = state.troops.home_counts.read((key.game_id, previous));
            let mut next = 0_u16;
            for slot in 0..count {
                let id = state.troops.home_armies.read((key.game_id, previous, slot));
                if id != key.explorer_id {
                    state.troops.home_armies.write((key.game_id, previous, next), id);
                    next += 1;
                }
            }
            assert!(next + 1 == count, "missing home army index");
            state.troops.home_armies.write((key.game_id, previous, next), 0);
            state.troops.home_counts.write((key.game_id, previous), next);
        }
        if owner != 0 {
            let home = crate::logic::structures::record(
                crate::resources::ResourceKey { game_id: key.game_id, entity_id: owner },
            );
            let count = state.troops.home_counts.read((key.game_id, owner));
            assert!(
                count < home.base.troop_max_explorer_count.try_into().expect('invalid slot allowance'),
                "explorer limit reached",
            );
            state.troops.home_armies.write((key.game_id, owner, count), key.explorer_id);
            state.troops.home_counts.write((key.game_id, owner), count + 1);
        }
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
    use crate::commands::CreateExplorer;
    use crate::game::assert_playing;
    use crate::geometry::{neighbor, tile_key};
    use crate::logic::release::ReleaseState;
    use crate::logic::troops::TroopState;
    use crate::resources::{IResourceOperationsDispatcherTrait, ResourceKey};
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::stamina::StaminaSourceTrait;
    use crate::structures::{IStructureOperationsDispatcherTrait, Structure};
    use crate::troops::{Coord, ExplorerKey, ExplorerTroops, TroopTier, TroopType, Troops};
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    use super::troop_helpers::TroopHelpersTrait;
    impl Helpers = super::troop_helpers::TroopHelpers<ContractState>;
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
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(game_id, game_context);

            assert_playing(game_context.game.unbox(), timestamp);
            let rules = game_context.rules.unbox();
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            match command.recipient {
                crate::relics::Recipient::Explorer => self
                    .boost_explorer(game_id, actor, command, rule, rules, tick, timestamp, game_context),
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
        fn initialize_structure_guards(
            ref self: ContractState,
            key: ResourceKey,
            seed: u256,
            site_kind: Option<crate::expeditions::SiteKind>,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

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
            let mut rules = game_context.rules.unbox();
            if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
                let depth = crate::logic::expeditions::depth_rules_at(
                    key.game_id, crate::structures::structure_coord(key),
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
            if let Some(kind) = site_kind {
                assert!(rules.epoch_seconds != 0, "site outside expedition");
                crate::logic::expeditions::create_site(key, kind, guards);
            }
        }
        fn add_starting_guard(
            ref self: ContractState,
            key: ResourceKey,
            category: TroopType,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            let home = crate::logic::structures::structure(key).expect('missing guard structure');
            let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot: 0 };
            let mut guard = crate::logic::guards::guard(guard_key);
            let rules = game_context.rules.unbox();
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
    impl Management of crate::troop_management::ITroopManagement<ContractState> {
        fn manage_troops(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::ManageTroops,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let rules = self.authorize(game_id, context);
            match command {
                crate::troop_management::ManageTroops::RecruitGuard(value) => self
                    .recruit_guard(game_id, actor, value, rules, context.timestamp, context),
                crate::troop_management::ManageTroops::RemoveGuard(value) => self
                    .remove_managed_guard(game_id, actor, value),
                crate::troop_management::ManageTroops::RecruitExplorer(value) => self
                    .recruit_explorer(game_id, actor, value, rules, context.timestamp, context),
                crate::troop_management::ManageTroops::RemoveExplorer(id) => self
                    .remove_managed_explorer(game_id, actor, id, context.timestamp, context),
                crate::troop_management::ManageTroops::Transfer(value) => self
                    .transfer_troops(game_id, actor, value, rules, context.timestamp, context),
            }
            let (entity_id, story) = crate::troop_management::management_story(command);
            self.emit_troop_story(game_id, actor, entity_id, story, context.timestamp, ref story_cursor);
            ((), story_cursor)
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
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let key = ExplorerKey { game_id, explorer_id: id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp, game_context);
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
            game_context: crate::commands::ExecutionContext,
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
                    crate::commands::resource_context(game_context),
                );
        }
        fn recruit_guard(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::RecruitGuard,
            rules: SliceRules,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let home = crate::logic::troops::owned_structure(game_id, command.guard.structure_id, actor);
            self
                .pay_troops(
                    game_id,
                    command.guard.structure_id,
                    command.category,
                    command.tier,
                    command.amount,
                    timestamp,
                    game_context,
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
            game_context: crate::commands::ExecutionContext,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp, game_context);
            let home = crate::logic::troops::owned_structure(game_id, explorer.owner, actor);
            assert!(
                crate::geometry::adjacent(
                    explorer.coord,
                    crate::structures::structure_coord(ResourceKey { game_id, entity_id: explorer.owner }),
                ),
                "explorer not adjacent to home",
            );
            self
                .pay_troops(
                    game_id,
                    explorer.owner,
                    explorer.troops.category,
                    explorer.troops.tier,
                    command.amount,
                    timestamp,
                    game_context,
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
                    ResourceKey { game_id, entity_id: command.explorer_id },
                    command.amount,
                    true,
                    crate::commands::resource_context(game_context),
                );
            crate::logic::troops::TroopState::update_troops(key, explorer.troops);
        }
        fn read_managed_army(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            army: crate::troop_management::Army,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> ManagedArmy {
            match army {
                crate::troop_management::Army::Explorer(id) => {
                    let explorer = crate::logic::troops::authorized_explorer(
                        ExplorerKey { game_id, explorer_id: id }, actor, timestamp, game_context,
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
                        coord: crate::structures::structure_coord(
                            ResourceKey { game_id, entity_id: slot.structure_id },
                        ),
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
            game_context: crate::commands::ExecutionContext,
        ) {
            crate::troop_management::assert_amount(command.amount);
            let mut source = self.read_managed_army(game_id, actor, command.source, timestamp, game_context);
            let mut target = self.read_managed_army(game_id, actor, command.target, timestamp, game_context);
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
            self
                .apply_transfer_source(
                    game_id, command.source, source.troops, command.amount, target_is_explorer, game_context,
                );
            match command.target {
                crate::troop_management::Army::Explorer(id) => {
                    target.troops.count += command.amount;
                    crate::troop_management::assert_size(target.troops, target.level, rules);
                    self
                        .resources_dispatcher(game_id)
                        .change_explorer_capacity(
                            ResourceKey { game_id, entity_id: id },
                            command.amount,
                            true,
                            crate::commands::resource_context(game_context),
                        );
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
            game_context: crate::commands::ExecutionContext,
        ) {
            match source {
                crate::troop_management::Army::Explorer(id) => {
                    let key = ResourceKey { game_id, entity_id: id };
                    self
                        .resources_dispatcher(game_id)
                        .change_explorer_capacity(key, amount, false, crate::commands::resource_context(game_context));
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
                guard.troops.stamina.set_amount(0);
            }
            if reset_stamina {
                guard.troops.stamina.revert_initial_amount(rules.troop_stamina_config, tick);
            }
            guard.troops.count += amount;
            crate::troop_management::assert_size(guard.troops, home.base.level, rules);
        }
    }

    #[abi(embed_v0)]
    impl Actions of crate::commands::ICreateExplorer<ContractState> {
        fn create_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateExplorer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let rules = self.authorize(game_id, context);
            let home = crate::logic::troops::owned_structure(game_id, command.structure_id, actor);
            if rules.epoch_seconds != 0 {
                self
                    .expire_home_armies(
                        ResourceKey { game_id, entity_id: command.structure_id }, rules, context.timestamp, context,
                    );
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
                    context.timestamp,
                    crate::commands::action_context(context),
                );
            let origin = if rules.epoch_seconds == 0 {
                crate::structures::structure_coord(ResourceKey { game_id, entity_id: command.structure_id })
            } else {
                crate::expeditions::site(
                    context.game.unbox().start_main_at,
                    rules.epoch_seconds,
                    self.expedition_spacing(game_id),
                    home.metadata.realm_id,
                    context.timestamp,
                    0,
                )
            };
            let coord = neighbor(origin, command.direction);
            if rules.epoch_seconds != 0 {
                self.reveal_expedition_tile(game_id, origin, context);
                self.reveal_expedition_tile(game_id, coord, context);
            }
            assert!(
                command.amount <= crate::troops::max_army_size(rules.troop_limit_config, home.base.level, tier).into()
                    * RESOURCE_PRECISION,
                "army size limit",
            );
            let mut troops = initial_troops(category, tier, command.amount, rules, context.timestamp);
            if rules.epoch_seconds != 0 {
                troops
                    .stamina =
                        crate::logic::army_slots::allocate(
                            ExplorerKey { game_id, explorer_id: id },
                            command.structure_id,
                            crate::expeditions::absolute_epoch(rules.epoch_seconds, context.timestamp),
                            home.base.troop_max_explorer_count.try_into().expect('invalid slot allowance'),
                            troops.stamina.inline(),
                            crate::stamina::StaminaImpl::max(category, TroopTier::T1, rules.troop_stamina_config),
                        );
            }
            crate::logic::map::MapState::occupy(
                tile_key(game_id, coord), id, crate::troops::troop_occupier(troops), false,
            );
            crate::logic::troops::TroopState::create(
                ExplorerKey { game_id, explorer_id: id },
                crate::troops::ExplorerRecord { owner: command.structure_id, troops },
            );
            self
                .resources_dispatcher(game_id)
                .initialize_explorer_resources(
                    ResourceKey { game_id, entity_id: id }, command.amount, crate::commands::resource_context(context),
                );
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
                    ref story_cursor,
                );
            ((), story_cursor)
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
        fn finish_battle(
            ref self: ContractState,
            key: ExplorerKey,
            explorer: ExplorerTroops,
            before: u128,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            self
                .resources_dispatcher(key.game_id)
                .change_explorer_capacity(
                    ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
                    before - explorer.troops.count,
                    false,
                    crate::commands::resource_context(game_context),
                );
            if explorer.troops.count == 0 {
                self.destroy_explorer(key, explorer);
            } else {
                crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(explorer));
            }
        }
    }
}

pub mod troop_helpers {
    use starknet::ContractAddress;
    use starknet::storage::StoragePointerReadAccess;
    use crate::commands::ExecutionContext;
    use crate::game::assert_playing;
    use crate::geometry::tile_key;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait;
    use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::stamina::StaminaSourceTrait;
    use crate::structures::IStructureOperationsLibraryDispatcher;
    use crate::troops::{Coord, ExplorerKey, ExplorerTroops};
    #[generate_trait]
    pub impl TroopHelpers<
        TContractState, impl Release: ReleaseState::HasComponent<TContractState>, +Drop<TContractState>,
    > of TroopHelpersTrait<TContractState> {
        fn expedition_spacing(self: @TContractState, game_id: u32) -> u32 {
            crate::logic::settlement::rules(game_id).spacing
        }

        fn expire_home_armies(
            ref self: TContractState,
            home: ResourceKey,
            rules: SliceRules,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let start = game_context.game.unbox().start_main_at;
            let spacing = self.expedition_spacing(home.game_id);
            for id in crate::logic::troops::home_armies(home) {
                let key = ExplorerKey { game_id: home.game_id, explorer_id: *id };
                let explorer = crate::logic::troops::explorer(key).expect('missing home army');
                if !crate::expeditions::is_current(explorer.coord, start, rules.epoch_seconds, spacing, timestamp) {
                    self.destroy_explorer(key, explorer);
                }
            }
        }
        fn reveal_expedition_tile(
            ref self: TContractState, game_id: u32, coord: Coord, game_context: crate::commands::ExecutionContext,
        ) {
            let key = tile_key(game_id, coord);
            if crate::logic::map::tile(key).is_none() {
                crate::logic::map::MapState::reveal(
                    key, self.map_dispatcher(game_id).biome(key, crate::commands::biome_context(game_context)),
                );
            }
        }

        fn authorize(self: @TContractState, game_id: u32, context: ExecutionContext) -> SliceRules {
            assert_playing(context.game.unbox(), context.timestamp);
            context.rules.unbox()
        }
        fn resources_dispatcher(self: @TContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher {
                class_hash: Release::get_component(self).classes(game_id).resources.read(),
            }
        }
        fn structures_dispatcher(self: @TContractState, game_id: u32) -> IStructureOperationsLibraryDispatcher {
            IStructureOperationsLibraryDispatcher {
                class_hash: Release::get_component(self).classes(game_id).structures.read(),
            }
        }
        fn map_dispatcher(self: @TContractState, game_id: u32) -> IMapLogicLibraryDispatcher {
            IMapLogicLibraryDispatcher { class_hash: Release::get_component(self).classes(game_id).map.read() }
        }

        fn boost_explorer(
            ref self: TContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            rules: SliceRules,
            tick: u64,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.entity_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, timestamp, game_context);
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
                    crate::relics::IRelicMapLibraryDispatcher {
                        class_hash: Release::get_component(@self).classes(game_id).map.read(),
                    },
                    game_id,
                    explorer.coord,
                    rule.uses,
                    crate::commands::biome_context(game_context),
                );
            }
            crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(explorer));
        }
        fn boost_guards(
            ref self: TContractState,
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
            ref self: TContractState,
            game_id: u32,
            ref explorer: ExplorerTroops,
            rules: SliceRules,
            biome: crate::biome::Biome,
            exploring: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            crate::troops::spend_stamina(ref explorer, rules, biome, exploring, timestamp);
            self.pay_food(game_id, explorer, rules, exploring, timestamp, game_context);
        }
        fn pay_food(
            ref self: TContractState,
            game_id: u32,
            explorer: ExplorerTroops,
            rules: SliceRules,
            exploring: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
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
                    crate::commands::resource_context(game_context),
                );
        }

        fn destroy_explorer(ref self: TContractState, key: ExplorerKey, explorer: ExplorerTroops) {
            crate::logic::army_slots::release(key, explorer);
            self
                .resources_dispatcher(key.game_id)
                .destroy_resources(ResourceKey { game_id: key.game_id, entity_id: key.explorer_id });
            crate::logic::map::MapState::vacate(tile_key(key.game_id, explorer.coord), key.explorer_id);
            crate::logic::troops::TroopState::destroy(key);
        }
    }
}
