use crate::alias::ID;

#[starknet::interface]
pub trait IResourceSystems<T> {
    fn mint(ref self: T, game_id: u32, entity_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::contract]
pub mod dev_resource_systems {
    use dojo::world::WorldStorage;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureBase, StructureBaseImpl, StructureBaseStoreImpl};
    use crate::models::weight::{Weight, WeightImpl};
    use crate::systems::utils::auth::iGameAdminImpl;


    #[abi(embed_v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        fn mint(ref self: ContractState, game_id: u32, entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            iGameAdminImpl::assert_chain_admin(world);
            iGameAdminImpl::assert_dev_mode(world, game_id);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, amount,
                    )) => {
                        let (resource_type, amount) = (*resource_type, *amount);
                        assert(amount > 0, 'amount must not be 0');

                        let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, game_id, entity_id);
                        structure.assert_exists();

                        // add resource to structure
                        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, entity_id);
                        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, game_id, resource_type);
                        let mut resource = SingleResourceStoreImpl::retrieve(
                            ref world,
                            game_id,
                            entity_id,
                            resource_type,
                            ref structure_weight,
                            resource_weight_grams,
                            true,
                        );

                        // update resource
                        resource.add(amount, ref structure_weight, resource_weight_grams);
                        resource.store(ref world);

                        // update structure weight
                        structure_weight.store(ref world, game_id, entity_id);
                    },
                    Option::None => { break; },
                };
            };
        }
    }
}
