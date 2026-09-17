use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::{ResourceAmount, ResourceKey, ResourceSlot};

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum Stage {
    Foundation,
    Construction,
    Complete,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum ConstructionAccess {
    Public,
    Private,
    GuildOnly,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Hyperstructure {
    pub stage: Stage,
    pub access: ConstructionAccess,
    pub seed: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ConstructionResource {
    pub resource_type: u8,
    pub minimum: u32,
    pub maximum: u32,
    pub points: u64,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct HyperstructureRules {
    pub initialize_shards: u128,
    pub resources: Span<ConstructionResource>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Share {
    pub player: ContractAddress,
    pub bps: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ShareAllocation {
    pub start_at: u64,
    pub multiplier: u8,
    pub shareholders: Span<Share>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Contribution {
    pub hyperstructure_id: u32,
    pub from_structure_id: u32,
    pub resources: Span<ResourceAmount>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AllocateShares {
    pub hyperstructure_id: u32,
    pub shareholders: Span<Share>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetConstructionAccess {
    pub hyperstructure_id: u32,
    pub access: ConstructionAccess,
}

#[starknet::interface]
pub trait IHyperstructures<T> {
    fn configure_hyperstructures(ref self: T, game_id: u32, rules: HyperstructureRules);
    fn hyperstructure_rules(self: @T, game_id: u32) -> HyperstructureRules;
    fn hyperstructure(self: @T, key: ResourceKey) -> Option<Hyperstructure>;
    fn hyperstructure_progress(self: @T, key: ResourceSlot) -> u128;
    fn hyperstructure_requirement(self: @T, key: ResourceSlot) -> u128;
    fn hyperstructure_shares(self: @T, key: ResourceKey) -> ShareAllocation;
    fn hyperstructure_count(self: @T, game_id: u32) -> u32;
    fn completed_hyperstructure_count(self: @T, game_id: u32) -> u32;
    fn settle_completed_hyperstructures(ref self: T, game_id: u32, timestamp: u64);
    fn record_hyperstructure(ref self: T, key: ResourceKey, seed: felt252, completed: bool);
    fn initialize_hyperstructure(ref self: T, game_id: u32, actor: ContractAddress, id: u32, context: ExecutionContext);
    fn contribute_hyperstructure(
        ref self: T, game_id: u32, actor: ContractAddress, contribution: Contribution, context: ExecutionContext,
    );
    fn allocate_hyperstructure_shares(
        ref self: T, game_id: u32, actor: ContractAddress, command: AllocateShares, context: ExecutionContext,
    );
    fn set_construction_access(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetConstructionAccess, context: ExecutionContext,
    );
    fn checkpoint_hyperstructures(
        ref self: T, game_id: u32, actor: ContractAddress, ids: Span<u32>, context: ExecutionContext,
    );
}

pub fn required_amount(seed: felt252, cost: ConstructionResource) -> u128 {
    let extra = if cost.minimum == cost.maximum {
        0
    } else {
        let seed: u256 = seed.into();
        (seed / cost.resource_type.into() % (cost.maximum - cost.minimum).into()).try_into().unwrap()
    };
    Into::<u32, u128>::into(cost.minimum + extra) * crate::rules::RESOURCE_PRECISION
}

#[starknet::component]
pub mod HyperstructureState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::events::{RowMemberSet, RowSet};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::tile_key;
    use crate::guilds::{IGuildsDispatcher, IGuildsDispatcherTrait};
    use crate::lifecycle::Lifecycle::InternalTrait as LifecycleInternalTrait;
    use crate::lifecycle::{Lifecycle, Peers};
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot};
    use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, SettlementMode};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure};
    use super::{
        AllocateShares, ConstructionAccess, ConstructionResource, Contribution, ExecutionContext, Hyperstructure,
        HyperstructureRules, SetConstructionAccess, Share, ShareAllocation, Stage,
    };

    #[storage]
    pub struct Storage {
        pub hyper_states: Map<(u32, u32), Hyperstructure>,
        pub hyper_ids: Map<(u32, u32), u32>,
        pub hyper_counts: Map<u32, u32>,
        pub hyper_exists: Map<(u32, u32), bool>,
        pub hyper_progress: Map<(u32, u32, u8), u128>,
        pub hyper_rule_count: Map<u32, u32>,
        pub hyper_shards: Map<u32, u128>,
        pub hyper_costs: Map<(u32, u32), ConstructionResource>,
        pub hyper_share_count: Map<(u32, u32), u32>,
        pub hyper_share_start: Map<(u32, u32), u64>,
        pub hyper_multiplier: Map<(u32, u32), u8>,
        pub hyper_shares: Map<(u32, u32, u32), Share>,
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
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IHyperstructures<ComponentState<TContractState>> {
        fn configure_hyperstructures(
            ref self: ComponentState<TContractState>, game_id: u32, rules: HyperstructureRules,
        ) {
            get_dep_component!(@self, Life).assert_configurator();
            self.games().game(game_id);
            assert!(self.hyper_rule_count.read(game_id) == 0, "hyperstructure rules already configured");
            assert!(!rules.resources.is_empty(), "empty construction requirements");
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
                self.hyper_costs.write((game_id, index), cost);
            }
            self.hyper_rule_count.write(game_id, rules.resources.len());
            self.hyper_shards.write(game_id, rules.initialize_shards);
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
            if self.hyper_exists.read((key.game_id, key.entity_id)) {
                Some(self.state(key))
            } else {
                None
            }
        }
        fn hyperstructure_progress(self: @ComponentState<TContractState>, key: ResourceSlot) -> u128 {
            self.hyper_progress.read((key.game_id, key.entity_id, key.resource_type))
        }
        fn hyperstructure_requirement(self: @ComponentState<TContractState>, key: ResourceSlot) -> u128 {
            let state = self.state(ResourceKey { game_id: key.game_id, entity_id: key.entity_id });
            super::required_amount(state.seed, self.cost(key.game_id, key.resource_type))
        }
        fn hyperstructure_shares(self: @ComponentState<TContractState>, key: ResourceKey) -> ShareAllocation {
            self.shares(key)
        }
        fn hyperstructure_count(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            self.hyper_counts.read(game_id)
        }
        fn completed_hyperstructure_count(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            let mut count = 0;
            for index in 0..self.hyper_counts.read(game_id) {
                if self.hyper_states.read((game_id, self.hyper_ids.read((game_id, index)))).stage == Stage::Complete {
                    count += 1;
                }
            }
            count
        }
        fn record_hyperstructure(
            ref self: ComponentState<TContractState>, key: ResourceKey, seed: felt252, completed: bool,
        ) {
            assert!(get_caller_address() == self.peers().structures, "only structures domain");
            assert!(!self.hyper_exists.read((key.game_id, key.entity_id)), "hyperstructure already exists");
            self.hyper_exists.write((key.game_id, key.entity_id), true);
            let count = self.hyper_counts.read(key.game_id);
            self.hyper_ids.write((key.game_id, count), key.entity_id);
            self.hyper_counts.write(key.game_id, count + 1);
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
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            let key = ResourceKey { game_id, entity_id: id };
            self.assert_owner(key, actor);
            let mut state = self.state(key);
            assert!(state.stage == Stage::Foundation, "hyperstructure already initialized");
            let rules = self.rules(game_id);
            IResourcesDispatcher { contract_address: self.peers().resources }
                .spend_resource(key, 24, rules.initialize_shards, context.timestamp);
            state.stage = Stage::Construction;
            self.write_state(key, state);
        }
        fn contribute_hyperstructure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            contribution: Contribution,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
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
                points += self.contribute_resource(from, slot, *resource.amount, state.seed, context.timestamp);
            }
            self.games().register_hyperstructure_points(game_id, actor, points);
            if self.is_complete(key, state.seed) {
                state.stage = Stage::Complete;
                self.write_state(key, state);
                self
                    .write_shares(
                        key,
                        ShareAllocation {
                            start_at: context.timestamp,
                            multiplier: self.multiplier(key),
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
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.hyperstructure_id };
            self.assert_owner(key, actor);
            assert!(self.state(key).stage == Stage::Complete, "hyperstructure not complete");
            validate_shares(command.shareholders, self.games().rules(game_id).blitz_mode_on, actor);
            self.checkpoint(key, context.timestamp);
            self
                .write_shares(
                    key,
                    ShareAllocation {
                        start_at: context.timestamp,
                        multiplier: self.multiplier(key),
                        shareholders: command.shareholders,
                    },
                );
        }
        fn set_construction_access(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: SetConstructionAccess,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.hyperstructure_id };
            self.assert_owner(key, actor);
            let mut state = self.state(key);
            assert!(state.stage != Stage::Foundation, "hyperstructure not initialized");
            if command.access == ConstructionAccess::GuildOnly {
                assert!(self.guilds().guild_member(game_id, actor) != 0.try_into().unwrap(), "owner has no guild");
            }
            state.access = command.access;
            self.write_state(key, state);
        }
        fn settle_completed_hyperstructures(ref self: ComponentState<TContractState>, game_id: u32, timestamp: u64) {
            assert!(get_caller_address() == self.peers().season, "only authenticated command domain");
            crate::commands::assert_context_time(timestamp);
            self.games().game(game_id);
            for index in 0..self.hyper_counts.read(game_id) {
                let id = self.hyper_ids.read((game_id, index));
                if self.hyper_states.read((game_id, id)).stage == Stage::Complete {
                    self.checkpoint(ResourceKey { game_id, entity_id: id }, timestamp);
                }
            }
        }
        fn checkpoint_hyperstructures(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            ids: Span<u32>,
            context: ExecutionContext,
        ) {
            assert!(get_caller_address() == self.peers().season, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            self.games().game(game_id);
            for id in ids {
                self.checkpoint(ResourceKey { game_id, entity_id: *id }, context.timestamp);
            }
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn peers(self: @ComponentState<TContractState>) -> Peers {
            get_dep_component!(self, Life).require_active()
        }
        fn guilds(self: @ComponentState<TContractState>) -> IGuildsDispatcher {
            IGuildsDispatcher { contract_address: self.peers().registry }
        }
        fn games(self: @ComponentState<TContractState>) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.peers().season }
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> HyperstructureRules {
            let count = self.hyper_rule_count.read(game_id);
            assert!(count != 0, "hyperstructure rules missing");
            let mut resources = array![];
            for index in 0..count {
                resources.append(self.hyper_costs.read((game_id, index)));
            }
            HyperstructureRules { initialize_shards: self.hyper_shards.read(game_id), resources: resources.span() }
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
            assert!(self.hyper_exists.read((key.game_id, key.entity_id)), "hyperstructure does not exist");
            self.hyper_states.read((key.game_id, key.entity_id))
        }
        fn structure(self: @ComponentState<TContractState>, key: ResourceKey) -> Structure {
            IStructuresDispatcher { contract_address: self.peers().structures }
                .structure(key)
                .expect('structure does not exist')
        }
        fn assert_owner(self: @ComponentState<TContractState>, key: ResourceKey, actor: ContractAddress) {
            assert!(self.structure(key).owner == actor, "actor does not own structure");
        }
        fn assert_command(self: @ComponentState<TContractState>, game_id: u32, timestamp: u64) {
            assert!(get_caller_address() == self.peers().season, "only authenticated command domain");
            crate::commands::assert_context_time(timestamp);
            assert_playing(self.games().game(game_id), timestamp);
        }
        fn assert_access(
            self: @ComponentState<TContractState>, key: ResourceKey, access: ConstructionAccess, actor: ContractAddress,
        ) {
            let owner = self.structure(key).owner;
            match access {
                ConstructionAccess::Public => {},
                ConstructionAccess::Private => assert!(actor == owner, "hyperstructure is private"),
                ConstructionAccess::GuildOnly => {
                    let guild = self.guilds().guild_member(key.game_id, owner);
                    assert!(guild != 0.try_into().unwrap(), "hyperstructure owner has no guild");
                    assert!(self.guilds().guild_member(key.game_id, actor) == guild, "not in same guild");
                },
            }
        }
        fn write_state(ref self: ComponentState<TContractState>, key: ResourceKey, state: Hyperstructure) {
            self.hyper_states.write((key.game_id, key.entity_id), state);
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
        ) -> u128 {
            assert!(amount != 0, "contribution must be positive");
            let cost = self.cost(slot.game_id, slot.resource_type);
            let needed = super::required_amount(seed, cost);
            let current = self.hyper_progress.read((slot.game_id, slot.entity_id, slot.resource_type));
            assert!(current < needed, "resource contribution complete");
            let amount = core::cmp::min(amount, needed - current);
            assert!(amount % crate::rules::RESOURCE_PRECISION == 0, "fractional contribution");
            IResourcesDispatcher { contract_address: self.peers().resources }
                .spend_resource(from, slot.resource_type, amount, timestamp);
            self.hyper_progress.write((slot.game_id, slot.entity_id, slot.resource_type), current + amount);
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
                    .hyper_progress
                    .read((key.game_id, key.entity_id, *cost.resource_type)) != super::required_amount(seed, *cost) {
                    return false;
                }
            }
            true
        }
        fn shares(self: @ComponentState<TContractState>, key: ResourceKey) -> ShareAllocation {
            self.state(key);
            let mut shareholders = array![];
            for index in 0..self.hyper_share_count.read((key.game_id, key.entity_id)) {
                shareholders.append(self.hyper_shares.read((key.game_id, key.entity_id, index)));
            }
            ShareAllocation {
                start_at: self.hyper_share_start.read((key.game_id, key.entity_id)),
                multiplier: self.hyper_multiplier.read((key.game_id, key.entity_id)),
                shareholders: shareholders.span(),
            }
        }
        fn write_shares(ref self: ComponentState<TContractState>, key: ResourceKey, shares: ShareAllocation) {
            self.hyper_share_count.write((key.game_id, key.entity_id), shares.shareholders.len());
            self.hyper_share_start.write((key.game_id, key.entity_id), shares.start_at);
            self.hyper_multiplier.write((key.game_id, key.entity_id), shares.multiplier);
            for index in 0..shares.shareholders.len() {
                self.hyper_shares.write((key.game_id, key.entity_id, index), *shares.shareholders.at(index));
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
        fn checkpoint(ref self: ComponentState<TContractState>, key: ResourceKey, timestamp: u64) {
            assert!(self.state(key).stage == Stage::Complete, "hyperstructure not complete");
            let game = self.games().game(key.game_id);
            let cutoff = if !game.dev_mode_on && timestamp > game.end_at {
                game.end_at
            } else {
                timestamp
            };
            let shares = self.shares(key);
            if cutoff <= shares.start_at {
                return;
            }
            let rate = self.games().rules(key.game_id).victory_points_grant_config.hyp_points_per_second;
            for share in shares.shareholders {
                let points: u256 = Into::<u64, u256>::into(cutoff - shares.start_at)
                    * rate.into()
                    * shares.multiplier.into()
                    * (*share.bps).into()
                    / 10000;
                let points: u128 = points.try_into().unwrap();
                self.register_share_points(key, *share.player, points, timestamp);
            }
            self.hyper_share_start.write((key.game_id, key.entity_id), cutoff);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'HyperstructureShares',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        member: selector!("start_at"),
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
        ) {
            if points == 0 {
                return;
            }
            self.games().register_hyperstructure_points(key.game_id, player, points);
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        id: self.games().allocate_entity(key.game_id),
                        entity_id: Some(key.entity_id),
                        owner: Some(player),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        timestamp,
                        story: crate::ownership::Story::HyperstructurePoints(super::SharePoints { player, points }),
                    },
                );
        }
        fn multiplier(self: @ComponentState<TContractState>, key: ResourceKey) -> u8 {
            if !self.games().rules(key.game_id).blitz_mode_on {
                return 1;
            }
            let rules = ISettlementViewsDispatcher { contract_address: self.peers().settlement }
                .settlement_rules(key.game_id);
            if rules.mode == SettlementMode::Duel {
                return 2;
            }
            let distance = crate::settlement_grid::hyperstructure_scan_distance(rules.reward_profile, rules.mode);
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
                let tile = IMapDispatcher { contract_address: self.peers().map }.tile(tile_key(key.game_id, coord));
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
    fn validate_shares(shares: Span<Share>, blitz: bool, owner: ContractAddress) {
        assert!(!shares.is_empty() && shares.len() <= 20, "invalid shareholder count");
        if blitz {
            assert!(
                shares.len() == 1 && *shares.at(0).player == owner && *shares.at(0).bps == 10000,
                "Blitz shares belong to owner",
            );
        }
        let mut total: u16 = 0;
        for share in shares {
            assert!(*share.player != 0.try_into().unwrap(), "zero shareholder");
            assert!(*share.bps >= 100, "minimum share is one percent");
            total += *share.bps;
        }
        assert!(total == 10000, "shares must total 100 percent");
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SharePoints {
    pub player: ContractAddress,
    pub points: u128,
}
