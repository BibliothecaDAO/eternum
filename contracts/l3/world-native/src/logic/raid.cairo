#[starknet::contract]
pub mod RaidLogic {
    use starknet::ContractAddress;
    use crate::commands::ExecutionContext;
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
            context: ExecutionContext,
        ) {
            crate::logic::combat::raid(game_id, actor, command, context)
        }
        fn village_last_raided(self: @ContractState, key: ResourceKey) -> u64 {
            crate::logic::combat::village_last_raided(key)
        }
    }
}
