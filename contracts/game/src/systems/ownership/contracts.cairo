use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait IOwnershipSystems<T> {
    fn transfer_structure_ownership(ref self: T, structure_id: ID, new_owner: ContractAddress);
    fn transfer_agent_ownership(ref self: T, explorer_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::agent::AgentOwner;
    use s1_eternum::models::config::{SeasonConfigImpl};
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::structure::{StructureOwnerStoreImpl};
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl OwnershipSystemsImpl of super::IOwnershipSystems<ContractState> {
        fn transfer_structure_ownership(ref self: ContractState, structure_id: ID, new_owner: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();
            // ensure caller owns structure
            StructureOwnerStoreImpl::retrieve(ref world, structure_id).assert_caller_owner();
            // update structure owner
            StructureOwnerStoreImpl::store(new_owner, ref world, structure_id)
        }

        fn transfer_agent_ownership(ref self: ContractState, explorer_id: ID, new_owner: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns agent
            let mut agent_owner: AgentOwner = world.read_model(explorer_id);
            agent_owner.address.assert_caller_owner();

            // update agent owner
            agent_owner.address = new_owner;
            world.write_model(@agent_owner);
        }
    }
}
