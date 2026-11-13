use starknet::Event;
use starknet::storage::{StorageMapWriteAccess, StoragePointerReadAccess};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

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
        StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::entry::{LaborGrant, LaborHome};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::resources::ResourceKey;
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
        fn labor_grant(self: @ComponentState<TContractState>, home: LaborHome, day: u64) -> Option<LaborGrant> {
            match self.data.entry.home_labor_grants.read((home.game_id, home.home, day)) {
                Some((
                    account, amount, essence,
                )) => Some(LaborGrant { game_id: home.game_id, account, home: home.home, amount, essence }),
                None => None,
            }
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

        fn grant_labor(
            ref self: ComponentState<TContractState>, home: LaborHome, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            super::assert_ledger_operator();
            self.grant_home_resources(home, day, account)
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
            let resource_context = crate::commands::ResourceContext {
                production_start: if preset.rules.mode_rules.read() & crate::rules::PRODUCTION_START != 0 {
                    game.start_main_at.try_into().unwrap()
                } else {
                    0
                },
                troop_capacity: preset.rules.capacity_config.read().troop_capacity,
                spire_fee: preset.rules.spire_travel_essence_cost.read(),
                delivery_tick: preset.rules.tick_config.read().delivery_tick_in_seconds,
            };
            let release_id = self.data.game_releases.read(key.game_id);
            let resources = self.data.releases.read(release_id).classes.resources;
            for day in first..today {
                if self.data.entry.home_labor_grants.read((key.game_id, home, day)).is_some() {
                    continue;
                }
                let (amount, essence) = crate::logic::entry::grant_home_amounts(
                    crate::entry::LaborHome { game_id: key.game_id, home },
                    Some(entitlement.metadata_2.try_into().unwrap()),
                    rules,
                    resource_context,
                    resources,
                );
                crate::logic::entry::record_labor_grant(
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
    > of InternalTrait<TContractState> {
        fn grant_home_resources(
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
            let campaign_tier = self.home_campaign_tier(target, account);
            let (amount, essence) = super::grant_home_amounts(
                target,
                campaign_tier,
                rules,
                crate::commands::resource_context(context),
                get_dep_component!(@self, Life).classes(target.game_id).resources.read(),
            );
            let grant = LaborGrant { game_id: target.game_id, account, home: target.home, amount, essence };
            super::record_labor_grant(day, grant);
            grant
        }
        fn home_campaign_tier(
            self: @ComponentState<TContractState>, target: LaborHome, account: ContractAddress,
        ) -> Option<u8> {
            let record = crate::logic::structures::record(
                ResourceKey { game_id: target.game_id, entity_id: target.home },
            );
            assert!(
                record.base.category == crate::taxonomy::REALM_CATEGORY && record.owner == account,
                "labor requires an owned realm",
            );
            if let Some((_, tier)) = self.data.settlements.campaign_homes.read((target.game_id, target.home)) {
                return Some(tier);
            }
            let source = self
                .data
                .settlements
                .entitlements
                .read((target.game_id, account))
                .expect('home has no daily claim');
            let realm_id: u32 = source.realm_id.try_into().expect('invalid canonical realm');
            assert!(
                source.pass_kind == crate::settlement::HELD_REALM_KIND
                    && self.data.settlements.held_realm_homes.read((target.game_id, realm_id)) == target.home,
                "home has no daily claim",
            );
            None
        }
    }
}

pub fn grant_home_amounts(
    target: crate::entry::LaborHome,
    campaign_tier: Option<u8>,
    rules: crate::entry::LaborRules,
    resource_context: crate::commands::ResourceContext,
    resource_class: starknet::ClassHash,
) -> (u128, u128) {
    let (labor_amount, essence_amount) = if campaign_tier == Some(crate::settlement::CAMPAIGN_GOLDEN) {
        (rules.golden_amount, rules.golden_essence)
    } else if campaign_tier.is_some() {
        (rules.amount, rules.campaign_essence)
    } else {
        (rules.amount, 0)
    };
    let home = ResourceKey { game_id: target.game_id, entity_id: target.home };
    let timestamp = starknet::get_block_timestamp();
    let resources = IResourceOperationsLibraryDispatcher { class_hash: resource_class };
    let amount = resources
        .grant_resource(
            home, crate::resources::LABOR, labor_amount * crate::rules::RESOURCE_PRECISION, timestamp, resource_context,
        );
    let essence = if essence_amount != 0 {
        resources
            .grant_resource(
                home,
                crate::resources::ESSENCE,
                essence_amount * crate::rules::RESOURCE_PRECISION,
                timestamp,
                resource_context,
            )
    } else {
        0
    };
    (amount, essence)
}

pub fn record_labor_grant(day: u64, grant: crate::entry::LaborGrant) {
    crate::state::write()
        .entry
        .home_labor_grants
        .write((grant.game_id, grant.home, day), Some((grant.account, grant.amount, grant.essence)));
    let event = EntryAdministration::Event::RowSet(
        crate::events::RowSet {
            version: 1,
            model: 'LaborGrant',
            keys: array![grant.game_id.into(), grant.home.into(), day.into()].span(),
            values: array![grant.account.into(), grant.amount.into(), grant.essence.into()].span(),
        },
    );
    let mut keys = array![selector!("AdministrationEvent")];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}
