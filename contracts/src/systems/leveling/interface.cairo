use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ILevelingSystems<TContractState> {
    fn level_up_realm(self: @TContractState, world: IWorldDispatcher, realm_entity_id: ID);
    fn level_up_hyperstructure(self: @TContractState, world: IWorldDispatcher, hyperstructure_id: ID,);
}
