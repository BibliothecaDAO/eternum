#[starknet::contract]
pub mod BridgeLogic {
    use crate::logic::entry::EntryAdministration;
    use crate::logic::release::ReleaseState;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl DeepBanes of crate::deep::IDeepBanes<ContractState> {
        fn height_blocked(self: @ContractState, game_id: u32, aspect: u8, timestamp: u64) -> bool {
            crate::logic::deep_banes::height_blocked(game_id, aspect, timestamp)
        }
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
    component!(path: crate::logic::home_grants::HomeGrantState, storage: home_grants, event: HomeGrantEvent);
    #[abi(embed_v0)]
    impl HomeGrants = crate::logic::home_grants::HomeGrantState::HomeGrantsImpl<ContractState>;
    impl HomeGrantsInternal = crate::logic::home_grants::HomeGrantState::InternalImpl<ContractState>;
    component!(path: crate::logic::quests::QuestState, storage: quests, event: QuestEvent);
    #[abi(embed_v0)]
    impl DailyQuest = crate::logic::quests::QuestState::DailyQuestImpl<ContractState>;
    #[abi(embed_v0)]
    impl QuestProgress = crate::logic::quests::QuestState::ProgressImpl<ContractState>;

    component!(path: crate::logic::banes::BaneState, storage: banes, event: BaneEvent);
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        banes: crate::logic::banes::BaneState::Storage,
        #[substorage(v0)]
        home_grants: crate::logic::home_grants::HomeGrantState::Storage,
        #[substorage(v0)]
        quests: crate::logic::quests::QuestState::Storage,
        #[substorage(v0)]
        administration: EntryAdministration::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BaneEvent: crate::logic::banes::BaneState::Event,
        HomeGrantEvent: crate::logic::home_grants::HomeGrantState::Event,
        QuestEvent: crate::logic::quests::QuestState::Event,
        AdministrationEvent: EntryAdministration::Event,
        ReleaseEvent: ReleaseState::Event,
    }
}
