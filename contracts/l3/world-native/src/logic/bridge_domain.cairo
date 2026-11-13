#[starknet::contract]
pub mod BridgeLogic {
    use crate::logic::entry::EntryAdministration;
    use crate::logic::release::ReleaseState;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl DeepBanes of crate::deep::IDeepBanes<ContractState> {
        fn credit_altar(ref self: ContractState, game_id: u32, source: u8, boundary: u64) {
            crate::logic::deep_banes::credit(game_id, source, boundary);
        }
        fn team_quest(self: @ContractState, home: crate::resources::ResourceKey, day: u64) -> Option<u8> {
            crate::logic::deep_banes::bane(
                crate::deep::TeamBaneKey {
                    game_id: home.game_id, aspect: crate::logic::aspects::home_aspect(home), day,
                },
            )
                .map(|bane| bane.quest)
        }
    }
    component!(path: EntryAdministration, storage: administration, event: AdministrationEvent);
    #[abi(embed_v0)]
    impl LedgerOperator = EntryAdministration::LedgerOperatorImpl<ContractState>;
    impl AdministrationInternal = EntryAdministration::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl CampaignRecovery = EntryAdministration::CampaignRecoveryImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        administration: EntryAdministration::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        AdministrationEvent: EntryAdministration::Event,
        ReleaseEvent: ReleaseState::Event,
    }
}
