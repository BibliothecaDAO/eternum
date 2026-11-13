use starknet::storage::StoragePointerReadAccess;

pub fn assert_ledger_operator() {
    let operator = crate::state::read().entry.operator.read();
    assert!(operator != 0.try_into().unwrap() && starknet::get_caller_address() == operator, "only ledger operator");
}

pub fn recover_flyer_days(
    key: crate::settlement::EntryKey, home: u64, entitlement: crate::settlement::EntryEntitlement,
) {
    crate::entry::ICampaignRecoveryDispatcherTrait::recover_flyer_days(
        crate::entry::ICampaignRecoveryLibraryDispatcher {
            class_hash: crate::logic::release::classes(key.game_id).bridge.read(),
        },
        key,
        home,
        entitlement,
    );
}

#[starknet::component]
pub mod EntryAdministration {
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::settlement::{EntryEntitlement, EntryKey};

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
        fn frontier_prize(self: @ComponentState<TContractState>, game_id: u32) -> crate::entry::FrontierPrize {
            crate::entry::FrontierPrize {
                pool: self.data.entry.prize_pool.read(game_id),
                issued: self.data.entry.prize_issued.read(game_id),
                count: self.data.entry.prize_count.read(game_id),
            }
        }
        fn sweep_lords(ref self: ComponentState<TContractState>, game_id: u32, structure_id: u64) {
            super::assert_ledger_operator();
            crate::relics::ILordsDispatcherTrait::sweep_lords(
                crate::relics::ILordsLibraryDispatcher {
                    class_hash: get_dep_component!(@self, Life).classes(game_id).prizes.read(),
                },
                game_id,
                structure_id,
            );
        }
    }
    #[embeddable_as(CampaignRecoveryImpl)]
    pub impl CampaignRecovery<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::entry::ICampaignRecovery<ComponentState<TContractState>> {
        fn recover_flyer_days(
            ref self: ComponentState<TContractState>, key: EntryKey, home: u64, entitlement: EntryEntitlement,
        ) {
            let timestamp = starknet::get_block_timestamp();
            let game = crate::logic::game::game(key.game_id);
            let preset = crate::logic::preset_record::for_game(key.game_id);
            crate::game::assert_playing(game, timestamp);
            let created_at = self.data.structures.structures.entry((key.game_id, home)).base.read().created_at;
            let unit = preset.rules.day_unit_seconds.read();
            let founded = core::cmp::max(created_at.into(), game.start_main_at);
            let first = crate::days::day_of(game, unit, founded).index;
            let today = crate::days::day_of(game, unit, timestamp).index;
            let rules = preset.labor_rules.read().expect('labor is disabled');
            let resource_context = crate::logic::home_grants::grant_resource_context(key.game_id, game);
            let release_id = self.data.game_releases.read(key.game_id);
            let resources = self.data.releases.entry(release_id).classes.resources.read();
            for day in first..today {
                if self.data.entry.home_labor_grants.read((key.game_id, home, day)).is_some() {
                    continue;
                }
                let (amount, essence) = crate::logic::home_grants::grant_home_amounts(
                    crate::entry::LaborHome { game_id: key.game_id, home },
                    Some(entitlement.metadata_2.try_into().unwrap()),
                    rules,
                    resource_context,
                    resources,
                );
                crate::logic::home_grants::record_labor_grant(
                    day, crate::entry::LaborGrant { game_id: key.game_id, account: key.owner, home, amount, essence },
                );
            }
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {}
}
