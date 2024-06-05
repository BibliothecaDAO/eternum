use starknet::ContractAddress;

#[dojo::interface]
trait IGuildSystems {
    fn create_guild(is_public: bool, guild_name: felt252) -> u128;
    fn join_guild(guild_entity_id: u128);
    fn leave_guild();
    fn whitelist_player(player_address: ContractAddress, guild_entity_id: u128);
}

#[dojo::contract]
mod guild_systems {
    use eternum::models::guild::{
        Guild, GuildMember, GuildMemberTrait, GuildWhitelist, GuildWhitelistTrait
    };
    use eternum::models::name::AddressName;
    use eternum::models::name::EntityName;
    use eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl GuildSystemsImpl of super::IGuildSystems<ContractState> {
        fn create_guild(world: IWorldDispatcher, is_public: bool, guild_name: felt252) -> u128 {
            let player_address = starknet::get_caller_address();

            get!(world, player_address, GuildMember).assert_has_no_guild();

            // Add min name length
            assert(guild_name != 0, 'Guild name cannot be empty');

            let guild_uuid: u128 = world.uuid().into();

            set!(
                world,
                (
                    Guild { entity_id: guild_uuid, is_public: is_public },
                    Owner { entity_id: guild_uuid, address: player_address },
                    EntityOwner { entity_id: guild_uuid, entity_owner_id: guild_uuid },
                    EntityName { entity_id: guild_uuid, name: guild_name },
                    GuildMember { address: player_address, guild_entity_id: guild_uuid }
                )
            );

            guild_uuid
        }

        fn join_guild(world: IWorldDispatcher, guild_entity_id: u128) {
            let player_address = starknet::get_caller_address();

            get!(world, player_address, GuildMember).assert_has_no_guild();

            let guild = get!(world, guild_entity_id, Guild);

            if (!guild.is_public) {
                get!(world, (player_address, guild_entity_id), GuildWhitelist)
                    .assert_is_whitelisted(guild_entity_id);
            }

            set!(
                world, (GuildMember { address: player_address, guild_entity_id: guild_entity_id })
            );
        }

        fn whitelist_player(
            world: IWorldDispatcher, player_address: ContractAddress, guild_entity_id: u128
        ) {
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            assert(
                (get!(world, player_address, AddressName).name) != 0,
                'Address given is not a player'
            );

            set!(
                world,
                (GuildWhitelist {
                    address: player_address, guild_entity_id: guild_entity_id, is_whitelisted: true
                })
            );
        }

        fn leave_guild(world: IWorldDispatcher) {
            let player_address = starknet::get_caller_address();

            get!(world, player_address, GuildMember).assert_has_guild();

            // Assert is not owner
            // Add assign_new_guild_owner contract

            set!(world, (GuildMember { address: player_address, guild_entity_id: 0 }));
        }
    }
}
