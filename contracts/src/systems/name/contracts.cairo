use eternum::alias::ID;

#[dojo::interface]
trait INameSystems {
    fn set_address_name(ref world: IWorldDispatcher, name: felt252);
    fn set_entity_name(ref world: IWorldDispatcher, entity_id: ID, name: felt252);
}

#[dojo::contract]
mod name_systems {
    use eternum::alias::ID;
    use eternum::models::name::{AddressName, EntityName};
    use eternum::models::owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::season::SeasonImpl;

    #[abi(embed_v0)]
    impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(ref world: IWorldDispatcher, name: felt252) {
            SeasonImpl::assert_season_is_not_over(world);

            let caller = starknet::get_caller_address();

            // assert that name not set
            let mut address_name = get!(world, (caller), AddressName);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            set!(world, (address_name));
        }

        fn set_entity_name(ref world: IWorldDispatcher, entity_id: ID, name: felt252) {
            SeasonImpl::assert_season_is_not_over(world);

            get!(world, entity_id, EntityOwner).assert_caller_owner(world);

            set!(world, (EntityName { entity_id, name }));
        }
    }
}
