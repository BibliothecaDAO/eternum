#[system]
mod Settle {
    use super::alias::ID;
    use array::ArrayTrait;
    use traits::Into;
    use starknet::get_contract_address;

    use eternum::components::realm::Realm;

    use super::interfaces::IERC721Dispatcher;
    use super::interfaces::IERC721DispatcherTrait;
    use super::interfaces::IRealmsMetaDispatcher;
    use super::interfaces::IRealmsMetaDispatcherTrait;

    #[event]
    fn Settled(owner: ContractAddress, realm: ID)
    ; fn execute(realm_id: ID) {
        // TODO: assert owner?

        // TODO: how to bring in the address of the L2 Realms NFT?
        let l2_nft_addr: ContractAddress = 0x123.into();
        let l2_nft = IERC721Dispatcher { contract_address: l2_nft_addr };

        // transfer NFT to this contract to lock it
        let current_owner = l2_nft.owner_of(realm_id);
        l2_nft.transfer_from(current_owner, get_contract_address(), realm_id);

        // mint srealm? idk

        // call metadata on Realm contract, inject into Realm struct

        // get realm metadata 
        let realms_meta = IRealmsMetaDispatcher { contract_address: l2_nft_addr };
        // let cities = realms_meta.get_cities(realm_id);
        // let harbors = realms_meta.get_harbors(realm_id);
        // ...

        let owner = starknet::get_caller_address();

        // create realm entity, assign Realm component
        let realm = Realm {
            realm_id: realm, // TODO: does this have to be in the component?
            owner,
            resource_ids: 0,
            cities: 2_u8,
            harbors: 3_u8,
            rivers: 2_u8,
            regions: 2_u8,
            wonder: 55_u8,
            order: 12_u8
        }

        commands::set_entity(realm_id, (realm));

        Settled(owner, realm_id);
    }
}
// #[system]
// mod Unsettle {
//     #[event]
//     fn Unsettled(owner: ContractAddress, realm_id: felt252);
//
//     fn execute(realm_id: felt252) {
//         // TODO: delete any and all entities related to the realm
//     }
// }


