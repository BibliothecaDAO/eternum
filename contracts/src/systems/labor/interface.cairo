use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ILaborSystems<TContractState> {
    fn build(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128, 
        resource_type: u8, 
        labor_units: u64, 
        multiplier: u64
    );
    fn harvest(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128, 
        resource_type: u8
    );
    fn purchase(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_id: u128, 
        resource_type: u8, 
        labor_units: u128
    );
}
