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
    impl CaptureRewards = RelicState::CaptureRewardsImpl<ContractState>;
    #[abi(embed_v0)]
    impl ArmySlotStamina = RelicState::ArmySlotStaminaImpl<ContractState>;
    #[abi(embed_v0)]
    impl ArmyProgression = RelicState::ArmyProgressionImpl<ContractState>;

    #[abi(embed_v0)]
    impl StaminaShop of crate::fragments::IStaminaShop<ContractState> {
        fn buy_stamina(
            ref self: ContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::fragments::BuyStamina,
            context: crate::commands::ActionContext,
        ) {
            crate::logic::fragments::buy_stamina(game_id, actor, command, context);
        }
    }

    #[abi(embed_v0)]
    impl Oaths of crate::oaths::IOaths<ContractState> {
        fn choose_oath(
            ref self: ContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::oaths::ChooseOath,
            context: crate::commands::ActionContext,
        ) {
            crate::logic::oaths::choose(game_id, actor, command, context);
        }
        fn reroll_oath(
            ref self: ContractState,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: crate::oaths::RerollOath,
            context: crate::commands::ActionContext,
        ) {
            crate::logic::oaths::reroll(game_id, actor, command, context);
        }
        fn offer_oaths(
            ref self: ContractState, key: crate::troops::ExplorerKey, coord: crate::troops::Coord, seed: u256,
        ) {
            crate::logic::oaths::offer(key, coord, seed);
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
