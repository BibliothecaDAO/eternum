use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;


#[starknet::interface]
pub trait IERC20<TState> {
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IRealmInternalSystems<T> {
    fn create_internal(
        ref self: T,
        owner: starknet::ContractAddress,
        realm_id: ID,
        resources: Array<u8>,
        order: u8,
        wonder: u8,
        coord: Coord,
        season: bool,
    ) -> ID;
}

#[dojo::contract]
pub mod realm_internal_systems {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::position::Coord;
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl RealmInternalSystemsImpl of super::IRealmInternalSystems<ContractState> {
        fn create_internal(
            ref self: ContractState,
            owner: ContractAddress,
            realm_id: ID,
            resources: Array<u8>,
            order: u8,
            wonder: u8,
            coord: Coord,
            season: bool,
        ) -> ID {
            // ensure caller is the realm systems
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let (realm_systems, _) = world.dns(@"realm_systems").unwrap();
            let (blitz_realm_systems, _) = world.dns(@"blitz_realm_systems").unwrap();
            assert!(
                starknet::get_caller_address() == realm_systems
                    || starknet::get_caller_address() == blitz_realm_systems,
                "caller must be the realm_systems or blitz_realm_systems",
            );

            // create realm
            let structure_id = iRealmImpl::create_realm(
                ref world, owner, realm_id, resources, order, 0, wonder, coord, season,
            );
            structure_id.into()
        }
    }
}
