use starknet::ContractAddress;
use crate::commands::ExecutionContext;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerResult {
    pub player: ContractAddress,
    pub points: u128,
    pub rank: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BlitzResult {
    pub players: Span<PlayerResult>,
    pub complete: bool,
    pub commitment: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecordBlitzResults {
    pub start: u8,
    pub players: Span<PlayerResult>,
}

#[starknet::interface]
pub trait IBlitzResults<T> {
    fn blitz_result(self: @T, game_id: u32) -> BlitzResult;
    fn record_blitz_results(
        ref self: T, game_id: u32, actor: ContractAddress, command: RecordBlitzResults, context: ExecutionContext,
    ) -> u64;
}

#[starknet::component]
pub mod BlitzResultState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::lifecycle::Lifecycle::{DomainImpl, InternalTrait as LifeInternal};
    use crate::ownership::{Story, StoryEvent};
    use crate::registrar::{IRegistrarDispatcher, IRegistrarDispatcherTrait, RosterPlayer};
    use super::{BlitzResult, PlayerResult, RecordBlitzResults};

    // One immutable result per roster position; count is the resumable batch cursor.
    #[storage]
    pub struct Storage {
        pub results: Map<(u32, u8), PlayerResult>,
        pub count: Map<u32, u8>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }
    #[embeddable_as(BlitzResultsImpl)]
    pub impl Commands<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IBlitzResults<ComponentState<TContractState>> {
        fn blitz_result(self: @ComponentState<TContractState>, game_id: u32) -> BlitzResult {
            let roster = self.roster(game_id);
            let mut players = array![];
            for index in 0..self.count.read(game_id) {
                players.append(self.results.read((game_id, index)));
            }
            let complete = !roster.is_empty() && players.len() == roster.len();
            let commitment = if complete {
                super::result_commitment(game_id, players.span())
            } else {
                0
            };
            BlitzResult { players: players.span(), complete, commitment }
        }
        fn record_blitz_results(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: RecordBlitzResults,
            context: ExecutionContext,
        ) -> u64 {
            self.authorize(game_id, actor, context.timestamp);
            let roster = self.roster(game_id);
            let count = self.count.read(game_id);
            let end = Into::<u8, u32>::into(command.start) + command.players.len();
            assert!(!command.players.is_empty() && command.players.len() <= 8, "invalid result batch size");
            assert!(end <= roster.len(), "too many result players");
            if command.start < count {
                self.assert_recorded_batch(game_id, command, count);
                return (roster.len() - Into::<u8, u32>::into(count)).into();
            }
            assert!(command.start == count, "result batch out of order");
            let mut points = array![];
            for player in roster {
                points.append(self.games().player_points(game_id, *player.account));
            }
            for offset in 0..command.players.len() {
                let index: u8 = (Into::<u8, u32>::into(count) + offset).try_into().unwrap();
                let result = *command.players.at(offset);
                self.validate_player(game_id, roster, points.span(), index, result);
                self.results.write((game_id, index), result);
            }
            self.count.write(game_id, end.try_into().unwrap());
            self.emit_result(game_id, actor, context.timestamp);
            (roster.len() - end).into()
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn games(self: @ComponentState<TContractState>) -> IGameDispatcher {
            IGameDispatcher { contract_address: get_dep_component!(self, Life).require_active().season }
        }
        fn roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            IRegistrarDispatcher { contract_address: get_dep_component!(self, Life).require_active().registry }
                .blitz_roster(game_id)
        }
        fn authorize(self: @ComponentState<TContractState>, game_id: u32, actor: ContractAddress, timestamp: u64) {
            let lifecycle = get_dep_component!(self, Life);
            assert!(get_caller_address() == lifecycle.require_active().season, "only authenticated command domain");
            assert!(actor == lifecycle.domain_state().authority, "only domain authority");
            crate::commands::assert_context_time(timestamp);
            let games = self.games();
            assert!(crate::rules::is_blitz(games.rules(game_id)), "requires Blitz");
            let game = games.game(game_id);
            assert!(game.ready && game.end_at != 0 && timestamp >= game.end_at, "game has not ended");
            assert!(game.settled, "final point settlement incomplete");
        }
        fn assert_recorded_batch(
            self: @ComponentState<TContractState>, game_id: u32, command: RecordBlitzResults, count: u8,
        ) {
            assert!(
                Into::<u8, u32>::into(command.start) + command.players.len() <= count.into(),
                "overlapping result batch",
            );
            for offset in 0..command.players.len() {
                let index: u8 = (Into::<u8, u32>::into(command.start) + offset).try_into().unwrap();
                assert!(self.results.read((game_id, index)) == *command.players.at(offset), "conflicting result retry");
            }
        }
        fn validate_player(
            self: @ComponentState<TContractState>,
            game_id: u32,
            roster: Span<RosterPlayer>,
            points: Span<u128>,
            index: u8,
            result: PlayerResult,
        ) {
            let mut member = false;
            let mut expected_rank: u8 = 1;
            for position in 0..roster.len() {
                let score = *points.at(position);
                if score > result.points {
                    expected_rank += 1;
                }
                if *roster.at(position).account == result.player {
                    assert!(score == result.points, "incorrect result points");
                    member = true;
                }
            }
            assert!(result.rank == expected_rank && result.rank <= index + 1, "omitted higher result");
            assert!(member, "result player outside roster");
            for previous in 0..index {
                assert!(self.results.read((game_id, previous)).player != result.player, "duplicate result player");
            }
            let rank = if index == 0 {
                1
            } else {
                let previous = self.results.read((game_id, index - 1));
                assert!(previous.points >= result.points, "results not ordered by points");
                if previous.points == result.points {
                    previous.rank
                } else {
                    index + 1
                }
            };
            assert!(result.rank == rank, "incorrect competition rank");
        }
        fn emit_result(ref self: ComponentState<TContractState>, game_id: u32, actor: ContractAddress, timestamp: u64) {
            let result = super::IBlitzResults::blitz_result(@self, game_id);
            let mut values = array![];
            result.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'BlitzResult', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
            if result.complete {
                self
                    .emit(
                        StoryEvent {
                            version: 1,
                            game_id,
                            id: self.games().allocate_entity(game_id),
                            owner: Some(actor),
                            entity_id: None,
                            tx_hash: get_tx_info().unbox().transaction_hash,
                            story: Story::BlitzFinalized(result.commitment),
                            timestamp,
                        },
                    );
            }
        }
    }
}

pub fn result_commitment(game_id: u32, players: Span<PlayerResult>) -> felt252 {
    let mut values = array!['ETERNUM_BLITZ_RESULT', 1, game_id.into()];
    players.serialize(ref values);
    core::poseidon::poseidon_hash_span(values.span())
}
