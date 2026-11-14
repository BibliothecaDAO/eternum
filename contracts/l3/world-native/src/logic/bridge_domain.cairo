#[starknet::contract]
pub mod BridgeLogic {
    use crate::logic::entry::EntryAdministration;
    use crate::logic::guilds::GuildState;
    use crate::logic::quests::QuestState;
    use crate::logic::release::ReleaseState;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;

    component!(path: EntryAdministration, storage: administration, event: AdministrationEvent);
    #[abi(embed_v0)]
    impl LedgerOperator = EntryAdministration::LedgerOperatorImpl<ContractState>;
    #[abi(embed_v0)]
    impl HomeGrants = EntryAdministration::HomeGrantsImpl<ContractState>;
    #[abi(embed_v0)]
    impl ResourceContext = EntryAdministration::ResourceContextImpl<ContractState>;
    impl AdministrationInternal = EntryAdministration::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl CampaignRecovery = EntryAdministration::CampaignRecoveryImpl<ContractState>;
    component!(path: QuestState, storage: quests, event: QuestEvent);
    #[abi(embed_v0)]
    impl QuestProgress = QuestState::ProgressImpl<ContractState>;
    #[abi(embed_v0)]
    impl DailyQuest = QuestState::DailyQuestImpl<ContractState>;
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        guilds: GuildState::Storage,
        #[substorage(v0)]
        administration: EntryAdministration::Storage,
        #[substorage(v0)]
        quests: QuestState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GuildEvent: GuildState::Event,
        AdministrationEvent: EntryAdministration::Event,
        QuestEvent: QuestState::Event,
        ReleaseEvent: ReleaseState::Event,
    }
}
