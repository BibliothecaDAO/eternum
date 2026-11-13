use starknet::Event;
use starknet::storage::{StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

#[starknet::component]
pub mod HomeGrantState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::entry::{LaborGrant, LaborHome};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::resources::ResourceKey;

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
    #[embeddable_as(HomeGrantsImpl)]
    pub impl HomeGrants<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::entry::IHomeGrants<ComponentState<TContractState>> {
        fn labor_grant(self: @ComponentState<TContractState>, home: LaborHome, day: u64) -> Option<LaborGrant> {
            match self.data.entry.home_labor_grants.read((home.game_id, home.home, day)) {
                Some((
                    account, amount, essence,
                )) => Some(LaborGrant { game_id: home.game_id, account, home: home.home, amount, essence }),
                None => None,
            }
        }
        fn grant_labor(
            ref self: ComponentState<TContractState>, home: LaborHome, day: u64, account: ContractAddress,
        ) -> LaborGrant {
            crate::logic::entry::assert_ledger_operator();
            assert!(!crate::logic::quests::enabled(home.game_id), "collect the daily quest");
            self.grant_home_resources(home, day, account)
        }
    }
    #[embeddable_as(ResourceContextImpl)]
    pub impl ResourceContextView<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::entry::IResourceContext<ComponentState<TContractState>> {
        fn resource_context(self: @ComponentState<TContractState>, game_id: u32) -> crate::commands::ResourceContext {
            super::grant_resource_context(game_id)
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
            if let Some(previous) = crate::entry::IHomeGrants::labor_grant(@self, target, day) {
                assert!(
                    previous.game_id == target.game_id && previous.account == account && previous.home == target.home,
                    "labor already claimed",
                );
                return previous;
            }
            assert!(account != 0.try_into().unwrap(), "invalid labor account");
            let timestamp = starknet::get_block_timestamp();
            let game = crate::logic::game::game(target.game_id);
            crate::game::assert_playing(game, timestamp);
            let preset = crate::logic::preset_record::for_game(target.game_id);
            let rules = preset.labor_rules.read().expect('labor is disabled');
            assert!(
                day == crate::days::day_of(game, preset.rules.day_unit_seconds.read(), timestamp).index,
                "incorrect labor day",
            );
            let campaign_tier = self.home_campaign_tier(target, account);
            let (amount, essence) = super::grant_home_amounts(
                target,
                campaign_tier,
                rules,
                super::grant_resource_context(target.game_id),
                get_dep_component!(@self, Life).classes(target.game_id).resources.read(),
            );
            let grant = LaborGrant { game_id: target.game_id, account, home: target.home, amount, essence };
            super::record_labor_grant(day, grant);
            grant
        }
        fn home_campaign_tier(
            self: @ComponentState<TContractState>, target: LaborHome, account: ContractAddress,
        ) -> Option<u8> {
            let key = ResourceKey { game_id: target.game_id, entity_id: target.home };
            assert!(crate::logic::structures::exists(key), "missing structure");
            let home = self.data.structures.structures.entry((target.game_id, target.home));
            assert!(
                home.base.read().category == crate::taxonomy::REALM_CATEGORY && home.owner.read() == account,
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
    let event = HomeGrantState::Event::RowSet(
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

#[inline(never)]
pub fn grant_resource_context(game_id: u32) -> crate::commands::ResourceContext {
    let rules = crate::logic::preset_record::for_game(game_id).rules;
    crate::commands::ResourceContext {
        production_start: if rules.mode_rules.read() & crate::rules::PRODUCTION_START != 0 {
            crate::state::read().games.games.entry(game_id).start_main_at.read().try_into().unwrap()
        } else {
            0
        },
        troop_capacity: rules.capacity_config.troop_capacity.read(),
        spire_fee: rules.spire_travel_essence_cost.read(),
        delivery_tick: rules.tick_config.delivery_tick_in_seconds.read(),
    }
}
