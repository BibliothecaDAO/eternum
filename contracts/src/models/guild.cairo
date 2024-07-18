use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Guild {
    #[key]
    entity_id: u128,
    is_public: bool,
    member_count: u16
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct GuildMember {
    #[key]
    address: ContractAddress,
    guild_entity_id: u128
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct GuildWhitelist {
    #[key]
    address: ContractAddress,
    #[key]
    guild_entity_id: u128,
    is_whitelisted: bool
}

#[generate_trait]
impl GuildMemberCustomImpl of GuildMemberCustomTrait {
    fn assert_has_guild(self: GuildMember) {
        assert(self.guild_entity_id != 0, 'Not member of a guild');
    }

    fn assert_has_no_guild(self: GuildMember) {
        assert(self.guild_entity_id == 0, 'Already member of a guild');
    }
}

#[generate_trait]
impl GuildWhitelistCustomImpl of GuildWhitelistCustomTrait {
    fn assert_is_whitelisted(self: GuildWhitelist) {
        assert(self.is_whitelisted == true, 'Player is not whitelisted');
    }
}
