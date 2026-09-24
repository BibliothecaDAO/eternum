#[starknet::contract]
pub mod CombatLogic {
    use starknet::ContractAddress;
    use crate::commands::{Battle, ExecutionContext};

    #[storage]
    struct Storage {
        #[flat]
        data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        BattleEvent: crate::troops::BattleEvent,
        RaidEvent: crate::combat_actions::RaidEvent,
        OwnershipRow: crate::events::RowSet,
    }
    #[abi(embed_v0)]
    impl GuardCombat of crate::guards::IGuardCombat<ContractState> {
        fn battle_guard(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext,
        ) {
            crate::logic::combat::battle_guard(game_id, actor, command, context)
        }
    }
    #[abi(embed_v0)]
    impl Battles of crate::combat_actions::IBattles<ContractState> {
        fn battle(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::AttackExplorer,
            context: ExecutionContext,
        ) {
            crate::logic::combat::battle(game_id, actor, command, context)
        }
        fn guard_attack(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::GuardAttack,
            context: ExecutionContext,
        ) {
            crate::logic::combat::guard_attack(game_id, actor, command, context)
        }
    }
}
