use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ILevelingSystems<TContractState> {
    fn levelUp(
        self: @TContractState, world: IWorldDispatcher, 
        realm_entity_id: ID, 
    );
}
