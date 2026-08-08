use starknet::ContractAddress;
use crate::alias::ID;

#[starknet::interface]
trait IOwnershipSystems<T> {
    fn transfer_structure_ownership(ref self: T, game_id: u32, structure_id: ID, new_owner: ContractAddress);
    fn transfer_agent_ownership(ref self: T, game_id: u32, explorer_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::agent::AgentOwner;
    use crate::models::config::{AgentControllerConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::structure::{StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl};

    #[abi(embed_v0)]
    impl OwnershipSystemsImpl of super::IOwnershipSystems<ContractState> {
        fn transfer_structure_ownership(
            ref self: ContractState, game_id: u32, structure_id: ID, new_owner: ContractAddress,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world, game_id).assert_started_and_not_over();
            // ensure caller owns structure
            StructureOwnerStoreImpl::retrieve(ref world, game_id, structure_id).assert_caller_owner();

            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            let season_mode_on = !blitz_mode_on;
            assert!(season_mode_on, "Eternum: cannot transfer ownership of structure");

            // ensure new_owner is non zero
            assert!(new_owner.is_non_zero(), "new owner is zero");

            // ensure structure is not a village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, game_id, structure_id);
            assert!(
                structure_base.category != StructureCategory::Village.into(), "cannot transfer ownership of village",
            );

            // update structure owner
            StructureOwnerStoreImpl::store(new_owner, ref world, game_id, structure_id)
        }

        fn transfer_agent_ownership(
            ref self: ContractState, game_id: u32, explorer_id: ID, new_owner: ContractAddress,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world, game_id).assert_started_and_not_over();

            // ensure caller is agent controller
            let mut agent_controller_config: AgentControllerConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("agent_controller_config"),
            );
            agent_controller_config.address.assert_caller_owner();

            // update agent owner
            let mut agent_owner: AgentOwner = world.read_model((game_id, explorer_id));
            agent_owner.address = new_owner;
            world.write_model(@agent_owner);
        }
    }
}
