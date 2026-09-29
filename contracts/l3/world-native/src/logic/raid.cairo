#[starknet::contract]
pub mod RaidLogic {
    use starknet::ContractAddress;
    use crate::resources::ResourceKey;

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
    impl Raids of crate::combat_actions::IRaids<ContractState> {
        fn raid(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::Raid,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            crate::logic::combat::raid(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
        }
        fn village_last_raided(self: @ContractState, key: ResourceKey) -> u64 {
            crate::logic::combat::village_last_raided(key)
        }
    }
}
