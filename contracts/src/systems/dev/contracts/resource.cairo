use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;

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
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::constants::ResourceTypes;
    use s0_eternum::constants::{WORLD_CONFIG_ID};
    use s0_eternum::models::config::{WorldConfig};
    use s0_eternum::models::resources::{Resource, ResourceTrait, ResourceImpl};
    use s0_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};


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

                        let mut resource = ResourceImpl::get(ref world, (entity_id, resource_type));
                        resource.add(amount);
                        resource.save(ref world);
                    },
                    Option::None => { break; }
                };
            };
        }
    }
}

