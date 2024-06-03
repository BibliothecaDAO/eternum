use starknet::ContractAddress;

#[derive(Model, Copy, Drop, Serde)]
struct Guild {
    #[key]
    entity_id: u128,
    is_public: bool
}

#[derive(Model, Copy, Drop, Serde)]
struct GuildMember {
    #[key]
    address: ContractAddress,
    guild_entity_id: u128
}

#[derive(Model, Copy, Drop, Serde)]
struct GuildWhitelist {
    #[key]
    address: ContractAddress,
    #[key]
    guild_entity_id: u128,
    is_whitelisted: bool
}

#[generate_trait]
impl GuildMemberImpl of GuildMemberTrait {
    fn assert_has_guild(self: GuildMember) {
        assert(self.guild_entity_id != 0, 'Not member of a guild');
    }

    fn assert_has_no_guild(self: GuildMember) {
        assert(self.guild_entity_id == 0, 'Already member of a guild');
    }
}

#[generate_trait]
impl GuildWhitelistImpl of GuildWhitelistTrait {
    fn assert_is_whitelisted(self: GuildWhitelist, guild_entity_id: u128) {
        assert(self.is_whitelisted == true, 'Player is not whitelisted');
    }
}
