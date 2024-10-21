use eternum::alias::ID;
use starknet::ContractAddress;

#[dojo::interface]
trait IGuildSystems {
    fn create_guild(ref world: IWorldDispatcher, is_public: bool, guild_name: felt252) -> ID;
    fn join_guild(ref world: IWorldDispatcher, guild_entity_id: ID);
    fn whitelist_player(ref world: IWorldDispatcher, player_address_to_whitelist: ContractAddress, guild_entity_id: ID);
    fn leave_guild(ref world: IWorldDispatcher);
    fn transfer_guild_ownership(ref world: IWorldDispatcher, guild_entity_id: ID, to_player_address: ContractAddress);
    fn remove_guild_member(ref world: IWorldDispatcher, player_address_to_remove: ContractAddress);
    fn remove_player_from_whitelist(
        ref world: IWorldDispatcher, player_address_to_remove: ContractAddress, guild_entity_id: ID
    );
}

#[dojo::contract]
mod guild_systems {
    use eternum::alias::ID;
    use eternum::models::event::{CreateGuild, JoinGuild};
    use eternum::models::guild::{Guild, GuildMember, GuildMemberCustomTrait, GuildWhitelist, GuildWhitelistCustomTrait};
    use eternum::models::name::AddressName;
    use eternum::models::name::EntityName;
    use eternum::models::owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::season::SeasonImpl;
    use starknet::ContractAddress;
    use starknet::contract_address::contract_address_const;

    #[abi(embed_v0)]
    impl GuildSystemsImpl of super::IGuildSystems<ContractState> {
        fn create_guild(ref world: IWorldDispatcher, is_public: bool, guild_name: felt252) -> ID {
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            get!(world, caller_address, GuildMember).assert_has_no_guild();

            assert(guild_name != 0, 'Guild name cannot be empty');

            let guild_uuid: ID = world.uuid();

            set!(
                world,
                (
                    Guild { entity_id: guild_uuid, is_public: is_public, member_count: 1 },
                    Owner { entity_id: guild_uuid, address: caller_address },
                    EntityOwner { entity_id: guild_uuid, entity_owner_id: guild_uuid },
                    EntityName { entity_id: guild_uuid, name: guild_name },
                    GuildMember { address: caller_address, guild_entity_id: guild_uuid }
                )
            );

            let timestamp = starknet::get_block_timestamp();
            emit!(world, CreateGuild { guild_entity_id: guild_uuid, timestamp },);
            emit!(world, JoinGuild { guild_entity_id: guild_uuid, address: caller_address, timestamp });

            guild_uuid
        }

        fn join_guild(ref world: IWorldDispatcher, guild_entity_id: ID) {
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            get!(world, caller_address, GuildMember).assert_has_no_guild();

            let mut guild = get!(world, guild_entity_id, Guild);

            if (!guild.is_public) {
                get!(world, (caller_address, guild_entity_id), GuildWhitelist).assert_is_whitelisted();
            }

            guild.member_count += 1;

            set!(world, (GuildMember { address: caller_address, guild_entity_id: guild_entity_id }, guild));

            emit!(
                world,
                JoinGuild { guild_entity_id, address: caller_address, timestamp: starknet::get_block_timestamp() }
            );
        }

        fn whitelist_player(
            ref world: IWorldDispatcher, player_address_to_whitelist: ContractAddress, guild_entity_id: ID
        ) {
            SeasonImpl::assert_season_is_not_over(world);

            get!(world, guild_entity_id, Owner).assert_caller_owner();

            assert((get!(world, player_address_to_whitelist, AddressName).name) != 0, 'Address given is not a player');

            set!(
                world,
                (GuildWhitelist {
                    address: player_address_to_whitelist, guild_entity_id: guild_entity_id, is_whitelisted: true
                })
            );
        }

        fn leave_guild(ref world: IWorldDispatcher) {
            SeasonImpl::assert_season_is_not_over(world);

            let caller_address = starknet::get_caller_address();

            let mut guild_member = get!(world, caller_address, GuildMember);
            guild_member.assert_has_guild();

            let mut guild_owner = get!(world, guild_member.guild_entity_id, Owner);

            let mut guild = get!(world, guild_member.guild_entity_id, Guild);

            if (guild_member.address == guild_owner.address) {
                assert(guild.member_count == 1, 'Guild not empty');

                delete!(world, (guild, guild_member, guild_owner));
            } else {
                guild.member_count -= 1;

                set!(world, (GuildMember { address: caller_address, guild_entity_id: 0 }, guild));
            }
        }

        fn transfer_guild_ownership(
            ref world: IWorldDispatcher, guild_entity_id: ID, to_player_address: ContractAddress
        ) {
            SeasonImpl::assert_season_is_not_over(world);

            get!(world, guild_entity_id, Owner).assert_caller_owner();

            let to_player_guild_member_info = get!(world, to_player_address, GuildMember);
            to_player_guild_member_info.assert_has_guild();

            assert(to_player_guild_member_info.guild_entity_id == guild_entity_id, 'Must transfer to guildmember');

            let mut guild_owner = get!(world, guild_entity_id, Owner);
            guild_owner.address = to_player_address;
            set!(world, (guild_owner));
        }

        fn remove_guild_member(ref world: IWorldDispatcher, player_address_to_remove: ContractAddress) {
            SeasonImpl::assert_season_is_not_over(world);

            let guild_entity_id = get!(world, starknet::get_caller_address(), GuildMember).guild_entity_id;
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            let mut guild_member_to_remove = get!(world, player_address_to_remove, GuildMember);
            assert(guild_member_to_remove.guild_entity_id == guild_entity_id, 'Player not guildmember');

            guild_member_to_remove.guild_entity_id = 0;

            let mut guild = get!(world, guild_entity_id, Guild);
            guild.member_count -= 1;

            set!(world, (guild_member_to_remove, guild));
        }

        fn remove_player_from_whitelist(
            ref world: IWorldDispatcher, player_address_to_remove: ContractAddress, guild_entity_id: ID
        ) {
            SeasonImpl::assert_season_is_not_over(world);

            get!(world, (player_address_to_remove, guild_entity_id), GuildWhitelist).assert_is_whitelisted();

            let caller_address = starknet::get_caller_address();
            let guild_owner = get!(world, guild_entity_id, Owner);

            assert(
                (guild_owner.address == caller_address) || (player_address_to_remove == caller_address),
                'Cannot remove from whitelist'
            );

            set!(
                world,
                (GuildWhitelist {
                    address: player_address_to_remove, guild_entity_id: guild_entity_id, is_whitelisted: false
                })
            );
        }
    }
}
