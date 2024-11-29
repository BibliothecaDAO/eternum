use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait IOwnershipSystems<T> {
    fn transfer_ownership(ref self: T, entity_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::models::owner::{Owner, OwnerCustomImpl, OwnerCustomTrait};
    use s0_eternum::models::season::SeasonImpl;
    use starknet::ContractAddress;

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
