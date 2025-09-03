use starknet::ContractAddress;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Guild {
    #[key]
    pub guild_id: ContractAddress,
    pub public: bool,
    pub name: felt252,
    pub member_count: u16,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildMember {
    #[key]
    pub member: ContractAddress,
    pub guild_id: ContractAddress,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildWhitelist {
    #[key]
    pub guild_id: ContractAddress,
    #[key]
    pub address: ContractAddress,
    pub whitelisted: bool,
}
