use starknet::ContractAddress;

#[starknet::interface]
pub trait IGuildSystems<T> {
    fn create_guild(ref self: T, public: bool, name: felt252);
    fn join_guild(ref self: T, guild_id: ContractAddress);
    fn leave_guild(ref self: T, guild_id: ContractAddress);
    fn update_whitelist(ref self: T, address: ContractAddress, whitelist: bool);
    fn update_member(ref self: T, address: ContractAddress);
}

#[dojo::contract]
pub mod guild_systems {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::SeasonConfigImpl;
    use s1_eternum::models::guild::{Guild, GuildMember, GuildWhitelist};
    use s1_eternum::models::name::AddressName;
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl GuildSystemsImpl of super::IGuildSystems<ContractState> {
        fn create_guild(ref self: ContractState, public: bool, name: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure guild name is set
            assert!(name.is_non_zero(), "guild name must be set");

            // ensure caller is/was a game player
            let caller_address = starknet::get_caller_address();
            let caller_name: AddressName = world.read_model(caller_address);
            assert!(caller_name.name.is_non_zero(), "No AddressName set for guild creator");

            // ensure caller doesnt own a guild
            let mut guild: Guild = world.read_model(caller_address);
            assert!(guild.member_count.is_zero(), "guild already exists");

            // create guild
            guild.member_count = 1;
            guild.public = public;
            world.write_model(@guild);
            world.write_model(@GuildMember { member: caller_address, guild_id: caller_address });
        }

        fn join_guild(ref self: ContractState, guild_id: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let caller_address = starknet::get_caller_address();
            let mut guild_member: GuildMember = world.read_model(caller_address);

            // remove player from existing guild
            if guild_member.guild_id.is_non_zero() {
                let mut old_guild: Guild = world.read_model(guild_member.guild_id);
                old_guild.member_count -= 1;
                if old_guild.member_count.is_zero() {
                    world.erase_model(@old_guild);
                } else {
                    world.write_model(@old_guild);
                }
            }

            // ensure new guild exists
            let mut new_guild: Guild = world.read_model(guild_id);
            assert!(new_guild.member_count.is_non_zero(), "guild does not exist");

            // ensure player has permission to join guild
            if (!new_guild.public) {
                let guild_whitelist: GuildWhitelist = world.read_model((guild_id, caller_address));
                assert!(guild_whitelist.whitelisted, "you are not whitelisted to join this guild");
            }

            // join the new guild
            new_guild.member_count += 1;
            guild_member.guild_id = guild_id;
            world.write_model(@new_guild);
            world.write_model(@guild_member);
        }

        fn leave_guild(ref self: ContractState, guild_id: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let caller_address = starknet::get_caller_address();
            let mut guild_member: GuildMember = world.read_model(caller_address);

            // remove player from existing guild
            assert!(guild_member.guild_id.is_non_zero(), "you are not a member of any guild");

            let mut guild: Guild = world.read_model(guild_member.guild_id);
            guild.member_count -= 1;
            if guild.member_count.is_zero() {
                world.erase_model(@guild);
            } else {
                world.write_model(@guild);
            }
        }


        fn update_whitelist(ref self: ContractState, address: ContractAddress, whitelist: bool) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure guild exists
            let caller_address = starknet::get_caller_address();
            let mut guild: Guild = world.read_model(caller_address);
            assert!(guild.member_count.is_non_zero(), "guild does not exist");

            let whitelisted_player_name: AddressName = world.read_model(address);
            assert(whitelisted_player_name.name.is_non_zero(), 'Address given is not a player');

            world.write_model(@GuildWhitelist { guild_id: caller_address, address, whitelisted: whitelist });
        }

        fn update_member(ref self: ContractState, address: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure address is a member of caller's guild
            let caller_address = starknet::get_caller_address();
            let mut guild_member: GuildMember = world.read_model(address);
            assert!(guild_member.guild_id == caller_address, "address not a member of your guild");

            // remove the address from caller's guild
            world.erase_model(@guild_member);

            let mut guild: Guild = world.read_model(caller_address);
            guild.member_count -= 1;
            if guild.member_count.is_zero() {
                world.erase_model(@guild);
            } else {
                world.write_model(@guild);
            }
        }
    }
}
