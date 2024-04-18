use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::{Coord};

#[dojo::interface]
trait IBankSystems {
    fn create_bank(
        coord: Coord, owner_fee_scaled: u128
    ) -> (ID, ID);
    fn open_account(bank_entity_id: u128) -> ID;
    fn change_owner_fee(
        bank_entity_id: u128,
        new_swap_fee_unscaled: u128
    );
}

