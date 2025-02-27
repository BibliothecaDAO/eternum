use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Guild {
    #[key]
    pub entity_id: ID,
    pub is_public: bool,
    pub member_count: u16,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildMember {
    #[key]
    pub address: ContractAddress,
    pub guild_entity_id: ID,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildWhitelist {
    #[key]
    pub address: ContractAddress,
    #[key]
    pub guild_entity_id: ID,
    pub is_whitelisted: bool,
}

#[generate_trait]
pub impl GuildMemberImpl of GuildMemberTrait {
    fn assert_has_guild(self: GuildMember) {
        assert(self.guild_entity_id != 0, 'Not member of a guild');
    }

    fn assert_has_no_guild(self: GuildMember) {
        assert(self.guild_entity_id == 0, 'Already member of a guild');
    }
}

#[generate_trait]
pub impl GuildWhitelistImpl of GuildWhitelistTrait {
    fn assert_is_whitelisted(self: GuildWhitelist) {
        assert(self.is_whitelisted == true, 'Player is not whitelisted');
    }
}
