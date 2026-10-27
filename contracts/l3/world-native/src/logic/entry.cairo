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
    use crate::entry::{LaborGrant, LaborHome};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

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
        fn ledger_operator(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.entry.operator.read()
        }
        fn set_ledger_operator(ref self: ComponentState<TContractState>, operator: ContractAddress) {
            get_dep_component!(@self, Life).assert_authority();
            self.data.entry.operator.write(operator);
        }
        fn labor_grant(self: @ComponentState<TContractState>, home: LaborHome, day: u64) -> Option<LaborGrant> {
            match self.data.entry.home_labor_grants.read((home.game_id, home.home, day)) {
                Some((account, amount)) => Some(LaborGrant { game_id: home.game_id, account, home: home.home, amount }),
                None => None,
            }
        }
        fn publish_frontier_pool(
            ref self: ComponentState<TContractState>, game_id: u32, amount: u128, prize_pool: u128,
        ) {
            super::assert_ledger_operator();
            crate::logic::lords_budget::publish_pool(game_id, amount);
            self.data.entry.prize_pool.write(game_id, prize_pool);
            self.record_frontier_prize(game_id);
        }
        fn top_up_frontier_pool(ref self: ComponentState<TContractState>, game_id: u32, amount: u128) {
            super::assert_ledger_operator();
            crate::logic::lords_budget::top_up_pool(game_id, amount);
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
                for j in 0..i {
                    assert!(winner != *winners.at(j.into()), "duplicate prize winner");
                }
                self.data.entry.prize_winners.write((game_id, i + 1), winner);
            }
            self.data.entry.prize_count.write(game_id, Some(count));
            self.record_frontier_prize(game_id);
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
        fn grant_labor(
            ref self: ComponentState<TContractState>, home: LaborHome, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            super::assert_ledger_operator();
            self.grant_home_labor(home, day, account)
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn assert_prize_ready(self: @ComponentState<TContractState>, game_id: u32) {
            let game = crate::logic::game::game(game_id);
            let now = starknet::get_block_timestamp();
            assert!(now >= game.end_at, "season has not ended");
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
        fn grant_home_labor(
            ref self: ComponentState<TContractState>, target: LaborHome, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            if let Some(previous) = crate::entry::ILedgerOperator::labor_grant(@self, target, day) {
                assert!(
                    previous.game_id == target.game_id && previous.account == account && previous.home == target.home,
                    "labor already claimed",
                );
                return previous;
            }
            assert!(account != 0.try_into().unwrap(), "invalid labor account");
            let timestamp = starknet::get_block_timestamp();
            let context = crate::commands::load_context(target.game_id, 0, timestamp);
            crate::game::assert_playing(context.game.unbox(), timestamp);
            let rules = crate::logic::preset_record::for_game(target.game_id)
                .labor_rules
                .read()
                .expect('labor is disabled');
            assert!(
                day == crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, timestamp)
                    .index,
                "incorrect labor day",
            );
            let home = ResourceKey { game_id: target.game_id, entity_id: target.home };
            let record = crate::logic::structures::record(home);
            assert!(
                record.base.category == crate::taxonomy::REALM_CATEGORY && record.owner == account,
                "labor requires an owned realm",
            );
            assert!(
                self
                    .data
                    .settlements
                    .held_realm_homes
                    .read((target.game_id, record.metadata.realm_id.into())) == target
                    .home,
                "labor requires a settled held Realm",
            );
            let classes = get_dep_component!(@self, Life).classes(target.game_id);
            let amount = IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() }
                .grant_resource(
                    home,
                    crate::resources::LABOR,
                    rules.amount * crate::rules::RESOURCE_PRECISION,
                    timestamp,
                    crate::commands::resource_context(context),
                );
            let grant = LaborGrant { game_id: target.game_id, account, home: target.home, amount };
            self.record_labor_grant(day, grant);
            grant
        }
        fn record_labor_grant(ref self: ComponentState<TContractState>, day: u64, grant: LaborGrant) {
            self
                .data
                .entry
                .home_labor_grants
                .write((grant.game_id, grant.home, day), Some((grant.account, grant.amount)));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LaborGrant',
                        keys: array![grant.game_id.into(), grant.home.into(), day.into()].span(),
                        values: array![grant.account.into(), grant.amount.into()].span(),
                    },
                );
        }
    }
}
