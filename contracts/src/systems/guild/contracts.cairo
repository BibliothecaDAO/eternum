use eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait IGuildSystems<T> {
    fn create_guild(ref self: T, is_public: bool, guild_name: felt252) -> ID;
    fn join_guild(ref self: T, guild_entity_id: ID);
    fn whitelist_player(ref self: T, player_address_to_whitelist: ContractAddress, guild_entity_id: ID);
    fn leave_guild(ref self: T);
    fn transfer_guild_ownership(ref self: T, guild_entity_id: ID, to_player_address: ContractAddress);
    fn remove_guild_member(ref self: T, player_address_to_remove: ContractAddress);
    fn remove_player_from_whitelist(ref self: T, player_address_to_remove: ContractAddress, guild_entity_id: ID);
}

#[dojo::contract]
mod guild_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::constants::DEFAULT_NS;
    use eternum::models::guild::{Guild, GuildMember, GuildMemberCustomTrait, GuildWhitelist, GuildWhitelistCustomTrait};
    use eternum::models::name::AddressName;
    use eternum::models::name::EntityName;
    use eternum::models::owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait};

    use eternum::models::season::SeasonImpl;
    use starknet::ContractAddress;
    use starknet::contract_address::contract_address_const;

    #[abi(embed_v0)]
    impl GuildSystemsImpl of super::IGuildSystems<ContractState> {
        fn create_guild(ref self: ContractState, is_public: bool, guild_name: felt252) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            let guild_member: GuildMember = world.read_model(caller_address);
            guild_member.assert_has_no_guild();

            // Add min name length
            assert(guild_name != 0, 'Guild name cannot be empty');

            let guild_uuid: ID = world.dispatcher.uuid();

            world.write_model(@Guild { entity_id: guild_uuid, is_public: is_public, member_count: 1 });
            world.write_model(@Owner { entity_id: guild_uuid, address: caller_address });
            world.write_model(@EntityOwner { entity_id: guild_uuid, entity_owner_id: guild_uuid });
            world.write_model(@EntityName { entity_id: guild_uuid, name: guild_name });
            world.write_model(@GuildMember { address: caller_address, guild_entity_id: guild_uuid });

            guild_uuid
        }

        fn join_guild(ref self: ContractState, guild_entity_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            let guild_member: GuildMember = world.read_model(caller_address);
            guild_member.assert_has_no_guild();

            let mut guild: Guild = world.read_model(guild_entity_id);

            if (!guild.is_public) {
                let guild_whitelist: GuildWhitelist = world.read_model((caller_address, guild_entity_id));
                guild_whitelist.assert_is_whitelisted();
            }

            guild.member_count += 1;

            world.write_model(@GuildMember { address: caller_address, guild_entity_id: guild_entity_id });
            world.write_model(@guild);
        }

        fn whitelist_player(
            ref self: ContractState, player_address_to_whitelist: ContractAddress, guild_entity_id: ID
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let owner: Owner = world.read_model(guild_entity_id);
            owner.assert_caller_owner();

            let address_name: AddressName = world.read_model(player_address_to_whitelist);
            assert(address_name.name != 0, 'Address given is not a player');

            world
                .write_model(
                    @GuildWhitelist {
                        address: player_address_to_whitelist, guild_entity_id: guild_entity_id, is_whitelisted: true
                    }
                );
        }

        fn leave_guild(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            let mut guild_member: GuildMember = world.read_model(caller_address);
            guild_member.assert_has_guild();

            let mut guild_owner: Owner = world.read_model(guild_member.guild_entity_id);

            let mut guild: Guild = world.read_model(guild_member.guild_entity_id);

            if (guild_member.address == guild_owner.address) {
                assert(guild.member_count == 1, 'Guild not empty');

                guild.member_count = 0;
                guild_member.guild_entity_id = 0;

                guild_owner.address = contract_address_const::<'0x0'>();

                world.write_model(@guild);
                world.write_model(@guild_member);
                world.write_model(@guild_owner);
            } else {
                guild.member_count -= 1;

                world.write_model(@GuildMember { address: caller_address, guild_entity_id: 0 });
                world.write_model(@guild);
            }
        }

        fn transfer_guild_ownership(ref self: ContractState, guild_entity_id: ID, to_player_address: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let owner: Owner = world.read_model(guild_entity_id);
            owner.assert_caller_owner();

            let to_player_guild_member_info: GuildMember = world.read_model(to_player_address);
            to_player_guild_member_info.assert_has_guild();

            assert(to_player_guild_member_info.guild_entity_id == guild_entity_id, 'Must transfer to guildmember');

            let mut guild_owner: Owner = world.read_model(guild_entity_id);
            guild_owner.address = to_player_address;
            world.write_model(@guild_owner);
        }

        fn remove_guild_member(ref self: ContractState, player_address_to_remove: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let guild_member: GuildMember = world.read_model(starknet::get_caller_address());
            let guild_entity_id: ID = guild_member.guild_entity_id;
            let owner: Owner = world.read_model(guild_entity_id);
            owner.assert_caller_owner();

            let mut guild_member_to_remove: GuildMember = world.read_model(player_address_to_remove);
            assert(guild_member_to_remove.guild_entity_id == guild_entity_id, 'Player not guildmember');

            guild_member_to_remove.guild_entity_id = 0;

            let mut guild: Guild = world.read_model(guild_entity_id);
            guild.member_count -= 1;

            world.write_model(@guild_member_to_remove);
            world.write_model(@guild);
        }

        fn remove_player_from_whitelist(
            ref self: ContractState, player_address_to_remove: ContractAddress, guild_entity_id: ID
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let guild_whitelist: GuildWhitelist = world.read_model((player_address_to_remove, guild_entity_id));
            guild_whitelist.assert_is_whitelisted();

            let caller_address = starknet::get_caller_address();
            let guild_owner: Owner = world.read_model(guild_entity_id);

            assert(
                (guild_owner.address == caller_address) || (player_address_to_remove == caller_address),
                'Cannot remove from whitelist'
            );

            world
                .write_model(
                    @GuildWhitelist {
                        address: player_address_to_remove, guild_entity_id: guild_entity_id, is_whitelisted: false
                    }
                );
        }
    }
}
