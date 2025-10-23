// use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};

// use crate::models::guild::{Guild, GuildMember, GuildMemberTrait, GuildWhitelist, GuildWhitelistTrait};
// use crate::models::name::AddressName;
// use crate::models::owner::Owner;
// use crate::models::position::Position;

// use crate::systems::guild::contracts::{
//     IGuildSystems, IGuildSystemsDispatcher, IGuildSystemsDispatcherTrait, guild_systems,
// };
// use crate::systems::name::contracts::{
//     INameSystems, INameSystemsDispatcher, INameSystemsDispatcherTrait, name_systems,
// };

// use crate::utils::testing::{systems::deploy_system, world::spawn_eternum};
// use starknet::contract_address_const;

// const PUBLIC: felt252 = 1;
// const PRIVATE: felt252 = 0;
// const GUILD_NAME: felt252 = 'Guildname';

// fn felt_to_bool(value: felt252) -> bool {
//     if (value == 1) {
//         return true;
//     }
//     return false;
// }

// fn setup() -> (WorldStorage, IGuildSystemsDispatcher) {
//     let mut world = spawn_eternum();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     world.dispatcher.uuid();

//     let guild_systems_address = deploy_system(ref world, "guild_systems");
//     let guild_systems_dispatcher = IGuildSystemsDispatcher { contract_address: guild_systems_address };

//     let name_systems_address = deploy_system(ref world, "name_systems");
//     let name_systems_dispatcher = INameSystemsDispatcher { contract_address: name_systems_address };

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     name_systems_dispatcher.set_address_name('Player2Name');

//     (world, guild_systems_dispatcher)
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_create_guild() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     let guild: Guild = world.read_model(guild_entity_id);
//     assert(guild.entity_id == guild_entity_id, 'Guild not created');
//     assert(guild.is_public == felt_to_bool(PUBLIC), 'Guild not public');
//     assert(guild.member_count == 1, 'Member count incorrect');

//     let guild_owner: Owner = world.read_model(guild_entity_id);
//     assert(guild_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of guild');

//     let guild_name: AddressName = world.read_model(guild_entity_id);
//     assert(guild_name.name == GUILD_NAME, 'Not correct guildname');

//     let guild_member: GuildMember = world.read_model('player1');
//     assert(guild_member.guild_entity_id == guild_entity_id, 'Not member of guild');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Already member of a guild', 'ENTRYPOINT_FAILED'))]
// fn guild_test_create_multiple_guilds() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_join_guild() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());

//     guild_systems_dispatcher.join_guild(guild_entity_id);

//     let guild_member: GuildMember = world.read_model('player2');
//     assert(guild_member.guild_entity_id == guild_entity_id, 'Did not join the guild');

//     let guild: Guild = world.read_model(guild_entity_id);
//     assert(guild.member_count == 2, 'Member count incorrect');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Already member of a guild', 'ENTRYPOINT_FAILED'))]
// fn guild_test_join_guild_when_already_member() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Player is not whitelisted', 'ENTRYPOINT_FAILED'))]
// fn guild_test_join_private_guild_not_whitelisted() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_whitelist_player() {
//     let (_, guild_systems_dispatcher) = setup();

//     let player2_address = contract_address_const::<'player2'>();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.whitelist_player(player2_address, guild_entity_id);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
// fn guild_test_whitelist_player_as_not_owner() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.whitelist_player(contract_address_const::<'player2'>(), guild_entity_id);
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_leave_guild() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);

//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player2'>());

//     let guild: Guild = world.read_model(guild_entity_id);
//     assert(guild.member_count == 1, 'Member count incorrect');
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_leave_guild_as_owner() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player1'>());

//     let guild_owner: Owner = world.read_model(guild_entity_id);
//     assert(guild_owner.address != contract_address_const::<'player1'>(), 'Wrong guild owner');
// }
// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Guild not empty', 'ENTRYPOINT_FAILED'))]
// fn guild_test_leave_guild_with_members_as_owner() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player1'>());
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Not member of a guild', 'ENTRYPOINT_FAILED'))]
// fn guild_test_leave_guild_not_member() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player1'>());
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Guild name cannot be empty', 'ENTRYPOINT_FAILED'))]
// fn guild_test_empty_guild_name() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), '');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Address given is not a player', 'ENTRYPOINT_FAILED'))]
// fn guild_test_whitelist_wrong_address() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     guild_systems_dispatcher.whitelist_player(contract_address_const::<'NotAPlayer'>(), guild_entity_id);
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_transfer_guild_ownership() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.transfer_guild_ownership(guild_entity_id, contract_address_const::<'player2'>());

//     let guild_owner: Owner = world.read_model(guild_entity_id);

//     assert(guild_owner.address == contract_address_const::<'player2'>(), 'Guild transfer failed');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Must transfer to guildmember', 'ENTRYPOINT_FAILED'))]
// fn guild_test_transfer_guild_ownership_not_guild_member() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.transfer_guild_ownership(guild_entity_id, contract_address_const::<'player2'>());
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_remove_guild_member() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.join_guild(guild_entity_id);

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player2'>());
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Not member of a guild', 'ENTRYPOINT_FAILED'))]
// fn guild_test_remove_guild_member_not_guild_member() {
//     let (_, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     guild_systems_dispatcher.create_guild(felt_to_bool(PUBLIC), GUILD_NAME);

//     guild_systems_dispatcher.remove_guild_member(contract_address_const::<'player2'>());
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_remove_self_from_whitelist() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.whitelist_player(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == true, 'Whitelisted not removed');

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player2'>());
//     guild_systems_dispatcher.remove_player_from_whitelist(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == false, 'Whitelisted not removed');
// }

// #[test]
// #[available_gas(3000000000000)]
// fn guild_test_remove_from_whitelist_as_owner() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.whitelist_player(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == true, 'Whitelisted not removed');

//     guild_systems_dispatcher.remove_player_from_whitelist(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == false, 'Whitelisted not removed');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Player is not whitelisted', 'ENTRYPOINT_FAILED'))]
// fn guild_test_remove_from_whitelist_not_whitelisted() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.remove_player_from_whitelist(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == false, 'Whitelisted not removed');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('Cannot remove from whitelist', 'ENTRYPOINT_FAILED'))]
// fn guild_test_remove_from_whitelist_as_random() {
//     let (mut world, guild_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     let guild_entity_id = guild_systems_dispatcher.create_guild(felt_to_bool(PRIVATE), GUILD_NAME);

//     guild_systems_dispatcher.whitelist_player(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == true, 'Whitelisted not removed');

//     starknet::testing::set_contract_address(contract_address_const::<'player3'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player3'>());

//     guild_systems_dispatcher.remove_player_from_whitelist(contract_address_const::<'player2'>(), guild_entity_id);
//     let guild_whitelist: GuildWhitelist = world.read_model((contract_address_const::<'player2'>(), guild_entity_id));
//     assert(guild_whitelist.is_whitelisted == false, 'Whitelisted not removed');
// }
