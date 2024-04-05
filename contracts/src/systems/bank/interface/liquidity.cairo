use dojo::world::IWorldDispatcher;
use cubit::f128::types::fixed::{Fixed, FixedTrait};

#[dojo::interface]
trait ILiquiditySystems {
    fn add(
        bank_entity_id: u128,
        resource_type: u8,
        resource_amount: u128,
        lords_amount: u128,
    );
    fn remove(
        bank_entity_id: u128,
        resource_type: u8,
        shares: Fixed
    );
}

