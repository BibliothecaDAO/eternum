#[starknet::contract]
pub mod CombatLogic {
    use starknet::ContractAddress;
    use crate::commands::Battle;

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
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Battle,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            crate::logic::combat::battle_guard(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
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
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            crate::logic::combat::battle(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
        }
        fn guard_attack(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::GuardAttack,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            crate::logic::combat::guard_attack(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
        }
    }
}
