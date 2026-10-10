#[starknet::component]
pub mod BlitzResultState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_tx_info};
    use crate::blitz_results::{BlitzResult, RankedPlayer};
    use crate::events::RowSet;
    use crate::ownership::{Story, StoryEvent};
    use crate::registrar::RosterPlayer;

    // One immutable result per frozen roster position; count records completion.
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
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::blitz_results::IBlitzResults<ComponentState<TContractState>> {
        fn blitz_result(self: @ComponentState<TContractState>, game_id: u32) -> BlitzResult {
            let roster = self.roster(game_id);
            let mut players = array![];
            for index in 0..self.data.blitz_results.ranked_count.read(game_id) {
                players.append(self.data.blitz_results.ranked_results.read((game_id, index)));
            }
            let complete = !roster.is_empty() && players.len() == roster.len();
            let commitment = if complete {
                crate::blitz_results::result_commitment(get_tx_info().unbox().chain_id, game_id, players.span())
            } else {
                0
            };
            BlitzResult { players: players.span(), complete, commitment }
        }
        fn record_blitz_results(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::load_context(game_id, context);
            self.assert_finalizable(context);
            let roster = self.roster(game_id);
            let count = self.data.blitz_results.ranked_count.read(game_id);
            if Into::<u8, u32>::into(count) == roster.len() {
                return 0;
            }
            let mut points = array![];
            for player in roster {
                points.append(self.data.season.player_points.read((game_id, *player.account)));
            }
            self.write_ranked_roster(game_id, roster, points.span());
            self.data.blitz_results.ranked_count.write(game_id, roster.len().try_into().unwrap());
            self.emit_result(game_id, crate::state::read().launcher.read(), context.timestamp);
            0
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            crate::logic::registrar::blitz_roster(game_id)
        }
        fn assert_finalizable(self: @ComponentState<TContractState>, game_context: crate::commands::ExecutionContext) {
            let timestamp = game_context.timestamp;
            assert!(
                !crate::rules::rule_enabled(game_context.rules.unbox(), crate::rules::SEASON_CLOSE),
                "result finalisation is disabled",
            );
            let game = game_context.game.unbox();
            assert!(game.ready && game.end_at != 0 && timestamp >= game.end_at, "game has not ended");
            assert!(game.settled, "final point settlement incomplete");
        }
        fn write_ranked_roster(
            ref self: ComponentState<TContractState>, game_id: u32, roster: Span<RosterPlayer>, points: Span<u128>,
        ) {
            for position in 0..roster.len() {
                let (index, result) = Self::ranked_player(roster, points, position);
                self.data.blitz_results.ranked_results.write((game_id, index), result);
            }
        }
        fn ranked_player(roster: Span<RosterPlayer>, points: Span<u128>, position: u32) -> (u8, RankedPlayer) {
            let wallet = *roster.at(position).wallet;
            let score = *points.at(position);
            let mut rank: u16 = 1;
            let mut index: u8 = 0;
            for other in 0..roster.len() {
                let other_score = *points.at(other);
                if other_score > score {
                    rank += 1;
                    index += 1;
                } else if other_score == score && *roster.at(other).wallet < wallet {
                    index += 1;
                }
            }
            (index, RankedPlayer { wallet, rank })
        }
        fn emit_result(
            ref self: ComponentState<TContractState>, game_id: u32, launcher: ContractAddress, timestamp: u64,
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
                            version: 2,
                            game_id,
                            owner: Some(launcher),
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
