use crate::combat::CombatContext;
use crate::troops::Troops;

#[starknet::interface]
pub trait ICombat<T> {
    fn resolve_raid(
        self: @T,
        game_id: u32,
        explorer: Troops,
        guards: Span<crate::guards::Guard>,
        biome: crate::biome::Biome,
        timestamp: u64,
    ) -> crate::raid::RaidResolution;
    fn resolve_battle(
        self: @T, game_id: u32, attacker: Troops, defender: Troops, context: CombatContext,
    ) -> (Troops, Troops);
}

#[starknet::contract]
pub mod CombatDomain {
    use crate::combat::{CombatContext, TroopsTrait};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::troops::Troops;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: starknet::ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Combat of super::ICombat<ContractState> {
        fn resolve_raid(
            self: @ContractState,
            game_id: u32,
            explorer: Troops,
            guards: Span<crate::guards::Guard>,
            biome: crate::biome::Biome,
            timestamp: u64,
        ) -> crate::raid::RaidResolution {
            let rules = self.authorized_rules(game_id, timestamp);
            crate::raid::resolve(explorer, guards, biome, rules, timestamp)
        }
        fn resolve_battle(
            self: @ContractState, game_id: u32, mut attacker: Troops, mut defender: Troops, context: CombatContext,
        ) -> (Troops, Troops) {
            let rules = self.authorized_rules(game_id, context.timestamp);
            attacker
                .attack_with_context(
                    ref defender,
                    context,
                    rules.troop_stamina_config,
                    rules.troop_damage_config,
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                    rules.tick_config.armies_tick_in_seconds,
                );
            (attacker, defender)
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn authorized_rules(self: @ContractState, game_id: u32, timestamp: u64) -> crate::rules::SliceRules {
            let peers = self.lifecycle.require_active();
            assert!(starknet::get_caller_address() == peers.troops, "only troops domain");
            crate::commands::assert_context_time(timestamp);
            IGameDispatcher { contract_address: peers.season }.rules(game_id)
        }
    }
}
