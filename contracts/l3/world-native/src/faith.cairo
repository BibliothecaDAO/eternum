use starknet::ContractAddress;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct WonderFaith {
    pub last_recorded_owner: ContractAddress,
    pub claimed_points: u128,
    pub claim_per_sec: u32,
    pub claim_last_at: u64,
    pub owner_claim_per_sec: u32,
    pub num_structures_pledged: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FaithfulStructure {
    pub wonder_id: u32,
    pub faithful_since: u64,
    pub fp_to_wonder_owner_per_sec: u16,
    pub fp_to_struct_owner_per_sec: u16,
    pub last_recorded_owner: ContractAddress,
}

#[derive(Copy, Drop, Default, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerFaithPoints {
    pub points_claimed: u128,
    pub points_per_sec_as_owner: u32,
    pub points_per_sec_as_pledger: u32,
    pub last_updated_at: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WonderFaithWinners {
    pub high_score: u128,
    pub wonder_ids: Span<u32>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PlayerFaithKey {
    pub game_id: u32,
    pub player: ContractAddress,
    pub wonder_id: u32,
}

#[starknet::interface]
pub trait IFaithOwnershipViews<T> {
    fn wonder_faith(self: @T, key: crate::resources::ResourceKey) -> WonderFaith;
    fn faithful_structure(self: @T, key: crate::resources::ResourceKey) -> FaithfulStructure;
    fn player_faith_points(self: @T, key: PlayerFaithKey) -> PlayerFaithPoints;
    fn wonder_faith_winners(self: @T, game_id: u32) -> WonderFaithWinners;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FaithRules {
    pub wonder_rate: u16,
    pub realm_rate: u16,
    pub village_rate: u16,
    pub owner_share_bps: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Pledge {
    pub structure_id: u32,
    pub wonder_id: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ClaimPlayer {
    pub player: ContractAddress,
    pub wonder_id: u32,
}
#[starknet::interface]
pub trait IFaith<T> {
    fn configure_faith(ref self: T, game_id: u32, rules: FaithRules);
    fn faith_rules(self: @T, game_id: u32) -> FaithRules;
    fn pledge_faith(
        ref self: T, game_id: u32, actor: ContractAddress, command: Pledge, context: crate::commands::ExecutionContext,
    );
    fn remove_faith(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ExecutionContext,
    );
    fn update_wonder_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, wonder_id: u32, context: crate::commands::ExecutionContext,
    );
    fn update_faithful_ownership(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ExecutionContext,
    );
    fn claim_wonder_points(
        ref self: T, game_id: u32, actor: ContractAddress, wonder_id: u32, context: crate::commands::ExecutionContext,
    );
    fn claim_player_faith_points(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ClaimPlayer,
        context: crate::commands::ExecutionContext,
    );
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PledgeStory {
    pub structure_id: u32,
    pub wonder_id: u32,
    pub owner_rate: u16,
    pub pledger_rate: u16,
}

#[starknet::interface]
pub trait IFaithOwnership<T> {
    fn transfer_faith_ownership(
        ref self: T, key: crate::resources::ResourceKey, owner: ContractAddress, timestamp: u64,
    );
}

#[starknet::component]
pub mod FaithState {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::commands::ExecutionContext;
    use crate::events::{RowDeleted, RowSet};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::lifecycle::Lifecycle::InternalTrait as LifeInternalTrait;
    use crate::resources::ResourceKey;
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, StructureRecord};
    use super::{FaithfulStructure, PlayerFaithPoints, WonderFaith, WonderFaithWinners};

    #[storage]
    pub struct Storage {
        pub faith_wonders: Map<(u32, u32), WonderFaith>,
        pub faith_pledges: Map<(u32, u32), FaithfulStructure>,
        pub faith_players: Map<(u32, ContractAddress, u32), PlayerFaithPoints>,
        pub faith_wonder_count: Map<u32, u32>,
        pub faith_wonder_ids: Map<(u32, u32), u32>,
        pub faith_rules: Map<u32, Option<super::FaithRules>>,
        pub prize_checkpoint: Map<u32, (u32, u128, u32)>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
        StoryEvent: crate::ownership::StoryEvent,
    }
    #[embeddable_as(FaithImpl)]
    pub impl Faith<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IFaith<ComponentState<TContractState>> {
        fn configure_faith(ref self: ComponentState<TContractState>, game_id: u32, rules: super::FaithRules) {
            get_dep_component!(@self, Life).assert_configurator();
            self.games().game(game_id);
            assert!(self.faith_rules.read(game_id).is_none(), "faith rules already configured");
            assert!(rules.owner_share_bps <= 10000, "invalid faith owner share");
            self.faith_rules.write(game_id, Some(rules));
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'FaithRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn faith_rules(self: @ComponentState<TContractState>, game_id: u32) -> super::FaithRules {
            self.faith_rules.read(game_id).expect('missing faith rules')
        }
        fn pledge_faith(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: super::Pledge,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            crate::game::assert_playing(game, context.timestamp);
            assert!(self.games().rules(game_id).faith_enabled, "faith is disabled");
            let structure = self.structure(game_id, command.structure_id);
            assert!(structure.owner == actor, "actor does not own structure");
            self.validate_pledge(game_id, actor, command, structure);
            self.refresh_wonder(game_id, command.wonder_id, context.timestamp, game.end_at);
            let pledge = self.build_pledge(game_id, actor, command.wonder_id, structure, context.timestamp);
            self.add_pledge(game_id, command.structure_id, pledge, context.timestamp, game.end_at);
            self.record_pledge(game_id, actor, command, pledge, context.timestamp);
        }
        fn remove_faith(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            crate::game::assert_playing(game, context.timestamp);
            let pledge = self.faith_pledges.read((game_id, structure_id));
            assert!(pledge.wonder_id != 0, "structure is not faithful");
            self.refresh_wonder(game_id, pledge.wonder_id, context.timestamp, game.end_at);
            let structure = self.structure(game_id, structure_id);
            self.transfer(game_id, structure_id, structure.owner, context.timestamp, game.end_at);
            let mut wonder = self.faith_wonders.read((game_id, pledge.wonder_id));
            assert!(actor == structure.owner || actor == wonder.last_recorded_owner, "only structure or wonder owner");
            if structure_id == pledge.wonder_id {
                assert!(wonder.num_structures_pledged <= 1, "wonder has active pledges");
            }
            let pledge = self.faith_pledges.read((game_id, structure_id));
            self.remove_pledge(game_id, structure_id, pledge, ref wonder, context.timestamp, game.end_at);
            self.record_removal(game_id, structure.owner, structure_id, pledge.wonder_id, context.timestamp);
        }
        fn update_wonder_ownership(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            wonder_id: u32,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            crate::game::assert_playing(game, context.timestamp);
            self.refresh_wonder(game_id, wonder_id, context.timestamp, game.end_at);
        }
        fn update_faithful_ownership(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            crate::game::assert_playing(game, context.timestamp);
            if self.faith_pledges.read((game_id, structure_id)).wonder_id != 0 {
                let structure = self.structure(game_id, structure_id);
                self.transfer(game_id, structure_id, structure.owner, context.timestamp, game.end_at);
            }
        }
        fn claim_wonder_points(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            wonder_id: u32,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            self.require_started(game, context.timestamp);
            self.wonder(game_id, wonder_id);
            let mut wonder = self.faith_wonders.read((game_id, wonder_id));
            self.settle_wonder(game_id, wonder_id, ref wonder, context.timestamp, game.end_at);
            self.write_wonder(game_id, wonder_id, wonder);
        }
        fn claim_player_faith_points(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: super::ClaimPlayer,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            self.require_started(game, context.timestamp);
            assert!(command.player != 0.try_into().unwrap(), "invalid player");
            self.wonder(game_id, command.wonder_id);
            self.update_rates(game_id, command.player, command.wonder_id, true, 0, 0, context.timestamp, game.end_at);
        }
    }
    #[generate_trait]
    pub impl PrizeSettlement<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of PrizeSettlementTrait<TContractState> {
        fn settle_faith_wonders(ref self: ComponentState<TContractState>, game_id: u32, timestamp: u64) -> u32 {
            let game = self.authorize_prizes(game_id, timestamp);
            let (start, mut high_score, mut winners) = self.prize_checkpoint.read(game_id);
            let count = self.faith_wonder_count.read(game_id);
            let end = start + core::cmp::min(8, count - start);
            for index in start..end {
                let id = self.faith_wonder_ids.read((game_id, index));
                let mut wonder = self.faith_wonders.read((game_id, id));
                self.settle_wonder(game_id, id, ref wonder, game.end_at, game.end_at);
                self.write_wonder(game_id, id, wonder);
                if wonder.claimed_points > high_score {
                    high_score = wonder.claimed_points;
                    winners = 1;
                } else if wonder.claimed_points == high_score && high_score != 0 {
                    winners += 1;
                }
            }
            self.prize_checkpoint.write(game_id, (end, high_score, winners));
            count - end
        }
        fn faith_winner_count(self: @ComponentState<TContractState>, game_id: u32, wonder_id: u32) -> u32 {
            let (cursor, high_score, winners) = self.prize_checkpoint.read(game_id);
            assert!(cursor == self.faith_wonder_count.read(game_id), "faith settlement incomplete");
            if high_score != 0 && self.faith_wonders.read((game_id, wonder_id)).claimed_points == high_score {
                winners
            } else {
                0
            }
        }
        fn settle_player_faith(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            player: ContractAddress,
            wonder_id: u32,
            timestamp: u64,
        ) {
            let game = self.authorize_prizes(game_id, timestamp);
            assert!(player != 0.try_into().unwrap(), "invalid player");
            self.wonder(game_id, wonder_id);
            self.update_rates(game_id, player, wonder_id, true, 0, 0, timestamp, game.end_at);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn authorize_prizes(
            self: @ComponentState<TContractState>, game_id: u32, timestamp: u64,
        ) -> crate::game::GameRegistry {
            let game = self.authorize(game_id, timestamp);
            self.require_started(game, timestamp);
            assert!(game.end_at != 0 && timestamp >= game.end_at, "game not ended");
            game
        }
        fn games(self: @ComponentState<TContractState>) -> IGameDispatcher {
            IGameDispatcher { contract_address: get_dep_component!(self, Life).require_active().season }
        }
        #[inline(never)]
        fn authorize(self: @ComponentState<TContractState>, game_id: u32, timestamp: u64) -> crate::game::GameRegistry {
            assert!(
                starknet::get_caller_address() == get_dep_component!(self, Life).require_active().season,
                "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert!(!self.games().rules(game_id).blitz_mode_on, "faith requires Eternum");
            self.games().game(game_id)
        }
        fn require_started(self: @ComponentState<TContractState>, game: crate::game::GameRegistry, timestamp: u64) {
            assert!(
                game.dev_mode_on || (timestamp >= game.start_main_at && timestamp >= game.start_settling_at),
                "game not started",
            );
        }
        fn structure(self: @ComponentState<TContractState>, game_id: u32, id: u32) -> StructureRecord {
            let record = IStructuresDispatcher {
                contract_address: get_dep_component!(self, Life).require_active().structures,
            }
                .structure(ResourceKey { game_id, entity_id: id })
                .expect('missing structure');
            StructureRecord {
                owner: record.owner,
                base: record.base,
                resources_packed: record.resources_packed,
                metadata: record.metadata,
            }
        }
        fn wonder(self: @ComponentState<TContractState>, game_id: u32, id: u32) -> StructureRecord {
            let structure = self.structure(game_id, id);
            assert!(structure.metadata.has_wonder && structure.metadata.realm_id != 0, "invalid wonder");
            structure
        }
        fn build_pledge(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            wonder_id: u32,
            structure: StructureRecord,
            timestamp: u64,
        ) -> FaithfulStructure {
            let rules = self.faith_rules.read(game_id).expect('missing faith rules');
            let rate = if structure.metadata.has_wonder {
                rules.wonder_rate
            } else if structure.base.category == 1 {
                rules.realm_rate
            } else {
                assert!(structure.base.category == 5, "invalid structure category for faith");
                rules.village_rate
            };
            let owner_rate: u16 = (Into::<u16, u128>::into(rate) * rules.owner_share_bps.into() / 10000)
                .try_into()
                .unwrap();
            FaithfulStructure {
                wonder_id,
                faithful_since: timestamp,
                fp_to_wonder_owner_per_sec: owner_rate,
                fp_to_struct_owner_per_sec: rate - owner_rate,
                last_recorded_owner: actor,
            }
        }
        fn validate_pledge(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: super::Pledge,
            structure: StructureRecord,
        ) {
            assert!(
                self.faith_pledges.read((game_id, command.structure_id)).wonder_id == 0,
                "structure is already faithful",
            );
            let wonder = self.wonder(game_id, command.wonder_id);
            assert!(wonder.owner != 0.try_into().unwrap(), "wonder has no owner");
            if command.structure_id != command.wonder_id {
                assert!(
                    self.faith_pledges.read((game_id, command.wonder_id)).wonder_id == command.wonder_id,
                    "wonder must pledge to itself first",
                );
                if structure.metadata.has_wonder {
                    assert!(
                        self.faith_wonders.read((game_id, command.structure_id)).num_structures_pledged == 0,
                        "submitting wonder has active pledges",
                    );
                }
            }
        }
        fn refresh_wonder(ref self: ComponentState<TContractState>, game_id: u32, id: u32, timestamp: u64, end: u64) {
            let structure = self.wonder(game_id, id);
            assert!(structure.owner != 0.try_into().unwrap(), "wonder has no owner");
            let mut wonder = self.faith_wonders.read((game_id, id));
            if wonder.last_recorded_owner == 0.try_into().unwrap() {
                let count = self.faith_wonder_count.read(game_id);
                self.faith_wonder_ids.write((game_id, count), id);
                self.faith_wonder_count.write(game_id, count + 1);
                self.settle_wonder(game_id, id, ref wonder, timestamp, end);
                wonder.last_recorded_owner = structure.owner;
                self.write_wonder(game_id, id, wonder);
            }
            self.transfer(game_id, id, structure.owner, timestamp, end);
        }
        fn add_pledge(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            id: u32,
            pledge: FaithfulStructure,
            timestamp: u64,
            end: u64,
        ) {
            let mut wonder = self.faith_wonders.read((game_id, pledge.wonder_id));
            self.settle_wonder(game_id, pledge.wonder_id, ref wonder, timestamp, end);
            wonder.claim_per_sec += pledge.fp_to_wonder_owner_per_sec.into() + pledge.fp_to_struct_owner_per_sec.into();
            wonder.owner_claim_per_sec += pledge.fp_to_wonder_owner_per_sec.into();
            wonder.num_structures_pledged += 1;
            self.write_wonder(game_id, pledge.wonder_id, wonder);
            self.write_pledge(game_id, id, pledge);
            self
                .update_rates(
                    game_id,
                    pledge.last_recorded_owner,
                    pledge.wonder_id,
                    true,
                    0,
                    pledge.fp_to_struct_owner_per_sec.into(),
                    timestamp,
                    end,
                );
            self
                .update_rates(
                    game_id,
                    wonder.last_recorded_owner,
                    pledge.wonder_id,
                    true,
                    pledge.fp_to_wonder_owner_per_sec.into(),
                    0,
                    timestamp,
                    end,
                );
        }
        fn remove_pledge(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            id: u32,
            pledge: FaithfulStructure,
            ref wonder: WonderFaith,
            timestamp: u64,
            end: u64,
        ) {
            self.settle_wonder(game_id, pledge.wonder_id, ref wonder, timestamp, end);
            wonder.claim_per_sec -= pledge.fp_to_wonder_owner_per_sec.into() + pledge.fp_to_struct_owner_per_sec.into();
            wonder.owner_claim_per_sec -= pledge.fp_to_wonder_owner_per_sec.into();
            wonder.num_structures_pledged -= 1;
            self.write_wonder(game_id, pledge.wonder_id, wonder);
            self
                .write_pledge(
                    game_id,
                    id,
                    FaithfulStructure {
                        wonder_id: 0,
                        faithful_since: 0,
                        fp_to_wonder_owner_per_sec: 0,
                        fp_to_struct_owner_per_sec: 0,
                        last_recorded_owner: 0.try_into().unwrap(),
                    },
                );
            self
                .update_rates(
                    game_id,
                    pledge.last_recorded_owner,
                    pledge.wonder_id,
                    false,
                    0,
                    pledge.fp_to_struct_owner_per_sec.into(),
                    timestamp,
                    end,
                );
            self
                .update_rates(
                    game_id,
                    wonder.last_recorded_owner,
                    pledge.wonder_id,
                    false,
                    pledge.fp_to_wonder_owner_per_sec.into(),
                    0,
                    timestamp,
                    end,
                );
        }
        fn write_pledge(ref self: ComponentState<TContractState>, game_id: u32, id: u32, pledge: FaithfulStructure) {
            self.faith_pledges.write((game_id, id), pledge);
            let keys = array![game_id.into(), id.into()].span();
            if pledge.wonder_id == 0 {
                self.emit(RowDeleted { version: 1, model: 'FaithfulStructure', keys });
            } else {
                let mut values = array![];
                pledge.serialize(ref values);
                self.emit(RowSet { version: 1, model: 'FaithfulStructure', keys, values: values.span() });
            }
        }
        fn record_accrual(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            wonder_id: u32,
            new_points: u128,
            total_points: u128,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        entity_id: Some(wonder_id),
                        owner: None,
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::FaithPointsClaimedStory(
                            crate::ownership::FaithPointsClaimedStory { wonder_id, new_points, total_points },
                        ),
                    },
                );
        }
        fn record_pledge(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            owner: ContractAddress,
            command: super::Pledge,
            pledge: FaithfulStructure,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        entity_id: Some(command.structure_id),
                        owner: Some(owner),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::FaithPledged(
                            super::PledgeStory {
                                structure_id: command.structure_id,
                                wonder_id: command.wonder_id,
                                owner_rate: pledge.fp_to_wonder_owner_per_sec,
                                pledger_rate: pledge.fp_to_struct_owner_per_sec,
                            },
                        ),
                    },
                );
        }
        fn record_removal(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            owner: ContractAddress,
            id: u32,
            wonder: u32,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        entity_id: Some(id),
                        owner: Some(owner),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::FaithRemoved(
                            super::Pledge { structure_id: id, wonder_id: wonder },
                        ),
                    },
                );
        }

        fn transfer(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            structure_id: u32,
            new_owner: ContractAddress,
            now: u64,
            season_end: u64,
        ) {
            let mut wonder = self.faith_wonders.read((game_id, structure_id));
            if wonder.last_recorded_owner != 0.try_into().unwrap() && wonder.last_recorded_owner != new_owner {
                self.settle_wonder(game_id, structure_id, ref wonder, now, season_end);
                self
                    .update_rates(
                        game_id,
                        wonder.last_recorded_owner,
                        structure_id,
                        false,
                        wonder.owner_claim_per_sec,
                        0,
                        now,
                        season_end,
                    );
                self
                    .update_rates(
                        game_id, new_owner, structure_id, true, wonder.owner_claim_per_sec, 0, now, season_end,
                    );
                wonder.last_recorded_owner = new_owner;
                self.write_wonder(game_id, structure_id, wonder);
            }
            let mut pledge = self.faith_pledges.read((game_id, structure_id));
            if pledge.wonder_id != 0 && pledge.last_recorded_owner != new_owner {
                let rate = pledge.fp_to_struct_owner_per_sec.into();
                self
                    .update_rates(
                        game_id, pledge.last_recorded_owner, pledge.wonder_id, false, 0, rate, now, season_end,
                    );
                self.update_rates(game_id, new_owner, pledge.wonder_id, true, 0, rate, now, season_end);
                pledge.last_recorded_owner = new_owner;
                self.write_pledge(game_id, structure_id, pledge);
            }
        }
        fn settle_wonder(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            wonder_id: u32,
            ref wonder: WonderFaith,
            now: u64,
            season_end: u64,
        ) {
            let end_time = if season_end < now {
                season_end
            } else {
                now
            };
            if wonder.claim_last_at == 0 || end_time <= wonder.claim_last_at {
                if wonder.claim_last_at == 0 {
                    wonder.claim_last_at = now;
                }
                return;
            }
            let new_points: u128 = wonder.claim_per_sec.into() * (end_time - wonder.claim_last_at).into();
            wonder.claimed_points += new_points;
            wonder.claim_last_at = end_time;
            self.record_accrual(game_id, wonder_id, new_points, wonder.claimed_points, now);
        }
        fn update_rates(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            player: ContractAddress,
            wonder_id: u32,
            add: bool,
            owner_delta: u32,
            pledger_delta: u32,
            now: u64,
            season_end: u64,
        ) {
            if player == 0.try_into().unwrap() {
                return;
            }
            let end_time = if season_end < now {
                season_end
            } else {
                now
            };
            let mut points = self.faith_players.read((game_id, player, wonder_id));
            let elapsed = if points.last_updated_at > 0 && end_time > points.last_updated_at {
                end_time - points.last_updated_at
            } else {
                0
            };
            let rate = points.points_per_sec_as_owner + points.points_per_sec_as_pledger;
            points.points_claimed += rate.into() * elapsed.into();
            points.last_updated_at = end_time;
            if add {
                points.points_per_sec_as_owner += owner_delta;
                points.points_per_sec_as_pledger += pledger_delta;
            } else {
                points.points_per_sec_as_owner -= owner_delta;
                points.points_per_sec_as_pledger -= pledger_delta;
            }
            self.faith_players.write((game_id, player, wonder_id), points);
            let mut values = array![];
            points.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerFaithPoints',
                        keys: array![game_id.into(), player.into(), wonder_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn write_wonder(ref self: ComponentState<TContractState>, game_id: u32, wonder_id: u32, wonder: WonderFaith) {
            self.faith_wonders.write((game_id, wonder_id), wonder);
            let mut values = array![];
            wonder.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'WonderFaith',
                        keys: array![game_id.into(), wonder_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn winners(self: @ComponentState<TContractState>, game_id: u32) -> WonderFaithWinners {
            let mut high_score = 0_u128;
            let mut ids = array![];
            for index in 0..self.faith_wonder_count.read(game_id) {
                let id = self.faith_wonder_ids.read((game_id, index));
                let score = self.faith_wonders.read((game_id, id)).claimed_points;
                if score > high_score {
                    high_score = score;
                    ids = array![id];
                } else if score == high_score && score != 0 {
                    ids.append(id);
                }
            }
            WonderFaithWinners { high_score, wonder_ids: ids.span() }
        }
    }
}
