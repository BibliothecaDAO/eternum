#[starknet::contract]
pub mod RegistryLogic {
    use starknet::ContractAddress;
    #[cfg(feature: "test_support")]
    use crate::game::GameRegistry;
    use crate::game::assert_playing;
    use crate::logic::guilds::GuildState;
    use crate::logic::registrar::RegistrarState;
    use crate::logic::release::ReleaseState;
    use crate::resources::ResourceKey;
    use crate::rules::RESOURCE_PRECISION;
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
    component!(path: crate::logic::aspects::AspectState, storage: aspects, event: AspectEvent);
    #[abi(embed_v0)]
    impl Aspects = crate::logic::aspects::AspectState::AspectsImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        aspects: crate::logic::aspects::AspectState::Storage,
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
        AspectEvent: crate::logic::aspects::AspectState::Event,
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

    #[abi(embed_v0)]
    impl Villages of crate::village::IVillageArmy<ContractState> {
        fn receive_village_army(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            village_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: village_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own village");
            assert!(record.base.category == crate::taxonomy::VILLAGE_CATEGORY, "structure is not a village");
            assert!(!record.base.starting_troops_granted, "army grant already claimed");
            let grants = crate::logic::village::rules(game_id);
            let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
            let claimable_at: u64 = record.base.created_at.into() / interval + grants.troop_delay_ticks.into();
            assert!(context.timestamp / interval >= claimable_at, "army grant cannot be claimed yet");
            let category = crate::logic::structure_actions::biome_troop(key, context);
            crate::logic::structure_actions::grant_starting_troops(
                key, category, grants.resources, 10 * RESOURCE_PRECISION, context.timestamp, context,
            );
            ()
        }
    }
}
