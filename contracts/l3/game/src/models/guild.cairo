use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Guild {
    #[key]
    pub game_id: u32,
    #[key]
    pub guild_id: ContractAddress,
    pub public: bool,
    pub name: felt252,
    pub member_count: u16,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildMember {
    #[key]
    pub game_id: u32,
    #[key]
    pub member: ContractAddress,
    pub guild_id: ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildWhitelist {
    #[key]
    pub game_id: u32,
    #[key]
    pub guild_id: ContractAddress,
    #[key]
    pub address: ContractAddress,
    pub whitelisted: bool,
}
