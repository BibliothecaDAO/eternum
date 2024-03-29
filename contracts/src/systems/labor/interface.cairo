use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ILaborSystems {
    fn build(
        realm_id: u128, 
        resource_type: u8, 
        labor_units: u64, 
        multiplier: u64
    );
    fn harvest(
        realm_id: u128, 
        resource_type: u8
    );
    fn purchase(
        entity_id: u128, 
        resource_type: u8, 
        labor_units: u128
    );
}
