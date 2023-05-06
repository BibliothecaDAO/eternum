#[system]
mod Settle {
    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use debug::PrintTrait;

    use eternum::utils::unpack::unpack_resource_ids;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::interfaces::IERC721Dispatcher;
    use eternum::interfaces::IERC721DispatcherTrait;
    use eternum::erc721::erc721::RealmData;
    use eternum::erc721::erc721::Position;
    use eternum::components::owner::Owner;
    use eternum::components::realm::Realm;
    use eternum::components::resources::Resource;
    use eternum::components::age::Age;
    use eternum::components::config::WorldConfig;

    fn execute(realm_id: felt252) { // get the ERC721 contract
        // get the owner
        let config = commands::<WorldConfig>::entity(WORLD_CONFIG_ID.into());
        let token = config.realm_l2_contract;
        let owner = commands::<Owner>::entity((token, realm_id).into());
        // TODO: wait for set_account_contract_address to be available
        // let caller = starknet::get_tx_info().unbox().account_contract_address;
        let caller = starknet::get_caller_address();
        // TODO: withdraw gas error with assert 
        // assert(owner.address == caller, 'Only owner can settle');
        // get the metadata
        let erc721 = IERC721Dispatcher { contract_address: token };
        let realm_data: RealmData = erc721.fetch_realm_data(realm_id);
        let position: Position = erc721.realm_position(realm_id);
        // create Realm Metadata
        let realm_query: Query = realm_id.into();
        commands::set_entity(
            realm_query,
            (
                Position {
                    x: position.x, y: position.y, 
                    }, Realm {
                    realm_id: realm_id,
                    owner: owner.address,
                    resource_ids_packed: realm_data.resource_ids_packed,
                    resource_ids_count: realm_data.resource_ids_count,
                    cities: realm_data.cities,
                    harbors: realm_data.harbors,
                    rivers: realm_data.rivers,
                    regions: realm_data.regions,
                    wonder: realm_data.wonder,
                    order: realm_data.order,
                    }, Owner {
                    address: owner.address, 
                    }, Age {
                    born_timestamp: starknet::get_block_timestamp(), 
                }
            )
        );
        // mint base resources for the realm
        let resource_ids: Array<u8> = unpack_resource_ids(
            realm_data.resource_ids_packed, realm_data.resource_ids_count
        );
        let mut index = 0_usize;
        loop {
            if index == realm_data.resource_ids_count.into() {
                break ();
            };
            let resource_id: u8 = *resource_ids[index];
            let resource_id_felt: felt252 = resource_id.into();
            let resource_query: Query = (realm_id, resource_id_felt).into();
            commands::<Resource>::set_entity(
                resource_query,
                (Resource { id: resource_id, balance: config.base_resources_per_day,  })
            );
            index += 1;
        };

        // transfer Realm ERC721 to world contract
        erc721.transfer_from(owner.address, world_address, realm_id, );
    }
}

// TODO: allow delete_entity in dojo first
// #[system]
// mod Unsettle {
//     use traits::Into;
//     use traits::TryInto;
//     use debug::PrintTrait;

//     use eternum::utils::unpack::unpack_resource_ids;
//     use eternum::constants::WORLD_CONFIG_ID;
//     use eternum::interfaces::IERC721Dispatcher;
//     use eternum::interfaces::IERC721DispatcherTrait;
//     use eternum::erc721::erc721::RealmData;
//     use eternum::erc721::erc721::Position;
//     use eternum::components::owner::Owner;
//     use eternum::components::realm::Realm;
//     use eternum::components::resources::Resource;
//     use eternum::components::age::Age;
//     use eternum::components::config::WorldConfig;

//     fn execute(realm_id: felt252) {
//         // get the ERC721 contract
//         let config = commands::<WorldConfig>::entity(WORLD_CONFIG_ID.into());
//         let token = config.realm_l2_contract;

//         // get the owner
//         let realm_query: Query = realm_id.into();
//         let owner = commands::<Owner>::entity(realm_query);
//         // TODO: wait for set_account_contract_address to be available
//         // let caller = starknet::get_tx_info().unbox().account_contract_address;
//         let caller = get_caller_address();
//         // assert caller is owner
//         // TODO: how to retrieve caller address ? Since it's world contract that calls this
//         // assert(owner.address == caller, 'Only owner can settle');

//         // transfer back nft from world to owner
//         IERC721Dispatcher { contract_address: token }.transfer_from(
//             world_address,
//             owner.address,
//             realm_id,
//         );

//         // delete entity
//         let world = IWorldDispatcher {contract_address: world_address};
//         world.delete_entity('Owner'.into(), realm_query);
//         world.delete_entity('Position'.into(), realm_query);
//         world.delete_entity('Realm'.into(), realm_query);
//         world.delete_entity('Age'.into(), realm_query);
//         // TODO: should delete resources ?
//     }
// }

mod tests {
    use starknet::syscalls::deploy_syscall;
    use starknet::testing::set_caller_address;
    use starknet::class_hash::Felt252TryIntoClassHash;
    use core::traits::Into;
    use core::traits::TryInto;
    use array::ArrayTrait;
    use option::OptionTrait;
    use core::result::ResultTrait;
    use array::SpanTrait;
    use debug::PrintTrait;

    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::test_utils::spawn_test_world;
    use dojo_core::storage::query::Query;
    use dojo_core::storage::query::QueryTrait;

    use eternum::erc721::erc721::Position;
    use eternum::erc721::erc721::RealmData;
    use eternum::erc721::erc721::ERC721;
    use eternum::interfaces::IERC721Dispatcher;
    use eternum::interfaces::IERC721DispatcherTrait;

    // components
    use eternum::erc721::components::TokenApprovalComponent;
    use eternum::erc721::components::BalanceComponent;
    // use eternum::erc721::components::OwnerComponent;
    use eternum::components::owner::OwnerComponent;
    use eternum::components::realm::RealmComponent;
    use eternum::components::position::PositionComponent;
    use eternum::components::config::WorldConfigComponent;
    use eternum::components::resources::ResourceComponent;
    use eternum::components::age::AgeComponent;
    // systems
    use eternum::erc721::systems::ERC721ApproveSystem;
    use eternum::erc721::systems::ERC721TransferFromSystem;
    use eternum::erc721::systems::ERC721MintSystem;
    use eternum::systems::settling::SettleSystem;
    // TODO: allow delete_entity in dojo first
    // use eternum::systems::settling::UnsettleSystem;
    use eternum::systems::world_config::WorldConfigSystem;

    #[test]
    #[available_gas(30000000)]
    fn test_settle_unsettle_realm() {
        // components
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(TokenApprovalComponent::TEST_CLASS_HASH);
        components.append(BalanceComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(PositionComponent::TEST_CLASS_HASH);
        components.append(WorldConfigComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(AgeComponent::TEST_CLASS_HASH);
        // systems
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(ERC721ApproveSystem::TEST_CLASS_HASH);
        systems.append(ERC721TransferFromSystem::TEST_CLASS_HASH);
        systems.append(ERC721MintSystem::TEST_CLASS_HASH);
        systems.append(SettleSystem::TEST_CLASS_HASH);
        // TODO: allow delete_entity in dojo first
        // systems.append(UnsettleSystem::TEST_CLASS_HASH);
        systems.append(WorldConfigSystem::TEST_CLASS_HASH);

        // deploy executor, world and register components/systems
        let world = spawn_test_world(components, systems);

        let mut constructor_calldata = array::ArrayTrait::<felt252>::new();
        constructor_calldata.append(world.contract_address.into());
        constructor_calldata.append('realm');
        constructor_calldata.append('REALM');
        // deploy ERC721 contract
        let (erc721_address, _) = deploy_syscall(
            ERC721::TEST_CLASS_HASH.try_into().unwrap(), 0, constructor_calldata.span(), false
        ).unwrap();
        let erc721 = IERC721Dispatcher { contract_address: erc721_address };

        // add when available in latest release
        // starknet::testing::set_account_contract_address(starknet::contract_address_const::<0x420>());
        starknet::testing::set_caller_address(starknet::contract_address_const::<0x420>());
        let caller = starknet::get_caller_address();

        // mint token
        erc721.mint(caller);
        let erc721_address_felt: felt252 = erc721_address.into();

        // set realm data
        let position = Position { x: 10000, y: 10000 };
        erc721.set_realm_data(1, 40564819207303341694527483217926_u128, 'Stolsli'.into(), position);

        let realm_data: RealmData = erc721.fetch_realm_data(1);
        assert(realm_data.realm_id == 1, 'Wrong realm id');
        assert(realm_data.resource_ids_packed == 770, 'Wrong resource_ids_packed');
        assert(realm_data.resource_ids_count == 2, 'Wrong resource_ids_count');
        assert(realm_data.cities == 8, 'Wrong cities');
        assert(realm_data.harbors == 17, 'Wrong harbors');
        assert(realm_data.rivers == 26, 'Wrong rivers');
        assert(realm_data.regions == 6, 'Wrong regions');
        assert(realm_data.wonder == 2, 'Wrong wonder');
        assert(realm_data.order == 0, 'Wrong order');
        let position: Position = erc721.realm_position(1);
        assert(position.x == 10000, 'Wrong position x');
        assert(position.y == 10000, 'Wrong position y');

        // set world config
        let mut world_config_call_data = array::ArrayTrait::<felt252>::new();
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(252000000000000000000);
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(0);
        world_config_call_data.append(erc721_address_felt);

        world.execute('WorldConfig'.into(), world_config_call_data.span());

        // set timestamp to someting other than 0
        starknet::testing::set_block_timestamp(10000);

        // settle
        let mut settle_call_data = array::ArrayTrait::<felt252>::new();
        settle_call_data.append(1);
        world.execute('Settle'.into(), settle_call_data.span());

        // assert not owner of the nft anymore
        let new_erc721_owner = world.entity(
            'Owner'.into(), (erc721_address_felt, 1).into(), 0_u8, 0_usize
        );
        assert(*new_erc721_owner[0] == world.contract_address.into(), 'wrong erc721 owner');

        // assert settled realm
        let token: felt252 = erc721_address.into();
        let realm_query: Query = 1.into();
        // position
        // let position = world.entity('Position'.into(), realm_query, 0_u8, 0_usize);
        // assert(*position[0] == 10000, 'failed position x');
        // assert(*position[1] == 10000, 'failed position y');
        // owner
        let owner = world.entity('Owner'.into(), realm_query, 0_u8, 0_usize);
        assert(*owner[0] == caller.into(), 'failed owner');
        let s_realm_data = world.entity('Realm'.into(), realm_query, 0_u8, 0_usize);
        assert(*s_realm_data[0] == 1, 'failed realm id');
        assert(*s_realm_data[1] == caller.into(), 'failed realm owner');
        assert(*s_realm_data[2] == 770, 'failed resource_ids_packed');
        assert(*s_realm_data[3] == 2, 'failed resource_ids_count');
        assert(*s_realm_data[4] == 8, 'failed cities');
        assert(*s_realm_data[5] == 17, 'failed harbors');
        assert(*s_realm_data[6] == 26, 'failed rivers');
        assert(*s_realm_data[7] == 6, 'failed regions');
        assert(*s_realm_data[8] == 2, 'failed wonder');
        assert(*s_realm_data[9] == 0, 'failed order');
        // resources
        let resource_coal = world.entity('Resource'.into(), (1, 2).into(), 0_u8, 0_usize);
        assert(*resource_coal[0] == 2, 'failed resource id');
        assert(*resource_coal[1] == 252000000000000000000, 'failed resource amount');
        let resource_stone = world.entity('Resource'.into(), (1, 3).into(), 0_u8, 0_usize);
        assert(*resource_stone[0] == 3, 'failed resource id');
        assert(*resource_stone[1] == 252000000000000000000, 'failed resource amount');
        // age
        let age = world.entity('Age'.into(), realm_query, 0_u8, 0_usize);
        assert(*age[0] == 10000, 'failed age');
    // TODO: allow delete_entity in dojo first
    // // unsettle
    // let mut unsettle_call_data = array::ArrayTrait::<felt252>::new();
    // unsettle_call_data.append(1);
    // world.execute('Unsettle'.into(), unsettle_call_data.span());

    // // assert owner of the nft again
    // let new_erc721_owner = world.entity('Owner'.into(), (erc721_address_felt, 1).into(), 0_u8, 0_usize);
    // assert(*new_erc721_owner[0] == caller.into(), 'wrong erc721 owner');

    // let age = world.entity('Age'.into(), realm_query, 0_u8, 0_usize);
    // assert(age.len() == 0, 'age not deleted');

    // let position = world.entity('Position'.into(), realm_query, 0_u8, 0_usize);
    // assert(position.len() == 0, 'position not deleted');

    // let realm_data = world.entity('Realm'.into(), realm_query, 0_u8, 0_usize);
    // assert(realm_data.len() == 0, 'realm_data not deleted');
    }
}
