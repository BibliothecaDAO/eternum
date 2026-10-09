use starknet::storage::StoragePointerReadAccess;

pub fn assert_ledger_operator() {
    let operator = crate::state::read().entry.operator.read();
    assert!(
        operator != 0.try_into().unwrap() && starknet::get_caller_address() == operator, "only ledger operator",
    );
}

#[starknet::component]
pub mod EntryAdministration {
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::entry::{LaborGrant, LaborRealm};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
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
        fn ledger_operator(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.entry.operator.read()
        }
        fn set_ledger_operator(ref self: ComponentState<TContractState>, operator: ContractAddress) {
            get_dep_component!(@self, Life).assert_authority();
            self.data.entry.operator.write(operator);
        }
        fn labor_grant(self: @ComponentState<TContractState>, realm: LaborRealm, day: u64) -> Option<LaborGrant> {
            match self.data.entry.labor_grants.read((realm.game_id, realm.realm_id, day)) {
                Some((account, home, amount)) => Some(LaborGrant { account, home, amount }),
                None => None,
            }
        }
        fn grant_labor(
            ref self: ComponentState<TContractState>, realm: LaborRealm, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            super::assert_ledger_operator();
            if let Some(previous) = crate::entry::ILedgerOperator::labor_grant(@self, realm, day) {
                assert!(previous.account == account && previous.home == realm.home, "labor already claimed");
                return previous;
            }
            assert!(
                realm.realm_id > 0 && realm.realm_id <= crate::realms::CANONICAL_REALM_COUNT, "invalid canonical realm",
            );
            assert!(account != 0.try_into().unwrap(), "invalid labor account");
            let timestamp = starknet::get_block_timestamp();
            let context = crate::commands::load_context(
                realm.game_id, crate::commands::ActionContext { raw_root: 0, timestamp },
            );
            crate::game::assert_playing(context.game.unbox(), timestamp);
            let rules = crate::logic::preset_record::for_game(realm.game_id).labor_rules.read()
                .expect('labor is disabled');
            assert!(
                day == crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, timestamp).index,
                "incorrect labor day",
            );
            let home = ResourceKey { game_id: realm.game_id, entity_id: realm.home };
            let record = crate::logic::structures::record(home);
            assert!(
                record.base.category == crate::taxonomy::REALM_CATEGORY && record.owner == account,
                "labor requires an owned realm",
            );
            let count = self.data.entry.labor_claim_counts.read((realm.game_id, account, day));
            assert!(rules.account_daily_limit == 0 || count < rules.account_daily_limit, "daily labor realm limit");
            let classes = get_dep_component!(@self, Life).classes(realm.game_id);
            let amount = IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() }
                .grant_resource(
                    home, crate::resources::LABOR, rules.amount * crate::rules::RESOURCE_PRECISION,
                    timestamp, crate::commands::resource_context(context),
                );
            let grant = LaborGrant { account, home: realm.home, amount };
            self.record_labor_grant(realm, day, grant, count + 1);
            grant
        }
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>, +Drop<TContractState>> of InternalTrait<TContractState> {
        fn record_labor_grant(
            ref self: ComponentState<TContractState>, realm: LaborRealm, day: u64, grant: LaborGrant, count: u32,
        ) {
            self.data.entry.labor_grants.write(
                (realm.game_id, realm.realm_id, day), Some((grant.account, grant.home, grant.amount)),
            );
            self.data.entry.labor_claim_counts.write((realm.game_id, grant.account, day), count);
            let mut values = array![];
            grant.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LaborGrant',
                        keys: array![realm.game_id.into(), realm.realm_id.into(), day.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
