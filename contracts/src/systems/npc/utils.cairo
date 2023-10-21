use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use starknet::ContractAddress;
use eternum::models::realm::{Realm, RealmTrait};
use eternum::models::owner::Owner;

fn assert_ownership(world: IWorldDispatcher, realm_entity_id: felt252) {
   let player_id: ContractAddress = starknet::get_caller_address();
   let (realm, owner) = get!(world, realm_entity_id, (Realm, Owner));
   assert(owner.address == player_id, 'Realm does not belong to player');
}
