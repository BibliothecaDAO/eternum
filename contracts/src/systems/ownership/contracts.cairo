use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use starknet::ContractAddress;

#[dojo::interface]
trait IOwnershipSystems {
    fn transfer_ownership(ref world: IWorldDispatcher, entity_id: ID, new_owner: ContractAddress);
}

#[dojo::contract]
mod ownership_systems {
    use eternum::alias::ID;
    use eternum::models::owner::{Owner, OwnerCustomImpl, OwnerCustomTrait};
    use eternum::models::season::SeasonImpl;
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl OwnershipSystemsImpl of super::IOwnershipSystems<ContractState> {
        fn transfer_ownership(ref world: IWorldDispatcher, entity_id: ID, new_owner: ContractAddress) {
            // ensure season is not over
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller is the current owner
            let mut owner = get!(world, entity_id, Owner);
            owner.assert_caller_owner();

            // transfer ownership
            owner.transfer(new_owner);
            set!(world, (owner));
        }
    }
}
