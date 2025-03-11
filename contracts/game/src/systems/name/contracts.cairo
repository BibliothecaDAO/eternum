#[starknet::interface]
pub trait INameSystems<T> {
    fn set_address_name(ref self: T, name: felt252);
}

#[dojo::contract]
pub mod name_systems {
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::SeasonConfigImpl;
    use s1_eternum::models::name::AddressName;

    #[abi(embed_v0)]
    pub impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(ref self: ContractState, name: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let caller = starknet::get_caller_address();

            // assert that name not set
            let mut address_name: AddressName = world.read_model(caller);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            world.write_model(@address_name);
        }
    }
}
