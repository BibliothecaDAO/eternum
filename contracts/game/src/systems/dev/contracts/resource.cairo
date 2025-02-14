use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;

#[starknet::interface]
trait IResourceSystems<T> {
    fn mint(ref self: T, entity_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod dev_resource_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::constants::ResourceTypes;
    use s1_eternum::constants::{WORLD_CONFIG_ID};
    use s1_eternum::models::config::{WorldConfig};
    use s1_eternum::models::structure::{Structure, StructureImpl};
    use s1_eternum::models::resource::resource::{
        SingleResource, SingleResourceImpl, 
        SingleResourceStoreImpl, WeightStoreImpl, ResourceWeightImpl};
    use s1_eternum::models::weight::{Weight, WeightImpl};
    use s1_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};


    #[abi(embed_v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        fn mint(ref self: ContractState, entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, amount,
                    )) => {
                        let (resource_type, amount) = (*resource_type, *amount);
                        assert(amount > 0, 'amount must not be 0');

                        let structure : Structure = world.read_model(entity_id);
                        structure.assert_exists();

                        // add resource to structure
                        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
                        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                        let mut resource 
                            = SingleResourceStoreImpl::retrieve(
                                ref world, entity_id, resource_type, 
                                ref structure_weight, resource_weight_grams, true,
                            );

                        // update resource
                        resource.add(amount, ref structure_weight, resource_weight_grams);
                        resource.store(ref world);

                        // update structure weight
                        structure_weight.store(ref world, entity_id);
                
                    },
                    Option::None => { break; },
                };
            };
        }
    }
}

