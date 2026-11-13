#[starknet::contract]
pub mod RegistryLogic {
    #[cfg(feature: "test_support")]
    use crate::game::GameRegistry;
    use crate::logic::guilds::GuildState;
    use crate::logic::registrar::RegistrarState;
    use crate::logic::release::ReleaseState;
    #[cfg(feature: "test_support")]
    use crate::rules::SliceRules;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: RegistrarState, storage: registrar, event: RegistrarEvent);
    #[abi(embed_v0)]
    impl Registrar = RegistrarState::RegistrarImpl<ContractState>;
    impl RegistrarInternal = RegistrarState::InternalImpl<ContractState>;
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;

    component!(path: GuildState, storage: guilds, event: GuildEvent);
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        guilds: GuildState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        registrar: RegistrarState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        GuildEvent: GuildState::Event,
        GameEvent: crate::logic::game::Event,
        ReleaseEvent: ReleaseState::Event,
        RegistrarEvent: RegistrarState::Event,
    }
    #[cfg(feature: "test_support")]
    #[abi(embed_v0)]
    impl Games of crate::game::IGame<ContractState> {
        fn write_game(ref self: ContractState, game_id: u32, game: GameRegistry) {
            crate::logic::game::game(game_id);
            crate::logic::game::write_game(game_id, game);
        }

        fn game(self: @ContractState, game_id: u32) -> GameRegistry {
            crate::logic::game::game(game_id)
        }
        fn rules(self: @ContractState, game_id: u32) -> SliceRules {
            crate::logic::game::rules(game_id)
        }
    }
}
