use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait IBankSystems {
    fn open_account(bank_entity_id: u128) -> ID;
    fn change_owner_fee(
        bank_entity_id: u128,
        new_swap_fee_unscaled: u128
    );
}

