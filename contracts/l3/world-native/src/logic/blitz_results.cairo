#[starknet::component]
pub mod BlitzResultState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_tx_info};
    use crate::blitz_results::{BlitzResult, PlayerResult, RecordBlitzResults};
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::ownership::{Story, StoryEvent};
    use crate::registrar::RosterPlayer;

    // One immutable result per roster position; count is the resumable batch cursor.
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
        StoryEvent: StoryEvent,
    }
    #[embeddable_as(BlitzResultsImpl)]
    pub impl Commands<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::blitz_results::IBlitzResults<ComponentState<TContractState>> {
        fn blitz_result(self: @ComponentState<TContractState>, game_id: u32) -> BlitzResult {
            let roster = self.roster(game_id);
            let mut players = array![];
            for index in 0..self.data.blitz_results.count.read(game_id) {
                players.append(self.data.blitz_results.results.read((game_id, index)));
            }
            let complete = !roster.is_empty() && players.len() == roster.len();
            let commitment = if complete {
                crate::blitz_results::result_commitment(game_id, players.span())
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
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> (u64, crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, actor, context.timestamp, context);
            let roster = self.roster(game_id);
            let count = self.data.blitz_results.count.read(game_id);
            let end = Into::<u8, u32>::into(command.start) + command.players.len();
            assert!(!command.players.is_empty() && command.players.len() <= 8, "invalid result batch size");
            assert!(end <= roster.len(), "too many result players");
            if command.start < count {
                self.assert_recorded_batch(game_id, command, count);
                return ((roster.len() - Into::<u8, u32>::into(count)).into(), story_cursor);
            }
            assert!(command.start == count, "result batch out of order");
            let mut points = array![];
            for player in roster {
                points.append(self.data.season.player_points.read((game_id, *player.account)));
            }
            for offset in 0..command.players.len() {
                let index: u8 = (Into::<u8, u32>::into(count) + offset).try_into().unwrap();
                let result = *command.players.at(offset);
                self.validate_player(game_id, roster, points.span(), index, result);
                self.data.blitz_results.results.write((game_id, index), result);
            }
            self.data.blitz_results.count.write(game_id, end.try_into().unwrap());
            self.emit_result(game_id, actor, context.timestamp, ref story_cursor);
            ((roster.len() - end).into(), story_cursor)
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            crate::logic::registrar::blitz_roster(game_id)
        }
        fn authorize(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let release = get_dep_component!(self, Life);
            assert!(actor == release.authority(), "only domain authority");

            assert!(
                !crate::rules::rule_enabled(game_context.rules.unbox(), crate::rules::SEASON_CLOSE),
                "result finalisation is disabled",
            );
            let game = game_context.game.unbox();
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
                assert!(
                    self.data.blitz_results.results.read((game_id, index)) == *command.players.at(offset),
                    "conflicting result retry",
                );
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
                assert!(
                    self.data.blitz_results.results.read((game_id, previous)).player != result.player,
                    "duplicate result player",
                );
            }
            let rank = if index == 0 {
                1
            } else {
                let previous = self.data.blitz_results.results.read((game_id, index - 1));
                assert!(previous.points >= result.points, "results not ordered by points");
                if previous.points == result.points {
                    previous.rank
                } else {
                    index + 1
                }
            };
            assert!(result.rank == rank, "incorrect competition rank");
        }
        fn emit_result(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let result = crate::blitz_results::IBlitzResults::blitz_result(@self, game_id);
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
                            order: story_cursor.order,
                            index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
