use s0_eternum::alias::ID;
use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Guild {
    #[key]
    entity_id: ID,
    is_public: bool,
    member_count: u16
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildMember {
    #[key]
    address: ContractAddress,
    guild_entity_id: ID
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuildWhitelist {
    #[key]
    address: ContractAddress,
    #[key]
    guild_entity_id: ID,
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
    fn assert_is_whitelisted(self: GuildWhitelist) {
        assert(self.is_whitelisted == true, 'Player is not whitelisted');
    }
}
