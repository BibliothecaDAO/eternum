use starknet::ContractAddress;
use crate::alias::ID;
use crate::models::position::Coord;


#[starknet::interface]
pub trait IERC20<TState> {
    fn balance_of(self: @TState, owner: ContractAddress) -> u256;
    fn decimals(self: @TState) -> u8;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
    fn transfer(ref self: TState, to: ContractAddress, amount: u256) -> bool;
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
        explore_village_coord: bool,
        grant_starting_troops: bool,
    ) -> ID;
    fn provision_internal(ref self: T, structure_id: ID);
}

#[dojo::contract]
pub mod realm_internal_systems {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::position::Coord;
    use crate::systems::utils::realm::iRealmImpl;

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
            explore_village_coord: bool,
            grant_starting_troops: bool,
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

            // create the realm structure first, then optionally attach troop startup
            let structure_id = iRealmImpl::create_realm_structure(
                ref world, owner, realm_id, resources, order, wonder, coord, explore_village_coord,
            );
            if grant_starting_troops {
                iRealmImpl::grant_realm_starting_troops(ref world, structure_id);
            }
            structure_id.into()
        }

        fn provision_internal(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let (realm_systems, _) = world.dns(@"realm_systems").unwrap();
            let (blitz_realm_systems, _) = world.dns(@"blitz_realm_systems").unwrap();
            assert!(
                starknet::get_caller_address() == realm_systems
                    || starknet::get_caller_address() == blitz_realm_systems,
                "caller must be the realm_systems or blitz_realm_systems",
            );

            iRealmImpl::provision_realm(ref world, structure_id);
        }
    }
}
