use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[starknet::interface]
trait IResourceSystems<T> {
    fn mint(ref self: T, entity_id: ID, resources: Span<(u8, u128)>,);
}

#[dojo::contract]
mod dev_resource_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::constants::DEFAULT_NS;
    use eternum::constants::ResourceTypes;
    use eternum::constants::{WORLD_CONFIG_ID};
    use eternum::models::config::{WorldConfig};
    use eternum::models::resources::{Resource, ResourceCustomTrait, ResourceCustomImpl};
    use eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};


    #[abi(embed_v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        fn mint(ref self: ContractState, entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, amount
                    )) => {
                        let (resource_type, amount) = (*resource_type, *amount);
                        assert(amount > 0, 'amount must not be 0');

                        let mut resource = ResourceCustomImpl::get(ref world, (entity_id, resource_type));
                        resource.add(amount);
                        resource.save(ref world);
                    },
                    Option::None => { break; }
                };
            };
        }
    }
}

