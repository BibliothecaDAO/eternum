use starknet::storage::StoragePointerReadAccess;

pub fn assert_ledger_operator() {
    let operator = crate::state::read().entry.operator.read();
    assert!(operator != 0.try_into().unwrap() && starknet::get_caller_address() == operator, "only ledger operator");
}

#[starknet::component]
pub mod EntryAdministration {
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
    }
    #[embeddable_as(LedgerOperatorImpl)]
    pub impl Administration<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::entry::ILedgerOperator<ComponentState<TContractState>> {
        fn configure_deposits(
            ref self: ComponentState<TContractState>, game_id: u32, source: crate::deposits::DepositSource,
        ) {
            crate::logic::deposits::configure(game_id, source)
        }
        fn deposit_source(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> Option<crate::deposits::DepositSource> {
            crate::logic::deposits::source(game_id)
        }
        fn deliver_deposit(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            deposit: crate::deposits::LordsDeposit,
            r: felt252,
            s: felt252,
            cancel: bool,
        ) {
            crate::logic::deposits::deliver(game_id, deposit, r, s, cancel)
        }
        fn deposit_receipt(
            self: @ComponentState<TContractState>, game_id: u32, id: u64,
        ) -> Option<crate::deposits::DepositReceipt> {
            crate::logic::deposits::receipt(game_id, id)
        }
        fn spend_lords(
            self: @ComponentState<TContractState>, game_id: u32, account: ContractAddress,
        ) -> crate::deposits::SpendLords {
            crate::logic::deposits::balance(game_id, account)
        }
        fn principal_withdrawal(
            self: @ComponentState<TContractState>, game_id: u32, account: ContractAddress,
        ) -> Option<crate::deposits::PrincipalWithdrawal> {
            crate::logic::deposits::withdrawal(game_id, account)
        }
        fn ledger_operator(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.entry.operator.read()
        }
        fn set_ledger_operator(ref self: ComponentState<TContractState>, operator: ContractAddress) {
            get_dep_component!(@self, Life).assert_authority();
            self.data.entry.operator.write(operator);
        }
        fn publish_frontier_pool(
            ref self: ComponentState<TContractState>, game_id: u32, amount: u128, prize_pool: u128,
        ) {
            super::assert_ledger_operator();
            crate::logic::lords_budget::publish_pool(game_id, amount);
            self.data.entry.prize_pool.write(game_id, prize_pool);
            self.record_frontier_prize(game_id);
        }
        fn frontier_prize(self: @ComponentState<TContractState>, game_id: u32) -> crate::entry::FrontierPrize {
            crate::entry::FrontierPrize {
                pool: self.data.entry.prize_pool.read(game_id),
                issued: self.data.entry.prize_issued.read(game_id),
                count: self.data.entry.prize_count.read(game_id),
            }
        }
        fn post_frontier_top(ref self: ComponentState<TContractState>, game_id: u32, winners: Array<ContractAddress>) {
            super::assert_ledger_operator();
            self.assert_prize_ready(game_id);
            let count: u16 = winners.len().try_into().unwrap();
            let rules = crate::logic::lords_budget::chest_rules(game_id);
            assert!(count <= rules.top_n, "too many prize winners");
            if let Some(previous) = self.data.entry.prize_count.read(game_id) {
                assert!(previous == count, "prize winners already fixed");
                for i in 0..count {
                    assert!(
                        self.data.entry.prize_winners.read((game_id, i + 1)) == *winners.at(i.into()),
                        "prize winners already fixed",
                    );
                }
                return;
            }
            for i in 0..count {
                let winner = *winners.at(i.into());
                assert!(winner != 0.try_into().unwrap(), "invalid prize winner");
                assert!(self.data.settlements.entries.read((game_id, winner)).is_some(), "prize winner has no realm");
                for j in 0..i {
                    assert!(winner != *winners.at(j.into()), "duplicate prize winner");
                }
                self.data.entry.prize_winners.write((game_id, i + 1), winner);
            }
            self.data.entry.prize_count.write(game_id, Some(count));
            self.record_frontier_prize(game_id);
        }
        fn sweep_lords(ref self: ComponentState<TContractState>, game_id: u32, structure_id: u64) {
            super::assert_ledger_operator();
            self.assert_season_ended(game_id);
            let context = crate::commands::load_context(game_id, 0, starknet::get_block_timestamp());
            crate::relics::ILordsDispatcherTrait::sweep_lords(
                crate::relics::ILordsLibraryDispatcher {
                    class_hash: get_dep_component!(@self, Life).classes(game_id).prizes.read(),
                },
                game_id,
                structure_id,
                crate::commands::action_context(context),
            );
        }
        fn award_frontier_prize(ref self: ComponentState<TContractState>, game_id: u32, rank: u16) {
            super::assert_ledger_operator();
            if self.data.entry.prize_awarded.read((game_id, rank)) {
                return;
            }
            self.assert_prize_ready(game_id);
            let count = self.data.entry.prize_count.read(game_id).expect('prize winners not posted');
            let amount = crate::frontier_prizes::prize_amount(self.data.entry.prize_pool.read(game_id), count, rank);
            self.data.entry.prize_awarded.write((game_id, rank), true);
            if amount == 0 {
                return;
            }
            let account = self.data.entry.prize_winners.read((game_id, rank));
            let withdrawal = crate::relics::LordsWithdrawal { account, amount, prize_rank: rank, prize_count: count };
            let claim_id = starknet::get_tx_info().unbox().transaction_hash;
            assert!(self.data.relics.lords_withdrawals.read(claim_id).is_none(), "withdrawal already recorded");
            self.data.relics.lords_withdrawals.write(claim_id, Some(withdrawal));
            self.data.entry.prize_issued.write(game_id, self.data.entry.prize_issued.read(game_id) + amount);
            let mut values = array![];
            withdrawal.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LordsWithdrawal',
                        keys: array![game_id.into(), claim_id].span(),
                        values: values.span(),
                    },
                );
            self.record_frontier_prize(game_id);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn assert_season_ended(self: @ComponentState<TContractState>, game_id: u32) {
            let game = crate::logic::game::game(game_id);
            assert!(starknet::get_block_timestamp() >= game.end_at, "season has not ended");
        }
        fn assert_prize_ready(self: @ComponentState<TContractState>, game_id: u32) {
            self.assert_season_ended(game_id);
            assert!(crate::logic::lords_budget::budget(game_id).is_some(), "Frontier pool not published");
        }
        fn record_frontier_prize(ref self: ComponentState<TContractState>, game_id: u32) {
            let prize = crate::entry::ILedgerOperator::frontier_prize(@self, game_id);
            let mut values = array![];
            prize.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1, model: 'FrontierPrize', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
    }
}
