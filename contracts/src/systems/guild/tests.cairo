use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::guild::{Guild, GuildMember, GuildMemberTrait};
use eternum::models::name::EntityName;
use eternum::models::owner::Owner;
use eternum::models::position::Position;

use eternum::systems::guild::contracts::{
    guild_systems, IGuildSystems, IGuildSystemsDispatcher, IGuildSystemsDispatcherTrait
};
use eternum::systems::name::contracts::{
    name_systems, INameSystems, INameSystemsDispatcher, INameSystemsDispatcherTrait
};
use eternum::systems::realm::contracts::{
    realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait
};

use eternum::utils::testing::{spawn_eternum, deploy_system};
use starknet::contract_address_const;


fn setup() -> (IWorldDispatcher, IGuildSystemsDispatcher) {
    let world = spawn_eternum();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    world.uuid();

    let guild_systems_address = deploy_system(world, guild_systems::TEST_CLASS_HASH);
    let guild_systems_dispatcher = IGuildSystemsDispatcher {
        contract_address: guild_systems_address
    };

    let name_systems_address = deploy_system(world, name_systems::TEST_CLASS_HASH);
    let name_systems_dispatcher = INameSystemsDispatcher { contract_address: name_systems_address };

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    name_systems_dispatcher.set_address_name('Player2Name');

    (world, guild_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn test_create_guild() {
    let (world, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    let is_public = true;
    let guild_name = 'Name of guild';

    let guild_entity_id = guild_systems_dispatcher.create_guild(is_public, guild_name);

    let guild = get!(world, guild_entity_id, Guild);
    assert(guild.entity_id == guild_entity_id, 'Guild not created');
    assert(guild.is_public == is_public, 'Guild not public');

    let guild_owner = get!(world, guild_entity_id, Owner);
    assert(guild_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of guild');

    let name = get!(world, guild_entity_id, EntityName);
    assert(name.name == guild_name, 'Not correct guildname');

    let guild_member = get!(world, 'player1', GuildMember);
    assert(guild_member.guild_entity_id == guild_entity_id, 'Not member of guild');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Already member of a guild', 'ENTRYPOINT_FAILED'))]
fn test_create_multiple_guilds() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    guild_systems_dispatcher.create_guild(true, 'GuildName');

    guild_systems_dispatcher.create_guild(true, 'GuildName');
}

#[test]
#[available_gas(3000000000000)]
fn test_join_guild() {
    let (world, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    let guild_entity_id = guild_systems_dispatcher.create_guild(true, 'GuildName');

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());

    guild_systems_dispatcher.join_guild(guild_entity_id);

    let guild_member = get!(world, 'player2', GuildMember);
    assert(guild_member.guild_entity_id == guild_entity_id, 'Did not join the guild')
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Already member of a guild', 'ENTRYPOINT_FAILED'))]
fn test_join_guild_when_already_member() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    guild_systems_dispatcher.create_guild(true, 'GuildName');

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    let guild_entity_id = guild_systems_dispatcher.create_guild(true, 'GuildName');

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    guild_systems_dispatcher.join_guild(guild_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Player is not whitelisted', 'ENTRYPOINT_FAILED'))]
fn test_join_private_guild_not_whitelisted() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let guild_entity_id = guild_systems_dispatcher.create_guild(false, 'GuildName');

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    guild_systems_dispatcher.join_guild(guild_entity_id);
}

#[test]
#[available_gas(3000000000000)]
fn test_whitelist_player() {
    let (_, guild_systems_dispatcher) = setup();

    let player2_address = contract_address_const::<'player2'>();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let guild_entity_id = guild_systems_dispatcher.create_guild(false, 'GuildName');

    guild_systems_dispatcher.whitelist_player(player2_address, guild_entity_id);

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    guild_systems_dispatcher.join_guild(guild_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn test_whitelist_player_as_not_owner() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let guild_entity_id = guild_systems_dispatcher.create_guild(false, 'GuildName');

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    guild_systems_dispatcher
        .whitelist_player(contract_address_const::<'player2'>(), guild_entity_id);
}

#[test]
#[available_gas(3000000000000)]
fn test_leave_guild() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    guild_systems_dispatcher.create_guild(false, 'GuildName');

    guild_systems_dispatcher.leave_guild();
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Not member of a guild', 'ENTRYPOINT_FAILED'))]
fn test_leave_guild_not_member() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    guild_systems_dispatcher.leave_guild();
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Guild name cannot be empty', 'ENTRYPOINT_FAILED'))]
fn test_empty_guild_name() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());

    guild_systems_dispatcher.create_guild(true, '');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Address given is not a player', 'ENTRYPOINT_FAILED'))]
fn test_whitelist_wrong_address() {
    let (_, guild_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    let guild_entity_id = guild_systems_dispatcher.create_guild(true, 'GuildName');

    guild_systems_dispatcher
        .whitelist_player(contract_address_const::<'NotAPlayer'>(), guild_entity_id);
}

