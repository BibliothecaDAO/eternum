#[starknet::contract]
pub mod CombatLogic {
    use starknet::ContractAddress;
    use crate::commands::Battle;

    use crate::logic::deep_sites::DeepSites;
    component!(path: DeepSites, storage: deep_sites, event: DeepSiteEvent);
    #[abi(embed_v0)]
    impl Sites = DeepSites::DeepSitesImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        deep_sites: DeepSites::Storage,
        #[flat]
        data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DeepSiteEvent: DeepSites::Event,
        BattleEvent: crate::troops::BattleEvent,
        OwnershipRow: crate::events::RowSet,
    }
    #[abi(embed_v0)]
    impl GuardCombat of crate::guards::IGuardCombat<ContractState> {
        fn battle_guard(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Battle,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            crate::logic::combat::battle_guard(game_id, actor, command, context);
            ()
        }
    }
    #[abi(embed_v0)]
    impl Battles of crate::combat_actions::IBattles<ContractState> {
        fn battle(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::AttackExplorer,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            crate::logic::combat::battle(game_id, actor, command, context);
            ()
        }
        fn guard_attack(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::GuardAttack,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            crate::logic::combat::guard_attack(game_id, actor, command, context);
            ()
        }
    }
}
