#[starknet::contract]
pub mod RelicsLogic {
    use crate::logic::release::ReleaseState;
    use crate::logic::relics::RelicState;

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: RelicState, storage: relics, event: RelicEvent);
    component!(path: crate::logic::army_relics::ArmyRelicState, storage: army_relics, event: ArmyRelicEvent);
    #[abi(embed_v0)]
    impl ArmyRelics = crate::logic::army_relics::ArmyRelicState::ViewsImpl<ContractState>;
    impl LifecycleInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Relics = RelicState::RelicsImpl<ContractState>;
    #[abi(embed_v0)]
    impl FrontierSites = RelicState::FrontierSitesImpl<ContractState>;
    #[abi(embed_v0)]
    impl CaptureRewards = RelicState::CaptureRewardsImpl<ContractState>;
    #[abi(embed_v0)]
    impl ArmySlotStamina = RelicState::ArmySlotStaminaImpl<ContractState>;
    #[abi(embed_v0)]
    impl ArmyProgression = RelicState::ArmyProgressionImpl<ContractState>;
    #[abi(embed_v0)]
    impl Artificer = RelicState::ArtificerImpl<ContractState>;

    #[abi(embed_v0)]
    impl DiscoveryRoll of crate::discovery::IDiscoveryRoll<ContractState> {
        fn roll_expedition_discovery(
            ref self: ContractState,
            key: crate::map::TileKey,
            explorer_id: u64,
            seed: u256,
            context: crate::commands::ActionContext,
        ) -> crate::discovery::Discovery {
            crate::logic::discovery::roll(key, explorer_id, seed, context)
        }
    }

    #[abi(embed_v0)]
    impl PresetRelics of crate::presets::IPresetRelics<ContractState> {
        fn store_relic_preset(
            ref self: ContractState,
            commitment: felt252,
            rules: Span<crate::relics::RelicRule>,
            chests: Option<crate::relics::ChestRules>,
            mode_rules: u32,
            day_unit_seconds: u32,
        ) {
            crate::logic::preset_record::store_relics(commitment, rules, chests, mode_rules, day_unit_seconds);
        }
    }

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        army_relics: crate::logic::army_relics::ArmyRelicState::Storage,
        #[substorage(v0)]
        relics: RelicState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        RelicEvent: RelicState::Event,
        ArmyRelicEvent: crate::logic::army_relics::ArmyRelicState::Event,
    }
}
