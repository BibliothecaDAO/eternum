#[dojo::contract]
mod guild_systems{
    use starknet::ContractAddress;
    use eternum::systems::guild::interface::IGuildSystems;
    use eternum::models::guild::Guild;
    #[external(v0)]
    impl GuildSystemsImpl of IGuildSystems<ContractState> {
        fn create_guild(self: @ContractState,world: IWorldDispatcher, guild_id: ContractAddress){
            set!(world, Guild{
                entity_id: world.uuid(),
                guild_id: guild_id
            })
        }
    }
}