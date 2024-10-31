use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait IOwnershipSystems<T> {
    fn transfer_ownership(ref self: T, entity_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use eternum::alias::ID;
    use eternum::constants::DEFAULT_NS;
    use eternum::models::owner::{Owner, OwnerCustomImpl, OwnerCustomTrait};
    use eternum::models::season::SeasonImpl;
    use starknet::ContractAddress;
    
    use dojo::world::WorldStorage;
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    #[abi(embed_v0)]
    impl OwnershipSystemsImpl of super::IOwnershipSystems<ContractState> {
        fn transfer_ownership(ref self: ContractState, entity_id: ID, new_owner: ContractAddress) {
            // ensure season is not over
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller is the current owner
            let mut owner: Owner = world.read_model(entity_id);
            owner.assert_caller_owner();

            // transfer ownership
            owner.transfer(new_owner);
            world.write_model(@owner);
        }
    }
}
