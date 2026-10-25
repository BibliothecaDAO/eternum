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
        fn publish_frontier_pool(ref self: ComponentState<TContractState>, game_id: u32, amount: u128) {
            super::assert_ledger_operator();
            crate::logic::lords_budget::publish_pool(game_id, amount);
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
            assert!(day == crate::entry::labor_day(timestamp), "incorrect labor day");
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
