use starknet::ContractAddress;

#[dojo::interface]
trait IGuildSystems {
    fn create_guild(ref world: IWorldDispatcher, is_public: bool, guild_name: felt252) -> u128;
    fn join_guild(ref world: IWorldDispatcher, guild_entity_id: u128);
    fn whitelist_player(
        ref world: IWorldDispatcher,
        player_address_to_whitelist: ContractAddress,
        guild_entity_id: u128
    );
    fn leave_guild(ref world: IWorldDispatcher);
    fn transfer_guild_ownership(
        ref world: IWorldDispatcher, guild_entity_id: u128, to_player_address: ContractAddress
    );
    fn remove_guild_member(ref world: IWorldDispatcher, player_address_to_remove: ContractAddress);
    fn remove_player_from_whitelist(
        ref world: IWorldDispatcher,
        player_address_to_remove: ContractAddress,
        guild_entity_id: u128
    );
    fn change_guild_access(ref world: IWorldDispatcher, guild_entity_id: u128, is_public: bool);
}

#[dojo::contract]
mod guild_systems {
    use eternum::constants::GUILD_POPULATION_CONFIG_ID;
    use eternum::models::guild::{
        Guild, GuildMember, GuildMemberTrait, GuildWhitelist, GuildWhitelistTrait
    };
    use eternum::models::name::AddressName;
    use eternum::models::name::EntityName;
    use eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};
    use eternum::models::population::{Population, PopulationTrait};
    use starknet::ContractAddress;
    use starknet::contract_address::contract_address_const;
    use eternum::models::config::GuildPopulationConfig;

    #[abi(embed_v0)]
    impl GuildSystemsImpl of super::IGuildSystems<ContractState> {
        fn create_guild(ref world: IWorldDispatcher, is_public: bool, guild_name: felt252) -> u128 {
            let caller_address = starknet::get_caller_address();

            get!(world, caller_address, GuildMember).assert_has_no_guild();

            assert(guild_name != 0, 'Guild name cannot be empty');

            let guild_uuid: u128 = world.uuid().into();

            let current_ts = starknet::get_block_timestamp();

            let guild_population_config = get!(
                world, GUILD_POPULATION_CONFIG_ID, GuildPopulationConfig
            );

            set!(
                world,
                (
                    Guild {
                        entity_id: guild_uuid,
                        is_public: is_public,
                        creation_ts: current_ts
                    },
                    Owner { entity_id: guild_uuid, address: caller_address },
                    EntityOwner { entity_id: guild_uuid, entity_owner_id: guild_uuid },
                    EntityName { entity_id: guild_uuid, name: guild_name },
                    GuildMember {
                        address: caller_address, guild_entity_id: guild_uuid, join_ts: current_ts
                    },
                    Population {
                        entity_id: guild_uuid,
                        population: 1,
                        capacity: guild_population_config.base_population
                    }
                )
            );

            guild_uuid
        }

        fn join_guild(ref world: IWorldDispatcher, guild_entity_id: u128) {
            let caller_address = starknet::get_caller_address();

            get!(world, caller_address, GuildMember).assert_has_no_guild();

            let guild = get!(world, guild_entity_id, Guild);

            if (!guild.is_public) {
                get!(world, (caller_address, guild_entity_id), GuildWhitelist)
                    .assert_is_whitelisted();
            }

            let mut population = get!(world, guild_entity_id, Population);
            let guild_population_config = get!(
                world, GUILD_POPULATION_CONFIG_ID, GuildPopulationConfig
            );

            population.increase_population(1, guild_population_config.base_population);

            let current_ts = starknet::get_block_timestamp();

            set!(
                world,
                (
                    GuildMember {
                        address: caller_address,
                        guild_entity_id: guild_entity_id,
                        join_ts: current_ts
                    },
                    population
                )
            );
        }

        fn whitelist_player(
            ref world: IWorldDispatcher,
            player_address_to_whitelist: ContractAddress,
            guild_entity_id: u128
        ) {
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            assert(
                (get!(world, player_address_to_whitelist, AddressName).name) != 0,
                'Address given is not a player'
            );

            set!(
                world,
                (GuildWhitelist {
                    address: player_address_to_whitelist,
                    guild_entity_id: guild_entity_id,
                    is_whitelisted: true
                })
            );
        }

        fn leave_guild(ref world: IWorldDispatcher) {
            let caller_address = starknet::get_caller_address();

            let mut guild_member = get!(world, caller_address, GuildMember);
            
            guild_member.assert_has_guild();

            let mut guild_owner = get!(world, guild_member.guild_entity_id, Owner);

            let mut population = get!(world, guild_member.guild_entity_id, Population);

            if (guild_member.address == guild_owner.address) {
                assert(population.population == 1, 'Guild not empty');

                population.decrease_population(1);
                
                guild_member.guild_entity_id = 0;
                guild_member.join_ts = 0;

                guild_owner.address = contract_address_const::<'0x0'>();

                set!(world, (guild_member, guild_owner, population));
            } else {
                population.decrease_population(1);

                set!(
                    world,
                    (
                        GuildMember { address: caller_address, guild_entity_id: 0, join_ts: 0 },
                        population
                    )
                );
            }
        }

        fn transfer_guild_ownership(
            ref world: IWorldDispatcher, guild_entity_id: u128, to_player_address: ContractAddress
        ) {
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            let to_player_guild_member_info = get!(world, to_player_address, GuildMember);
            to_player_guild_member_info.assert_has_guild();

            assert(
                to_player_guild_member_info.guild_entity_id == guild_entity_id,
                'Must transfer to guildmember'
            );

            let mut guild_owner = get!(world, guild_entity_id, Owner);
            guild_owner.address = to_player_address;
            set!(world, (guild_owner));
        }

        fn remove_guild_member(
            ref world: IWorldDispatcher, player_address_to_remove: ContractAddress
        ) {
            let guild_entity_id = get!(world, starknet::get_caller_address(), GuildMember)
                .guild_entity_id;
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            let mut guild_member_to_remove = get!(world, player_address_to_remove, GuildMember);
            assert(
                guild_member_to_remove.guild_entity_id == guild_entity_id, 'Player not guildmember'
            );

            guild_member_to_remove.guild_entity_id = 0;

            let mut population = get!(world, guild_entity_id, Population);
            population.decrease_population(1);

            set!(world, (guild_member_to_remove, population));
        }

        fn remove_player_from_whitelist(
            ref world: IWorldDispatcher,
            player_address_to_remove: ContractAddress,
            guild_entity_id: u128
        ) {
            get!(world, (player_address_to_remove, guild_entity_id), GuildWhitelist)
                .assert_is_whitelisted();

            let caller_address = starknet::get_caller_address();
            let guild_owner = get!(world, guild_entity_id, Owner);

            assert(
                (guild_owner.address == caller_address)
                    || (player_address_to_remove == caller_address),
                'Cannot remove from whitelist'
            );

            set!(
                world,
                (GuildWhitelist {
                    address: player_address_to_remove,
                    guild_entity_id: guild_entity_id,
                    is_whitelisted: false
                })
            );
        }

        fn change_guild_access(ref world: IWorldDispatcher, guild_entity_id: u128, is_public: bool) {
            get!(world, guild_entity_id, Owner).assert_caller_owner();

            let mut guild = get!(world, guild_entity_id, Guild);
            guild.is_public = is_public;

            set!(world, (guild));
        }
    }
}
