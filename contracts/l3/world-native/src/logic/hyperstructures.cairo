use starknet::storage::StorageMapReadAccess;
use crate::hyperstructures::*;

pub fn completed_hyperstructure_count(game_id: u32) -> u32 {
    let mut count = 0;
    for index in 0..crate::state::read().hyperstructures.hyper_counts.read(game_id) {
        if crate::state::read()
            .hyperstructures
            .hyper_states
            .read((game_id, crate::state::read().hyperstructures.hyper_ids.read((game_id, index))))
            .stage == Stage::Complete {
            count += 1;
        }
    }
    count
}
#[starknet::component]
pub mod HyperstructureState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::events::{RowMemberSet, RowSet};
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher, assert_playing};
    use crate::geometry::tile_key;
    use crate::hyperstructures::{
        AllocateShares, ConstructionAccess, ConstructionResource, Contribution, Hyperstructure, HyperstructureRules,
        SetConstructionAccess, Share, ShareAllocation, Stage,
    };
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifecycleInternalTrait;
    use crate::resources::{
        IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey, ResourceSlot,
    };
    use crate::settlement::SettlementMode;
    use crate::structures::Structure;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        StoryEvent: crate::ownership::StoryEvent,
    }

    #[embeddable_as(HyperstructuresImpl)]
    pub impl Hyperstructures<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::hyperstructures::IHyperstructures<ComponentState<TContractState>> {
        fn configure_hyperstructures(
            ref self: ComponentState<TContractState>, game_id: u32, rules: HyperstructureRules,
        ) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            assert!(
                self.data.hyperstructures.hyper_rule_count.read(game_id) == 0,
                "hyperstructure rules already configured",
            );
            assert!(
                !rules.resources.is_empty()
                    || !crate::rules::rule_enabled(
                        crate::logic::game::rules(game_id), crate::rules::DISCOVER_HYPERSTRUCTURES,
                    ),
                "empty construction requirements",
            );
            for index in 0..rules.resources.len() {
                let cost = *rules.resources.at(index);
                assert!(
                    (cost.resource_type >= 1 && cost.resource_type <= 22) || cost.resource_type == 23,
                    "invalid construction resource",
                );
                assert!(cost.minimum != 0 && cost.minimum <= cost.maximum, "invalid construction range");
                for previous in 0..index {
                    assert!(
                        *rules.resources.at(previous).resource_type != cost.resource_type,
                        "duplicate construction resource",
                    );
                }
                self.data.hyperstructures.hyper_costs.write((game_id, index), cost);
            }
            self.data.hyperstructures.hyper_rule_count.write(game_id, rules.resources.len() + 1);
            self.data.hyperstructures.hyper_shards.write(game_id, rules.initialize_shards);
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'HyperstructureRules',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn hyperstructure_rules(self: @ComponentState<TContractState>, game_id: u32) -> HyperstructureRules {
            self.rules(game_id)
        }
        fn hyperstructure(self: @ComponentState<TContractState>, key: ResourceKey) -> Option<Hyperstructure> {
            if self.data.hyperstructures.hyper_exists.read((key.game_id, key.entity_id)) {
                Some(self.state(key))
            } else {
                None
            }
        }
        fn hyperstructure_progress(self: @ComponentState<TContractState>, key: ResourceSlot) -> u128 {
            self.data.hyperstructures.hyper_progress.read((key.game_id, key.entity_id, key.resource_type))
        }
        fn hyperstructure_requirement(self: @ComponentState<TContractState>, key: ResourceSlot) -> u128 {
            let state = self.state(ResourceKey { game_id: key.game_id, entity_id: key.entity_id });
            crate::hyperstructures::required_amount(state.seed, self.cost(key.game_id, key.resource_type))
        }
        fn hyperstructure_shares(self: @ComponentState<TContractState>, key: ResourceKey) -> ShareAllocation {
            self.shares(key)
        }
        fn hyperstructure_count(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            self.data.hyperstructures.hyper_counts.read(game_id)
        }
        fn completed_hyperstructure_count(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            crate::logic::hyperstructures::completed_hyperstructure_count(game_id)
        }
        fn record_hyperstructure(
            ref self: ComponentState<TContractState>, key: ResourceKey, seed: felt252, completed: bool,
        ) {
            assert!(
                !self.data.hyperstructures.hyper_exists.read((key.game_id, key.entity_id)),
                "hyperstructure already exists",
            );
            self.data.hyperstructures.hyper_exists.write((key.game_id, key.entity_id), true);
            let count = self.data.hyperstructures.hyper_counts.read(key.game_id);
            self.data.hyperstructures.hyper_ids.write((key.game_id, count), key.entity_id);
            self.data.hyperstructures.hyper_counts.write(key.game_id, count + 1);
            self
                .write_state(
                    key,
                    Hyperstructure {
                        stage: if completed {
                            Stage::Complete
                        } else {
                            Stage::Foundation
                        },
                        access: ConstructionAccess::Private,
                        seed,
                    },
                );
        }
        fn initialize_hyperstructure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            id: u32,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: id };
            self.assert_owner(key, actor);
            let mut state = self.state(key);
            assert!(state.stage == Stage::Foundation, "hyperstructure already initialized");
            let rules = self.rules(game_id);
            IResourceOperationsLibraryDispatcher { class_hash: self.logic_classes(game_id).resources.read() }
                .spend_resource(
                    key, 24, rules.initialize_shards, context.timestamp, crate::commands::resource_context(context),
                );
            state.stage = Stage::Construction;
            self.write_state(key, state);
        }
        fn contribute_hyperstructure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            contribution: Contribution,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            crate::resources::assert_unique_resources(contribution.resources);
            let key = ResourceKey { game_id, entity_id: contribution.hyperstructure_id };
            let from = ResourceKey { game_id, entity_id: contribution.from_structure_id };
            self.assert_owner(from, actor);
            let mut state = self.state(key);
            assert!(state.stage == Stage::Construction, "hyperstructure is not under construction");
            self.assert_access(key, state.access, actor);
            assert!(!contribution.resources.is_empty(), "no resources contributed");
            let mut points = 0;
            for resource in contribution.resources {
                let slot = ResourceSlot { game_id, entity_id: key.entity_id, resource_type: *resource.resource_type };
                points += self
                    .contribute_resource(from, slot, *resource.amount, state.seed, context.timestamp, context);
            }
            IPointsLibraryDispatcher { class_hash: self.logic_classes(game_id).season.read() }
                .register_hyperstructure_points(game_id, actor, points);
            if self.is_complete(key, state.seed) {
                state.stage = Stage::Complete;
                self.write_state(key, state);
                self
                    .write_shares(
                        key,
                        ShareAllocation {
                            start_at: context.timestamp,
                            multiplier: self.multiplier(key, context),
                            shareholders: array![Share { player: self.structure(key).owner, bps: 10000 }].span(),
                        },
                    );
            }
        }
        fn allocate_hyperstructure_shares(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: AllocateShares,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: command.hyperstructure_id };
            self.assert_owner(key, actor);
            assert!(self.state(key).stage == Stage::Complete, "hyperstructure not complete");
            validate_shares(
                command.shareholders,
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::OWNER_ONLY_SHARES),
                actor,
            );
            self.checkpoint(key, context.timestamp, context);
            self
                .write_shares(
                    key,
                    ShareAllocation {
                        start_at: context.timestamp,
                        multiplier: self.multiplier(key, context),
                        shareholders: command.shareholders,
                    },
                );
        }
        fn set_construction_access(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: SetConstructionAccess,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: command.hyperstructure_id };
            self.assert_owner(key, actor);
            let mut state = self.state(key);
            assert!(state.stage != Stage::Foundation, "hyperstructure not initialized");
            if command.access == ConstructionAccess::GuildOnly {
                assert!(
                    crate::logic::guilds::guild_member(game_id, actor) != 0.try_into().unwrap(), "owner has no guild",
                );
            }
            state.access = command.access;
            self.write_state(key, state);
        }
        fn settle_completed_hyperstructures(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> u32 {
            let game_context = crate::commands::load_context(game_id, game_context);

            let (cutoff, start, count) = self
                .data
                .hyperstructures
                .close_attempt
                .read(game_id)
                .unwrap_or((timestamp, 0, self.data.hyperstructures.hyper_counts.read(game_id)));
            let end = self.checkpoint_batch(game_id, cutoff, start, count, game_context);
            self
                .data
                .hyperstructures
                .close_attempt
                .write(game_id, if end == count {
                    None
                } else {
                    Some((cutoff, end, count))
                });
            count - end
        }
        fn settle_final_hyperstructures(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> u32 {
            let game_context = crate::commands::load_context(game_id, game_context);

            let game = game_context.game.unbox();
            assert!(game.end_at != 0 && timestamp >= game.end_at, "game not ended");
            let count = self.data.hyperstructures.hyper_counts.read(game_id);
            let start = self.data.hyperstructures.final_checkpoint_cursor.read(game_id);
            let end = self.checkpoint_batch(game_id, game.end_at, start, count, game_context);
            self.data.hyperstructures.final_checkpoint_cursor.write(game_id, end);
            count - end
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn checkpoint_batch(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            cutoff: u64,
            start: u32,
            count: u32,
            game_context: crate::commands::ExecutionContext,
        ) -> u32 {
            let end = start + core::cmp::min(8, count - start);
            for index in start..end {
                let id = self.data.hyperstructures.hyper_ids.read((game_id, index));
                if self.data.hyperstructures.hyper_states.read((game_id, id)).stage == Stage::Complete {
                    self.checkpoint(ResourceKey { game_id, entity_id: id }, cutoff, game_context);
                }
            }
            end
        }
        fn logic_classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePointer<LogicClasses> {
            get_dep_component!(self, Life).classes(game_id)
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> HyperstructureRules {
            let count = self.data.hyperstructures.hyper_rule_count.read(game_id);
            assert!(count != 0, "hyperstructure rules missing");
            let mut resources = array![];
            for index in 0..count - 1 {
                resources.append(self.data.hyperstructures.hyper_costs.read((game_id, index)));
            }
            HyperstructureRules {
                initialize_shards: self.data.hyperstructures.hyper_shards.read(game_id), resources: resources.span(),
            }
        }
        fn cost(self: @ComponentState<TContractState>, game_id: u32, resource_type: u8) -> ConstructionResource {
            for cost in self.rules(game_id).resources {
                if *cost.resource_type == resource_type {
                    return *cost;
                }
            }
            panic!("resource is not a construction requirement")
        }
        fn state(self: @ComponentState<TContractState>, key: ResourceKey) -> Hyperstructure {
            assert!(
                self.data.hyperstructures.hyper_exists.read((key.game_id, key.entity_id)),
                "hyperstructure does not exist",
            );
            self.data.hyperstructures.hyper_states.read((key.game_id, key.entity_id))
        }
        fn structure(self: @ComponentState<TContractState>, key: ResourceKey) -> Structure {
            crate::logic::structures::structure(key).expect('structure does not exist')
        }
        fn assert_owner(self: @ComponentState<TContractState>, key: ResourceKey, actor: ContractAddress) {
            assert!(self.structure(key).owner == actor, "actor does not own structure");
        }
        fn assert_command(
            self: @ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            assert_playing(game_context.game.unbox(), timestamp);
        }
        fn assert_access(
            self: @ComponentState<TContractState>, key: ResourceKey, access: ConstructionAccess, actor: ContractAddress,
        ) {
            let owner = self.structure(key).owner;
            match access {
                ConstructionAccess::Public => {},
                ConstructionAccess::Private => assert!(actor == owner, "hyperstructure is private"),
                ConstructionAccess::GuildOnly => {
                    let guild = crate::logic::guilds::guild_member(key.game_id, owner);
                    assert!(guild != 0.try_into().unwrap(), "hyperstructure owner has no guild");
                    assert!(crate::logic::guilds::guild_member(key.game_id, actor) == guild, "not in same guild");
                },
            }
        }
        fn write_state(ref self: ComponentState<TContractState>, key: ResourceKey, state: Hyperstructure) {
            self.data.hyperstructures.hyper_states.write((key.game_id, key.entity_id), state);
            let mut values = array![];
            state.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Hyperstructure',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn contribute_resource(
            ref self: ComponentState<TContractState>,
            from: ResourceKey,
            slot: ResourceSlot,
            amount: u128,
            seed: felt252,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u128 {
            assert!(amount != 0, "contribution must be positive");
            let cost = self.cost(slot.game_id, slot.resource_type);
            let needed = crate::hyperstructures::required_amount(seed, cost);
            let current = self
                .data
                .hyperstructures
                .hyper_progress
                .read((slot.game_id, slot.entity_id, slot.resource_type));
            assert!(current < needed, "resource contribution complete");
            let amount = core::cmp::min(amount, needed - current);
            assert!(amount % crate::rules::RESOURCE_PRECISION == 0, "fractional contribution");
            IResourceOperationsLibraryDispatcher { class_hash: self.logic_classes(slot.game_id).resources.read() }
                .spend_resource(
                    from, slot.resource_type, amount, timestamp, crate::commands::resource_context(game_context),
                );
            self
                .data
                .hyperstructures
                .hyper_progress
                .write((slot.game_id, slot.entity_id, slot.resource_type), current + amount);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'HyperstructureProgress',
                        keys: array![slot.game_id.into(), slot.entity_id.into(), slot.resource_type.into()].span(),
                        values: array![(current + amount).into()].span(),
                    },
                );
            (amount / crate::rules::RESOURCE_PRECISION)
                * Into::<u64, u128>::into(cost.points)
                / (needed / crate::rules::RESOURCE_PRECISION)
        }
        fn is_complete(self: @ComponentState<TContractState>, key: ResourceKey, seed: felt252) -> bool {
            for cost in self.rules(key.game_id).resources {
                if self
                    .data
                    .hyperstructures
                    .hyper_progress
                    .read(
                        (key.game_id, key.entity_id, *cost.resource_type),
                    ) != crate::hyperstructures::required_amount(seed, *cost) {
                    return false;
                }
            }
            true
        }
        fn shares(self: @ComponentState<TContractState>, key: ResourceKey) -> ShareAllocation {
            self.state(key);
            let mut shareholders = array![];
            for index in 0..self.data.hyperstructures.hyper_share_count.read((key.game_id, key.entity_id)) {
                shareholders.append(self.data.hyperstructures.hyper_shares.read((key.game_id, key.entity_id, index)));
            }
            ShareAllocation {
                start_at: self.data.hyperstructures.hyper_share_start.read((key.game_id, key.entity_id)),
                multiplier: self.data.hyperstructures.hyper_multiplier.read((key.game_id, key.entity_id)),
                shareholders: shareholders.span(),
            }
        }
        fn write_shares(ref self: ComponentState<TContractState>, key: ResourceKey, shares: ShareAllocation) {
            self.data.hyperstructures.hyper_share_count.write((key.game_id, key.entity_id), shares.shareholders.len());
            self.data.hyperstructures.hyper_share_start.write((key.game_id, key.entity_id), shares.start_at);
            self.data.hyperstructures.hyper_multiplier.write((key.game_id, key.entity_id), shares.multiplier);
            for index in 0..shares.shareholders.len() {
                self
                    .data
                    .hyperstructures
                    .hyper_shares
                    .write((key.game_id, key.entity_id, index), *shares.shareholders.at(index));
            }
            let mut values = array![];
            shares.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'HyperstructureShares',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn checkpoint(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            assert!(self.state(key).stage == Stage::Complete, "hyperstructure not complete");
            let game = game_context.game.unbox();
            let cutoff = if !game.dev_mode_on && timestamp > game.end_at {
                game.end_at
            } else {
                timestamp
            };
            let shares = self.shares(key);
            if cutoff <= shares.start_at {
                return;
            }
            let rate = game_context.rules.unbox().victory_points_grant_config.hyp_points_per_second;
            for share in shares.shareholders {
                let points: u256 = Into::<u64, u256>::into(cutoff - shares.start_at)
                    * rate.into()
                    * shares.multiplier.into()
                    * (*share.bps).into()
                    / 10000;
                let points: u128 = points.try_into().unwrap();
                self.register_share_points(key, *share.player, points, timestamp, game_context);
            }
            self.data.hyperstructures.hyper_share_start.write((key.game_id, key.entity_id), cutoff);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'HyperstructureShares',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        member: 'start_at',
                        values: array![cutoff.into()].span(),
                    },
                );
        }
        fn register_share_points(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            player: ContractAddress,
            points: u128,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            if points == 0 {
                return;
            }
            IPointsLibraryDispatcher { class_hash: self.logic_classes(key.game_id).season.read() }
                .register_hyperstructure_points(key.game_id, player, points);
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        id: crate::logic::game::allocate_entity(key.game_id),
                        entity_id: Some(key.entity_id),
                        owner: Some(player),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        timestamp,
                        story: crate::ownership::Story::HyperstructurePoints(
                            crate::hyperstructures::SharePoints { player, points },
                        ),
                    },
                );
        }
        fn multiplier(
            self: @ComponentState<TContractState>, key: ResourceKey, game_context: crate::commands::ExecutionContext,
        ) -> u8 {
            if !crate::rules::rule_enabled(game_context.rules.unbox(), crate::rules::HYPERSTRUCTURE_MULTIPLIERS) {
                return 1;
            }
            let rules = crate::logic::settlement::rules(key.game_id);
            if rules.mode == SettlementMode::Duel {
                return 2;
            }
            let distance = crate::settlement_grid::hyperstructure_scan_distance(rules.spacing, rules.mode);
            let origin = crate::structures::structure_coord(self.structure(key).base);
            let mut count = 0;
            for direction in array![(0, 4), (1, 5), (2, 0), (3, 1), (4, 2), (5, 3)] {
                let (first, second) = direction;
                let coord = crate::geometry::checked_neighbor_at_distance(
                    crate::geometry::checked_neighbor_at_distance(origin, first, distance).unwrap(),
                    second,
                    distance / 2,
                )
                    .unwrap();
                let tile = crate::logic::map::tile(tile_key(key.game_id, coord));
                if let Some(tile) = tile {
                    if let Some(id) = crate::map::structure_occupant(tile) {
                        if self.structure(ResourceKey { game_id: key.game_id, entity_id: id }).base.category == 1 {
                            count += 1;
                        }
                    }
                }
            }
            count
        }
    }
    fn validate_shares(shares: Span<Share>, owner_only: bool, owner: ContractAddress) {
        assert!(!shares.is_empty() && shares.len() <= 20, "invalid shareholder count");
        if owner_only {
            assert!(
                shares.len() == 1 && *shares.at(0).player == owner && *shares.at(0).bps == 10000,
                "shares must belong to owner",
            );
        }
        let mut total: u16 = 0;
        let mut seen: core::dict::Felt252Dict<u128> = Default::default();
        for share in shares {
            let player = (*share.player).into();
            assert!(seen.get(player) == 0, "duplicate shareholder");
            seen.insert(player, 1);
            assert!(*share.player != 0.try_into().unwrap(), "zero shareholder");
            assert!(*share.bps >= 100, "minimum share is one percent");
            total += *share.bps;
        }
        assert!(total == 10000, "shares must total 100 percent");
    }
}
