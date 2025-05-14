use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait IOwnershipSystems<T> {
    fn transfer_structure_ownership(ref self: T, structure_id: ID, new_owner: ContractAddress);
    fn transfer_agent_ownership(ref self: T, explorer_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::agent::AgentOwner;
    use s1_eternum::models::config::{AgentControllerConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
    };
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl OwnershipSystemsImpl of super::IOwnershipSystems<ContractState> {
        fn transfer_structure_ownership(ref self: ContractState, structure_id: ID, new_owner: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();
            // ensure caller owns structure
            StructureOwnerStoreImpl::retrieve(ref world, structure_id).assert_caller_owner();

            // ensure new_owner is non zero
            assert!(new_owner.is_non_zero(), "new owner is zero");

            // ensure structure is not a village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category != StructureCategory::Village.into(), "cannot transfer ownership of village",
            );

            // update structure owner
            StructureOwnerStoreImpl::store(new_owner, ref world, structure_id)
        }

        fn transfer_agent_ownership(ref self: ContractState, explorer_id: ID, new_owner: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller is agent controller
            let mut agent_controller_config: AgentControllerConfig = WorldConfigUtilImpl::get_member(
                world, selector!("agent_controller_config"),
            );
            agent_controller_config.address.assert_caller_owner();

            // update agent owner
            let mut agent_owner: AgentOwner = world.read_model(explorer_id);
            agent_owner.address = new_owner;
            world.write_model(@agent_owner);
        }
    }
}
