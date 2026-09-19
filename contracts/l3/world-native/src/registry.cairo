#[starknet::contract]
pub mod RegistryDomain {
    use crate::entry::EntryAdministration;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::guilds::GuildState;
    use crate::lifecycle::Lifecycle;
    use crate::registrar::RegistrarState;
    use crate::upgrades::{UpgradeLimits, UpgradeRecipe, UpgradeState};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: UpgradeState, storage: upgrades, event: UpgradeEvent);
    impl UpgradeInternal = UpgradeState::InternalImpl<ContractState>;
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    component!(path: EntryAdministration, storage: entry, event: EntryEvent);
    #[abi(embed_v0)]
    impl Entry = EntryAdministration::LedgerOperatorImpl<ContractState>;
    component!(path: RegistrarState, storage: registrar, event: RegistrarEvent);
    #[abi(embed_v0)]
    impl Registrar = RegistrarState::RegistrarImpl<ContractState>;
    impl RegistrarInternal = RegistrarState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        guilds: GuildState::Storage,
        #[substorage(v0)]
        entry: EntryAdministration::Storage,
        #[substorage(v0)]
        registrar: RegistrarState::Storage,
        #[substorage(v0)]
        upgrades: UpgradeState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        GuildEvent: GuildState::Event,
        EntryEvent: EntryAdministration::Event,
        RegistrarEvent: RegistrarState::Event,
        UpgradeEvent: UpgradeState::Event,
    }
    #[abi(embed_v0)]
    impl UpgradeRules of crate::upgrades::IUpgradeRules<ContractState> {
        fn configure_upgrades(
            ref self: ContractState, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>,
        ) {
            self.lifecycle.assert_configurator();
            let _ = IGameDispatcher { contract_address: self.lifecycle.require_active().season }.game(game_id);
            self.upgrades.configure(game_id, limits, recipes);
        }
        fn upgrade_limits(self: @ContractState, game_id: u32) -> UpgradeLimits {
            self.upgrades.limits(game_id)
        }
        fn upgrade_recipe(self: @ContractState, game_id: u32, level: u8) -> UpgradeRecipe {
            self.upgrades.recipe(game_id, level)
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: starknet::ContractAddress) {
        self.lifecycle.initialize(authority);
        self.registrar.initialize();
    }
}
