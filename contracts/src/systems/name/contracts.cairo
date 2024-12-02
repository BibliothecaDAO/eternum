use s0_eternum::alias::ID;

#[starknet::interface]
trait INameSystems<T> {
    fn set_address_name(ref self: T, name: felt252);
    fn set_entity_name(ref self: T, entity_id: ID, name: felt252);
}

#[dojo::contract]
mod name_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::models::name::{AddressName, EntityName};
    use s0_eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};
    use s0_eternum::models::season::SeasonImpl;

    #[abi(embed_v0)]
    impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(ref self: ContractState, name: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let caller = starknet::get_caller_address();

            // assert that name not set
            let mut address_name: AddressName = world.read_model(caller);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            world.write_model(@address_name);
        }

        fn set_entity_name(ref self: ContractState, entity_id: ID, name: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let entity_owner: EntityOwner = world.read_model(entity_id);
            entity_owner.assert_caller_owner(world);

            world.write_model(@EntityName { entity_id, name });
        }
    }
}
