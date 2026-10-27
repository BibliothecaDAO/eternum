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
    use crate::entry::{LaborGrant, LaborRealm};
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
        fn labor_grant(self: @ComponentState<TContractState>, realm: LaborRealm, day: u64) -> Option<LaborGrant> {
            match self.data.entry.labor_grants.read((realm.realm_id, day)) {
                Some((game_id, account, home, amount)) => Some(LaborGrant { game_id, account, home, amount }),
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
            ref self: ComponentState<TContractState>, realms: Array<LaborRealm>, day: u64, account: ContractAddress,
        ) -> Array<LaborGrant> {
            super::assert_ledger_operator();
            let mut grants = array![];
            for realm in realms {
                grants.append(self.grant_realm_labor(realm, day, account));
            }
            grants
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
        fn grant_realm_labor(
            ref self: ComponentState<TContractState>, realm: LaborRealm, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            if let Some(previous) = crate::entry::ILedgerOperator::labor_grant(@self, realm, day) {
                assert!(
                    previous.game_id == realm.game_id && previous.account == account && previous.home == realm.home,
                    "labor already claimed",
                );
                return previous;
            }
            assert!(
                realm.realm_id > 0 && realm.realm_id <= crate::realms::CANONICAL_REALM_COUNT, "invalid canonical realm",
            );
            assert!(account != 0.try_into().unwrap(), "invalid labor account");
            let timestamp = starknet::get_block_timestamp();
            let context = crate::commands::load_context(realm.game_id, 0, timestamp);
            crate::game::assert_playing(context.game.unbox(), timestamp);
            let rules = crate::logic::preset_record::for_game(realm.game_id)
                .labor_rules
                .read()
                .expect('labor is disabled');
            assert!(day == crate::entry::labor_day(timestamp), "incorrect labor day");
            let home = ResourceKey { game_id: realm.game_id, entity_id: realm.home };
            let record = crate::logic::structures::record(home);
            assert!(
                record.base.category == crate::taxonomy::REALM_CATEGORY && record.owner == account,
                "labor requires an owned realm",
            );
            let count = self.data.entry.labor_claim_counts.read((account, day));
            assert!(rules.account_daily_limit == 0 || count < rules.account_daily_limit, "daily labor realm limit");
            let classes = get_dep_component!(@self, Life).classes(realm.game_id);
            let amount = IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() }
                .grant_resource(
                    home,
                    crate::resources::LABOR,
                    rules.amount * crate::rules::RESOURCE_PRECISION,
                    timestamp,
                    crate::commands::resource_context(context),
                );
            let grant = LaborGrant { game_id: realm.game_id, account, home: realm.home, amount };
            self.record_labor_grant(realm, day, grant, count + 1);
            grant
        }
        fn record_labor_grant(
            ref self: ComponentState<TContractState>, realm: LaborRealm, day: u64, grant: LaborGrant, count: u32,
        ) {
            self
                .data
                .entry
                .labor_grants
                .write((realm.realm_id, day), Some((grant.game_id, grant.account, grant.home, grant.amount)));
            self.data.entry.labor_claim_counts.write((grant.account, day), count);
            let mut values = array![];
            grant.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LaborGrant',
                        keys: array![realm.realm_id.into(), day.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
